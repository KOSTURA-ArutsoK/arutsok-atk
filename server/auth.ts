import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { db } from "./db";
import { appUsers, subjects, auditLogs } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: number;
    loginSubjectId: number | null;
    loginStep: "subject_select" | "phone_verify" | "done";
  }
}

export function getSession() {
  const sessionTtlMs = 7 * 24 * 60 * 60 * 1000;
  const sessionTtlSec = 7 * 24 * 60 * 60;

  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is required in production");
  }

  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtlSec,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || "dev-only-secret-not-for-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: sessionTtlMs,
    },
  });
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  const last3 = digits.slice(-3);
  const prefix = phone.startsWith("+") ? phone.split(" ")[0] || "+421" : "+421";
  return `${prefix} *** *** ${last3}`;
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  await seedAdminPassword();

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: "Príliš veľa pokusov o prihlásenie. Skúste to znova o 15 minút." },
    validate: { xForwardedForHeader: false },
  });

  app.post("/api/login", loginLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Zadajte e-mail a heslo" });
      }

      const [user] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.email, email.trim().toLowerCase()));

      if (!user) {
        return res.status(401).json({ message: "Nesprávny e-mail alebo heslo" });
      }

      if (!user.password) {
        return res.status(401).json({ message: "Účet nemá nastavené heslo" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Nesprávny e-mail alebo heslo" });
      }

      const matchingSubjects = await db
        .select({
          id: subjects.id,
          uid: subjects.uid,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          companyName: subjects.companyName,
          type: subjects.type,
          phone: subjects.phone,
          email: subjects.email,
        })
        .from(subjects)
        .where(
          and(
            eq(subjects.email, email.trim().toLowerCase()),
            isNull(subjects.deletedAt)
          )
        );

      req.session.userId = user.id;

      if (matchingSubjects.length === 1) {
        req.session.loginSubjectId = matchingSubjects[0].id;
        req.session.loginStep = "phone_verify";
      } else if (matchingSubjects.length > 1) {
        req.session.loginSubjectId = null;
        req.session.loginStep = "subject_select";
      } else {
        req.session.loginSubjectId = null;
        req.session.loginStep = "done";
        await db.update(appUsers).set({ lastLoginAt: new Date() }).where(eq(appUsers.id, user.id));
      }

      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Chyba pri prihlásení" });
        }

        const response: any = {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          loginStep: req.session.loginStep,
        };

        if (matchingSubjects.length === 1) {
          response.selectedSubject = {
            id: matchingSubjects[0].id,
            firstName: matchingSubjects[0].firstName,
            lastName: matchingSubjects[0].lastName,
            phone: matchingSubjects[0].phone ? maskPhone(matchingSubjects[0].phone) : null,
          };
        } else if (matchingSubjects.length > 1) {
          response.subjects = matchingSubjects.map((s) => ({
            id: s.id,
            uid: s.uid,
            firstName: s.firstName,
            lastName: s.lastName,
            companyName: s.companyName,
            type: s.type,
          }));
        }

        res.json(response);
      });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/login/select-subject", loginLimiter, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }

      if (req.session.loginStep !== "subject_select") {
        return res.status(403).json({ message: "Neplatný krok prihlásenia" });
      }

      const { subjectId } = req.body;
      if (!subjectId) {
        return res.status(400).json({ message: "Vyberte subjekt" });
      }

      const [user] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
      if (!user) {
        return res.status(401).json({ message: "Používateľ nenájdený" });
      }

      const [subject] = await db
        .select()
        .from(subjects)
        .where(
          and(
            eq(subjects.id, subjectId),
            eq(subjects.email, user.email!.toLowerCase()),
            isNull(subjects.deletedAt)
          )
        );

      if (!subject) {
        return res.status(403).json({ message: "Subjekt nepatrí k vášmu e-mailu" });
      }

      req.session.loginSubjectId = subject.id;
      req.session.loginStep = "phone_verify";

      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Chyba session" });
        }
        res.json({
          loginStep: "phone_verify",
          selectedSubject: {
            id: subject.id,
            firstName: subject.firstName,
            lastName: subject.lastName,
            phone: subject.phone ? maskPhone(subject.phone) : null,
          },
        });
      });
    } catch (err) {
      console.error("Select subject error:", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/login/verify-phone", loginLimiter, async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }

      if (req.session.loginStep !== "phone_verify") {
        return res.status(403).json({ message: "Neplatný krok prihlásenia" });
      }

      const { confirmed, newPhone, smsCode } = req.body;
      const subjectId = req.session.loginSubjectId;
      const userId = req.session.userId;

      let auditAction = "login_identity_verified";
      let auditNewData: any = {};

      if (subjectId) {
        const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId));

        if (!confirmed) {
          if (!newPhone || !smsCode) {
            return res.status(400).json({ message: "Zadajte nové telefónne číslo a SMS kód" });
          }

          if (!/^\d{6}$/.test(smsCode)) {
            return res.status(400).json({ message: "SMS kód musí mať 6 číslic" });
          }

          await db
            .update(subjects)
            .set({ phone: newPhone })
            .where(eq(subjects.id, subjectId));

          auditAction = "login_phone_changed";
          auditNewData = { phone: newPhone, previousPhone: subject?.phone || null };
        } else {
          auditNewData = { phone: subject?.phone || null, confirmed: true };
        }

        await db.insert(auditLogs).values({
          userId,
          username: null,
          action: auditAction,
          module: "Auth",
          entityId: subjectId,
          entityName: subject ? `${subject.firstName} ${subject.lastName}` : null,
          oldData: null,
          newData: auditNewData,
          ipAddress: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || null,
        });
      }

      req.session.loginStep = "done";
      await db.update(appUsers).set({ lastLoginAt: new Date() }).where(eq(appUsers.id, userId));
      req.session.save((err) => {
        if (err) {
          return res.status(500).json({ message: "Chyba session" });
        }
        res.json({ loginStep: "done", ok: true });
      });
    } catch (err) {
      console.error("Verify phone error:", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Chyba pri odhlásení" });
      }
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/user", (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    db.select()
      .from(appUsers)
      .where(eq(appUsers.id, req.session.userId))
      .then(([user]) => {
        if (!user) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        res.json({
          id: String(user.id),
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        });
      })
      .catch((err) => {
        console.error("Auth user error:", err);
        res.status(500).json({ message: "Interná chyba" });
      });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  if (req.session.loginStep && req.session.loginStep !== "done") {
    return res.status(403).json({ message: "Login flow incomplete" });
  }
  next();
};

async function seedAdminPassword() {
  try {
    const allUsers = await db.select().from(appUsers);
    if (allUsers.length === 0) return;

    const usersWithoutPassword = allUsers.filter((u) => !u.password);
    if (usersWithoutPassword.length > 0) {
      const hash = await bcrypt.hash("admin", 10);
      for (const user of usersWithoutPassword) {
        await db
          .update(appUsers)
          .set({ password: hash })
          .where(eq(appUsers.id, user.id));
        console.log(
          `[AUTH SEED] Password set for user: ${user.username} (id=${user.id})`
        );
      }
    }
  } catch (err) {
    console.error("[AUTH SEED] Error:", err);
  }
}
