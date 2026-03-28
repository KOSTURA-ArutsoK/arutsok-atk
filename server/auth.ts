import crypto from "crypto";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { db } from "./db";
import { appUsers, subjects, auditLogs, appUserLoginHistory, clientDocumentHistory, companyOfficers, accountLinks, partners, partnerContacts, myCompanies, subjectContacts, guardianConfirmationTokens, systemNotifications, subjectLinks, clientGroups, clientGroupMembers } from "@shared/schema";
import { eq, and, or, ne, isNull, isNotNull, gte, desc, inArray, sql } from "drizzle-orm";
import { storage } from "./storage";
import { decryptField } from "./crypto";
import { processPendingSmsNotifications } from "./email";

declare module "express-session" {
  interface SessionData {
    userId: number;
    loginSubjectId: number | null;
    loginStep: "subject_select" | "sms_verify" | "rc_verify" | "doc_verify" | "entity_rc_verify" | "done";
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
    guardianSwitchedFromUserId?: number;
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

async function recordLoginHistory(userId: number, ip: string | null, guardianSwitchedFromUserId?: number) {
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
          guardianSwitchedFromUserId: guardianSwitchedFromUserId ?? null,
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
  guardianSwitchedFromUserId?: number | null;
}): Promise<{ contextType: string; contextLabel: string | null }> {
  if (user.guardianSwitchedFromUserId) {
    const [gu] = await db.select({ firstName: appUsers.firstName, lastName: appUsers.lastName, username: appUsers.username })
      .from(appUsers).where(eq(appUsers.id, user.guardianSwitchedFromUserId));
    const guardianName = gu ? `${gu.firstName || ""} ${gu.lastName || ""}`.trim() || gu.username : "Správca";
    const targetName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username;
    return { contextType: "guardian", contextLabel: `${guardianName} (správca za ${targetName})` };
  }
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

async function resolveSubjectLoginStep(
  session: any,
  user: { id: number; email: string | null; linkedSubjectId: number | null },
  selected: any,
  allPeers: any[],
  ip: string | null
): Promise<{ nextStep: string; [key: string]: any }> {
  const hasRiskInCluster = allPeers.some((s: any) => s.listStatus === "cerveny");
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
        return { nextStep: "blocked", message: "Identita nebola overená. Kontaktujte prosím podporu pre doplnenie údajov." };
      }
      session.loginSubjectId = selected.id;
      session.loginStep = "doc_verify";
      session.pendingVerifyReason = "risk_override";
      return { nextStep: "doc_verify", documentHint: { documentType: latestDoc.documentType, masked: maskDocNumber(latestDoc.documentNumber!) }, reason: "risk_override" };
    }
    session.loginSubjectId = selected.id;
    session.loginStep = "rc_verify";
    session.pendingVerifyReason = "risk_override";
    return { nextStep: "rc_verify", reason: "risk_override" };
  }

  if (isPerson(selected.type) && !selected.birthNumber) {
    const [latestDoc] = await db
      .select({ documentType: clientDocumentHistory.documentType, documentNumber: clientDocumentHistory.documentNumber })
      .from(clientDocumentHistory)
      .where(eq(clientDocumentHistory.subjectId, selected.id))
      .orderBy(desc(clientDocumentHistory.archivedAt))
      .limit(1);
    if (!latestDoc || !latestDoc.documentNumber) {
      return { nextStep: "blocked", message: "Identita nebola overená. Kontaktujte prosím podporu pre doplnenie údajov." };
    }
    session.loginSubjectId = selected.id;
    session.loginStep = "doc_verify";
    return { nextStep: "doc_verify", documentHint: { documentType: latestDoc.documentType, masked: maskDocNumber(latestDoc.documentNumber!) } };
  }

  if (isSzco(selected.type) || (isPerson(selected.type) && allPeers.some((p: any) => p.id !== selected.id && isSzco(p.type)))) {
    const szcoPartner = isSzco(selected.type)
      ? allPeers.find((p: any) => isPerson(p.type))
      : allPeers.find((p: any) => isSzco(p.type));
    if (szcoPartner && szcoPartner.birthNumber && selected.birthNumber) {
      const szcoRC = decryptField(szcoPartner.birthNumber);
      if (szcoRC && selectedRC && szcoRC === selectedRC) {
        session.loginSubjectId = selected.id;
        session.loginStep = "done";
        await writeLoginAudit(user.id, selected.id, name, "DIRECT", "szco_fo_same_rc", ip);
        await recordLoginHistory(user.id, ip);
        return { nextStep: "done" };
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
      const peerPersonIds = new Set(
        allPeers.filter((p: any) => isPerson(p.type) || isSzco(p.type)).map((p: any) => p.id)
      );
      const emailMatchedOfficers = linkedPersons.filter((o: any) => o.subjectId !== null && peerPersonIds.has(o.subjectId!));
      if (emailMatchedOfficers.length === 1) {
        const [foSubject] = await db
          .select({ id: subjects.id, uid: subjects.uid, firstName: subjects.firstName, lastName: subjects.lastName, phone: subjects.phone, email: subjects.email, street: subjects.street, city: subjects.city, postalCode: subjects.postalCode, idCardNumber: subjects.idCardNumber })
          .from(subjects)
          .where(eq(subjects.id, emailMatchedOfficers[0].subjectId!));
        if (foSubject) {
          const completeness = await checkFoProfileCompleteness(foSubject);
          if (!completeness.complete) {
            return { nextStep: "blocked", message: `Profil fyzickej osoby (konateľa) je neúplný. Chýba: ${completeness.missingFields.join(", ")}. Kontaktujte správcu systému.` };
          }
          session.loginSubjectId = foSubject.id;
          session.loginActingAsEntityId = selected.id;
          session.loginStep = "done";
          await writeLoginAudit(user.id, foSubject.id, subjectDisplayName(foSubject), "ENTITY_DIRECT", "email_matched_officer", ip, selected.id, { foUid: foSubject.uid, entityType: selected.type });
          await recordLoginHistory(user.id, ip);
          return { nextStep: "done" };
        }
      }
      session.loginStep = "entity_rc_verify";
      session.pendingEntitySubjectId = selected.id;
      session.pendingEntityCandidateIds = linkedPersons.map((p: any) => p.subjectId);
      session.entityRcAttempts = 0;
      return { nextStep: "entity_rc_verify", entityName: name, entityType: selected.type };
    }

    if (linkedPersons.length === 1) {
      const [foSubject] = await db
        .select({ id: subjects.id, uid: subjects.uid, firstName: subjects.firstName, lastName: subjects.lastName, phone: subjects.phone, email: subjects.email, street: subjects.street, city: subjects.city, postalCode: subjects.postalCode, idCardNumber: subjects.idCardNumber })
        .from(subjects)
        .where(eq(subjects.id, linkedPersons[0].subjectId));
      if (foSubject) {
        const completeness = await checkFoProfileCompleteness(foSubject);
        if (!completeness.complete) {
          return { nextStep: "blocked", message: `Profil fyzickej osoby (konateľa) je neúplný. Chýba: ${completeness.missingFields.join(", ")}. Kontaktujte správcu systému.` };
        }
        session.loginSubjectId = foSubject.id;
        session.loginActingAsEntityId = selected.id;
        session.loginStep = "done";
        await writeLoginAudit(user.id, foSubject.id, subjectDisplayName(foSubject), "ENTITY_DIRECT", "single_officer_direct", ip, selected.id, { foUid: foSubject.uid, entityType: selected.type });
        await recordLoginHistory(user.id, ip);
        return { nextStep: "done" };
      }
    }

    session.loginSubjectId = selected.id;
    session.loginStep = "done";
    await writeLoginAudit(user.id, selected.id, name, "DIRECT", null, ip);
    await recordLoginHistory(user.id, ip);
    return { nextStep: "done" };
  }

  if (isPerson(selected.type) && selectedAdult === false) {
    session.loginSubjectId = selected.id;
    session.loginStep = "done";
    await writeLoginAudit(user.id, selected.id, name, "DIRECT", "minor_direct", ip);
    await recordLoginHistory(user.id, ip);
    return { nextStep: "done" };
  }

  if (isPerson(selected.type) && selectedAdult === true) {
    let hasAnotherAdultFo = false;
    for (const peer of allPeers) {
      if (peer.id !== selected.id && isPerson(peer.type) && peer.birthNumber) {
        const peerRC = decryptField(peer.birthNumber);
        const peerBD = peerRC ? parseBirthDateFromRC(peerRC) : null;
        if (peerBD && calcAge(peerBD) >= 18) { hasAnotherAdultFo = true; break; }
      }
    }

    if (!hasAnotherAdultFo) {
      const selectedPhone = selected.phone?.replace(/\D/g, "") || "";
      const otherPersonPhones = allPeers
        .filter((p: any) => p.id !== selected.id && isPerson(p.type) && p.phone)
        .map((p: any) => p.phone!.replace(/\D/g, ""));
      const hasUniquePhone = !!selectedPhone && !otherPersonPhones.includes(selectedPhone);

      if (hasUniquePhone) {
        const code = "151515";
        console.log(`[AUTH SMS MOCK] SMS kód pre ${selected.phone}: ${code}`);
        session.loginSubjectId = selected.id;
        session.loginStep = "sms_verify";
        session.pendingSmsCode = code;
        session.pendingSubjectPhone = selected.phone ?? null;
        return { nextStep: "sms_verify", maskedPhone: session.pendingSubjectPhone };
      }
    }

    session.loginSubjectId = selected.id;
    session.loginStep = "rc_verify";
    return { nextStep: "rc_verify" };
  }

  session.loginSubjectId = selected.id;
  session.loginStep = "done";
  await writeLoginAudit(user.id, selected.id, name, "DIRECT", null, ip);
  await recordLoginHistory(user.id, ip);
  return { nextStep: "done" };
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

      const allSubjectIds = [...peerSubjectsRaw, ...shadowOnly].map((s) => s.id);
      const subjectGroupCodesMap = new Map<number, string[]>();
      if (allSubjectIds.length > 0) {
        const memberships = await db
          .select({ subjectId: clientGroupMembers.subjectId, groupCode: clientGroups.groupCode })
          .from(clientGroupMembers)
          .innerJoin(clientGroups, eq(clientGroupMembers.groupId, clientGroups.id))
          .where(inArray(clientGroupMembers.subjectId, allSubjectIds));
        for (const m of memberships) {
          if (!subjectGroupCodesMap.has(m.subjectId)) subjectGroupCodesMap.set(m.subjectId, []);
          if (m.groupCode) subjectGroupCodesMap.get(m.subjectId)!.push(m.groupCode);
        }
      }

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
          groups: subjectGroupCodesMap.get(s.id) ?? [],
        };
      };

      const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;

      if (peerSubjectsRaw.length === 0 && shadowOnly.length === 0) {
        req.session.loginSubjectId = null;
        req.session.loginStep = "done";
        await recordLoginHistory(user.id, ip);
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba pri prihlásení" });
          res.json({ id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, loginStep: "done" });
        });
      }

      if (peerSubjectsRaw.length === 1 && shadowOnly.length === 0) {
        req.session.loginSubjectId = peerSubjectsRaw[0].id;
        req.session.loginStep = "done";
        await recordLoginHistory(user.id, ip);
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba pri prihlásení" });
          res.json({
            id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role,
            loginStep: "done",
          });
        });
      }

      // Auto-select primary subject when user has linkedSubjectId among their peers
      if (user.linkedSubjectId) {
        const autoInPeers = peerSubjectsRaw.find((s) => s.id === user.linkedSubjectId);
        if (autoInPeers) {
          const [selectedFull] = await db.select().from(subjects).where(and(eq(subjects.id, user.linkedSubjectId), isNull(subjects.deletedAt)));
          if (selectedFull) {
            const allPeers = await db.select().from(subjects).where(and(eq(subjects.email, user.email!.toLowerCase()), isNull(subjects.deletedAt)));
            const result = await resolveSubjectLoginStep(req.session, user, selectedFull, allPeers, ip);
            return req.session.save((err) => {
              if (err) return res.status(500).json({ message: "Chyba pri prihlásení" });
              const { nextStep, ...rest } = result;
              res.json({ id: user.id, username: user.username, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role, loginStep: nextStep, ...rest });
            });
          }
        }
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

      const allSubjectIdsGet = [...peerSubjectsRaw, ...shadowOnly].map((s) => s.id);
      const groupCodesMapGet = new Map<number, string[]>();
      if (allSubjectIdsGet.length > 0) {
        const mems = await db
          .select({ subjectId: clientGroupMembers.subjectId, groupCode: clientGroups.groupCode })
          .from(clientGroupMembers)
          .innerJoin(clientGroups, eq(clientGroupMembers.groupId, clientGroups.id))
          .where(inArray(clientGroupMembers.subjectId, allSubjectIdsGet));
        for (const m of mems) {
          if (!groupCodesMapGet.has(m.subjectId)) groupCodesMapGet.set(m.subjectId, []);
          if (m.groupCode) groupCodesMapGet.get(m.subjectId)!.push(m.groupCode);
        }
      }

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
        return { id: s.id, uid: s.uid, firstName: s.firstName, lastName: s.lastName, companyName: s.companyName, type: s.type, phone: s.phone ?? null, isShadow, isAdult: adultStatus, hasRisk: s.listStatus === "cerveny", documentHint, groups: groupCodesMapGet.get(s.id) ?? [] };
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
        req.session.loginStep = "done";
        const shadowName = subjectDisplayName(selected);
        await writeLoginAudit(user.id, selected.id, shadowName, "SHADOW_ACCESS", "shadow_direct", ip);
        await recordLoginHistory(user.id, ip);
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba session" });
          res.json({ nextStep: "done" });
        });
      }

      const result = await resolveSubjectLoginStep(req.session, user, selected, allPeers, ip);
      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json(result);
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
      req.session.loginStep = "done";
      req.session.entityRcAttempts = undefined;
      req.session.pendingEntityCandidateIds = undefined;
      req.session.pendingEntitySubjectId = undefined;
      await recordLoginHistory(req.session.userId, ip);

      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({ nextStep: "done" });
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

      if (subjectId) {
        const [s] = await db.select({
          id: subjects.id, firstName: subjects.firstName, lastName: subjects.lastName,
          companyName: subjects.companyName, type: subjects.type, phone: subjects.phone,
          email: subjects.email, street: subjects.street, city: subjects.city,
          postalCode: subjects.postalCode, idCardNumber: subjects.idCardNumber,
        }).from(subjects).where(eq(subjects.id, subjectId));
        if (s) {
          await writeLoginAudit(req.session.userId, subjectId, subjectDisplayName(s), "SMS", verifyReason, ip);

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

      req.session.loginStep = "done";
      req.session.pendingVerifyReason = undefined;
      const ip2 = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
      await recordLoginHistory(req.session.userId, ip2);
      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({ nextStep: "done" });
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
      await writeLoginAudit(req.session.userId, subjectId, s ? subjectDisplayName(s) : null, "DOC", verifyReason, ip);

      req.session.loginStep = "done";
      req.session.pendingVerifyReason = undefined;
      const ip2 = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || null;
      await recordLoginHistory(req.session.userId, ip2);
      return req.session.save((err) => {
        if (err) return res.status(500).json({ message: "Chyba session" });
        res.json({ nextStep: "done" });
      });
    } catch (err) {
      console.error("Verify doc error:", err);
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
      const { targetEmail, rc, targetUserId, mode } = req.body;

      // ── GUARDIAN MODE ──────────────────────────────────────────
      if (mode === "guardian") {
        if (!targetEmail) return res.status(400).json({ message: "Zadajte email cieľového účtu" });
        const targetEmailLower = (targetEmail as string).toLowerCase().trim();
        const [currentUser] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
        if (!currentUser) return res.status(401).json({ message: "Používateľ nenájdený" });

        const [tu] = await db.select().from(appUsers).where(eq(appUsers.email, targetEmailLower));
        if (!tu) return res.status(404).json({ message: "Účet s týmto emailom neexistuje" });
        if (tu.id === req.session.userId) return res.status(400).json({ message: "Nemôžete vytvoriť opatrovníctvo pre seba" });

        const existingLink = await storage.getAccountLink(req.session.userId, tu.id);
        if (existingLink && existingLink.isActive && existingLink.status === "verified") {
          return res.status(409).json({ message: "Prepojenie s týmto účtom už existuje" });
        }
        const existingPending = await storage.getAccountLink(req.session.userId, tu.id);
        if (existingPending && existingPending.linkType === "guardian" && existingPending.status === "pending_target") {
          return res.status(409).json({ message: "Žiadosť o opatrovníctvo pre tento účet už čaká na potvrdenie" });
        }

        let targetSubject: typeof subjects.$inferSelect | null = null;
        if (tu.linkedSubjectId) {
          const [ts] = await db.select().from(subjects).where(eq(subjects.id, tu.linkedSubjectId));
          targetSubject = ts ?? null;
        }
        const targetName = targetSubject
          ? `${targetSubject.firstName ?? ""} ${targetSubject.lastName ?? ""}`.trim() || targetSubject.companyName || tu.email
          : (tu.firstName ? `${tu.firstName} ${tu.lastName ?? ""}`.trim() : tu.email);

        const needsSms = !!(tu.phone);
        const emailToken = crypto.randomUUID();
        const smsCode = String(Math.floor(100000 + Math.random() * 900000));

        const { linkId, tokenId } = await storage.createGuardianLink(
          req.session.userId, tu.id, emailToken, smsCode, needsSms
        );

        await db.insert(auditLogs).values({
          userId: req.session.userId,
          username: null,
          action: "GUARDIAN_LINK_INITIATED",
          module: "AccountLink",
          entityId: tu.id,
          entityName: null,
          oldData: null,
          newData: { targetUserId: tu.id, linkId },
          ipAddress: req.ip,
        });

        const appDomain = process.env.APP_DOMAIN || req.headers.host || "localhost:5000";
        const protocol = process.env.APP_DOMAIN ? "https" : req.secure ? "https" : "http";
        const confirmUrl = `${protocol}://${appDomain}/potvrdenie-spravy?token=${emailToken}`;

        const guardianName = `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || currentUser.username || "Správca";
        const emailHtml = `<!DOCTYPE html><html lang="sk"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#0f1923;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;"><div style="max-width:640px;margin:0 auto;padding:32px 24px;"><div style="background:#1a2332;border:1px solid #2d3748;border-radius:4px;padding:32px;"><div style="text-align:center;margin-bottom:24px;"><h2 style="margin:0;color:#63b3ed;font-size:18px;letter-spacing:1px;">ArutsoK (ATK)</h2></div><p style="color:#e2e8f0;font-size:14px;line-height:1.6;">Vážený používateľ,</p><p style="color:#e2e8f0;font-size:14px;line-height:1.6;">používateľ <strong>${guardianName}</strong> žiada o právo spravovať váš účet v systéme ArutsoK (ATK).</p><div style="text-align:center;margin:24px 0;"><a href="${confirmUrl}" style="display:inline-block;background:#2b6cb0;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:14px;">Potvrdiť alebo odmietnuť žiadosť</a></div><p style="color:#a0aec0;font-size:12px;line-height:1.6;">Platnosť odkazu vyprší o 72 hodín. Ak ste žiadosť neočakávali, ignorujte tento e-mail alebo ju odmietnite na vyššie uvedenom odkaze.</p><hr style="border:none;border-top:1px solid #2d3748;margin:24px 0;"><p style="font-size:11px;color:#718096;text-align:center;margin:0;">Tento e-mail bol vygenerovaný automaticky systémom ArutsoK.</p></div></div></body></html>`;

        try {
          await db.insert(systemNotifications).values({
            recipientEmail: targetEmailLower,
            recipientName: targetName || null,
            recipientUserId: tu.id,
            subject: `Žiadosť o opatrovníctvo — ArutsoK (ATK)`,
            bodyHtml: emailHtml,
            status: "pending",
            notificationType: "guardian_link_request",
          });
        } catch (emailErr) {
          console.error("[GUARDIAN-LINK] Failed to queue confirmation email:", emailErr);
        }

        // Queue SMS dispatch notification when target has phone
        // The SMS gateway processor will pick this up and deliver via configured provider
        if (needsSms && tu.phone) {
          try {
            const smsText = `ArutsoK (ATK): ${guardianName} žiada o spravovanie vášho účtu. Kód na potvrdenie ste dostali SMS správou. Platnosť 72h.`;
            await db.insert(systemNotifications).values({
              recipientEmail: targetEmailLower,
              recipientName: targetName || null,
              recipientUserId: tu.id,
              subject: `Opatrovnícky SMS kód — ArutsoK`,
              bodyHtml: smsText,
              status: "pending",
              notificationType: "guardian_sms_code",
              // batchId binds this notification to the exact guardian token
              // so processPendingSmsNotifications can look up the right SMS code
              batchId: `guardian_token_${tokenId}`,
            });
          } catch (smsErr) {
            console.error("[GUARDIAN-LINK] Failed to queue SMS notification:", smsErr);
          }
          // Dispatch immediately; errors are non-fatal
          processPendingSmsNotifications().catch((e) => console.error("[GUARDIAN-LINK] SMS dispatch error:", e));
        }

        return res.json({
          status: "guardian_pending",
          linkId,
          targetName,
          maskedTarget: targetEmailLower.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
        });
      }
      // ── END GUARDIAN MODE ──────────────────────────────────────

      // ── SUBJECT MODE ───────────────────────────────────────────
      if (mode === "subject") {
        const { subjectId, ico, uid, validUntil: validUntilRaw } = req.body;
        let validUntilDate: Date | null = null;
        if (validUntilRaw) {
          const parsed = new Date(validUntilRaw);
          if (isNaN(parsed.getTime())) return res.status(400).json({ message: "Neplatný dátum platnosti (validUntil)" });
          if (parsed <= new Date()) return res.status(400).json({ message: "Dátum platnosti musí byť v budúcnosti" });
          validUntilDate = parsed;
        }
        const [currentUser] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
        if (!currentUser) return res.status(401).json({ message: "Používateľ nenájdený" });

        let resolvedSubjectId: number | null = subjectId ? Number(subjectId) : null;

        // Accept ICO or UID lookup instead of/in addition to subjectId
        if (!resolvedSubjectId && (ico || uid)) {
          const allSubjects = await db.select({ id: subjects.id, uid: subjects.uid, details: subjects.details })
            .from(subjects).where(isNull(subjects.deletedAt)).limit(500);
          const found = allSubjects.find(s => {
            if (uid && s.uid === uid) return true;
            if (ico) {
              const sIco = (s.details as { ico?: string } | null)?.ico;
              if (sIco && sIco === ico) return true;
            }
            return false;
          });
          if (!found) return res.status(404).json({ message: "Subjekt s uvedeným IČO/UID nenájdený" });
          resolvedSubjectId = found.id;
        }

        if (!resolvedSubjectId) return res.status(400).json({ message: "Vyžaduje sa ID, IČO alebo UID subjektu" });

        const [subject] = await db.select().from(subjects).where(and(eq(subjects.id, resolvedSubjectId), isNull(subjects.deletedAt)));
        if (!subject) return res.status(404).json({ message: "Subjekt neexistuje" });

        // Strict duplicate check: block both active/verified AND non-expired pending requests for same user↔subject pair
        const existingLinks = await storage.getSubjectLinksByUserId(req.session.userId);
        const existing = existingLinks.find(l => l.subjectId === resolvedSubjectId && l.isActive && l.status === "verified");
        if (existing) return res.status(409).json({ message: "Prepojenie s týmto subjektom už existuje" });
        const now = new Date();
        const existingPendingSubject = existingLinks.find(l =>
          l.subjectId === resolvedSubjectId &&
          !l.rejected &&
          l.status === "pending_confirmation" &&
          l.expiresAt > now
        );
        if (existingPendingSubject) return res.status(409).json({ message: "Žiadosť o prepojenie s týmto subjektom už čaká na potvrdenie" });

        // Look up subject's primary email contact
        const emailContacts = await db.select().from(subjectContacts)
          .where(and(eq(subjectContacts.subjectId, resolvedSubjectId!), eq(subjectContacts.type, "email")));
        const primaryEmail = emailContacts.find(c => c.isPrimary)?.value ?? emailContacts[0]?.value ?? null;
        if (!primaryEmail) return res.status(400).json({ message: "Subjekt nemá evidovaný email pre potvrdenie prepojenia" });

        // Look up subject's primary phone contact (for SMS requirement)
        const phoneContacts = await db.select().from(subjectContacts)
          .where(and(eq(subjectContacts.subjectId, resolvedSubjectId!), eq(subjectContacts.type, "phone")));
        const primaryPhone = phoneContacts.find(c => c.isPrimary)?.value ?? phoneContacts[0]?.value ?? null;
        const needsSms = !!primaryPhone;

        const emailToken = crypto.randomUUID();
        const smsCode = needsSms ? String(Math.floor(100000 + Math.random() * 900000)) : null;

        const linkId = await storage.createSubjectLink(
          req.session.userId, resolvedSubjectId!, emailToken, smsCode, needsSms, req.session.userId, validUntilDate
        );

        await db.insert(auditLogs).values({
          userId: req.session.userId, username: null, action: "SUBJECT_LINK_INITIATED",
          module: "SubjectLink", entityId: resolvedSubjectId!, entityName: null,
          oldData: null, newData: { subjectId: resolvedSubjectId!, linkId }, ipAddress: req.ip,
        });

        const appDomain = process.env.APP_DOMAIN || req.headers.host || "localhost:5000";
        const protocol = process.env.APP_DOMAIN ? "https" : req.secure ? "https" : "http";
        const confirmUrl = `${protocol}://${appDomain}/potvrdenie-spravy?subjectToken=${emailToken}`;

        const subjectDisplayName = subject.companyName
          || [subject.firstName, subject.lastName].filter(Boolean).join(" ")
          || subject.uid || "Subjekt";
        const initiatorName = `${currentUser.firstName || ""} ${currentUser.lastName || ""}`.trim() || currentUser.username || "Používateľ";

        const emailHtml = `<!DOCTYPE html><html lang="sk"><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#0f1923;font-family:Arial,Helvetica,sans-serif;color:#e2e8f0;"><div style="max-width:640px;margin:0 auto;padding:32px 24px;"><div style="background:#1a2332;border:1px solid #2d3748;border-radius:4px;padding:32px;"><div style="text-align:center;margin-bottom:24px;"><h2 style="margin:0;color:#63b3ed;font-size:18px;letter-spacing:1px;">ArutsoK (ATK)</h2></div><p style="color:#e2e8f0;font-size:14px;line-height:1.6;">Dobrý deň,</p><p style="color:#e2e8f0;font-size:14px;line-height:1.6;">používateľ <strong>${initiatorName}</strong> žiada o prepojenie svojho účtu so subjektom <strong>${subjectDisplayName}</strong> v systéme ArutsoK (ATK).</p><div style="text-align:center;margin:24px 0;"><a href="${confirmUrl}" style="display:inline-block;background:#2b6cb0;color:#fff;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:bold;font-size:14px;">Potvrdiť alebo odmietnuť prepojenie</a></div><p style="color:#a0aec0;font-size:12px;line-height:1.6;">Platnosť odkazu vyprší o 72 hodín. Ak ste žiadosť neočakávali, ignorujte tento e-mail alebo ju odmietnite na vyššie uvedenom odkaze.</p><hr style="border:none;border-top:1px solid #2d3748;margin:24px 0;"><p style="font-size:11px;color:#718096;text-align:center;margin:0;">Tento e-mail bol vygenerovaný automaticky systémom ArutsoK.</p></div></div></body></html>`;

        try {
          await db.insert(systemNotifications).values({
            recipientEmail: primaryEmail,
            recipientName: subjectDisplayName,
            recipientUserId: null,
            subject: `Žiadosť o prepojenie účtu so subjektom — ArutsoK (ATK)`,
            bodyHtml: emailHtml,
            status: "pending",
            notificationType: "subject_link_request",
          });
        } catch (emailErr) {
          console.error("[SUBJECT-LINK] Failed to queue confirmation email:", emailErr);
        }

        if (needsSms && primaryPhone) {
          try {
            await db.insert(systemNotifications).values({
              recipientEmail: primaryEmail,
              recipientName: subjectDisplayName,
              recipientUserId: null,
              recipientPhone: primaryPhone,
              subject: `Prepojenie subjektu — SMS kód — ArutsoK`,
              bodyHtml: `ArutsoK (ATK): Žiadosť o prepojenie účtu so subjektom ${subjectDisplayName}. Kód na potvrdenie ste dostali SMS správou. Platnosť 72h.`,
              status: "pending",
              notificationType: "subject_sms_code",
              batchId: `subject_link_${linkId}`,
            });
          } catch (smsErr) {
            console.error("[SUBJECT-LINK] Failed to queue SMS notification:", smsErr);
          }
          processPendingSmsNotifications().catch((e) => console.error("[SUBJECT-LINK] SMS dispatch error:", e));
        }

        return res.json({
          status: "subject_pending",
          linkId,
          subjectName: subjectDisplayName,
          maskedEmail: primaryEmail.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
        });
      }
      // ── END SUBJECT MODE ────────────────────────────────────────

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

      // Also include active subject links so clients can enumerate all contexts
      const subjectLinkRows = await storage.getSubjectLinksByUserId(req.session.userId);
      const nowTs = new Date();
      const activeSubjectLinks = subjectLinkRows.filter(sl =>
        sl.isActive && sl.status === "verified" &&
        !(sl.validUntil && new Date(sl.validUntil) <= nowTs)
      );
      const [currentUser2] = await db.select({ activeSubjectId: appUsers.activeSubjectId }).from(appUsers).where(eq(appUsers.id, req.session.userId)).limit(1);
      const subjectEntries = await Promise.all(activeSubjectLinks.map(async (sl) => {
        const [subject] = await db.select({
          id: subjects.id, type: subjects.type, companyName: subjects.companyName,
          firstName: subjects.firstName, lastName: subjects.lastName, uid: subjects.uid,
          details: subjects.details,
        }).from(subjects).where(eq(subjects.id, sl.subjectId));
        if (!subject) return null;
        const name = subject.companyName || [subject.firstName, subject.lastName].filter(Boolean).join(" ") || subject.uid || "Subjekt";
        const ico = (subject.details as { ico?: string } | null)?.ico ?? null;
        return {
          userId: null, subjectId: subject.id,
          firstName: subject.firstName ?? null, lastName: subject.lastName ?? null,
          companyName: subject.companyName ?? null, type: subject.type ?? null,
          ico, uid: subject.uid ?? null,
          status: sl.status, isActive: sl.isActive,
          isCurrent: currentUser2?.activeSubjectId === subject.id,
          isSubjectLink: true as const, linkId: sl.id,
          subjectName: name, subjectType: subject.type,
        };
      }));

      res.json([currentEntry, ...linkedEntries.filter(Boolean), ...subjectEntries.filter(Boolean)]);
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
        isCurrent: currentUser.activeSubjectId === null && currentUser.activeKtoCompanyId === null,
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
              isCurrent: currentUser.activeSubjectId === null && currentUser.activeKtoCompanyId === co.id,
            });
          }
        }
      }

      // Linked accounts (other AppUsers)
      const links = await storage.getAccountLinks(req.session.userId);
      const linkedEntries = await Promise.all(links.map(async (link) => {
        const isGuardianLink = link.linkType === "guardian";
        // Guardian links are one-directional: only the guardian (primaryUserId) can switch
        // into the managed account. The managed user does NOT get the guardian listed.
        if (isGuardianLink && link.linkedUserId === req.session.userId) return null;

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
        const contextType = isGuardianLink ? "guardian" : "linked_account";
        const subLabel = isGuardianLink
          ? "Spravovaný účet"
          : (otherSubject?.type ? linkedAccountSubLabel(otherSubject.type, null) : "Prepojený účet");
        return {
          contextType,
          userId: otherUser.id,
          companyId: null,
          label: otherLabel,
          subLabel,
          type: otherSubject?.type ?? "person",
          uid: otherSubject?.uid ?? null,
          ico: null,
          isCurrent: false,
          isGuardian: isGuardianLink,
        };
      }));
      for (const entry of linkedEntries.filter(Boolean)) {
        pushContext(entry);
      }

      // When guardian is operating in managed account, expose "return to own account" context
      if (req.session.guardianSwitchedFromUserId) {
        const gId = req.session.guardianSwitchedFromUserId;
        const [gUser] = await db.select().from(appUsers).where(eq(appUsers.id, gId));
        if (gUser) {
          let gSubject: typeof subjects.$inferSelect | null = null;
          if (gUser.linkedSubjectId) {
            const [gs] = await db.select().from(subjects).where(eq(subjects.id, gUser.linkedSubjectId));
            gSubject = gs ?? null;
          }
          const gLabel = gSubject?.companyName
            || [gSubject?.firstName ?? gUser.firstName, gSubject?.lastName ?? gUser.lastName].filter(Boolean).join(" ")
            || gUser.username || gUser.email || "";
          pushContext({
            contextType: "guardian_return",
            userId: gId,
            companyId: null,
            label: gLabel,
            subLabel: "Váš účet (správca)",
            type: gSubject?.type ?? "person",
            uid: gSubject?.uid ?? null,
            ico: null,
            isCurrent: false,
            isGuardian: false,
          });
        }
      }

      // Subject links (subjectLinks table — direct explicit subject-user bindings)
      const userSubjectLinks = await storage.getSubjectLinksByUserId(req.session.userId);
      const now = new Date();
      const activeSubjectLinks = userSubjectLinks.filter(sl =>
        sl.isActive && sl.status === "verified" &&
        !(sl.validUntil && sl.validUntil <= now)
      );
      for (const sl of activeSubjectLinks) {
        const key = `subject:${sl.subjectId}`;
        if (seenContextKeys.has(key)) continue;
        const [subject] = await db.select({
          id: subjects.id, type: subjects.type, companyName: subjects.companyName,
          firstName: subjects.firstName, lastName: subjects.lastName, uid: subjects.uid, details: subjects.details,
        }).from(subjects).where(and(eq(subjects.id, sl.subjectId), isNull(subjects.deletedAt)));
        if (!subject) continue;
        const ico = (subject.details as { ico?: string } | null)?.ico ?? null;
        const displayName = subject.companyName || [subject.firstName, subject.lastName].filter(Boolean).join(" ") || subject.uid || "";
        const subjectLabel = subjectTypeShortLabel(subject.type);
        const subLabel = ico ? `${subjectLabel} — IČO:\u00A0${ico}` : subjectLabel;
        const normalizedContextType = normalizeSubjectContextType(subject.type);
        seenContextKeys.add(key);
        result.push({
          contextType: normalizedContextType,
          userId: currentUser.id,
          companyId: null,
          subjectId: subject.id,
          linkId: sl.id,
          label: displayName,
          subLabel,
          type: subject.type,
          uid: subject.uid ?? null,
          ico: ico ?? null,
          isCurrent: currentUser.activeSubjectId === subject.id,
          isSubjectLink: true,
        });
      }

      res.json(result);
    } catch (err) {
      console.error("[USER CONTEXTS]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // ── REVOKE ACCOUNT LINK ──────────────────────────────────────
  // POST /api/account-link/:id/revoke — owner or admin revoke for account links (guardian/same_person)
  app.post("/api/account-link/:id/revoke", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const linkId = Number(req.params.id);
      if (!linkId) return res.status(400).json({ message: "Neplatné ID" });
      const link = await storage.getAccountLinkById(linkId);
      if (!link) return res.status(404).json({ message: "Prepojenie nenájdené" });
      const isOwner = link.primaryUserId === req.session.userId || link.linkedUserId === req.session.userId;
      if (!isOwner) {
        // Check admin role before denying
        const [currentUser] = await db.select({ isAdmin: appUsers.isAdmin, role: appUsers.role })
          .from(appUsers).where(eq(appUsers.id, req.session.userId)).limit(1);
        const isAdminUser = currentUser?.isAdmin || ["admin", "superadmin", "prezident", "architekt"].includes(currentUser?.role ?? "");
        if (!isAdminUser) {
          return res.status(403).json({ message: "Nie ste oprávnený zrušiť toto prepojenie" });
        }
      }
      const { reason } = req.body;
      await storage.revokeAccountLinkById(linkId, req.session.userId, reason);
      await db.insert(auditLogs).values({
        userId: getAuditActorId(req), username: null, action: "ACCOUNT_LINK_REVOKED",
        module: "AccountLink", entityId: linkId, entityName: null,
        oldData: null, newData: { linkId, linkType: link.linkType, reason: reason ?? null, revokedBySessionUserId: req.session.userId }, ipAddress: req.ip,
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("[ACCOUNT-LINK REVOKE]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // ── GUARDIAN PENDING LIST (authenticated) ──────────────────
  app.get("/api/account-link/guardian-pending", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const pendingLinks = await storage.getPendingGuardianLinksFor(req.session.userId);
      const enriched = await Promise.all(pendingLinks.map(async (link) => {
        const [tu] = await db.select({ firstName: appUsers.firstName, lastName: appUsers.lastName, email: appUsers.email }).from(appUsers).where(eq(appUsers.id, link.linkedUserId));
        return {
          linkId: link.id,
          targetName: tu ? `${tu.firstName || ""} ${tu.lastName || ""}`.trim() || tu.email : "Neznámy",
          targetEmail: tu?.email ? tu.email.replace(/^(.{2}).*(@.*)$/, "$1***$2") : "",
          status: link.status,
          createdAt: link.createdAt,
          tokenExpired: link.token ? new Date() > link.token.expiresAt : false,
        };
      }));
      return res.json(enriched);
    } catch (err) {
      console.error("[GUARDIAN-PENDING LIST]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // ── GUARDIAN ACTIVE LINKS (authenticated) ──────────────────
  app.get("/api/account-link/guardian-list", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const allLinks = await db.select().from(accountLinks).where(
        and(
          or(
            eq(accountLinks.primaryUserId, req.session.userId),
            eq(accountLinks.linkedUserId, req.session.userId)
          ),
          eq(accountLinks.linkType, "guardian"),
          eq(accountLinks.isActive, true),
          eq(accountLinks.status, "verified"),
        )
      );
      const enriched = await Promise.all(allLinks.map(async (link) => {
        const isGuardian = link.primaryUserId === req.session.userId;
        const otherId = isGuardian ? link.linkedUserId : link.primaryUserId;
        const [otherUser] = await db.select({ firstName: appUsers.firstName, lastName: appUsers.lastName, email: appUsers.email }).from(appUsers).where(eq(appUsers.id, otherId));
        return {
          linkId: link.id,
          isGuardian,
          otherName: otherUser ? `${otherUser.firstName || ""} ${otherUser.lastName || ""}`.trim() || otherUser.email : "Neznámy",
          role: isGuardian ? "guardian" : "managed",
          confirmedAt: link.targetConfirmedAt,
        };
      }));
      return res.json(enriched);
    } catch (err) {
      console.error("[GUARDIAN-LIST]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  app.post("/api/account-link/switch", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const { targetUserId, subjectLinkId } = req.body;

      // Subject context switch: activate a subject link context (set activeSubjectId on user)
      if (subjectLinkId && !targetUserId) {
        const subjectLinkIdNum = Number(subjectLinkId);
        const [sl] = await db.select().from(subjectLinks)
          .where(eq(subjectLinks.id, subjectLinkIdNum)).limit(1);
        if (!sl || sl.userId !== req.session.userId) {
          return res.status(403).json({ message: "Prepojenie nenájdené alebo nepatrí Vám" });
        }
        if (!sl.isActive || sl.status !== "verified") {
          return res.status(400).json({ message: "Prepojenie nie je aktívne" });
        }
        await db.update(appUsers)
          .set({ activeSubjectId: sl.subjectId })
          .where(eq(appUsers.id, req.session.userId));
        await db.insert(auditLogs).values({
          userId: req.session.userId, username: null, action: "SUBJECT_CONTEXT_ACTIVATED",
          module: "SubjectLink", entityId: sl.subjectId, entityName: null,
          oldData: null, newData: { subjectLinkId: sl.id, subjectId: sl.subjectId }, ipAddress: req.ip,
        });
        return res.json({ success: true });
      }

      if (!targetUserId) return res.status(400).json({ message: "Vyžaduje sa targetUserId alebo subjectLinkId" });

      if (Number(targetUserId) === req.session.userId) {
        return res.status(400).json({ message: "Ste už v tomto kontexte" });
      }

      // Special case: guardian returning to their own account (guardian_return context)
      if (req.session.guardianSwitchedFromUserId && Number(targetUserId) === req.session.guardianSwitchedFromUserId) {
        const [guardianUser] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.guardianSwitchedFromUserId));
        if (!guardianUser) return res.status(404).json({ message: "Vlastný účet nenájdený" });
        await db.insert(auditLogs).values({
          userId: req.session.guardianSwitchedFromUserId, username: null, action: "GUARDIAN_ACCOUNT_RETURNED",
          module: "AccountLink", entityId: req.session.userId, entityName: null,
          oldData: null, newData: { returnedToUserId: req.session.guardianSwitchedFromUserId, fromManagedUserId: req.session.userId }, ipAddress: req.ip,
        });
        req.session.userId = req.session.guardianSwitchedFromUserId;
        req.session.loginSubjectId = guardianUser.linkedSubjectId ?? null;
        req.session.guardianSwitchedFromUserId = undefined;
        req.session.loginStep = "done";
        return req.session.save((err) => {
          if (err) return res.status(500).json({ message: "Chyba pri návrate do vlastného konta" });
          res.json({ success: true });
        });
      }

      let activeLink = await storage.getAccountLink(req.session.userId, Number(targetUserId));
      if (!activeLink || !activeLink.isActive || activeLink.status !== "verified") {
        const reverseLink = await storage.getAccountLink(Number(targetUserId), req.session.userId);
        if (!reverseLink || !reverseLink.isActive || reverseLink.status !== "verified") {
          return res.status(403).json({ message: "Prepojenie neexistuje alebo nie je aktívne" });
        }
        activeLink = reverseLink;
      }

      // Guardian links are one-directional: only the guardian (primaryUserId) may switch
      // into the managed account. The managed user may not impersonate the guardian.
      if (activeLink.linkType === "guardian" && activeLink.linkedUserId === req.session.userId) {
        return res.status(403).json({ message: "Opatrovník môže spravovať tento účet, nie naopak" });
      }
      const isGuardianSwitch = activeLink.linkType === "guardian" && activeLink.primaryUserId === req.session.userId;

      const [currentUser] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
      const [targetUser] = await db.select().from(appUsers).where(eq(appUsers.id, Number(targetUserId)));
      if (!targetUser) return res.status(404).json({ message: "Cieľový používateľ nenájdený" });

      let currentUid = currentUser?.uid ?? String(req.session.userId);
      let targetSubjectId: number | null = targetUser.linkedSubjectId ?? null;

      const auditEntityName = `USER_FO [${currentUid}] ACTING_AS entity:${targetSubjectId ?? targetUser.id}`;
      await db.insert(auditLogs).values({
        userId: req.session.userId,
        username: null,
        action: isGuardianSwitch ? "GUARDIAN_ACCOUNT_SWITCHED" : "ACCOUNT_SWITCHED",
        module: "AccountLink",
        entityId: targetSubjectId ?? targetUser.id,
        entityName: auditEntityName,
        oldData: null,
        newData: { fromUserId: req.session.userId, toUserId: targetUser.id },
        ipAddress: req.ip,
      });

      const originalUserId = req.session.userId;
      req.session.userId = targetUser.id;
      req.session.loginSubjectId = targetSubjectId;
      req.session.loginStep = "done";
      if (isGuardianSwitch) {
        req.session.guardianSwitchedFromUserId = originalUserId;
      } else {
        req.session.guardianSwitchedFromUserId = undefined;
      }

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
        userId: getAuditActorId(req),
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

  // ── SPEC-REQUIRED ALIASES: /api/account-link/guardian-* ─────
  // The GET endpoint auto-confirms email upon token access (link click),
  // activating the link directly if no SMS is required.
  // Rate limiting on SMS verification prevents brute-force attacks.

  const guardianSmsRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    message: { message: "Príliš veľa pokusov. Skúste znova o 10 minút." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // GET /api/account-link/guardian-confirm — validates token, confirms email, activates email-only links
  app.get("/api/account-link/guardian-confirm", async (req, res) => {
    try {
      const { token } = req.query;
      if (!token || typeof token !== "string") return res.status(400).json({ message: "Chýba token" });
      const gct = await storage.getGuardianToken(token).catch(() => undefined);
      if (!gct) return res.status(404).json({ message: "Token neexistuje alebo bol použitý" });
      if (gct.rejected) return res.status(410).json({ message: "Žiadosť bola odmietnutá" });
      if (new Date() > gct.expiresAt) return res.status(410).json({ message: "Platnosť tokenu vypršala" });
      const [guardianUser] = await db.select({ firstName: appUsers.firstName, lastName: appUsers.lastName, email: appUsers.email }).from(appUsers).where(eq(appUsers.id, gct.guardianUserId));
      const [targetUser] = await db.select({ firstName: appUsers.firstName, lastName: appUsers.lastName }).from(appUsers).where(eq(appUsers.id, gct.targetUserId));
      const guardianName = guardianUser ? `${guardianUser.firstName || ""} ${guardianUser.lastName || ""}`.trim() || guardianUser.email || "Neznámy" : "Neznámy";
      const guardianEmail = guardianUser?.email || "";
      const targetName = targetUser ? `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() || "Neznámy" : "Neznámy";
      // Email click = email channel confirmed
      if (!gct.emailConfirmed) {
        await storage.confirmGuardianEmail(gct.id);
      }
      // Determine status from actual link state (idempotent)
      const link = await storage.getAccountLinkById(gct.linkId);
      let status: "sms_required" | "confirmed";
      if (link?.status === "verified") {
        status = "confirmed";
      } else if (gct.needsSms) {
        // SMS path: email confirmed, waiting for SMS code
        status = "sms_required";
      } else {
        // Email-only path: link click = full confirmation, activate immediately
        await storage.completeGuardianLink(gct.linkId, "email");
        await db.insert(auditLogs).values({
          userId: gct.targetUserId, username: null, action: "GUARDIAN_LINK_CONFIRMED",
          module: "AccountLink", entityId: gct.guardianUserId, entityName: null,
          oldData: null, newData: { linkId: gct.linkId, via: "email" }, ipAddress: null,
        });
        status = "confirmed";
      }
      return res.json({
        tokenId: gct.id, token, guardianName,
        guardianEmail: guardianEmail.replace(/^(.{2}).*(@.*)$/, "$1***$2"),
        targetName, needsSms: gct.needsSms,
        emailConfirmed: true,
        smsConfirmed: gct.smsConfirmed,
        expiresAt: gct.expiresAt,
        status,
      });
    } catch (err) {
      console.error("[GUARDIAN-CONFIRM ALIAS GET]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // POST /api/account-link/guardian-verify-sms — with rate limiting
  app.post("/api/account-link/guardian-verify-sms", guardianSmsRateLimit, async (req, res) => {
    try {
      const { token, smsCode } = req.body;
      if (!token || !smsCode) return res.status(400).json({ message: "Chýba token alebo SMS kód" });
      const gct = await storage.getGuardianToken(token);
      if (!gct) return res.status(404).json({ message: "Token neexistuje" });
      if (gct.rejected) return res.status(410).json({ message: "Žiadosť bola odmietnutá" });
      if (new Date() > gct.expiresAt) return res.status(410).json({ message: "Platnosť tokenu vypršala" });
      if (!gct.emailConfirmed) return res.status(400).json({ message: "Najprv potvrďte email" });
      if (gct.smsConfirmed) return res.json({ status: "confirmed" });
      if (smsCode.trim() !== gct.smsCode) return res.status(400).json({ message: "Nesprávny SMS kód" });
      await storage.confirmGuardianSms(gct.id);
      await storage.completeGuardianLink(gct.linkId, "email+sms");
      await db.insert(auditLogs).values({ userId: gct.targetUserId, username: null, action: "GUARDIAN_LINK_CONFIRMED", module: "AccountLink", entityId: gct.guardianUserId, entityName: null, oldData: null, newData: { linkId: gct.linkId, via: "email+sms" }, ipAddress: null });
      return res.json({ status: "confirmed" });
    } catch (err) {
      console.error("[GUARDIAN-VERIFY-SMS ALIAS]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // POST /api/account-link/guardian-reject — accepts token in body OR query param
  // Also handles post-activation revocation (when link is already verified)
  app.post("/api/account-link/guardian-reject", async (req, res) => {
    try {
      const token = req.body?.token || (req.query?.token as string | undefined);
      if (!token) return res.status(400).json({ message: "Chýba token" });
      const gct = await storage.getGuardianToken(token);
      if (!gct) return res.status(404).json({ message: "Token neexistuje" });
      if (gct.rejected) return res.json({ status: "already_rejected" });
      // Mark token as rejected
      await storage.rejectGuardianLink(gct.id);
      // If link was already verified (activated), also revoke the account link
      const link = await storage.getAccountLinkById(gct.linkId);
      if (link?.status === "verified") {
        await storage.revokeAccountLinkById(gct.linkId, gct.targetUserId, "rejected_by_target");
      }
      await db.insert(auditLogs).values({ userId: gct.targetUserId, username: null, action: "GUARDIAN_LINK_REJECTED", module: "AccountLink", entityId: gct.guardianUserId, entityName: null, oldData: null, newData: { linkId: gct.linkId }, ipAddress: null });
      return res.json({ status: "rejected" });
    } catch (err) {
      console.error("[GUARDIAN-REJECT ALIAS]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // ── SUBJECT LINK CONFIRMATION ENDPOINTS ─────────────────────
  const subjectSmsRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000, max: 10,
    message: { message: "Príliš veľa pokusov. Skúste znova o 10 minút." },
    standardHeaders: true, legacyHeaders: false,
  });

  // GET /api/account-link/subject-confirm — validates subjectToken, confirms email, activates email-only links
  app.get("/api/account-link/subject-confirm", async (req, res) => {
    try {
      const { subjectToken } = req.query;
      if (!subjectToken || typeof subjectToken !== "string") return res.status(400).json({ message: "Chýba token" });
      const sl = await storage.getSubjectLinkByToken(subjectToken).catch(() => undefined);
      if (!sl) return res.status(404).json({ message: "Token neexistuje alebo bol použitý" });
      if (sl.rejected) return res.status(410).json({ message: "Žiadosť bola odmietnutá" });
      if (new Date() > sl.expiresAt) return res.status(410).json({ message: "Platnosť tokenu vypršala" });
      const [subject] = await db.select().from(subjects).where(eq(subjects.id, sl.subjectId));
      const [initiatorUser] = await db.select({ firstName: appUsers.firstName, lastName: appUsers.lastName, email: appUsers.email }).from(appUsers).where(eq(appUsers.id, sl.userId));
      const subjectName = subject?.companyName || [subject?.firstName, subject?.lastName].filter(Boolean).join(" ") || subject?.uid || "Subjekt";
      const initiatorName = initiatorUser ? `${initiatorUser.firstName || ""} ${initiatorUser.lastName || ""}`.trim() || initiatorUser.email || "Neznámy" : "Neznámy";
      if (!sl.emailConfirmed) await storage.confirmSubjectLinkEmail(sl.id);
      let status: "sms_required" | "confirmed";
      if (sl.status === "verified") {
        status = "confirmed";
      } else if (sl.needsSms) {
        status = "sms_required";
      } else {
        await storage.completeSubjectLink(sl.id, "email");
        await db.insert(auditLogs).values({
          userId: sl.userId, username: null, action: "SUBJECT_LINK_CONFIRMED",
          module: "SubjectLink", entityId: sl.subjectId, entityName: null,
          oldData: null, newData: { linkId: sl.id, via: "email" }, ipAddress: null,
        });
        // Dual audit: second record under SubjectContext for subject-side filtering
        await db.insert(auditLogs).values({
          userId: sl.userId, username: null, action: "SUBJECT_LINK_CONFIRMED",
          module: "SubjectContext", entityId: sl.subjectId, entityName: null,
          oldData: null, newData: { linkId: sl.id, via: "email", _subjectContext: { activeSubjectId: sl.subjectId, actingUserId: sl.userId, originalModule: "SubjectLink", originalEntityId: sl.subjectId } }, ipAddress: null,
        });
        status = "confirmed";
      }
      return res.json({
        linkId: sl.id, subjectToken, subjectName, subjectType: subject?.type ?? null, initiatorName,
        needsSms: sl.needsSms, emailConfirmed: true, smsConfirmed: sl.smsConfirmed,
        expiresAt: sl.expiresAt, status,
      });
    } catch (err) {
      console.error("[SUBJECT-CONFIRM GET]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // POST /api/account-link/subject-verify-sms — rate limited
  app.post("/api/account-link/subject-verify-sms", subjectSmsRateLimit, async (req, res) => {
    try {
      const { subjectToken, smsCode } = req.body;
      if (!subjectToken || !smsCode) return res.status(400).json({ message: "Chýba token alebo SMS kód" });
      const sl = await storage.getSubjectLinkByToken(subjectToken);
      if (!sl) return res.status(404).json({ message: "Token neexistuje" });
      if (sl.rejected) return res.status(410).json({ message: "Žiadosť bola odmietnutá" });
      if (new Date() > sl.expiresAt) return res.status(410).json({ message: "Platnosť tokenu vypršala" });
      if (!sl.emailConfirmed) return res.status(400).json({ message: "Najprv potvrďte email" });
      if (sl.smsConfirmed) { await storage.completeSubjectLink(sl.id, "email+sms"); return res.json({ status: "confirmed" }); }
      if (!sl.smsCode || smsCode.trim() !== sl.smsCode) return res.status(400).json({ message: "Nesprávny SMS kód" });
      await storage.confirmSubjectLinkSms(sl.id);
      await storage.completeSubjectLink(sl.id, "email+sms");
      await db.insert(auditLogs).values({
        userId: sl.userId, username: null, action: "SUBJECT_LINK_CONFIRMED",
        module: "SubjectLink", entityId: sl.subjectId, entityName: null,
        oldData: null, newData: { linkId: sl.id, via: "email+sms" }, ipAddress: null,
      });
      // Dual audit: second record under SubjectContext for subject-side filtering
      await db.insert(auditLogs).values({
        userId: sl.userId, username: null, action: "SUBJECT_LINK_CONFIRMED",
        module: "SubjectContext", entityId: sl.subjectId, entityName: null,
        oldData: null, newData: { linkId: sl.id, via: "email+sms", _subjectContext: { activeSubjectId: sl.subjectId, actingUserId: sl.userId, originalModule: "SubjectLink", originalEntityId: sl.subjectId } }, ipAddress: null,
      });
      return res.json({ status: "confirmed" });
    } catch (err) {
      console.error("[SUBJECT-VERIFY-SMS]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // POST /api/account-link/subject-reject — accepts subjectToken in body OR query param
  // For pending_confirmation links: sets status="rejected" (email-token rejection by subject)
  // For verified/active links: sets status="revoked" with revokedAt/revokedBy/revokedReason (subject-side revocation via token)
  app.post("/api/account-link/subject-reject", async (req, res) => {
    try {
      const subjectToken = req.body?.subjectToken || (req.query?.subjectToken as string | undefined);
      if (!subjectToken) return res.status(400).json({ message: "Chýba token" });
      const sl = await storage.getSubjectLinkByToken(subjectToken);
      if (!sl) return res.status(404).json({ message: "Token neexistuje" });
      if (sl.rejected || sl.status === "rejected") return res.json({ status: "already_rejected" });
      if (sl.status === "revoked") return res.json({ status: "already_revoked" });

      if (sl.status === "verified" && sl.isActive) {
        // Active link: subject revokes via token — use revoked status with audit fields
        await storage.revokeSubjectLink(sl.id, sl.userId, "revoked_by_subject_token");
        await db.insert(auditLogs).values({
          userId: sl.userId, username: null, action: "SUBJECT_LINK_REVOKED_BY_SUBJECT",
          module: "SubjectLink", entityId: sl.subjectId, entityName: null,
          oldData: null, newData: { linkId: sl.id, revokedReason: "revoked_by_subject_token" }, ipAddress: null,
        });
        // Dual audit: second record under SubjectContext for subject-side filtering
        await db.insert(auditLogs).values({
          userId: sl.userId, username: null, action: "SUBJECT_LINK_REVOKED_BY_SUBJECT",
          module: "SubjectContext", entityId: sl.subjectId, entityName: null,
          oldData: null, newData: { linkId: sl.id, revokedReason: "revoked_by_subject_token", _subjectContext: { activeSubjectId: sl.subjectId, actingUserId: sl.userId, originalModule: "SubjectLink", originalEntityId: sl.subjectId } }, ipAddress: null,
        });
        return res.json({ status: "revoked" });
      }

      // Pending link: reject by subject via email token
      await storage.rejectSubjectLink(sl.id);
      await db.insert(auditLogs).values({
        userId: sl.userId, username: null, action: "SUBJECT_LINK_REJECTED",
        module: "SubjectLink", entityId: sl.subjectId, entityName: null,
        oldData: null, newData: { linkId: sl.id }, ipAddress: null,
      });
      // Dual audit: second record under SubjectContext for subject-side filtering
      await db.insert(auditLogs).values({
        userId: sl.userId, username: null, action: "SUBJECT_LINK_REJECTED",
        module: "SubjectContext", entityId: sl.subjectId, entityName: null,
        oldData: null, newData: { linkId: sl.id, _subjectContext: { activeSubjectId: sl.subjectId, actingUserId: sl.userId, originalModule: "SubjectLink", originalEntityId: sl.subjectId } }, ipAddress: null,
      });
      return res.json({ status: "rejected" });
    } catch (err) {
      console.error("[SUBJECT-REJECT]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // GET /api/account-link/subject-list — list current user's subject links
  app.get("/api/account-link/subject-list", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const links = await storage.getSubjectLinksByUserId(req.session.userId);
      const nowTs = new Date();
      const enriched = await Promise.all(links.map(async (sl) => {
        const [subject] = await db.select({
          id: subjects.id, type: subjects.type, companyName: subjects.companyName,
          firstName: subjects.firstName, lastName: subjects.lastName, uid: subjects.uid, details: subjects.details,
        }).from(subjects).where(eq(subjects.id, sl.subjectId));
        const subjectName = subject?.companyName || [subject?.firstName, subject?.lastName].filter(Boolean).join(" ") || subject?.uid || "Neznámy";
        const ico = (subject?.details as { ico?: string } | null)?.ico ?? null;
        const isTemporallyExpired = !!(sl.validUntil && sl.validUntil <= nowTs);
        return {
          linkId: sl.id, subjectId: sl.subjectId, subjectName, subjectType: subject?.type ?? null,
          ico, uid: subject?.uid ?? null, status: sl.status, isActive: sl.isActive,
          needsSms: sl.needsSms, createdAt: sl.createdAt, verifiedAt: sl.verifiedAt,
          tokenExpired: nowTs > sl.expiresAt,
          validFrom: sl.validFrom ?? null,
          validUntil: sl.validUntil ?? null,
          isTemporallyExpired,
        };
      }));
      return res.json(enriched);
    } catch (err) {
      console.error("[SUBJECT-LIST]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // POST /api/subject-link/:id/revoke — revoke a subject link
  app.post("/api/subject-link/:id/revoke", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const linkId = Number(req.params.id);
      if (!linkId) return res.status(400).json({ message: "Neplatné ID" });
      const sl = await storage.getSubjectLinkById(linkId);
      if (!sl) return res.status(404).json({ message: "Prepojenie nenájdené" });
      if (sl.userId !== req.session.userId) {
        const [currentUser] = await db.select({ isAdmin: appUsers.isAdmin, role: appUsers.role }).from(appUsers).where(eq(appUsers.id, req.session.userId)).limit(1);
        const isAdminUser = currentUser?.isAdmin || currentUser?.role === "admin" || currentUser?.role === "superadmin" || currentUser?.role === "prezident" || currentUser?.role === "architekt";
        if (!isAdminUser) return res.status(403).json({ message: "Nie ste oprávnený zrušiť toto prepojenie" });
      }
      const { reason } = req.body;
      await storage.revokeSubjectLink(linkId, req.session.userId, reason);
      await db.insert(auditLogs).values({
        userId: getAuditActorId(req), username: null, action: "SUBJECT_LINK_REVOKED",
        module: "SubjectLink", entityId: sl.subjectId, entityName: null,
        oldData: null, newData: { linkId, reason: reason ?? null }, ipAddress: req.ip,
      });
      // Dual audit: second record under SubjectContext for subject-side filtering
      await db.insert(auditLogs).values({
        userId: getAuditActorId(req), username: null, action: "SUBJECT_LINK_REVOKED",
        module: "SubjectContext", entityId: sl.subjectId, entityName: null,
        oldData: null, newData: { linkId, reason: reason ?? null, _subjectContext: { activeSubjectId: sl.subjectId, actingUserId: getAuditActorId(req), originalModule: "SubjectLink", originalEntityId: sl.subjectId } }, ipAddress: req.ip,
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("[SUBJECT-LINK REVOKE]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // POST /api/subject-link/:id/reactivate — admin reactivate an expired/revoked subject link
  app.post("/api/subject-link/:id/reactivate", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const [currentUser] = await db.select({ isAdmin: appUsers.isAdmin, role: appUsers.role }).from(appUsers).where(eq(appUsers.id, req.session.userId)).limit(1);
      const isAdminUser = currentUser?.isAdmin || ["admin", "superadmin", "prezident", "architekt"].includes(currentUser?.role ?? "");
      if (!isAdminUser) return res.status(403).json({ message: "Len administrátor môže reaktivovať prepojenie" });
      const linkId = Number(req.params.id);
      if (!linkId) return res.status(400).json({ message: "Neplatné ID" });
      const sl = await storage.getSubjectLinkById(linkId);
      if (!sl) return res.status(404).json({ message: "Prepojenie nenájdené" });
      await storage.reactivateSubjectLink(linkId, req.session.userId);
      await db.insert(auditLogs).values({
        userId: getAuditActorId(req), username: null, action: "SUBJECT_LINK_REACTIVATED",
        module: "SubjectLink", entityId: sl.subjectId, entityName: null,
        oldData: { status: sl.status, isActive: sl.isActive }, newData: { linkId, reactivatedBy: req.session.userId }, ipAddress: req.ip,
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("[SUBJECT-LINK REACTIVATE]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // PATCH /api/subject-link/:id/validity — admin set validFrom/validUntil on a subject link
  app.patch("/api/subject-link/:id/validity", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const [currentUser] = await db.select({ isAdmin: appUsers.isAdmin, role: appUsers.role }).from(appUsers).where(eq(appUsers.id, req.session.userId)).limit(1);
      const isAdminUser = currentUser?.isAdmin || ["admin", "superadmin", "prezident", "architekt"].includes(currentUser?.role ?? "");
      if (!isAdminUser) return res.status(403).json({ message: "Len administrátor môže nastaviť platnosť prepojenia" });
      const linkId = Number(req.params.id);
      if (!linkId) return res.status(400).json({ message: "Neplatné ID" });
      const sl = await storage.getSubjectLinkById(linkId);
      if (!sl) return res.status(404).json({ message: "Prepojenie nenájdené" });
      const { validFrom, validUntil } = req.body;
      const parsedFrom = validFrom ? new Date(validFrom) : null;
      const parsedUntil = validUntil ? new Date(validUntil) : null;
      if (parsedFrom && isNaN(parsedFrom.getTime())) return res.status(400).json({ message: "Neplatný dátum validFrom" });
      if (parsedUntil && isNaN(parsedUntil.getTime())) return res.status(400).json({ message: "Neplatný dátum validUntil" });
      if (parsedFrom && parsedUntil && parsedFrom >= parsedUntil) return res.status(400).json({ message: "validFrom musí byť pred validUntil" });
      await storage.updateSubjectLinkValidity(linkId, parsedFrom, parsedUntil);
      await db.insert(auditLogs).values({
        userId: getAuditActorId(req), username: null, action: "SUBJECT_LINK_VALIDITY_UPDATED",
        module: "SubjectLink", entityId: sl.subjectId, entityName: null,
        oldData: { validFrom: sl.validFrom, validUntil: sl.validUntil },
        newData: { linkId, validFrom: parsedFrom, validUntil: parsedUntil }, ipAddress: req.ip,
      });
      return res.json({ success: true });
    } catch (err) {
      console.error("[SUBJECT-LINK VALIDITY]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // GET /api/admin/all-links — admin: unified view of all link types in system
  app.get("/api/admin/all-links", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const [currentUser] = await db.select({ isAdmin: appUsers.isAdmin, role: appUsers.role }).from(appUsers).where(eq(appUsers.id, req.session.userId));
      const isAdminUser = currentUser?.isAdmin || ["admin", "superadmin", "prezident", "architekt"].includes(currentUser?.role ?? "");
      if (!isAdminUser) return res.status(403).json({ message: "Prístup zamietnutý" });

      // Fetch subject links (user ↔ subject)
      const allSubjectLinks = await db.select().from(subjectLinks).orderBy(desc(subjectLinks.createdAt)).limit(500);
      const subjectRows = await Promise.all(allSubjectLinks.map(async (sl) => {
        const [subject] = await db.select({
          id: subjects.id, type: subjects.type, companyName: subjects.companyName,
          firstName: subjects.firstName, lastName: subjects.lastName, uid: subjects.uid,
        }).from(subjects).where(eq(subjects.id, sl.subjectId));
        const [user] = await db.select({ firstName: appUsers.firstName, lastName: appUsers.lastName, email: appUsers.email, username: appUsers.username }).from(appUsers).where(eq(appUsers.id, sl.userId));
        const subjectName = subject?.companyName || [subject?.firstName, subject?.lastName].filter(Boolean).join(" ") || subject?.uid || "Neznámy";
        const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || user.email || "Neznámy" : "Neznámy";
        return {
          rowId: `sl-${sl.id}`, linkCategory: "subject" as const,
          linkId: sl.id, userId: sl.userId, userName, userEmail: user?.email ?? null,
          primaryUserName: userName, primaryUserEmail: user?.email ?? null,
          linkedUserName: null as string | null, linkedUserEmail: null as string | null,
          subjectId: sl.subjectId, subjectName, subjectType: subject?.type ?? null,
          status: sl.status, isActive: sl.isActive, createdAt: sl.createdAt, verifiedAt: sl.verifiedAt,
          revokedAt: sl.revokedAt, revokedReason: sl.revokedReason,
          validFrom: sl.validFrom ?? null, validUntil: sl.validUntil ?? null,
          linkType: "subject" as const,
        };
      }));

      // Fetch account links (user ↔ user: guardian / same_person)
      const allAccountLinks = await db.select().from(accountLinks).orderBy(desc(accountLinks.createdAt)).limit(500);
      const accountRows = await Promise.all(allAccountLinks.map(async (al) => {
        const [primary] = await db.select({ firstName: appUsers.firstName, lastName: appUsers.lastName, email: appUsers.email, username: appUsers.username }).from(appUsers).where(eq(appUsers.id, al.primaryUserId));
        const [linked] = await db.select({ firstName: appUsers.firstName, lastName: appUsers.lastName, email: appUsers.email, username: appUsers.username }).from(appUsers).where(eq(appUsers.id, al.linkedUserId));
        const primaryName = primary ? `${primary.firstName || ""} ${primary.lastName || ""}`.trim() || primary.username || primary.email || "Neznámy" : "Neznámy";
        const linkedName = linked ? `${linked.firstName || ""} ${linked.lastName || ""}`.trim() || linked.username || linked.email || "Neznámy" : "Neznámy";
        return {
          rowId: `al-${al.id}`, linkCategory: al.linkType === "guardian" ? "guardian" as const : "same_person" as const,
          linkId: al.id, userId: al.primaryUserId, userName: primaryName, userEmail: primary?.email ?? null,
          primaryUserName: primaryName, primaryUserEmail: primary?.email ?? null,
          linkedUserName: linkedName, linkedUserEmail: linked?.email ?? null,
          subjectId: null as number | null, subjectName: null as string | null, subjectType: null as string | null,
          status: al.status, isActive: al.isActive, createdAt: al.createdAt, verifiedAt: al.verifiedAt,
          revokedAt: al.revokedAt, revokedReason: al.revokedReason,
          linkType: al.linkType as string,
        };
      }));

      const allRows = [...subjectRows, ...accountRows].sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );
      return res.json(allRows);
    } catch (err) {
      console.error("[ADMIN ALL-LINKS]", err);
      res.status(500).json({ message: "Interná chyba" });
    }
  });

  // GET /api/admin/subject-links — admin: all subject links in system (kept for backward compat)
  app.get("/api/admin/subject-links", async (req, res) => {
    try {
      if (!req.session.userId || req.session.loginStep !== "done") {
        return res.status(401).json({ message: "Neautorizovaný prístup" });
      }
      const [currentUser] = await db.select({ isAdmin: appUsers.isAdmin, role: appUsers.role }).from(appUsers).where(eq(appUsers.id, req.session.userId));
      const isAdminUserB = currentUser?.isAdmin || ["admin", "superadmin", "prezident", "architekt"].includes(currentUser?.role ?? "");
      if (!isAdminUserB) return res.status(403).json({ message: "Prístup zamietnutý" });
      const allLinks = await db.select().from(subjectLinks).orderBy(desc(subjectLinks.createdAt)).limit(500);
      const enriched = await Promise.all(allLinks.map(async (sl) => {
        const [subject] = await db.select({
          id: subjects.id, type: subjects.type, companyName: subjects.companyName,
          firstName: subjects.firstName, lastName: subjects.lastName, uid: subjects.uid,
        }).from(subjects).where(eq(subjects.id, sl.subjectId));
        const [user] = await db.select({ firstName: appUsers.firstName, lastName: appUsers.lastName, email: appUsers.email, username: appUsers.username }).from(appUsers).where(eq(appUsers.id, sl.userId));
        const subjectName = subject?.companyName || [subject?.firstName, subject?.lastName].filter(Boolean).join(" ") || subject?.uid || "Neznámy";
        const userName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || user.email || "Neznámy" : "Neznámy";
        return {
          linkId: sl.id, userId: sl.userId, userName, userEmail: user?.email ?? null,
          subjectId: sl.subjectId, subjectName, subjectType: subject?.type ?? null,
          status: sl.status, isActive: sl.isActive, createdAt: sl.createdAt, verifiedAt: sl.verifiedAt,
          revokedAt: sl.revokedAt, revokedReason: sl.revokedReason,
        };
      }));
      return res.json(enriched);
    } catch (err) {
      console.error("[ADMIN SUBJECT-LINKS]", err);
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

/**
 * Returns the "real" audit actor user ID for the current session.
 * When a guardian is operating on a managed account,
 * this returns the guardian's user ID (the true actor),
 * not the managed user's ID stored in req.session.userId.
 * Use this in audit log writes to correctly attribute guardian actions.
 */
export function getAuditActorId(req: { session: { userId?: number; guardianSwitchedFromUserId?: number } }): number {
  return req.session.guardianSwitchedFromUserId ?? req.session.userId ?? 0;
}

/**
 * Centralized audit log write with automatic guardian actor attribution.
 * When a guardian is operating in a managed account, the guardian's userId is
 * used as the actor (not the managed user). Pass `req` for session-aware attribution.
 *
 * Usage: await writeAuditLog(req, { action: "ENTITY_UPDATED", module: "subjects", entityId: 42, ... });
 */
export async function writeAuditLog(
  req: { session: { userId?: number; guardianSwitchedFromUserId?: number }; ip?: string },
  params: {
    action: string;
    module: string;
    entityId?: number | null;
    entityName?: string | null;
    oldData?: unknown;
    newData?: unknown;
  }
): Promise<void> {
  const actorId = getAuditActorId(req);
  const baseEntry = {
    username: null as null,
    action: params.action,
    module: params.module,
    entityId: params.entityId ?? null,
    entityName: params.entityName ?? null,
    oldData: params.oldData ?? null,
    newData: params.newData ?? null,
    ipAddress: req.ip ?? null,
  };
  // Write user-side audit entry (actor record)
  await db.insert(auditLogs).values({ ...baseEntry, userId: actorId });

  // Dual audit: if user is currently acting in a subject context, write a second entry
  // where entityId = activeSubjectId and module = "SubjectContext" so that subject-side
  // audit trail can be filtered independently by entityId without additional schema changes.
  const currentUserId = req.session.userId;
  if (currentUserId) {
    const [userRow] = await db
      .select({ activeSubjectId: appUsers.activeSubjectId })
      .from(appUsers)
      .where(eq(appUsers.id, currentUserId))
      .limit(1);
    if (userRow?.activeSubjectId) {
      await db.insert(auditLogs).values({
        username: null,
        action: params.action,
        // Subject-context record: entityId identifies the subject, module scoped to SubjectContext
        module: "SubjectContext",
        entityId: userRow.activeSubjectId,
        entityName: params.entityName ?? null,
        oldData: params.oldData ?? null,
        newData: {
          ...(typeof params.newData === "object" && params.newData !== null ? params.newData : { value: params.newData }),
          _subjectContext: {
            activeSubjectId: userRow.activeSubjectId,
            actingUserId: actorId,
            originalModule: params.module,
            originalEntityId: params.entityId ?? null,
          },
        },
        userId: actorId,
        ipAddress: req.ip ?? null,
      });
    }
  }
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
