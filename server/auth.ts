import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { db } from "./db";
import { appUsers, subjects, auditLogs, appUserLoginHistory, clientDocumentHistory, companyOfficers, accountLinks, partners, partnerContacts, myCompanies, subjectContacts } from "@shared/schema";
import { eq, and, or, ne, isNull, isNotNull, gte, desc, inArray, sql } from "drizzle-orm";
import { storage } from "./storage";
import { decryptField } from "./crypto";

declare module "express-session" {
  interface SessionData {
    userId: number;
    loginSubjectId: number | null;
    loginStep: "subject_select" | "sms_verify" | "rc_verify" | "doc_verify" | "phone_verify" | "entity_rc_verify" | "done";
    pendingSmsCode?: string;
    pendingSubjectPhone?: string;
    pendingVerifyReason?: string;
    pendingEntitySubjectId?: number;
    pendingEntityCandidateIds?: number[];
    entityRcAttempts?: number;
    loginActingAsEntityId?: number;
    pendingAccountLinkUserId?: number;
    pendingAccountLinkOtp?: string;
    pendingAccountLinkExpiry?: number;
    pendingAccountLinkAttempts?: number;
    pendingAccountLinkIsReactivation?: boolean;
    pendingAccountLinkMethod?: "email" | "sms";
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
  const prefix = phone.startsWith("+") ? (phone.match(/^\+\d{1,3}/)?.[0] || "+421") : "+421";
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
  validationMethod: "SMS" | "RC" | "DOC" | "DIRECT" | "SHADOW_ACCESS" | "ENTITY_RC" | "ENTITY_DIRECT",
  reason: string | null,
  ip: string | null,
  actingAsEntityId?: number,
  opts?: { foUid?: string | null; entityType?: string | null }
) {
  await db.insert(auditLogs).values({
    userId,
    username: null,
    action: actingAsEntityId ? "ENTITY_LOGIN" : "login_subject_access",
    module: "Auth",
    entityId: actingAsEntityId ?? subjectId,
    entityName,
    oldData: null,
    newData: {
      validationMethod,
      reason,
      foSubjectId: subjectId,
      foUid: opts?.foUid ?? null,
      entityType: opts?.entityType ?? null,
      actingAsEntityId: actingAsEntityId ?? null,
    },
    ipAddress: ip,
  });
}

async function getLinkedOfficers(
  subject: { id: number; type: string | null; myCompanyId: number | null; ico?: string | null }
): Promise<{ subjectId: number }[]> {
  if (subject.type === "mycompany" && subject.myCompanyId) {
    const officers = await db
      .select({ subjectId: companyOfficers.subjectId })
      .from(companyOfficers)
      .where(
        and(
          eq(companyOfficers.companyId, subject.myCompanyId),
          eq(companyOfficers.isActive, true),
          isNotNull(companyOfficers.subjectId)
        )
      );
    return officers.filter((o) => o.subjectId !== null) as { subjectId: number }[];
  }

  if (isLegalEntity(subject.type)) {
    // For legal entity subjects: resolve contacts via partner record linked by ICO
    if (!subject.ico) return [];

    const matchedPartners = await db
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.ico, subject.ico));

    if (matchedPartners.length === 0) return [];

    const partnerIds = matchedPartners.map((p) => p.id);
    const contacts = await db
      .select({ subjectId: partnerContacts.subjectId })
      .from(partnerContacts)
      .where(
        and(
          inArray(partnerContacts.partnerId, partnerIds),
          isNotNull(partnerContacts.subjectId),
          eq(partnerContacts.isActive, true)
        )
      );

    return contacts
      .filter((c): c is { subjectId: number } => c.subjectId !== null)
      .filter((c, i, arr) => arr.findIndex((x) => x.subjectId === c.subjectId) === i);
  }

  return [];
}

async function checkFoProfileCompleteness(subject: {
  id: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  street: string | null;
  city: string | null;
  postalCode: string | null;
  idCardNumber?: string | null;
}): Promise<{ complete: boolean; missingFields: string[] }> {
  const missing: string[] = [];
  if (!subject.firstName?.trim()) missing.push("meno");
  if (!subject.lastName?.trim()) missing.push("priezvisko");
  if (!subject.phone?.trim()) missing.push("telefón");
  if (!subject.email?.trim()) missing.push("e-mail");
  if (!subject.street?.trim() && !subject.city?.trim() && !subject.postalCode?.trim()) missing.push("adresa");

  // Document evidence: clientDocumentHistory OR subjects.idCardNumber OR companyOfficers.idCardNumber
  const [latestDoc] = await db
    .select({ documentNumber: clientDocumentHistory.documentNumber })
    .from(clientDocumentHistory)
    .where(eq(clientDocumentHistory.subjectId, subject.id))
    .orderBy(desc(clientDocumentHistory.archivedAt))
    .limit(1);

  const [officerWithDoc] = await db
    .select({ idCardNumber: companyOfficers.idCardNumber })
    .from(companyOfficers)
    .where(
      and(
        eq(companyOfficers.subjectId, subject.id),
        isNotNull(companyOfficers.idCardNumber),
        eq(companyOfficers.isActive, true)
      )
    )
    .limit(1);

  const hasDocEvidence =
    !!latestDoc?.documentNumber ||
    !!subject.idCardNumber?.trim() ||
    !!officerWithDoc?.idCardNumber?.trim();

  if (!hasDocEvidence) missing.push("doklad totožnosti");

  return { complete: missing.length === 0, missingFields: missing };
}

async function recordLoginHistory(userId: number, ip: string | null) {
  const loginNow = new Date();
  const tenSecsAgo = new Date(loginNow.getTime() - 10000);
  const [recent] = await db.select().from(appUserLoginHistory)
    .where(and(eq(appUserLoginHistory.appUserId, userId), gte(appUserLoginHistory.loginAt, tenSecsAgo)));
  if (!recent) {
    const [userRow] = await db
      .select({
        firstName: appUsers.firstName,
        lastName: appUsers.lastName,
        username: appUsers.username,
        activeSubjectId: appUsers.activeSubjectId,
        linkedSubjectId: appUsers.linkedSubjectId,
      })
      .from(appUsers)
      .where(eq(appUsers.id, userId));
    await db.update(appUsers).set({ lastLoginAt: loginNow }).where(eq(appUsers.id, userId));
    const { contextType, contextLabel } = userRow
      ? await resolveContextLabel({
          activeSubjectId: userRow.activeSubjectId ?? null,
          firstName: userRow.firstName,
          lastName: userRow.lastName,
          username: userRow.username,
          linkedSubjectId: userRow.linkedSubjectId ?? null,
        })
      : { contextType: "fo" as string, contextLabel: null as string | null };
    await db.insert(appUserLoginHistory).values({
      appUserId: userId,
      loginAt: loginNow,
      ipAddress: ip,
      contextType,
      contextLabel,
    });
  }
}

function subjectDisplayName(s: { firstName?: string | null; lastName?: string | null; companyName?: string | null }): string {
  if (s.firstName || s.lastName) return `${s.firstName || ""} ${s.lastName || ""}`.trim();
  return s.companyName || "Neznámy subjekt";
}

function myCompanySubjectTypeLabel(subjectType: string | null | undefined): string {
  switch (subjectType) {
    case "szco": return "SZČO";
    case "sro": return "s.r.o.";
    case "as": return "a.s.";
    case "jo": return "j.o.";
    case "vs": return "VS";
    case "ts": return "TS";
    case "ns": return "n.s.";
    case "os": return "OS";
    case "stat": return "Štát";
    case "person": return "FO";
    default: return "PO";
  }
}

function normalizeSubjectContextType(type: string | null | undefined): string {
  switch (type) {
    case "szco": return "szco";
    case "company": return "po";
    case "organization": return "ts";
    case "state": return "vs";
    case "os": return "os";
    default: return type ?? "subject";
  }
}

/**
 * Resolves { contextType, contextLabel } for a user's current active identity.
 * Used both at login-time and when splitting sessions on identity switch.
 */
export async function resolveContextLabel(user: {
  activeSubjectId: number | null;
  firstName: string | null;
  lastName: string | null;
  username: string;
  linkedSubjectId?: number | null;
}): Promise<{ contextType: string; contextLabel: string | null }> {
  if (!user.activeSubjectId) {
    // FO mode — prefer linked FO subject name, fall back to user fields
    let foName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username;
    if (user.linkedSubjectId) {
      const [foSubj] = await db
        .select({ firstName: subjects.firstName, lastName: subjects.lastName })
        .from(subjects)
        .where(and(eq(subjects.id, user.linkedSubjectId), isNull(subjects.deletedAt)));
      if (foSubj) {
        foName = [foSubj.firstName, foSubj.lastName].filter(Boolean).join(" ") || foName;
      }
    }
    return { contextType: "fo", contextLabel: `${foName} — FO` };
  }
  // Subject identity active — look up type and display name
  const [subj] = await db
    .select({ type: subjects.type, firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName })
    .from(subjects)
    .where(eq(subjects.id, user.activeSubjectId));
  if (!subj) return { contextType: "fo", contextLabel: null };
  const displayName = subj.companyName || [subj.firstName, subj.lastName].filter(Boolean).join(" ") || "Neznámy";
  switch (subj.type) {
    case "szco": return { contextType: "szco", contextLabel: `${displayName} — SZČO` };
    case "company": return { contextType: "po", contextLabel: `${displayName} — PO` };
    case "organization": return { contextType: "ts", contextLabel: `${displayName} — TS` };
    case "state": return { contextType: "vs", contextLabel: `${displayName} — VS` };
    case "os": return { contextType: "os", contextLabel: `${displayName} — OS` };
    default: return { contextType: "subject", contextLabel: displayName };
  }
}

function subjectTypeShortLabel(type: string | null | undefined): string {
  switch (type) {
    case "person": return "FO — Fyzická osoba";
    case "szco": return "SZČO — Samostatne zárobkovo činná osoba";
    case "company": return "PO — Právnická osoba";
    case "organization": return "TS — Tretí sektor";
    case "state": return "VS — Verejný sektor";
    case "os": return "OS — Ostatné sektory";
    default: return "Subjekt";
  }
}

function linkedAccountSubLabel(type: string | null | undefined, ico: string | null): string {
  switch (type) {
    case "person": return "FO — Fyzická osoba";
    case "szco": return ico ? `SZČO — IČO:\u00A0${ico}` : "SZČO";
    case "company": return ico ? `PO — IČO:\u00A0${ico}` : "PO";
    default: return "Prepojený účet";
  }
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
          myCompanyId: subjects.myCompanyId,
          idCardNumber: subjects.idCardNumber,
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
              myCompanyId: subjects.myCompanyId,
              idCardNumber: subjects.idCardNumber,
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
          phone: s.phone ?? null,
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
        return { id: s.id, uid: s.uid, firstName: s.firstName, lastName: s.lastName, companyName: s.companyName, type: s.type, phone: s.phone ?? null, isShadow, isAdult: adultStatus, hasRisk: s.listStatus === "cerveny", documentHint };
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
            selectedSubject: { id: selected.id, firstName: selected.firstName, lastName: selected.lastName, phone: selected.phone ?? null },
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
          req.session.pendingVerifyReason = "risk_override";
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
        req.session.pendingVerifyReason = "risk_override";
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
              res.json({ nextStep: "phone_verify", selectedSubject: { id: selected.id, firstName: selected.firstName, lastName: selected.lastName, phone: selected.phone ?? null } });
            });
          }
        }
      }

      if (isLegalEntity(selected.type) || selected.type === "mycompany") {
        const linkedPersons = await getLinkedOfficers({
          id: selected.id,
          type: selected.type,
          myCompanyId: selected.myCompanyId ?? null,
          ico: selected.ico ?? null,
        });

        if (linkedPersons.length > 1) {
          // Before asking for entity RC: check if exactly one officer is already identified
          // by being a peer subject (same email as the logged-in user).
          // If yes, skip entity_rc_verify and treat it like a single-officer direct login.
          const peerPersonIds = new Set(
            allPeers
              .filter((p) => isPerson(p.type) || isSzco(p.type))
              .map((p) => p.id)
          );
          const emailMatchedOfficers = linkedPersons.filter((o) => o.subjectId !== null && peerPersonIds.has(o.subjectId!));

          if (emailMatchedOfficers.length === 1) {
            const [foSubject] = await db
              .select({ id: subjects.id, uid: subjects.uid, firstName: subjects.firstName, lastName: subjects.lastName, phone: subjects.phone, email: subjects.email, street: subjects.street, city: subjects.city, postalCode: subjects.postalCode, idCardNumber: subjects.idCardNumber })
              .from(subjects)
              .where(eq(subjects.id, emailMatchedOfficers[0].subjectId!));

            if (foSubject) {
              const completeness = await checkFoProfileCompleteness(foSubject);
              if (!completeness.complete) {
                return req.session.save((err) => {
                  if (err) return res.status(500).json({ message: "Chyba session" });
                  res.json({
                    nextStep: "blocked",
                    message: `Profil fyzickej osoby (konateľa) je neúplný. Chýba: ${completeness.missingFields.join(", ")}. Kontaktujte správcu systému.`,
                  });
                });
              }
              req.session.loginSubjectId = foSubject.id;
              req.session.loginActingAsEntityId = selected.id;
              req.session.loginStep = "phone_verify";
              await writeLoginAudit(user.id, foSubject.id, subjectDisplayName(foSubject), "ENTITY_DIRECT", "email_matched_officer", ip, selected.id, { foUid: foSubject.uid, entityType: selected.type });
              return req.session.save((err) => {
                if (err) return res.status(500).json({ message: "Chyba session" });
                res.json({ nextStep: "phone_verify", selectedSubject: { id: foSubject.id, firstName: foSubject.firstName, lastName: foSubject.lastName, phone: foSubject.phone ?? null } });
              });
            }
          }

          req.session.loginStep = "entity_rc_verify";
          req.session.pendingEntitySubjectId = selected.id;
          req.session.pendingEntityCandidateIds = linkedPersons.map((p) => p.subjectId);
          req.session.entityRcAttempts = 0;
          return req.session.save((err) => {
            if (err) return res.status(500).json({ message: "Chyba session" });
            res.json({
              nextStep: "entity_rc_verify",
              entityName: name,
              entityType: selected.type,
            });
          });
        }

        if (linkedPersons.length === 1) {
          const [foSubject] = await db
            .select({ id: subjects.id, uid: subjects.uid, firstName: subjects.firstName, lastName: subjects.lastName, phone: subjects.phone, email: subjects.email, street: subjects.street, city: subjects.city, postalCode: subjects.postalCode, idCardNumber: subjects.idCardNumber })
            .from(subjects)
            .where(eq(subjects.id, linkedPersons[0].subjectId));

          if (foSubject) {
            const completeness = await checkFoProfileCompleteness(foSubject);
            if (!completeness.complete) {
              return req.session.save((err) => {
                if (err) return res.status(500).json({ message: "Chyba session" });
                res.json({
                  nextStep: "blocked",
                  message: `Profil fyzickej osoby (konateľa) je neúplný. Chýba: ${completeness.missingFields.join(", ")}. Kontaktujte správcu systému.`,
                });
              });
            }
            // Single-officer: FO is identified, set session with FO as primary subject and entity as acting context
            req.session.loginSubjectId = foSubject.id;
            req.session.loginActingAsEntityId = selected.id;
            req.session.loginStep = "phone_verify";
            await writeLoginAudit(user.id, foSubject.id, subjectDisplayName(foSubject), "ENTITY_DIRECT", "single_officer_direct", ip, selected.id, { foUid: foSubject.uid, entityType: selected.type });
            return req.session.save((err) => {
              if (err) return res.status(500).json({ message: "Chyba session" });
              res.json({ nextStep: "phone_verify", selectedSubject: { id: foSubject.id, firstName: foSubject.firstName, lastName: foSubject.lastName, phone: foSubject.phone ?? null } });
            });
          }
        }

        // No linked officer found: direct entity login (no individual FO identified)
        req.session.loginSubjectId = selected.id;
        req.session.loginStep = "phone_verify";
        await writeLoginAudit(user.id, selected.id, name, "DIRECT", null, ip);
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.json({ nextStep: "phone_verify", selectedSubject: { id: selected.id, firstName: selected.firstName, lastName: selected.lastName, companyName: selected.companyName, phone: selected.phone ?? null } });
        });
      }

      if (isPerson(selected.type) && selectedAdult === false) {
        req.session.loginSubjectId = selected.id;
        req.session.loginStep = "phone_verify";
        await writeLoginAudit(user.id, selected.id, name, "DIRECT", "minor_direct", ip);
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.json({ nextStep: "phone_verify", selectedSubject: { id: selected.id, firstName: selected.firstName, lastName: selected.lastName, phone: selected.phone ?? null } });
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
          // Compare phone only against other PERSON-type subjects (mycompany/entity subjects naturally share the owner's phone — they must not block SMS auth)
          const selectedPhone = selected.phone?.replace(/\D/g, "") || "";
          const otherPersonPhones = allPeers
            .filter((p) => p.id !== selected.id && isPerson(p.type) && p.phone)
            .map((p) => p.phone!.replace(/\D/g, ""));
          // Unique if no other FO/SZČO in cluster shares the same phone
          const hasUniquePhone = !!selectedPhone && !otherPersonPhones.includes(selectedPhone);

          if (hasUniquePhone) {
            const code = "151515"; // TODO: remove hardcoded test code before go-live
            console.log(`[AUTH SMS MOCK] SMS kód pre ${selected.phone}: ${code}`);
            req.session.loginSubjectId = selected.id;
            req.session.loginStep = "sms_verify";
            req.session.pendingSmsCode = code;
            req.session.pendingSubjectPhone = selected.phone ?? null;
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
        res.json({ nextStep: "phone_verify", selectedSubject: { id: selected.id, firstName: selected.firstName, lastName: selected.lastName, phone: selected.phone ?? null } });
      });
    } catch (err) {
      console.error("Select subject error:", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/login/entity-rc-verify", loginLimiter, async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "entity_rc_verify") {
        return res.status(403).json({ message: "Neplatný krok prihlásenia" });
      }

      const { rc } = req.body;
      if (!rc || typeof rc !== "string") {
        return res.status(400).json({ message: "Zadajte rodné číslo" });
      }

      const candidateIds = req.session.pendingEntityCandidateIds;
      const entitySubjectId = req.session.pendingEntitySubjectId;

      if (!candidateIds || !entitySubjectId) {
        return res.status(400).json({ message: "Neplatný stav prihlásenia" });
      }

      const attempts = (req.session.entityRcAttempts ?? 0) + 1;
      req.session.entityRcAttempts = attempts;

      // Pre-check: if already exhausted all attempts from previous calls, reject immediately
      if (attempts > 3) {
        return req.session.save(() => {
          res.status(429).json({ message: "Príliš veľa nesprávnych pokusov. Prihláste sa znova od začiatku.", attemptsLeft: 0 });
        });
      }

      const candidates = await db
        .select({
          id: subjects.id,
          birthNumber: subjects.birthNumber,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          phone: subjects.phone,
          email: subjects.email,
          street: subjects.street,
          city: subjects.city,
          postalCode: subjects.postalCode,
          uid: subjects.uid,
        })
        .from(subjects)
        .where(and(inArray(subjects.id, candidateIds), isNull(subjects.deletedAt)));

      const normalizedInput = rc.replace(/[\s\/]/g, "");
      let foundFo: (typeof candidates)[0] | null = null;

      for (const cand of candidates) {
        if (!cand.birthNumber) continue;
        const decrypted = decryptField(cand.birthNumber);
        if (!decrypted) continue;
        if (normalizedInput === decrypted.replace(/[\s\/]/g, "")) {
          foundFo = cand;
          break;
        }
      }

      if (!foundFo) {
        const attemptsLeft = 3 - attempts;
        // On 3rd failure (attempts === 3): destroy session entirely so frontend gets 401 and redirects to login
        if (attemptsLeft <= 0) {
          return req.session.destroy(() => {
            res.status(429).json({ message: "Príliš veľa nesprávnych pokusov. Prihláste sa znova od začiatku.", attemptsLeft: 0 });
          });
        }
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.status(400).json({
            message: `Nesprávne rodné číslo. Zostávajúce pokusy: ${attemptsLeft}`,
            attemptsLeft,
          });
        });
      }

      const completeness = await checkFoProfileCompleteness(foundFo);
      if (!completeness.complete) {
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.json({
            nextStep: "blocked",
            message: `Profil fyzickej osoby je neúplný. Chýba: ${completeness.missingFields.join(", ")}. Kontaktujte správcu systému.`,
          });
        });
      }

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;

      // Fetch entity subject to get concrete entityType for audit
      const [entitySubject] = await db.select({ type: subjects.type }).from(subjects).where(eq(subjects.id, entitySubjectId)).limit(1);
      const auditEntityName = `USER_FO ${foundFo.uid ?? foundFo.id} ACTING_AS entity:${entitySubjectId}`;
      await writeLoginAudit(req.session.userId, foundFo.id, auditEntityName, "ENTITY_RC", "entity_rc_verified", ip, entitySubjectId, { foUid: foundFo.uid, entityType: entitySubject?.type ?? null });

      req.session.loginSubjectId = foundFo.id;
      req.session.loginActingAsEntityId = entitySubjectId;
      req.session.loginStep = "phone_verify";
      req.session.entityRcAttempts = undefined;
      req.session.pendingEntityCandidateIds = undefined;
      req.session.pendingEntitySubjectId = undefined;

      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({
          nextStep: "phone_verify",
          selectedSubject: {
            id: foundFo!.id,
            firstName: foundFo!.firstName,
            lastName: foundFo!.lastName,
            phone: foundFo!.phone ?? null,
          },
        });
      });
    } catch (err) {
      console.error("Entity RC verify error:", err);
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

      const verifyReason = req.session.pendingVerifyReason ?? null;
      let selectedSubject: { id: number; firstName: string | null; lastName: string | null; companyName: string | null; type: string | null } | null = null;

      if (subjectId) {
        const [s] = await db.select({
          id: subjects.id, firstName: subjects.firstName, lastName: subjects.lastName,
          companyName: subjects.companyName, type: subjects.type, phone: subjects.phone,
          email: subjects.email, street: subjects.street, city: subjects.city,
          postalCode: subjects.postalCode, idCardNumber: subjects.idCardNumber,
        }).from(subjects).where(eq(subjects.id, subjectId));
        if (s) {
          selectedSubject = s;
          await writeLoginAudit(req.session.userId, subjectId, subjectDisplayName(s), "SMS", verifyReason, ip);

          // FO completeness check (same gate as in verify-phone)
          if (isPerson(s.type)) {
            const completeness = await checkFoProfileCompleteness(s);
            if (!completeness.complete) {
              req.session.pendingSmsCode = undefined;
              req.session.pendingVerifyReason = undefined;
              return req.session.save((err2) => {
                if (err2) return res.status(500).json({ message: "Chyba session" });
                res.json({
                  nextStep: "blocked",
                  message: `Profil je neúplný. Chýba: ${completeness.missingFields.join(", ")}. Kontaktujte správcu systému.`,
                });
              });
            }
          }
        }
      }

      // SMS code = phone already proven → skip phone_verify, go straight to done
      req.session.loginStep = "done";
      req.session.pendingSmsCode = undefined;
      req.session.pendingVerifyReason = undefined;
      const userId2 = req.session.userId;
      await recordLoginHistory(userId2, ip);

      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({ nextStep: "done", ok: true });
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

      const [subject] = await db.select({ birthNumber: subjects.birthNumber, firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type })
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
      const verifyReason = req.session.pendingVerifyReason ?? null;
      await writeLoginAudit(req.session.userId, subjectId, subjectDisplayName(subject), "RC", verifyReason, ip);

      const selectedSubject = { id: subjectId, firstName: subject.firstName, lastName: subject.lastName, companyName: (subject as any).companyName ?? null, type: (subject as any).type ?? null };
      req.session.loginStep = "phone_verify";
      req.session.pendingVerifyReason = undefined;
      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({ nextStep: "phone_verify", selectedSubject });
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
      const verifyReason = req.session.pendingVerifyReason ?? null;
      const [s] = await db.select({ id: subjects.id, firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type })
        .from(subjects).where(eq(subjects.id, subjectId));
      const selectedSubject = s ?? null;
      await writeLoginAudit(req.session.userId, subjectId, s ? subjectDisplayName(s) : null, "DOC", verifyReason, ip);

      req.session.loginStep = "phone_verify";
      req.session.pendingVerifyReason = undefined;
      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({ nextStep: "phone_verify", selectedSubject });
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

        // Rule 2: completeness check for FO subjects (any context, including direct FO login)
        if (subject && isPerson(subject.type)) {
          const completeness = await checkFoProfileCompleteness({
            id: subject.id,
            firstName: subject.firstName,
            lastName: subject.lastName,
            phone: confirmed ? subject.phone : (newPhone ?? subject.phone),
            email: subject.email,
            street: subject.street,
            city: subject.city,
            postalCode: subject.postalCode,
            idCardNumber: subject.idCardNumber,
          });
          if (!completeness.complete) {
            return req.session.save((err) => {
              if (err) return res.status(500).json({ message: "Chyba session" });
              res.json({
                nextStep: "blocked",
                message: `Profil je neúplný. Chýba: ${completeness.missingFields.join(", ")}. Kontaktujte správcu systému.`,
              });
            });
          }
        }
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
        const ALLOWED_REASONS = ["manual", "idle", "switch"] as const;
        const rawReason = req.body?.reason;
        const reason: string = ALLOWED_REASONS.includes(rawReason) ? rawReason : "manual";
        const [lastEntry] = await db
          .select({ id: appUserLoginHistory.id })
          .from(appUserLoginHistory)
          .where(and(eq(appUserLoginHistory.appUserId, userId), isNull(appUserLoginHistory.logoutAt)))
          .orderBy(desc(appUserLoginHistory.loginAt))
          .limit(1);
        if (lastEntry) {
          await db.update(appUserLoginHistory)
            .set({ logoutAt: new Date(), logoutReason: reason })
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
    if (req.session.loginStep !== "done") {
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

  // ============================================================
  // ACCOUNT LINKING & SWITCHING
  // ============================================================

  app.get("/api/account-link/suggestions", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const [currentUser] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
      if (!currentUser || !currentUser.linkedSubjectId) return res.json([]);

      const [currentSubject] = await db.select().from(subjects).where(eq(subjects.id, currentUser.linkedSubjectId));
      if (!currentSubject || !currentSubject.birthNumber) return res.json([]);

      const currentRcClean = decryptField(currentSubject.birthNumber)?.replace(/[\s\/]/g, "") ?? "";
      if (!currentRcClean) return res.json([]);

      const existingLinks = await storage.getAccountLinks(req.session.userId);
      const alreadyLinkedIds = new Set<number>(
        existingLinks
          .filter((l) => l.status === "verified" && l.isActive)
          .map((l) => l.primaryUserId === req.session.userId ? l.linkedUserId : l.primaryUserId)
      );

      const seenUserIds = new Set<number>();
      const suggestions: Array<{
        userId: number;
        firstName: string | null;
        lastName: string | null;
        maskedEmail: string;
        type: string | null;
        ico: string | null;
        uid: string | null;
      }> = [];

      function maskEmail(email: string): string {
        const atIdx = email.indexOf("@");
        return atIdx >= 2
          ? email.slice(0, 2) + "***" + email.slice(atIdx)
          : "***" + email.slice(atIdx >= 0 ? atIdx : 0);
      }

      // Branch 1: RC match — same person (FO/SZČO)
      const usersWithSubjects = await db.select({
        userId: appUsers.id,
        email: appUsers.email,
        userFirstName: appUsers.firstName,
        userLastName: appUsers.lastName,
        subjFirstName: subjects.firstName,
        subjLastName: subjects.lastName,
        type: subjects.type,
        ico: sql<string | null>`${subjects.details}->>'ico'`,
        uid: subjects.uid,
        birthNumber: subjects.birthNumber,
      }).from(appUsers)
        .innerJoin(subjects, and(eq(subjects.id, appUsers.linkedSubjectId!), isNull(subjects.deletedAt)))
        .where(and(isNotNull(appUsers.linkedSubjectId), isNotNull(appUsers.email), isNotNull(subjects.birthNumber)));

      for (const row of usersWithSubjects) {
        if (row.userId === req.session.userId) continue;
        if (alreadyLinkedIds.has(row.userId)) continue;
        if (!row.birthNumber) continue;

        const subjRcClean = decryptField(row.birthNumber)?.replace(/[\s\/]/g, "") ?? "";
        if (!subjRcClean || subjRcClean !== currentRcClean) continue;

        seenUserIds.add(row.userId);
        suggestions.push({
          userId: row.userId,
          firstName: row.subjFirstName ?? row.userFirstName ?? null,
          lastName: row.subjLastName ?? row.userLastName ?? null,
          maskedEmail: maskEmail(row.email || ""),
          type: row.type ?? null,
          ico: row.ico ?? null,
          uid: row.uid ?? null,
        });
      }

      // Branch 2: officer relationship — company contexts (PO, mycompany, org, VS, TS)
      // Find all companies where the current user's FO subject is an active statutory officer
      const officerRows = await db.select({ companyId: companyOfficers.companyId })
        .from(companyOfficers)
        .where(and(
          eq(companyOfficers.subjectId, currentUser.linkedSubjectId),
          eq(companyOfficers.isActive, true)
        ));

      const officerCompanyIds = officerRows.map((r) => r.companyId);

      if (officerCompanyIds.length > 0) {
        const companyContextUsers = await db.select({
          userId: appUsers.id,
          email: appUsers.email,
          userFirstName: appUsers.firstName,
          userLastName: appUsers.lastName,
          subjFirstName: subjects.firstName,
          subjLastName: subjects.lastName,
          subjCompanyName: subjects.companyName,
          type: subjects.type,
          ico: sql<string | null>`${subjects.details}->>'ico'`,
          uid: subjects.uid,
        }).from(appUsers)
          .leftJoin(subjects, and(eq(subjects.id, appUsers.linkedSubjectId!), isNull(subjects.deletedAt)))
          .where(and(
            isNotNull(appUsers.email),
            isNotNull(appUsers.activeCompanyId),
            inArray(appUsers.activeCompanyId, officerCompanyIds)
          ));

        for (const row of companyContextUsers) {
          if (row.userId === req.session.userId) continue;
          if (alreadyLinkedIds.has(row.userId)) continue;
          if (seenUserIds.has(row.userId)) continue;

          seenUserIds.add(row.userId);
          suggestions.push({
            userId: row.userId,
            firstName: row.subjFirstName ?? row.userFirstName ?? null,
            lastName: row.subjCompanyName ?? row.subjLastName ?? row.userLastName ?? null,
            maskedEmail: maskEmail(row.email || ""),
            type: row.type ?? null,
            ico: row.ico ?? null,
            uid: row.uid ?? null,
          });
        }
      }

      return res.json(suggestions);
    } catch (err) {
      console.error("[ACCOUNT-LINK SUGGESTIONS]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/account-link/initiate", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const { targetEmail, rc, targetUserId } = req.body;

      const [currentUser] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
      if (!currentUser) return res.status(401).json({ message: "Používateľ nenájdený" });

      let targetUser: typeof appUsers.$inferSelect;

      if (targetUserId !== undefined && targetUserId !== null) {
        // Suggestion-based flow: server verifies RC match itself, no rc from client required
        const [tu] = await db.select().from(appUsers).where(eq(appUsers.id, Number(targetUserId)));
        if (!tu) return res.status(404).json({ message: "Cieľový účet neexistuje" });
        if (tu.id === req.session.userId) return res.status(400).json({ message: "Nemôžete prepojiť účet sám so sebou" });

        // Verify identity: current user must have a linked subject (FO with RC)
        if (!currentUser.linkedSubjectId) {
          return res.status(403).json({ message: "Váš účet nemá priradenú identitu. Kontaktujte správcu." });
        }
        const [cs] = await db.select().from(subjects).where(eq(subjects.id, currentUser.linkedSubjectId));
        if (!cs?.birthNumber) {
          return res.status(403).json({ message: "Váš profil nemá evidované rodné číslo. Kontaktujte správcu." });
        }

        if (tu.linkedSubjectId === currentUser.linkedSubjectId) {
          // Same subject → same person, no further RC check needed
        } else if (tu.linkedSubjectId) {
          const [ts] = await db.select().from(subjects).where(eq(subjects.id, tu.linkedSubjectId));
          if (ts?.birthNumber) {
            // Both have RC → compare
            const curRc = decryptField(cs.birthNumber)?.replace(/[\s\/]/g, "") ?? "";
            const tgtRc = decryptField(ts.birthNumber)?.replace(/[\s\/]/g, "") ?? "";
            if (!curRc || curRc !== tgtRc) {
              return res.status(403).json({ message: "Tento účet nepatrí rovnakej osobe." });
            }
          } else if (tu.activeCompanyId) {
            // Target is company context (no RC) → verify via officer relationship
            const [officerRecord] = await db.select({ id: companyOfficers.id }).from(companyOfficers)
              .where(and(
                eq(companyOfficers.companyId, tu.activeCompanyId),
                eq(companyOfficers.subjectId, currentUser.linkedSubjectId),
                eq(companyOfficers.isActive, true)
              )).limit(1);
            if (!officerRecord) {
              return res.status(403).json({ message: "Nie ste štatutárom tejto spoločnosti." });
            }
          } else {
            return res.status(403).json({ message: "Cieľový účet nemá evidované rodné číslo ani firemný kontext." });
          }
        } else if (tu.activeCompanyId) {
          // Target has no linkedSubjectId but has activeCompanyId → officer check
          const [officerRecord] = await db.select({ id: companyOfficers.id }).from(companyOfficers)
            .where(and(
              eq(companyOfficers.companyId, tu.activeCompanyId),
              eq(companyOfficers.subjectId, currentUser.linkedSubjectId),
              eq(companyOfficers.isActive, true)
            )).limit(1);
          if (!officerRecord) {
            return res.status(403).json({ message: "Nie ste štatutárom tejto spoločnosti." });
          }
        } else {
          return res.status(403).json({ message: "Cieľový účet nemá priradenú identitu." });
        }
        targetUser = tu;
      } else {
        // Manual flow: requires targetEmail + rc
        if (!targetEmail || !rc) {
          return res.status(400).json({ message: "Vyžaduje sa email a rodné číslo" });
        }
        if (!currentUser.linkedSubjectId) {
          return res.status(403).json({ message: "Váš účet nemá priradenú identitu. Kontaktujte správcu." });
        }
        const [currentSubject] = await db.select().from(subjects).where(eq(subjects.id, currentUser.linkedSubjectId));
        if (!currentSubject || !currentSubject.birthNumber) {
          return res.status(403).json({ message: "Váš profil nemá evidované rodné číslo. Kontaktujte správcu." });
        }
        const currentRc = decryptField(currentSubject.birthNumber);
        const cleanRc = rc.replace(/[\s\/]/g, "");
        const cleanCurrentRc = currentRc?.replace(/[\s\/]/g, "") ?? "";
        if (cleanCurrentRc !== cleanRc) {
          return res.status(403).json({ message: "Zadané rodné číslo nezodpovedá vášmu profilu" });
        }
        const targetEmailLower = (targetEmail as string).toLowerCase().trim();
        const [tu] = await db.select().from(appUsers).where(eq(appUsers.email, targetEmailLower));
        if (!tu) return res.status(404).json({ message: "Účet s týmto emailom neexistuje" });
        if (tu.id === req.session.userId) return res.status(400).json({ message: "Nemôžete prepojiť účet sám so sebou" });

        // Verify target identity: RC match OR officer relationship for company contexts
        if (tu.linkedSubjectId === currentUser.linkedSubjectId) {
          // Same subject → same person
        } else if (tu.linkedSubjectId) {
          const [ts] = await db.select().from(subjects).where(eq(subjects.id, tu.linkedSubjectId));
          if (ts?.birthNumber) {
            const tgtRc = decryptField(ts.birthNumber)?.replace(/[\s\/]/g, "") ?? "";
            if (!tgtRc || tgtRc !== cleanCurrentRc) {
              return res.status(403).json({ message: "Cieľový účet nepatrí rovnakej osobe." });
            }
          } else if (tu.activeCompanyId) {
            const [officerRecord] = await db.select({ id: companyOfficers.id }).from(companyOfficers)
              .where(and(
                eq(companyOfficers.companyId, tu.activeCompanyId),
                eq(companyOfficers.subjectId, currentUser.linkedSubjectId),
                eq(companyOfficers.isActive, true)
              )).limit(1);
            if (!officerRecord) {
              return res.status(403).json({ message: "Nie ste štatutárom tejto spoločnosti." });
            }
          } else {
            return res.status(403).json({ message: "Cieľový účet nemá evidované rodné číslo ani firemný kontext." });
          }
        } else if (tu.activeCompanyId) {
          const [officerRecord] = await db.select({ id: companyOfficers.id }).from(companyOfficers)
            .where(and(
              eq(companyOfficers.companyId, tu.activeCompanyId),
              eq(companyOfficers.subjectId, currentUser.linkedSubjectId),
              eq(companyOfficers.isActive, true)
            )).limit(1);
          if (!officerRecord) {
            return res.status(403).json({ message: "Nie ste štatutárom tejto spoločnosti." });
          }
        } else {
          return res.status(403).json({ message: "Cieľový účet nemá priradenú identitu." });
        }
        targetUser = tu;
      }

      const existingLink = await storage.getAccountLink(req.session.userId, targetUser.id);
      let isReactivation = false;
      if (existingLink) {
        if (existingLink.status === "verified" && existingLink.isActive) {
          return res.status(409).json({ message: "Prepojenie s týmto účtom už existuje" });
        }
        if (existingLink.status === "verified" && !existingLink.isActive) {
          isReactivation = true;
        }
      }

      const device = detectDeviceType(req.headers["user-agent"] || "");
      const method = device === "mobile" ? "email" : "sms";
      const otp = generateOtp();
      const expiry = Date.now() + 10 * 60 * 1000;

      req.session.pendingAccountLinkUserId = targetUser.id;
      req.session.pendingAccountLinkOtp = otp;
      req.session.pendingAccountLinkExpiry = expiry;
      req.session.pendingAccountLinkAttempts = 0;
      req.session.pendingAccountLinkIsReactivation = isReactivation;
      req.session.pendingAccountLinkMethod = method;

      let targetSubject: typeof subjects.$inferSelect | null = null;
      if (targetUser.linkedSubjectId) {
        const [ts] = await db.select().from(subjects).where(eq(subjects.id, targetUser.linkedSubjectId));
        targetSubject = ts ?? null;
      }

      const targetEmailForLog = targetUser.email || "";
      if (method === "email") {
        console.log(`[ACCOUNT-LINK OTP] Sending email OTP to ${targetEmailForLog.replace(/^(.{2}).*(@.*)$/, "$1***$2")}`);
      } else {
        const phone = targetUser.phone || (targetSubject?.phone ?? null);
        console.log(`[ACCOUNT-LINK OTP] Sending SMS OTP to ${phone ? maskPhone(phone) : "***"}`);
      }

      const maskedTarget = method === "email"
        ? targetEmailForLog.replace(/^(.{2}).*(@.*)$/, "$1***$2")
        : (targetUser.phone ? maskPhone(targetUser.phone) : targetEmailForLog);

      const targetName = targetSubject
        ? `${targetSubject.firstName ?? ""} ${targetSubject.lastName ?? ""}`.trim() || targetSubject.companyName || targetUser.email
        : (targetUser.firstName ? `${targetUser.firstName} ${targetUser.lastName ?? ""}`.trim() : targetUser.email);

      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba pri ukladaní session" });
        res.json({ method, maskedTarget, targetName, isReactivation });
      });
    } catch (err) {
      console.error("[ACCOUNT-LINK INITIATE]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/account-link/verify", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const { otp } = req.body;
      if (!otp) return res.status(400).json({ message: "Vyžaduje sa OTP kód" });

      const { pendingAccountLinkUserId, pendingAccountLinkOtp, pendingAccountLinkExpiry, pendingAccountLinkIsReactivation, pendingAccountLinkMethod } = req.session;

      if (!pendingAccountLinkUserId || !pendingAccountLinkOtp) {
        return res.status(400).json({ message: "Žiadna čakajúca žiadosť o prepojenie" });
      }
      if (pendingAccountLinkExpiry && Date.now() > pendingAccountLinkExpiry) {
        return res.status(400).json({ message: "Platnosť OTP kódu vypršala. Začnite znova." });
      }

      const attempts = (req.session.pendingAccountLinkAttempts || 0) + 1;
      req.session.pendingAccountLinkAttempts = attempts;
      if (attempts > 3) {
        return res.status(429).json({ message: "Príliš veľa nesprávnych pokusov. Začnite znova." });
      }

      if (otp.trim() !== pendingAccountLinkOtp) {
        return res.status(400).json({ message: `Nesprávny OTP kód. Pokusov zostáva: ${3 - attempts}` });
      }

      const method = pendingAccountLinkMethod || "email";
      if (pendingAccountLinkIsReactivation) {
        await storage.reactivateAccountLinks(req.session.userId, pendingAccountLinkUserId, method);
        await db.insert(auditLogs).values({
          userId: req.session.userId,
          username: null,
          action: "ACCOUNT_RELINKED",
          module: "AccountLink",
          entityId: pendingAccountLinkUserId,
          entityName: null,
          oldData: null,
          newData: { linkedUserId: pendingAccountLinkUserId },
          ipAddress: req.ip,
        });
      } else {
        await storage.createAccountLinks(req.session.userId, pendingAccountLinkUserId, method, req.session.userId);
        await db.insert(auditLogs).values({
          userId: req.session.userId,
          username: null,
          action: "ACCOUNT_LINKED",
          module: "AccountLink",
          entityId: pendingAccountLinkUserId,
          entityName: null,
          oldData: null,
          newData: { linkedUserId: pendingAccountLinkUserId },
          ipAddress: req.ip,
        });
      }

      req.session.pendingAccountLinkUserId = undefined;
      req.session.pendingAccountLinkOtp = undefined;
      req.session.pendingAccountLinkExpiry = undefined;
      req.session.pendingAccountLinkAttempts = undefined;
      req.session.pendingAccountLinkIsReactivation = undefined;
      req.session.pendingAccountLinkMethod = undefined;

      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba pri ukladaní session" });
        res.json({ success: true });
      });
    } catch (err) {
      console.error("[ACCOUNT-LINK VERIFY]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.get("/api/account-link/list", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const links = await storage.getAccountLinks(req.session.userId);

      const [currentUser] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
      if (!currentUser) return res.status(401).json({ message: "Používateľ nenájdený" });

      let currentSubject: typeof subjects.$inferSelect | null = null;
      if (currentUser.linkedSubjectId) {
        const [cs] = await db.select().from(subjects).where(eq(subjects.id, currentUser.linkedSubjectId));
        currentSubject = cs ?? null;
      }

      const currentEntry = {
        userId: currentUser.id,
        subjectId: currentUser.linkedSubjectId ?? null,
        firstName: currentSubject?.firstName ?? currentUser.firstName ?? null,
        lastName: currentSubject?.lastName ?? currentUser.lastName ?? null,
        companyName: currentSubject?.companyName ?? null,
        type: currentSubject?.type ?? null,
        ico: null,
        uid: currentSubject?.uid ?? null,
        isCurrent: true,
      };

      const linkedEntries = await Promise.all(links.map(async (link) => {
        const otherId = link.primaryUserId === req.session.userId ? link.linkedUserId : link.primaryUserId;
        const [otherUser] = await db.select().from(appUsers).where(eq(appUsers.id, otherId));
        if (!otherUser) return null;
        let otherSubject: typeof subjects.$inferSelect | null = null;
        if (otherUser.linkedSubjectId) {
          const [os] = await db.select().from(subjects).where(eq(subjects.id, otherUser.linkedSubjectId));
          otherSubject = os ?? null;
        }
        return {
          userId: otherUser.id,
          subjectId: otherUser.linkedSubjectId ?? null,
          firstName: otherSubject?.firstName ?? otherUser.firstName ?? null,
          lastName: otherSubject?.lastName ?? otherUser.lastName ?? null,
          companyName: otherSubject?.companyName ?? null,
          type: otherSubject?.type ?? null,
          ico: null,
          uid: otherSubject?.uid ?? null,
          isCurrent: false,
        };
      }));

      res.json([currentEntry, ...linkedEntries.filter(Boolean)]);
    } catch (err) {
      console.error("[ACCOUNT-LINK LIST]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.get("/api/user/contexts", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }

      const [currentUser] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
      if (!currentUser) return res.status(401).json({ message: "Používateľ nenájdený" });

      const result: any[] = [];
      const seenContextKeys = new Set<string>();
      function pushContext(item: any) {
        const key = `${item.contextType}:${item.companyId ?? item.userId}`;
        if (!seenContextKeys.has(key)) {
          seenContextKeys.add(key);
          result.push(item);
        }
      }

      // FO personal context
      let foSubject: typeof subjects.$inferSelect | null = null;
      if (currentUser.linkedSubjectId) {
        const [cs] = await db.select().from(subjects).where(and(eq(subjects.id, currentUser.linkedSubjectId), isNull(subjects.deletedAt)));
        foSubject = cs ?? null;
      }

      const foLabel = foSubject
        ? [foSubject.firstName, foSubject.lastName].filter(Boolean).join(" ") || currentUser.firstName || currentUser.username || ""
        : `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || currentUser.username || "";

      pushContext({
        contextType: "fo",
        userId: currentUser.id,
        companyId: null,
        label: foLabel,
        subLabel: "FO — Fyzická osoba",
        type: "person",
        uid: foSubject?.uid ?? null,
        ico: null,
        isCurrent: currentUser.activeCompanyId === null && currentUser.activeSubjectId === null,
      });

      // Linked subjects (SZČO, PO, VS, TS, OS)
      // Discovery via: 1) linkedFoId/parentSubjectId, 2) email contact match
      type LinkedSubjectRow = { id: number; type: string; firstName: string | null; lastName: string | null; companyName: string | null; uid: string | null; details: Record<string, unknown> | null };
      const linkedSubjectsMap = new Map<number, LinkedSubjectRow>();

      const NON_PERSON_TYPES = ["szco", "company", "organization", "state", "os"];

      if (foSubject) {
        const byHierarchy = await db
          .select({
            id: subjects.id,
            type: subjects.type,
            firstName: subjects.firstName,
            lastName: subjects.lastName,
            companyName: subjects.companyName,
            uid: subjects.uid,
            details: subjects.details,
          })
          .from(subjects)
          .where(and(
            or(
              eq(subjects.linkedFoId, foSubject.id),
              eq(subjects.parentSubjectId, foSubject.id)
            ),
            isNull(subjects.deletedAt),
            inArray(subjects.type, NON_PERSON_TYPES)
          ));
        for (const s of byHierarchy) linkedSubjectsMap.set(s.id, s as LinkedSubjectRow);
      }

      if (currentUser.email) {
        const byEmail = await db
          .select({
            id: subjects.id,
            type: subjects.type,
            firstName: subjects.firstName,
            lastName: subjects.lastName,
            companyName: subjects.companyName,
            uid: subjects.uid,
            details: subjects.details,
          })
          .from(subjects)
          .innerJoin(subjectContacts, and(
            eq(subjectContacts.subjectId, subjects.id),
            eq(subjectContacts.type, "email"),
            eq(subjectContacts.value, currentUser.email)
          ))
          .where(and(
            isNull(subjects.deletedAt),
            inArray(subjects.type, NON_PERSON_TYPES)
          ));
        for (const s of byEmail) {
          if (!linkedSubjectsMap.has(s.id)) linkedSubjectsMap.set(s.id, s as LinkedSubjectRow);
        }
      }

      for (const ls of linkedSubjectsMap.values()) {
        const ico = (ls.details as { ico?: string } | null)?.ico ?? null;
        const displayName = ls.companyName
          || [ls.firstName, ls.lastName].filter(Boolean).join(" ")
          || ls.uid || "";
        const subjectLabel = subjectTypeShortLabel(ls.type);
        const subLabel = ico ? `${subjectLabel} — IČO:\u00A0${ico}` : subjectLabel;
        const normalizedContextType = normalizeSubjectContextType(ls.type);
        const key = `subject:${ls.id}`;
        if (!seenContextKeys.has(key)) {
          seenContextKeys.add(key);
          result.push({
            contextType: normalizedContextType,
            userId: currentUser.id,
            companyId: null,
            subjectId: ls.id,
            label: displayName,
            subLabel,
            type: ls.type,
            uid: ls.uid ?? null,
            ico: ico ?? null,
            isCurrent: currentUser.activeSubjectId === ls.id,
          });
        }
      }

      // Officer companies (via companyOfficers table)
      if (currentUser.linkedSubjectId) {
        const officerRows = await db
          .select({ companyId: companyOfficers.companyId })
          .from(companyOfficers)
          .where(and(
            eq(companyOfficers.subjectId, currentUser.linkedSubjectId),
            eq(companyOfficers.isActive, true)
          ));

        if (officerRows.length > 0) {
          const companyIds = officerRows.map((r) => r.companyId);
          const officerCompanies = await db
            .select({
              id: myCompanies.id,
              name: myCompanies.name,
              subjectType: myCompanies.subjectType,
              ico: myCompanies.ico,
              uid: myCompanies.uid,
              stateId: myCompanies.stateId,
            })
            .from(myCompanies)
            .where(and(
              inArray(myCompanies.id, companyIds),
              eq(myCompanies.isDeleted, false)
            ));

          for (const co of officerCompanies) {
            const subjectTypeLabel = myCompanySubjectTypeLabel(co.subjectType);
            const subLabel = co.ico
              ? `${subjectTypeLabel} — IČO:\u00A0${co.ico}`
              : subjectTypeLabel;
            pushContext({
              contextType: "officer_company",
              userId: currentUser.id,
              companyId: co.id,
              stateId: co.stateId ?? null,
              label: co.name,
              subLabel,
              type: co.subjectType ?? "po",
              uid: co.uid ?? null,
              ico: co.ico ?? null,
              isCurrent: currentUser.activeSubjectId === null && currentUser.activeCompanyId === co.id,
            });
          }
        }
      }

      // Linked accounts (other AppUsers)
      const links = await storage.getAccountLinks(req.session.userId);
      const linkedEntries = await Promise.all(links.map(async (link) => {
        const otherId = link.primaryUserId === req.session.userId ? link.linkedUserId : link.primaryUserId;
        const [otherUser] = await db.select().from(appUsers).where(eq(appUsers.id, otherId));
        if (!otherUser) return null;
        let otherSubject: typeof subjects.$inferSelect | null = null;
        if (otherUser.linkedSubjectId) {
          const [os] = await db.select().from(subjects).where(eq(subjects.id, otherUser.linkedSubjectId));
          otherSubject = os ?? null;
        }
        const otherLabel = otherSubject?.companyName
          || [otherSubject?.firstName ?? otherUser.firstName, otherSubject?.lastName ?? otherUser.lastName].filter(Boolean).join(" ")
          || otherUser.username || "";
        return {
          contextType: "linked_account",
          userId: otherUser.id,
          companyId: null,
          label: otherLabel,
          subLabel: otherSubject?.type ? linkedAccountSubLabel(otherSubject.type, null) : "Prepojený účet",
          type: otherSubject?.type ?? "person",
          uid: otherSubject?.uid ?? null,
          ico: null,
          isCurrent: false,
        };
      }));
      for (const entry of linkedEntries.filter(Boolean)) {
        pushContext(entry);
      }

      res.json(result);
    } catch (err) {
      console.error("[USER CONTEXTS]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/account-link/switch", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const { targetUserId } = req.body;
      if (!targetUserId) return res.status(400).json({ message: "Vyžaduje sa targetUserId" });

      if (Number(targetUserId) === req.session.userId) {
        return res.status(400).json({ message: "Ste už v tomto kontexte" });
      }

      const link = await storage.getAccountLink(req.session.userId, Number(targetUserId));
      if (!link || !link.isActive || link.status !== "verified") {
        const reverseLink = await storage.getAccountLink(Number(targetUserId), req.session.userId);
        if (!reverseLink || !reverseLink.isActive || reverseLink.status !== "verified") {
          return res.status(403).json({ message: "Prepojenie neexistuje alebo nie je aktívne" });
        }
      }

      const [currentUser] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
      const [targetUser] = await db.select().from(appUsers).where(eq(appUsers.id, Number(targetUserId)));
      if (!targetUser) return res.status(404).json({ message: "Cieľový používateľ nenájdený" });

      let currentUid = currentUser?.uid ?? String(req.session.userId);
      let targetSubjectId: number | null = targetUser.linkedSubjectId ?? null;

      const auditEntityName = `USER_FO [${currentUid}] ACTING_AS entity:${targetSubjectId ?? targetUser.id}`;
      await db.insert(auditLogs).values({
        userId: req.session.userId,
        username: null,
        action: "ACCOUNT_SWITCHED",
        module: "AccountLink",
        entityId: targetSubjectId ?? targetUser.id,
        entityName: auditEntityName,
        oldData: null,
        newData: { fromUserId: req.session.userId, toUserId: targetUser.id },
        ipAddress: req.ip,
      });

      req.session.userId = targetUser.id;
      req.session.loginSubjectId = targetSubjectId;
      req.session.loginStep = "done";

      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba pri prepínaní kontextu" });
        res.json({ success: true });
      });
    } catch (err) {
      console.error("[ACCOUNT-LINK SWITCH]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.delete("/api/account-link/:linkedUserId", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const linkedUserId = Number(req.params.linkedUserId);
      if (!linkedUserId) return res.status(400).json({ message: "Neplatné ID" });

      await storage.deactivateAccountLinks(req.session.userId, linkedUserId);
      await db.insert(auditLogs).values({
        userId: req.session.userId,
        username: null,
        action: "ACCOUNT_LINK_REMOVED",
        module: "AccountLink",
        entityId: linkedUserId,
        entityName: null,
        oldData: null,
        newData: { deactivatedLinkedUserId: linkedUserId },
        ipAddress: req.ip,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[ACCOUNT-LINK DELETE]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });
}

function detectDeviceType(ua: string): "mobile" | "desktop" | "other" {
  if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return "mobile";
  if (/Windows NT|Macintosh|Linux x86_64/i.test(ua)) return "desktop";
  return "other";
}

function generateOtp(): string {
  return "151515"; // TODO: remove hardcoded test code before go-live
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
