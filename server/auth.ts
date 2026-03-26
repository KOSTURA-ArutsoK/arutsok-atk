import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { db } from "./db";
import { appUsers, subjects, auditLogs, appUserLoginHistory, clientDocumentHistory } from "@shared/schema";
import { eq, and, isNull, gte, desc } from "drizzle-orm";
import { decryptField } from "./crypto";

declare module "express-session" {
  interface SessionData {
    userId: number;
    loginSubjectId: number | null;
    loginStep: "subject_select" | "sms_verify" | "rc_verify" | "doc_verify" | "phone_verify" | "done";
    pendingSmsCode?: string;
    pendingSubjectPhone?: string;
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

function maskDocNumber(num: string): string {
  if (!num) return "***";
  if (num.length <= 3) return "***";
  return "*".repeat(num.length - 3) + num.slice(-3);
}

function parseBirthDateFromRC(rc: string): Date | null {
  const clean = rc.replace(/[\s\/]/g, "");
  if (clean.length < 9 || !/^\d+$/.test(clean)) return null;
  const yy = parseInt(clean.substring(0, 2), 10);
  let mm = parseInt(clean.substring(2, 4), 10);
  const dd = parseInt(clean.substring(4, 6), 10);
  if (mm > 50) mm -= 50;
  if (mm > 20) mm -= 20;
  const year = yy >= 0 && yy <= 30 ? 2000 + yy : 1900 + yy;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const d = new Date(year, mm - 1, dd);
  if (isNaN(d.getTime())) return null;
  return d;
}

function calcAge(birthDate: Date, referenceDate: Date = new Date()): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const m = referenceDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && referenceDate.getDate() < birthDate.getDate())) age--;
  return age;
}

function isPersonAdult(decryptedRC: string | null): boolean | null {
  if (!decryptedRC) return null;
  const bd = parseBirthDateFromRC(decryptedRC);
  if (!bd) return null;
  return calcAge(bd) >= 18;
}

function isPerson(type: string | null): boolean {
  return type === "person";
}

function isSzco(type: string | null): boolean {
  return type === "szco";
}

function isLegalEntity(type: string | null): boolean {
  return type === "company" || type === "organization" || type === "state" || type === "os";
}

async function writeLoginAudit(
  userId: number,
  subjectId: number | null,
  entityName: string | null,
  validationMethod: "SMS" | "RC" | "DOC" | "DIRECT" | "SHADOW_ACCESS",
  reason: string | null,
  ip: string | null
) {
  await db.insert(auditLogs).values({
    userId,
    username: null,
    action: "login_subject_access",
    module: "Auth",
    entityId: subjectId,
    entityName,
    oldData: null,
    newData: { validationMethod, reason },
    ipAddress: ip,
  });
}

async function recordLoginHistory(userId: number, ip: string | null) {
  const loginNow = new Date();
  const tenSecsAgo = new Date(loginNow.getTime() - 10000);
  const [recent] = await db.select().from(appUserLoginHistory)
    .where(and(eq(appUserLoginHistory.appUserId, userId), gte(appUserLoginHistory.loginAt, tenSecsAgo)));
  if (!recent) {
    await db.update(appUsers).set({ lastLoginAt: loginNow }).where(eq(appUsers.id, userId));
    await db.insert(appUserLoginHistory).values({ appUserId: userId, loginAt: loginNow, ipAddress: ip });
  }
}

function subjectDisplayName(s: { firstName?: string | null; lastName?: string | null; companyName?: string | null }): string {
  if (s.firstName || s.lastName) return `${s.firstName || ""} ${s.lastName || ""}`.trim();
  return s.companyName || "Neznámy subjekt";
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

      const peerSubjectsRaw = await db
        .select({
          id: subjects.id,
          uid: subjects.uid,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          companyName: subjects.companyName,
          type: subjects.type,
          phone: subjects.phone,
          birthNumber: subjects.birthNumber,
          listStatus: subjects.listStatus,
          parentSubjectId: subjects.parentSubjectId,
        })
        .from(subjects)
        .where(
          and(
            eq(subjects.email, email.trim().toLowerCase()),
            isNull(subjects.deletedAt)
          )
        );

      const shadowSubjectsRaw = user.linkedSubjectId
        ? await db
            .select({
              id: subjects.id,
              uid: subjects.uid,
              firstName: subjects.firstName,
              lastName: subjects.lastName,
              companyName: subjects.companyName,
              type: subjects.type,
              phone: subjects.phone,
              birthNumber: subjects.birthNumber,
              listStatus: subjects.listStatus,
              parentSubjectId: subjects.parentSubjectId,
            })
            .from(subjects)
            .where(
              and(
                eq(subjects.parentSubjectId, user.linkedSubjectId),
                isNull(subjects.deletedAt)
              )
            )
        : [];

      const peerIds = new Set(peerSubjectsRaw.map((s) => s.id));
      const shadowOnly = shadowSubjectsRaw.filter((s) => !peerIds.has(s.id));

      req.session.userId = user.id;

      const buildSubjectMeta = async (s: typeof peerSubjectsRaw[0], isShadow: boolean) => {
        let adultStatus: boolean | null = null;
        let documentHint: { documentType: string | null; masked: string | null } | null = null;

        if (isPerson(s.type)) {
          if (s.birthNumber) {
            const decrypted = decryptField(s.birthNumber);
            adultStatus = isPersonAdult(decrypted);
          } else {
            const [latestDoc] = await db
              .select({
                documentType: clientDocumentHistory.documentType,
                documentNumber: clientDocumentHistory.documentNumber,
              })
              .from(clientDocumentHistory)
              .where(eq(clientDocumentHistory.subjectId, s.id))
              .orderBy(desc(clientDocumentHistory.archivedAt))
              .limit(1);

            if (latestDoc) {
              documentHint = {
                documentType: latestDoc.documentType,
                masked: latestDoc.documentNumber ? maskDocNumber(latestDoc.documentNumber) : null,
              };
            } else {
              documentHint = { documentType: null, masked: null };
            }
          }
        }

        return {
          id: s.id,
          uid: s.uid,
          firstName: s.firstName,
          lastName: s.lastName,
          companyName: s.companyName,
          type: s.type,
          phone: s.phone ? maskPhone(s.phone) : null,
          isShadow,
          isAdult: adultStatus,
          hasRisk: s.listStatus === "cerveny",
          documentHint,
        };
      };

      if (peerSubjectsRaw.length === 0 && shadowOnly.length === 0) {
        req.session.loginSubjectId = null;
        req.session.loginStep = "done";
        const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
        await recordLoginHistory(user.id, ip);
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba pri prihlásení" });
          res.json({ id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, loginStep: "done" });
        });
      }

      if (peerSubjectsRaw.length === 1 && shadowOnly.length === 0) {
        req.session.loginSubjectId = peerSubjectsRaw[0].id;
        req.session.loginStep = "phone_verify";
        const meta = await buildSubjectMeta(peerSubjectsRaw[0], false);
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba pri prihlásení" });
          res.json({
            id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role,
            loginStep: "phone_verify",
            selectedSubject: { id: meta.id, firstName: meta.firstName, lastName: meta.lastName, phone: meta.phone },
          });
        });
      }

      req.session.loginSubjectId = null;
      req.session.loginStep = "subject_select";

      const peerMetas = await Promise.all(peerSubjectsRaw.map((s) => buildSubjectMeta(s, false)));
      const shadowMetas = await Promise.all(shadowOnly.map((s) => buildSubjectMeta(s, true)));

      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba pri prihlásení" });
        res.json({
          id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role,
          loginStep: "subject_select",
          subjects: [...peerMetas, ...shadowMetas],
        });
      });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.get("/api/login/subjects", async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      if (req.session.loginStep !== "subject_select") {
        return res.status(403).json({ message: "Neplatný krok prihlásenia" });
      }

      const [user] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
      if (!user) return res.status(401).json({ message: "Používateľ nenájdený" });

      const peerSubjectsRaw = await db
        .select({ id: subjects.id, uid: subjects.uid, firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type, phone: subjects.phone, birthNumber: subjects.birthNumber, listStatus: subjects.listStatus, parentSubjectId: subjects.parentSubjectId })
        .from(subjects)
        .where(and(eq(subjects.email, user.email!.toLowerCase()), isNull(subjects.deletedAt)));

      const shadowSubjectsRaw = user.linkedSubjectId
        ? await db
            .select({ id: subjects.id, uid: subjects.uid, firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type, phone: subjects.phone, birthNumber: subjects.birthNumber, listStatus: subjects.listStatus, parentSubjectId: subjects.parentSubjectId })
            .from(subjects)
            .where(and(eq(subjects.parentSubjectId, user.linkedSubjectId), isNull(subjects.deletedAt)))
        : [];

      const peerIds = new Set(peerSubjectsRaw.map((s) => s.id));
      const shadowOnly = shadowSubjectsRaw.filter((s) => !peerIds.has(s.id));

      const buildMeta = async (s: typeof peerSubjectsRaw[0], isShadow: boolean) => {
        let adultStatus: boolean | null = null;
        let documentHint: { documentType: string | null; masked: string | null } | null = null;
        if (isPerson(s.type)) {
          if (s.birthNumber) {
            adultStatus = isPersonAdult(decryptField(s.birthNumber));
          } else {
            const [doc] = await db.select({ documentType: clientDocumentHistory.documentType, documentNumber: clientDocumentHistory.documentNumber }).from(clientDocumentHistory).where(eq(clientDocumentHistory.subjectId, s.id)).orderBy(desc(clientDocumentHistory.archivedAt)).limit(1);
            documentHint = doc ? { documentType: doc.documentType, masked: doc.documentNumber ? maskDocNumber(doc.documentNumber) : null } : { documentType: null, masked: null };
          }
        }
        return { id: s.id, uid: s.uid, firstName: s.firstName, lastName: s.lastName, companyName: s.companyName, type: s.type, phone: s.phone ? maskPhone(s.phone) : null, isShadow, isAdult: adultStatus, hasRisk: s.listStatus === "cerveny", documentHint };
      };

      const peerMetas = await Promise.all(peerSubjectsRaw.map((s) => buildMeta(s, false)));
      const shadowMetas = await Promise.all(shadowOnly.map((s) => buildMeta(s, true)));

      res.json({ subjects: [...peerMetas, ...shadowMetas] });
    } catch (err) {
      console.error("Login subjects error:", err);
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
      if (!user) return res.status(401).json({ message: "Používateľ nenájdený" });

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;

      const [selected] = await db
        .select()
        .from(subjects)
        .where(and(eq(subjects.id, subjectId), isNull(subjects.deletedAt)));

      if (!selected) {
        return res.status(403).json({ message: "Subjekt nenájdený" });
      }

      const isPeerSubject = selected.email?.toLowerCase() === user.email?.toLowerCase();

      const isShadowSubject =
        !isPeerSubject &&
        user.linkedSubjectId !== null &&
        selected.parentSubjectId === user.linkedSubjectId &&
        (!selected.email || selected.email.toLowerCase() !== user.email?.toLowerCase());

      if (!isPeerSubject && !isShadowSubject) {
        return res.status(403).json({ message: "Subjekt nepatrí k vášmu účtu" });
      }

      const allPeers = await db
        .select()
        .from(subjects)
        .where(and(eq(subjects.email, user.email!.toLowerCase()), isNull(subjects.deletedAt)));

      if (isShadowSubject) {
        req.session.loginSubjectId = selected.id;
        req.session.loginStep = "phone_verify";
        const shadowName = subjectDisplayName(selected);
        await writeLoginAudit(user.id, selected.id, shadowName, "SHADOW_ACCESS", "shadow_direct", ip);
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.json({
            nextStep: "phone_verify",
            selectedSubject: { id: selected.id, firstName: selected.firstName, lastName: selected.lastName, phone: selected.phone ? maskPhone(selected.phone) : null },
          });
        });
      }

      const hasRiskInCluster = allPeers.some((s) => s.listStatus === "cerveny");

      const selectedRC = selected.birthNumber ? decryptField(selected.birthNumber) : null;
      const selectedBirthDate = selectedRC ? parseBirthDateFromRC(selectedRC) : null;
      const selectedAdult = selectedBirthDate ? calcAge(selectedBirthDate) >= 18 : null;

      const name = subjectDisplayName(selected);

      if (hasRiskInCluster) {
        if (!selected.birthNumber) {
          const [latestDoc] = await db
            .select({ documentType: clientDocumentHistory.documentType, documentNumber: clientDocumentHistory.documentNumber })
            .from(clientDocumentHistory)
            .where(eq(clientDocumentHistory.subjectId, selected.id))
            .orderBy(desc(clientDocumentHistory.archivedAt))
            .limit(1);

          if (!latestDoc || !latestDoc.documentNumber) {
            return req.session.save((err) => {
              if (err) return res.status(500).json({ message: "Chyba session" });
              res.json({ nextStep: "blocked", message: "Identita nebola overená. Kontaktujte prosím podporu pre doplnenie údajov." });
            });
          }

          req.session.loginSubjectId = selected.id;
          req.session.loginStep = "doc_verify";
          return req.session.save((err) => {
            if (err) return res.status(500).json({ message: "Chyba session" });
            res.json({
              nextStep: "doc_verify",
              documentHint: { documentType: latestDoc.documentType, masked: maskDocNumber(latestDoc.documentNumber!) },
              reason: "risk_override",
            });
          });
        }

        req.session.loginSubjectId = selected.id;
        req.session.loginStep = "rc_verify";
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.json({ nextStep: "rc_verify", reason: "risk_override" });
        });
      }

      if (isPerson(selected.type) && !selected.birthNumber) {
        const [latestDoc] = await db
          .select({ documentType: clientDocumentHistory.documentType, documentNumber: clientDocumentHistory.documentNumber })
          .from(clientDocumentHistory)
          .where(eq(clientDocumentHistory.subjectId, selected.id))
          .orderBy(desc(clientDocumentHistory.archivedAt))
          .limit(1);

        if (!latestDoc || !latestDoc.documentNumber) {
          return req.session.save((err) => {
            if (err) return res.status(500).json({ message: "Chyba session" });
            res.json({ nextStep: "blocked", message: "Identita nebola overená. Kontaktujte prosím podporu pre doplnenie údajov." });
          });
        }

        req.session.loginSubjectId = selected.id;
        req.session.loginStep = "doc_verify";
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.json({
            nextStep: "doc_verify",
            documentHint: { documentType: latestDoc.documentType, masked: maskDocNumber(latestDoc.documentNumber!) },
          });
        });
      }

      if (isSzco(selected.type) || (isPerson(selected.type) && allPeers.some((p) => p.id !== selected.id && isSzco(p.type)))) {
        const szcoPartner = isSzco(selected.type)
          ? allPeers.find((p) => isPerson(p.type))
          : allPeers.find((p) => isSzco(p.type));

        if (szcoPartner && szcoPartner.birthNumber && selected.birthNumber) {
          const szcoRC = decryptField(szcoPartner.birthNumber);
          if (szcoRC && selectedRC && szcoRC === selectedRC) {
            req.session.loginSubjectId = selected.id;
            req.session.loginStep = "phone_verify";
            await writeLoginAudit(user.id, selected.id, name, "DIRECT", "szco_fo_same_rc", ip);
            return req.session.save((err) => {
              if (err) return res.status(500).json({ message: "Chyba session" });
              res.json({ nextStep: "phone_verify", selectedSubject: { id: selected.id, firstName: selected.firstName, lastName: selected.lastName, phone: selected.phone ? maskPhone(selected.phone) : null } });
            });
          }
        }
      }

      if (isLegalEntity(selected.type)) {
        req.session.loginSubjectId = selected.id;
        req.session.loginStep = "phone_verify";
        await writeLoginAudit(user.id, selected.id, name, "DIRECT", null, ip);
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.json({ nextStep: "phone_verify", selectedSubject: { id: selected.id, firstName: selected.firstName, lastName: selected.lastName, companyName: selected.companyName, phone: selected.phone ? maskPhone(selected.phone) : null } });
        });
      }

      if (isPerson(selected.type) && selectedAdult === false) {
        req.session.loginSubjectId = selected.id;
        req.session.loginStep = "phone_verify";
        await writeLoginAudit(user.id, selected.id, name, "DIRECT", "minor_direct", ip);
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.json({ nextStep: "phone_verify", selectedSubject: { id: selected.id, firstName: selected.firstName, lastName: selected.lastName, phone: selected.phone ? maskPhone(selected.phone) : null } });
        });
      }

      if (isPerson(selected.type) && selectedAdult === true) {
        let hasAnotherAdultFo = false;
        for (const peer of allPeers) {
          if (peer.id !== selected.id && isPerson(peer.type) && peer.birthNumber) {
            const peerRC = decryptField(peer.birthNumber);
            const peerBD = peerRC ? parseBirthDateFromRC(peerRC) : null;
            if (peerBD && calcAge(peerBD) >= 18) {
              hasAnotherAdultFo = true;
              break;
            }
          }
        }

        if (!hasAnotherAdultFo) {
          const selectedPhone = selected.phone?.replace(/\D/g, "") || "";
          const otherPhones = allPeers
            .filter((p) => p.id !== selected.id && p.phone)
            .map((p) => p.phone!.replace(/\D/g, ""));
          const hasUniquePhone = selectedPhone && otherPhones.length > 0 && !otherPhones.includes(selectedPhone);

          if (hasUniquePhone) {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            console.log(`[AUTH SMS MOCK] SMS kód pre ${selected.phone}: ${code}`);
            req.session.loginSubjectId = selected.id;
            req.session.loginStep = "sms_verify";
            req.session.pendingSmsCode = code;
            req.session.pendingSubjectPhone = selected.phone ? maskPhone(selected.phone) : null;
            return req.session.save((err) => {
              if (err) return res.status(500).json({ message: "Chyba session" });
              res.json({ nextStep: "sms_verify", maskedPhone: req.session.pendingSubjectPhone });
            });
          }
        }

        req.session.loginSubjectId = selected.id;
        req.session.loginStep = "rc_verify";
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.json({ nextStep: "rc_verify" });
        });
      }

      req.session.loginSubjectId = selected.id;
      req.session.loginStep = "phone_verify";
      await writeLoginAudit(user.id, selected.id, name, "DIRECT", null, ip);
      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({ nextStep: "phone_verify", selectedSubject: { id: selected.id, firstName: selected.firstName, lastName: selected.lastName, phone: selected.phone ? maskPhone(selected.phone) : null } });
      });
    } catch (err) {
      console.error("Select subject error:", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/login/verify-sms", loginLimiter, async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "sms_verify") {
        return res.status(403).json({ message: "Neplatný krok prihlásenia" });
      }

      const { code } = req.body;
      if (!code || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: "Zadajte platný 6-miestny kód" });
      }

      if (code !== req.session.pendingSmsCode) {
        return res.status(400).json({ message: "Nesprávny SMS kód" });
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
      const subjectId = req.session.loginSubjectId;

      if (subjectId) {
        const [s] = await db.select({ firstName: subjects.firstName, lastName: subjects.lastName })
          .from(subjects).where(eq(subjects.id, subjectId));
        const name = s ? subjectDisplayName(s) : null;
        await writeLoginAudit(req.session.userId, subjectId, name, "SMS", null, ip);
      }

      req.session.loginStep = "phone_verify";
      req.session.pendingSmsCode = undefined;

      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({ nextStep: "phone_verify" });
      });
    } catch (err) {
      console.error("Verify SMS error:", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/login/verify-rc", loginLimiter, async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "rc_verify") {
        return res.status(403).json({ message: "Neplatný krok prihlásenia" });
      }

      const { rc } = req.body;
      if (!rc || typeof rc !== "string") {
        return res.status(400).json({ message: "Zadajte rodné číslo" });
      }

      const subjectId = req.session.loginSubjectId;
      if (!subjectId) return res.status(400).json({ message: "Subjekt nebol vybraný" });

      const [subject] = await db.select({ birthNumber: subjects.birthNumber, firstName: subjects.firstName, lastName: subjects.lastName })
        .from(subjects).where(eq(subjects.id, subjectId));

      if (!subject || !subject.birthNumber) {
        return res.status(400).json({ message: "Subjekt nemá evidované rodné číslo" });
      }

      const decrypted = decryptField(subject.birthNumber);
      const normalizedInput = rc.replace(/[\s\/]/g, "");
      const normalizedStored = decrypted ? decrypted.replace(/[\s\/]/g, "") : null;

      if (!normalizedStored || normalizedInput !== normalizedStored) {
        return res.status(400).json({ message: "Nesprávne rodné číslo" });
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
      const name = subjectDisplayName(subject);
      await writeLoginAudit(req.session.userId, subjectId, name, "RC", null, ip);

      req.session.loginStep = "phone_verify";
      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({ nextStep: "phone_verify" });
      });
    } catch (err) {
      console.error("Verify RC error:", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/login/verify-doc", loginLimiter, async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "doc_verify") {
        return res.status(403).json({ message: "Neplatný krok prihlásenia" });
      }

      const { docNumber } = req.body;
      if (!docNumber || typeof docNumber !== "string") {
        return res.status(400).json({ message: "Zadajte číslo dokladu" });
      }

      const subjectId = req.session.loginSubjectId;
      if (!subjectId) return res.status(400).json({ message: "Subjekt nebol vybraný" });

      const [latestDoc] = await db
        .select({ documentNumber: clientDocumentHistory.documentNumber, documentType: clientDocumentHistory.documentType })
        .from(clientDocumentHistory)
        .where(eq(clientDocumentHistory.subjectId, subjectId))
        .orderBy(desc(clientDocumentHistory.archivedAt))
        .limit(1);

      if (!latestDoc || !latestDoc.documentNumber) {
        return res.status(400).json({ message: "Identita nebola overená. Kontaktujte prosím podporu pre doplnenie údajov." });
      }

      if (docNumber.trim().toUpperCase() !== latestDoc.documentNumber.trim().toUpperCase()) {
        return res.status(400).json({ message: "Nesprávne číslo dokladu" });
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
      const [s] = await db.select({ firstName: subjects.firstName, lastName: subjects.lastName })
        .from(subjects).where(eq(subjects.id, subjectId));
      const name = s ? subjectDisplayName(s) : null;
      await writeLoginAudit(req.session.userId, subjectId, name, "DOC", null, ip);

      req.session.loginStep = "phone_verify";
      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({ nextStep: "phone_verify" });
      });
    } catch (err) {
      console.error("Verify doc error:", err);
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
      const ip2 = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
      await recordLoginHistory(userId, ip2);

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

  app.post("/api/logout", async (req, res) => {
    const userId = (req.session as any).userId;
    if (userId) {
      try {
        const [lastEntry] = await db
          .select({ id: appUserLoginHistory.id })
          .from(appUserLoginHistory)
          .where(and(eq(appUserLoginHistory.appUserId, userId), isNull(appUserLoginHistory.logoutAt)))
          .orderBy(desc(appUserLoginHistory.loginAt))
          .limit(1);
        if (lastEntry) {
          await db.update(appUserLoginHistory)
            .set({ logoutAt: new Date() })
            .where(eq(appUserLoginHistory.id, lastEntry.id));
        }
      } catch (e) {
        console.error("Logout: failed to record logoutAt", e);
      }
    }
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
