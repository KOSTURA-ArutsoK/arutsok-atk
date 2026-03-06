import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { db } from "./db";
import { appUsers } from "@shared/schema";
import { eq } from "drizzle-orm";

declare module "express-session" {
  interface SessionData {
    userId: number;
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
      sameSite: "lax",
      maxAge: sessionTtlMs,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  await seedAdminPassword();

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "Zadajte meno a heslo" });
      }

      const [user] = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.username, username));

      if (!user) {
        return res.status(401).json({ message: "Nesprávne meno alebo heslo" });
      }

      if (!user.password) {
        return res.status(401).json({ message: "Účet nemá nastavené heslo" });
      }

      const valid = await bcrypt.compare(password, user.password);
      if (!valid) {
        return res.status(401).json({ message: "Nesprávne meno alebo heslo" });
      }

      req.session.userId = user.id;
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Chyba pri prihlásení" });
        }
        res.json({
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        });
      });
    } catch (err: any) {
      console.error("Login error:", err);
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
  if (req.session.userId) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
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
