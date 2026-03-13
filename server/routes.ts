import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, isAuthenticated } from "./auth";
import { z } from "zod";
import { continents, states, myCompanies, appUsers, clientTypes, clientSubGroups, clientGroupMembers, productFolderAssignments, folderPanels, panelParameters, userClientGroupMemberships, clientGroups, permissionGroups, insertCareerLevelSchema, insertProductPointRateSchema, careerLevels, importLogs, commissions, contracts, contractStatuses, contractStatusChangeLogs, clientDataTabs, clientDataCategories, subjects, subjectPointsLog, subjectFieldHistory, subjectCollaborators, clientMarketingConsents, clientDocumentHistory, contractAcquirers, contractPasswords, contractRewardDistributions, contractParameterValues, subjectArchive, auditLogs, globalCounters, subjectPhotos, activityEvents, subjectParamSections, subjectParameters, subjectTemplates, subjectTemplateParams, commissionCalculationLogs, parameterSynonyms, dataConflictAlerts, transactionDedupLog, relationRoleTypes, subjectRelations, maturityAlerts, inheritancePrompts, guardianshipArchive, households, householdMembers, householdAssets, privacyBlocks, accessConsentLog, maturityEvents, addressGroups, addressGroupMembers, companySubjectRoles, notificationQueue, batchJobs, subjectObjects, objectDataSources, sectors, sections, sectorProducts, parameters, panels, productPanels, contractFolders, fieldLayoutConfigs, sectorCategoryMapping, suggestedRelations, statusEvidence, contractLifecycleHistory, systemNotifications, partners, products, contractInventories, contractTemplates, redListAlerts, subjectAddresses, divisions, companyDivisions, insertDivisionSchema, ocrProcessingJobs, networkLinks, guarantorTransferRequests, nbsReportStatuses, nbsPartnerReports, supisky, supiskaContracts, lifecyclePhaseConfigs, registrySnapshots } from "@shared/schema";
import type { DocEntry } from "@shared/schema";
import { notifyObjectionCreated, notifyPreDeletion, getProductDaysLimits } from "./email";
import { seedSubjectParameters, seedAssetPanels, seedEventAndEntityPanels } from "./seed-subject-params";
import sharp from "sharp";
import { db } from "./db";
import { eq, and, or, isNull, isNotNull, sql, inArray, desc, asc, gte, lte, lt } from "drizzle-orm";
import multer from "multer";
import ExcelJS from "exceljs";
import { parse as csvParse } from "csv-parse/sync";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { encryptField, decryptField } from "./crypto";
import { detectAmbiguousName } from "./name-parser";
import { validateSlovakRC } from "@shared/rc-validator";
import { validateSlovakICO } from "@shared/ico-validator";
import { scanUploadedFile, scanMultipleFiles, sanitizeExcelWorkbook, checkClamAvStatus } from "./services/file-security";

function stripBallast(str: string): string {
  return str.replace(/[\s\-\+\(\)\/\.]/g, "");
}

async function isFirstContractInDivision(uploadedByUserId: number, divisionId: number | null, companyId: number | null): Promise<boolean> {
  if (!divisionId || !companyId) return false;
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int as count FROM contracts 
      WHERE uploaded_by_user_id = ${uploadedByUserId}
      AND company_id = ${companyId}
      AND is_deleted = false
    `);
    const count = (result as any).rows?.[0]?.count || 0;
    return count === 0;
  } catch {
    return false;
  }
}


async function isMigrationModeOn(): Promise<boolean> {
  try {
    const val = await storage.getSystemSetting("MIGRATION_MODE");
    return val === "ON";
  } catch {
    return false;
  }
}

function formatDateTimeSK(date?: Date): string {
  const d = date || new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}:${seconds}`;
}

function formatTimestampForFile(date?: Date): string {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}_${h}${min}${sec}`;
}

function normalizeExtractedDate(value: string): string {
  if (!value) return value;
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoMatch) {
    const [, y, m, d, h, min, sec] = isoMatch;
    return `${d}.${m}.${y} ${h || '00'}:${min || '00'}:${sec || '00'}`;
  }
  const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (usMatch) {
    const [, m, d, y, h, min, sec] = usMatch;
    return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y} ${h || '00'}:${min || '00'}:${sec || '00'}`;
  }
  const skMatch = value.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (skMatch) {
    const [, d, m, y, h, min, sec] = skMatch;
    return `${d.padStart(2, '0')}.${m.padStart(2, '0')}.${y} ${h || '00'}:${min || '00'}:${sec || '00'}`;
  }
  return value;
}

async function logAudit(req: any, params: {
  action: string;
  module: string;
  entityId?: number;
  entityName?: string;
  oldData?: any;
  newData?: any;
  processingTimeSec?: number;
}) {
  try {
    const migrationOn = await isMigrationModeOn();
    let appUser: any = req.appUser || null;
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const clientProcessingTime = req.body?.processingTimeSec ? Number(req.body.processingTimeSec) : 0;
    const serverTimeSec = req._auditStartTime ? Math.round((performance.now() - req._auditStartTime) / 1000) : 0;
    const processingTime = params.processingTimeSec || clientProcessingTime || serverTimeSec;

    const isImpersonating = !!req.originalAppUser;
    const impersonationMeta = isImpersonating ? {
      _impersonatedBy: {
        architectId: req.originalAppUser.id,
        architectUsername: req.originalAppUser.username,
      }
    } : {};

    const newDataWithImpersonation = params.newData
      ? { ...params.newData, ...impersonationMeta }
      : (isImpersonating ? impersonationMeta : null);

    const now = new Date();
    const auditEntry = {
      userId: migrationOn ? null : (appUser?.id || null),
      username: migrationOn ? "Systémový import" : (isImpersonating
        ? `${appUser?.username || 'unknown'} [simulovaný Architektom ${req.originalAppUser.username}]`
        : (appUser?.username || 'system')),
      action: params.action,
      module: params.module,
      entityId: params.entityId || null,
      entityName: params.entityName || null,
      oldData: params.oldData || null,
      newData: newDataWithImpersonation,
      processingTimeSec: processingTime,
      ipAddress: migrationOn ? "migration" : (typeof ip === 'string' ? ip : JSON.stringify(ip)),
      createdAt: now,
    };
    await storage.createAuditLog({ ...auditEntry, integrityHash: null });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

function capitalizeName(name: string | null | undefined): string | null {
  if (!name || !name.trim()) return name ?? null;
  return name.trim().replace(/\S+/g, word => word.charAt(0).toUpperCase() + word.slice(1));
}

const TITLE_NORMALIZE_MAP_BE: Record<string, string> = {
  "bc": "Bc.", "bc.": "Bc.",
  "ing": "Ing.", "ing.": "Ing.",
  "ing. arch.": "Ing. arch.", "ing.arch.": "Ing. arch.", "ing. arch": "Ing. arch.", "ingarch": "Ing. arch.",
  "mgr": "Mgr.", "mgr.": "Mgr.",
  "mgr. art.": "Mgr. art.", "mgr.art.": "Mgr. art.", "mgr. art": "Mgr. art.",
  "mudr": "MUDr.", "mudr.": "MUDr.",
  "mvdr": "MVDr.", "mvdr.": "MVDr.",
  "mddr": "MDDr.", "mddr.": "MDDr.",
  "phdr": "PhDr.", "phdr.": "PhDr.",
  "rndr": "RNDr.", "rndr.": "RNDr.",
  "judr": "JUDr.", "judr.": "JUDr.",
  "paeddr": "PaedDr.", "paeddr.": "PaedDr.", "paed. dr.": "PaedDr.", "paed.dr.": "PaedDr.",
  "thdr": "ThDr.", "thdr.": "ThDr.",
  "thlic": "ThLic.", "thlic.": "ThLic.",
  "dr": "Dr.", "dr.": "Dr.",
  "phmr": "PhMr.", "phmr.": "PhMr.",
  "pharmdr": "PharmDr.", "pharmdr.": "PharmDr.",
  "doc": "Doc.", "doc.": "Doc.", "docent": "Doc.",
  "prof": "Prof.", "prof.": "Prof.", "profesor": "Prof.",
  "dipl": "Dipl.", "dipl.": "Dipl.",
  "phd": "PhD.", "phd.": "PhD.",
  "csc": "CSc.", "csc.": "CSc.",
  "drsc": "DrSc.", "drsc.": "DrSc.",
  "mba": "MBA", "mpa": "MPA",
  "msc": "MSc.", "msc.": "MSc.",
  "bsc": "BSc.", "bsc.": "BSc.",
  "dis": "DiS.", "dis.": "DiS.",
  "dis.art": "DiS.art.", "dis.art.": "DiS.art.",
  "mph": "MPH",
  "ll.m": "LL.M.", "ll.m.": "LL.M.", "llm": "LL.M.",
  "mha": "MHA",
  "artd": "ArtD.", "artd.": "ArtD.",
};

function normalizeTitleBe(raw: string | null | undefined): string | null {
  if (!raw || !raw.trim()) return raw ?? null;
  const parts = raw.trim().split(/\s+/);
  const canonical: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (TITLE_NORMALIZE_MAP_BE[key]) {
      canonical.push(TITLE_NORMALIZE_MAP_BE[key]);
    } else {
      const wholeKey = raw.trim().toLowerCase();
      if (TITLE_NORMALIZE_MAP_BE[wholeKey]) return TITLE_NORMALIZE_MAP_BE[wholeKey];
      return raw.trim();
    }
  }
  return canonical.join(" ");
}

function isArchitekt(appUser: any): boolean {
  return appUser?.role === 'architekt';
}

function hasAdminAccess(appUser: any): boolean {
  return appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident' || appUser?.role === 'architekt';
}

function isAdmin(appUser: any): boolean {
  if (!appUser) return false;
  return appUser.role === 'admin' || appUser.role === 'superadmin' || appUser.role === 'prezident' || appUser.role === 'architekt';
}

function isSubjectOwner(appUser: any, subject: any): boolean {
  if (!appUser || !subject) return false;
  if (subject.uploadedByUserId === appUser.id) return true;
  if (appUser.linkedSubjectId && appUser.linkedSubjectId === subject.id) return true;
  return false;
}

async function isInManagerChain(appUserId: number, uploadedByUserId: number | null, companyId?: number | null): Promise<boolean> {
  if (!uploadedByUserId || !appUserId) return false;
  if (uploadedByUserId === appUserId) return true;
  const allUsers = await storage.getAppUsers();
  const userMap = new Map<number, { managerId: number | null; companyId: number | null }>();
  for (const u of allUsers) {
    userMap.set(u.id, { managerId: (u as any).managerId ?? null, companyId: (u as any).activeCompanyId ?? null });
  }
  const appUserEntry = userMap.get(appUserId);
  const effectiveCompanyId = companyId ?? appUserEntry?.companyId ?? null;
  let currentId: number | null = uploadedByUserId;
  const visited = new Set<number>();
  for (let depth = 0; depth < 10 && currentId != null; depth++) {
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const entry = userMap.get(currentId);
    if (!entry) break;
    if (effectiveCompanyId && entry.companyId && entry.companyId !== effectiveCompanyId) break;
    if (entry.managerId === appUserId) return true;
    currentId = entry.managerId;
  }
  return false;
}

async function isSubjectAccessible(appUser: any, subject: any): Promise<boolean> {
  if (!appUser || !subject) return false;
  if (isSubjectOwner(appUser, subject)) return true;
  return isInManagerChain(appUser.id, subject.uploadedByUserId, subject.companyId || appUser.activeCompanyId);
}

function decryptBirthNumber(subject: any): any {
  if (!subject) return subject;
  const decrypted = subject.birthNumber ? decryptField(subject.birthNumber) : null;
  return { ...subject, birthNumber: decrypted || subject.birthNumber };
}

function checkIpRestriction(req: any, appUser: any): { allowed: boolean; clientIp?: string } {
  if (!appUser?.allowedIps) return { allowed: true };
  const ipList = appUser.allowedIps.split(/[,\n]/).map((ip: string) => ip.trim()).filter(Boolean);
  if (ipList.length === 0) return { allowed: true };
  const clientIp = (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  const allowed = ipList.some((ip: string) => {
    const normalizedAllowed = ip.replace(/^::ffff:/, '').trim();
    return clientIp === normalizedAllowed;
  });
  return { allowed, clientIp };
}


async function isKlientiUser(appUser: any): Promise<boolean> {
  if (!appUser?.permissionGroupId) return false;
  const [pg] = await db.select().from(permissionGroups).where(eq(permissionGroups.id, appUser.permissionGroupId));
  return pg?.name === 'Klienti';
}

async function checkKlientiSubjectAccess(appUser: any, subjectId: number): Promise<boolean> {
  if (!await isKlientiUser(appUser)) return true;
  if (appUser.linkedSubjectId === subjectId) return true;

  const guardianWardLink = await db.select({ id: subjectRelations.id })
    .from(subjectRelations)
    .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
    .where(and(
      eq(subjectRelations.sourceSubjectId, appUser.linkedSubjectId),
      eq(subjectRelations.targetSubjectId, subjectId),
      eq(subjectRelations.isActive, true),
      eq(relationRoleTypes.category, "rodina"),
      sql`${relationRoleTypes.code} IN ('rodic_zakonny_zastupca', 'stary_rodic')`
    ))
    .limit(1);

  if (guardianWardLink.length === 0) return false;

  // Privacy Trigger: if ward is 18+, check for explicit consent
  const [ward] = await db.select({ details: subjects.details }).from(subjects).where(eq(subjects.id, subjectId));
  if (ward) {
    const dyn = (ward.details as any)?.dynamicFields || (ward.details as any) || {};
    const dob = dyn.datum_narodenia || dyn.p_datum_nar;
    if (dob) {
      const dobDate = new Date(dob);
      const now = new Date();
      let age = now.getFullYear() - dobDate.getFullYear();
      if (now.getMonth() < dobDate.getMonth() || (now.getMonth() === dobDate.getMonth() && now.getDate() < dobDate.getDate())) age--;
      if (age >= 18) {
        // Check for explicit post-maturity consent
        const consent = await db.select({ id: accessConsentLog.id })
          .from(accessConsentLog)
          .where(and(
            eq(accessConsentLog.grantorSubjectId, subjectId),
            eq(accessConsentLog.granteeSubjectId, appUser.linkedSubjectId),
            eq(accessConsentLog.consentType, "post_maturity_sharing"),
            eq(accessConsentLog.isActive, true)
          ))
          .limit(1);
        // If 18+ and no consent, restrict sensitive data (but still allow basic access)
        // The actual filtering happens in subject detail endpoints
        if (consent.length === 0) {
          (appUser as any)._privacyRestricted = true;
        }
      }
    }
  }

  return true;
}

const PRIVACY_SENSITIVE_PREFIXES = ["eko_", "aml_", "dok_", "inv_", "zdr_"];

function applyPrivacyFilter(subjectData: any, appUser: any): any {
  if (!(appUser as any)?._privacyRestricted) return subjectData;
  const filtered = { ...subjectData };
  if (filtered.details) {
    const details = { ...filtered.details };
    const dyn = details.dynamicFields ? { ...details.dynamicFields } : { ...details };
    for (const key of Object.keys(dyn)) {
      if (PRIVACY_SENSITIVE_PREFIXES.some(p => key.startsWith(p))) {
        dyn[key] = "[CHRÁNENÉ]";
      }
    }
    if (details.dynamicFields) {
      details.dynamicFields = dyn;
    }
    filtered.details = details;
  }
  filtered.birthNumber = filtered.birthNumber ? "***" : null;
  filtered.email = filtered.email ? "[CHRÁNENÉ]" : null;
  filtered.phone = filtered.phone ? "[CHRÁNENÉ]" : null;
  filtered._privacyRestricted = true;
  return filtered;
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(path.join(UPLOADS_DIR, "official"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "work"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "logos"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "amendments"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "profiles"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "flags"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "status-change-docs"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "subject-photos"), { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const section = (req.params as any).section || (req as any)._uploadSection;
    const validDirs = ["official", "work", "logos", "amendments", "profiles", "flags", "status-change-docs", "subject-photos", "datova-linka"];
    const dir = validDirs.includes(section) ? section : "official";
    cb(null, path.join(UPLOADS_DIR, dir));
  },
  filename: (_req, file, cb) => {
    const ts = formatTimestampForFile();
    const rnd = Math.round(Math.random() * 1e4);
    const ext = path.extname(file.originalname);
    cb(null, `${ts}_${rnd}${ext}`);
  },
});

const ALLOWED_FILE_TYPES: Record<string, Set<string>> = {
  ".jpg":  new Set(["image/jpeg"]),
  ".jpeg": new Set(["image/jpeg"]),
  ".png":  new Set(["image/png"]),
  ".gif":  new Set(["image/gif"]),
  ".webp": new Set(["image/webp"]),
  ".bmp":  new Set(["image/bmp"]),
  ".pdf":  new Set(["application/pdf"]),
  ".doc":  new Set(["application/msword"]),
  ".docx": new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]),
  ".xls":  new Set(["application/vnd.ms-excel"]),
  ".xlsx": new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]),
  ".csv":  new Set(["text/csv", "application/vnd.ms-excel", "text/plain"]),
  ".json": new Set(["application/json", "text/plain"]),
  ".ppt":  new Set(["application/vnd.ms-powerpoint"]),
  ".pptx": new Set(["application/vnd.openxmlformats-officedocument.presentationml.presentation"]),
  ".mp4":  new Set(["video/mp4"]),
  ".mov":  new Set(["video/quicktime"]),
  ".avi":  new Set(["video/x-msvideo"]),
  ".mkv":  new Set(["video/x-matroska"]),
  ".webm": new Set(["video/webm"]),
};

const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm"]);

function canUploadVideo(appUser: any): boolean {
  if (!appUser) return false;
  return isAdmin(appUser) || appUser.role === 'agent';
}

const fileFilterFn = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedMimes = ALLOWED_FILE_TYPES[ext];
  if (!allowedMimes || !allowedMimes.has(file.mimetype)) {
    cb(new Error(`Nepovolený typ súboru: ${ext} (${file.mimetype})`));
    return;
  }
  if (VIDEO_EXTENSIONS.has(ext) && !canUploadVideo((_req as any).appUser)) {
    cb(new Error(`Nahrávanie video súborov (${ext}) je povolené iba pre administrátorov a agentov.`));
    return;
  }
  cb(null, true);
};

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: fileFilterFn,
});

const contractDocsUpload = multer({
  storage: uploadStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: fileFilterFn,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const LIFECYCLE_PHASES: Record<number, string> = {
    1: "Nahratá - čaká na odoslanie",
    2: "Odoslané na sprievodke",
    3: "Neprijaté zmluvy – výhrady",
    4: "Archív zmlúv (s výhradami)",
    5: "Prijaté do centrály",
    6: "Kontrakt v spracovaní",
    7: "Interné intervencie ku zmluve",
    8: "Manuálna kontrola kontraktov",
    9: "Odoslané obch. partnerovi",
    10: "Prijaté obch. partnerom",
  };

  async function logLifecycleStatusChange(contractId: number, statusId: number | null, phase: number, userId: number | null) {
    if (statusId == null) return;
    await db.insert(contractStatusChangeLogs).values({
      contractId,
      oldStatusId: statusId,
      newStatusId: statusId,
      changedByUserId: userId,
      statusNote: `Fáza: ${LIFECYCLE_PHASES[phase] || `Fáza ${phase}`}`,
    });
  }

  await setupAuth(app);

  (async () => {
    try {
      const existingConfigs = await db.select().from(lifecyclePhaseConfigs);
      const existingPhases = new Set(existingConfigs.map(c => c.phase));
      const missing = Object.entries(LIFECYCLE_PHASES)
        .filter(([id]) => !existingPhases.has(Number(id)))
        .map(([id, name]) => ({ phase: Number(id), name, color: "#3b82f6" }));
      if (missing.length > 0) {
        await db.insert(lifecyclePhaseConfigs).values(missing);
        console.log("[SEED] Lifecycle phase configs seeded:", missing.length, "missing phases");
      }
    } catch (err) {
      console.error("[SEED] Lifecycle phase configs seed error:", err);
    }
  })();

  seedAssetPanels().catch(err => console.error("[SEED-ASSETS ERROR]", err));
  seedEventAndEntityPanels().catch(err => console.error("[SEED-EVENTS ERROR]", err));

  (async () => {
    try {
      const [existing] = await db.select().from(globalCounters).where(eq(globalCounters.counterName, 'master_root_sk'));
      if (!existing) {
        await db.insert(globalCounters).values({ counterName: 'master_root_sk', currentValue: 421000000000000 });
        console.log("[SEED] Master Root SK (421 000 000 000 000) seeded into global_counters");
      }
      const czStates = await db.select().from(states).where(eq(states.code, '420'));
      for (const czState of czStates) {
        await db.update(states).set({ isActive: false }).where(eq(states.id, czState.id));
        console.log(`[SEED] Deactivated CZ state (code 420), id=${czState.id}`);
      }
    } catch (err) {
      console.error("[SEED] Master Root / CZ deactivation error:", err);
    }
  })();

  app.use((req: any, _res, next) => {
    req._auditStartTime = performance.now();
    next();
  });

  app.use(async (req: any, _res, next) => {
    try {
      if (req.session?.userId) {
        const [appUser] = await db.select().from(appUsers).where(eq(appUsers.id, req.session.userId));
        if (appUser) {
          if (appUser.impersonatingUserId && !isArchitekt(appUser)) {
            await db.update(appUsers).set({ impersonatingUserId: null }).where(eq(appUsers.id, appUser.id));
            appUser.impersonatingUserId = null;
          }
          if (appUser.impersonatingUserId && isArchitekt(appUser)) {
            const [impersonated] = await db.select().from(appUsers).where(eq(appUsers.id, appUser.impersonatingUserId));
            if (impersonated) {
              req.originalAppUser = appUser;
              req.appUser = impersonated;
            } else {
              await db.update(appUsers).set({ impersonatingUserId: null }).where(eq(appUsers.id, appUser.id));
              req.appUser = appUser;
            }
          } else {
            req.appUser = appUser;
          }
        }
      }
    } catch (err) {
    }
    next();
  });

  app.use((req: any, res: any, next: any) => {
    if (!req.appUser) return next();
    const { allowed, clientIp } = checkIpRestriction(req, req.appUser);
    if (!allowed) {
      console.warn(`[IP LOCK] Blocked ${clientIp} for user ${req.appUser.username} (allowed: ${req.appUser.allowedIps})`);
      return res.status(403).json({ message: `Prístup z tejto lokality je zakázaný` });
    }
    next();
  });

  app.get("/api/lifecycle-phases", isAuthenticated, async (_req, res) => {
    try {
      const configs = await db.select().from(lifecyclePhaseConfigs).orderBy(asc(lifecyclePhaseConfigs.phase));
      const configMap = new Map(configs.map(c => [c.phase, c]));
      const result = Object.entries(LIFECYCLE_PHASES).map(([id, name]) => {
        const phaseNum = Number(id);
        const cfg = configMap.get(phaseNum);
        return cfg || { id: phaseNum, phase: phaseNum, name, color: "#3b82f6", isCommissionable: false, isFinal: false, definesContractEnd: false, isIntervention: false, isStorno: false, notifyEnabled: false, notifyChannel: null, notifySubject: null, notifyTemplate: null };
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.put("/api/lifecycle-phase-configs/:phase", isAuthenticated, async (req: any, res) => {
    try {
      if (!req.appUser || !["admin", "superadmin", "prezident", "architekt"].includes(req.appUser.role)) {
        return res.status(403).json({ message: "Nedostatočné oprávnenia" });
      }
      const phase = Number(req.params.phase);
      if (!LIFECYCLE_PHASES[phase]) {
        return res.status(400).json({ message: "Neplatná fáza" });
      }
      const { color, isCommissionable, isFinal, definesContractEnd, isIntervention, isStorno, notifyEnabled, notifyChannel, notifySubject, notifyTemplate } = req.body;
      const validChannels = ["email", "sms", "both", null];
      if (notifyChannel !== undefined && !validChannels.includes(notifyChannel)) {
        return res.status(400).json({ message: "Neplatný kanál notifikácie" });
      }
      const [existing] = await db.select().from(lifecyclePhaseConfigs).where(eq(lifecyclePhaseConfigs.phase, phase));
      if (!existing) {
        const [created] = await db.insert(lifecyclePhaseConfigs).values({
          phase,
          name: LIFECYCLE_PHASES[phase],
          color: color || "#3b82f6",
          isCommissionable: isCommissionable ?? false,
          isFinal: isFinal ?? false,
          definesContractEnd: definesContractEnd ?? false,
          isIntervention: isIntervention ?? false,
          isStorno: isStorno ?? false,
          notifyEnabled: notifyEnabled ?? false,
          notifyChannel: notifyChannel || null,
          notifySubject: notifySubject || null,
          notifyTemplate: notifyTemplate || null,
        }).returning();
        return res.json(created);
      }
      const [updated] = await db.update(lifecyclePhaseConfigs).set({
        color: color ?? existing.color,
        isCommissionable: isCommissionable ?? existing.isCommissionable,
        isFinal: isFinal ?? existing.isFinal,
        definesContractEnd: definesContractEnd ?? existing.definesContractEnd,
        isIntervention: isIntervention ?? existing.isIntervention,
        isStorno: isStorno ?? existing.isStorno,
        notifyEnabled: notifyEnabled ?? existing.notifyEnabled,
        notifyChannel: notifyChannel !== undefined ? notifyChannel : existing.notifyChannel,
        notifySubject: notifySubject !== undefined ? notifySubject : existing.notifySubject,
        notifyTemplate: notifyTemplate !== undefined ? notifyTemplate : existing.notifyTemplate,
      }).where(eq(lifecyclePhaseConfigs.phase, phase)).returning();
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.get("/api/system/db-status", isAuthenticated, async (_req: any, res) => {
    try {
      const dbUrl = process.env.DATABASE_URL || "";
      let host = "unknown";
      let database = "unknown";

      try {
        const url = new URL(dbUrl);
        host = url.hostname;
        database = url.pathname.replace(/^\//, "") || "unknown";
      } catch {}

      await db.execute(sql`SELECT 1`);

      return res.json({ host, database, status: "connected" });
    } catch (err: any) {
      return res.json({ host: "unknown", database: "unknown", status: "disconnected" });
    }
  });

  app.use((req: any, res: any, next: any) => {
    if (!req.appUser) return next();
    if (req.method === "DELETE" && req.path.startsWith("/api/audit-logs")) {
      return res.status(403).json({ message: "Vymazanie auditných záznamov je zakázané." });
    }
    next();
  });

  app.get("/api/subjects/count", isAuthenticated, async (req: any, res: any) => {
    try {
      const user = req.appUser;
      const conditions: any[] = [eq(subjects.isActive, true)];
      if (user?.activeCompanyId) conditions.push(eq(subjects.myCompanyId, user.activeCompanyId));
      const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(subjects).where(and(...conditions));
      res.json({ count: result?.count || 0 });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.use("/api/subjects/:id", async (req: any, res: any, next: any) => {
    try {
      if (req.method === 'OPTIONS') return next();
      const subjectId = Number(req.params.id);
      if (!isNaN(subjectId) && req.appUser) {
        if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) {
          return res.status(403).json({ message: "Prístup zamietnutý" });
        }
      }
    } catch (err) {
    }
    next();
  });

  // === GLOBAL CLICK LOG ===
  app.post("/api/click-log", isAuthenticated, async (req: any, res) => {
    try {
      const { buttonLabel, module } = req.body;
      const label = buttonLabel || "unknown";
      const mod = module || "unknown";
      await logAudit(req, {
        action: "CLICK",
        module: mod,
        entityName: `Kliknutie na tlacidlo [${label}] v module [${mod}]`,
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("Click log error:", err);
      res.json({ ok: false });
    }
  });

  // === APP USER ===
  app.get(api.appUser.me.path, isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(404).json({ message: "App user not found" });

      let effectiveTimeout = 1800;
      if (appUser.permissionGroupId) {
        const [pg] = await db.select().from(permissionGroups).where(eq(permissionGroups.id, appUser.permissionGroupId));
        if (pg) effectiveTimeout = pg.sessionTimeoutSeconds ?? 1800;
      } else {
        const memberships = await db.select({ groupId: userClientGroupMemberships.groupId })
          .from(userClientGroupMemberships)
          .where(eq(userClientGroupMemberships.userId, appUser.id));
        if (memberships.length > 0) {
          const cgs = await Promise.all(
            memberships.map(m => db.select({ permissionGroupId: clientGroups.permissionGroupId }).from(clientGroups).where(eq(clientGroups.id, m.groupId)))
          );
          const pgIds = cgs.flat().map(c => c.permissionGroupId).filter(Boolean) as number[];
          if (pgIds.length > 0) {
            const pgs = await Promise.all(
              pgIds.map(async pgId => { const [p] = await db.select().from(permissionGroups).where(eq(permissionGroups.id, pgId)); return p; })
            );
            const timeouts = pgs.filter(Boolean).map(pg => pg!.sessionTimeoutSeconds ?? 1800);
            if (timeouts.length > 0) effectiveTimeout = Math.max(...timeouts);
          }
        }
      }

      let careerLevel = null;
      if (appUser.careerLevelId) {
        const [cl] = await db.select().from(careerLevels).where(eq(careerLevels.id, appUser.careerLevelId));
        if (cl) careerLevel = cl;
      }

      let permissionGroup = null;
      if (appUser.permissionGroupId) {
        const [pg] = await db.select().from(permissionGroups).where(eq(permissionGroups.id, appUser.permissionGroupId));
        if (pg) permissionGroup = pg;
      }

      const isImpersonating = !!req.originalAppUser;
      const originalUser = req.originalAppUser ? {
        id: req.originalAppUser.id,
        firstName: req.originalAppUser.firstName,
        lastName: req.originalAppUser.lastName,
        role: req.originalAppUser.role,
        uid: req.originalAppUser.uid,
      } : null;

      const { password: _pw, ...safeAppUser } = appUser;
      res.json({ ...safeAppUser, effectiveSessionTimeoutSeconds: effectiveTimeout, careerLevel, permissionGroup, isImpersonating, originalUser });
    } catch (err) {
      console.error("Error in /api/app-user/me:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/app-users/my-points", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(404).json({ message: "User not found" });

      const [result] = await db
        .select({ totalPoints: sql<string>`COALESCE(SUM(CAST(${commissionCalculationLogs.pointsEarned} AS numeric)), 0)` })
        .from(commissionCalculationLogs)
        .where(eq(commissionCalculationLogs.agentId, appUser.id));

      res.json({ points: parseFloat(result?.totalPoints || "0") });
    } catch (err) {
      console.error("Error in /api/app-user/my-points:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put(api.appUser.setActive.path, isAuthenticated, async (req: any, res) => {
    try {
      const validated = api.appUser.setActive.input.parse(req.body);
      const appUser = req.appUser;
      if (!appUser) return res.status(404).json({ message: "User not found" });

      
      const updates: Record<string, any> = {};
      if (validated.activeCompanyId !== undefined) updates.activeCompanyId = validated.activeCompanyId;
      if (validated.activeStateId !== undefined) updates.activeStateId = validated.activeStateId;
      if (validated.activeDivisionId !== undefined) updates.activeDivisionId = validated.activeDivisionId;
      if (validated.activeCompanyId === null) updates.activeCompanyId = null;
      if (validated.activeDivisionId === null) updates.activeDivisionId = null;
      
      const oldData = { activeCompanyId: appUser.activeCompanyId, activeStateId: appUser.activeStateId, activeDivisionId: (appUser as any).activeDivisionId };
      const updated = await storage.updateAppUser(appUser.id, updates);
      await logAudit(req, { action: "UPDATE", module: "nastavenia", entityId: appUser.id, entityName: appUser.username, oldData, newData: updates });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === IMPERSONATION ===
  app.post("/api/impersonate/stop", isAuthenticated, async (req: any, res) => {
    try {
      const realUser = req.originalAppUser;
      if (!realUser) return res.status(400).json({ message: "Nie ste v režime impersonation" });

      const impersonatedUser = req.appUser;
      await db.update(appUsers).set({ impersonatingUserId: null }).where(eq(appUsers.id, realUser.id));

      const now = formatDateTimeSK();
      await logAudit(req, {
        action: "IMPERSONATE_STOP",
        module: "pouzivatelia",
        entityId: impersonatedUser.id,
        entityName: `${impersonatedUser.firstName} ${impersonatedUser.lastName}`,
        oldData: { impersonatingUserId: impersonatedUser.id },
        newData: { message: `Admin ${realUser.uid || realUser.id} ukončil prevzatie kontextu používateľa ${impersonatedUser.uid || impersonatedUser.id} dňa ${now}` },
      });

      res.json({ success: true });
    } catch (err: any) {
      console.error("Impersonate stop error:", err);
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.post("/api/impersonate/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const realUser = req.originalAppUser || req.appUser;
      if (!isArchitekt(realUser)) {
        return res.status(403).json({ message: "Len Architekt môže použiť túto funkciu" });
      }

      const targetUserId = parseInt(req.params.userId);
      if (isNaN(targetUserId)) return res.status(400).json({ message: "Neplatné ID používateľa" });
      if (targetUserId === realUser.id) return res.status(400).json({ message: "Nemôžete prevziať vlastný kontext" });

      const [targetUser] = await db.select().from(appUsers).where(eq(appUsers.id, targetUserId));
      if (!targetUser) return res.status(404).json({ message: "Používateľ nebol nájdený" });

      if (isArchitekt(targetUser)) {
        return res.status(403).json({ message: "Nemôžete impersonovať Architekta" });
      }

      await db.update(appUsers).set({ impersonatingUserId: targetUserId }).where(eq(appUsers.id, realUser.id));

      const now = formatDateTimeSK();
      await logAudit(req, {
        action: "IMPERSONATE_START",
        module: "pouzivatelia",
        entityId: targetUserId,
        entityName: `${targetUser.firstName} ${targetUser.lastName}`,
        oldData: null,
        newData: {
          message: `Architekt ${realUser.username} (ID:${realUser.id}) prevzal kontext používateľa ${targetUser.username} (ID:${targetUser.id}) dňa ${now}`,
          architectId: realUser.id,
          architectUsername: realUser.username,
        },
      });

      res.json({ success: true, impersonatedUser: { id: targetUser.id, firstName: targetUser.firstName, lastName: targetUser.lastName, role: targetUser.role } });
    } catch (err: any) {
      console.error("Impersonate error:", err);
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  // === HIERARCHY ===
  app.get(api.hierarchy.continents.path, async (_req, res) => {
    res.json(await storage.getContinents());
  });

  app.get(api.hierarchy.states.path, async (req, res) => {
    const continentId = req.query.continentId ? parseInt(req.query.continentId as string) : undefined;
    res.json(await storage.getStates(continentId));
  });

  app.post(api.hierarchy.createState.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.hierarchy.createState.input.parse(req.body);
      const created = await storage.createState(input);
      await logAudit(req, { action: "CREATE", module: "nastavenia", entityId: created.id, entityName: created.name, newData: input });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // === HIERARCHY ENDPOINTS (ArutsoK 31) ===
  app.get("/api/hierarchy/continents", isAuthenticated, async (_req, res) => {
    try {
      const result = await storage.getContinents();
      res.json(result);
    } catch (err) {
      console.error("Get continents error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/hierarchy/states", isAuthenticated, async (req, res) => {
    try {
      const continentId = req.query.continentId ? Number(req.query.continentId) : undefined;
      const result = await storage.getStates(continentId);
      res.json(result);
    } catch (err) {
      console.error("Get states error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/hierarchy/states", isAuthenticated, async (req: any, res) => {
    try {
      const created = await storage.createState(req.body);
      await logAudit(req, { action: "CREATE", module: "Staty", entityId: created.id, entityName: created.name, newData: req.body });
      res.status(201).json(created);
    } catch (err) {
      console.error("Create state error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === STATES CRUD (ArutsoK 31) ===
  app.get("/api/states/:id", isAuthenticated, async (req, res) => {
    const state = await storage.getState(Number(req.params.id));
    if (!state) return res.status(404).json({ message: "State not found" });
    res.json(state);
  });

  app.put("/api/states/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const old = await storage.getState(id);
      if (!old) return res.status(404).json({ message: "State not found" });
      const updated = await storage.updateState(id, req.body);
      await logAudit(req, { action: "UPDATE", module: "Staty", entityId: id, entityName: updated.name, oldData: old, newData: req.body });
      res.json(updated);
    } catch (err) {
      console.error("Update state error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/states/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const old = await storage.getState(id);
      if (!old) return res.status(404).json({ message: "State not found" });
      await storage.deleteState(id);
      await logAudit(req, { action: "DELETE", module: "Staty", entityId: id, entityName: old.name });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete state error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/states/:id/flag", isAuthenticated, (req: any, _res: any, next: any) => {
    (req as any)._uploadSection = "flags";
    next();
  }, upload.single("file"), async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const state = await storage.getState(id);
      if (!state) return res.status(404).json({ message: "State not found" });
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      const secScan = await scanUploadedFile(file.path, file.originalname, file.mimetype);
      if (!secScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: ${secScan.reason}` });
      if (state.flagUrl) {
        await storage.addStateFlagHistory(id, state.flagUrl);
      }
      const flagUrl = `/api/files/flags/${file.filename}`;
      const updated = await storage.updateState(id, { flagUrl });
      await logAudit(req, { action: "UPDATE", module: "Staty", entityId: id, entityName: state.name, oldData: { flagUrl: state.flagUrl }, newData: { flagUrl } });
      res.json(updated);
    } catch (err) {
      console.error("Upload flag error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/states/:id/flag-history", isAuthenticated, async (req, res) => {
    res.json(await storage.getStateFlagHistory(Number(req.params.id)));
  });

  // === COMPANY LOGO HISTORY (ArutsoK 31) ===
  app.get("/api/my-companies/:id/logo-history", isAuthenticated, async (req, res) => {
    res.json(await storage.getCompanyLogoHistory(Number(req.params.id)));
  });

  // === DIVISIONS (Divízie) ===
  app.get("/api/divisions", isAuthenticated, async (_req, res) => {
    try {
      const divs = await storage.getDivisions();
      const enriched = await Promise.all(divs.map(async (d) => {
        const links = await storage.getDivisionCompanies(d.id);
        return { ...d, companies: links.map(l => ({ id: l.company.id, name: l.company.name, code: (l.company as any).code || null })) };
      }));
      res.json(enriched);
    } catch (err) { res.status(500).json({ message: String(err) }); }
  });

  app.get("/api/divisions/:id", isAuthenticated, async (req, res) => {
    try {
      const division = await storage.getDivision(Number(req.params.id));
      if (!division) return res.status(404).json({ message: "Divízia nenájdená" });
      res.json(division);
    } catch (err) { res.status(500).json({ message: String(err) }); }
  });

  const DIVISION_EMOJI_POOL = ["🏢","🏗️","🏭","🏬","🏫","🏛️","🏠","🏡","🏪","🏤","🗂️","📊","📈","🔧","⚙️","🎯","🛡️","💼","📋","🔑","🏦","🏥","🏨","🏩","🏰","🗃️","📁","📂","🧩","🔶","🔷","🟢","🟡","🟣","⭐","🌐","🚀","💡","🔔","📌"];

  async function getUsedEmojisForDivisionCompanies(divisionId: number | null): Promise<Set<string>> {
    const allDivs = await storage.getDivisions();
    const allCompanyDivs = await db.select().from(companyDivisions);
    const targetCompanyIds = new Set<number>();
    if (divisionId) {
      allCompanyDivs.filter(cd => cd.divisionId === divisionId).forEach(cd => targetCompanyIds.add(cd.companyId));
    } else {
      allCompanyDivs.forEach(cd => targetCompanyIds.add(cd.companyId));
    }
    const siblingDivisionIds = new Set(
      allCompanyDivs.filter(cd => targetCompanyIds.has(cd.companyId) && cd.divisionId !== divisionId).map(cd => cd.divisionId)
    );
    const usedEmojis = new Set<string>();
    allDivs.filter(d => siblingDivisionIds.has(d.id) && (d as any).emoji).forEach(d => usedEmojis.add((d as any).emoji));
    return usedEmojis;
  }

  async function checkEmojiUniquenessForCompany(emoji: string, divisionId: number | null): Promise<string | null> {
    const allDivs = await storage.getDivisions();
    const allCompanyDivs = await db.select().from(companyDivisions);
    const targetCompanyIds = new Set<number>();
    if (divisionId) {
      allCompanyDivs.filter(cd => cd.divisionId === divisionId).forEach(cd => targetCompanyIds.add(cd.companyId));
    }
    for (const companyId of targetCompanyIds) {
      const siblingDivIds = allCompanyDivs.filter(cd => cd.companyId === companyId && cd.divisionId !== divisionId).map(cd => cd.divisionId);
      for (const sibId of siblingDivIds) {
        const sib = allDivs.find(d => d.id === sibId);
        if (sib && (sib as any).emoji === emoji) {
          return `Emoji "${emoji}" sa už používa v inej divízii rovnakej spoločnosti`;
        }
      }
    }
    return null;
  }

  app.post("/api/divisions", isAuthenticated, async (req: any, res) => {
    try {
      const input = insertDivisionSchema.parse(req.body);
      const allDivs = await storage.getDivisions();
      const allUsedEmojis = new Set(allDivs.filter((d: any) => d.emoji).map((d: any) => d.emoji));
      if (input.emoji) {
        if (allUsedEmojis.has(input.emoji)) {
          return res.status(400).json({ message: `Emoji "${input.emoji}" sa už používa v inej divízii` });
        }
      } else {
        const available = DIVISION_EMOJI_POOL.find(e => !allUsedEmojis.has(e));
        (input as any).emoji = available || "🏢";
      }
      const division = await storage.createDivision(input);
      await logAudit(req, { action: "CREATE", module: "divisions", entityId: division.id, newData: input });
      res.status(201).json(division);
    } catch (err) { res.status(400).json({ message: String(err) }); }
  });

  app.put("/api/divisions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const old = await storage.getDivision(Number(req.params.id));
      if (!old) return res.status(404).json({ message: "Divízia nenájdená" });
      const input = insertDivisionSchema.partial().parse(req.body);
      if (input.emoji) {
        const conflict = await checkEmojiUniquenessForCompany(input.emoji, Number(req.params.id));
        if (conflict) return res.status(400).json({ message: conflict });
      }
      const division = await storage.updateDivision(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "divisions", entityId: division.id, oldData: old, newData: input });
      res.json(division);
    } catch (err) { res.status(400).json({ message: String(err) }); }
  });

  app.delete("/api/divisions/:id", isAuthenticated, async (req: any, res) => {
    try {
      const old = await storage.getDivision(Number(req.params.id));
      await storage.deleteDivision(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "divisions", entityId: Number(req.params.id), oldData: old });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: String(err) }); }
  });

  app.get("/api/companies/:id/divisions", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getCompanyDivisions(Number(req.params.id)));
    } catch (err) { res.status(500).json({ message: String(err) }); }
  });

  app.post("/api/companies/:id/divisions", isAuthenticated, async (req: any, res) => {
    try {
      const companyId = Number(req.params.id);
      const divisionId = Number(req.body.divisionId);
      if (!divisionId) return res.status(400).json({ message: "divisionId je povinné" });
      const company = await storage.getMyCompany(companyId);
      if (!company) return res.status(404).json({ message: "Spoločnosť nenájdená" });
      const division = await storage.getDivision(divisionId);
      if (!division) return res.status(404).json({ message: "Divízia nenájdená" });
      const existing = await storage.getCompanyDivisions(companyId);
      if (existing.some(e => e.divisionId === divisionId)) return res.status(400).json({ message: "Divízia je už priradená" });
      const entry = await storage.addCompanyDivision(companyId, divisionId);
      await logAudit(req, { action: "CREATE", module: "company_divisions", entityId: entry.id, newData: { companyId, divisionId } });
      res.status(201).json(entry);
    } catch (err) { res.status(400).json({ message: String(err) }); }
  });

  app.delete("/api/company-divisions/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.removeCompanyDivision(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "company_divisions", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: String(err) }); }
  });

  app.get("/api/divisions/:id/companies", isAuthenticated, async (req, res) => {
    try {
      res.json(await storage.getDivisionCompanies(Number(req.params.id)));
    } catch (err) { res.status(500).json({ message: String(err) }); }
  });

  // === AUDIT LOGS ===
  app.get(api.auditLogs.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const filters = {
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
        module: req.query.module as string || undefined,
        action: req.query.action as string || undefined,
        entityId: req.query.entityId ? parseInt(req.query.entityId as string) : undefined,
        dateFrom: req.query.dateFrom as string || undefined,
        dateTo: req.query.dateTo as string || undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      };
      const [logs, total] = await Promise.all([
        storage.getAuditLogs(filters),
        storage.getAuditLogCount(filters),
      ]);
      res.json({ logs, total });
    } catch (err) {
      console.error("Audit logs error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/security-status", isAuthenticated, async (req: any, res) => {
    if (!isAdmin(req.appUser)) return res.status(403).json({ message: "Nedostatočné oprávnenia" });
    const clamStatus = checkClamAvStatus();
    res.json({
      layers: {
        magicBytes: { active: true, description: "Validácia vnútornej štruktúry súborov (Magic Bytes)" },
        clamav: { active: clamStatus.available, description: "ClamAV antivírusový skener", dbPath: clamStatus.dbPath },
        excelSanitization: { active: true, description: "Izolácia a sanitizácia Excel súborov (No-Execution Policy)" },
        extensionBlacklist: { active: true, description: "Blokovanie nebezpečných prípon (.exe, .bat, .cmd...)" },
      },
    });
  });

  app.get("/api/audit-logs/users", isAuthenticated, async (_req, res) => {
    try {
      const users = await storage.getAppUsers();
      res.json(users.map(u => ({ id: u.id, username: u.username, firstName: u.firstName, lastName: u.lastName })));
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === ACTIVITY EVENTS (Timeline) ===
  app.get("/api/activity-events", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !['superadmin', 'admin'].includes(appUser.role)) {
        return res.status(403).json({ message: "Pristup len pre SuperAdmin a Admin" });
      }

      const subjectId = req.query.subjectId ? Number(req.query.subjectId) : undefined;
      const contractId = req.query.contractId ? Number(req.query.contractId) : undefined;
      const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50;

      let query = db.select().from(activityEvents).orderBy(activityEvents.createdAt);
      const conditions: any[] = [];
      if (subjectId) conditions.push(eq(activityEvents.subjectId, subjectId));
      if (contractId) conditions.push(eq(activityEvents.contractId, contractId));

      const { and, desc } = await import("drizzle-orm");
      const events = await db.select().from(activityEvents)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(activityEvents.createdAt))
        .limit(limit);

      res.json({ events, total: events.length });
    } catch (err) {
      console.error("Activity events error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/activity-events", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !['superadmin', 'admin'].includes(appUser.role)) {
        return res.status(403).json({ message: "Pristup len pre SuperAdmin a Admin" });
      }

      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
      const ua = req.headers['user-agent'] || '';
      const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop';

      const eventData = {
        ...req.body,
        userId: appUser.id,
        username: appUser.username,
        ipAddress: typeof ip === 'string' ? ip : JSON.stringify(ip),
        deviceType,
      };

      const [event] = await db.insert(activityEvents).values(eventData).returning();
      res.status(201).json(event);
    } catch (err) {
      console.error("Create activity event error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/activity-events/:id/status-change", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !['superadmin', 'admin'].includes(appUser.role)) {
        return res.status(403).json({ message: "Pristup len pre SuperAdmin a Admin" });
      }

      const parentEventId = Number(req.params.id);
      const { messageStatus, responseText } = req.body;

      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
      const ua = req.headers['user-agent'] || '';
      const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop';

      const [parentEvent] = await db.select().from(activityEvents).where(eq(activityEvents.id, parentEventId)).limit(1);
      if (!parentEvent) return res.status(404).json({ message: "Event not found" });

      const [newEvent] = await db.insert(activityEvents).values({
        subjectId: parentEvent.subjectId,
        contractId: parentEvent.contractId,
        eventType: responseText ? "client_response" : "status_change",
        messageText: responseText || `Status zmenený na: ${messageStatus}`,
        messageStatus: messageStatus || parentEvent.messageStatus,
        fieldName: `ref:${parentEventId}`,
        oldValue: parentEvent.messageStatus,
        newValue: messageStatus,
        responseText: responseText || null,
        userId: appUser.id,
        username: appUser.username,
        ipAddress: typeof ip === 'string' ? ip : JSON.stringify(ip),
        deviceType,
      }).returning();

      res.status(201).json(newEvent);
    } catch (err) {
      console.error("Activity event status change error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === MY COMPANIES ===
  app.get(api.myCompanies.list.path, isAuthenticated, async (req: any, res) => {
    const includeDeleted = req.query.includeDeleted === 'true';
    const stateId = req.query.stateId ? parseInt(req.query.stateId as string) : undefined;
    const companies = await storage.getMyCompanies(includeDeleted);
    if (stateId) {
      res.json(companies.filter(c => c.stateId === stateId));
    } else {
      res.json(companies);
    }
  });

  app.get(api.myCompanies.get.path, isAuthenticated, async (req, res) => {
    const company = await storage.getMyCompany(Number(req.params.id));
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json(company);
  });

  app.post(api.myCompanies.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || (appUser.role !== 'admin' && appUser.role !== 'superadmin')) {
        return res.status(403).json({ message: "Only admins can create companies" });
      }

      const input = api.myCompanies.create.input.parse(req.body);
      const created = await storage.createMyCompany(input);
      await logAudit(req, { action: "CREATE", module: "spolocnosti", entityId: created.id, entityName: created.name, newData: input });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.myCompanies.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.myCompanies.update.input.parse(req.body);
      const oldCompany = await storage.getMyCompany(Number(req.params.id));
      const updated = await storage.updateMyCompany(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "spolocnosti", entityId: Number(req.params.id), entityName: updated.name, oldData: oldCompany, newData: input });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message === "Company not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  app.delete(api.myCompanies.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const companyId = Number(req.params.id);
      const appUser = req.appUser;
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      if (!appUser) return res.status(404).json({ message: "User not found" });

      await storage.softDeleteMyCompany(companyId, appUser.username, typeof ip === 'string' ? ip : JSON.stringify(ip));
      await logAudit(req, { action: "DELETE", module: "spolocnosti", entityId: companyId });
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error && err.message === "Company not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  // === COMPANY OFFICERS ===
  app.get(api.companyOfficers.list.path, isAuthenticated, async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    res.json(await storage.getCompanyOfficers(Number(req.params.companyId), includeInactive));
  });

  app.post(api.companyOfficers.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = { ...api.companyOfficers.create.input.parse(req.body), companyId: Number(req.params.companyId) };
      const created = await storage.createCompanyOfficer(input);
      await logAudit(req, { action: "CREATE", module: "spolocnosti", entityName: "officer" });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put("/api/company-officers/:id", isAuthenticated, async (req, res) => {
    try {
      const updated = await storage.updateCompanyOfficer(Number(req.params.id), req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(api.companyOfficers.delete.path, isAuthenticated, async (req, res) => {
    try {
      await storage.deleteCompanyOfficer(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "spolocnosti", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  // === PARTNERS ===
  app.get(api.partners.list.path, isAuthenticated, async (req: any, res) => {
    const includeDeleted = req.query.includeDeleted === 'true';
    const stateId = getEnforcedStateId(req);
    res.json(await storage.getPartners(includeDeleted, stateId || undefined));
  });

  app.get(api.partners.get.path, isAuthenticated, async (req, res) => {
    const partner = await storage.getPartner(Number(req.params.id));
    if (!partner) return res.status(404).json({ message: "Partner not found" });
    res.json(partner);
  });

  app.post(api.partners.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.partners.create.input.parse(req.body);
      const created = await storage.createPartner(input);
      await logAudit(req, { action: "CREATE", module: "partneri", entityId: created.id, entityName: created.name, newData: input });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.partners.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.partners.update.input.parse(req.body);
      const oldPartner = await storage.getPartner(Number(req.params.id));
      const updated = await storage.updatePartner(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "partneri", entityId: Number(req.params.id), oldData: oldPartner, newData: input });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message === "Partner not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  app.delete(api.partners.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      if (!appUser) return res.status(404).json({ message: "User not found" });

      await storage.softDeletePartner(Number(req.params.id), appUser.username, typeof ip === 'string' ? ip : '');
      await logAudit(req, { action: "DELETE", module: "partneri", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error && err.message === "Partner not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  // === PARTNER LIFECYCLE STATUS ===
  app.patch("/api/partners/:id/lifecycle-status", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { status, startDate, endDate } = req.body;
      const validStatuses = ["record", "fast_forward", "play", "pause", "eject", "stop"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Neplatný stav životného cyklu" });
      }
      if (status === "fast_forward" && !startDate) {
        return res.status(400).json({ message: "Stav 'Budúci štart' vyžaduje dátum štartu" });
      }
      if (status === "eject" && !endDate) {
        return res.status(400).json({ message: "Stav 'Dobiehanie' vyžaduje dátum ukončenia" });
      }
      const oldPartner = await storage.getPartner(id);
      if (!oldPartner) return res.status(404).json({ message: "Partner nenájdený" });
      const statusLabels: Record<string, string> = { record: "⏺️ Príprava", fast_forward: "⏭️ Budúci štart", play: "▶️ Aktívne", pause: "⏸️ Pozastavené", eject: "⏏️ Dobiehanie", stop: "⏹️ Ukončené" };
      const updated = await storage.updatePartnerLifecycleStatus(
        id,
        status,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );
      await logAudit(req, {
        action: "LIFECYCLE_STATUS_CHANGE",
        module: "partneri",
        entityId: id,
        entityName: oldPartner.name,
        oldData: { lifecycleStatus: oldPartner.lifecycleStatus, label: statusLabels[oldPartner.lifecycleStatus || "record"] },
        newData: { lifecycleStatus: status, label: statusLabels[status] },
      });
      if (status === "stop" || status === "pause") {
        const affectedProducts = await storage.bulkUpdateProductsLifecycleByPartner(id, status);
        for (const product of affectedProducts) {
          await logAudit(req, {
            action: "LIFECYCLE_STATUS_CHANGE",
            module: "SektoroveProdukty",
            entityId: product.id,
            entityName: product.name,
            oldData: { lifecycleStatus: "inherited" },
            newData: { lifecycleStatus: status, label: statusLabels[status], reason: `Dedičnosť z partnera ${oldPartner.name}` },
          });
        }
      }
      res.json(updated);
    } catch (err) {
      console.error("Partner lifecycle status error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === SECTOR PRODUCT LIFECYCLE STATUS ===
  app.patch("/api/sector-products/:id/lifecycle-status", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { status, startDate, endDate } = req.body;
      const validStatuses = ["record", "fast_forward", "play", "pause", "eject", "stop"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Neplatný stav životného cyklu" });
      }
      if (status === "fast_forward" && !startDate) {
        return res.status(400).json({ message: "Stav 'Budúci štart' vyžaduje dátum štartu" });
      }
      if (status === "eject" && !endDate) {
        return res.status(400).json({ message: "Stav 'Dobiehanie' vyžaduje dátum ukončenia" });
      }
      const oldProduct = await storage.getSectorProduct(id);
      if (!oldProduct) return res.status(404).json({ message: "Produkt nenájdený" });
      const statusLabels: Record<string, string> = { record: "⏺️ Príprava", fast_forward: "⏭️ Budúci štart", play: "▶️ Aktívne", pause: "⏸️ Pozastavené", eject: "⏏️ Dobiehanie", stop: "⏹️ Ukončené" };
      const updated = await storage.updateSectorProductLifecycleStatus(
        id,
        status,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );
      await logAudit(req, {
        action: "LIFECYCLE_STATUS_CHANGE",
        module: "SektoroveProdukty",
        entityId: id,
        entityName: oldProduct.name,
        oldData: { lifecycleStatus: oldProduct.lifecycleStatus, label: statusLabels[oldProduct.lifecycleStatus || "record"] },
        newData: { lifecycleStatus: status, label: statusLabels[status] },
      });
      res.json(updated);
    } catch (err) {
      console.error("Sector product lifecycle status error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === PARTNER CONTRACTS ===
  app.get(api.partnerContracts.list.path, isAuthenticated, async (req, res) => {
    res.json(await storage.getPartnerContracts(Number(req.params.partnerId)));
  });

  app.post(api.partnerContracts.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = { ...api.partnerContracts.create.input.parse(req.body), partnerId: Number(req.params.partnerId) };
      const created = await storage.createPartnerContract(input);
      await logAudit(req, { action: "CREATE", module: "partneri", entityName: "zmluva" });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.partnerContracts.delete.path, isAuthenticated, async (req, res) => {
    try {
      await storage.deletePartnerContract(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "partneri", entityId: Number(req.params.id), entityName: "zmluva" });
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  // === CONTRACT AMENDMENTS ===
  app.get(api.contractAmendments.list.path, isAuthenticated, async (req, res) => {
    res.json(await storage.getContractAmendments(Number(req.params.contractId)));
  });

  app.post(api.contractAmendments.create.path, isAuthenticated, (req, _res, next) => {
    (req as any)._uploadSection = "amendments";
    next();
  }, upload.single("file"), async (req, res) => {
    try {
      const contractId = Number(req.params.contractId);
      const { name, effectiveDate } = req.body;
      if (!name || !effectiveDate) return res.status(400).json({ message: "Name and effectiveDate are required" });

      let fileEntry = null;
      if (req.file) {
        const secScan = await scanUploadedFile(req.file.path, req.file.originalname, req.file.mimetype);
        if (!secScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: ${secScan.reason}` });
        fileEntry = {
          name: req.file.originalname,
          url: `/api/files/amendments/${req.file.filename}`,
          uploadedAt: new Date().toISOString(),
        };
      }

      const amendment = await storage.createContractAmendment({
        contractId,
        name,
        effectiveDate: new Date(effectiveDate),
        file: fileEntry,
      });
      await logAudit(req, { action: "CREATE", module: "partneri", entityName: "dodatok" });
      res.status(201).json(amendment);
    } catch (err) {
      console.error("Create amendment error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(api.contractAmendments.delete.path, isAuthenticated, async (req, res) => {
    try {
      await storage.deleteContractAmendment(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "partneri", entityId: Number(req.params.id), entityName: "dodatok" });
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  // === USER PROFILE ===
  app.get(api.userProfiles.me.path, isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.json(null);
      const profile = await storage.getUserProfile(appUser.id);
      res.json(profile || null);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post(api.userProfiles.upload.path, isAuthenticated, (req, _res, next) => {
    (req as any)._uploadSection = "profiles";
    next();
  }, upload.single("photo"), async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(404).json({ message: "App user not found" });

      const file = req.file;
      if (!file) return res.status(400).json({ message: "No photo uploaded" });

      const ext = path.extname(file.originalname).toLowerCase();
      if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ message: "Only .jpg and .png formats are allowed" });
      }
      const secScan = await scanUploadedFile(file.path, file.originalname, file.mimetype);
      if (!secScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: ${secScan.reason}` });

      const photoUrl = `/api/files/profiles/${file.filename}`;
      const profile = await storage.upsertUserProfile({
        appUserId: appUser.id,
        photoUrl,
        photoOriginalName: file.originalname,
      });
      res.json(profile);
    } catch (err) {
      console.error("Profile photo upload error:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // === PARTNER CONTACTS ===
  app.get(api.partnerContacts.list.path, isAuthenticated, async (req, res) => {
    const includeInactive = req.query.includeInactive === 'true';
    res.json(await storage.getPartnerContacts(Number(req.params.partnerId), includeInactive));
  });

  app.post(api.partnerContacts.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = { ...api.partnerContacts.create.input.parse(req.body), partnerId: Number(req.params.partnerId) };
      const created = await storage.createPartnerContact(input);
      await logAudit(req, { action: "CREATE", module: "partneri", entityName: "kontakt" });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.partnerContacts.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.partnerContacts.update.input.parse(req.body);
      const updated = await storage.updatePartnerContact(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "partneri", entityId: Number(req.params.id), entityName: "kontakt" });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.partnerContacts.delete.path, isAuthenticated, async (req, res) => {
    try {
      await storage.deletePartnerContact(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "partneri", entityId: Number(req.params.id), entityName: "kontakt" });
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  // === PARTNER PRODUCTS ===
  app.get(api.partnerProducts.list.path, isAuthenticated, async (req, res) => {
    res.json(await storage.getPartnerProducts(Number(req.params.partnerId)));
  });

  app.post(api.partnerProducts.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = { ...api.partnerProducts.create.input.parse(req.body), partnerId: Number(req.params.partnerId) };
      const created = await storage.createPartnerProduct(input);
      await logAudit(req, { action: "CREATE", module: "partneri", entityName: "produkt" });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.partnerProducts.delete.path, isAuthenticated, async (req, res) => {
    try {
      await storage.deletePartnerProduct(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "partneri", entityId: Number(req.params.id), entityName: "produkt" });
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  // === CONTACT-PRODUCT ASSIGNMENTS ===
  app.get(api.contactProductAssignments.list.path, isAuthenticated, async (req, res) => {
    res.json(await storage.getContactProductAssignments(Number(req.params.contactId)));
  });

  app.put(api.contactProductAssignments.set.path, isAuthenticated, async (req, res) => {
    try {
      const { productIds } = api.contactProductAssignments.set.input.parse(req.body);
      await storage.setContactProductAssignments(Number(req.params.contactId), productIds);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // === COMMUNICATION MATRIX ===
  app.get(api.communicationMatrix.list.path, isAuthenticated, async (req, res) => {
    res.json(await storage.getCommunicationMatrix(Number(req.params.partnerId)));
  });

  app.post(api.communicationMatrix.create.path, isAuthenticated, async (req, res) => {
    try {
      const parsed = api.communicationMatrix.create.input.parse(req.body);
      const input = {
        partnerId: Number(req.params.partnerId),
        companyId: parsed.companyId,
        externalContactId: parsed.externalContactId ?? null,
        internalSubjectId: parsed.internalSubjectId ?? null,
      };
      res.status(201).json(await storage.createMatrixEntry(input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.communicationMatrix.delete.path, isAuthenticated, async (req, res) => {
    try {
      await storage.deleteMatrixEntry(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  // === CONTACT SWAP (replace contact for product) ===
  app.post("/api/partner-contacts/:oldContactId/swap", isAuthenticated, async (req, res) => {
    try {
      const { newContactData, productId } = req.body;
      if (!newContactData || !productId) return res.status(400).json({ message: "Missing newContactData or productId" });
      const newContact = await storage.swapContactForProduct(Number(req.params.oldContactId), newContactData, productId);
      res.status(201).json(newContact);
    } catch (err) {
      console.error("Swap contact error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === SUBJECT CAREER HISTORY ===
  app.get("/api/subjects/:id/career-history", isAuthenticated, async (req, res) => {
    try {
      const history = await storage.getSubjectCareerHistory(Number(req.params.id));
      res.json(history);
    } catch (err) {
      console.error("Career history error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === SUBJECTS ===
  app.get(api.subjects.list.path, isAuthenticated, async (req: any, res) => {
    const appUser = req.appUser;
    
    if (await isKlientiUser(appUser)) {
      if (!appUser.linkedSubjectId) return res.json([]);
      const own = await storage.getSubject(appUser.linkedSubjectId);
      return res.json(own ? [decryptBirthNumber(own)] : []);
    }
    
    const activeCompanyId = appUser?.activeCompanyId || (req.query.activeCompanyId ? Number(req.query.activeCompanyId) : undefined);
    const params = {
      search: req.query.search as string,
      type: req.query.type as 'person' | 'company',
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    };
    let allSubjects = await storage.getSubjects(params);

    const enforcedState = getEnforcedStateId(req);
    if (enforcedState) {
      allSubjects = allSubjects.filter((s: any) => s.stateId === enforcedState);
    }

    if (!isAdmin(appUser)) {
      const filtered: any[] = [];
      for (const s of allSubjects) {
        if (s.registeredByUserId === appUser.id) { filtered.push(s); continue; }
        if (appUser.linkedSubjectId && appUser.linkedSubjectId === s.id) { filtered.push(s); continue; }
        if (await isInManagerChain(appUser.id, s.registeredByUserId, appUser.activeCompanyId)) { filtered.push(s); continue; }
      }
      allSubjects = filtered;
    }

    const allCompanies = await storage.getMyCompanies();
    const companyMap = new Map(allCompanies.map(c => [c.id, c.name]));
    allSubjects = allSubjects.map((s: any) => ({
      ...s,
      myCompanyName: companyMap.get(s.myCompanyId) || null,
      companyName: s.type === 'person'
        ? (companyMap.get(s.myCompanyId) || null)
        : (s.companyName || null),
    }));

    const statusFiltersRaw = req.query.statusFilters as string | undefined;

    if (statusFiltersRaw) {
      const filters = statusFiltersRaw.split(",").map((f: string) => f.trim());
      allSubjects = allSubjects.filter((s: any) => {
        const status = getSubjectStatusCategory(s, activeCompanyId);
        return filters.includes(status);
      });
    }

    const isSuperAdminUser = (() => {
      if (!appUser?.permissionGroupId) return appUser?.role === 'superadmin' || appUser?.role === 'prezident';
      return false;
    })();
    let pgNameForList = '';
    if (appUser?.permissionGroupId) {
      const [pgCheck] = await db.select().from(permissionGroups).where(eq(permissionGroups.id, appUser.permissionGroupId));
      pgNameForList = pgCheck?.name?.toLowerCase() || '';
    }
    const canSeeNotes = isSuperAdminUser || pgNameForList.includes('superadmin') || pgNameForList.includes('prezident');
    
    const blacklistMemberIds = await storage.getGroupMemberSubjectIds("group_cierny_zoznam");
    const processedSubjects = allSubjects.map((s: any) => {
      const processed = decryptBirthNumber(s);
      if (!canSeeNotes && processed.uiPreferences) {
        const prefs = { ...(processed.uiPreferences as any) };
        delete prefs.field_notes;
        processed.uiPreferences = prefs;
      }
      if (blacklistMemberIds.has(s.id)) {
        processed.effectiveListStatus = "cierny";
      } else if (s.listStatus === "cerveny") {
        processed.effectiveListStatus = (!s.redListCompanyId || s.redListCompanyId === activeCompanyId) ? "cerveny" : null;
      } else {
        processed.effectiveListStatus = null;
      }
      return processed;
    });
    res.json(processedSubjects);
  });

  function getSubjectStatusCategory(subject: any, activeCompanyId?: number): string {
    if (subject.isDeceased) return "deceased";
    if (!subject.isActive) return "inactive";
    if (activeCompanyId && subject.myCompanyId !== activeCompanyId) return "other_company";
    if ((subject.contractCount ?? 0) === 0) return "no_contract";
    return "active";
  }

  app.get(api.subjects.get.path, isAuthenticated, async (req: any, res) => {
    const subjectId = Number(req.params.id);
    if (req.appUser?.permissionGroupId) {
      const [pg] = await db.select().from(permissionGroups).where(eq(permissionGroups.id, req.appUser.permissionGroupId));
      if (pg?.name === 'Klienti' && req.appUser.linkedSubjectId !== subjectId) {
        return res.status(403).json({ message: "Prístup zamietnutý" });
      }
    }
    const subject = await storage.getSubject(subjectId);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    const masked = decryptBirthNumber(subject);
    const activeCompanyId = req.appUser?.activeCompanyId;
    const isCierny = await storage.isSubjectInGroup(subjectId, "group_cierny_zoznam");
    if (isCierny) {
      (masked as any).effectiveListStatus = "cierny";
    } else if (subject.listStatus === "cerveny") {
      (masked as any).effectiveListStatus = (!subject.redListCompanyId || subject.redListCompanyId === activeCompanyId) ? "cerveny" : null;
    } else {
      (masked as any).effectiveListStatus = null;
    }
    const SENSITIVE_FIELDS = ['birthNumber', 'idCardNumber', 'iban', 'email', 'phone'];
    const hasSensitiveData = SENSITIVE_FIELDS.some(f => (subject as any)[f]);
    if (hasSensitiveData && req.appUser) {
      const accessedFields = SENSITIVE_FIELDS.filter(f => (subject as any)[f]);
      logAudit(req, {
        action: "sensitive_field_access",
        module: "subjects",
        entityId: subjectId,
        entityName: subject.uid || `Subject ${subjectId}`,
        newData: { accessedSensitiveFields: accessedFields },
      }).catch(() => {});
    }
    if (subject.linkedFoId) {
      const linkedFo = await storage.getSubject(subject.linkedFoId);
      if (linkedFo) {
        masked.linkedFo = { id: linkedFo.id, uid: linkedFo.uid, firstName: linkedFo.firstName, lastName: linkedFo.lastName };
      }
    }
    if (req.appUser?.permissionGroupId) {
      const [pg] = await db.select().from(permissionGroups).where(eq(permissionGroups.id, req.appUser.permissionGroupId));
      const pgName = pg?.name?.toLowerCase() || '';
      if (!pgName.includes('superadmin') && !pgName.includes('prezident')) {
        if (masked.uiPreferences) {
          const prefs = { ...(masked.uiPreferences as any) };
          delete prefs.field_notes;
          masked.uiPreferences = prefs;
        }
      }
    } else if (!req.appUser || (!req.appUser.role || (req.appUser.role !== 'superadmin' && req.appUser.role !== 'prezident'))) {
      if (masked.uiPreferences) {
        const prefs = { ...(masked.uiPreferences as any) };
        delete prefs.field_notes;
        masked.uiPreferences = prefs;
      }
    }
    res.json(masked);
  });

  function canViewBirthNumber(appUser: any): boolean {
    if (!appUser) return false;
    return appUser.role === 'superadmin' || appUser.role === 'prezident' || appUser.role === 'admin';
  }


  app.get("/api/subjects/search-fo", isAuthenticated, async (req: any, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string' || q.length < 2) {
        return res.json([]);
      }
      const companyId = req.appUser?.activeCompanyId;
      const allSubjects = await storage.getSubjects(companyId);
      const foSubjects = allSubjects.filter(s => s.type === 'person' && !s.deletedAt);
      const query = q.toLowerCase();
      const queryStripped = stripBallast(query);
      const canView = canViewBirthNumber(req.appUser);
      const results = foSubjects.filter(s => {
        const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
        if (fullName.includes(query)) return true;
        if (s.email && s.email.toLowerCase().includes(query)) return true;
        if (s.uid && s.uid.toLowerCase().includes(query)) return true;
        if (s.phone && stripBallast(s.phone.toLowerCase()).includes(queryStripped)) return true;
        if (s.iban && stripBallast(s.iban.toLowerCase()).includes(queryStripped)) return true;
        const decrypted = decryptField(s.birthNumber);
        if (decrypted && stripBallast(decrypted).includes(queryStripped)) return true;
        return false;
      }).slice(0, 20).map(s => {
        const decryptedBN = decryptField(s.birthNumber);
        const maskedBN = decryptedBN ? (canView ? decryptedBN : decryptedBN.substring(0, 4) + "******") : "";
        return {
          id: s.id,
          uid: s.uid,
          firstName: s.firstName,
          lastName: s.lastName,
          email: s.email,
          phone: s.phone,
          birthNumber: maskedBN,
        };
      });
      res.json(results);
    } catch {
      res.status(500).json({ message: "Chyba pri vyhladavani FO" });
    }
  });

  app.get("/api/entity-links/:subjectId", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID subjektu" });
      const links = await storage.getEntityLinks(subjectId);
      const subjectIds = new Set<number>();
      for (const link of links) {
        subjectIds.add(link.sourceId);
        subjectIds.add(link.targetId);
      }
      const subjectMap = new Map<number, any>();
      for (const sid of subjectIds) {
        const s = await storage.getSubject(sid);
        if (s) subjectMap.set(sid, { id: s.id, uid: s.uid, type: s.type, firstName: s.firstName, lastName: s.lastName, companyName: s.companyName, email: s.email });
      }
      const enriched = links.map(link => ({
        ...link,
        source: subjectMap.get(link.sourceId) || null,
        target: subjectMap.get(link.targetId) || null,
      }));
      res.json(enriched);
    } catch {
      res.status(500).json({ message: "Chyba pri nacitani prepojeni" });
    }
  });

  app.post("/api/entity-links", isAuthenticated, async (req: any, res) => {
    try {
      const { sourceId, targetId } = req.body;
      if (!sourceId || !targetId) return res.status(400).json({ message: "sourceId a targetId su povinne" });
      if (sourceId === targetId) return res.status(400).json({ message: "Subjekt nemoze byt prepojeny sam so sebou" });
      const existing = await storage.getEntityLinks(sourceId);
      const duplicate = existing.find(l => !l.dateTo && ((l.sourceId === sourceId && l.targetId === targetId) || (l.sourceId === targetId && l.targetId === sourceId)));
      if (duplicate) return res.status(400).json({ message: "Toto prepojenie uz existuje" });
      const link = await storage.createEntityLink({
        sourceId,
        targetId,
        dateFrom: new Date(),
        createdByUserId: req.appUser?.id || null,
      });
      res.json(link);
    } catch {
      res.status(500).json({ message: "Chyba pri vytvarani prepojenia" });
    }
  });

  app.patch("/api/entity-links/:id/close", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Neplatné ID" });
      const link = await storage.closeEntityLink(id);
      res.json(link);
    } catch {
      res.status(500).json({ message: "Chyba pri uzatvarani prepojenia" });
    }
  });

  app.post(api.subjects.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.subjects.create.input.parse(req.body);

      if (input.birthNumber && (input.type === "person" || input.type === "szco")) {
        const rcResult = validateSlovakRC(input.birthNumber);
        if (!rcResult.valid) {
          return res.status(400).json({ message: `Neplatné rodné číslo: ${rcResult.error}` });
        }
      }

      const inputIco = (input.details as any)?.ico || (input as any).szcoIco || (input.details as any)?.dynamicFields?.ico || (input.details as any)?.dynamicFields?.zi_ico;
      if (inputIco && (input.type === "company" || input.type === "szco" || input.type === "organization")) {
        const icoResult = validateSlovakICO(inputIco);
        if (!icoResult.valid) {
          return res.status(400).json({ message: `Neplatné IČO: ${icoResult.error}` });
        }
        if (icoResult.normalized && input.details && typeof input.details === 'object') {
          (input.details as any).ico = icoResult.normalized;
          if ((input.details as any)?.dynamicFields?.ico) {
            (input.details as any).dynamicFields.ico = icoResult.normalized;
          }
          if ((input.details as any)?.dynamicFields?.zi_ico) {
            (input.details as any).dynamicFields.zi_ico = icoResult.normalized;
          }
        }
      }

      const dupIco = (input.details as any)?.ico || (input as any).szcoIco;
      if (input.birthNumber || dupIco) {
        const dupCheck = await storage.checkDuplicateSubject({ birthNumber: input.birthNumber || undefined, ico: dupIco || undefined });
        if (dupCheck) {
          const isBlacklisted = await storage.isSubjectInGroup(dupCheck.id, "group_cierny_zoznam");
          if (isBlacklisted) {
            return res.status(403).json({ message: "Registráciu nie je možné dokončiť. Kontaktujte správcu." });
          }
        }
      }

      if (req.appUser?.activeCompanyId) {
        input.myCompanyId = req.appUser.activeCompanyId;
      }
      if (req.appUser?.activeStateId) {
        input.stateId = req.appUser.activeStateId;
      }
      if (req.appUser?.id) {
        input.registeredByUserId = req.appUser.id;
      }

      if (!input.registrationStatus) {
        const hasName = !!(input.firstName || input.companyName);
        const hasContact = !!(input.email || input.phone);
        const hasType = !!(input.type && input.type !== '');
        if (hasType && hasName) {
          input.registrationStatus = 'tiper';
        } else if (hasName && hasContact) {
          input.registrationStatus = 'potencialny';
        } else {
          input.registrationStatus = 'tiper';
        }
      }

      if (input.firstName) input.firstName = capitalizeName(input.firstName) ?? input.firstName;
      if (input.lastName) input.lastName = capitalizeName(input.lastName) ?? input.lastName;

      if (input.type === 'szco') {
        if (input.birthNumber) {
          input.birthNumber = encryptField(input.birthNumber);
        }
        if (!input.linkedFoId) input.linkedFoId = null;
        const created = await storage.createSubject(input);
        await logAudit(req, { action: "CREATE", module: "subjekty", entityId: created.id, entityName: created.companyName || `${created.firstName} ${created.lastName} - SZCO ${created.uid}`, newData: { ...input, birthNumber: undefined } });
        res.status(201).json(decryptBirthNumber(created));
      } else {
        if (input.birthNumber) {
          input.birthNumber = encryptField(input.birthNumber);
        }
        const created = await storage.createSubject(input);
        await logAudit(req, { action: "CREATE", module: "subjekty", entityId: created.id, entityName: (created.firstName ? created.firstName + ' ' + created.lastName : created.companyName) || undefined, newData: { ...input, birthNumber: input.birthNumber ? '***' : undefined } });
        res.status(201).json(decryptBirthNumber(created));
      }
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message.includes("hierarchy")) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.put(api.subjects.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });

      const subjectId = Number(req.params.id);
      const original = await storage.getSubject(subjectId);
      if (!original) return res.status(404).json({ message: "Subject not found" });

      const isAdmin = appUser.role === 'admin' || appUser.role === 'superadmin' || appUser.role === 'prezident';

      const input = api.subjects.update.input.parse(req.body);

      if (!isAdmin) {
        delete input.birthNumber;
        if (input.details && typeof input.details === 'object') {
          const existingDetails = (original.details as any) || {};
          if (existingDetails.ico) {
            (input.details as any).ico = existingDetails.ico;
          }
        }
      }

      if (input.birthNumber) {
        const rcResult = validateSlovakRC(input.birthNumber);
        if (!rcResult.valid) {
          return res.status(400).json({ message: `Neplatné rodné číslo: ${rcResult.error}` });
        }
        input.birthNumber = encryptField(input.birthNumber);
      }

      const updateIco = (input.details as any)?.ico || (input.details as any)?.dynamicFields?.ico || (input.details as any)?.dynamicFields?.zi_ico;
      if (updateIco && (original.type === "company" || original.type === "szco" || original.type === "organization")) {
        const icoResult = validateSlovakICO(updateIco);
        if (!icoResult.valid) {
          return res.status(400).json({ message: `Neplatné IČO: ${icoResult.error}` });
        }
        if (icoResult.normalized && input.details && typeof input.details === 'object') {
          (input.details as any).ico = icoResult.normalized;
          if ((input.details as any)?.dynamicFields?.ico) {
            (input.details as any).dynamicFields.ico = icoResult.normalized;
          }
          if ((input.details as any)?.dynamicFields?.zi_ico) {
            (input.details as any).dynamicFields.zi_ico = icoResult.normalized;
          }
        }
      }

      const changedFields: Record<string, { old: any; new: any }> = {};
      const fieldsToTrack = ['firstName', 'lastName', 'companyName', 'email', 'phone', 'idCardNumber', 'continentId', 'stateId', 'details'] as const;
      for (const field of fieldsToTrack) {
        const oldVal = (original as any)[field];
        const newVal = (input as any)[field];
        if (newVal !== undefined && JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
          changedFields[field] = { old: oldVal, new: newVal };
        }
      }

      input.changeReason = input.changeReason || "Manualna editacia cez Register subjektov";
      if (input.firstName) input.firstName = capitalizeName(input.firstName) ?? input.firstName;
      if (input.lastName) input.lastName = capitalizeName(input.lastName) ?? input.lastName;

      const docFieldKeys = ["typ_dokladu", "cislo_dokladu", "platnost_dokladu", "kod_vydavajuceho_organu"];
      const oldDetails = (original.details as any) || {};
      const oldDynamic = oldDetails.dynamicFields || oldDetails;
      const newDetails = (input.details as any) || {};
      const newDynamic = newDetails.dynamicFields || newDetails;

      const oldDocuments: any[] = oldDynamic.documents || [];
      const newDocuments: any[] = newDynamic.documents || [];

      const oldDocType = oldDynamic.typ_dokladu || "";
      const oldDocNumber = oldDynamic.cislo_dokladu || "";
      const oldDocValidity = oldDynamic.platnost_dokladu || "";
      const oldDocIssuedBy = oldDynamic.vydal_organ || "";
      const oldDocAuthority = oldDynamic.kod_vydavajuceho_organu || "";
      const oldCustomDocType = oldDynamic.typ_dokladu_iny || "";

      if (oldDocuments.length > 0 || newDocuments.length > 0) {
        const oldDocIds = new Set(oldDocuments.map((d: any) => d.id));
        const newDocIds = new Set(newDocuments.map((d: any) => d.id));
        
        for (const oldDoc of oldDocuments) {
          const newDoc = newDocuments.find((d: any) => d.id === oldDoc.id);
          const removed = !newDocIds.has(oldDoc.id);
          const changed = newDoc && (
            newDoc.documentType !== oldDoc.documentType ||
            newDoc.documentNumber !== oldDoc.documentNumber ||
            newDoc.validUntil !== oldDoc.validUntil
          );
          if (removed || changed) {
            await storage.createClientDocumentHistory({
              subjectId,
              documentType: oldDoc.documentType || null,
              customDocType: oldDoc.customDocType || null,
              documentNumber: oldDoc.documentNumber || null,
              validUntil: oldDoc.validUntil || null,
              issuedBy: oldDoc.issuedBy || null,
              issuingAuthorityCode: oldDoc.issuingAuthorityCode || null,
              archivedByUserId: appUser.id,
            });
          }
        }
      } else {
        const newDocType = newDynamic.typ_dokladu;
        const newDocNumber = newDynamic.cislo_dokladu;

        const hasOldDocData = oldDocType || oldDocNumber || oldDocValidity;
        const docChanged = hasOldDocData && (
          (newDocType !== undefined && newDocType !== oldDocType) ||
          (newDocNumber !== undefined && newDocNumber !== oldDocNumber)
        );

        if (docChanged) {
          await storage.createClientDocumentHistory({
            subjectId,
            documentType: oldDocType || null,
            customDocType: oldCustomDocType || null,
            documentNumber: oldDocNumber || null,
            validUntil: oldDocValidity || null,
            issuedBy: oldDocIssuedBy || null,
            issuingAuthorityCode: oldDocAuthority || null,
            archivedByUserId: appUser.id,
          });
        }
      }

      const updated = await storage.updateSubject(subjectId, input);
      await logAudit(req, {
        action: "UPDATE",
        module: "subjekty",
        entityId: subjectId,
        entityName: (updated.firstName ? updated.firstName + ' ' + updated.lastName : updated.companyName) || undefined,
        newData: {
          ...input,
          birthNumber: input.birthNumber ? '***' : undefined,
          _changedFields: changedFields,
          _editSource: "register_subjektov",
          _documentArchived: docChanged || false,
        },
      });

      const fieldIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
      for (const [field, vals] of Object.entries(changedFields)) {
        if (field === 'details') continue;
        await db.insert(activityEvents).values({
          subjectId,
          eventType: "field_change",
          fieldName: field,
          oldValue: vals.old != null ? String(vals.old) : null,
          newValue: vals.new != null ? String(vals.new) : null,
          userId: appUser.id,
          username: appUser.username,
          ipAddress: typeof fieldIp === 'string' ? fieldIp : JSON.stringify(fieldIp),
        });
      }

      // === FAMILY INHERITANCE CHECK: Detect address changes on parent subjects ===
      try {
        if (changedFields['details']) {
          const oldDet = (changedFields['details'].old as any) || {};
          const newDet = (changedFields['details'].new as any) || {};
          const oldDyn = oldDet.dynamicFields || oldDet;
          const newDyn = newDet.dynamicFields || newDet;
          const addrFields = ['adr_ulica', 'adr_cislo_domu', 'adr_obec', 'adr_psc', 'adr_okres', 'adr_kraj', 'adr_stat'];
          const changedAddr: Record<string, any> = {};
          const changedAddrOld: Record<string, any> = {};
          for (const fk of addrFields) {
            if (newDyn[fk] !== undefined && String(newDyn[fk] || '') !== String(oldDyn[fk] || '')) {
              changedAddr[fk] = newDyn[fk];
              changedAddrOld[fk] = oldDyn[fk] || null;
            }
          }
          if (Object.keys(changedAddr).length > 0) {
            const childLinks = await db.select({
              relation: subjectRelations,
              roleType: relationRoleTypes,
            })
              .from(subjectRelations)
              .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
              .where(and(
                eq(subjectRelations.sourceSubjectId, subjectId),
                eq(subjectRelations.isActive, true),
                eq(relationRoleTypes.category, "rodina"),
                sql`${relationRoleTypes.code} IN ('dieta_opravnena_osoba', 'vnuk_vnucka')`,
              ));
            for (const cl of childLinks) {
              await db.insert(inheritancePrompts).values({
                sourceSubjectId: subjectId,
                targetSubjectId: cl.relation.targetSubjectId,
                relationId: cl.relation.id,
                fieldKeys: Object.keys(changedAddr),
                fieldLabels: Object.keys(changedAddr).map(k => k.replace('adr_', 'Adresa: ')),
                oldValues: changedAddrOld,
                newValues: changedAddr,
                status: "pending",
              });
            }
          }
        }
      } catch (inhErr) {
        console.error("[INHERITANCE CHECK ERROR]", inhErr);
      }

      res.json(decryptBirthNumber(updated));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message === "Subject not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });
  
  app.get("/api/subjects/:id/document-history", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const subjectId = Number(req.params.id);
      const subject = await storage.getSubject(subjectId);
      if (!subject) return res.status(404).json({ message: "Subject not found" });
      if (subject.myCompanyId !== appUser.activeCompanyId) {
        return res.status(403).json({ message: "Pristup zamietnuty - subjekt nepatri do vasej firmy" });
      }
      const history = await storage.getClientDocumentHistory(subjectId);
      res.json(history);
    } catch (err) {
      throw err;
    }
  });

  app.post(api.subjects.archive.path, isAuthenticated, async (req, res) => {
    try {
      await storage.archiveSubject(Number(req.params.id), req.body.reason);
      await logAudit(req, { action: "ARCHIVE", module: "subjekty", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error && err.message === "Subject not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  // === GLOBAL PRODUCT CATALOG ===
  app.get(api.products.list.path, isAuthenticated, async (req: any, res) => {
    const includeDeleted = req.query.includeDeleted === 'true';
    res.json(await storage.getProducts(includeDeleted));
  });

  app.get(api.products.get.path, isAuthenticated, async (req, res) => {
    const product = await storage.getProduct(Number(req.params.id));
    if (!product) return res.status(404).json({ message: "Product not found" });
    res.json(product);
  });

  app.post(api.products.create.path, isAuthenticated, async (req, res) => {
    try {
      const { dynamicParams, ...body } = req.body;
      const input = api.products.create.input.parse(body);

      if (input.partnerId && input.companyId) {
        const contracts = await storage.getPartnerContracts(input.partnerId);
        const hasContract = contracts.some(c => c.companyId === input.companyId);
        if (!hasContract) {
          return res.status(400).json({ message: "Partner nema aktivnu zmluvu s vasou spolocnostou. Najprv vytvorte zmluvu v module Partneri a produkty > Partner > Zmluvy." });
        }
      }

      const created = await storage.createProduct(input);
      await logAudit(req, { action: "CREATE", module: "produkty", newData: input });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.products.update.path, isAuthenticated, async (req, res) => {
    try {
      const { dynamicParams, ...updateBody } = req.body;
      const input = api.products.update.input.parse(updateBody);
      const updated = await storage.updateProduct(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "produkty", entityId: Number(req.params.id), newData: input });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message === "Product not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  app.delete(api.products.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      if (!appUser) return res.status(404).json({ message: "User not found" });

      const { adminCode, superAdminCode } = req.body || {};
      if (!adminCode) return res.status(400).json({ message: "Admin code required" });

      if (appUser.role !== 'admin' && appUser.role !== 'superadmin') {
        return res.status(403).json({ message: "Only admins can delete products" });
      }

      await storage.softDeleteProduct(Number(req.params.id), appUser.username, typeof ip === 'string' ? ip : '');
      await logAudit(req, { action: "DELETE", module: "produkty", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error && err.message === "Product not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  app.get(api.products.byPartner.path, isAuthenticated, async (req, res) => {
    res.json(await storage.getProductsByPartner(Number(req.params.partnerId)));
  });

  // === COMMISSIONS ===
  app.get(api.commissions.list.path, isAuthenticated, async (req, res) => {
    const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
    res.json(await storage.getCommissions(productId));
  });

  app.post(api.commissions.create.path, isAuthenticated, async (req, res) => {
    try {
      const parsed = api.commissions.create.input.parse(req.body);
      const created = await storage.createCommission(parsed);
      await logAudit(req, { action: "CREATE", module: "provizie", newData: parsed });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // === COMMISSION RATES (Sadzby) ===
  app.get(api.commissionRatesApi.list.path, isAuthenticated, async (req: any, res) => {
    const partnerId = req.query.partnerId ? parseInt(req.query.partnerId as string) : undefined;
    const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
    const stateId = getEnforcedStateId(req);
    const isActive = req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined;
    res.json(await storage.getCommissionRates({ partnerId, productId, stateId, isActive }));
  });

  app.get(api.commissionRatesApi.get.path, isAuthenticated, async (req, res) => {
    const rate = await storage.getCommissionRate(Number(req.params.id));
    if (!rate) return res.status(404).json({ message: "Sadzba nenajdena" });
    res.json(rate);
  });

  app.post(api.commissionRatesApi.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const enforcedState = getEnforcedStateId(req);
      const data = {
        ...req.body,
        stateId: enforcedState || req.body.stateId,
        companyId: appUser?.activeCompanyId || req.body.companyId,
        createdBy: appUser?.username || "system",
        validFrom: req.body.validFrom ? new Date(req.body.validFrom) : undefined,
        validTo: req.body.validTo ? new Date(req.body.validTo) : undefined,
      };
      const created = await storage.createCommissionRate(data);
      await logAudit(req, { action: "CREATE", module: "sadzby", entityId: created.id, newData: data });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.commissionRatesApi.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const old = await storage.getCommissionRate(id);
      if (!old) return res.status(404).json({ message: "Sadzba nenajdena" });
      const body = { ...req.body };
      if (body.validFrom) body.validFrom = new Date(body.validFrom);
      if (body.validTo) body.validTo = new Date(body.validTo);
      const updated = await storage.updateCommissionRate(id, body);
      await logAudit(req, { action: "UPDATE", module: "sadzby", entityId: id, oldData: old, newData: req.body });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.commissionRatesApi.delete.path, isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    const old = await storage.getCommissionRate(id);
    if (!old) return res.status(404).json({ message: "Sadzba nenajdena" });
    await storage.deleteCommissionRate(id);
    await logAudit(req, { action: "DELETE", module: "sadzby", entityId: id, oldData: old });
    res.json({ success: true });
  });

  // === PROVZIE (Incoming commissions from partners) ===
  app.get("/api/provizie", isAuthenticated, async (req: any, res) => {
    const stateId = getEnforcedStateId(req);
    res.json(await storage.getProvizieData(stateId));
  });

  // === ODMENY (Outgoing payments to agents) ===
  app.get("/api/odmeny", isAuthenticated, async (req: any, res) => {
    const stateId = getEnforcedStateId(req);
    res.json(await storage.getOdmenyData(stateId));
  });

  // === COMMISSION CALCULATION ===
  app.post("/api/commission-calculate", isAuthenticated, async (req: any, res) => {
    try {
      const { contractId, agentId, processingTimeSec } = req.body;
      const appUser = req.appUser;

      const contract = await storage.getContract(contractId);
      if (!contract) return res.status(404).json({ message: "Zmluva nenajdena" });

      const rates = await storage.getCommissionRates({
        partnerId: contract.partnerId || undefined,
        productId: contract.productId || undefined,
        isActive: true
      });

      if (rates.length === 0) return res.status(400).json({ message: "Ziadna aktivna sadzba pre tuto kombinaciu partnera a produktu" });
      const rate = rates[0];

      const agent = agentId ? (await storage.getAppUsers()).find(u => u.id === agentId) : null;
      const agentLevel = agent?.commissionLevel || 1;

      let managerId: number | null = null;
      let managerLevel: number | null = null;
      if (agent?.managerId) {
        const manager = (await storage.getAppUsers()).find(u => u.id === agent.managerId);
        if (manager) {
          managerId = manager.id;
          managerLevel = manager.commissionLevel || 1;
        }
      }

      const premium = contract.premiumAmount || 0;
      const rateValue = parseFloat(rate.rateValue);
      let baseCommission = 0;

      if (rate.rateType === 'percent') {
        baseCommission = Math.round(premium * rateValue / 100 * 100) / 100;
      } else if (rate.rateType === 'fixed') {
        baseCommission = rateValue;
      }

      let differentialCommission = 0;
      if (managerId && managerLevel && managerLevel > agentLevel) {
        const levelDiff = managerLevel - agentLevel;
        differentialCommission = Math.round(baseCommission * levelDiff * 0.1 * 100) / 100;
      }

      const pointsFactor = parseFloat(rate.pointsFactor || "1");
      const pointsEarned = Math.round(premium * pointsFactor / 100 * 10000) / 10000;

      let isRedirected = false;
      let redirectReason: string | null = null;
      let effectiveManagerId = managerId;
      let effectiveManagerLevel = managerLevel;

      if ((contract as any).isFirstContract && (contract as any).commissionRedirectedToUserId) {
        isRedirected = true;
        redirectReason = "Pravidlo prvej zmluvy v divízii — 100% UP+NP presmerované na nadriadeného";
        effectiveManagerId = (contract as any).commissionRedirectedToUserId;
        const allUsers = await storage.getAppUsers();
        const redirectedManager = allUsers.find((u: any) => u.id === effectiveManagerId);
        if (redirectedManager) {
          effectiveManagerLevel = redirectedManager.commissionLevel || 1;
        }
      }

      const logData = {
        contractId,
        contractNumber: contract.contractNumber,
        rateId: rate.id,
        agentId: agentId || null,
        agentLevel,
        managerId: isRedirected ? effectiveManagerId : managerId,
        managerLevel: isRedirected ? effectiveManagerLevel : managerLevel,
        premiumAmount: String(premium),
        rateType: rate.rateType,
        rateValue: rate.rateValue,
        baseCommission: isRedirected ? "0" : String(baseCommission),
        differentialCommission: isRedirected ? "0" : String(differentialCommission),
        totalCommission: isRedirected ? "0" : String(baseCommission + differentialCommission),
        pointsEarned: isRedirected ? "0" : String(pointsEarned),
        actorId: appUser?.id || null,
        actorUsername: appUser?.username || "system",
        processingTimeSec: processingTimeSec ? Math.round(processingTimeSec) : 0,
        isRedirected,
        redirectReason,
        inputSnapshot: { contractId, agentId, rateId: rate.id, premium, rateValue, agentLevel, managerLevel, isRedirected, redirectedTo: (contract as any).commissionRedirectedToName || null },
      };

      const calcLog = await storage.createCommissionCalculationLog(logData);

      if (isRedirected && effectiveManagerId) {
        const managerLogData = {
          ...logData,
          agentId: effectiveManagerId,
          agentLevel: effectiveManagerLevel,
          managerId: null as number | null,
          managerLevel: null as number | null,
          baseCommission: String(baseCommission),
          differentialCommission: String(differentialCommission),
          totalCommission: String(baseCommission + differentialCommission),
          pointsEarned: String(pointsEarned),
          isRedirected: true,
          redirectReason: `Prevzaté z prvej zmluvy agenta (pôvodný agent ID: ${agentId})`,
        };
        await storage.createCommissionCalculationLog(managerLogData);
      }

      await logAudit(req, { action: "CALCULATE", module: "provizie", entityId: contractId, newData: logData });

      res.json({
        success: true,
        calculation: calcLog,
        baseCommission: isRedirected ? 0 : baseCommission,
        differentialCommission: isRedirected ? 0 : differentialCommission,
        totalCommission: isRedirected ? 0 : baseCommission + differentialCommission,
        pointsEarned: isRedirected ? 0 : pointsEarned,
        isRedirected,
        redirectedTo: isRedirected ? (contract as any).commissionRedirectedToName : null,
      });
    } catch (err: any) {
      console.error("Commission calculation error:", err);
      res.status(500).json({ message: err.message || "Chyba pri vypocte provizie" });
    }
  });

  // === COMMISSION CALCULATION LOGS ===
  app.get("/api/commission-calculation-logs", isAuthenticated, async (req: any, res) => {
    const contractId = req.query.contractId ? parseInt(req.query.contractId as string) : undefined;
    const agentId = req.query.agentId ? parseInt(req.query.agentId as string) : undefined;
    const managerId = req.query.managerId ? parseInt(req.query.managerId as string) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    res.json(await storage.getCommissionCalculationLogs({ contractId, agentId, managerId, limit }));
  });

  // === PERMISSION GROUPS ===
  app.get(api.permissionGroups.list.path, isAuthenticated, async (_req, res) => {
    res.json(await storage.getPermissionGroups());
  });

  app.post(api.permissionGroups.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.permissionGroups.create.input.parse(req.body);
      if (input.sessionTimeoutSeconds !== undefined && input.sessionTimeoutSeconds < 60) {
        return res.status(400).json({ message: "Minimalna doba prihlasenia je 60 sekund" });
      }
      const created = await storage.createPermissionGroup(input);
      await logAudit(req, { action: "CREATE", module: "skupiny_pravomoci", entityName: input.name, newData: input });
      const linkedClientGroup = await storage.createClientGroup({
        name: created.name,
        permissionGroupId: created.id,
      });
      await logAudit(req, { action: "CREATE", module: "skupiny_klientov", entityId: linkedClientGroup.id, entityName: linkedClientGroup.name, newData: { autoLinked: true, permissionGroupId: created.id } });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.permissionGroups.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.permissionGroups.update.input.parse(req.body);
      if (input.sessionTimeoutSeconds !== undefined && input.sessionTimeoutSeconds < 60) {
        return res.status(400).json({ message: "Minimalna doba prihlasenia je 60 sekund" });
      }
      const updated = await storage.updatePermissionGroup(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "skupiny_pravomoci", entityId: Number(req.params.id) });
      if (input.name) {
        const linkedCg = await storage.getClientGroupByPermissionGroupId(Number(req.params.id));
        if (linkedCg) {
          await storage.updateClientGroup(linkedCg.id, { name: input.name });
          await logAudit(req, { action: "UPDATE", module: "skupiny_klientov", entityId: linkedCg.id, entityName: input.name, newData: { nameSyncFromPermissionGroup: true } });
        } else {
          const created = await storage.createClientGroup({ name: input.name, permissionGroupId: Number(req.params.id) });
          await logAudit(req, { action: "CREATE", module: "skupiny_klientov", entityId: created.id, entityName: input.name, newData: { autoLinkedOnUpdate: true } });
        }
      }
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.delete(api.permissionGroups.delete.path, isAuthenticated, async (req, res) => {
    try {
      const groupId = Number(req.params.id);
      const allUsers = await storage.getAppUsers();
      const usersInGroup = allUsers.filter(u => u.permissionGroupId === groupId);
      if (usersInGroup.length > 0) {
        return res.status(400).json({ message: `Skupinu pravomoci nie je mozne vymazat, obsahuje ${usersInGroup.length} pouzivatelov` });
      }
      await storage.deletePermissionGroup(groupId);
      await logAudit(req, { action: "DELETE", module: "skupiny_pravomoci", entityId: groupId });
      res.json({ success: true });
    } catch (err) {
      throw err;
    }
  });

  // === PERMISSIONS MATRIX ===
  app.get(api.permissionsMatrix.list.path, isAuthenticated, async (_req, res) => {
    res.json(await storage.getAllPermissions());
  });

  app.get(api.permissionsMatrix.byGroup.path, isAuthenticated, async (req, res) => {
    res.json(await storage.getPermissions(Number(req.params.groupId)));
  });

  app.put(api.permissionsMatrix.set.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.permissionsMatrix.set.input.parse(req.body);
      const result = await storage.setPermission(input);
      await logAudit(req, { action: "UPDATE", module: "skupiny_pravomoci", entityName: "permission" });
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.post(api.permissionsMatrix.sync.path, isAuthenticated, async (_req, res) => {
    await storage.syncPermissionsTable();
    await logAudit(_req, { action: "SYNC", module: "skupiny_pravomoci" });
    res.json({ success: true });
  });

  // === USER MANAGEMENT (Admin) ===
  app.get(api.appUserAdmin.list.path, isAuthenticated, async (_req, res) => {
    res.json(await storage.getAppUsers());
  });

  app.post(api.appUserAdmin.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.appUserAdmin.create.input.parse(req.body);
      if ((input as any).securityLevel !== undefined || (input as any).allowedIps !== undefined) {
        if (!isArchitekt(req.appUser)) {
          return res.status(403).json({ message: "Zmena bezpečnostnej úrovne vyžaduje Architekta" });
        }
      }
      const createData: any = { ...input };
      const created = await storage.createAppUser(createData);
      await logAudit(req, { action: "CREATE", module: "pouzivatelia", entityName: input.username });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.appUserAdmin.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.appUserAdmin.update.input.parse(req.body);
      if ((input as any).securityLevel !== undefined || (input as any).allowedIps !== undefined || (input as any).adminCode !== undefined) {
        if (!isArchitekt(req.appUser)) {
          return res.status(403).json({ message: "Zmena bezpečnostnej úrovne vyžaduje Architekta" });
        }
      }
      const updated = await storage.updateAppUserWithArchive(Number(req.params.id), input, "User profile update");
      await logAudit(req, { action: "UPDATE", module: "pouzivatelia", entityId: Number(req.params.id) });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message === "App user not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  // === FILE UPLOAD / DOWNLOAD / DELETE ===
  app.post("/api/my-companies/:companyId/files/:section", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const section = req.params.section as "official" | "work" | "logos";
      if (!["official", "work", "logos"].includes(section)) return res.status(400).json({ message: "Invalid section" });

      const company = await storage.getMyCompany(companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      const secScan = await scanUploadedFile(file.path, file.originalname, file.mimetype);
      if (!secScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: ${secScan.reason}` });

      if (section === "logos") {
        const logoEntry = {
          name: file.originalname,
          url: `/api/files/logos/${file.filename}`,
          uploadedAt: new Date().toISOString(),
          isPrimary: true,
          isArchived: false,
        };

        const currentLogos = (company.logos as any[]) || [];
        const primaryLogo = currentLogos.find((l: any) => l.isPrimary && !l.isArchived);
        if (primaryLogo) {
          await storage.addCompanyLogoHistory(companyId, primaryLogo.url, primaryLogo.name);
        }
        const archivedLogos = currentLogos.map((l: any) => ({ ...l, isPrimary: false, isArchived: l.isPrimary ? true : l.isArchived }));
        const updatedLogos = [...archivedLogos, logoEntry];

        await storage.updateMyCompany(companyId, { logos: updatedLogos, changeReason: `Logo uploaded: ${file.originalname}` });
        res.status(201).json(logoEntry);
      } else {
        const docEntry = {
          name: file.originalname,
          url: `/api/files/${section}/${file.filename}`,
          uploadedAt: new Date().toISOString(),
        };

        const docsField = section === "official" ? "officialDocs" : "workDocs";
        const currentDocs = (company[docsField] as any[]) || [];
        const updatedDocs = [...currentDocs, docEntry];

        await storage.updateMyCompany(companyId, { [docsField]: updatedDocs, changeReason: `File uploaded: ${file.originalname}` });
        res.status(201).json(docEntry);
      }
    } catch (err) {
      console.error("File upload error:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  app.get("/api/files/:section/:filename", isAuthenticated, (req, res) => {
    const section = req.params.section as string;
    const filename = req.params.filename as string;
    if (!["official", "work", "logos", "amendments", "profiles", "flags", "status-change-docs", "generated-docs"].includes(section)) return res.status(400).json({ message: "Invalid section" });
    const filePath = path.join(UPLOADS_DIR, section, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
    res.setHeader("X-Content-Type-Options", "nosniff");
    const ext = path.extname(filename).toLowerCase();
    const inlineTypes = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".pdf"]);
    if (!inlineTypes.has(ext)) {
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }
    res.sendFile(filePath);
  });

  app.delete("/api/my-companies/:companyId/files/:section", isAuthenticated, async (req, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const section = req.params.section as "official" | "work";
      const { fileUrl } = req.body;

      const company = await storage.getMyCompany(companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      const docsField = section === "official" ? "officialDocs" : "workDocs";
      const currentDocs = (company[docsField] as any[]) || [];
      const updatedDocs = currentDocs.filter((d: any) => d.url !== fileUrl);

      const filename = fileUrl.split("/").pop();
      if (filename) {
        const filePath = path.join(UPLOADS_DIR, section, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }

      await storage.updateMyCompany(companyId, { [docsField]: updatedDocs, changeReason: `File deleted` });
      res.json({ success: true });
    } catch (err) {
      console.error("File delete error:", err);
      res.status(500).json({ message: "Delete failed" });
    }
  });

  // === LOGO MANAGEMENT (set primary / archive) ===
  app.put("/api/my-companies/:companyId/logos/set-primary", isAuthenticated, async (req, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const { logoUrl } = req.body;
      const company = await storage.getMyCompany(companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      const currentLogos = (company.logos as any[]) || [];
      const updatedLogos = currentLogos.map((l: any) => ({
        ...l,
        isPrimary: l.url === logoUrl,
        isArchived: l.url === logoUrl ? false : (l.isPrimary ? true : l.isArchived),
      }));

      await storage.updateMyCompany(companyId, { logos: updatedLogos, changeReason: "Logo set as primary" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to set primary logo" });
    }
  });

  // === STATE ISOLATION HELPER ===
  function getEnforcedStateId(req: any): number | undefined {
    const queryStateId = req.query.stateId ? parseInt(req.query.stateId as string) : undefined;
    const appUser = req.appUser;
    return queryStateId || appUser?.activeStateId || undefined;
  }

  // === CONTRACT STATUSES ===
  app.get(api.contractStatusesApi.list.path, isAuthenticated, async (req: any, res) => {
    res.json(await storage.getContractStatuses(getEnforcedStateId(req)));
  });

  app.get("/api/contract-statuses/usage-counts", isAuthenticated, async (_req: any, res) => {
    try {
      const counts = await storage.getContractStatusUsageCounts();
      res.json(counts);
    } catch (err) {
      res.status(500).json({ message: "Chyba pri nacitani poctu pouziti" });
    }
  });

  app.post(api.contractStatusesApi.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.contractStatusesApi.create.input.parse(req.body);
      const created = await storage.createContractStatus(input);
      await logAudit(req, { action: "CREATE", module: "stavy_zmluv", entityId: created.id, entityName: created.name, newData: input });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/contract-statuses/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const { items } = req.body;
      await storage.reorderContractStatuses(items);
      await logAudit(req, { action: "UPDATE", module: "stavy_zmluv", entityName: "reorder" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put(api.contractStatusesApi.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.contractStatusesApi.update.input.parse(req.body);
      const updated = await storage.updateContractStatus(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "stavy_zmluv", entityId: Number(req.params.id), newData: input });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(api.contractStatusesApi.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const statusId = Number(req.params.id);
      const allContracts = await storage.getContracts();
      const contractsWithStatus = allContracts.filter(c => c.statusId === statusId);
      if (contractsWithStatus.length > 0) {
        return res.status(400).json({ message: `Stav zmluvy nie je mozne vymazat, pouziva ho ${contractsWithStatus.length} zmluv` });
      }
      await storage.deleteContractStatus(statusId);
      await logAudit(req, { action: "DELETE", module: "stavy_zmluv", entityId: statusId });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CONTRACT STATUS COMPANIES (ArutsoK 49) ===
  app.get("/api/contract-statuses/:id/companies", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getContractStatusCompanies(Number(req.params.id)));
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.put("/api/contract-statuses/:id/companies", isAuthenticated, async (req: any, res) => {
    try {
      const { companyIds } = req.body;
      await storage.setContractStatusCompanies(Number(req.params.id), companyIds || []);
      await logAudit(req, { action: "UPDATE", module: "stavy_zmluv_companies", entityId: Number(req.params.id), newData: { companyIds } });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  // === CONTRACT STATUS VISIBILITY (ArutsoK 49) ===
  app.get("/api/contract-statuses/:id/visibility", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getContractStatusVisibility(Number(req.params.id)));
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.put("/api/contract-statuses/:id/visibility", isAuthenticated, async (req: any, res) => {
    try {
      const { items } = req.body;
      await storage.setContractStatusVisibility(Number(req.params.id), items || []);
      await logAudit(req, { action: "UPDATE", module: "stavy_zmluv_visibility", entityId: Number(req.params.id), newData: { items } });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  // === CONTRACT STATUS CONTRACT TYPES ===
  app.get("/api/contract-statuses/:id/contract-types", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getContractStatusContractTypes(Number(req.params.id)));
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.put("/api/contract-statuses/:id/contract-types", isAuthenticated, async (req: any, res) => {
    try {
      const { contractTypes } = req.body;
      const validTypes = ["Nova", "Prestupova", "Zmenova"];
      const filtered = (contractTypes || []).filter((t: string) => validTypes.includes(t));
      await storage.setContractStatusContractTypes(Number(req.params.id), filtered);
      await logAudit(req, { action: "UPDATE", module: "stavy_zmluv_contract_types", entityId: Number(req.params.id), newData: { contractTypes: filtered } });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.get("/api/contract-statuses/all-contract-types", isAuthenticated, async (_req: any, res) => {
    try {
      const all = await storage.getAllContractStatusContractTypes();
      const result: Record<number, string[]> = {};
      for (const item of all) {
        if (!result[item.statusId]) result[item.statusId] = [];
        result[item.statusId].push(item.contractType);
      }
      res.json(result);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  // === CONTRACT STATUS PARAMETERS (ArutsoK 49) ===
  app.get("/api/contract-statuses/:id/parameters", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getContractStatusParameters(Number(req.params.id)));
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/contract-statuses/:id/parameters", isAuthenticated, async (req: any, res) => {
    try {
      const data = { ...req.body, statusId: Number(req.params.id) };
      const created = await storage.createContractStatusParameter(data);
      await logAudit(req, { action: "CREATE", module: "stavy_zmluv_parameters", entityId: created.id, newData: data });
      res.status(201).json(created);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.put("/api/contract-status-parameters/:id", isAuthenticated, async (req: any, res) => {
    try {
      const updated = await storage.updateContractStatusParameter(Number(req.params.id), req.body);
      await logAudit(req, { action: "UPDATE", module: "stavy_zmluv_parameters", entityId: Number(req.params.id), newData: req.body });
      res.json(updated);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.delete("/api/contract-status-parameters/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteContractStatusParameter(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "stavy_zmluv_parameters", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.put("/api/contract-status-parameters/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const { items } = req.body;
      await storage.reorderContractStatusParameters(items);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  // === CONTRACT STATUS CHANGE LOGS (ArutsoK 49) ===
  app.get("/api/contracts/:id/status-change-logs", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getContractStatusChangeLogs(Number(req.params.id)));
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  // === STATUS CHANGE MODAL (ArutsoK 51 - full status change with tabs data) ===
  app.post("/api/contracts/:id/status-change", isAuthenticated, (req, _res, next) => {
    (req as any)._uploadSection = "status-change-docs";
    next();
  }, upload.array("documents", 50), async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const contractId = Number(req.params.id);
      const contract = await storage.getContract(contractId);
      if (!contract) return res.status(404).json({ message: "Zmluva nenajdena" });

      if (!isAdmin(appUser)) {
        const isOwner = contract.uploadedByUserId === appUser.id;
        const inChain = await isInManagerChain(appUser.id, contract.uploadedByUserId, appUser.activeCompanyId);
        if (!isOwner && !inChain) {
          return res.status(403).json({ message: "Nemáte oprávnenie meniť túto zmluvu" });
        }
      }

      const { newStatusId, changedAt, visibleToClient, statusNote, parameterValues } = req.body;
      if (!newStatusId) return res.status(400).json({ message: "Novy stav je povinny" });

      const allowedTypes = await storage.getContractStatusContractTypes(Number(newStatusId));
      if (allowedTypes.length > 0 && contract.contractType) {
        if (!allowedTypes.some(at => at.contractType === contract.contractType)) {
          return res.status(400).json({ message: `Stav nie je povoleny pre typ zmluvy '${contract.contractType}'` });
        }
      }

      const statusParams = await storage.getContractStatusParameters(Number(newStatusId));
      const parsedParams = parameterValues ? (typeof parameterValues === "string" ? JSON.parse(parameterValues) : parameterValues) : {};
      for (const sp of statusParams) {
        if (sp.isRequired) {
          const val = parsedParams[sp.id.toString()];
          if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
            return res.status(400).json({ message: `Parameter '${sp.name}' je povinny` });
          }
        }
      }

      const fileHashes = req.body.fileHashes ? (typeof req.body.fileHashes === "string" ? JSON.parse(req.body.fileHashes) : req.body.fileHashes) : {};
      const renamePrefixRaw = req.body.renamePrefix ? String(req.body.renamePrefix).trim() : "";

      const docs: any[] = [];
      if (req.files && Array.isArray(req.files)) {
        const multiScan = await scanMultipleFiles(req.files);
        if (!multiScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: Súbor "${multiScan.failedFile}" bol vyhodnotený ako rizikový a bol odstránený. ${multiScan.reason}` });
        for (const file of req.files) {
          let fileHash = fileHashes[file.originalname] || "";
          if (!fileHash) {
            const buf = fs.readFileSync(file.path);
            fileHash = crypto.createHash("sha256").update(buf).digest("hex");
          }
          const displayName = renamePrefixRaw
            ? `${renamePrefixRaw}_${file.originalname}`
            : file.originalname;
          docs.push({
            id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
            name: displayName,
            url: `/api/files/status-change-docs/${file.filename}`,
            uploadedAt: new Date().toISOString(),
            fileHash,
            fileSize: file.size,
          });
        }
      }

      const changeLog = await storage.createContractStatusChangeLog({
        contractId,
        oldStatusId: contract.statusId,
        newStatusId: Number(newStatusId),
        changedByUserId: appUser?.id || null,
        changedAt: changedAt ? new Date(changedAt) : new Date(),
        parameterValues: parsedParams,
        visibleToClient: visibleToClient === "true" || visibleToClient === true,
        statusNote: statusNote || null,
        statusChangeDocuments: docs,
      });

      const allStatuses = await storage.getContractStatuses();
      const status = allStatuses.find(s => s.id === Number(newStatusId));

      const contractUpdate: any = {
        statusId: Number(newStatusId),
        lastStatusUpdate: new Date(),
      };

      if (status?.definesContractEnd) {
        contractUpdate.expiryDate = changedAt ? new Date(changedAt) : new Date();
      } else {
        contractUpdate.expiryDate = null;
      }

      await storage.updateContract(contractId, contractUpdate);

      if (docs.length > 0) {
        const freshContract = await storage.getContract(contractId);
        const existingDocs = Array.isArray((freshContract as any)?.documents) ? (freshContract as any).documents : [];
        const statusName = status?.name || `Stav ${newStatusId}`;
        const syncedDocs = docs.map((d: any) => ({
          ...d,
          sourceStatusChangeLogId: changeLog.id,
          sourceStatusName: statusName,
        }));
        await storage.updateContract(contractId, { documents: [...existingDocs, ...syncedDocs] } as any);
      }

      if (status?.assignsNumber && !contract.globalNumber) {
        const counter = await storage.getNextCounterValue("global_contract_number");
        await storage.updateContract(contractId, { globalNumber: counter } as any);
      }

      if (status?.isStorno && contract.subjectId) {
        try {
          const subject = await storage.getSubject(contract.subjectId);
          if (subject) {
            const signedDate = contract.signedDate ? new Date(contract.signedDate) : contract.createdAt ? new Date(contract.createdAt) : null;
            const now = new Date();
            const yearsActive = signedDate ? (now.getTime() - signedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000) : 0;
            let points = -1;
            let reason = "Storno zmluvy do 1 roka";
            if (yearsActive >= 2) {
              points = 2;
              reason = "Storno zmluvy po 2+ rokoch (+2)";
            } else if (yearsActive >= 1) {
              points = 1;
              reason = "Storno zmluvy po 1+ roku (+1)";
            }
            const identifierType = subject.birthNumber ? "rc" : "ico";
            const identifierValue = subject.birthNumber || ((subject.details as any)?.ico || (subject.details as any)?.dynamicFields?.ico);
            await storage.addSubjectPoints({
              subjectId: contract.subjectId,
              contractId,
              points,
              reason,
              identifierType: identifierValue ? identifierType : null,
              identifierValue: identifierValue || null,
              companyId: contract.companyId,
            });
            await storage.recalculateBonitaPoints(contract.subjectId);
            console.log(`[BONITA] Points ${points > 0 ? '+' : ''}${points} for subject ${contract.subjectId} (contract ${contractId})`);
          }
        } catch (bonitaErr) {
          console.error("[BONITA] Error calculating points:", bonitaErr);
        }
      }

      if (status && (status as any).notifyEnabled && (status as any).notifyTemplate) {
        try {
          const freshContract = await storage.getContract(contractId);
          let clientName = "";
          let clientEmail = "";
          if (freshContract?.subjectId) {
            const subject = await storage.getSubject(freshContract.subjectId);
            if (subject) {
              clientName = [subject.firstName, subject.lastName].filter(Boolean).join(" ") || subject.companyName || "";
              clientEmail = (subject as any).email || "";
            }
          }
          const contractNumber = freshContract?.contractNumber || freshContract?.uid || String(contractId);
          const validUntil = freshContract?.expiryDate
            ? new Date(freshContract.expiryDate).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" })
            : "-";

          const paramNameToValue: Record<string, string> = {};
          for (const sp of statusParams) {
            const val = parsedParams[sp.id.toString()];
            paramNameToValue[sp.name] = val !== undefined && val !== null ? String(val) : "";
          }

          const replaceSmartTags = (text: string) =>
            text
              .replace(/\{\{contract_number\}\}/g, contractNumber)
              .replace(/\{\{client_name\}\}/g, clientName)
              .replace(/\{\{valid_until\}\}/g, validUntil)
              .replace(/\{\{param_(.+?)\}\}/g, (_match, paramName) => paramNameToValue[paramName] || "");

          const channel = (status as any).notifyChannel || "email";
          const templateBody = replaceSmartTags((status as any).notifyTemplate || "");
          const templateSubject = replaceSmartTags((status as any).notifySubject || `Zmena stavu zmluvy ${contractNumber}`);

          const recipientEmail = clientEmail || appUser?.email || "unknown@system";

          if (channel === "email" || channel === "both") {
            await db.insert(systemNotifications).values({
              recipientEmail,
              recipientName: clientName || null,
              recipientUserId: null,
              subject: templateSubject,
              bodyHtml: templateBody,
              status: "pending",
              notificationType: "status_change_email",
              relatedContractId: contractId,
            });
          }
          if (channel === "sms" || channel === "both") {
            await db.insert(systemNotifications).values({
              recipientEmail: recipientEmail,
              recipientName: clientName || null,
              recipientUserId: null,
              subject: templateSubject,
              bodyHtml: templateBody,
              status: "pending",
              notificationType: "status_change_sms",
              relatedContractId: contractId,
            });
          }
          console.log(`[NOTIFY] Status change notification queued for contract ${contractId}, channel: ${channel}`);
        } catch (notifyErr) {
          console.error("[NOTIFY] Error queuing status change notification:", notifyErr);
        }
      }

      await logAudit(req, {
        action: "STATUS_CHANGE",
        module: "zmluvy",
        entityId: contractId,
        entityName: `Zmena stavu zmluvy ${contractId}`,
        oldData: { statusId: contract.statusId },
        newData: { statusId: Number(newStatusId), logId: changeLog.id },
      });
      res.status(201).json(changeLog);
    } catch (err) {
      console.error("Status change error:", err);
      res.status(500).json({ message: "Chyba pri zmene stavu" });
    }
  });

  // === STATUS CHANGE META (ArutsoK 51 - UI indicators for notes/docs) ===
  app.post("/api/contracts/status-change-meta", isAuthenticated, async (req: any, res) => {
    try {
      const { contractIds } = req.body;
      if (!contractIds || !Array.isArray(contractIds)) return res.json({});
      const meta = await storage.getLatestStatusChangeLogsForContracts(contractIds);
      res.json(meta);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/contracts/:id/check-doc-duplicates", isAuthenticated, async (req: any, res) => {
    try {
      const contractId = Number(req.params.id);
      const { hashes } = req.body;
      if (!hashes || !Array.isArray(hashes)) return res.json({ duplicates: [] });
      const logs = await storage.getContractStatusChangeLogs(contractId);
      const existingHashes = new Set<string>();
      for (const log of logs) {
        if (Array.isArray(log.statusChangeDocuments)) {
          for (const doc of log.statusChangeDocuments as any[]) {
            if (doc.fileHash) existingHashes.add(doc.fileHash);
          }
        }
      }
      const duplicates = hashes.filter((h: string) => existingHashes.has(h));
      res.json({ duplicates });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CONTRACTS BY LIFECYCLE PHASE ===
  app.get("/api/contracts/by-phase/:phase", isAuthenticated, async (req: any, res) => {
    try {
      const phase = Number(req.params.phase);
      if (isNaN(phase) || phase < 0 || phase > 10) {
        return res.status(400).json({ message: "Neplatná fáza životného cyklu" });
      }
      const companyId = req.appUser?.activeCompanyId || undefined;
      const conditions: any[] = [eq(contracts.lifecyclePhase, phase), eq(contracts.isDeleted, false)];
      if (companyId) conditions.push(eq(contracts.companyId, companyId));

      const result = await db
        .select({
          contract: contracts,
          subjectFirstName: subjects.firstName,
          subjectLastName: subjects.lastName,
          subjectUid: subjects.uid,
          partnerName: partners.name,
          productName: products.name,
          objectionDaysLimit: sectorProducts.objectionDaysLimit,
          archiveDaysBeforeDelete: sectorProducts.archiveDaysBeforeDelete,
        })
        .from(contracts)
        .leftJoin(subjects, eq(contracts.subjectId, subjects.id))
        .leftJoin(partners, eq(contracts.partnerId, partners.id))
        .leftJoin(products, eq(contracts.productId, products.id))
        .leftJoin(sectorProducts, eq(contracts.sectorProductId, sectorProducts.id))
        .where(and(...conditions))
        .orderBy(desc(contracts.createdAt));

      res.json(result.map(r => ({
        ...r.contract,
        subjectName: [r.subjectFirstName, r.subjectLastName].filter(Boolean).join(" ") || null,
        subjectUid: r.subjectUid,
        partnerName: r.partnerName,
        productName: r.productName,
        objectionDaysLimit: r.objectionDaysLimit ?? 100,
        archiveDaysBeforeDelete: r.archiveDaysBeforeDelete ?? 365,
      })));
    } catch (err: any) {
      console.error("Get contracts by phase error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.patch("/api/contracts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const contractId = Number(req.params.id);
      const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
      if (!contract) return res.status(404).json({ message: "Zmluva nenájdená" });

      if (!isAdmin(req.appUser)) {
        const isOwner = contract.uploadedByUserId === req.appUser?.id;
        if (!isOwner) {
          return res.status(403).json({ message: "Nemáte oprávnenie upraviť túto zmluvu" });
        }
      }

      const allowedFields = [
        "partnerId", "productId", "sectorProductId", "subjectId",
        "proposalNumber", "contractNumber", "lifecyclePhase",
        "incompleteData", "incompleteDataReason",
      ];
      const updateData: Record<string, any> = { updatedAt: new Date() };
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      const mergedPartnerId = updateData.partnerId !== undefined ? updateData.partnerId : contract.partnerId;
      const mergedProductId = updateData.productId !== undefined ? updateData.productId : contract.productId;
      const mergedProposalNumber = updateData.proposalNumber !== undefined ? updateData.proposalNumber : contract.proposalNumber;
      const mergedContractNumber = updateData.contractNumber !== undefined ? updateData.contractNumber : contract.contractNumber;
      const mergedSubjectId = updateData.subjectId !== undefined ? updateData.subjectId : contract.subjectId;

      const patchMissing: string[] = [];
      if (!mergedPartnerId) patchMissing.push("Partner");
      if (!mergedProductId) patchMissing.push("Produkt");
      if (!mergedProposalNumber && !mergedContractNumber) patchMissing.push("Číslo návrhu alebo číslo zmluvy");
      if (!mergedSubjectId) patchMissing.push("Klient");

      if (patchMissing.length > 0) {
        updateData.incompleteData = true;
        updateData.incompleteDataReason = `Chýba: ${patchMissing.join(", ")}`;
      } else {
        updateData.incompleteData = false;
        updateData.incompleteDataReason = null;
      }

      const wasIncomplete = contract.incompleteData === true;
      const nowComplete = updateData.incompleteData === false;
      if (wasIncomplete && nowComplete) {
        if (!updateData.lifecyclePhase) updateData.lifecyclePhase = 1;

        const userName = req.appUser?.username || req.appUser?.firstName || "neznámy";
        await logAudit(req, {
          action: "INCOMPLETE_DATA_RESOLVED",
          module: "zmluvy",
          entityId: contractId,
          entityName: `Neúplné dáta manuálne doplnené používateľom ${userName}`,
          oldData: { incompleteData: true, incompleteDataReason: contract.incompleteDataReason, lifecyclePhase: contract.lifecyclePhase },
          newData: { incompleteData: false, incompleteDataReason: null, lifecyclePhase: updateData.lifecyclePhase },
        });
      }

      await db.update(contracts).set(updateData).where(eq(contracts.id, contractId));
      const [updated] = await db.select().from(contracts).where(eq(contracts.id, contractId));
      res.json(updated);
    } catch (err: any) {
      console.error("PATCH /api/contracts/:id error:", err);
      res.status(500).json({ message: err.message || "Chyba pri aktualizácii zmluvy" });
    }
  });

  app.post("/api/contracts/:id/upload-documents", isAuthenticated, (req, _res, next) => {
    (req as any)._uploadSection = "contract-docs";
    next();
  }, (req: any, res: any, next: any) => {
    contractDocsUpload.array("documents", 25)(req, res, (err: any) => {
      if (err) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ message: `Súbor je príliš veľký. Maximálny limit je 25 MB.` });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({ message: `Maximálny počet súborov v jednej dávke je 25.` });
        }
        return res.status(400).json({ message: err.message || "Chyba pri nahrávaní súboru" });
      }
      next();
    });
  }, async (req: any, res) => {
    try {
      const MAX_BATCH_SIZE = 100 * 1024 * 1024;
      const MAX_DAILY_QUOTA = 500 * 1024 * 1024;
      const MAX_DOCS_PER_CONTRACT = 100;
      const MAX_VIDEOS_PER_CONTRACT = 5;

      const cleanupFiles = () => {
        if (req.files && Array.isArray(req.files)) {
          for (const f of req.files) fs.unlink(f.path, () => {});
        }
      };

      if (req.files && Array.isArray(req.files)) {
        const totalSize = req.files.reduce((sum: number, f: any) => sum + f.size, 0);
        if (totalSize > MAX_BATCH_SIZE) {
          cleanupFiles();
          return res.status(413).json({ message: `Celková veľkosť dávky presahuje 100 MB. Nahrajte menej súborov naraz.` });
        }
      }

      const userId = req.appUser?.id;
      if (userId) {
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentUploads = await db.select({
          newData: auditLogs.newData,
        }).from(auditLogs).where(
          and(
            eq(auditLogs.userId, userId),
            eq(auditLogs.action, "CONTRACT_UPLOAD_DOCUMENTS"),
            gte(auditLogs.createdAt, since24h)
          )
        );

        let totalUploadedBytes = 0;
        for (const log of recentUploads) {
          const nd = log.newData as any;
          if (nd?.totalBytesAdded) {
            totalUploadedBytes += nd.totalBytesAdded;
          }
        }

        const currentBatchSize = req.files && Array.isArray(req.files)
          ? req.files.reduce((sum: number, f: any) => sum + f.size, 0)
          : 0;

        if (totalUploadedBytes + currentBatchSize > MAX_DAILY_QUOTA) {
          cleanupFiles();
          await logAudit(req, {
            action: "UPLOAD_QUOTA_EXCEEDED",
            module: "zmluvy",
            newData: {
              dailyUsedBytes: totalUploadedBytes,
              attemptedBytes: currentBatchSize,
              dailyLimitBytes: MAX_DAILY_QUOTA,
            },
          });
          return res.status(429).json({ message: `Denný limit nahrávania (500 MB / 24h) bol prekročený. Skúste neskôr.` });
        }
      }

      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const multiScan = await scanMultipleFiles(req.files);
        if (!multiScan.safe) {
          return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: Súbor "${multiScan.failedFile}" bol vyhodnotený ako rizikový a bol odstránený. ${multiScan.reason}` });
        }
      }

      const contractId = Number(req.params.id);
      const contract = await storage.getContract(contractId);
      if (!contract) return res.status(404).json({ message: "Zmluva nenájdená" });

      const existingDocs: DocEntry[] = (contract.documents as DocEntry[]) || [];
      const newFiles = (req.files && Array.isArray(req.files)) ? req.files : [];

      const existingVideoCount = existingDocs.filter(d => {
        const ext = path.extname(d.name).toLowerCase();
        return VIDEO_EXTENSIONS.has(ext);
      }).length;
      const newVideoCount = newFiles.filter((f: any) => {
        const ext = path.extname(f.originalname).toLowerCase();
        return VIDEO_EXTENSIONS.has(ext);
      }).length;
      const existingNonVideoCount = existingDocs.length - existingVideoCount;
      const newNonVideoCount = newFiles.length - newVideoCount;

      const MAX_NON_VIDEOS_PER_CONTRACT = 95;

      if (existingVideoCount + newVideoCount > MAX_VIDEOS_PER_CONTRACT) {
        cleanupFiles();
        return res.status(400).json({ message: `Maximálny počet video súborov na zmluvu je ${MAX_VIDEOS_PER_CONTRACT}. Aktuálne: ${existingVideoCount}, nových: ${newVideoCount}.` });
      }
      if (existingNonVideoCount + newNonVideoCount > MAX_NON_VIDEOS_PER_CONTRACT) {
        cleanupFiles();
        return res.status(400).json({ message: `Maximálny počet dokumentov (bez videí) na zmluvu je ${MAX_NON_VIDEOS_PER_CONTRACT}. Aktuálne: ${existingNonVideoCount}, nových: ${newNonVideoCount}.` });
      }
      if (existingDocs.length + newFiles.length > MAX_DOCS_PER_CONTRACT) {
        cleanupFiles();
        return res.status(400).json({ message: `Maximálny celkový počet súborov na zmluvu je ${MAX_DOCS_PER_CONTRACT}. Aktuálne: ${existingDocs.length}, nových: ${newFiles.length}.` });
      }

      const newDocs: DocEntry[] = [];
      let totalBytesAdded = 0;
      for (const file of newFiles) {
        newDocs.push({
          name: file.originalname,
          url: `/api/files/${file.filename}`,
          uploadedAt: new Date().toISOString(),
          fileSize: file.size,
        });
        totalBytesAdded += file.size;
      }

      const allDocs = [...existingDocs, ...newDocs];
      await db.update(contracts).set({
        documents: allDocs,
        updatedAt: new Date(),
      }).where(eq(contracts.id, contractId));

      await logAudit(req, {
        action: "CONTRACT_UPLOAD_DOCUMENTS",
        module: "zmluvy",
        entityId: contractId,
        entityName: contract.contractNumber || contract.proposalNumber || `ID ${contractId}`,
        newData: { addedDocuments: newDocs.length, totalDocuments: allDocs.length, totalBytesAdded },
      });

      res.json({ success: true, documents: allDocs, added: newDocs.length });
    } catch (err: any) {
      console.error("POST /api/contracts/:id/upload-documents error:", err);
      res.status(500).json({ message: err.message || "Chyba pri nahrávaní dokumentov" });
    }
  });

  app.patch("/api/contracts/:id/confirm-name", isAuthenticated, async (req: any, res) => {
    try {
      const contractId = Number(req.params.id);
      const { swap } = req.body;

      const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
      if (!contract) return res.status(404).json({ message: "Zmluva nenájdená" });

      if (!isAdmin(req.appUser)) {
        const isOwner = contract.uploadedByUserId === req.appUser?.id;
        if (!isOwner) {
          return res.status(403).json({ message: "Nemáte oprávnenie upraviť túto zmluvu" });
        }
      }

      if (!contract.subjectId) return res.status(400).json({ message: "Zmluva nemá priradený subjekt" });

      const subject = await storage.getSubject(contract.subjectId);
      if (!subject) return res.status(404).json({ message: "Subjekt nenájdený" });

      if (swap) {
        const oldFirst = subject.firstName;
        const oldLast = subject.lastName;
        await storage.updateSubject(subject.id, {
          firstName: oldLast,
          lastName: oldFirst,
          changeReason: "Prehodenie mena/priezviska – manuálne potvrdenie z importu",
        });
      }

      await db.update(contracts).set({
        needsManualVerification: false,
        updatedAt: new Date(),
      }).where(eq(contracts.id, contractId));

      await logAudit(req, {
        action: "NAME_CONFIRMATION",
        module: "zmluvy",
        entityId: contractId,
        entityName: `Potvrdenie mena pre zmluvu #${contractId}${swap ? " (prehodené)" : ""}`,
        newData: { contractId, subjectId: subject.id, swap, firstName: subject.firstName, lastName: subject.lastName },
      });

      const [updated] = await db.select().from(contracts).where(eq(contracts.id, contractId));
      res.json(updated);
    } catch (err: any) {
      console.error("PATCH /api/contracts/:id/confirm-name error:", err);
      res.status(500).json({ message: err.message || "Chyba pri potvrdení mena" });
    }
  });

  // === CONTRACT LIFECYCLE PHASE CHANGE ===
  app.patch("/api/contracts/:id/lifecycle-phase", isAuthenticated, async (req: any, res) => {
    try {
      const contractId = Number(req.params.id);
      const { phase, note } = req.body;

      if (!phase || phase < 1 || phase > 10) {
        return res.status(400).json({ message: "Fáza musí byť medzi 1 a 10" });
      }

      const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
      if (!contract) return res.status(404).json({ message: "Zmluva nenájdená" });

      if (!isAdmin(req.appUser)) {
        const isOwner = contract.uploadedByUserId === req.appUser?.id;
        const inChain = await isInManagerChain(req.appUser.id, contract.uploadedByUserId, req.appUser.activeCompanyId);
        if (!isOwner && !inChain) {
          return res.status(403).json({ message: "Nemáte oprávnenie meniť túto zmluvu" });
        }
      }

      const migrationOn = await isMigrationModeOn();
      const now = new Date();
      const updateData: Record<string, any> = {
        lifecyclePhase: phase,
        updatedAt: migrationOn ? (contract.signedDate || now) : now,
      };

      if (phase === 3) {
        updateData.objectionEnteredAt = migrationOn ? (contract.signedDate || now) : now;
      }

      if (contract.isStamped && contract.lifecyclePhase === 5 && phase < 5) {
        updateData.isStamped = false;
        updateData.stampedAt = null;
        updateData.contractNumber = null;
        updateData.receivedByCentralAt = null;
      }

      if (phase === 5) {
        updateData.receivedByCentralAt = migrationOn ? (contract.signedDate || now) : now;
        updateData.stampedAt = migrationOn ? (contract.signedDate || now) : now;
        updateData.isStamped = true;
        if (contract.subjectId) {
          const subj = await db.select().from(subjects).where(eq(subjects.id, contract.subjectId)).limit(1);
          if (subj[0] && !subj[0].uid) {
            const maxUid = await db.select({ max: sql<string>`MAX(uid)` }).from(subjects).where(sql`uid LIKE '421%'`);
            const lastNum = maxUid[0]?.max ? parseInt(maxUid[0].max) : 421000000000000;
            const nextUid = String(lastNum + 1);
            await db.update(subjects).set({ uid: nextUid }).where(eq(subjects.id, contract.subjectId));
          }
        }
      }

      if (phase === 9) {
        updateData.sentToPartnerAt = migrationOn ? (contract.signedDate || now) : now;
      }

      if (phase === 10) {
        updateData.receivedByPartnerAt = migrationOn ? (contract.signedDate || now) : now;
      }

      const [updated] = await db.update(contracts).set(updateData).where(eq(contracts.id, contractId)).returning();

      const appUser = req.appUser;
      await db.insert(contractLifecycleHistory).values({
        contractId,
        phase,
        phaseName: LIFECYCLE_PHASES[phase] || `Fáza ${phase}`,
        changedByUserId: appUser?.id || null,
        note: note || null,
      });
      await logLifecycleStatusChange(contractId, contract.statusId, phase, appUser?.id || null);

      await logAudit(req, {
        action: "LIFECYCLE_PHASE_CHANGE",
        module: "zmluvy",
        entityId: contractId,
        entityName: contract.contractNumber || contract.proposalNumber || `ID ${contractId}`,
        oldData: { lifecyclePhase: contract.lifecyclePhase },
        newData: { lifecyclePhase: phase, phaseName: LIFECYCLE_PHASES[phase] },
      });

      if (phase === 3 && !(await isMigrationModeOn())) {
        const limits = await getProductDaysLimits(contract.sectorProductId);
        notifyObjectionCreated(contractId, limits.objectionDays).catch(err =>
          console.error("[EMAIL] Objection notification error:", err)
        );
      }

      res.json(updated);
    } catch (err: any) {
      console.error("Lifecycle phase change error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  // === OPV OPRAVY: BULK REROUTE (preserves original slip_id/inventoryId) ===
  app.post("/api/contracts/bulk-reroute", isAuthenticated, async (req: any, res) => {
    try {
      const { contractIds, targetPhase, sourceFolder } = req.body;
      if (!Array.isArray(contractIds) || contractIds.length === 0) {
        return res.status(400).json({ message: "Žiadne zmluvy na presmerovanie" });
      }
      if (targetPhase === undefined || targetPhase === null || targetPhase < 0 || targetPhase > 10) {
        return res.status(400).json({ message: "Neplatná cieľová fáza" });
      }

      const ALLOWED_ROUTES: Record<string, number> = {
        "neprijate": 2,
        "archiv": 6,
        "spracovanie": 8,
        "intervencia": 6,
        "dokoncit": 0,
      };

      if (!sourceFolder || ALLOWED_ROUTES[sourceFolder] === undefined || ALLOWED_ROUTES[sourceFolder] !== targetPhase) {
        return res.status(400).json({ message: "Nepovolená kombinácia smerovania" });
      }

      const appUser = req.appUser;
      const now = new Date();

      const newInventory = await storage.createContractInventory({
        name: `OPV Oprava ${now.toISOString().slice(0, 10)}`,
        stateId: 1,
        sortOrder: 0,
        isClosed: false,
      });

      const seqNum = await storage.getNextCounterValue("sprievodka_sequence");
      await storage.updateContractInventory(newInventory.id, {
        sequenceNumber: seqNum,
        name: `Odovzdávací protokol - Sprievodka č. ${seqNum} (OPV Oprava)`,
        isDispatched: true,
      } as any);

      const results: any[] = [];

      for (let i = 0; i < contractIds.length; i++) {
        const cid = contractIds[i];
        const [contract] = await db.select().from(contracts).where(eq(contracts.id, Number(cid)));
        if (!contract) continue;

        const oldInventoryId = contract.inventoryId;

        const updateData: Record<string, any> = {
          lifecyclePhase: targetPhase,
          inventoryId: newInventory.id,
          sortOrderInInventory: i + 1,
          updatedAt: now,
        };

        if (targetPhase === 5) {
          updateData.receivedByCentralAt = now;
        }

        const [updated] = await db.update(contracts)
          .set(updateData)
          .where(eq(contracts.id, Number(cid)))
          .returning();

        await db.insert(contractLifecycleHistory).values({
          contractId: Number(cid),
          phase: targetPhase,
          phaseName: LIFECYCLE_PHASES[targetPhase] || `Fáza ${targetPhase}`,
          changedByUserId: appUser?.id || null,
          note: `OPV Oprava: presmerovanie z ${sourceFolder}, pôvodná sprievodka ID ${oldInventoryId || 'žiadna'} → nová sprievodka č. ${seqNum}`,
        });
        await logLifecycleStatusChange(Number(cid), contract.statusId, targetPhase, appUser?.id || null);

        await logAudit(req, {
          action: "OPV_REROUTE",
          module: "zmluvy",
          entityId: Number(cid),
          entityName: contract.contractNumber || contract.proposalNumber || `ID ${cid}`,
          oldData: { lifecyclePhase: contract.lifecyclePhase, inventoryId: oldInventoryId },
          newData: { lifecyclePhase: targetPhase, inventoryId: newInventory.id, newSequenceNumber: seqNum, sourceFolder },
        });

        results.push(updated);
      }

      await logAudit(req, {
        action: "CREATE",
        module: "opv_reroute_sprievodka",
        entityId: newInventory.id,
        entityName: `Sprievodka č. ${seqNum} (OPV Oprava)`,
        newData: { contractIds, sequenceNumber: seqNum, sourceFolder, targetPhase },
      });

      res.json({ rerouted: results.length, sequenceNumber: seqNum, inventoryId: newInventory.id, contracts: results });
    } catch (err: any) {
      console.error("Bulk reroute error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/contracts/move-to-processing", isAuthenticated, async (req: any, res) => {
    try {
      const { contractIds } = req.body;
      if (!Array.isArray(contractIds) || contractIds.length === 0) {
        return res.status(400).json({ message: "Žiadne kontrakty na presun" });
      }
      const appUser = req.appUser;
      const now = new Date();
      const results: any[] = [];

      for (const cid of contractIds) {
        const id = Number(cid);
        const conditions = [eq(contracts.id, id), eq(contracts.isDeleted, false)];
        if (appUser?.activeStateId) conditions.push(eq(contracts.stateId, appUser.activeStateId));
        if (appUser?.activeCompanyId) conditions.push(eq(contracts.companyId, appUser.activeCompanyId));
        const [contract] = await db.select().from(contracts).where(and(...conditions));
        if (!contract) continue;

        const updateData: Record<string, any> = {
          lifecyclePhase: 6,
          updatedAt: now,
          receivedByCentralAt: contract.receivedByCentralAt || now,
          stampedAt: contract.stampedAt || now,
          isStamped: true,
        };

        if (!contract.contractNumber) {
          const maxResult = await db.select({ max: sql<number>`COALESCE(MAX(CAST(contract_number AS INTEGER)), 0)` }).from(contracts).where(sql`contract_number ~ '^[0-9]+$'`);
          const nextNumber = (maxResult[0]?.max || 0) + 1;
          updateData.contractNumber = String(nextNumber);
        }

        if (contract.subjectId) {
          const subj = await db.select().from(subjects).where(eq(subjects.id, contract.subjectId)).limit(1);
          if (subj[0] && !subj[0].uid) {
            const maxUid = await db.select({ max: sql<string>`MAX(uid)` }).from(subjects).where(sql`uid LIKE '421%'`);
            const lastNum = maxUid[0]?.max ? parseInt(maxUid[0].max) : 421000000000000;
            const nextUid = String(lastNum + 1);
            await db.update(subjects).set({ uid: nextUid }).where(eq(subjects.id, contract.subjectId));
          }
        }

        const [updated] = await db.update(contracts).set(updateData).where(eq(contracts.id, id)).returning();

        await db.insert(contractLifecycleHistory).values({
          contractId: id,
          phase: 6,
          phaseName: LIFECYCLE_PHASES[6] || "Kontrakt v spracovaní",
          changedByUserId: appUser?.id || null,
          note: `Presun do spracovania, číslo kontraktu: ${updated.contractNumber || contract.contractNumber}`,
        });
        await logLifecycleStatusChange(id, contract.statusId, 6, appUser?.id || null);

        await logAudit(req, {
          action: "MOVE_TO_PROCESSING",
          module: "zmluvy",
          entityId: id,
          entityName: updated.contractNumber || contract.proposalNumber || `ID ${id}`,
          oldData: { lifecyclePhase: contract.lifecyclePhase, statusId: contract.statusId },
          newData: { lifecyclePhase: 6, contractNumber: updated.contractNumber },
        });

        results.push(updated);
      }

      let rejectedCount = 0;
      const { rejectedIds } = req.body;
      if (Array.isArray(rejectedIds) && rejectedIds.length > 0) {
        for (const rid of rejectedIds) {
          const rejId = Number(rid);
          const rejConditions = [eq(contracts.id, rejId), eq(contracts.isDeleted, false), eq(contracts.lifecyclePhase, 5)];
          if (appUser?.activeStateId) rejConditions.push(eq(contracts.stateId, appUser.activeStateId));
          if (appUser?.activeCompanyId) rejConditions.push(eq(contracts.companyId, appUser.activeCompanyId));
          const [rejContract] = await db.select().from(contracts).where(and(...rejConditions));
          if (!rejContract) continue;

          await db.update(contracts).set({
            lifecyclePhase: 3,
            objectionEnteredAt: now,
            updatedAt: now,
          }).where(eq(contracts.id, rejId));

          await db.insert(contractLifecycleHistory).values({
            contractId: rejId,
            phase: 3,
            phaseName: LIFECYCLE_PHASES[3] || "Neprijaté zmluvy – výhrady",
            changedByUserId: appUser?.id || null,
            note: "Zmluva nebola označená pri presune do spracovania — presunutá do výhrad",
          });
          await logLifecycleStatusChange(rejId, rejContract.statusId, 3, appUser?.id || null);

          await logAudit(req, {
            action: "REJECT_TO_OBJECTION",
            module: "zmluvy",
            entityId: rejId,
            entityName: rejContract.contractNumber || rejContract.proposalNumber || `ID ${rejId}`,
            oldData: { lifecyclePhase: 5 },
            newData: { lifecyclePhase: 3 },
          });
          rejectedCount++;
        }
      }

      res.json({ moved: results.length, rejected: rejectedCount, contracts: results });
    } catch (err: any) {
      console.error("Move to processing error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/contracts/:id/move-to-internal-intervention", isAuthenticated, async (req: any, res) => {
    try {
      const contractId = Number(req.params.id);
      const appUser = req.appUser;
      const now = new Date();

      const conditions = [eq(contracts.id, contractId), eq(contracts.isDeleted, false)];
      if (appUser?.activeStateId) conditions.push(eq(contracts.stateId, appUser.activeStateId));
      if (appUser?.activeCompanyId) conditions.push(eq(contracts.companyId, appUser.activeCompanyId));

      const [contract] = await db.select().from(contracts).where(and(...conditions));
      if (!contract) return res.status(404).json({ message: "Kontrakt nenájdený" });
      if (contract.lifecyclePhase !== 8) return res.status(400).json({ message: "Kontrakt nie je vo fáze Manuálna kontrola kontraktov" });

      const [updated] = await db.update(contracts)
        .set({ lifecyclePhase: 7, updatedAt: now })
        .where(eq(contracts.id, contractId))
        .returning();

      await db.insert(contractLifecycleHistory).values({
        contractId,
        phase: 7,
        phaseName: LIFECYCLE_PHASES[7] || "Interné intervencie",
        changedByUserId: appUser?.id || null,
        note: "Presun do interných intervencií zo Manuálna kontrola kontraktov",
      });
      await logLifecycleStatusChange(contractId, contract.statusId, 7, appUser?.id || null);

      await logAudit(req, {
        action: "MOVE_TO_INTERNAL_INTERVENTION",
        module: "zmluvy",
        entityId: contractId,
        entityName: contract.contractNumber || contract.proposalNumber || `ID ${contractId}`,
        oldData: { lifecyclePhase: 8 },
        newData: { lifecyclePhase: 7 },
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Move to internal intervention error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/contracts/assign-ocr-data", isAuthenticated, async (req: any, res) => {
    try {
      const { contractIds } = req.body;
      if (!Array.isArray(contractIds) || contractIds.length === 0) {
        return res.status(400).json({ message: "Žiadne kontrakty" });
      }
      const appUser = req.appUser;
      const now = new Date();
      const results: any[] = [];

      for (const cid of contractIds) {
        const [contract] = await db.select().from(contracts).where(and(eq(contracts.id, Number(cid)), eq(contracts.lifecyclePhase, 6)));
        if (!contract) continue;

        const alreadyHasScans = contract.scansUploaded === true;
        const shouldAutoMove = alreadyHasScans;

        const updateData: Record<string, any> = {
          ocrDataAssigned: true,
          updatedAt: now,
        };

        if (shouldAutoMove) {
          updateData.lifecyclePhase = 8;
        }

        const [updated] = await db.update(contracts).set(updateData).where(eq(contracts.id, Number(cid))).returning();

        if (shouldAutoMove) {
          await db.insert(contractLifecycleHistory).values({
            contractId: Number(cid),
            phase: 8,
            phaseName: LIFECYCLE_PHASES[8] || "Manuálna kontrola kontraktov",
            changedByUserId: appUser?.id || null,
            note: "Automatický presun - OCR dáta aj skeny priradené",
          });
        }

        results.push({ id: cid, ocrDataAssigned: true, scansUploaded: alreadyHasScans, movedToPhase8: shouldAutoMove });
      }

      res.json({ updated: results.length, results });
    } catch (err: any) {
      console.error("Assign OCR data error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/contracts/assign-scans", isAuthenticated, async (req: any, res) => {
    try {
      const { contractIds } = req.body;
      if (!Array.isArray(contractIds) || contractIds.length === 0) {
        return res.status(400).json({ message: "Žiadne kontrakty" });
      }
      const appUser = req.appUser;
      const now = new Date();
      const results: any[] = [];

      for (const cid of contractIds) {
        const [contract] = await db.select().from(contracts).where(and(eq(contracts.id, Number(cid)), eq(contracts.lifecyclePhase, 6)));
        if (!contract) continue;

        const alreadyHasOcr = contract.ocrDataAssigned === true;
        const shouldAutoMove = alreadyHasOcr;

        const updateData: Record<string, any> = {
          scansUploaded: true,
          updatedAt: now,
        };

        if (shouldAutoMove) {
          updateData.lifecyclePhase = 8;
        }

        const [updated] = await db.update(contracts).set(updateData).where(eq(contracts.id, Number(cid))).returning();

        if (shouldAutoMove) {
          await db.insert(contractLifecycleHistory).values({
            contractId: Number(cid),
            phase: 8,
            phaseName: LIFECYCLE_PHASES[8] || "Manuálna kontrola kontraktov",
            changedByUserId: appUser?.id || null,
            note: "Automatický presun - OCR dáta aj skeny priradené",
          });
        }

        results.push({ id: cid, ocrDataAssigned: alreadyHasOcr, scansUploaded: true, movedToPhase8: shouldAutoMove });
      }

      res.json({ updated: results.length, results });
    } catch (err: any) {
      console.error("Assign scans error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/contracts/manual-complete-phase6", isAuthenticated, async (req: any, res) => {
    try {
      const { contractId } = req.body;
      if (!contractId) return res.status(400).json({ message: "Chýba ID kontraktu" });
      const appUser = req.appUser;
      const now = new Date();

      const [contract] = await db.select().from(contracts).where(and(eq(contracts.id, Number(contractId)), eq(contracts.lifecyclePhase, 6)));
      if (!contract) return res.status(404).json({ message: "Kontrakt nenájdený vo fáze 6" });

      const [updated] = await db.update(contracts).set({
        ocrDataAssigned: true,
        scansUploaded: true,
        lifecyclePhase: 8,
        updatedAt: now,
      }).where(eq(contracts.id, Number(contractId))).returning();

      await db.insert(contractLifecycleHistory).values({
        contractId: Number(contractId),
        phase: 8,
        phaseName: LIFECYCLE_PHASES[8] || "Manuálna kontrola kontraktov",
        changedByUserId: appUser?.id || null,
        note: "Manuálne dokončenie - presun do spracovania",
      });

      res.json({ success: true, contract: updated });
    } catch (err: any) {
      console.error("Manual complete phase6 error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/contracts/create-processing-supiska", isAuthenticated, async (req: any, res) => {
    try {
      const { contractIds } = req.body;
      if (!Array.isArray(contractIds) || contractIds.length === 0) {
        return res.status(400).json({ message: "Žiadne kontrakty na zaradenie do súpisky" });
      }
      const appUser = req.appUser;
      const now = new Date();

      const validContracts: any[] = [];
      for (const cid of contractIds) {
        const [contract] = await db.select().from(contracts).where(and(eq(contracts.id, Number(cid)), eq(contracts.lifecyclePhase, 8)));
        if (!contract) continue;
        validContracts.push(contract);
      }
      if (validContracts.length === 0) {
        return res.status(400).json({ message: "Žiadne kontrakty v správnej fáze (8)" });
      }

      const supId = await storage.generateSupiskaId();
      const seqNum = await storage.getNextCounterValue("supiska_processing_sequence");
      const newSupiska = await storage.createSupiska({
        supId,
        name: `Súpiska č. ${seqNum} - Spracovanie`,
        status: "Nova",
        stateId: appUser?.activeStateId || 1,
        companyId: appUser?.activeCompanyId || null,
        createdBy: appUser?.fullName || "System",
        createdByUserId: appUser?.id || null,
        supiskaType: "processing",
      } as any);

      for (let i = 0; i < validContracts.length; i++) {
        const contract = validContracts[i];
        await db.update(contracts).set({
          lifecyclePhase: 9,
          lockedBySupiskaId: newSupiska.id,
          updatedAt: now,
        }).where(eq(contracts.id, contract.id));

        await db.insert(supiskaContracts).values({
          supiskaId: newSupiska.id,
          contractId: contract.id,
        });

        await db.insert(contractLifecycleHistory).values({
          contractId: contract.id,
          phase: 9,
          phaseName: LIFECYCLE_PHASES[9] || "Odoslanie obchodnému partnerovi",
          changedByUserId: appUser?.id || null,
          note: `Zaradené do súpisky č. ${seqNum} (poradie: ${i + 1})`,
        });
        await logLifecycleStatusChange(contract.id, contract.statusId, 9, appUser?.id || null);
      }

      await logAudit(req, {
        action: "CREATE",
        module: "processing_supiska",
        entityId: newSupiska.id,
        entityName: `Súpiska č. ${seqNum}`,
        newData: { contractIds: validContracts.map((c: any) => c.id), sequenceNumber: seqNum, supiskaId: newSupiska.id },
      });

      res.json({ supiskaId: newSupiska.id, sequenceNumber: seqNum, moved: validContracts.length });
    } catch (err: any) {
      console.error("Create processing supiska error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/supisky/:id/move-to-phase9", isAuthenticated, async (req: any, res) => {
    try {
      const supiskaId = Number(req.params.id);
      const supiska = await storage.getSupiska(supiskaId);
      if (!supiska) return res.status(404).json({ message: "Súpiska nenájdená" });
      if ((supiska as any).supiskaType !== "processing") return res.status(400).json({ message: "Súpiska nie je typu spracovanie" });

      const appUser = req.appUser;
      const now = new Date();

      const links = await storage.getSupiskaContracts(supiskaId);
      const contractIdsOnSupiska = links.map(l => l.contractId);
      let moved = 0;
      for (const cid of contractIdsOnSupiska) {
        const [contract] = await db.select().from(contracts).where(and(eq(contracts.id, cid), eq(contracts.lifecyclePhase, 8)));
        if (!contract) continue;
        await db.update(contracts).set({
          lifecyclePhase: 9,
          updatedAt: now,
        }).where(eq(contracts.id, cid));
        await db.insert(contractLifecycleHistory).values({
          contractId: cid,
          phase: 9,
          phaseName: LIFECYCLE_PHASES[9] || "Odoslané obch. partnerovi",
          changedByUserId: appUser?.id || null,
          note: `Presunuté na odoslanie obchodnému partnerovi`,
        });
        await logLifecycleStatusChange(cid, contract.statusId, 9, appUser?.id || null);
        moved++;
      }

      await logAudit(req, {
        action: "MOVE_TO_PHASE9",
        module: "processing_supiska",
        entityId: supiskaId,
        entityName: supiska.name,
        newData: { contractCount: moved },
      });

      res.json({ moved, supiskaId });
    } catch (err: any) {
      console.error("Move to phase 9 error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/supisky/:id/dispatch", isAuthenticated, async (req: any, res) => {
    try {
      const supiskaId = Number(req.params.id);
      const { dispatchMethod, dispatchedAt } = req.body;
      if (!dispatchMethod || !["osobne", "postou", "elektronicky"].includes(dispatchMethod)) {
        return res.status(400).json({ message: "Neplatný spôsob odoslania" });
      }
      const dispatchDate = new Date(dispatchedAt);
      if (isNaN(dispatchDate.getTime())) {
        return res.status(400).json({ message: "Neplatný dátum odoslania" });
      }
      const supiska = await storage.getSupiska(supiskaId);
      if (!supiska) return res.status(404).json({ message: "Súpiska nenájdená" });
      if ((supiska as any).supiskaType !== "processing") return res.status(400).json({ message: "Súpiska nie je typu spracovanie" });
      if (supiska.status === "Odoslana" || supiska.status === "Prijata") return res.status(409).json({ message: "Súpiska je už odoslaná alebo prijatá" });

      const appUser = req.appUser;
      const now = new Date();

      await storage.updateSupiska(supiskaId, {
        dispatchMethod,
        dispatchedAt: dispatchDate,
        status: "Odoslana",
      } as any);

      const links = await storage.getSupiskaContracts(supiskaId);
      const contractIdsOnSupiska = links.map(l => l.contractId);
      for (const cid of contractIdsOnSupiska) {
        const [contract] = await db.select().from(contracts).where(and(eq(contracts.id, cid), or(eq(contracts.lifecyclePhase, 8), eq(contracts.lifecyclePhase, 9))));
        if (!contract) continue;
        await db.update(contracts).set({
          lifecyclePhase: 9,
          sentToPartnerAt: dispatchDate,
          updatedAt: now,
        }).where(eq(contracts.id, cid));
        await db.insert(contractLifecycleHistory).values({
          contractId: cid,
          phase: 9,
          phaseName: LIFECYCLE_PHASES[9] || "Odoslané obch. partnerovi",
          changedByUserId: appUser?.id || null,
          note: `Odoslané: ${dispatchMethod}, dátum: ${dispatchDate.toISOString()}`,
        });
        await logLifecycleStatusChange(cid, contract.statusId, 9, appUser?.id || null);
      }

      await logAudit(req, {
        action: "DISPATCH",
        module: "processing_supiska",
        entityId: supiskaId,
        entityName: supiska.name,
        newData: { dispatchMethod, dispatchedAt: dispatchDate.toISOString(), contractCount: contractIdsOnSupiska.length },
      });

      res.json({ dispatched: contractIdsOnSupiska.length, supiskaId });
    } catch (err: any) {
      console.error("Supiska dispatch error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/supisky/:supiskaId/remove-contract/:contractId", isAuthenticated, async (req: any, res) => {
    try {
      const supiskaId = Number(req.params.supiskaId);
      const contractId = Number(req.params.contractId);
      const appUser = req.appUser;
      const now = new Date();

      const supiska = await storage.getSupiska(supiskaId);
      if (!supiska) return res.status(404).json({ message: "Súpiska nenájdená" });

      const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
      if (!contract) return res.status(404).json({ message: "Zmluva nenájdená" });

      await db.delete(supiskaContracts).where(
        and(eq(supiskaContracts.supiskaId, supiskaId), eq(supiskaContracts.contractId, contractId))
      );

      await db.update(contracts).set({
        lifecyclePhase: 8,
        sentToPartnerAt: null,
        updatedAt: now,
      }).where(eq(contracts.id, contractId));

      await db.insert(contractLifecycleHistory).values({
        contractId,
        phase: 8,
        phaseName: LIFECYCLE_PHASES[8] || "Pripravené na odoslanie",
        changedByUserId: appUser?.id || null,
        note: `Vyradená zo súpisky "${supiska.name}" a vrátená do Manuálna kontrola kontraktov`,
      });

      await logAudit(req, {
        action: "REMOVE_FROM_SUPISKA",
        module: "processing_supiska",
        entityId: contractId,
        entityName: contract.contractNumber || contract.proposalNumber || `ID ${contractId}`,
        oldData: { supiskaId, lifecyclePhase: contract.lifecyclePhase },
        newData: { lifecyclePhase: 8 },
      });

      res.json({ success: true, contractId, supiskaId });
    } catch (err: any) {
      console.error("Remove contract from supiska error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/supisky/:id/receive", isAuthenticated, async (req: any, res) => {
    try {
      const supiskaId = Number(req.params.id);
      const { receivedAt } = req.body;
      const receiveDate = new Date(receivedAt);
      if (isNaN(receiveDate.getTime())) {
        return res.status(400).json({ message: "Neplatný dátum prijatia" });
      }
      if (receiveDate > new Date()) {
        return res.status(400).json({ message: "Dátum a čas prijatia nesmie byť v budúcnosti" });
      }
      const supiska = await storage.getSupiska(supiskaId);
      if (!supiska) return res.status(404).json({ message: "Súpiska nenájdená" });
      if ((supiska as any).supiskaType !== "processing") return res.status(400).json({ message: "Súpiska nie je typu spracovanie" });
      if (supiska.status !== "Odoslana" && supiska.status !== "Odpocet") return res.status(409).json({ message: "Súpiska musí byť najprv odoslaná" });

      const appUser = req.appUser;

      await storage.updateSupiska(supiskaId, {
        receivedByPartnerAt: new Date(),
        status: "Odpocet",
      } as any);

      await logAudit(req, {
        action: "RECEIVE_COUNTDOWN_START",
        module: "processing_supiska",
        entityId: supiskaId,
        entityName: supiska.name,
        newData: { receivedAt: receiveDate.toISOString(), countdownStart: new Date().toISOString() },
      });

      res.json({ supiskaId, countdownStart: new Date().toISOString() });
    } catch (err: any) {
      console.error("Supiska receive error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  async function finalizeSupiskaReceive(supiskaId: number) {
    const supiska = await storage.getSupiska(supiskaId);
    if (!supiska || supiska.status !== "Odpocet") return 0;

    const now = new Date();
    await storage.updateSupiska(supiskaId, { status: "Prijata" } as any);

    const links = await storage.getSupiskaContracts(supiskaId);
    const contractIdsOnSupiska = links.map(l => l.contractId);
    let finalized = 0;
    for (const cid of contractIdsOnSupiska) {
      const [contract] = await db.select().from(contracts).where(and(eq(contracts.id, cid), or(eq(contracts.lifecyclePhase, 9), eq(contracts.lifecyclePhase, 10))));
      if (!contract) continue;
      await db.update(contracts).set({
        lifecyclePhase: 0,
        receivedByPartnerAt: supiska.receivedByPartnerAt || now,
        updatedAt: now,
      }).where(eq(contracts.id, cid));
      await db.insert(contractLifecycleHistory).values({
        contractId: cid,
        phase: 0,
        phaseName: "Vyradené zo spracovania papierových zmluv – prijaté obchodným partnerom",
        changedByUserId: null,
        note: `Prijaté obchodným partnerom (automaticky po 24h odpočte). Zmluva vyradená zo spracovania.`,
      });
      await logLifecycleStatusChange(cid, contract.statusId, 0, null);
      finalized++;
    }
    return finalized;
  }

  app.get("/api/supisky/by-phase/:phase", isAuthenticated, async (req: any, res) => {
    try {
      const phase = Number(req.params.phase);
      if (![8, 9, 10].includes(phase)) return res.status(400).json({ message: "Neplatná fáza" });

      const appUser = req.appUser;
      const stateFilter = appUser?.activeStateId ? eq(supisky.stateId, appUser.activeStateId) : undefined;
      const companyFilter = appUser?.activeCompanyId ? eq(supisky.companyId, appUser.activeCompanyId) : undefined;

      if (phase === 10) {
        const allProcessing = await db.select().from(supisky).where(
          and(
            eq((supisky as any).supiskaType, "processing"),
            or(eq(supisky.status, "Odoslana"), eq(supisky.status, "Odpocet")),
            stateFilter,
            companyFilter,
          )
        );
        const result: any[] = [];
        for (const sup of allProcessing) {
          result.push({ ...sup, contracts: [] });
        }
        return res.json(result);
      }

      const links = await db.select({
        supiskaId: supiskaContracts.supiskaId,
      }).from(supiskaContracts)
        .innerJoin(contracts, eq(supiskaContracts.contractId, contracts.id))
        .where(eq(contracts.lifecyclePhase, phase))
        .groupBy(supiskaContracts.supiskaId);

      const supiskaIds = links.map(l => l.supiskaId);
      if (supiskaIds.length === 0) return res.json([]);

      const result: any[] = [];
      for (const sid of supiskaIds) {
        const supiska = await storage.getSupiska(sid);
        if (!supiska || (supiska as any).supiskaType !== "processing") continue;
        if (stateFilter && supiska.stateId !== appUser.activeStateId) continue;
        if (companyFilter && supiska.companyId !== appUser.activeCompanyId) continue;
        if (phase === 9 && (supiska.status === "Odoslana" || supiska.status === "Odpocet" || supiska.status === "Prijata")) continue;

        const supiskaLinks = await storage.getSupiskaContracts(sid);
        const cids = supiskaLinks.map(l => l.contractId);
        const supiskaContractsList: any[] = [];
        for (const cid of cids) {
          const [c] = await db.select().from(contracts).where(and(eq(contracts.id, cid), eq(contracts.lifecyclePhase, phase)));
          if (c) supiskaContractsList.push(c);
        }
        if (supiskaContractsList.length > 0) {
          result.push({ ...supiska, contracts: supiskaContractsList });
        }
      }

      res.json(result);
    } catch (err: any) {
      console.error("Supisky by phase error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/contract-inventories/reroute-objections", isAuthenticated, async (req: any, res) => {
    try {
      const { contractIds } = req.body;
      if (!Array.isArray(contractIds) || contractIds.length === 0) {
        return res.status(400).json({ message: "Žiadne zmluvy na presmerovanie" });
      }

      const appUser = req.appUser;
      const now = new Date();

      const seqNum = await storage.getNextCounterValue("sprievodka_sequence");
      const newInventory = await storage.createContractInventory({
        name: `Odovzdávací protokol - Sprievodka č. ${seqNum}`,
        stateId: appUser?.activeStateId || 1,
        sortOrder: 0,
        isClosed: false,
      });
      await storage.updateContractInventory(newInventory.id, {
        sequenceNumber: seqNum,
        isDispatched: true,
      } as any);

      const results: any[] = [];
      for (let i = 0; i < contractIds.length; i++) {
        const cid = Number(contractIds[i]);
        const [contract] = await db.select().from(contracts).where(eq(contracts.id, cid));
        if (!contract) continue;

        const oldInventoryId = contract.inventoryId;
        const [updated] = await db.update(contracts)
          .set({
            lifecyclePhase: 2,
            inventoryId: newInventory.id,
            sortOrderInInventory: i + 1,
            updatedAt: now,
          })
          .where(eq(contracts.id, cid))
          .returning();

        await db.insert(contractLifecycleHistory).values({
          contractId: cid,
          phase: 2,
          phaseName: LIFECYCLE_PHASES[2] || "Odoslané",
          changedByUserId: appUser?.id || null,
          note: `Re-sprievodkovanie: výhrada → nová sprievodka č. ${seqNum}, pôvodná sprievodka ID ${oldInventoryId || 'žiadna'}`,
        });
        await logLifecycleStatusChange(cid, contract.statusId, 2, appUser?.id || null);

        await logAudit(req, {
          action: "REROUTE_OBJECTION",
          module: "zmluvy",
          entityId: cid,
          entityName: contract.contractNumber || contract.proposalNumber || `ID ${cid}`,
          oldData: { lifecyclePhase: contract.lifecyclePhase, inventoryId: oldInventoryId },
          newData: { lifecyclePhase: 2, inventoryId: newInventory.id, newSequenceNumber: seqNum },
        });

        results.push(updated);
      }

      res.json({ rerouted: results.length, sequenceNumber: seqNum, inventoryId: newInventory.id });
    } catch (err: any) {
      console.error("Reroute objections error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/contracts/send-to-central", isAuthenticated, async (req: any, res) => {
    try {
      const { contractIds } = req.body;
      if (!Array.isArray(contractIds) || contractIds.length === 0) {
        return res.status(400).json({ message: "Žiadne zmluvy na odoslanie" });
      }

      const appUser = req.appUser;
      const now = new Date();
      let sent = 0;
      for (const cid of contractIds) {
        const id = Number(cid);
        const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
        if (!contract) continue;

        await db.update(contracts)
          .set({
            lifecyclePhase: 2,
            updatedAt: now,
          })
          .where(eq(contracts.id, id));

        await db.insert(contractLifecycleHistory).values({
          contractId: id,
          phase: 2,
          phaseName: LIFECYCLE_PHASES[2] || "Odoslané",
          changedByUserId: appUser?.id || null,
          note: `Odoslané do centrály z výhrad`,
        });

        await logAudit(req, {
          action: "SEND_TO_CENTRAL",
          module: "zmluvy",
          entityId: id,
          entityName: contract.contractNumber || contract.proposalNumber || `ID ${id}`,
          oldData: { statusId: contract.statusId },
          newData: { lifecyclePhase: 2 },
        });

        sent++;
      }

      res.json({ sent });
    } catch (err: any) {
      console.error("Send to central error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });


  // === CONTRACT LIFECYCLE HISTORY (Stroj času) ===
  app.get("/api/contracts/:id/lifecycle-history", isAuthenticated, async (req: any, res) => {
    try {
      const contractId = Number(req.params.id);
      const contract = await storage.getContract(contractId);
      if (!contract) return res.status(404).json({ message: "Zmluva nenájdená" });
      const appUser = req.appUser;
      if (!isAdmin(appUser)) {
        const isOwner = contract.uploadedByUserId === appUser.id;
        const inChain = await isInManagerChain(appUser.id, contract.uploadedByUserId, appUser.activeCompanyId);
        if (!isOwner && !inChain) {
          return res.status(403).json({ message: "Nemáte oprávnenie" });
        }
      }
      const history = await db
        .select({
          id: contractLifecycleHistory.id,
          contractId: contractLifecycleHistory.contractId,
          phase: contractLifecycleHistory.phase,
          phaseName: contractLifecycleHistory.phaseName,
          changedByUserId: contractLifecycleHistory.changedByUserId,
          changedAt: contractLifecycleHistory.changedAt,
          note: contractLifecycleHistory.note,
          changerFirstName: appUsers.firstName,
          changerLastName: appUsers.lastName,
          changerUsername: appUsers.username,
        })
        .from(contractLifecycleHistory)
        .leftJoin(appUsers, eq(contractLifecycleHistory.changedByUserId, appUsers.id))
        .where(eq(contractLifecycleHistory.contractId, contractId))
        .orderBy(contractLifecycleHistory.changedAt);

      res.json(history.map(h => ({
        ...h,
        changerName: [h.changerFirstName, h.changerLastName].filter(Boolean).join(" ") || h.changerUsername || "System",
      })));
    } catch (err: any) {
      console.error("Get lifecycle history error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  // === REJECTED CONTRACTS (ArutsoK 49) ===
  app.get("/api/contracts/rejected", isAuthenticated, async (req: any, res) => {
    try {
      const companyId = req.appUser?.activeCompanyId || undefined;
      const stateId = req.appUser?.activeStateId || undefined;
      res.json(await storage.getRejectedContracts(companyId, stateId));
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  // === ALL STATUS VISIBILITY DATA (ArutsoK 49 - bulk load for filtering) ===
  app.get("/api/contract-statuses/all-visibility", isAuthenticated, async (_req: any, res) => {
    try {
      const statuses = await storage.getContractStatuses();
      const allCtTypes = await storage.getAllContractStatusContractTypes();
      const ctTypeMap: Record<number, string[]> = {};
      for (const item of allCtTypes) {
        if (!ctTypeMap[item.statusId]) ctTypeMap[item.statusId] = [];
        ctTypeMap[item.statusId].push(item.contractType);
      }
      const result: Record<number, { companies: number[]; visibility: { entityType: string; entityId: number }[]; contractTypes: string[] }> = {};
      for (const s of statuses) {
        const companies = await storage.getContractStatusCompanies(s.id);
        const visibility = await storage.getContractStatusVisibility(s.id);
        result[s.id] = {
          companies: companies.map(c => c.companyId),
          visibility: visibility.map(v => ({ entityType: v.entityType, entityId: v.entityId })),
          contractTypes: ctTypeMap[s.id] || [],
        };
      }
      res.json(result);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  // === CONTRACT TEMPLATES ===
  app.get(api.contractTemplatesApi.list.path, isAuthenticated, async (req: any, res) => {
    res.json(await storage.getContractTemplates(getEnforcedStateId(req)));
  });

  app.post(api.contractTemplatesApi.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.contractTemplatesApi.create.input.parse(req.body);
      const created = await storage.createContractTemplate(input);
      await logAudit(req, { action: "CREATE", module: "sablony_zmluv", entityId: created.id, entityName: created.name, newData: input });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put(api.contractTemplatesApi.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.contractTemplatesApi.update.input.parse(req.body);
      const updated = await storage.updateContractTemplate(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "sablony_zmluv", entityId: Number(req.params.id), newData: input });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(api.contractTemplatesApi.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const templateId = Number(req.params.id);
      const allContracts = await storage.getContracts();
      const contractsWithTemplate = allContracts.filter(c => c.templateId === templateId);
      if (contractsWithTemplate.length > 0) {
        return res.status(400).json({ message: `Sablonu nie je mozne vymazat, pouziva ju ${contractsWithTemplate.length} zmluv` });
      }
      await storage.deleteContractTemplate(templateId);
      await logAudit(req, { action: "DELETE", module: "sablony_zmluv", entityId: templateId });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/contract-templates/:id/upload", isAuthenticated, (req, _res, next) => {
    (req as any)._uploadSection = "official";
    next();
  }, upload.single("file"), async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });
      const secScan = await scanUploadedFile(file.path, file.originalname, file.mimetype);
      if (!secScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: ${secScan.reason}` });
      const fileUrl = `/api/files/official/${file.filename}`;
      const updated = await storage.updateContractTemplate(Number(req.params.id), {
        fileUrl,
        fileOriginalName: file.originalname,
      });
      await logAudit(req, { action: "UPDATE", module: "sablony_zmluv", entityId: Number(req.params.id), entityName: "template upload" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Upload failed" });
    }
  });

  // === CONTRACT INVENTORIES ===
  app.get(api.contractInventoriesApi.list.path, isAuthenticated, async (req: any, res) => {
    res.json(await storage.getContractInventories(getEnforcedStateId(req)));
  });

  app.post(api.contractInventoriesApi.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.contractInventoriesApi.create.input.parse(req.body);
      const created = await storage.createContractInventory(input);
      await logAudit(req, { action: "CREATE", module: "supisky", entityId: created.id, entityName: created.name, newData: input });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/contract-inventories/summary", isAuthenticated, async (req: any, res) => {
    try {
      const stateId = getEnforcedStateId(req);
      const allInventories = await storage.getContractInventories(stateId);
      const allStatuses = await storage.getContractStatuses();

      const STATUS_PHASE_MAP: Record<string, number> = {
        "neprijata": 3, "vyhrady": 3, "nedodana": 3, "chybna": 3,
        "odoslana": 2, "sprievodke": 2,
        "prijata": 5, "vybavena": 5, "spracovana": 5, "schvalenie": 5,
        "zrusena": 4, "prestup": 4,
        "nahrata": 1, "caka": 1, "doplnit": 1, "bonus": 1, "malus": 1, "nedorucena": 1,
      };

      function derivePhase(lp: number | null, statusId: number | null): number {
        if (lp && lp > 0) return lp;
        if (!statusId) return 1;
        const status = allStatuses.find((s: any) => s.id === statusId);
        if (!status) return 1;
        const nameLower = (status.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const [keyword, phase] of Object.entries(STATUS_PHASE_MAP)) {
          if (nameLower.includes(keyword)) return phase;
        }
        return 1;
      }

      const allContracts = await db.select({
        id: contracts.id,
        inventoryId: contracts.inventoryId,
        lifecyclePhase: contracts.lifecyclePhase,
        statusId: contracts.statusId,
        isDeleted: contracts.isDeleted,
      }).from(contracts).where(isNotNull(contracts.inventoryId));

      const contractsByInventory = new Map<number, { effectivePhase: number; isDeleted: boolean }[]>();
      for (const c of allContracts) {
        if (!c.inventoryId) continue;
        if (!contractsByInventory.has(c.inventoryId)) contractsByInventory.set(c.inventoryId, []);
        contractsByInventory.get(c.inventoryId)!.push({
          effectivePhase: derivePhase(c.lifecyclePhase, c.statusId),
          isDeleted: c.isDeleted,
        });
      }

      const result = allInventories
        .sort((a, b) => {
          const aT = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bT = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bT - aT;
        })
        .map(inv => {
          const invContracts = contractsByInventory.get(inv.id) || [];
          let semaphoreColor = "gray";
          if (invContracts.length > 0) {
            const hasPhase3 = invContracts.some(c => !c.isDeleted && c.effectivePhase === 3);
            const hasPhase7 = invContracts.some(c => !c.isDeleted && c.effectivePhase === 7);
            const allArchiv = invContracts.every(c => c.isDeleted || c.effectivePhase === 4);
            const allGreen = invContracts.every(c => !c.isDeleted && c.effectivePhase >= 5 && c.effectivePhase !== 7);

            if (hasPhase3) semaphoreColor = "red";
            else if (hasPhase7) semaphoreColor = "orange";
            else if (allArchiv) semaphoreColor = "black";
            else if (allGreen) semaphoreColor = "green";
            else semaphoreColor = "blue";
          }
          return {
            id: inv.id,
            name: inv.name,
            sequenceNumber: inv.sequenceNumber,
            createdAt: inv.createdAt,
            semaphoreColor,
          };
        });

      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/contract-inventories/:id/contracts", isAuthenticated, async (req: any, res) => {
    try {
      const inventoryId = Number(req.params.id);
      const contractsInInventory = await storage.getContracts({ inventoryId });
      const allSubjects = await storage.getSubjects();
      const allStatuses = await storage.getContractStatuses();
      const subjectMap = new Map(allSubjects.map((s: any) => [s.id, s]));

      const STATUS_PHASE_MAP: Record<string, number> = {
        "neprijata": 3, "vyhrady": 3, "nedodana": 3, "chybna": 3,
        "odoslana": 2, "sprievodke": 2,
        "prijata": 5, "vybavena": 5, "spracovana": 5, "schvalenie": 5,
        "zrusena": 4, "prestup": 4,
        "nahrata": 1, "caka": 1, "doplnit": 1, "bonus": 1, "malus": 1, "nedorucena": 1,
      };

      function derivePhaseFromStatus(statusId: number | null): number {
        if (!statusId) return 1;
        const status = allStatuses.find((s: any) => s.id === statusId);
        if (!status) return 1;
        const nameLower = (status.name || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        for (const [keyword, phase] of Object.entries(STATUS_PHASE_MAP)) {
          if (nameLower.includes(keyword)) return phase;
        }
        return 1;
      }

      const enriched = contractsInInventory.map((c: any) => {
        const subj = c.subjectId ? subjectMap.get(c.subjectId) : null;
        const effectivePhase = (c.lifecyclePhase && c.lifecyclePhase > 0) ? c.lifecyclePhase : derivePhaseFromStatus(c.statusId);
        return {
          id: c.id,
          contractNumber: c.contractNumber,
          proposalNumber: c.proposalNumber,
          contractType: c.contractType,
          lifecyclePhase: effectivePhase,
          statusId: c.statusId,
          sortOrderInInventory: c.sortOrderInInventory,
          isDeleted: c.isDeleted,
          subjectName: subj
            ? (subj.type === 'person'
              ? `${subj.lastName || ''}, ${subj.firstName || ''}`.replace(/^, |, $/g, '')
              : subj.companyName || '')
            : '—',
          subjectUid: subj?.uid || null,
          subjectListStatus: subj?.listStatus || null,
          subjectRedListCompanyId: subj?.redListCompanyId || null,
        };
      });
      enriched.sort((a: any, b: any) => (a.sortOrderInInventory || 0) - (b.sortOrderInInventory || 0));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/contract-inventories/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const { items } = req.body;
      await storage.reorderContractInventories(items);
      await logAudit(req, { action: "UPDATE", module: "supisky", entityName: "reorder" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put(api.contractInventoriesApi.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.contractInventoriesApi.update.input.parse(req.body);
      const updated = await storage.updateContractInventory(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "supisky", entityId: Number(req.params.id), newData: input });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(api.contractInventoriesApi.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteContractInventory(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "supisky", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // ArutsoK 46 - Phase 1: Dispatch contracts (PFA sends to Central Office)
  app.post("/api/contract-inventories/:id/dispatch", isAuthenticated, async (req: any, res) => {
    try {
      const inventoryId = Number(req.params.id);
      const { contractIds } = req.body;
      if (!Array.isArray(contractIds) || contractIds.length === 0) {
        return res.status(400).json({ message: "Ziadne zmluvy na odoslanie" });
      }
      const validContractIds = contractIds.map(Number).filter(id => Number.isInteger(id) && id > 0);
      if (validContractIds.length === 0) {
        return res.status(400).json({ message: "Neplatne ID zmluv" });
      }
      const target = await storage.getContractInventoryById(inventoryId);
      if (!target) {
        return res.status(404).json({ message: "Sprievodka nenajdena" });
      }
      const seqNum = await storage.getNextCounterValue("sprievodka_sequence");
      const dispatchedAt = new Date();
      await storage.updateContractInventory(inventoryId, { 
        sequenceNumber: seqNum, 
        name: `Odovzdávací protokol - Sprievodka č. ${seqNum}`,
        isDispatched: true,
        dispatchedAt,
      } as any);
      await storage.bulkAssignContractsToInventory(inventoryId, validContractIds, dispatchedAt);
      await logAudit(req, {
        action: "CREATE",
        module: "sprievodka_dispatch",
        entityId: inventoryId,
        entityName: `Sprievodka c. ${seqNum}`,
        newData: { contractIds: validContractIds, sequenceNumber: seqNum },
      });
      res.json({ success: true, dispatchedCount: validContractIds.length, sequenceNumber: seqNum });
    } catch (err: any) {
      console.error("[DISPATCH ERROR]", err?.message || err, err?.stack);
      res.status(500).json({ message: "Chyba pri odosielani zmluv" });
    }
  });

  // ArutsoK 48 - Phase 2: Accept contracts (Central Office verifies and accepts)
  app.post("/api/contract-inventories/:id/accept", isAuthenticated, async (req: any, res) => {
    try {
      const inventoryId = Number(req.params.id);
      const { contractIds } = req.body;
      if (!Array.isArray(contractIds) || contractIds.length === 0) {
        return res.status(400).json({ message: "Ziadne zmluvy na prijatie" });
      }
      const target = await storage.getContractInventoryById(inventoryId);
      if (!target) {
        return res.status(404).json({ message: "Sprievodka nenajdena" });
      }
      const globalNumbers: Record<number, number> = {};
      const acceptedContractIds = contractIds.map(Number);
      for (const cId of acceptedContractIds) {
        const contract = await storage.getContract(cId);
        if (!contract) continue;
        const updateData: any = {
          acceptedAt: new Date(),
          lifecyclePhase: 5,
        };
        if (!contract.globalNumber) {
          const globalNum = await storage.getNextCounterValue("global_contract_number");
          updateData.globalNumber = globalNum;
          globalNumbers[cId] = globalNum;
        }
        await storage.updateContract(cId, updateData);
      }
      await storage.updateContractInventory(inventoryId, { isAccepted: true } as any);
      await logAudit(req, {
        action: "UPDATE",
        module: "sprievodka_accept",
        entityId: inventoryId,
        entityName: target.name,
        newData: { contractIds: acceptedContractIds, globalNumbers },
      });
      res.json({ success: true, acceptedCount: acceptedContractIds.length, globalNumbers });
    } catch (err: any) {
      console.error("Accept error:", err?.message || err, err?.stack);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  // === GHOST MODE: Bulk date inheritance for Sprievodky ===
  app.post("/api/contract-inventories/:id/bulk-apply-date", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || appUser.role !== "superadmin") {
        return res.status(403).json({ message: "Ghost Mode: len pre superadmina" });
      }
      const migrationOn = await isMigrationModeOn();
      if (!migrationOn) {
        return res.status(403).json({ message: "Hromadné pečiatkovanie je dostupné len v migračnom režime" });
      }
      const inventoryId = Number(req.params.id);
      const { logisticDate, onlyMissing } = req.body;
      if (!logisticDate) {
        return res.status(400).json({ message: "Dátum logistickej operácie je povinný" });
      }
      const dateVal = new Date(logisticDate);
      await db.update(contractInventories).set({
        logisticOperationDate: dateVal,
        updatedAt: new Date(),
      }).where(eq(contractInventories.id, inventoryId));
      const inventoryContracts = await storage.getContracts({ inventoryId });
      const batch = inventoryContracts.slice(0, 25);
      let updatedCount = 0;
      for (const contract of batch) {
        const shouldUpdate = onlyMissing
          ? !contract.signedDate && !contract.receivedByCentralAt && !contract.sentToPartnerAt && !contract.receivedByPartnerAt
          : true;
        if (shouldUpdate) {
          await db.update(contracts).set({
            signedDate: (onlyMissing && contract.signedDate) ? contract.signedDate : dateVal,
            receivedByCentralAt: (onlyMissing && contract.receivedByCentralAt) ? contract.receivedByCentralAt : dateVal,
            sentToPartnerAt: (onlyMissing && contract.sentToPartnerAt) ? contract.sentToPartnerAt : dateVal,
            receivedByPartnerAt: (onlyMissing && contract.receivedByPartnerAt) ? contract.receivedByPartnerAt : dateVal,
            createdAt: dateVal,
            updatedAt: dateVal,
          }).where(eq(contracts.id, contract.id));
          updatedCount++;
        }
      }
      await logAudit(req, {
        action: "MIGRATION_BULK_DATE",
        module: "zmluvy",
        entityName: `Hromadné pečiatkovanie - Súpiska ${inventoryId}`,
        newData: { logisticDate, onlyMissing, updatedCount, totalInBatch: batch.length },
      });
      res.json({ success: true, updatedCount, totalInBatch: batch.length, skipped: batch.length - updatedCount });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri hromadnom pečiatkovaní" });
    }
  });

  // === GHOST MODE: Bulk date inheritance for Súpisky ===
  app.post("/api/contract-templates/:id/bulk-apply-date", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || appUser.role !== "superadmin") {
        return res.status(403).json({ message: "Ghost Mode: len pre superadmina" });
      }
      const migrationOn = await isMigrationModeOn();
      if (!migrationOn) {
        return res.status(403).json({ message: "Hromadné pečiatkovanie je dostupné len v migračnom režime" });
      }
      const templateId = Number(req.params.id);
      const { logisticDate, onlyMissing } = req.body;
      if (!logisticDate) {
        return res.status(400).json({ message: "Dátum logistickej operácie je povinný" });
      }
      const dateVal = new Date(logisticDate);
      await db.update(contractTemplates).set({
        logisticOperationDate: dateVal,
        updatedAt: new Date(),
      }).where(eq(contractTemplates.id, templateId));
      const templateContracts = await storage.getContracts({ templateId });
      const batch = templateContracts.slice(0, 25);
      let updatedCount = 0;
      for (const contract of batch) {
        const shouldUpdate = onlyMissing
          ? !contract.signedDate && !contract.receivedByCentralAt && !contract.sentToPartnerAt && !contract.receivedByPartnerAt
          : true;
        if (shouldUpdate) {
          await db.update(contracts).set({
            signedDate: (onlyMissing && contract.signedDate) ? contract.signedDate : dateVal,
            receivedByCentralAt: (onlyMissing && contract.receivedByCentralAt) ? contract.receivedByCentralAt : dateVal,
            sentToPartnerAt: (onlyMissing && contract.sentToPartnerAt) ? contract.sentToPartnerAt : dateVal,
            receivedByPartnerAt: (onlyMissing && contract.receivedByPartnerAt) ? contract.receivedByPartnerAt : dateVal,
            createdAt: dateVal,
            updatedAt: dateVal,
          }).where(eq(contracts.id, contract.id));
          updatedCount++;
        }
      }
      await logAudit(req, {
        action: "MIGRATION_BULK_DATE",
        module: "zmluvy",
        entityName: `Hromadné pečiatkovanie - Sprievodka ${templateId}`,
        newData: { logisticDate, onlyMissing, updatedCount, totalInBatch: batch.length },
      });
      res.json({ success: true, updatedCount, totalInBatch: batch.length, skipped: batch.length - updatedCount });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri hromadnom pečiatkovaní" });
    }
  });

  // ArutsoK 45 - Get dispatched contracts (pending acceptance)
  app.get("/api/contracts/dispatched", isAuthenticated, async (req: any, res) => {
    try {
      const companyId = req.appUser?.activeCompanyId || undefined;
      const stateId = req.appUser?.activeStateId || undefined;
      const dispatched = await storage.getDispatchedContracts(companyId, stateId);
      res.json(dispatched);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // ArutsoK 47 - Check contract number duplicate
  app.get("/api/contracts/check-duplicate", isAuthenticated, async (req: any, res) => {
    try {
      const contractNumber = req.query.contractNumber as string;
      if (!contractNumber) return res.json({ exists: false });
      const result = await storage.checkContractDuplicate(contractNumber);
      const appUser = req.appUser;
      if (result.exists && result.contract) {
        const hasAccess = !appUser || appUser.role === 'admin' || appUser.role === 'superadmin' 
          || result.contract.uploadedByUserId === appUser.id;
        if (!hasAccess) {
          const acquirers = await storage.getContractAcquirers(result.contract.id);
          const isAcquirer = acquirers.some(a => a.userId === appUser?.id);
          if (!isAcquirer) {
            return res.json({ exists: true, subjectName: undefined });
          }
        }
      }
      res.json({ exists: result.exists, subjectName: result.subjectName });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/contracts/check-number-duplicates", isAuthenticated, async (req: any, res) => {
    try {
      const contractNumber = (req.query.contractNumber as string) || undefined;
      const proposalNumber = (req.query.proposalNumber as string) || undefined;
      if (!contractNumber?.trim() && !proposalNumber?.trim()) return res.json([]);
      const currentStateId = req.appUser?.activeStateId ?? null;
      const duplicates = await storage.findContractsByNumbers({ contractNumber, proposalNumber });
      const result = duplicates.map(d => ({ ...d, sameState: currentStateId !== null && d.stateId === currentStateId }));
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // ArutsoK 47 - Get accepted contracts (folder 3)
  app.get("/api/contracts/accepted", isAuthenticated, async (req: any, res) => {
    try {
      const companyId = req.appUser?.activeCompanyId || undefined;
      const stateId = req.appUser?.activeStateId || undefined;
      res.json(await storage.getAcceptedContracts(companyId, stateId));
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // ArutsoK 47 - Get archived contracts (folder 4, older than 1 year)
  app.get("/api/contracts/archived", isAuthenticated, async (req: any, res) => {
    try {
      const companyId = req.appUser?.activeCompanyId || undefined;
      const stateId = req.appUser?.activeStateId || undefined;
      res.json(await storage.getArchivedContracts(companyId, stateId));
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // ArutsoK 47 - Contract acquirers CRUD
  app.get("/api/contracts/:contractId/acquirers", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getContractAcquirers(Number(req.params.contractId)));
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/contracts/:contractId/acquirers", isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "userId is required" });
      const created = await storage.addContractAcquirer({ contractId: Number(req.params.contractId), userId });
      await logAudit(req, { action: "CREATE", module: "contract_acquirers", entityId: created.id, newData: { contractId: Number(req.params.contractId), userId } });
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/contract-acquirers/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.removeContractAcquirer(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "contract_acquirers", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // ArutsoK 43 - Get system contract status
  app.get("/api/contract-statuses/system", isAuthenticated, async (_req: any, res) => {
    const status = await storage.getSystemContractStatus();
    res.json(status || null);
  });

  // === CONTRACTS (Main) ===
  function getContractAccessRole(contract: any, userUid: string | null | undefined, userRole: string | null | undefined, userIco?: string | null, userBirthNumber?: string | null): string {
    if (!userUid) return 'full';
    if (userRole === 'superadmin' || userRole === 'admin') return 'full';
    if (contract.ziskatelUid === userUid || contract.specialistaUid === userUid) return 'full';
    if (contract.klientUid === userUid || contract.zakonnyZastupcaUid === userUid || contract.konatelUid === userUid || contract.szcoUid === userUid) return 'klient';
    if (userIco && contract.szcoIco && contract.szcoIco === userIco) return 'klient';
    if (userBirthNumber && contract.szcoRodneCislo) {
      try {
        const decryptedRc = decryptField(contract.szcoRodneCislo);
        if (decryptedRc === userBirthNumber) return 'klient';
      } catch {}
    }
    return 'full';
  }

  app.get(api.contractsApi.list.path, isAuthenticated, async (req: any, res) => {
    const appUser = req.appUser;
    const parsedLimit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const parsedOffset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const limit = isNaN(parsedLimit) ? 50 : Math.min(parsedLimit, 200);
    const offset = isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);
    const statusIdsParam = req.query.statusIds as string | undefined;
    const statusIds = statusIdsParam ? statusIdsParam.split(",").map(Number).filter(n => !isNaN(n)) : undefined;
    const filters = {
      stateId: getEnforcedStateId(req),
      statusId: !statusIds ? (req.query.statusId ? parseInt(req.query.statusId as string) : undefined) : undefined,
      statusIds: statusIds && statusIds.length > 0 ? statusIds : undefined,
      needsManualVerification: req.query.needsManualVerification === 'true' ? true : undefined,
      inventoryId: req.query.inventoryId ? parseInt(req.query.inventoryId as string) : undefined,
      includeDeleted: req.query.includeDeleted === 'true',
      unprocessed: req.query.unprocessed === 'true',
      companyId: appUser?.activeCompanyId || undefined,
      limit,
      offset,
    };
    let { data: allContracts, total } = await storage.getContractsPaginated(filters);

    if (!isAdmin(appUser) && appUser) {
      const contractFiltered: any[] = [];
      for (const c of allContracts) {
        if (c.uploadedByUserId === appUser.id) { contractFiltered.push(c); continue; }
        if (await isInManagerChain(appUser.id, c.uploadedByUserId, appUser.activeCompanyId)) { contractFiltered.push(c); continue; }
      }
      allContracts = contractFiltered;
      total = allContracts.length;
    }

    if (appUser) {
      const userUid = appUser.uid;
      let userIco: string | null = null;
      let userBirthNumber: string | null = null;
      if (userUid) {
        const allSubjects = await storage.getSubjects();
        const userSubject = allSubjects.find((s: any) => s.uid === userUid);
        if (userSubject) {
          const details = userSubject.details as any;
          userIco = details?.ico || null;
          if (userSubject.birthNumber) {
            userBirthNumber = decryptField(userSubject.birthNumber);
          }
        }
      }
      const contractsWithAccess = allContracts.map(c => ({
        ...c,
        accessRole: getContractAccessRole(c, userUid, appUser.role, userIco, userBirthNumber),
      }));
      return res.json({ data: contractsWithAccess, total, limit, offset });
    }
    res.json({ data: allContracts, total, limit, offset });
  });

  app.get(api.contractsApi.get.path, isAuthenticated, async (req: any, res) => {
    const contract = await storage.getContract(Number(req.params.id));
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    const appUser = req.appUser;
    if (appUser && appUser.activeStateId && contract.stateId && contract.stateId !== appUser.activeStateId) {
      return res.status(403).json({ message: "Pristup k zmluve z ineho statu nie je povoleny" });
    }
    let userIco: string | null = null;
    let userBirthNumber: string | null = null;
    if (appUser?.uid) {
      const allSubjects = await storage.getSubjects();
      const userSubject = allSubjects.find((s: any) => s.uid === appUser.uid);
      if (userSubject) {
        const details = userSubject.details as any;
        userIco = details?.ico || null;
        if (userSubject.birthNumber) {
          userBirthNumber = decryptField(userSubject.birthNumber);
        }
      }
    }
    const accessRole = getContractAccessRole(contract, appUser?.uid, appUser?.role, userIco, userBirthNumber);
    res.json({ ...contract, accessRole });
  });

  app.post(api.contractsApi.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const migrationDates = req.body?._migrationDates;
      const bodyClean = { ...req.body };
      delete bodyClean._migrationDates;
      const input = api.contractsApi.create.input.parse(bodyClean);
      const appUser = req.appUser;

      if (input.subjectId) {
        const isCierny = await storage.isSubjectInGroup(input.subjectId, "group_cierny_zoznam");
        if (isCierny) {
          return res.status(403).json({ message: "Subjekt je na Globálnom čiernom zozname — operácia zakázaná" });
        }

        const subjectForCheck = await storage.getSubject(input.subjectId);
        if (subjectForCheck?.listStatus === "cerveny") {
          if (!isAdmin(appUser)) {
            return res.status(403).json({ message: "Subjekt na červenom zozname — zmluva vyžaduje schválenie administrátorom" });
          }
        }
      }
      const createData = { ...input, uploadedByUserId: appUser?.id || null } as any;
      if (appUser?.activeStateId) {
        createData.stateId = appUser.activeStateId;
      }
      if (appUser?.activeCompanyId) {
        createData.companyId = appUser.activeCompanyId;
      }
      const nextGlobalNumber = await storage.getNextCounterValue("contract_global_number");
      createData.globalNumber = nextGlobalNumber;

      if (createData.proposalNumber && /^-/.test(String(createData.proposalNumber).trim())) {
        createData.needsManualVerification = true;
      }
      if (createData.contractNumber && /^-/.test(String(createData.contractNumber).trim())) {
        createData.needsManualVerification = true;
      }

      const incompleteMissing: string[] = [];
      if (!createData.partnerId) incompleteMissing.push("Partner");
      if (!createData.productId) incompleteMissing.push("Produkt");
      if (!createData.proposalNumber && !createData.contractNumber) incompleteMissing.push("Číslo návrhu alebo číslo zmluvy");
      if (createData.proposalNumber && /^-/.test(String(createData.proposalNumber).trim())) incompleteMissing.push("Záporné číslo návrhu");
      if (createData.contractNumber && /^-/.test(String(createData.contractNumber).trim())) incompleteMissing.push("Záporné číslo zmluvy");
      if (!createData.subjectId) incompleteMissing.push("Klient");
      if (incompleteMissing.length > 0) {
        createData.incompleteData = true;
        createData.incompleteDataReason = `Chýba: ${incompleteMissing.join(", ")}`;
      } else {
        createData.incompleteData = false;
        createData.incompleteDataReason = null;
      }

      const migrationOn = await isMigrationModeOn();
      if (migrationOn && migrationDates && appUser?.role === "superadmin") {
        if (migrationDates.receivedByCentralAt) createData.receivedByCentralAt = new Date(migrationDates.receivedByCentralAt);
        if (migrationDates.sentToPartnerAt) createData.sentToPartnerAt = new Date(migrationDates.sentToPartnerAt);
        if (migrationDates.receivedByPartnerAt) createData.receivedByPartnerAt = new Date(migrationDates.receivedByPartnerAt);
        if (migrationDates.objectionEnteredAt) createData.objectionEnteredAt = new Date(migrationDates.objectionEnteredAt);
        if (migrationDates.dispatchedAt) createData.dispatchedAt = new Date(migrationDates.dispatchedAt);
        if (migrationDates.acceptedAt) createData.acceptedAt = new Date(migrationDates.acceptedAt);
        if (typeof migrationDates.lifecyclePhase === "number" && migrationDates.lifecyclePhase >= 0 && migrationDates.lifecyclePhase <= 10) {
          createData.lifecyclePhase = migrationDates.lifecyclePhase;
        }
        const historicalDate = createData.signedDate
          || createData.receivedByCentralAt
          || createData.sentToPartnerAt
          || (migrationDates.receivedByCentralAt ? new Date(migrationDates.receivedByCentralAt) : null);
        if (historicalDate) {
          createData.createdAt = new Date(historicalDate);
          createData.updatedAt = new Date(historicalDate);
        }
      }

      let firstContractData: { isFirst: boolean; redirectUserId: number | null; redirectUserName: string | null } = { isFirst: false, redirectUserId: null, redirectUserName: null };
      if (appUser?.id && appUser?.activeDivisionId) {
        try {
          const isFirst = await isFirstContractInDivision(appUser.id, appUser.activeDivisionId, createData.companyId || appUser.activeCompanyId);
          if (isFirst) {
            firstContractData.isFirst = true;
            if (appUser.managerId) {
              const allUsers = await storage.getAppUsers();
              const manager = allUsers.find((u: any) => u.id === appUser.managerId);
              if (manager) {
                firstContractData.redirectUserId = manager.id;
                firstContractData.redirectUserName = [manager.firstName, manager.lastName].filter(Boolean).join(' ') || manager.username || 'Nadriadený';
              }
            }
            createData.isFirstContract = true;
            createData.commissionRedirectedToUserId = firstContractData.redirectUserId;
            createData.commissionRedirectedToName = firstContractData.redirectUserName;
          }
        } catch (e) { console.error("[FIRST_CONTRACT] Error:", e); }
      }

      const created = await storage.createContract(createData);
      if (created.statusId) {
        await storage.createContractStatusChangeLog({
          contractId: created.id,
          oldStatusId: null,
          newStatusId: created.statusId,
          changedByUserId: appUser?.id || null,
          parameterValues: {},
        });
      }

      if (firstContractData.isFirst && firstContractData.redirectUserName) {
        await logAudit(req, { action: "SYSTEM", module: "provizie", entityId: created.id, entityName: created.contractNumber || `Zmluva ${created.id}`, newData: { isFirstContract: true, commissionRedirectedToName: firstContractData.redirectUserName, reason: "Pravidlo prvej zmluvy v divízii" } });
      }

      await logAudit(req, { action: "CREATE", module: "zmluvy", entityId: created.id, entityName: created.contractNumber || `Zmluva ${created.id}`, newData: input });

      if (input.subjectId) {
        try {
          await storage.ensureSubjectInGroup(input.subjectId, "group_klient");
        } catch (e) { /* silent — group may not exist yet */ }

        try {
          const [subj] = await db.select().from(subjects).where(eq(subjects.id, input.subjectId));
          if (subj && subj.registrationStatus !== 'klient') {
            const oldStatus = subj.registrationStatus || 'tiper';
            await db.update(subjects).set({ registrationStatus: 'klient' }).where(eq(subjects.id, input.subjectId));
            await storage.recordFieldChanges(input.subjectId, { registrationStatus: oldStatus }, { registrationStatus: 'klient' }, appUser?.id, 'Automaticky upgrade pri vytvoreni zmluvy', appUser?.firstName + ' ' + appUser?.lastName);
            await logAudit(req, { action: "UPDATE", module: "subjekty", entityId: input.subjectId, entityName: `${subj.firstName || ''} ${subj.lastName || subj.companyName || ''}`.trim(), oldData: { registrationStatus: oldStatus }, newData: { registrationStatus: 'klient' } });
          }
        } catch (e) { /* silent */ }
      }

      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/subjects/check-identifier", isAuthenticated, async (req: any, res) => {
    try {
      const { type, value, stateId } = req.query;
      if (!type || !value || !stateId) {
        return res.status(400).json({ message: "type, value a stateId su povinne" });
      }
      const stateIdNum = parseInt(stateId as string);
      if (isNaN(stateIdNum)) {
        return res.status(400).json({ message: "Neplatne stateId" });
      }
      const allSubjects = await storage.getSubjects();
      const val = (value as string).trim();
      let found = null;
      if (type === "rodne_cislo") {
        found = allSubjects.find((s: any) => s.stateId === stateIdNum && s.birthNumber === val && s.isActive);
      } else if (type === "ico") {
        found = allSubjects.find((s: any) => {
          if (s.stateId !== stateIdNum || !s.isActive) return false;
          const details = s.details as any;
          return details?.ico === val;
        });
      }
      if (found) {
        const name = found.type === "person"
          ? `${found.firstName || ""} ${found.lastName || ""}`.trim()
          : (found.companyName || "");
        res.json({ exists: true, subjectName: name, subjectUid: found.uid });
      } else {
        res.json({ exists: false });
      }
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/contracts/needs-verification", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || (appUser.role !== 'superadmin' && appUser.role !== 'admin' && appUser.role !== 'prezident')) {
        return res.status(403).json({ message: "Nemáte oprávnenie" });
      }
      const allContracts = await storage.getContracts({ stateId: appUser.activeStateId || undefined });
      const needsVerification = allContracts.filter((c: any) => c.needsManualVerification === true);
      res.json(needsVerification);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/contracts/:id/verify", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || (appUser.role !== 'superadmin' && appUser.role !== 'admin' && appUser.role !== 'prezident')) {
        return res.status(403).json({ message: "Nemáte oprávnenie" });
      }
      const contractId = Number(req.params.id);
      const contract = await storage.getContract(contractId);
      if (!contract) return res.status(404).json({ message: "Zmluva nenájdená" });
      const updated = await storage.updateContract(contractId, { needsManualVerification: false } as any);
      await logAudit(req, { action: "VERIFY", module: "zmluvy", entityId: contractId, entityName: contract.contractNumber || `Zmluva ${contractId}` });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/contracts/import-excel", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !isAdmin(appUser)) {
        return res.status(403).json({ message: "Nedostatočné oprávnenia pre hromadný import" });
      }
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Nebol nahratý žiadny súbor" });
      const secScan = await scanUploadedFile(file.path, file.originalname, file.mimetype);
      if (!secScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: ${secScan.reason}` });

      const fileName = file.originalname || "import";
      const isCSV = /\.csv$/i.test(fileName);
      let headers: string[] = [];
      const rawRows: Record<string, string>[] = [];

      const POSITIONAL_COLUMNS = ["partner", "produkt", "typ_zmluvy", "cislo_navrhu", "cislo_zmluvy", "typ_subjektu", "rc_ico", "nazov_firmy", "titul_pred", "meno", "priezvisko", "titul_za"];

      const HEADER_ALIASES: Record<string, string> = {
        "cislo navrhu": "cislo_navrhu", "cislo_navrhu": "cislo_navrhu", "proposal_number": "cislo_navrhu", "č. návrhu": "cislo_navrhu", "číslo návrhu": "cislo_navrhu", "cislo navrhu": "cislo_navrhu",
        "cislo zmluvy": "cislo_zmluvy", "cislo_zmluvy": "cislo_zmluvy", "contract_number": "cislo_zmluvy", "č. zmluvy": "cislo_zmluvy", "číslo zmluvy": "cislo_zmluvy",
        "partner": "partner", "partner_name": "partner",
        "produkt": "produkt", "product": "produkt", "product_name": "produkt",
        "typ subjektu": "typ_subjektu", "typ_subjektu": "typ_subjektu", "subject_type": "typ_subjektu", "typ": "typ_subjektu",
        "rc ico": "rc_ico", "rc_ico": "rc_ico", "rc / ico": "rc_ico", "rc_/_ico": "rc_ico", "rc/ico": "rc_ico", "rodne cislo": "rc_ico", "rodné číslo": "rc_ico", "rodne_cislo": "rc_ico", "rc": "rc_ico", "ico": "rc_ico", "ičo": "rc_ico", "birth_number": "rc_ico",
        "nazov firmy": "nazov_firmy", "nazov_firmy": "nazov_firmy", "názov firmy": "nazov_firmy", "company_name": "nazov_firmy", "firma": "nazov_firmy",
        "titul pred": "titul_pred", "titul_pred": "titul_pred", "title_before": "titul_pred", "titul pred menom": "titul_pred",
        "meno": "meno", "first_name": "meno", "krstne meno": "meno", "krstné meno": "meno",
        "priezvisko": "priezvisko", "last_name": "priezvisko",
        "titul za": "titul_za", "titul_za": "titul_za", "title_after": "titul_za", "titul za menom": "titul_za",
        "specialista": "specialista", "specialist": "specialista", "specialista_uid": "specialista", "specialista uid": "specialista", "m: specialista uid": "specialista", "m: špecialista uid": "specialista",
        "specialista podiel": "specialista_podiel", "specialista_podiel": "specialista_podiel", "specialist_percentage": "specialista_podiel", "specialista_%": "specialista_podiel", "specialista_pct": "specialista_podiel", "n: specialista %": "specialista_podiel", "n: špecialista %": "specialista_podiel",
        "odporucitel": "odporucitel", "odporucatel": "odporucitel", "recommender": "odporucitel", "odporucitel1_uid": "odporucitel", "odporucitel1 uid": "odporucitel", "odporucatel 1 uid": "odporucitel", "odporucatel_1_uid": "odporucitel", "o: odporucitel 1 uid": "odporucitel", "o: odporúčateľ 1 uid": "odporucitel",
        "odporucitel podiel": "odporucitel_podiel", "odporucitel_podiel": "odporucitel_podiel", "recommender_percentage": "odporucitel_podiel", "odporucitel1_%": "odporucitel_podiel", "odporucitel1_pct": "odporucitel_podiel", "p: odporucitel 1 %": "odporucitel_podiel", "p: odporúčateľ 1 %": "odporucitel_podiel", "odporucatel 1 %": "odporucitel_podiel", "odporucatel_1_%": "odporucitel_podiel",
        "odporucitel2_uid": "odporucitel2", "odporucitel2 uid": "odporucitel2", "odporucatel 2 uid": "odporucitel2", "odporucatel_2_uid": "odporucitel2", "q: odporucitel 2 uid": "odporucitel2", "q: odporúčateľ 2 uid": "odporucitel2",
        "odporucitel2_%": "odporucitel2_podiel", "odporucitel2_pct": "odporucitel2_podiel", "odporucitel2_podiel": "odporucitel2_podiel", "r: odporucitel 2 %": "odporucitel2_podiel", "r: odporúčateľ 2 %": "odporucitel2_podiel", "odporucatel 2 %": "odporucitel2_podiel", "odporucatel_2_%": "odporucitel2_podiel",
        "typ zmluvy": "typ_zmluvy", "typ_zmluvy": "typ_zmluvy", "type_of_contract": "typ_zmluvy", "contract_type": "typ_zmluvy", "c: typ zmluvy": "typ_zmluvy",
      };

      function removeDiacritics(str: string): string {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      }

      function normalizeHeader(raw: string): string {
        const trimmed = raw.trim().toLowerCase();
        if (HEADER_ALIASES[trimmed]) return HEADER_ALIASES[trimmed];
        const noDiac = removeDiacritics(trimmed);
        if (HEADER_ALIASES[noDiac]) return HEADER_ALIASES[noDiac];
        const underscored = noDiac.replace(/\s+/g, "_");
        if (HEADER_ALIASES[underscored]) return HEADER_ALIASES[underscored];
        const noPrefix = noDiac.replace(/^[a-z]:\s*/, "");
        if (HEADER_ALIASES[noPrefix]) return HEADER_ALIASES[noPrefix];
        const noPrefixUnder = noPrefix.replace(/\s+/g, "_");
        if (HEADER_ALIASES[noPrefixUnder]) return HEADER_ALIASES[noPrefixUnder];
        return underscored;
      }

      const KNOWN_IMPORT_HEADERS = new Set([...POSITIONAL_COLUMNS, ...Object.values(HEADER_ALIASES), "specialista", "specialista_podiel", "odporucitel", "odporucitel_podiel", "odporucitel2", "odporucitel2_podiel", "typ_zmluvy"]);

      if (isCSV) {
        const csvContent = fs.readFileSync(file.path, "utf-8");
        const records = csvParse(csvContent, { columns: true, skip_empty_lines: true, delimiter: [";", ",", "\t"], relax_column_count: true });
        if (records.length === 0) return res.status(400).json({ message: "CSV neobsahuje žiadne dáta" });
        const rawCsvHeaders = Object.keys(records[0] as Record<string, unknown>);
        const headerMap: Record<string, string> = {};
        for (const h of rawCsvHeaders) {
          headerMap[h] = normalizeHeader(h);
        }
        headers = Object.values(headerMap);
        for (const rec of records) {
          const rowData: Record<string, string> = {};
          for (const [k, v] of Object.entries(rec as Record<string, unknown>)) {
            rowData[headerMap[k] || normalizeHeader(k)] = String(v || "").trim();
          }
          rawRows.push(rowData);
        }
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(file.path);
        sanitizeExcelWorkbook(workbook);
        const sheet = workbook.worksheets[0];
        if (!sheet) return res.status(400).json({ message: "Excel neobsahuje žiadny hárok" });

        const headerRow = sheet.getRow(1);
        const colCount = headerRow.cellCount || sheet.columnCount || 17;
        const rawHeaderValues: string[] = [];
        for (let ci = 1; ci <= Math.max(colCount, 17); ci++) {
          const cell = headerRow.getCell(ci);
          const val = String(cell.value ?? "").trim();
          if (val) {
            const normalized = normalizeHeader(val);
            headers[ci] = normalized;
            rawHeaderValues.push(`${val} → ${normalized}`);
          }
        }

        const recognizedCount = headers.filter(h => h && KNOWN_IMPORT_HEADERS.has(h)).length;
        const totalNonEmpty = headers.filter(Boolean).length;
        const recognitionRatio = totalNonEmpty > 0 ? recognizedCount / totalNonEmpty : 0;
        const firstRowLooksLikeHeader = recognitionRatio >= 0.5;

        console.log(`[IMPORT] Header analýza: ${recognizedCount}/${totalNonEmpty} hlavičiek rozpoznaných (${(recognitionRatio * 100).toFixed(0)}% z detekovaných). Mód: ${firstRowLooksLikeHeader ? "HEADER" : "POZIČNÝ"}`);
        if (rawHeaderValues.length > 0) {
          console.log(`[IMPORT] Mapovanie hlavičiek: ${rawHeaderValues.join(", ")}`);
        }

        let dataStartRow = firstRowLooksLikeHeader ? 2 : 1;

        if (firstRowLooksLikeHeader && sheet.rowCount >= 3) {
          const row2 = sheet.getRow(2);
          const row2A = String(row2.getCell(1).value ?? "").trim();
          const row2B = String(row2.getCell(2).value ?? "").trim();
          const row3 = sheet.getRow(3);
          const row3A = String(row3.getCell(1).value ?? "").trim();
          if ((row2A === "Allianz" && row2B === "PZP Auto") || (row3A === "Generali")) {
            const hasRow5Template = sheet.rowCount >= 5 && String(sheet.getRow(5).getCell(1).value ?? "").trim() === "Uniqa";
            dataStartRow = hasRow5Template ? 6 : 4;
            console.log(`[IMPORT] Detekované vzorové riadky zo šablóny — preskakujem riadky 2 až ${dataStartRow - 1}`);
          }
        }

        if (!firstRowLooksLikeHeader) {
          headers = [];
          for (let ci = 1; ci <= 11; ci++) {
            headers[ci] = `col_${ci}`;
          }
        } else {
          const unrecognized = headers.filter(h => h && !KNOWN_IMPORT_HEADERS.has(h));
          if (unrecognized.length > 0) {
            console.log(`[IMPORT] Nerozpoznané hlavičky (budú zachované ako custom stĺpce): ${unrecognized.join(", ")}`);
          }
        }

        const maxCol = Math.max(...Object.keys(headers).map(Number).filter(n => !isNaN(n)), 0);
        for (let rowNum = dataStartRow; rowNum <= sheet.rowCount; rowNum++) {
          const row = sheet.getRow(rowNum);
          const rowData: Record<string, string> = {};
          let hasData = false;
          for (let colNum = 1; colNum <= maxCol; colNum++) {
            const header = headers[colNum];
            if (header) {
              const cell = row.getCell(colNum);
              const val = String(cell.value ?? "").trim();
              rowData[header] = val;
              if (val) hasData = true;
            }
          }
          if (hasData) rawRows.push(rowData);
        }
      }

      const knownHeaders = new Set(POSITIONAL_COLUMNS);
      const recognizedHeaderCount = headers.filter(h => knownHeaders.has(h)).length;
      const totalHeaderCount = headers.filter(Boolean).length;
      const usePositionalFallback = totalHeaderCount === 0 || (recognizedHeaderCount / totalHeaderCount) < 0.5;

      if (usePositionalFallback && rawRows.length > 0) {
        const remapped: Record<string, string>[] = [];
        for (const row of rawRows) {
          const newRow: Record<string, string> = {};
          const vals = Object.values(row);
          for (let ci = 0; ci < POSITIONAL_COLUMNS.length && ci < vals.length; ci++) {
            newRow[POSITIONAL_COLUMNS[ci]] = vals[ci] || "";
          }
          for (const [k, v] of Object.entries(row)) {
            if (!POSITIONAL_COLUMNS.includes(k)) {
              newRow[k] = v;
            }
          }
          remapped.push(newRow);
        }
        rawRows.length = 0;
        rawRows.push(...remapped);
        console.log("[IMPORT] Pozičné mapovanie použité — menej ako 50% hlavičiek rozpoznaných. Rozpoznané:", recognizedHeaderCount, "z", totalHeaderCount, ". Pôvodné hlavičky:", headers.filter(Boolean).join(", "));
      } else if (rawRows.length > 0) {
        console.log("[IMPORT] Header mód použitý. Rozpoznané hlavičky:", headers.filter(h => h && knownHeaders.has(h)).join(", "));
      }

      if (rawRows.length === 0) {
        return res.status(400).json({ message: "Súbor neobsahuje žiadne dáta na import. Pridajte riadky od riadku 4 (pod vzorové riadky)." });
      }

      const allPartners = await storage.getPartners();
      const allProducts = await storage.getProducts();

      // Preload existing contract/proposal numbers for duplicate detection (lean query)
      const { proposalNumbers: existingProposalNumbers, contractNumbers: existingContractNumbers } = await storage.getContractNumbers(appUser?.activeCompanyId || undefined);

      // Determine UID prefix from active state code (e.g. 421 for SK, 420 for CZ)
      let importUidPrefix = '421';
      if (appUser?.activeStateId) {
        const activeState = await storage.getState(appUser.activeStateId);
        if (activeState?.code && /^\d{2,3}$/.test(activeState.code)) {
          importUidPrefix = activeState.code;
        }
      }
      // Normalize a raw UID from Excel: short numeric values get padded + country prefix applied
      // Output format: "421 000 000 000 001" (groups of 3 separated by space)
      const normalizeImportUid = (raw: string | null): string | null => {
        if (!raw) return null;
        const clean = raw.replace(/[\s\-]/g, '');
        let digits: string | null = null;
        // Already a valid 15-digit UID — use as-is
        if (/^\d{15}$/.test(clean)) digits = clean;
        // Pure numeric but short — pad to 12 digits and prepend country prefix
        else if (/^\d+$/.test(clean) && clean.length <= 12) digits = `${importUidPrefix}${clean.padStart(12, '0')}`;
        if (digits) {
          // Format as groups of 3: "421 000 000 000 001"
          const groups: string[] = [];
          for (let i = 0; i < digits.length; i += 3) groups.push(digits.slice(i, i + 3));
          return groups.join(' ');
        }
        return raw.trim();
      };

      const results: { row: number; status: string; action?: string; contractId?: number; subjectId?: number; warnings?: string[]; error?: string; incompleteFields?: string[]; duplicateNumber?: string }[] = [];
      const batchId = req.body?.batchId || `IMPORT-${Date.now()}`;
      let incompleteCount = 0;
      let duplicateCount = 0;

      for (let i = 0; i < rawRows.length; i++) {
        const rowData = rawRows[i];
        const rowNum = i + 2;

        try {
          const partnerName = rowData["partner"] || rowData["partner_name"] || null;
          const productName = rowData["produkt"] || rowData["product"] || rowData["product_name"] || null;
          const typSubjektu = rowData["typ_subjektu"] || rowData["typ"] || rowData["subject_type"] || null;
          const rcIcoRaw = rowData["rc_ico"] || rowData["rodne_cislo"] || rowData["rc"] || rowData["ico"] || rowData["birth_number"] || null;

          let resolvedPartnerId: number | null = null;
          if (partnerName) {
            const pLower = partnerName.toLowerCase();
            const found = allPartners.find(p => p.name.toLowerCase() === pLower || (p.code && p.code.toLowerCase() === pLower));
            if (found) resolvedPartnerId = found.id;
          }

          let resolvedProductId: number | null = null;
          if (productName) {
            const prLower = productName.toLowerCase();
            const found = allProducts.find(p =>
              (p.name.toLowerCase() === prLower || (p.displayName && p.displayName.toLowerCase() === prLower) || (p.code && p.code.toLowerCase() === prLower)) &&
              (!resolvedPartnerId || p.partnerId === resolvedPartnerId)
            );
            if (found) resolvedProductId = found.id;
          }

          let subjectType: "person" | "szco" | "company" = "person";
          if (typSubjektu) {
            const tLower = typSubjektu.toLowerCase().trim();
            if (["po", "company", "firma", "pravnicka_osoba", "právnická osoba", "právnická", "pravnicka", "p.o.", "p.o"].includes(tLower)) subjectType = "company";
            else if (["szco", "szčo", "živnostník", "zivnostnik", "s.z.č.o.", "s.z.c.o.", "szč.o.", "szc.o."].includes(tLower)) subjectType = "szco";
            else if (["fo", "person", "fyzická osoba", "fyzicka_osoba", "fyzicka osoba", "fyzická", "fyzicka", "f.o.", "f.o", "fyz"].includes(tLower)) subjectType = "person";
          }

          const firstName = capitalizeName(rowData["meno"] || rowData["first_name"] || null);
          const lastName = capitalizeName(rowData["priezvisko"] || rowData["last_name"] || null);
          const companyName = rowData["nazov_firmy"] || rowData["company_name"] || null;
          const titleBefore = normalizeTitleBe(rowData["titul_pred"] || rowData["title_before"] || null);
          const titleAfter = normalizeTitleBe(rowData["titul_za"] || rowData["title_after"] || null);
          const email = rowData["email"] || null;
          const phone = rowData["telefon"] || rowData["phone"] || null;
          const spz = rowData["spz"] || rowData["ecv"] || rowData["licence_plate"] || null;
          const vin = rowData["vin"] || rowData["vin_cislo"] || null;

          const cisloNavrhu = rowData["cislo_navrhu"] || rowData["proposal_number"] || null;
          const cisloZmluvy = rowData["cislo_zmluvy"] || rowData["contract_number"] || null;
          const VALID_CONTRACT_TYPES: Record<string, string> = {
            "nova": "Nova", "nová": "Nova", "nová zmluva": "Nova", "nova zmluva": "Nova", "n": "Nova",
            "prestupova": "Prestupova", "prestupová": "Prestupova", "prestupová zmluva": "Prestupova", "prestupova zmluva": "Prestupova", "p": "Prestupova", "prestup": "Prestupova",
            "zmenova": "Zmenova", "zmenová": "Zmenova", "zmenová zmluva": "Zmenova", "zmenova zmluva": "Zmenova", "z": "Zmenova", "zmena": "Zmenova",
          };
          const rawTypZmluvy = (rowData["typ_zmluvy"] || rowData["contract_type"] || "").trim();
          const normalizedTyp = rawTypZmluvy.toLowerCase().replace(/[\u0300-\u036f]/g, "").normalize ? rawTypZmluvy.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : rawTypZmluvy.toLowerCase();
          const resolvedContractType = VALID_CONTRACT_TYPES[normalizedTyp] || (rawTypZmluvy ? null : null);

          // Duplicate check — skip row if contract/proposal number already exists
          const pnTrim = cisloNavrhu?.trim();
          const cnTrim = cisloZmluvy?.trim();
          const duplicateNumber = (pnTrim && existingProposalNumbers.has(pnTrim)) ? pnTrim : (cnTrim && existingContractNumbers.has(cnTrim)) ? cnTrim : null;
          if (duplicateNumber) {
            duplicateCount++;
            results.push({
              row: rowNum,
              status: "duplicate",
              duplicateNumber,
              rawData: {
                partner: rowData["partner"] || rowData["partner_name"] || null,
                produkt: rowData["produkt"] || rowData["product"] || rowData["product_name"] || null,
                cislo_navrhu: cisloNavrhu,
                cislo_zmluvy: cisloZmluvy,
                typ_subjektu: rowData["typ_subjektu"] || rowData["typ"] || rowData["subject_type"] || null,
                rc_ico: rowData["rc_ico"] || rowData["rodne_cislo"] || rowData["rc"] || rowData["ico"] || rowData["birth_number"] || null,
                meno: rowData["meno"] || rowData["first_name"] || null,
                priezvisko: rowData["priezvisko"] || rowData["last_name"] || null,
              } as any,
            });
            continue;
          }

          const specialistaUid = normalizeImportUid(rowData["specialista"] || rowData["specialist"] || rowData["specialista_uid"] || null);
          const specialistaPodiel = rowData["specialista_podiel"] || rowData["specialist_percentage"] || rowData["specialista_pct"] || rowData["specialista_%"] || null;
          const odporucitelUid = normalizeImportUid(rowData["odporucitel"] || rowData["recommender"] || rowData["odporucitel1_uid"] || null);
          const odporucitelPodiel = rowData["odporucitel_podiel"] || rowData["recommender_percentage"] || rowData["odporucitel1_pct"] || rowData["odporucitel1_%"] || null;
          const odporucitel2Uid = normalizeImportUid(rowData["odporucitel2"] || rowData["odporucitel2_uid"] || null);
          const odporucitel2Podiel = rowData["odporucitel2_podiel"] || rowData["odporucitel2_pct"] || rowData["odporucitel2_%"] || null;

          let rc: string | null = null;
          let ico: string | null = null;
          if (rcIcoRaw) {
            const cleaned = rcIcoRaw.replace(/[\/\s-]/g, "");
            if (subjectType === "company") {
              ico = rcIcoRaw;
            } else if (subjectType === "szco") {
              if (cleaned.length <= 8 && /^\d+$/.test(cleaned)) ico = rcIcoRaw;
              else rc = rcIcoRaw;
            } else {
              rc = rcIcoRaw;
            }
          }

          let rcValidationError: string | null = null;
          if (rc && (subjectType === "person" || subjectType === "szco")) {
            const rcResult = validateSlovakRC(rc);
            if (!rcResult.valid) {
              rcValidationError = rcResult.error || "Neplatné rodné číslo";
            }
          }

          let icoValidationError: string | null = null;
          if (ico && (subjectType === "company" || subjectType === "szco" || subjectType === "organization")) {
            const icoResult = validateSlovakICO(ico);
            if (!icoResult.valid) {
              icoValidationError = icoResult.error || "Neplatné IČO";
            } else if (icoResult.normalized) {
              ico = icoResult.normalized;
            }
          }

          let resolvedSubjectId: number | null = null;
          if (rc || ico) {
            const dupCheck = await storage.checkDuplicateSubject({
              birthNumber: rc || undefined,
              ico: ico || undefined,
            });
            if (dupCheck) {
              resolvedSubjectId = dupCheck.id;
            }
          }

          const missingFields: string[] = [];
          if (!resolvedPartnerId) missingFields.push("Partner");
          if (!resolvedProductId) missingFields.push("Produkt");
          if (!cisloNavrhu && !cisloZmluvy) missingFields.push("Číslo návrhu alebo číslo zmluvy");
          if (!resolvedSubjectId) {
            if (subjectType === "person" || subjectType === "szco") {
              if (!rc) missingFields.push("Rodné číslo");
              if (!firstName) missingFields.push("Meno");
              if (!lastName) missingFields.push("Priezvisko");
            }
            if (subjectType === "company" || subjectType === "szco") {
              if (!ico) missingFields.push("IČO");
              if (!companyName) missingFields.push("Názov firmy");
            }
          }
          if (rcValidationError) {
            missingFields.push(`Neplatné RČ: ${rcValidationError}`);
          }
          if (icoValidationError) {
            missingFields.push(`Neplatné IČO: ${icoValidationError}`);
          }
          if (!resolvedContractType) {
            missingFields.push("Chýba typ zmluvy");
          }
          const isIncomplete = missingFields.length > 0;

          const importedRawData: Record<string, string | null> = {
            subjectType,
            firstName,
            lastName,
            companyName,
            titleBefore,
            titleAfter,
            birthNumber: rc,
            ico,
            email,
            phone,
          };
          if (spz) importedRawData["spz"] = spz;
          if (vin) importedRawData["vin"] = vin;
          if (rcValidationError) importedRawData["rc_validation_error"] = rcValidationError;
          if (icoValidationError) importedRawData["ico_validation_error"] = icoValidationError;
          for (const [k, v] of Object.entries(rowData)) {
            if (v && !importedRawData.hasOwnProperty(k)) {
              importedRawData[k] = v;
            }
          }

          const nextGlobalNumber = await storage.getNextCounterValue("contract_global_number");

          const contractData: any = {
            contractNumber: cisloZmluvy,
            proposalNumber: cisloNavrhu,
            contractType: resolvedContractType || "Nova",
            kik: rowData["kik"] || null,
            subjectId: resolvedSubjectId,
            partnerId: resolvedPartnerId,
            productId: resolvedProductId,
            premiumAmount: rowData["lehotne_poistne"] || rowData["premium"] ? parseInt(rowData["lehotne_poistne"] || rowData["premium"]) : null,
            paymentFrequency: rowData["frekvencia"] || rowData["payment_frequency"] || null,
            currency: rowData["mena"] || rowData["currency"] || "EUR",
            notes: rowData["poznamky"] || rowData["notes"] || null,
            stateId: appUser?.activeStateId || null,
            companyId: appUser?.activeCompanyId || null,
            globalNumber: nextGlobalNumber,
            uploadedByUserId: appUser?.id || null,
            incompleteData: isIncomplete,
            incompleteDataReason: isIncomplete ? `Chýba: ${missingFields.join(", ")}` : null,
            importedAt: new Date(),
            importBatchId: batchId,
            importedRawData,
          };

          const created = await storage.createContract(contractData);

          if (specialistaUid || odporucitelUid) {
            const distributions: { contractId: number; type: string; uid: string; percentage: string; sortOrder: number }[] = [];
            if (specialistaUid) {
              distributions.push({
                contractId: created.id,
                type: "specialist",
                uid: specialistaUid.trim(),
                percentage: specialistaPodiel ? String(parseFloat(specialistaPodiel) || 0) : "0",
                sortOrder: 0,
              });
              if (!odporucitelUid) {
                distributions.push({
                  contractId: created.id,
                  type: "recommender",
                  uid: specialistaUid.trim(),
                  percentage: "0",
                  sortOrder: 1,
                });
              }
            }
            if (odporucitelUid) {
              distributions.push({
                contractId: created.id,
                type: "recommender",
                uid: odporucitelUid.trim(),
                percentage: odporucitelPodiel ? String(parseFloat(odporucitelPodiel) || 0) : "0",
                sortOrder: specialistaUid ? 1 : 0,
              });
            }
            if (odporucitel2Uid) {
              distributions.push({
                contractId: created.id,
                type: "recommender",
                uid: odporucitel2Uid.trim(),
                percentage: odporucitel2Podiel ? String(parseFloat(odporucitel2Podiel) || 0) : "0",
                sortOrder: distributions.length,
              });
            }
            try {
              await storage.saveContractRewardDistributions(created.id, distributions);
            } catch (rewardErr: any) {
              console.error(`[IMPORT] Chyba pri ukladaní odmien pre riadok ${rowNum}:`, rewardErr.message);
            }
          }

          await logAudit(req, {
            action: "BULK_IMPORT_ROW",
            module: "zmluvy",
            entityId: created.id,
            entityName: `Import riadok ${rowNum}: kontrakt #${created.id}`,
            newData: { row: rowNum, contractId: created.id, partnerId: resolvedPartnerId, productId: resolvedProductId, subjectId: resolvedSubjectId, specialistaUid, odporucitelUid, odporucitel2Uid },
          });

          if (isIncomplete) incompleteCount++;

          const hasDistributions = !!(specialistaUid || odporucitelUid);
          results.push({
            row: rowNum,
            status: isIncomplete ? "incomplete" : "ok",
            action: "imported",
            contractId: created.id,
            subjectId: resolvedSubjectId || undefined,
            incompleteFields: isIncomplete ? missingFields : undefined,
            rcCritical: !!rcValidationError,
            rcValidationError: rcValidationError || undefined,
            icoCritical: !!icoValidationError,
            icoValidationError: icoValidationError || undefined,
            hasDistributions,
            rawData: {
              partner: partnerName,
              produkt: productName,
              cislo_navrhu: cisloNavrhu,
              cislo_zmluvy: cisloZmluvy,
              typ_subjektu: typSubjektu,
              rc_ico: rcIcoRaw,
              nazov_firmy: companyName,
              titul_pred: titleBefore,
              meno: firstName,
              priezvisko: lastName,
              titul_za: titleAfter,
              specialista: specialistaUid,
              specialista_podiel: specialistaPodiel,
              odporucitel: odporucitelUid,
              odporucitel_podiel: odporucitelPodiel,
              odporucitel2: odporucitel2Uid,
              odporucitel2_podiel: odporucitel2Podiel,
            },
          });
        } catch (rowErr: any) {
          results.push({ row: rowNum, status: "error", error: rowErr.message || "Neznáma chyba", rawData: rowData });
        }
      }

      const successCount = results.filter(r => r.status === "ok").length;
      const savedIncompleteCount = results.filter(r => r.status === "incomplete").length;
      const errorCount = results.filter(r => r.status === "error").length;

      await logAudit(req, {
        action: "IMPORT",
        module: "zmluvy",
        entityName: `Import ${fileName}: ${successCount} úspešných, ${savedIncompleteCount} neúplných, ${errorCount} chýb, ${duplicateCount} duplicít`,
        newData: { successCount, savedIncompleteCount, errorCount, duplicateCount, total: results.length },
      });

      res.json({
        total: results.length,
        success: successCount,
        errors: errorCount,
        incomplete: incompleteCount,
        duplicates: duplicateCount,
        details: results,
      });
    } catch (err: any) {
      console.error("Excel/CSV import error:", err);
      res.status(500).json({ message: "Chyba pri importe: " + (err.message || "Neznáma chyba") });
    }
  });

  app.put(api.contractsApi.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const criticalFieldJustification = req.body?.criticalFieldJustification;
      const migrationDates = req.body?._migrationDates;
      const bodyWithoutExtras = { ...req.body };
      delete bodyWithoutExtras.criticalFieldJustification;
      delete bodyWithoutExtras._migrationDates;
      const input = api.contractsApi.update.input.parse(bodyWithoutExtras);
      const old = await storage.getContract(Number(req.params.id));
      if (!old) return res.status(404).json({ message: "Contract not found" });
      const appUser = req.appUser;
      if (appUser && appUser.activeStateId && old.stateId && old.stateId !== appUser.activeStateId) {
        return res.status(403).json({ message: "Uprava zmluvy z ineho statu nie je povolena" });
      }
      if (old.isLocked && appUser && appUser.role !== 'admin' && appUser.role !== 'superadmin') {
        return res.status(403).json({ message: "Zmluva je zamknuta v supiske. Iba admin moze upravovat zamknute zmluvy." });
      }
      if (old.globalNumber && input.globalNumber && input.globalNumber !== old.globalNumber) {
        return res.status(400).json({ message: "Globalne poradove cislo zmluvy nie je mozne zmenit" });
      }
      delete input.globalNumber;

      if (input.statusId && input.statusId !== old.statusId) {
        const allStatuses = await storage.getContractStatuses();
        const newStatus = allStatuses.find((s: any) => s.id === input.statusId);
        if (newStatus) {
          const approvalKeywords = ["schválen", "schvalena", "approved", "finalize", "finalizovan"];
          const statusNameLower = (newStatus.name || "").toLowerCase();
          const isApprovalStatus = approvalKeywords.some(kw => statusNameLower.includes(kw));
          if (isApprovalStatus && !isAdmin(appUser)) {
            return res.status(403).json({ message: "Schválenie zmluvy vyžaduje administrátora" });
          }
        }
      }

      const migrationOn = await isMigrationModeOn();
      const updateData: any = { ...input };
      if (migrationOn && migrationDates && appUser?.role === "superadmin") {
        if (migrationDates.receivedByCentralAt !== undefined) updateData.receivedByCentralAt = migrationDates.receivedByCentralAt ? new Date(migrationDates.receivedByCentralAt) : null;
        if (migrationDates.sentToPartnerAt !== undefined) updateData.sentToPartnerAt = migrationDates.sentToPartnerAt ? new Date(migrationDates.sentToPartnerAt) : null;
        if (migrationDates.receivedByPartnerAt !== undefined) updateData.receivedByPartnerAt = migrationDates.receivedByPartnerAt ? new Date(migrationDates.receivedByPartnerAt) : null;
        if (migrationDates.objectionEnteredAt !== undefined) updateData.objectionEnteredAt = migrationDates.objectionEnteredAt ? new Date(migrationDates.objectionEnteredAt) : null;
        if (migrationDates.dispatchedAt !== undefined) updateData.dispatchedAt = migrationDates.dispatchedAt ? new Date(migrationDates.dispatchedAt) : null;
        if (migrationDates.acceptedAt !== undefined) updateData.acceptedAt = migrationDates.acceptedAt ? new Date(migrationDates.acceptedAt) : null;
        if (typeof migrationDates.lifecyclePhase === "number" && migrationDates.lifecyclePhase >= 0 && migrationDates.lifecyclePhase <= 10) {
          updateData.lifecyclePhase = migrationDates.lifecyclePhase;
        }
        const historicalDate = updateData.signedDate
          || updateData.receivedByCentralAt
          || updateData.sentToPartnerAt
          || old.signedDate;
        if (historicalDate) {
          updateData.createdAt = new Date(historicalDate);
          updateData.updatedAt = new Date(historicalDate);
        }
      }

      const updated = await storage.updateContract(Number(req.params.id), updateData);
      if (input.statusId && input.statusId !== old.statusId) {
        await storage.createContractStatusChangeLog({
          contractId: Number(req.params.id),
          oldStatusId: old.statusId,
          newStatusId: input.statusId,
          changedByUserId: appUser?.id || null,
          parameterValues: {},
        });
      }
      const contractId = Number(req.params.id);
      const contractDiffFields = [
        'contractNumber', 'proposalNumber', 'kik', 'subjectId', 'partnerId', 'productId',
        'statusId', 'templateId', 'inventoryId', 'stateId', 'companyId', 'signingPlace',
        'contractType', 'paymentFrequency', 'premiumAmount', 'annualPremium', 'commissionAmount',
        'currency', 'notes', 'klientUid', 'ziskatelUid', 'specialistaUid',
        'zakonnyZastupcaUid', 'konatelUid', 'szcoUid', 'szcoRodneCislo', 'szcoIco',
        'identifierType', 'identifierValue',
      ];
      const contractChanges: Array<{ fieldKey: string; oldValue: string | null; newValue: string | null }> = [];
      for (const field of contractDiffFields) {
        const oldVal = (old as any)[field];
        const newVal = (input as any)[field];
        if (newVal !== undefined && String(oldVal ?? '') !== String(newVal ?? '')) {
          contractChanges.push({
            fieldKey: field,
            oldValue: oldVal != null ? String(oldVal) : null,
            newValue: newVal != null ? String(newVal) : null,
          });
        }
      }

      if (contractChanges.length > 0 && old.subjectId) {
        try {
          const appUser = req.appUser;
          const userName = appUser ? [appUser.firstName, appUser.lastName].filter(Boolean).join(' ') || appUser.username || 'Neznámy' : 'Systém';
          const historyEntries = contractChanges.map(change => ({
            subjectId: old.subjectId!,
            fieldKey: `contract.${change.fieldKey}`,
            fieldSource: 'contract' as const,
            oldValue: change.oldValue,
            newValue: change.newValue,
            changedByUserId: appUser?.id ?? null,
            changedByName: userName,
            changeReason: criticalFieldJustification || null,
            changeContext: `contract_${contractId}`,
          }));
          await db.insert(subjectFieldHistory).values(historyEntries);
        } catch (e) {
          console.error("[CONTRACT FIELD HISTORY] Error:", e);
        }
      }

      const auditNewData = criticalFieldJustification
        ? { ...input, _criticalFieldJustification: criticalFieldJustification }
        : input;
      const auditEntityName = criticalFieldJustification
        ? `Zmena kritických údajov - Odôvodnenie: ${criticalFieldJustification}`
        : undefined;
      await logAudit(req, { action: "UPDATE", module: "zmluvy", entityId: contractId, oldData: old, newData: auditNewData, entityName: auditEntityName });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete(api.contractsApi.delete.path, isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(404).json({ message: "User not found" });
      const contract = await storage.getContract(Number(req.params.id));
      if (!contract) return res.status(404).json({ message: "Contract not found" });
      if (appUser.activeStateId && contract.stateId && contract.stateId !== appUser.activeStateId) {
        return res.status(403).json({ message: "Vymazanie zmluvy z ineho statu nie je povolene" });
      }
      if (contract.lifecyclePhase >= 5) {
        return res.status(403).json({ message: "Zmluvu po prijatí do centrály nie je možné vymazať" });
      }
      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
      await storage.softDeleteContract(Number(req.params.id), appUser.username, typeof ip === 'string' ? ip : '');
      await logAudit(req, { action: "DELETE", module: "zmluvy", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CONTRACT PASSWORDS (ArutsoK 32) ===
  app.get("/api/contracts/:contractId/passwords", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getContractPasswords(Number(req.params.contractId)));
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/contracts/:contractId/passwords", isAuthenticated, async (req: any, res) => {
    try {
      const { password, note } = req.body;
      if (!password) return res.status(400).json({ message: "Heslo je povinne" });
      const created = await storage.createContractPassword({
        contractId: Number(req.params.contractId),
        password,
        note: note || null,
      });
      await logAudit(req, { action: "CREATE", module: "contract_passwords", entityId: created.id, entityName: `Password for contract ${req.params.contractId}` });
      res.json(created);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/contract-passwords/:id", isAuthenticated, async (req: any, res) => {
    try {
      await storage.deleteContractPassword(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "contract_passwords", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CONTRACT PARAMETER VALUES ===
  app.get("/api/contracts/:contractId/parameter-values", isAuthenticated, async (req: any, res) => {
    try {
      const values = await storage.getContractParameterValues(Number(req.params.contractId));
      res.json(values);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/contracts/:contractId/parameter-values", isAuthenticated, async (req: any, res) => {
    try {
      const { values } = req.body;
      if (!Array.isArray(values)) return res.status(400).json({ message: "Values array required" });
      const contractId = Number(req.params.contractId);

      const cisloZmluvyParam = values.find((v: any) => (v.parameterId || v.parameter_id) === 46);
      if (cisloZmluvyParam?.value?.trim()) {
        const existing = await db.select({ contractId: contractParameterValues.contractId })
          .from(contractParameterValues)
          .where(and(
            eq(contractParameterValues.parameterId, 46),
            eq(contractParameterValues.value, cisloZmluvyParam.value.trim()),
            contractId ? sql`${contractParameterValues.contractId} != ${contractId}` : sql`1=1`
          ))
          .limit(1);
        if (existing.length > 0) {
          return res.status(409).json({ message: `Číslo zmluvy "${cisloZmluvyParam.value}" už existuje na inej zmluve (ID: ${existing[0].contractId})` });
        }
      }

      const userId = req.user?.appUserId || null;
      const userName = req.user?.displayName || req.user?.firstName || null;
      await storage.saveContractParameterValues(contractId, values, userId, userName);

      try {
        const contract = await storage.getContract(contractId);
        if (contract?.subjectId) {
          const allPanelParams = await db.select().from(panelParameters).where(isNotNull(panelParameters.targetCategoryCode));
          const mappings = new Map<number, string>();
          for (const pp of allPanelParams) {
            if (pp.targetCategoryCode) mappings.set(pp.parameterId, pp.targetCategoryCode);
          }
          
          const dynUpdates: Record<string, string> = {};
          for (const v of values) {
            const paramId = v.parameterId || v.parameter_id;
            const val = v.value;
            if (paramId && val && mappings.has(Number(paramId))) {
              const targetField = mappings.get(Number(paramId))!;
              dynUpdates[targetField] = val;
            }
          }
          
          if (Object.keys(dynUpdates).length > 0) {
            const subject = await storage.getSubject(contract.subjectId);
            if (subject) {
              const existingDetails = (subject.details || {}) as Record<string, any>;
              const existingDynamic = existingDetails.dynamicFields || {};
              await storage.updateSubject(contract.subjectId, {
                details: {
                  ...existingDetails,
                  dynamicFields: { ...existingDynamic, ...dynUpdates },
                },
                changeReason: "Automatická aktualizácia z parametrov zmluvy",
              });
            }
          }
        }
      } catch (mapErr) {
        console.error("Parameter → Category mapping error:", mapErr);
      }

      try {
        const contractForSync = await storage.getContract(contractId);
        if (contractForSync?.subjectId) {
          await storage.syncObjectFromContract(contractId, contractForSync.subjectId);
        }
      } catch (syncErr) {
        console.error("Object sync error:", syncErr);
      }
      
      await logAudit(req, { action: "UPDATE", module: "contract_parameter_values", entityId: contractId, entityName: "parameter values saved" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CONTRACT PARAMETER VALUE HISTORY ===
  app.get("/api/contracts/:contractId/parameter-value-history", isAuthenticated, async (req: any, res) => {
    try {
      const contractId = Number(req.params.contractId);
      const parameterId = req.query.parameterId ? Number(req.query.parameterId) : undefined;
      const history = await storage.getContractParameterValueHistory(contractId, parameterId);
      res.json(history);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CONTRACT REWARD DISTRIBUTIONS ===
  app.get("/api/contracts/:contractId/reward-distributions", isAuthenticated, async (req: any, res) => {
    try {
      res.json(await storage.getContractRewardDistributions(Number(req.params.contractId)));
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/contracts/:contractId/reward-distributions", isAuthenticated, async (req: any, res) => {
    try {
      const { distributions } = req.body;
      if (!Array.isArray(distributions)) return res.status(400).json({ message: "Distributions array required" });
      const totalPct = distributions.reduce((sum: number, d: any) => sum + (parseFloat(d.percentage) || 0), 0);
      if (totalPct > 100) return res.status(400).json({ message: "Celkovy sucet nesmie presiahnuť 100 %" });
      const saved = await storage.saveContractRewardDistributions(Number(req.params.contractId), distributions);
      await logAudit(req, { action: "UPDATE", module: "contract_reward_distributions", entityId: Number(req.params.contractId), entityName: "reward distributions saved" });
      res.json(saved);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/client-types/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ message: "Items array required" });
      for (const item of items) {
        await storage.updateClientType(item.id, { sortOrder: item.sortOrder });
      }
      await logAudit(req, { action: "UPDATE", module: "pravidla_typov", entityName: "reorder" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === SUPISKY (Settlement Sheets) ===
  app.get("/api/supisky", isAuthenticated, async (req: any, res) => {
    try {
      const enforcedState = getEnforcedStateId(req);
      const filters: any = {};
      if (enforcedState) filters.stateId = enforcedState;
      if (req.query.companyId) filters.companyId = Number(req.query.companyId);
      const items = await storage.getSupisky(filters);
      res.json(items);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/supisky/:id", isAuthenticated, async (req: any, res) => {
    try {
      const item = await storage.getSupiska(Number(req.params.id));
      if (!item) return res.status(404).json({ message: "Supiska not found" });
      res.json(item);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/supisky", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const enforcedState = getEnforcedStateId(req);
      const supId = await storage.generateSupiskaId();
      const data = {
        ...req.body,
        supId,
        stateId: enforcedState || req.body.stateId,
        companyId: appUser?.activeCompanyId || req.body.companyId,
        createdBy: appUser?.username || "system",
        createdByUserId: appUser?.id,
      };
      const item = await storage.createSupiska(data);
      await logAudit(req, { action: "CREATE", module: "supisky", entityId: item.id, entityName: item.name });
      res.json(item);
    } catch (err: any) {
      console.error("Supisky create error:", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.put("/api/supisky/:id", isAuthenticated, async (req: any, res) => {
    try {
      const old = await storage.getSupiska(Number(req.params.id));
      if (!old) return res.status(404).json({ message: "Supiska not found" });
      const appUser = req.appUser;
      const input = req.body;

      const allowedTransitions: Record<string, string[]> = {
        "Nova": ["Pripravena", "Odoslana"],
        "Pripravena": ["Nova", "Odoslana"],
        "Odoslana": ["Pripravena"],
      };
      if (input.status && input.status !== old.status) {
        const allowed = allowedTransitions[old.status] || [];
        if (!allowed.includes(input.status)) {
          return res.status(400).json({ message: `Neplatny prechod stavu z ${old.status} na ${input.status}` });
        }
      }

      if (input.status === "Odoslana" && old.status !== "Odoslana") {
        await storage.lockContractsBySupiska(old.id, appUser?.username || "system");
        input.sentAt = new Date();
        input.sentBy = appUser?.username || "system";
      }
      if (old.status === "Odoslana" && input.status && input.status !== "Odoslana") {
        await storage.unlockContractsBySupiska(old.id);
        input.sentAt = null;
        input.sentBy = null;
      }

      const updated = await storage.updateSupiska(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "supisky", entityId: updated.id, oldData: old, newData: input });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/supisky/:id", isAuthenticated, async (req: any, res) => {
    try {
      const old = await storage.getSupiska(Number(req.params.id));
      if (!old) return res.status(404).json({ message: "Supiska not found" });
      if (old.status === "Odoslana") {
        await storage.unlockContractsBySupiska(old.id);
      }
      await storage.deleteSupiska(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "supisky", entityId: Number(req.params.id), entityName: old.name });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/supisky/:id/contracts", isAuthenticated, async (req: any, res) => {
    try {
      const links = await storage.getSupiskaContracts(Number(req.params.id));
      const contractIds = links.map(l => l.contractId);
      if (contractIds.length === 0) return res.json([]);
      const allContracts = await storage.getContracts();
      const enriched = allContracts.filter(c => contractIds.includes(c.id));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/supisky/:id/contracts", isAuthenticated, async (req: any, res) => {
    try {
      const supiskaId = Number(req.params.id);
      const supiska = await storage.getSupiska(supiskaId);
      if (!supiska) return res.status(404).json({ message: "Supiska not found" });
      if (supiska.status === "Odoslana") return res.status(400).json({ message: "Supiska je odoslana, nelze pridavat zmluvy" });
      const { contractIds } = req.body;
      if (!Array.isArray(contractIds)) return res.status(400).json({ message: "contractIds array required" });

      // ArutsoK 41 - Supiska validation: max 25 contracts, same productId
      const existingLinks = await storage.getSupiskaContracts(supiskaId);
      const totalAfter = existingLinks.length + contractIds.length;
      if (totalAfter > 25) {
        return res.status(400).json({ message: `Supiska moze obsahovat maximalne 25 zmluv. Aktualne: ${existingLinks.length}, pridavate: ${contractIds.length}.` });
      }

      const allContracts = await storage.getContracts();
      const contractMap = new Map(allContracts.map(c => [c.id, c]));
      const existingContractIds = existingLinks.map(l => l.contractId);
      const allRelevantIds = [...existingContractIds, ...contractIds];
      const productIds = new Set<number>();
      for (const cId of allRelevantIds) {
        const contract = contractMap.get(cId);
        if (contract?.sectorProductId) productIds.add(contract.sectorProductId);
      }
      if (productIds.size > 1) {
        return res.status(400).json({ message: "Vsetky zmluvy v supiske musia mat rovnaky produkt." });
      }

      const added = await storage.addContractsToSupiska(supiskaId, contractIds);
      await logAudit(req, { action: "UPDATE", module: "supisky", entityId: supiskaId, entityName: `Added ${added} contracts` });
      res.json({ added });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/supisky/:id/contracts/:contractId", isAuthenticated, async (req: any, res) => {
    try {
      const supiska = await storage.getSupiska(Number(req.params.id));
      if (!supiska) return res.status(404).json({ message: "Supiska not found" });
      if (supiska.status === "Odoslana") return res.status(400).json({ message: "Supiska je odoslana, nelze odoberať zmluvy" });
      await storage.removeContractFromSupiska(Number(req.params.id), Number(req.params.contractId));
      await logAudit(req, { action: "UPDATE", module: "supisky", entityId: Number(req.params.id), entityName: `Removed contract ${req.params.contractId}` });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/supisky/:id/eligible-contracts", isAuthenticated, async (req: any, res) => {
    try {
      const enforcedState = getEnforcedStateId(req);
      const allContracts = await storage.getContracts();
      const statuses = await storage.getContractStatuses();
      const signedStatus = statuses.find(s => s.name === "Podpísaná" || s.name === "Podpisana");
      if (!signedStatus) return res.json([]);
      const eligible = allContracts.filter(c =>
        c.statusId === signedStatus.id &&
        !c.isDeleted &&
        !c.isLocked &&
        (!enforcedState || c.stateId === enforcedState)
      );
      res.json(eligible);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/supisky/:id/export/excel", isAuthenticated, async (req: any, res) => {
    try {
      const supiska = await storage.getSupiska(Number(req.params.id));
      if (!supiska) return res.status(404).json({ message: "Supiska not found" });
      const links = await storage.getSupiskaContracts(supiska.id);
      const contractIds = links.map(l => l.contractId);
      const allContracts = await storage.getContracts();
      const contractList = allContracts.filter(c => contractIds.includes(c.id));

      await logAudit(req, { action: "EXPORT", module: "supisky", entityId: supiska.id, newData: { count: contractList.length, exportedIds: contractIds } });
      const subjects = await storage.getSubjects();
      const partnersData = await storage.getPartners();
      const productsData = await storage.getProducts();

      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Supiska");
      sheet.columns = [
        { header: "Cislo kontraktu", key: "globalNumber", width: 18 },
        { header: "Meno klienta", key: "clientName", width: 25 },
        { header: "Partner", key: "partner", width: 25 },
        { header: "Produkt", key: "product", width: 25 },
        { header: "Cislo zmluvy", key: "contractNumber", width: 20 },
        { header: "Suma poistneho", key: "premiumAmount", width: 18 },
        { header: "Datum podpisu", key: "signatureDate", width: 18 },
      ];
      sheet.getRow(1).font = { bold: true };

      for (const c of contractList) {
        const subject = subjects.find(s => s.id === c.subjectId);
        const partner = partnersData.find(p => p.id === c.partnerId);
        const product = productsData.find(p => p.id === c.productId);
        sheet.addRow({
          globalNumber: (c as any).globalNumber || c.id.toString(),
          clientName: subject ? `${subject.firstName || ""} ${subject.lastName || ""}`.trim() : "",
          partner: partner?.name || "",
          product: product?.name || "",
          contractNumber: (c as any).contractNumber || (c as any).uid || "",
          premiumAmount: (c as any).premiumAmount || (c as any).amount || "",
          signatureDate: (c as any).signedDate ? new Date((c as any).signedDate).toLocaleDateString("sk-SK") : "",
        });
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${supiska.supId}.xlsx"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      console.error("Excel export error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/supisky/:id/export/csv", isAuthenticated, async (req: any, res) => {
    try {
      const supiska = await storage.getSupiska(Number(req.params.id));
      if (!supiska) return res.status(404).json({ message: "Supiska not found" });
      const links = await storage.getSupiskaContracts(supiska.id);
      const contractIds = links.map(l => l.contractId);
      const allContracts = await storage.getContracts();
      const contractList = allContracts.filter(c => contractIds.includes(c.id));

      await logAudit(req, { action: "EXPORT", module: "supisky-csv", entityId: supiska.id, newData: { count: contractList.length, exportedIds: contractIds } });

      const subjects = await storage.getSubjects();
      const partnersData = await storage.getPartners();
      const productsData = await storage.getProducts();

      const headers = ["Cislo kontraktu", "Meno klienta", "Partner", "Produkt", "Cislo zmluvy", "Suma poistneho", "Datum podpisu"];
      const rows = contractList.map(c => {
        const subject = subjects.find(s => s.id === c.subjectId);
        const partner = partnersData.find(p => p.id === c.partnerId);
        const product = productsData.find(p => p.id === c.productId);
        return [
          (c as any).globalNumber?.toString() || c.id.toString(),
          subject ? `${subject.firstName || ""} ${subject.lastName || ""}`.trim() : "",
          partner?.name || "",
          product?.name || "",
          (c as any).contractNumber || (c as any).uid || "",
          (c as any).premiumAmount || (c as any).amount || "",
          (c as any).signedDate ? new Date((c as any).signedDate).toLocaleDateString("sk-SK") : "",
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${supiska.supId}.csv"`);
      res.send("\uFEFF" + csv);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CLIENT GROUPS ===
  app.get(api.clientGroupsApi.list.path, isAuthenticated, async (req: any, res) => {
    const groups = await storage.getClientGroups(getEnforcedStateId(req));
    const result = await Promise.all(groups.map(async (g) => ({
      ...g,
      memberCount: await storage.getClientGroupMemberCount(g.id),
    })));
    res.json(result);
  });

  app.get("/api/client-groups/:id", isAuthenticated, async (req: any, res) => {
    const group = await storage.getClientGroup(Number(req.params.id));
    if (!group) return res.status(404).json({ message: "Skupina nenajdena" });
    const enforcedState = getEnforcedStateId(req);
    if (enforcedState && group.stateId !== null && group.stateId !== enforcedState) {
      return res.status(403).json({ message: "Pristup zamietnuty" });
    }
    res.json(group);
  });

  app.post(api.clientGroupsApi.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.clientGroupsApi.create.input.parse(req.body);
      const created = await storage.createClientGroup(input);
      await logAudit(req, { action: "CREATE", module: "skupiny_klientov", entityId: created.id, entityName: created.name, newData: input });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/client-groups/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const { items } = req.body;
      const enforcedState = getEnforcedStateId(req);
      if (enforcedState && items && items.length > 0) {
        for (const item of items) {
          const group = await storage.getClientGroup(item.id);
          if (!group || (group.stateId !== null && group.stateId !== enforcedState)) {
            return res.status(403).json({ message: "Pristup zamietnuty" });
          }
        }
      }
      await storage.reorderClientGroups(items);
      await logAudit(req, { action: "UPDATE", module: "skupiny_klientov", entityName: "reorder" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/client-groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const existing = await storage.getClientGroup(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Skupina nenajdena" });
      const enforcedState = getEnforcedStateId(req);
      if (enforcedState && existing.stateId !== null && existing.stateId !== enforcedState) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const input = api.clientGroupsApi.update.input.parse(req.body);
      const updated = await storage.updateClientGroup(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "skupiny_klientov", entityId: Number(req.params.id), entityName: updated.name, newData: input });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/client-groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const existing = await storage.getClientGroup(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Skupina nenajdena" });
      if ((existing as any).isSystem) {
        return res.status(403).json({ message: "Systémovú skupinu nie je možné zmazať" });
      }
      const enforcedState = getEnforcedStateId(req);
      if (enforcedState && existing.stateId !== null && existing.stateId !== enforcedState) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const members = await storage.getClientGroupMembers(Number(req.params.id));
      if (members.length > 0) {
        return res.status(400).json({ message: `Skupinu nie je mozne vymazat, obsahuje ${members.length} clenov` });
      }
      await storage.deleteClientGroup(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "skupiny_klientov", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CLIENT SUB-GROUPS ===
  app.get("/api/client-groups/:groupId/sub-groups", isAuthenticated, async (req: any, res) => {
    const group = await storage.getClientGroup(Number(req.params.groupId));
    if (!group) return res.status(404).json({ message: "Skupina nenajdena" });
    const enforcedState = getEnforcedStateId(req);
    if (enforcedState && group.stateId !== null && group.stateId !== enforcedState) {
      return res.status(403).json({ message: "Pristup zamietnuty" });
    }
    const subGroups = await storage.getClientSubGroups(Number(req.params.groupId));
    const result = await Promise.all(subGroups.map(async (sg) => ({
      ...sg,
      memberCount: await storage.getClientSubGroupMemberCount(sg.id),
    })));
    res.json(result);
  });

  app.post("/api/client-groups/:groupId/sub-groups", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getClientGroup(Number(req.params.groupId));
      if (!group) return res.status(404).json({ message: "Skupina nenajdena" });
      const enforcedState = getEnforcedStateId(req);
      if (enforcedState && group.stateId !== null && group.stateId !== enforcedState) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const data = { ...req.body, groupId: Number(req.params.groupId) };
      const created = await storage.createClientSubGroup(data);
      await logAudit(req, { action: "CREATE", module: "podskupiny_klientov", entityId: created.id, entityName: created.name });
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/client-sub-groups/:id", isAuthenticated, async (req: any, res) => {
    try {
      const subGroup = await db.select().from(clientSubGroups).where(eq(clientSubGroups.id, Number(req.params.id))).then(r => r[0]);
      if (!subGroup) return res.status(404).json({ message: "Podskupina nenajdena" });
      const group = await storage.getClientGroup(subGroup.groupId);
      if (!group) return res.status(404).json({ message: "Skupina nenajdena" });
      const enforcedState = getEnforcedStateId(req);
      if (enforcedState && group.stateId !== null && group.stateId !== enforcedState) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      await storage.deleteClientSubGroup(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "podskupiny_klientov", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/client-sub-groups/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const { items } = req.body;
      const enforcedState = getEnforcedStateId(req);
      if (enforcedState && items && items.length > 0) {
        for (const item of items) {
          const sg = await db.select().from(clientSubGroups).where(eq(clientSubGroups.id, item.id)).then(r => r[0]);
          if (!sg) return res.status(404).json({ message: "Podskupina nenajdena" });
          const group = await storage.getClientGroup(sg.groupId);
          if (!group || (group.stateId !== null && group.stateId !== enforcedState)) {
            return res.status(403).json({ message: "Pristup zamietnuty" });
          }
        }
      }
      await storage.reorderClientSubGroups(items);
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CLIENT GROUP MEMBERS ===
  app.get("/api/client-groups/:groupId/members", isAuthenticated, async (req: any, res) => {
    const group = await storage.getClientGroup(Number(req.params.groupId));
    if (!group) return res.status(404).json({ message: "Skupina nenajdena" });
    const enforcedState = getEnforcedStateId(req);
    if (enforcedState && group.stateId !== null && group.stateId !== enforcedState) {
      return res.status(403).json({ message: "Pristup zamietnuty" });
    }
    const members = await storage.getClientGroupMembers(Number(req.params.groupId));
    res.json(members);
  });

  app.post("/api/client-groups/:groupId/members", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getClientGroup(Number(req.params.groupId));
      if (!group) return res.status(404).json({ message: "Skupina nenajdena" });
      const enforcedState = getEnforcedStateId(req);
      if (enforcedState && group.stateId !== null && group.stateId !== enforcedState) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }

      const isBlacklist = group.groupCode === "group_cierny_zoznam";
      if (isBlacklist && (!req.body.reason || !req.body.reason.trim())) {
        return res.status(400).json({ message: "Dôvod zaradenia na čierny zoznam je povinný" });
      }

      const data = { ...req.body, groupId: Number(req.params.groupId) };
      delete data.reason;
      const created = await storage.addClientGroupMember(data);
      await logAudit(req, { action: "CREATE", module: "clenovia_skupiny", entityId: created.id });

      if (isBlacklist) {
        const subjectId = req.body.subjectId;
        const subject = await storage.getSubject(subjectId);
        const details = subject?.details as any;
        const titleBefore = subject?.titleBefore || details?.dynamicFields?.titul_pred || "";
        const titleAfter = subject?.titleAfter || details?.dynamicFields?.titul_za || "";
        const fullName = subject?.type === "person"
          ? `${titleBefore ? titleBefore + " " : ""}${subject?.firstName || ""} ${subject?.lastName || ""}${titleAfter ? ", " + titleAfter : ""}`
          : subject?.companyName || "";
        const formattedUid = subject?.uid ? subject.uid.replace(/(\d{3})(?=\d)/g, "$1 ") : "";
        const confirmedAt = new Date();
        const confirmedAtStr = formatDateTimeSK(confirmedAt);
        const appUser = req.appUser;
        const addedByName = appUser?.fullName || appUser?.username || "Systém";
        const reason = req.body.reason.trim();

        await logAudit(req, {
          action: "BLACKLIST",
          module: "cierny_zoznam",
          entityId: subjectId,
          entityName: `Zaradenie na Čierny zoznam: ${fullName} (UID: ${formattedUid})`,
          oldData: null,
          newData: { subjectId, subjectUid: formattedUid, subjectName: fullName, reason, addedByUserId: appUser?.id, addedByUsername: addedByName, addedAt: confirmedAt.toISOString() },
        });

        const subjectContracts = await db.select().from(contracts)
          .where(and(eq(contracts.subjectId, subjectId), isNull(contracts.deletedAt)));
        const acquirerUserIds = new Set<number>();
        for (const c of subjectContracts) {
          const acqs = await storage.getContractAcquirers(c.id);
          for (const a of acqs) acquirerUserIds.add(a.userId);
          if (c.ziskatelUid) {
            const [user] = await db.select().from(appUsers).where(eq(appUsers.uid, c.ziskatelUid));
            if (user) acquirerUserIds.add(user.id);
          }
        }

        for (const userId of acquirerUserIds) {
          await db.insert(notificationQueue).values({
            recipientUserId: userId,
            notificationType: "black_list_confirmed",
            title: "Subjekt presunutý na ČIERNY zoznam",
            message: JSON.stringify({
              subjectId,
              subjectUid: formattedUid,
              subjectName: fullName,
              confirmedAt: confirmedAtStr,
              reason: `${reason} — Spoločnosť s daným subjektom už neuzavrie žiadnu zmluvu.`,
              addedBy: addedByName,
            }),
            priority: "high",
            status: "sent",
          });
        }
      }

      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/client-group-members/:id", isAuthenticated, async (req: any, res) => {
    try {
      const member = await db.select().from(clientGroupMembers).where(eq(clientGroupMembers.id, Number(req.params.id))).then(r => r[0]);
      if (!member) return res.status(404).json({ message: "Clen nenajdeny" });
      const group = await storage.getClientGroup(member.groupId);
      if (!group) return res.status(404).json({ message: "Skupina nenajdena" });
      const enforcedState = getEnforcedStateId(req);
      if (enforcedState && group.stateId !== null && group.stateId !== enforcedState) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      await storage.removeClientGroupMember(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "clenovia_skupiny", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === BULK GROUP ASSIGNMENT ===
  app.post("/api/client-groups/:groupId/bulk-assign", isAuthenticated, async (req: any, res) => {
    try {
      const group = await storage.getClientGroup(Number(req.params.groupId));
      if (!group) return res.status(404).json({ message: "Skupina nenajdena" });
      const enforcedState = getEnforcedStateId(req);
      if (enforcedState && group.stateId !== null && group.stateId !== enforcedState) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const isBlacklist = group.groupCode === "group_cierny_zoznam";
      if (isBlacklist && (!req.body.reason || !req.body.reason.trim())) {
        return res.status(400).json({ message: "Dôvod zaradenia na čierny zoznam je povinný" });
      }
      const { subjectIds } = req.body;
      if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
        return res.status(400).json({ message: "Ziadni klienti na priradenie" });
      }
      const added = await storage.bulkAddClientGroupMembers(Number(req.params.groupId), subjectIds);
      await logAudit(req, { action: "CREATE", module: "clenovia_skupiny", entityName: `Hromadne priradenie ${added} klientov` });

      if (isBlacklist) {
        const appUser = req.appUser;
        const addedByName = appUser?.fullName || appUser?.username || "Systém";
        const reason = req.body.reason.trim();
        const confirmedAt = new Date();
        const confirmedAtStr = formatDateTimeSK(confirmedAt);

        for (const subjectId of subjectIds) {
          const subject = await storage.getSubject(subjectId);
          if (!subject) continue;
          const details = subject?.details as any;
          const titleBefore = subject?.titleBefore || details?.dynamicFields?.titul_pred || "";
          const titleAfter = subject?.titleAfter || details?.dynamicFields?.titul_za || "";
          const fullName = subject?.type === "person"
            ? `${titleBefore ? titleBefore + " " : ""}${subject?.firstName || ""} ${subject?.lastName || ""}${titleAfter ? ", " + titleAfter : ""}`
            : subject?.companyName || "";
          const formattedUid = subject?.uid ? subject.uid.replace(/(\d{3})(?=\d)/g, "$1 ") : "";

          await logAudit(req, {
            action: "BLACKLIST",
            module: "cierny_zoznam",
            entityId: subjectId,
            entityName: `Zaradenie na Čierny zoznam: ${fullName} (UID: ${formattedUid})`,
            oldData: null,
            newData: { subjectId, subjectUid: formattedUid, subjectName: fullName, reason, addedByUserId: appUser?.id, addedByUsername: addedByName, addedAt: confirmedAt.toISOString() },
          });

          const subjectContracts = await db.select().from(contracts)
            .where(and(eq(contracts.subjectId, subjectId), isNull(contracts.deletedAt)));
          const acquirerUserIds = new Set<number>();
          for (const c of subjectContracts) {
            const acqs = await storage.getContractAcquirers(c.id);
            for (const a of acqs) acquirerUserIds.add(a.userId);
            if (c.ziskatelUid) {
              const [user] = await db.select().from(appUsers).where(eq(appUsers.uid, c.ziskatelUid));
              if (user) acquirerUserIds.add(user.id);
            }
          }

          for (const userId of acquirerUserIds) {
            await db.insert(notificationQueue).values({
              recipientUserId: userId,
              notificationType: "black_list_confirmed",
              title: "Subjekt presunutý na ČIERNY zoznam",
              message: JSON.stringify({
                subjectId,
                subjectUid: formattedUid,
                subjectName: fullName,
                confirmedAt: confirmedAtStr,
                reason: `${reason} — Spoločnosť s daným subjektom už neuzavrie žiadnu zmluvu.`,
                addedBy: addedByName,
              }),
              priority: "high",
              status: "sent",
            });
          }
        }
      }

      res.json({ success: true, added });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === USER CLIENT GROUP MEMBERSHIPS ===
  app.get("/api/users/:userId/client-groups", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const targetId = Number(req.params.userId);
      if (!appUser || (appUser.id !== targetId && !['admin', 'superadmin'].includes(appUser.role))) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const memberships = await storage.getUserClientGroupMemberships(targetId);
      res.json(memberships);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/users/:userId/client-groups", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !['admin', 'superadmin'].includes(appUser.role)) {
        return res.status(403).json({ message: "Pristup zamietnuty - iba admin moze menit skupiny" });
      }
      const { groupIds } = req.body;
      if (!Array.isArray(groupIds)) return res.status(400).json({ message: "groupIds must be an array" });
      await storage.setUserClientGroupMemberships(Number(req.params.userId), groupIds);
      await logAudit(req, { action: "UPDATE", module: "user_client_groups", entityId: Number(req.params.userId), entityName: `Skupiny: ${groupIds.join(",")}` });
      const memberships = await storage.getUserClientGroupMemberships(Number(req.params.userId));
      res.json(memberships);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/users/:userId/effective-level", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const targetId = Number(req.params.userId);
      if (!appUser || (appUser.id !== targetId && !['admin', 'superadmin'].includes(appUser.role))) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const level = await storage.getUserEffectivePermissionLevel(targetId);
      res.json({ level });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/my-effective-level", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.json({ level: 1 });
      const level = await storage.getUserEffectivePermissionLevel(appUser.id);
      res.json({ level });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === SUBJECT FINANCE UPDATE ===
  app.put("/api/subjects/:id/finance", isAuthenticated, async (req: any, res) => {
    try {
      const subject = await storage.getSubject(Number(req.params.id));
      if (!subject) return res.status(404).json({ message: "Subjekt nenajdeny" });
      const { kikId, iban, swift, commissionLevel } = req.body;
      const updated = await storage.updateSubject(Number(req.params.id), { kikId, iban, swift, commissionLevel });
      await logAudit(req, { action: "UPDATE", module: "subjekty", entityId: subject.id, entityName: `Financie: ${subject.firstName || ''} ${subject.lastName || ''}` });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === SEARCH SUBJECTS (for member search) ===
  app.get("/api/subjects/search", isAuthenticated, async (req: any, res) => {
    try {
      const q = (req.query.q as string || "").toLowerCase();
      if (!q || q.length < 2) return res.json([]);
      const qStripped = stripBallast(q);
      const enforcedState = getEnforcedStateId(req);
      const allSubjects = await storage.getSubjects();
      const filtered = allSubjects
        .filter(s => {
          if (enforcedState && s.stateId !== enforcedState) return false;
          const fullName = `${s.firstName || ""} ${s.lastName || ""} ${s.companyName || ""} ${s.uid || ""}`.toLowerCase();
          if (fullName.includes(q)) return true;
          if (s.phone && stripBallast(s.phone.toLowerCase()).includes(qStripped)) return true;
          if (s.iban && stripBallast(s.iban.toLowerCase()).includes(qStripped)) return true;
          if (s.ico && stripBallast(s.ico.toLowerCase()).includes(qStripped)) return true;
          if (s.email && s.email.toLowerCase().includes(q)) return true;
          return false;
        })
        .slice(0, 20);
      res.json(filtered);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/uid-prefix", isAuthenticated, async (_req, res) => {
    try {
      const prefix = await storage.getDynamicUIDPrefix();
      res.json({ prefix });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/subjects/by-uid/:uid", isAuthenticated, async (req, res) => {
    try {
      const { uid } = req.params;
      const subject = await storage.getSubjectByUid(uid);
      if (!subject) {
        return res.status(404).json({ message: "Subject not found" });
      }
      const details = (subject as any).details || {};
      const nameParts = [
        details.titul_pred || details.titleBefore || '',
        details.meno || subject.firstName || '',
        details.priezvisko || subject.lastName || '',
        details.titul_za || details.titleAfter || '',
      ].filter(Boolean);
      const displayName = nameParts.join(' ') || subject.companyName || 'Neznámy subjekt';
      res.json({ id: subject.id, uid: subject.uid, displayName, type: subject.type });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/lookup/ico/:ico", isAuthenticated, async (req, res) => {
    try {
      const { ico } = req.params;
      const type = (req.query.type as string) || undefined;
      const subjectIdParam = req.query.subjectId ? Number(req.query.subjectId) : null;
      const { lookupByIco } = await import("./sk-registry-lookup");
      const result = await lookupByIco(ico, type);
      if (!result.valid) {
        return res.status(400).json({ valid: false, error: result.message });
      }
      if (result.found && result.source && subjectIdParam) {
        try {
          const [snapSubject] = await db.select().from(subjects).where(eq(subjects.id, subjectIdParam));
          const snapAppUser = (req as any).appUser;
          if (snapSubject && (isAdmin(snapAppUser) || await isSubjectAccessible(snapAppUser, snapSubject))) {
            await storage.createRegistrySnapshot({
              subjectId: subjectIdParam,
              source: result.source,
              ico: result.normalized || ico,
              rawData: result as any,
              parsedFields: {
                name: result.name,
                street: result.street,
                streetNumber: result.streetNumber,
                zip: result.zip,
                city: result.city,
                legalForm: result.legalForm,
                dic: result.dic,
                directors: result.directors,
              },
              fetchedByUserId: snapAppUser?.id || null,
            });
          }
        } catch (snapErr) {
          console.error("[REGISTRY SNAPSHOT] Auto-save error:", snapErr);
        }
      }
      res.json(result);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/subjects/:id/registry-snapshots", isAuthenticated, async (req, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!subjectId) return res.status(400).json({ message: "Neplatné ID subjektu" });
      const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
      if (!subject) return res.status(404).json({ message: "Subjekt nenájdený" });
      const appUser = (req as any).appUser;
      if (!isAdmin(appUser) && !(await isSubjectAccessible(appUser, subject))) {
        return res.status(403).json({ message: "Nemáte oprávnenie" });
      }
      const snapshots = await storage.getRegistrySnapshots(subjectId);
      res.json(snapshots);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/subjects/:id/registry-snapshots", isAuthenticated, async (req, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!subjectId) return res.status(400).json({ message: "Neplatné ID subjektu" });
      const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
      if (!subject) return res.status(404).json({ message: "Subjekt nenájdený" });
      const appUser = (req as any).appUser;
      if (!isAdmin(appUser) && !(await isSubjectAccessible(appUser, subject))) {
        return res.status(403).json({ message: "Nemáte oprávnenie" });
      }
      const { source, ico, rawData, parsedFields } = req.body;
      if (!source || !ico) return res.status(400).json({ message: "Chýba source alebo ico" });
      const snapshot = await storage.createRegistrySnapshot({
        subjectId,
        source,
        ico,
        rawData: rawData || null,
        parsedFields: parsedFields || null,
        fetchedByUserId: appUser?.id || null,
      });
      await logAudit(req, {
        action: "CREATE",
        module: "registry_snapshots",
        entityId: subjectId,
        entityName: `Snapshot z ${source}`,
        newData: { source, ico, snapshotId: snapshot.id },
      });
      res.json(snapshot);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/subjects/:id/registry-snapshots/refresh", isAuthenticated, async (req, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!subjectId) return res.status(400).json({ message: "Neplatné ID subjektu" });
      const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
      if (!subject) return res.status(404).json({ message: "Subjekt nenájdený" });
      const appUser = (req as any).appUser;
      if (!isAdmin(appUser) && !(await isSubjectAccessible(appUser, subject))) {
        return res.status(403).json({ message: "Nemáte oprávnenie" });
      }
      const details = (subject.details as any) || {};
      const dyn = details.dynamicFields || details;
      const ico = dyn.ico || dyn.p_ico || null;
      if (!ico) return res.status(400).json({ message: "Subjekt nemá IČO" });
      const subjectType = subject.type === "szco" ? "szco" : (subject.type === "company" || subject.type === "po") ? "company" : undefined;
      const { lookupByIco } = await import("./sk-registry-lookup");
      const result = await lookupByIco(ico, subjectType);
      if (!result.found || !result.source) {
        return res.json({ success: false, message: result.message || "Subjekt nenájdený v registroch" });
      }
      const snapshot = await storage.createRegistrySnapshot({
        subjectId,
        source: result.source,
        ico: result.normalized || ico,
        rawData: result as any,
        parsedFields: {
          name: result.name,
          street: result.street,
          streetNumber: result.streetNumber,
          zip: result.zip,
          city: result.city,
          legalForm: result.legalForm,
          dic: result.dic,
          directors: result.directors,
        },
        fetchedByUserId: (req as any).appUser?.id || null,
      });
      await logAudit(req, {
        action: "CREATE",
        module: "registry_snapshots",
        entityId: subjectId,
        entityName: `Snapshot z ${result.source}`,
        newData: { source: result.source, ico, snapshotId: snapshot.id },
      });
      res.json({ success: true, snapshot });
    } catch (err) {
      console.error("[REGISTRY SNAPSHOT REFRESH ERROR]", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === ARCHIVE MODULE ===
  app.get("/api/archive/deleted", isAuthenticated, async (_req, res) => {
    try {
      const allCompanies = await storage.getMyCompanies(true);
      const allPartners = await storage.getPartners(true);
      const allProducts = await storage.getProducts(true);
      const allContracts = await storage.getContracts({ includeDeleted: true });

      const deletedCompanies = allCompanies.filter(c => c.isDeleted).map(c => ({
        ...c, entityType: "company" as const,
      }));
      const deletedPartners = allPartners.filter(p => p.isDeleted).map(p => ({
        ...p, entityType: "partner" as const,
      }));
      const deletedProducts = allProducts.filter(p => p.isDeleted).map(p => ({
        ...p, entityType: "product" as const,
      }));
      const deletedContracts = allContracts.filter(c => c.isDeleted).map(c => ({
        ...c, entityType: "contract" as const,
      }));

      const softDeletedEntities = await storage.getAllDeletedEntities();

      res.json({
        companies: deletedCompanies,
        partners: deletedPartners,
        products: deletedProducts,
        contracts: deletedContracts,
        softDeleted: softDeletedEntities,
      });
    } catch (err) {
      res.status(500).json({ message: "Failed to load archive" });
    }
  });

  app.post("/api/archive/restore/:entityType/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { entityType, id } = req.params;
      const { password } = req.body || {};
      const numId = Number(id);
      const appUser = req.appUser;

      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }

      const archivePassword = process.env.ARCHIVE_RESTORE_PASSWORD;
      if (!archivePassword || !password || password !== archivePassword) {
        return res.status(401).json({ message: "Nespravne bezpecnostne heslo" });
      }

      switch (entityType) {
        case "company":
          await storage.restoreMyCompany(numId);
          break;
        case "partner":
          await storage.restorePartner(numId);
          break;
        case "product":
          await storage.restoreProduct(numId);
          break;
        case "contract":
          await storage.restoreContract(numId);
          break;
        default:
          await storage.restoreEntity(entityType, numId);
          break;
      }

      await logAudit(req, {
        action: "RESTORE",
        module: "kos",
        entityId: numId,
        entityName: `${entityType} ${numId}`,
        newData: {
          authorizedByAdminId: appUser.id,
          authorizedByUsername: appUser.username,
          authorizedByRole: appUser.role,
          restoredEntityType: entityType,
        },
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Restore failed" });
    }
  });

  app.post("/api/archive/permanent-delete/:entityType/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { entityType, id } = req.params;
      const { password } = req.body || {};
      const numId = Number(id);
      const appUser = req.appUser;

      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }

      const archivePassword = process.env.ARCHIVE_RESTORE_PASSWORD;
      if (!archivePassword || !password || password !== archivePassword) {
        return res.status(401).json({ message: "Nespravne bezpecnostne heslo" });
      }

      await storage.permanentDeleteEntity(entityType, numId);

      await logAudit(req, {
        action: "PERMANENT_DELETE",
        module: "kos",
        entityId: numId,
        entityName: `${entityType} ${numId}`,
        newData: {
          authorizedByAdminId: appUser.id,
          authorizedByUsername: appUser.username,
          authorizedByRole: appUser.role,
          deletedEntityType: entityType,
        },
      });

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Permanent delete failed" });
    }
  });

  // === SYSTEM SETTINGS (public read, authenticated write) ===
  app.get("/api/system-settings/:key", isAuthenticated, async (_req, res) => {
    try {
      const value = await storage.getSystemSetting(_req.params.key);
      res.json({ value });
    } catch {
      res.status(500).json({ message: "Failed to get setting" });
    }
  });

  app.get("/api/system-settings", isAuthenticated, async (_req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      res.json(settings);
    } catch {
      res.status(500).json({ message: "Failed to get settings" });
    }
  });

  app.post("/api/system-settings", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !isAdmin(appUser)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const { key, value } = req.body;
      if (!key || typeof value !== "string") {
        return res.status(400).json({ message: "Key and value required" });
      }
      if (key === "MIGRATION_MODE" && appUser.role !== "superadmin") {
        return res.status(403).json({ message: "Ghost Mode je dostupný len pre superadmina" });
      }
      const setting = await storage.setSystemSetting(key, value);
      await logAudit(req, { action: "UPDATE", module: "nastavenia", entityName: `Setting: ${key}` });
      res.json(setting);
    } catch {
      res.status(500).json({ message: "Failed to save setting" });
    }
  });

  app.patch("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const { key, value } = req.body;
      if (!key || typeof value !== "string") {
        return res.status(400).json({ message: "Key and value required" });
      }
      const setting = await storage.setSystemSetting(key, value);
      await logAudit(req, { action: "UPDATE", module: "nastavenia", entityName: `Setting: ${key}` });
      res.json(setting);
    } catch {
      res.status(500).json({ message: "Failed to save setting" });
    }
  });

  // === BUSINESS OPPORTUNITIES ===
  app.get("/api/business-opportunities", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser?.activeCompanyId) return res.status(400).json({ message: "Nie je vybrana spolocnost" });
      const records = await storage.getBusinessOpportunities(appUser.activeCompanyId, appUser.activeDivisionId);
      res.json(records);
    } catch {
      res.status(500).json({ message: "Failed to get business opportunities" });
    }
  });

  app.get("/api/business-opportunities/all", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !isAdmin(appUser)) return res.status(403).json({ message: "Nedostatocne opravnenia" });
      if (!appUser.activeCompanyId) return res.status(400).json({ message: "Nie je vybrana spolocnost" });
      const records = await storage.getBusinessOpportunitiesForCompany(appUser.activeCompanyId);
      res.json(records);
    } catch {
      res.status(500).json({ message: "Failed to get business opportunities" });
    }
  });

  app.get("/api/business-opportunities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const record = await storage.getBusinessOpportunity(parseInt(req.params.id));
      if (!record) return res.status(404).json({ message: "Nenajdene" });
      if (record.companyId !== appUser?.activeCompanyId) return res.status(403).json({ message: "Nedostatocne opravnenia" });
      res.json(record);
    } catch {
      res.status(500).json({ message: "Failed to get business opportunity" });
    }
  });

  app.post("/api/business-opportunities", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !isAdmin(appUser)) return res.status(403).json({ message: "Nedostatocne opravnenia" });
      if (!appUser.activeCompanyId) return res.status(400).json({ message: "Nie je vybrana spolocnost" });
      const { title, content, divisionIds } = req.body;
      if (!title || !content) return res.status(400).json({ message: "Title a content su povinne" });
      if (divisionIds !== undefined && (!Array.isArray(divisionIds) || !divisionIds.every((v: any) => typeof v === "number" && Number.isInteger(v)))) {
        return res.status(400).json({ message: "divisionIds musi byt pole celych cisel" });
      }
      const record = await storage.createBusinessOpportunity({
        title,
        content,
        divisionIds: Array.isArray(divisionIds) ? divisionIds : [],
        companyId: appUser.activeCompanyId,
        sortOrder: req.body.sortOrder || 0,
      });
      await logAudit(req, { action: "CREATE", module: "obchodne-prilezitosti", entityName: `Obchodna prilezitost: ${title}` });
      res.json(record);
    } catch {
      res.status(500).json({ message: "Failed to create business opportunity" });
    }
  });

  app.put("/api/business-opportunities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !isAdmin(appUser)) return res.status(403).json({ message: "Nedostatocne opravnenia" });
      const id = parseInt(req.params.id);
      const existing = await storage.getBusinessOpportunity(id);
      if (!existing) return res.status(404).json({ message: "Nenajdene" });
      if (existing.companyId !== appUser.activeCompanyId) return res.status(403).json({ message: "Nedostatocne opravnenia" });
      const { title, content, divisionIds, sortOrder } = req.body;
      if (divisionIds !== undefined && (!Array.isArray(divisionIds) || !divisionIds.every((v: any) => typeof v === "number" && Number.isInteger(v)))) {
        return res.status(400).json({ message: "divisionIds musi byt pole celych cisel" });
      }
      const record = await storage.updateBusinessOpportunity(id, {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(divisionIds !== undefined && { divisionIds }),
        ...(sortOrder !== undefined && { sortOrder }),
      });
      await logAudit(req, { action: "UPDATE", module: "obchodne-prilezitosti", entityName: `Obchodna prilezitost: ${record.title}` });
      res.json(record);
    } catch {
      res.status(500).json({ message: "Failed to update business opportunity" });
    }
  });

  app.delete("/api/business-opportunities/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !isAdmin(appUser)) return res.status(403).json({ message: "Nedostatocne opravnenia" });
      const id = parseInt(req.params.id);
      const existing = await storage.getBusinessOpportunity(id);
      if (!existing) return res.status(404).json({ message: "Nenajdene" });
      if (existing.companyId !== appUser.activeCompanyId) return res.status(403).json({ message: "Nedostatocne opravnenia" });
      await storage.deleteBusinessOpportunity(id);
      await logAudit(req, { action: "DELETE", module: "obchodne-prilezitosti", entityName: `Obchodna prilezitost: ${existing.title}` });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Failed to delete business opportunity" });
    }
  });

  // === CATEGORY TIMEOUTS ===
  app.get("/api/category-timeouts", isAuthenticated, async (_req, res) => {
    try {
      const timeouts = await storage.getCategoryTimeouts();
      res.json(timeouts);
    } catch {
      res.status(500).json({ message: "Failed to get category timeouts" });
    }
  });

  app.post("/api/category-timeouts", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const { categoryName, timeoutSeconds } = req.body;
      if (!categoryName || !timeoutSeconds) {
        return res.status(400).json({ message: "Nazov kategorie a cas su povinne" });
      }
      const timeout = await storage.createCategoryTimeout({ categoryName, timeoutSeconds: Number(timeoutSeconds) });
      await logAudit(req, { action: "CREATE", module: "nastavenia", entityName: `Timeout: ${categoryName}` });
      res.json(timeout);
    } catch {
      res.status(500).json({ message: "Failed to create category timeout" });
    }
  });

  app.patch("/api/category-timeouts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const id = parseInt(req.params.id);
      const timeout = await storage.updateCategoryTimeout(id, req.body);
      await logAudit(req, { action: "UPDATE", module: "nastavenia", entityId: id, entityName: "Timeout" });
      res.json(timeout);
    } catch {
      res.status(500).json({ message: "Failed to update category timeout" });
    }
  });

  app.delete("/api/category-timeouts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const id = parseInt(req.params.id);
      await storage.deleteCategoryTimeout(id);
      await logAudit(req, { action: "DELETE", module: "nastavenia", entityId: id, entityName: "Timeout" });
      res.json({ success: true });
    } catch {
      res.status(500).json({ message: "Failed to delete category timeout" });
    }
  });

  // === DASHBOARD CONTRACT STATS ===
  app.get("/api/dashboard-contract-stats", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });

      const filters: any = {
        stateId: appUser.activeStateId || undefined,
        companyId: appUser.activeCompanyId || undefined,
      };
      const allContracts = await storage.getContracts(filters);

      const statuses = await storage.getContractStatuses();
      const activeStatusNames = ["Vybavená", "Prijata centrom - OK"];
      const activeStatusIds = new Set(
        statuses.filter(s => activeStatusNames.includes(s.name)).map(s => s.id)
      );

      const interventionStatusIds = new Set(
        statuses.filter(s => s.isIntervention).map(s => s.id)
      );

      const totalContracts = allContracts.length;
      const activeContracts = allContracts.filter(c => c.statusId && activeStatusIds.has(c.statusId));
      const interventionContracts = allContracts.filter(c =>
        (c.statusId && interventionStatusIds.has(c.statusId)) ||
        c.needsManualVerification === true
      );

      const totalAnnualPremium = activeContracts.reduce((sum, c) => {
        return sum + (c.annualPremium || 0);
      }, 0);

      const activeStatusIdList = Array.from(activeStatusIds);
      const interventionStatusIdList = Array.from(interventionStatusIds);
      const hasManualVerification = allContracts.some(c => c.needsManualVerification === true);

      res.json({
        totalContracts,
        activeContractsCount: activeContracts.length,
        interventionCount: interventionContracts.length,
        totalAnnualPremium,
        activeStatusIds: activeStatusIdList,
        interventionStatusIds: interventionStatusIdList,
        hasManualVerification,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === DASHBOARD ANALYTICS (Inteligentný Dashboard) ===
  app.get("/api/dashboard/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });

      const stateId = getEnforcedStateId(req);
      const companyId = appUser.activeCompanyId || undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;
      const phase = req.query.phase ? Number(req.query.phase) : undefined;
      const inventoryId = req.query.inventoryId ? Number(req.query.inventoryId) : undefined;

      const conditions: any[] = [eq(contracts.isDeleted, false)];
      if (stateId) conditions.push(eq(contracts.stateId, stateId));
      if (companyId) conditions.push(eq(contracts.companyId, companyId));
      if (dateFrom) conditions.push(gte(contracts.createdAt, new Date(dateFrom)));
      if (dateTo) {
        const endOfDay = new Date(dateTo);
        endOfDay.setHours(23, 59, 59, 999);
        conditions.push(lte(contracts.createdAt, endOfDay));
      }
      if (phase) conditions.push(eq(contracts.lifecyclePhase, phase));
      if (inventoryId) conditions.push(eq(contracts.inventoryId, inventoryId));

      const whereClause = and(...conditions);

      const allStatuses = await storage.getContractStatuses(stateId);
      const STATUS_PHASE_MAP: Record<string, number> = {
        "neprijata": 3, "vyhrady": 3, "nedodana": 3, "chybna": 3,
        "odoslana": 2, "sprievodke": 2,
        "prijata": 5, "vybavena": 5, "spracovana": 5, "schvalenie": 5,
        "intervencia": 7, "riesenie": 7,
      };
      function derivePhaseLocal(lp: number | null, statusId: number | null): number {
        if (lp && lp > 0) return lp;
        if (!statusId) return 1;
        const st = allStatuses.find((s: any) => s.id === statusId);
        if (!st) return 1;
        const nameLower = (st.name || "").toLowerCase();
        for (const [keyword, p] of Object.entries(STATUS_PHASE_MAP)) {
          if (nameLower.includes(keyword)) return p;
        }
        return 1;
      }

      const PHASE_COLORS: Record<number, string> = {
        1: "#6b7280", 2: "#3b82f6", 3: "#ef4444", 4: "#6b7280",
        5: "#22c55e", 6: "#22c55e", 7: "#f59e0b", 8: "#22c55e",
        9: "#22c55e", 10: "#22c55e",
      };

      const filtered = await db.select({
        id: contracts.id,
        lifecyclePhase: contracts.lifecyclePhase,
        statusId: contracts.statusId,
        createdAt: contracts.createdAt,
        inventoryId: contracts.inventoryId,
      }).from(contracts).where(whereClause).orderBy(asc(contracts.createdAt)).limit(50000);

      const objectionStatusIds = new Set(
        allStatuses.filter(s => s.isIntervention || (s.name || "").toLowerCase().includes("vyhrady") || (s.name || "").toLowerCase().includes("neprijata")).map(s => s.id)
      );
      const acceptedStatusIds = new Set(
        allStatuses.filter(s => (s.name || "").toLowerCase().includes("prijata") && !(s.name || "").toLowerCase().includes("neprijata")).map(s => s.id)
      );

      const totalContracts = filtered.length;
      const pendingObjections = filtered.filter(c => {
        const p = derivePhaseLocal(c.lifecyclePhase, c.statusId);
        return p === 3;
      }).length;

      const inventoryIds = new Set(filtered.filter(c => c.inventoryId).map(c => c.inventoryId));
      const sprievodkyCount = inventoryIds.size;

      const scanTrendMap = new Map<string, number>();
      for (const c of filtered) {
        const d = c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : null;
        if (d) scanTrendMap.set(d, (scanTrendMap.get(d) || 0) + 1);
      }
      const sortedDays = [...scanTrendMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      let cumulative = 0;
      const scanTrend = sortedDays.map(([date, count]) => {
        cumulative += count;
        return { date, cumulative };
      });

      const phaseCountMap = new Map<number, number>();
      for (const c of filtered) {
        const p = derivePhaseLocal(c.lifecyclePhase, c.statusId);
        phaseCountMap.set(p, (phaseCountMap.get(p) || 0) + 1);
      }
      const phaseDistribution = [...phaseCountMap.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([p, count]) => ({
          phase: p,
          count,
          label: LIFECYCLE_PHASES[p] || `Fáza ${p}`,
          color: PHASE_COLORS[p] || "#6b7280",
        }));

      const qualityMap = new Map<string, { accepted: number; objections: number }>();
      for (const c of filtered) {
        const d = c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 7) : null;
        if (!d) continue;
        if (!qualityMap.has(d)) qualityMap.set(d, { accepted: 0, objections: 0 });
        const entry = qualityMap.get(d)!;
        if (c.statusId && objectionStatusIds.has(c.statusId)) entry.objections++;
        else if (c.statusId && acceptedStatusIds.has(c.statusId)) entry.accepted++;
        else {
          const p = derivePhaseLocal(c.lifecyclePhase, c.statusId);
          if (p === 3) entry.objections++;
          else if (p >= 5) entry.accepted++;
        }
      }
      const qualityProcess = [...qualityMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([period, data]) => ({ period, ...data }));

      const protocolMap = new Map<string, Set<number>>();
      for (const c of filtered) {
        if (!c.inventoryId) continue;
        const d = c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 7) : null;
        if (!d) continue;
        if (!protocolMap.has(d)) protocolMap.set(d, new Set());
        protocolMap.get(d)!.add(c.inventoryId);
      }
      const protocolActivity = [...protocolMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, ids]) => ({ month, count: ids.size }));

      const inventories = await db.select({
        id: contractInventories.id,
        name: contractInventories.name,
      }).from(contractInventories).orderBy(asc(contractInventories.name)).limit(500);

      res.json({
        quickStats: { totalContracts, pendingObjections, sprievodkyCount },
        scanTrend,
        phaseDistribution,
        qualityProcess,
        protocolActivity,
        inventories,
      });
    } catch (err: any) {
      console.error("Dashboard analytics error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // === DASHBOARD PREFERENCES ===
  app.get("/api/dashboard-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const prefs = await storage.getDashboardPreferences(appUser.id);
      res.json(prefs);
    } catch {
      res.status(500).json({ message: "Failed to get dashboard preferences" });
    }
  });

  app.post("/api/dashboard-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const { preferences } = req.body;
      if (!Array.isArray(preferences)) {
        return res.status(400).json({ message: "Preferences must be an array" });
      }
      const results = await storage.bulkSetDashboardPreferences(appUser.id, preferences);
      res.json(results);
    } catch {
      res.status(500).json({ message: "Failed to save dashboard preferences" });
    }
  });

  // === DASHBOARD LAYOUTS (ArutsoK 22) ===
  app.get("/api/dashboard-layout", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const layout = await storage.getDashboardLayout(appUser.id);
      res.json(layout || null);
    } catch {
      res.status(500).json({ message: "Failed to get dashboard layout" });
    }
  });

  app.post("/api/dashboard-layout", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const { widgetOrder } = req.body;
      if (!Array.isArray(widgetOrder) || widgetOrder.length === 0) {
        return res.status(400).json({ message: "widgetOrder must be a non-empty array of strings" });
      }
      const validKeys = ["stats", "recent_subjects", "my_companies", "recent_partners", "recent_products", "audit_activity", "upcoming_events", "my_tasks", "red_list_recent", "black_list_recent"];
      const allValid = widgetOrder.every((k: any) => typeof k === "string" && validKeys.includes(k));
      if (!allValid) {
        return res.status(400).json({ message: "widgetOrder contains invalid widget keys" });
      }
      const layout = await storage.saveDashboardLayout(appUser.id, widgetOrder);
      res.json(layout);
    } catch {
      res.status(500).json({ message: "Failed to save dashboard layout" });
    }
  });

  // === SIDEBAR LINK SECTIONS ===
  app.get("/api/sidebar-link-sections", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const divisionId = req.query.divisionId ? parseInt(req.query.divisionId as string) : appUser.activeDivisionId;
      let sections = await storage.getSidebarLinkSections(appUser.id, divisionId);
      if (sections.length === 0 && divisionId) {
        const created = await storage.createSidebarLinkSection({ appUserId: appUser.id, divisionId, name: "Odkazy - linky", sortOrder: 0 });
        sections = [created];
      }
      res.json(sections);
    } catch { res.status(500).json({ message: "Chyba pri načítaní sekcií" }); }
  });

  app.post("/api/sidebar-link-sections", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const { name, sortOrder } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ message: "Názov je povinný" });
      const divisionId = appUser.activeDivisionId;
      const section = await storage.createSidebarLinkSection({ appUserId: appUser.id, divisionId, name, sortOrder: sortOrder ?? 0 });
      res.json(section);
    } catch { res.status(500).json({ message: "Chyba pri vytváraní sekcie" }); }
  });

  app.patch("/api/sidebar-link-sections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      const sections = await storage.getSidebarLinkSections(appUser.id);
      if (!sections.find(s => s.id === id)) return res.status(403).json({ message: "Nedostatočné oprávnenia" });
      const updated = await storage.updateSidebarLinkSection(id, req.body);
      res.json(updated);
    } catch { res.status(500).json({ message: "Chyba pri aktualizácii sekcie" }); }
  });

  app.delete("/api/sidebar-link-sections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      const sections = await storage.getSidebarLinkSections(appUser.id);
      if (!sections.find(s => s.id === id)) return res.status(403).json({ message: "Nedostatočné oprávnenia" });
      await storage.deleteSidebarLinkSection(id);
      res.json({ ok: true });
    } catch { res.status(500).json({ message: "Chyba pri mazaní sekcie" }); }
  });

  // === SIDEBAR LINKS ===
  app.get("/api/sidebar-links", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const divisionId = req.query.divisionId ? parseInt(req.query.divisionId as string) : appUser.activeDivisionId;
      const links = await storage.getSidebarLinks(appUser.id, divisionId);
      res.json(links);
    } catch { res.status(500).json({ message: "Chyba pri načítaní odkazov" }); }
  });

  app.post("/api/sidebar-links", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const { sectionId, groupName, name, url, sortOrder } = req.body;
      if (!sectionId || !groupName || !name || !url) return res.status(400).json({ message: "Všetky polia sú povinné" });
      const divisionId = appUser.activeDivisionId;
      const sections = await storage.getSidebarLinkSections(appUser.id, divisionId);
      if (!sections.find(s => s.id === sectionId)) return res.status(403).json({ message: "Sekcia nepatrí používateľovi" });
      const link = await storage.createSidebarLink({ sectionId, appUserId: appUser.id, divisionId, groupName, name, url, sortOrder: sortOrder ?? 0 });
      res.json(link);
    } catch { res.status(500).json({ message: "Chyba pri vytváraní odkazu" }); }
  });

  app.patch("/api/sidebar-links/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      const links = await storage.getSidebarLinks(appUser.id);
      if (!links.find(l => l.id === id)) return res.status(403).json({ message: "Nedostatočné oprávnenia" });
      const updated = await storage.updateSidebarLink(id, req.body);
      res.json(updated);
    } catch { res.status(500).json({ message: "Chyba pri aktualizácii odkazu" }); }
  });

  app.delete("/api/sidebar-links/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const id = parseInt(req.params.id);
      const links = await storage.getSidebarLinks(appUser.id);
      if (!links.find(l => l.id === id)) return res.status(403).json({ message: "Nedostatočné oprávnenia" });
      await storage.deleteSidebarLink(id);
      res.json({ ok: true });
    } catch { res.status(500).json({ message: "Chyba pri mazaní odkazu" }); }
  });

  // === CLIENT TYPES ===
  app.get("/api/client-types", isAuthenticated, async (_req, res) => {
    try {
      const types = await storage.getClientTypes();
      res.json(types);
    } catch {
      res.status(500).json({ message: "Failed to get client types" });
    }
  });

  app.post("/api/client-types", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const created = await storage.createClientType(req.body);
      await logAudit(req, { action: "CREATE", module: "client_types", entityId: created.id, entityName: created.name });
      res.json(created);
    } catch {
      res.status(500).json({ message: "Failed to create client type" });
    }
  });

  app.patch("/api/client-types/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const updated = await storage.updateClientType(Number(req.params.id), req.body);
      await logAudit(req, { action: "UPDATE", module: "client_types", entityId: updated.id, entityName: updated.name });
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update client type" });
    }
  });

  app.delete("/api/client-types/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      await storage.deleteClientType(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "client_types", entityId: Number(req.params.id) });
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Failed to delete client type" });
    }
  });

  // === DUPLICATE CHECK ===
  app.post("/api/subjects/check-duplicate", isAuthenticated, async (req: any, res) => {
    try {
      const { birthNumber, ico, spz, vin } = req.body;
      const existing = await storage.checkDuplicateSubject({ birthNumber, ico });
      if (existing) {
        const isBlacklisted = await storage.isSubjectInGroup(existing.id, "group_cierny_zoznam");
        if (isBlacklisted) {
          res.json({
            isDuplicate: true,
            isBlacklisted: true,
            subject: {
              id: existing.id,
              uid: existing.uid,
              name: existing.name,
              type: existing.type,
              matchedField: existing.matchedField,
            },
            message: "Registráciu nie je možné dokončiť. Kontaktujte správcu.",
          });
          return;
        }

        let managerName: string | null = null;
        let managerId: number | null = null;
        if (existing.uploadedByUserId) {
          const allUsers = await storage.getAppUsers();
          const manager = allUsers.find((u: any) => u.id === existing.uploadedByUserId);
          if (manager) {
            managerId = manager.id;
            managerName = [manager.firstName, manager.lastName].filter(Boolean).join(' ') || manager.username || null;
          }
        }

        res.json({
          isDuplicate: true,
          isBlacklisted: false,
          subject: {
            id: existing.id,
            uid: existing.uid,
            name: existing.name,
            type: existing.type,
            matchedField: existing.matchedField,
          },
          managerId,
          managerName,
        });
        return;
      }

      if (spz || vin) {
        const duplicates = await storage.checkDuplicates({
          spz: spz || undefined,
          vin: vin || undefined,
        });
        if (duplicates.length > 0) {
          const d = duplicates[0];
          res.json({
            isDuplicate: true,
            subject: {
              id: d.id,
              uid: d.uid,
              name: d.companyName || [d.firstName, d.lastName].filter(Boolean).join(" "),
              type: d.type,
              matchedField: spz ? "ŠPZ" : "VIN",
            },
          });
          return;
        }
      }

      res.json({ isDuplicate: false });
    } catch {
      res.status(500).json({ message: "Failed to check duplicate" });
    }
  });

  // === PUBLIC REGISTRATION ROUTES ===
  const registrationChallenges = new Map<string, { subjectId: number; positions: number[]; birthNumberLength: number }>();

  app.post("/api/public/register/initiate", async (req, res) => {
    try {
      const { email, phone } = req.body;
      if (!email || !phone) {
        return res.status(400).json({ message: "Email a telefon su povinne" });
      }

      const client = await storage.findClientByEmailPhone(email, phone);
      if (!client || !client.myCompanyId) {
        const supportPhone = await storage.getSystemSetting("support_phone") || "+421 900 000 000";
        return res.status(404).json({
          message: `Vase udaje neboli spravne, volajte ${supportPhone}`,
        });
      }

      const loginAllowed = await storage.isSubjectLoginAllowed(client.id);
      if (!loginAllowed) {
        const supportPhone = await storage.getSystemSetting("support_phone") || "+421 900 000 000";
        return res.status(403).json({
          message: `Prihlasenie nie je povolene pre vas ucet. Kontaktujte ${supportPhone}`,
        });
      }

      if (!client.birthNumber) {
        const supportPhone = await storage.getSystemSetting("support_phone") || "+421 900 000 000";
        return res.status(404).json({
          message: `Vase udaje neboli spravne, volajte ${supportPhone}`,
        });
      }

      const bn = client.birthNumber.replace(/\//g, "").replace(/\s/g, "");
      const isNineDigit = bn.length === 9;
      const isTenDigit = bn.length === 10;

      if (!isNineDigit && !isTenDigit) {
        const supportPhone = await storage.getSystemSetting("support_phone") || "+421 900 000 000";
        return res.status(400).json({
          message: `Vase udaje neboli spravne, volajte ${supportPhone}`,
        });
      }

      const firstSixPositions = [0, 1, 2, 3, 4, 5];
      const shuffledFirst = firstSixPositions.sort(() => Math.random() - 0.5);
      const selectedFirst = shuffledFirst.slice(0, 2);

      let selectedLast: number[] = [];
      if (isTenDigit) {
        const lastFourPositions = [6, 7, 8, 9];
        const shuffledLast = lastFourPositions.sort(() => Math.random() - 0.5);
        selectedLast = shuffledLast.slice(0, 2);
      } else {
        const lastThreePositions = [6, 7, 8];
        const shuffledLast = lastThreePositions.sort(() => Math.random() - 0.5);
        selectedLast = shuffledLast.slice(0, 1);
      }

      const allPositions = [...selectedFirst, ...selectedLast].sort((a, b) => a - b);

      const challengeId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      registrationChallenges.set(challengeId, {
        subjectId: client.id,
        positions: allPositions,
        birthNumberLength: bn.length,
      });

      setTimeout(() => registrationChallenges.delete(challengeId), 10 * 60 * 1000);

      res.json({
        challengeId,
        positions: allPositions,
        birthNumberLength: bn.length,
        clientName: `${client.firstName || ""} ${client.lastName || ""}`.trim(),
      });
    } catch (err) {
      console.error("Registration initiate error:", err);
      res.status(500).json({ message: "Chyba servera" });
    }
  });

  app.post("/api/public/register/verify-birth", async (req, res) => {
    try {
      const { challengeId, digits } = req.body;
      if (!challengeId || !digits) {
        return res.status(400).json({ message: "Chybaju udaje" });
      }

      const challenge = registrationChallenges.get(challengeId);
      if (!challenge) {
        return res.status(400).json({ message: "Platnost vyzvy vyprsal, skuste znova" });
      }

      const client = await storage.getSubject(challenge.subjectId);
      if (!client || !client.birthNumber) {
        return res.status(400).json({ message: "Klient nebol najdeny" });
      }

      const bn = client.birthNumber.replace(/\//g, "").replace(/\s/g, "");
      const expectedDigits = challenge.positions.map(pos => bn[pos]);

      const providedDigits = Array.isArray(digits) ? digits : String(digits).split("");
      const matches = expectedDigits.length === providedDigits.length &&
        expectedDigits.every((d, i) => d === providedDigits[i]);

      if (!matches) {
        const supportPhone = await storage.getSystemSetting("support_phone") || "+421 900 000 000";
        registrationChallenges.delete(challengeId);
        return res.status(401).json({
          message: `Vase udaje neboli spravne, volajte ${supportPhone}`,
        });
      }

      const hasEmail = !!client.email;
      const hasPhone = !!client.phone;

      if (hasEmail && hasPhone) {
        const smsCode = Math.floor(100000 + Math.random() * 900000).toString();
        const emailCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await storage.createVerificationCode(client.id, "sms", smsCode, expiresAt);
        await storage.createVerificationCode(client.id, "email", emailCode, expiresAt);


        const maskedPhone = client.phone!.replace(/(\d{3})\d+(\d{2})/, "$1****$2");
        const maskedEmail = client.email!.replace(/(.{2}).+(@.+)/, "$1***$2");

        res.json({
          step: "mfa",
          challengeId,
          mfaType: "codes",
          maskedPhone,
          maskedEmail,
          subjectId: client.id,
        });
      } else {
        res.json({
          step: "full_verification",
          challengeId,
          subjectId: client.id,
          message: "Vase kontaktne udaje nie su kompletne v systeme. Zadajte cele rodne cislo a cislo obcianskeho preukazu.",
        });
      }
    } catch (err) {
      console.error("Verify birth error:", err);
      res.status(500).json({ message: "Chyba servera" });
    }
  });

  app.post("/api/public/register/mfa-verify", async (req, res) => {
    try {
      const { subjectId, smsCode, emailCode } = req.body;
      if (!subjectId || !smsCode || !emailCode) {
        return res.status(400).json({ message: "Vsetky kody su povinne" });
      }

      const smsValid = await storage.getValidVerificationCode(subjectId, "sms", smsCode);
      const emailValid = await storage.getValidVerificationCode(subjectId, "email", emailCode);

      if (!smsValid || !emailValid) {
        const supportPhone = await storage.getSystemSetting("support_phone") || "+421 900 000 000";
        return res.status(401).json({
          message: `Vase udaje neboli spravne, volajte ${supportPhone}`,
        });
      }

      await storage.markVerificationCodeUsed(smsValid.id);
      await storage.markVerificationCodeUsed(emailValid.id);

      const client = await storage.getSubject(subjectId);

      res.json({
        success: true,
        client: client ? {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          phone: client.phone,
          companyName: client.companyName,
        } : null,
      });
    } catch (err) {
      console.error("MFA verify error:", err);
      res.status(500).json({ message: "Chyba servera" });
    }
  });

  app.post("/api/public/register/full-verify", async (req, res) => {
    try {
      const { subjectId, fullBirthNumber, idCardNumber } = req.body;
      if (!subjectId || !fullBirthNumber || !idCardNumber) {
        return res.status(400).json({ message: "Vsetky udaje su povinne" });
      }

      const client = await storage.getSubject(subjectId);
      if (!client) {
        return res.status(404).json({ message: "Klient nebol najdeny" });
      }

      const storedBN = (client.birthNumber || "").replace(/\//g, "").replace(/\s/g, "");
      const providedBN = fullBirthNumber.replace(/\//g, "").replace(/\s/g, "");

      if (storedBN !== providedBN) {
        const supportPhone = await storage.getSystemSetting("support_phone") || "+421 900 000 000";
        return res.status(401).json({
          message: `Vase udaje neboli spravne, volajte ${supportPhone}`,
        });
      }

      const storedID = (client.idCardNumber || "").replace(/\s/g, "").toUpperCase();
      const providedID = idCardNumber.replace(/\s/g, "").toUpperCase();

      if (storedID !== providedID) {
        const supportPhone = await storage.getSystemSetting("support_phone") || "+421 900 000 000";
        return res.status(401).json({
          message: `Vase udaje neboli spravne, volajte ${supportPhone}`,
        });
      }

      res.json({
        success: true,
        client: {
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          email: client.email,
          phone: client.phone,
          companyName: client.companyName,
        },
      });
    } catch (err) {
      console.error("Full verify error:", err);
      res.status(500).json({ message: "Chyba servera" });
    }
  });

  // === SECTORS CRUD ===
  // ArutsoK 41 - Hierarchy counts for table badges
  app.get("/api/hierarchy/counts", isAuthenticated, async (_req, res) => {
    try {
      const [sectorProducts, allSections, allProducts, allFolderAssignments, allFolderPanelsData, allPanelParams] = await Promise.all([
        storage.getSectorProducts(),
        storage.getSections(),
        storage.getSectorProducts(),
        db.select().from(productFolderAssignments),
        db.select().from(folderPanels),
        db.select().from(panelParameters),
      ]);

      const sectorSectionCounts: Record<number, number> = {};
      for (const sec of allSections) {
        sectorSectionCounts[sec.sectorId] = (sectorSectionCounts[sec.sectorId] || 0) + 1;
      }

      const sectorProductCounts: Record<number, number> = {};
      for (const sp of sectorProducts) {
        const section = allSections.find(s => s.id === sp.sectionId);
        if (section) {
          sectorProductCounts[section.sectorId] = (sectorProductCounts[section.sectorId] || 0) + 1;
        }
      }

      const sectionProductCounts: Record<number, number> = {};
      for (const sp of allProducts) {
        sectionProductCounts[sp.sectionId] = (sectionProductCounts[sp.sectionId] || 0) + 1;
      }

      const productFolderCounts: Record<number, number> = {};
      for (const pfa of allFolderAssignments) {
        productFolderCounts[pfa.productId] = (productFolderCounts[pfa.productId] || 0) + 1;
      }

      const folderPanelCounts: Record<number, number> = {};
      for (const fp of allFolderPanelsData) {
        folderPanelCounts[fp.folderId] = (folderPanelCounts[fp.folderId] || 0) + 1;
      }

      const panelParameterCounts: Record<number, number> = {};
      for (const pp of allPanelParams) {
        panelParameterCounts[pp.panelId] = (panelParameterCounts[pp.panelId] || 0) + 1;
      }

      res.json({
        sectorSections: sectorSectionCounts,
        sectorProducts: sectorProductCounts,
        sectionProducts: sectionProductCounts,
        productFolders: productFolderCounts,
        folderPanels: folderPanelCounts,
        panelParameters: panelParameterCounts,
      });
    } catch (err) {
      console.error("Hierarchy counts error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/sectors", isAuthenticated, async (req: any, res) => {
    try {
      const divisionId = req.query.divisionId ? Number(req.query.divisionId) : undefined;
      const allSectors = await storage.getSectors();
      const filtered = divisionId ? allSectors.filter(s => s.divisionId === divisionId) : allSectors;
      res.json(filtered);
    } catch (err) {
      console.error("Get sectors error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/sectors", isAuthenticated, async (req: any, res) => {
    try {
      const created = await storage.createSector(req.body);
      await logAudit(req, { action: "Vytvorenie", module: "Sektory", entityId: created.id, entityName: created.name, newData: req.body });
      res.status(201).json(created);
    } catch (err) {
      console.error("Create sector error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/sectors/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const oldSector = await storage.getSector(id);
      const updated = await storage.updateSector(id, req.body);
      await logAudit(req, { action: "Uprava", module: "Sektory", entityId: id, entityName: updated.name, oldData: oldSector, newData: req.body });
      res.json(updated);
    } catch (err) {
      console.error("Update sector error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/sectors/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const oldSector = await storage.getSector(id);
      const sectorSections = await storage.getSections(id);
      if (sectorSections.length > 0) {
        return res.status(400).json({ message: `Sektor nie je mozne vymazat, obsahuje ${sectorSections.length} sekcii` });
      }
      await storage.deleteSector(id);
      await logAudit(req, { action: "Vymazanie", module: "Sektory", entityId: id, entityName: oldSector?.name });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete sector error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === SECTIONS CRUD (ArutsoK 28) ===
  app.get("/api/sections", isAuthenticated, async (req, res) => {
    try {
      const sectorId = req.query.sectorId ? Number(req.query.sectorId) : undefined;
      const sectionType = req.query.sectionType as string | undefined;
      let sectionsList = await storage.getSections(sectorId);
      if (sectionType) sectionsList = sectionsList.filter(s => (s as any).sectionType === sectionType);
      res.json(sectionsList);
    } catch (err) {
      console.error("Get sections error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/sections", isAuthenticated, async (req: any, res) => {
    try {
      const created = await storage.createSection(req.body);
      await logAudit(req, { action: "Vytvorenie", module: "Sekcie", entityId: created.id, entityName: created.name, newData: req.body });
      res.status(201).json(created);
    } catch (err) {
      console.error("Create section error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/sections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const oldSection = await storage.getSection(id);
      const updated = await storage.updateSection(id, req.body);
      await logAudit(req, { action: "Uprava", module: "Sekcie", entityId: id, entityName: updated.name, oldData: oldSection, newData: req.body });
      res.json(updated);
    } catch (err) {
      console.error("Update section error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/sections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const oldSection = await storage.getSection(id);
      const products = await storage.getSectorProducts(id);
      if (products.length > 0) {
        return res.status(400).json({ message: `Sekciu nie je mozne vymazat, obsahuje ${products.length} produktov` });
      }
      await storage.deleteSection(id);
      await logAudit(req, { action: "Vymazanie", module: "Sekcie", entityId: id, entityName: oldSection?.name });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete section error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === PARAMETERS CRUD ===
  app.get("/api/parameters", isAuthenticated, async (_req, res) => {
    try {
      const parameters = await storage.getParameters();
      res.json(parameters);
    } catch (err) {
      console.error("Get parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/parameters", isAuthenticated, async (req: any, res) => {
    try {
      const created = await storage.createParameter(req.body);
      await logAudit(req, { action: "Vytvorenie", module: "Parametre", entityId: created.id, entityName: created.name, newData: req.body });
      res.status(201).json(created);
    } catch (err) {
      console.error("Create parameter error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/parameters/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const oldParameter = await storage.getParameter(id);
      const updated = await storage.updateParameter(id, req.body);
      await logAudit(req, { action: "Uprava", module: "Parametre", entityId: id, entityName: updated.name, oldData: oldParameter, newData: req.body });
      res.json(updated);
    } catch (err) {
      console.error("Update parameter error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/parameters/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const oldParameter = await storage.getParameter(id);
      await storage.deleteParameter(id);
      await logAudit(req, { action: "Vymazanie", module: "Parametre", entityId: id, entityName: oldParameter?.name });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete parameter error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === SECTOR PRODUCTS CRUD (ArutsoK 25) ===
  app.get("/api/sector-products", isAuthenticated, async (req, res) => {
    try {
      const sectionId = req.query.sectionId ? Number(req.query.sectionId) : undefined;
      const forContractForm = req.query.forContractForm === 'true';
      const sectorProducts = await storage.getSectorProducts(sectionId, forContractForm);
      res.json(sectorProducts);
    } catch (err) {
      console.error("Get sector products error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/sector-products", isAuthenticated, async (req: any, res) => {
    try {
      const created = await storage.createSectorProduct(req.body);
      await logAudit(req, { action: "Vytvorenie", module: "SektoroveProdukty", entityId: created.id, entityName: created.name, newData: req.body });
      res.status(201).json(created);
    } catch (err) {
      console.error("Create sector product error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/sector-products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const old = await storage.getSectorProduct(id);
      const updated = await storage.updateSectorProduct(id, req.body);
      await logAudit(req, { action: "Uprava", module: "SektoroveProdukty", entityId: id, entityName: updated.name, oldData: old, newData: req.body });
      res.json(updated);
    } catch (err) {
      console.error("Update sector product error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/sector-products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const old = await storage.getSectorProduct(id);
      const panels = await storage.getProductPanels(id);
      if (panels.length > 0) {
        return res.status(400).json({ message: `Produkt nie je mozne vymazat, obsahuje ${panels.length} panelov` });
      }
      await storage.deleteSectorProduct(id);
      await logAudit(req, { action: "Vymazanie", module: "SektoroveProdukty", entityId: id, entityName: old?.name });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete sector product error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === SECTOR-PRODUCT-PARAMETER ASSIGNMENTS (ArutsoK 25) ===
  app.get("/api/sector-products/:id/parameters", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const params = await storage.getSectorProductParameters(id);
      res.json(params);
    } catch (err) {
      console.error("Get sector product parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/sector-products/:id/parameters", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await storage.setSectorProductParameters(id, req.body.parameterIds);
      await logAudit(req, { action: "Uprava", module: "SektoroveProdukty", entityId: id, entityName: "Priradenie parametrov" });
      res.json({ success: true });
    } catch (err) {
      console.error("Set sector product parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === SECTOR-PARAMETER ASSIGNMENTS (legacy) ===
  app.get("/api/sectors/:id/parameters", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const params = await storage.getSectorParameters(id);
      res.json(params);
    } catch (err) {
      console.error("Get sector parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/sectors/:id/parameters", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await storage.setSectorParameters(id, req.body.parameterIds);
      await logAudit(req, { action: "Uprava", module: "Sektory", entityId: id, entityName: "Priradenie parametrov" });
      res.json({ success: true });
    } catch (err) {
      console.error("Set sector parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === PRODUCT-SECTOR ASSIGNMENTS ===
  app.get("/api/products/:id/sectors", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const sectorsList = await storage.getProductSectors(id);
      res.json(sectorsList);
    } catch (err) {
      console.error("Get product sectors error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/products/:id/sectors", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await storage.setProductSectors(id, req.body.sectorIds);
      await logAudit(req, { action: "Uprava", module: "Produkty", entityId: id, entityName: "Priradenie sektorov" });
      res.json({ success: true });
    } catch (err) {
      console.error("Set product sectors error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === PRODUCT-PARAMETER ASSIGNMENTS ===
  app.get("/api/products/:id/parameters", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const params = await storage.getProductParameters(id);
      res.json(params);
    } catch (err) {
      console.error("Get product parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/products/:id/parameters", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await storage.setProductParameters(id, req.body.parameters);
      await logAudit(req, { action: "Uprava", module: "Produkty", entityId: id, entityName: "Priradenie parametrov" });
      res.json({ success: true });
    } catch (err) {
      console.error("Set product parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === PANELS (ArutsoK 27) ===
  app.get("/api/panels", isAuthenticated, async (_req, res) => {
    try {
      const allPanels = await storage.getPanels();
      res.json(allPanels);
    } catch (err) {
      console.error("Get panels error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/panels", isAuthenticated, async (req: any, res) => {
    try {
      const panel = await storage.createPanel(req.body);
      await logAudit(req, { action: "Vytvorenie", module: "Panely", entityId: panel.id, entityName: panel.name });
      res.json(panel);
    } catch (err) {
      console.error("Create panel error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/panels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const panel = await storage.updatePanel(id, req.body);
      await logAudit(req, { action: "Uprava", module: "Panely", entityId: id, entityName: panel.name });
      res.json(panel);
    } catch (err) {
      console.error("Update panel error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/panels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const panel = await storage.getPanel(id);
      const params = await storage.getPanelParameters(id);
      if (params.length > 0) {
        return res.status(400).json({ message: `Panel nie je mozne vymazat, obsahuje ${params.length} parametrov` });
      }
      await storage.deletePanel(id);
      await logAudit(req, { action: "Vymazanie", module: "Panely", entityId: id, entityName: panel?.name || "" });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete panel error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/panels/:id/parameters", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const params = await storage.getPanelParameters(id);
      res.json(params);
    } catch (err) {
      console.error("Get panel parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/panels/:id/parameters", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await storage.setPanelParameters(id, req.body.parameterIds);
      await logAudit(req, { action: "Uprava", module: "Panely", entityId: id, entityName: "Priradenie parametrov" });
      res.json({ success: true });
    } catch (err) {
      console.error("Set panel parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/sector-products/:id/panels", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const pp = await storage.getProductPanels(id);
      res.json(pp);
    } catch (err) {
      console.error("Get product panels error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/sector-products/:id/panels", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await storage.setProductPanels(id, req.body.panelIds);
      await logAudit(req, { action: "Uprava", module: "Produkty", entityId: id, entityName: "Priradenie panelov" });
      res.json({ success: true });
    } catch (err) {
      console.error("Set product panels error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/sector-products/:id/panels-with-parameters", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const pp = await storage.getProductPanels(id);
      const allPanels = await storage.getPanels();
      const allParams = await storage.getParameters();
      const result = [];
      for (const assignment of pp) {
        const panel = allPanels.find(p => p.id === assignment.panelId);
        if (!panel) continue;
        const panelParams = await storage.getPanelParameters(panel.id);
        const parametersWithDetails = panelParams.map(pp => {
          const param = allParams.find(p => p.id === pp.parameterId);
          return param ? { ...param, panelSortOrder: pp.sortOrder } : null;
        }).filter(Boolean);
        result.push({ ...panel, parameters: parametersWithDetails });
      }
      res.json(result);
    } catch (err) {
      console.error("Get product panels with parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/products/:id/panels-with-parameters", isAuthenticated, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const productSectorAssignments = await storage.getProductSectors(productId);
      const allPanels = await storage.getPanels();
      const allParams = await storage.getParameters();
      const resultPanels: any[] = [];
      const seenPanelIds = new Set<number>();

      for (const ps of productSectorAssignments) {
        const sectorSections = await storage.getSections(ps.sectorId);
        for (const sec of sectorSections) {
          const sectorProds = await storage.getSectorProducts(sec.id);
          for (const sp of sectorProds) {
            const prodPanels = await storage.getProductPanels(sp.id);
            for (const pp of prodPanels) {
              if (seenPanelIds.has(pp.panelId)) continue;
              seenPanelIds.add(pp.panelId);
              const panel = allPanels.find(p => p.id === pp.panelId);
              if (!panel) continue;
              const panelParams = await storage.getPanelParameters(panel.id);
              const parametersWithDetails = panelParams.map(pparam => {
                const param = allParams.find(p => p.id === pparam.parameterId);
                return param ? { ...param, panelSortOrder: pparam.sortOrder } : null;
              }).filter(Boolean);
              resultPanels.push({ ...panel, parameters: parametersWithDetails, productSortOrder: pp.sortOrder });
            }
          }
        }
      }
      resultPanels.sort((a, b) => (a.productSortOrder || 0) - (b.productSortOrder || 0));
      res.json(resultPanels);
    } catch (err) {
      console.error("Get product panels with parameters error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CONTRACT FOLDERS (ArutsoK 35) ===
  app.get("/api/contract-folders", isAuthenticated, async (_req, res) => {
    try {
      const folders = await storage.getContractFolders();
      res.json(folders);
    } catch (err) {
      console.error("Get contract folders error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/contract-folders", isAuthenticated, async (req: any, res) => {
    try {
      const folder = await storage.createContractFolder(req.body);
      res.json(folder);
    } catch (err) {
      console.error("Create contract folder error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/contract-folders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const folder = await storage.updateContractFolder(id, req.body);
      res.json(folder);
    } catch (err) {
      console.error("Update contract folder error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/contract-folders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      await storage.deleteContractFolder(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Delete contract folder error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/contract-folders/:id/panels", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const fp = await storage.getFolderPanels(id);
      res.json(fp);
    } catch (err) {
      console.error("Get folder panels error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/contract-folders/:id/panels", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const assignments = (req.body.assignments || []).map((a: any) => ({
        panelId: Number(a.panelId),
        gridColumns: Math.min(4, Math.max(1, Number(a.gridColumns) || 1)),
      }));
      await storage.setFolderPanels(id, assignments);
      res.json({ success: true });
    } catch (err) {
      console.error("Set folder panels error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/contract-folders-with-panels", isAuthenticated, async (_req, res) => {
    try {
      const folders = await storage.getContractFolders();
      const allPanels = await storage.getPanels();
      const result = [];
      for (const folder of folders) {
        const fp = await storage.getFolderPanels(folder.id);
        const panelsWithDetails = fp.map(f => {
          const panel = allPanels.find(p => p.id === f.panelId);
          return panel ? { ...f, panelName: panel.name, panelDescription: panel.description } : null;
        }).filter(Boolean);
        result.push({ ...folder, panels: panelsWithDetails });
      }
      res.json(result);
    } catch (err) {
      console.error("Get contract folders with panels error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === PRODUCT FOLDER ASSIGNMENTS (ArutsoK 38) ===
  app.get("/api/sector-products/:id/folders", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const assignments = await storage.getProductFolderAssignments(id);
      res.json(assignments);
    } catch (err) {
      console.error("Get product folder assignments error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/sector-products/:id/folders", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const assignments = (req.body.assignments || []).map((a: any, idx: number) => ({
        folderId: Number(a.folderId),
        sortOrder: typeof a.sortOrder === "number" ? a.sortOrder : idx,
      }));
      await storage.setProductFolderAssignments(id, assignments);
      res.json({ success: true });
    } catch (err) {
      console.error("Set product folder assignments error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CONTRACT FIELD SETTINGS (ArutsoK 38) ===
  app.get("/api/contract-field-settings", isAuthenticated, async (_req, res) => {
    try {
      const settings = await storage.getContractFieldSettings();
      res.json(settings);
    } catch (err) {
      console.error("Get contract field settings error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/contract-field-settings", isAuthenticated, async (req: any, res) => {
    try {
      const { fieldKey, requiredForPfa } = req.body;
      if (!fieldKey) return res.status(400).json({ message: "fieldKey is required" });
      const setting = await storage.upsertContractFieldSetting(fieldKey, !!requiredForPfa);
      res.json(setting);
    } catch (err) {
      console.error("Upsert contract field setting error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/contract-field-settings/bulk", isAuthenticated, async (req: any, res) => {
    try {
      const { settings } = req.body;
      if (!Array.isArray(settings)) return res.status(400).json({ message: "settings array is required" });
      const results = [];
      for (const s of settings) {
        const result = await storage.upsertContractFieldSetting(s.fieldKey, !!s.requiredForPfa);
        results.push(result);
      }
      res.json(results);
    } catch (err) {
      console.error("Bulk upsert contract field settings error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CALENDAR EVENTS ===
  app.get("/api/calendar-events", isAuthenticated, async (_req, res) => {
    try {
      const events = await storage.getCalendarEvents();
      res.json(events);
    } catch (err) {
      console.error("Get calendar events error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/calendar-events/upcoming", isAuthenticated, async (req, res) => {
    try {
      const limit = Number(req.query.limit) || 5;
      const events = await storage.getUpcomingEvents(limit);
      res.json(events);
    } catch (err) {
      console.error("Get upcoming events error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/calendar-events", isAuthenticated, async (req: any, res) => {
    try {
      const data = { ...req.body };
      if (data.startDate) data.startDate = new Date(data.startDate);
      if (data.endDate) data.endDate = new Date(data.endDate);
      const created = await storage.createCalendarEvent(data);
      await logAudit(req, { action: "Vytvorenie", module: "Kalendar", entityId: created.id, entityName: created.title, newData: req.body });
      res.status(201).json(created);
    } catch (err) {
      console.error("Create calendar event error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/calendar-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const oldEvent = await storage.getCalendarEvent(id);
      const data = { ...req.body };
      if (data.startDate) data.startDate = new Date(data.startDate);
      if (data.endDate) data.endDate = new Date(data.endDate);
      const updated = await storage.updateCalendarEvent(id, data);
      await logAudit(req, { action: "Uprava", module: "Kalendar", entityId: id, entityName: updated.title, oldData: oldEvent, newData: req.body });
      res.json(updated);
    } catch (err) {
      console.error("Update calendar event error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.delete("/api/calendar-events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const oldEvent = await storage.getCalendarEvent(id);
      await storage.deleteCalendarEvent(id);
      await logAudit(req, { action: "Vymazanie", module: "Kalendar", entityId: id, entityName: oldEvent?.title });
      res.json({ success: true });
    } catch (err) {
      console.error("Delete calendar event error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === NBS REPORT STATUSES ===
  app.get("/api/nbs-reports", isAuthenticated, async (req: any, res) => {
    try {
      const year = Number(req.query.year) || new Date().getFullYear();
      let reports = await storage.getNbsReportsByYear(year);
      if (reports.length === 0) {
        const appUser = req.appUser;
        reports = await storage.initNbsReportsForYear(year, appUser?.username || "system");
      }
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.put("/api/nbs-reports/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const appUser = req.appUser;
      const updated = await storage.updateNbsReport(id, { ...req.body, updatedBy: appUser?.username || "system" });
      await logAudit(req, { action: "UPDATE", module: "NBS Reporty", entityId: id, newData: req.body });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.post("/api/nbs-reports/init/:year", isAuthenticated, async (req: any, res) => {
    try {
      const year = Number(req.params.year);
      const appUser = req.appUser;
      const reports = await storage.initNbsReportsForYear(year, appUser?.username || "system");
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  // === NBS PARTNER REPORTS ===
  app.get("/api/nbs-partner-reports", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdmin(req.appUser)) return res.status(403).json({ message: "Len admin" });
      const year = Number(req.query.year);
      const period = String(req.query.period || "");
      if (!year || !period) return res.status(400).json({ message: "year a period su povinne" });
      const reports = await db.select().from(nbsPartnerReports)
        .where(and(eq(nbsPartnerReports.year, year), eq(nbsPartnerReports.period, period)));
      res.json(reports);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/nbs-partner-reports/totals", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdmin(req.appUser)) return res.status(403).json({ message: "Len admin" });
      const year = Number(req.query.year);
      const period = String(req.query.period || "");
      if (!year || !period) return res.status(400).json({ message: "year a period su povinne" });
      const reports = await db.select().from(nbsPartnerReports)
        .where(and(eq(nbsPartnerReports.year, year), eq(nbsPartnerReports.period, period)));

      const totals: any = {
        newContracts: { life: 0, nonLife: 0, reinsurance: 0 },
        amendments: { life: 0, nonLife: 0 },
        groupContracts: { life: 0, nonLife: 0 },
        takenContracts: { life: 0, nonLife: 0 },
        premiumNew: { life: 0, nonLife: 0, reinsurance: 0 },
        premiumGroup: { life: 0, nonLife: 0 },
        premiumTaken: { life: 0, nonLife: 0 },
        cancelledNotice: { life: 0, nonLife: 0, reinsurance: 0 },
        cancelledNonPayment: { life: 0, nonLife: 0, reinsurance: 0 },
        cancelledWithdrawal: { count: 0 },
        commissionPositive: 0,
        commissionNegative: 0,
        commissionOffsetPositive: 0,
        commissionOffsetNegative: 0,
        pfaByPerformance: { zero: 0, low: 0, high: 0 },
        employeesByPerformance: { zero: 0, low: 0, high: 0 },
      };

      for (const report of reports) {
        const d = report.data as any;
        if (!d || typeof d !== "object") continue;
        for (const key of Object.keys(totals)) {
          if (typeof totals[key] === "number") {
            totals[key] += Number(d[key]) || 0;
          } else if (typeof totals[key] === "object") {
            for (const subKey of Object.keys(totals[key])) {
              totals[key][subKey] += Number(d[key]?.[subKey]) || 0;
            }
          }
        }
      }

      res.json({ totals, partnerCount: reports.length });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/nbs-chart-year-bounds", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdmin(req.appUser)) return res.status(403).json({ message: "Len admin" });
      const companyId = req.query.companyId ? Number(req.query.companyId) : null;
      const divisionId = req.query.divisionId ? Number(req.query.divisionId) : null;
      let minYear = 2000;
      if (divisionId) {
        const div = await storage.getDivision(divisionId);
        if (div?.foundedDate) {
          minYear = new Date(div.foundedDate).getFullYear();
        }
      }
      if (companyId && minYear === 2000) {
        const company = await storage.getMyCompany(companyId);
        if (company?.foundedDate) {
          minYear = new Date(company.foundedDate).getFullYear();
        }
      }
      res.json({ minYear });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/nbs-partner-reports/chart-data", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdmin(req.appUser)) return res.status(403).json({ message: "Len admin" });
      const yearsParam = String(req.query.years || "");
      const periodsParam = String(req.query.periods || "");
      if (!yearsParam || !periodsParam) return res.status(400).json({ message: "years a periods su povinne" });
      const years = yearsParam.split(",").map(Number).filter(n => !isNaN(n));
      const periods = periodsParam.split(",").filter(Boolean);
      if (!years.length || !periods.length) return res.status(400).json({ message: "Neplatne years alebo periods" });

      const result: any[] = [];
      for (const year of years) {
        for (const period of periods) {
          const reports = await db.select().from(nbsPartnerReports)
            .where(and(eq(nbsPartnerReports.year, year), eq(nbsPartnerReports.period, period)));
          const totals: any = {
            newContracts: { life: 0, nonLife: 0, reinsurance: 0 },
            amendments: { life: 0, nonLife: 0 },
            groupContracts: { life: 0, nonLife: 0 },
            takenContracts: { life: 0, nonLife: 0 },
            premiumNew: { life: 0, nonLife: 0, reinsurance: 0 },
            premiumGroup: { life: 0, nonLife: 0 },
            premiumTaken: { life: 0, nonLife: 0 },
            cancelledNotice: { life: 0, nonLife: 0, reinsurance: 0 },
            cancelledNonPayment: { life: 0, nonLife: 0, reinsurance: 0 },
            cancelledWithdrawal: { count: 0 },
            commissionPositive: 0,
            commissionNegative: 0,
            commissionOffsetPositive: 0,
            commissionOffsetNegative: 0,
            pfaByPerformance: { zero: 0, low: 0, high: 0 },
            employeesByPerformance: { zero: 0, low: 0, high: 0 },
          };
          for (const report of reports) {
            const d = report.data as any;
            if (!d || typeof d !== "object") continue;
            for (const key of Object.keys(totals)) {
              if (typeof totals[key] === "number") {
                totals[key] += Number(d[key]) || 0;
              } else if (typeof totals[key] === "object") {
                for (const subKey of Object.keys(totals[key])) {
                  totals[key][subKey] += Number(d[key]?.[subKey]) || 0;
                }
              }
            }
          }
          result.push({ year, period, totals, partnerCount: reports.length });
        }
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/nbs-partner-reports/:partnerId", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdmin(req.appUser)) return res.status(403).json({ message: "Len admin" });
      const partnerId = Number(req.params.partnerId);
      const year = Number(req.query.year);
      const period = String(req.query.period || "");
      if (!year || !period) return res.status(400).json({ message: "year a period su povinne" });
      const [report] = await db.select().from(nbsPartnerReports)
        .where(and(
          eq(nbsPartnerReports.partnerId, partnerId),
          eq(nbsPartnerReports.year, year),
          eq(nbsPartnerReports.period, period)
        )).limit(1);
      res.json(report || null);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.put("/api/nbs-partner-reports/:partnerId", isAuthenticated, async (req: any, res) => {
    try {
      if (!isAdmin(req.appUser)) return res.status(403).json({ message: "Len admin" });
      const partnerId = Number(req.params.partnerId);
      const { year, period, data } = req.body;
      if (!year || !period || !data || typeof data !== "object") return res.status(400).json({ message: "year, period a data su povinne" });
      const validPeriods = ["1q", "2q", "3q", "4q", "annual"];
      if (!validPeriods.includes(period)) return res.status(400).json({ message: "Neplatne obdobie" });
      const username = req.appUser?.username || "system";

      const [existing] = await db.select().from(nbsPartnerReports)
        .where(and(
          eq(nbsPartnerReports.partnerId, partnerId),
          eq(nbsPartnerReports.year, year),
          eq(nbsPartnerReports.period, period)
        )).limit(1);

      let result;
      if (existing) {
        [result] = await db.update(nbsPartnerReports)
          .set({ data, updatedBy: username, updatedAt: new Date() })
          .where(eq(nbsPartnerReports.id, existing.id))
          .returning();
      } else {
        [result] = await db.insert(nbsPartnerReports)
          .values({ partnerId, year, period, data, updatedBy: username })
          .returning();
      }

      await logAudit(req, { action: existing ? "UPDATE" : "CREATE", module: "NBS Partner Report", entityId: result.id, newData: { partnerId, year, period, data } });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  // === CAREER LEVELS ===
  app.get("/api/career-levels", isAuthenticated, async (_req, res) => {
    try {
      const levels = await storage.getCareerLevels();
      res.json(levels);
    } catch (err) {
      console.error("Get career levels error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/career-levels", isAuthenticated, async (req: any, res) => {
    try {
      if (!["admin", "superadmin", "prezident"].includes(req.appUser?.role)) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const parsed = insertCareerLevelSchema.parse(req.body);
      const level = await storage.createCareerLevel(parsed);
      await logAudit(req, { action: "Vytvorenie", module: "Karierne urovne", entityId: level.id, entityName: level.positionCode });
      res.json(level);
    } catch (err: any) {
      console.error("Create career level error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/career-levels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const parsed = insertCareerLevelSchema.partial().parse(req.body);
      const level = await storage.updateCareerLevel(id, parsed);
      await logAudit(req, { action: "Uprava", module: "Karierne urovne", entityId: id, entityName: level.positionCode });
      res.json(level);
    } catch (err: any) {
      console.error("Update career level error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/career-levels/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!["admin", "superadmin", "prezident"].includes(req.appUser?.role)) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const id = Number(req.params.id);
      await storage.deleteCareerLevel(id);
      await logAudit(req, { action: "Vymazanie", module: "Karierne urovne", entityId: id });
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete career level error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // === PRODUCT POINT RATES ===
  app.get("/api/product-point-rates", isAuthenticated, async (_req, res) => {
    try {
      const rates = await storage.getProductPointRates();
      res.json(rates);
    } catch (err) {
      console.error("Get product point rates error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/product-point-rates", isAuthenticated, async (req: any, res) => {
    try {
      if (!["admin", "superadmin", "prezident"].includes(req.appUser?.role)) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const parsed = insertProductPointRateSchema.parse(req.body);
      const rate = await storage.createProductPointRate(parsed);
      await logAudit(req, { action: "Vytvorenie", module: "Bodove sadzby", entityId: rate.id, entityName: rate.partnerName || rate.productName });
      res.json(rate);
    } catch (err: any) {
      console.error("Create product point rate error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.put("/api/product-point-rates/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!["admin", "superadmin", "prezident"].includes(req.appUser?.role)) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const id = Number(req.params.id);
      const parsed = insertProductPointRateSchema.partial().parse(req.body);
      const rate = await storage.updateProductPointRate(id, parsed);
      await logAudit(req, { action: "Uprava", module: "Bodove sadzby", entityId: id, entityName: rate.partnerName || rate.productName });
      res.json(rate);
    } catch (err: any) {
      console.error("Update product point rate error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/product-point-rates/:id", isAuthenticated, async (req: any, res) => {
    try {
      if (!["admin", "superadmin", "prezident"].includes(req.appUser?.role)) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const id = Number(req.params.id);
      await storage.deleteProductPointRate(id);
      await logAudit(req, { action: "Vymazanie", module: "Bodove sadzby", entityId: id });
      res.json({ success: true });
    } catch (err: any) {
      console.error("Delete product point rate error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/sync-permission-groups-to-client-groups", isAuthenticated, async (req: any, res) => {
    try {
      if (req.appUser?.role !== "admin" && req.appUser?.role !== "superadmin") {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const allPgs = await storage.getPermissionGroups();
      let created = 0;
      for (const pg of allPgs) {
        const existing = await storage.getClientGroupByPermissionGroupId(pg.id);
        if (!existing) {
          await storage.createClientGroup({ name: pg.name, permissionGroupId: pg.id });
          created++;
        }
      }
      if (created > 0) {
        await logAudit(req, { action: "SYNC", module: "skupiny_klientov", entityName: `Synchronizovanych: ${created} skupin` });
      }
      res.json({ success: true, created });
    } catch (err: any) {
      console.error("Sync permission groups error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/run-undelivered-check", isAuthenticated, async (req: any, res) => {
    try {
      if (req.appUser?.role !== "admin" && req.appUser?.role !== "superadmin") {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const count = await storage.autoMoveUndeliveredContracts();
      await logAudit(req, { action: "Manualne spustenie", module: "CRON - Nedorucene zmluvy", entityName: `Presunutych: ${count}` });
      res.json({ success: true, movedCount: count });
    } catch (err: any) {
      console.error("Manual undelivered check error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // === BULK IMPORT (Hromadný import) ===

  app.get("/api/bulk-import/template", isAuthenticated, async (req: any, res) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Import zmlúv");
      sheet.columns = [
        { header: "Číslo zmluvy", key: "contractNumber", width: 20 },
        { header: "Stav zmluvy", key: "status", width: 20 },
        { header: "Sprostredkovateľ", key: "agent", width: 25 },
        { header: "Suma provízie", key: "commission", width: 18 },
        { header: "Poznámka", key: "note", width: 30 },
      ];
      const headerRow = sheet.getRow(1);
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3748" } };
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

      sheet.addRow({ contractNumber: "1001", status: "Aktívna", agent: "Ján Novák", commission: 150.50, note: "Príklad" });
      sheet.addRow({ contractNumber: "1002", status: "Čaká na schválenie", agent: "Peter Horváth", commission: 200, note: "" });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=sablona_import_stavov.xlsx");
      await workbook.xlsx.write(res);
      res.end();
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri generovaní šablóny" });
    }
  });

  app.get("/api/import-contracts-template", isAuthenticated, async (req: any, res) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Import zmlúv");
      sheet.columns = [
        { header: "A: Partner", key: "partner", width: 22 },
        { header: "B: Produkt", key: "produkt", width: 22 },
        { header: "C: Typ zmluvy", key: "typ_zmluvy", width: 20 },
        { header: "D: Číslo návrhu", key: "cislo_navrhu", width: 18 },
        { header: "E: Číslo zmluvy", key: "cislo_zmluvy", width: 18 },
        { header: "F: Typ subjektu", key: "typ_subjektu", width: 18 },
        { header: "G: RČ / IČO", key: "rc_ico", width: 18 },
        { header: "H: Názov firmy", key: "nazov_firmy", width: 24 },
        { header: "I: Titul pred", key: "titul_pred", width: 14 },
        { header: "J: Meno", key: "meno", width: 18 },
        { header: "K: Priezvisko", key: "priezvisko", width: 18 },
        { header: "L: Titul za", key: "titul_za", width: 14 },
        { header: "M: Špecialista UID", key: "specialista_uid", width: 22 },
        { header: "N: Špecialista %", key: "specialista_pct", width: 16 },
        { header: "O: Odporúčateľ 1 UID", key: "odporucitel1_uid", width: 22 },
        { header: "P: Odporúčateľ 1 %", key: "odporucitel1_pct", width: 18 },
        { header: "Q: Odporúčateľ 2 UID", key: "odporucitel2_uid", width: 22 },
        { header: "R: Odporúčateľ 2 %", key: "odporucitel2_pct", width: 18 },
      ];

      const headerRow = sheet.getRow(1);
      headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2D3748" } };
      headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

      for (let i = 1; i <= 18; i++) {
        const cell = headerRow.getCell(i);
        if ([1, 2, 3, 6, 13, 14].includes(i)) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF991B1B" } };
          cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        }
      }

      const exampleRows = [
        {
          partner: "Allianz", produkt: "PZP Auto", cislo_navrhu: "N-2024-001", cislo_zmluvy: "",
          typ_subjektu: "person", rc_ico: "850101/1234", nazov_firmy: "", titul_pred: "Ing.",
          meno: "Ján", priezvisko: "Novák", titul_za: "",
          specialista_uid: "421000000001", specialista_pct: "100",
          odporucitel1_uid: "", odporucitel1_pct: "", odporucitel2_uid: "", odporucitel2_pct: "",
          typ_zmluvy: "Nova",
        },
        {
          partner: "Generali", produkt: "Životné poistenie", cislo_navrhu: "N-2024-002", cislo_zmluvy: "",
          typ_subjektu: "szco", rc_ico: "900515/4567", nazov_firmy: "Peter Horváth - stolárstvo", titul_pred: "",
          meno: "Peter", priezvisko: "Horváth", titul_za: "",
          specialista_uid: "421000000002", specialista_pct: "70",
          odporucitel1_uid: "421000000003", odporucitel1_pct: "30", odporucitel2_uid: "", odporucitel2_pct: "",
          typ_zmluvy: "Prestupova",
        },
        {
          partner: "ČSOB", produkt: "Podnikateľské poistenie", cislo_navrhu: "", cislo_zmluvy: "Z-2024-050",
          typ_subjektu: "company", rc_ico: "12345678", nazov_firmy: "ABC Trading s.r.o.", titul_pred: "",
          meno: "", priezvisko: "", titul_za: "",
          specialista_uid: "421000000001", specialista_pct: "80",
          odporucitel1_uid: "421000000004", odporucitel1_pct: "20", odporucitel2_uid: "", odporucitel2_pct: "",
          typ_zmluvy: "Zmenova",
        },
        {
          partner: "Uniqa", produkt: "Poistenie zodpovednosti", cislo_navrhu: "N-2024-003", cislo_zmluvy: "",
          typ_subjektu: "organization", rc_ico: "31234567", nazov_firmy: "Nadácia Dobré srdce", titul_pred: "",
          meno: "", priezvisko: "", titul_za: "",
          specialista_uid: "421000000002", specialista_pct: "100",
          odporucitel1_uid: "", odporucitel1_pct: "", odporucitel2_uid: "", odporucitel2_pct: "",
          typ_zmluvy: "Nova",
        },
      ];

      const yellowFill: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
      const yellowFont: Partial<ExcelJS.Font> = { italic: true, color: { argb: "FF6B5B00" } };

      for (const rowData of exampleRows) {
        const exRow = sheet.addRow(rowData);
        exRow.font = yellowFont;
        for (let c = 1; c <= 18; c++) {
          exRow.getCell(c).fill = yellowFill;
        }
      }

      sheet.views = [{ state: "frozen", ySplit: 5, xSplit: 0 }];

      sheet.protect("", {
        selectLockedCells: true,
        selectUnlockedCells: true,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: true,
        insertHyperlinks: false,
        deleteColumns: false,
        deleteRows: false,
        sort: false,
        autoFilter: false,
      });

      for (let r = 1; r <= 5; r++) {
        const row = sheet.getRow(r);
        for (let c = 1; c <= 18; c++) {
          row.getCell(c).protection = { locked: true };
        }
      }

      sheet.getColumn(3).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
        if (rowNumber >= 6) {
          cell.dataValidation = {
            type: "list",
            allowBlank: true,
            formulae: ['"Nova,Prestupova,Zmenova"'],
            showErrorMessage: true,
            errorTitle: "Neplatný typ zmluvy",
            error: "Zadajte: Nova, Prestupova alebo Zmenova",
          };
        }
      });

      for (let r = 6; r <= 1100; r++) {
        const row = sheet.getRow(r);
        for (let c = 1; c <= 18; c++) {
          row.getCell(c).protection = { locked: false };
        }
        row.getCell(3).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: ['"Nova,Prestupova,Zmenova"'],
          showErrorMessage: true,
          errorTitle: "Neplatný typ zmluvy",
          error: "Zadajte: Nova, Prestupova alebo Zmenova",
        };
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=sablona_import_zmluv.xlsx");
      await workbook.xlsx.write(res);
      res.end();
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri generovaní šablóny" });
    }
  });

  app.post("/api/bulk-import/parse", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Žiadny súbor nebol nahraný" });
      const secScan = await scanUploadedFile(file.path, file.originalname, file.mimetype);
      if (!secScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: ${secScan.reason}` });

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      sanitizeExcelWorkbook(workbook);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) return res.status(400).json({ message: "Excel súbor neobsahuje žiadny hárok" });

      const headers: string[] = [];
      const firstRow = worksheet.getRow(1);
      firstRow.eachCell((cell, colNumber) => {
        headers.push(String(cell.value || `Stĺpec ${colNumber}`));
      });

      const sampleRows: Record<string, any>[] = [];
      for (let i = 2; i <= Math.min(worksheet.rowCount, 6); i++) {
        const row = worksheet.getRow(i);
        const rowData: Record<string, any> = {};
        headers.forEach((header, idx) => {
          const cell = row.getCell(idx + 1);
          rowData[header] = cell.value !== null && cell.value !== undefined ? String(cell.value) : "";
        });
        sampleRows.push(rowData);
      }

      const allRows: Record<string, any>[] = [];
      for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        const hasData = headers.some((_, idx) => {
          const v = row.getCell(idx + 1).value;
          return v !== null && v !== undefined && String(v).trim() !== "";
        });
        if (!hasData) continue;
        const rowData: Record<string, any> = {};
        headers.forEach((header, idx) => {
          const cell = row.getCell(idx + 1);
          rowData[header] = cell.value !== null && cell.value !== undefined ? String(cell.value) : "";
        });
        allRows.push(rowData);
      }

      res.json({
        headers,
        sampleRows,
        allRows,
        totalRows: allRows.length,
        fileName: file.originalname,
        filePath: file.path,
      });
    } catch (err: any) {
      console.error("Bulk import parse error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bulk-import/validate", isAuthenticated, async (req: any, res) => {
    try {
      const { rows, mapping } = req.body;
      if (!rows || !mapping) return res.status(400).json({ message: "Chýbajú dáta alebo mapovanie" });

      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Používateľ nenájdený" });

      const companyId = appUser.activeCompanyId;
      const allStatuses = await storage.getContractStatuses();
      const allContracts = await storage.getContracts(companyId ? { companyId } : undefined);
      const allUsers = await storage.getAppUsers();

      const allSubjects = await db.select({
        id: subjects.id, uid: subjects.uid, type: subjects.type,
        firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName
      }).from(subjects).where(isNull(subjects.deletedAt));
      const subjectMapById = new Map(allSubjects.map(s => [s.id, s]));
      const subjectMapByUid = new Map(allSubjects.filter(s => s.uid).map(s => [s.uid!, s]));

      const results: any[] = [];
      let totalCommission = 0;
      let errorCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const result: any = {
          rowIndex: i,
          originalData: row,
          errors: [],
          warnings: [],
          contractId: null,
          statusId: null,
          agentId: null,
          commissionAmount: 0,
          subjectName: null,
          subjectType: null,
          specialistaStr: null,
          odporucitelStr: null,
        };

        const contractNumber = mapping.contractNumber ? String(row[mapping.contractNumber] || "").trim() : "";
        const statusName = mapping.status ? String(row[mapping.status] || "").trim() : "";
        const agentName = mapping.agent ? String(row[mapping.agent] || "").trim() : "";
        const commissionStr = mapping.commission ? String(row[mapping.commission] || "").trim() : "";
        const noteText = mapping.note ? String(row[mapping.note] || "").trim() : "";
        const specialistaRaw = mapping.specialista ? String(row[mapping.specialista] || "").trim() : "";
        const odporucitelRaw = mapping.odporucitel ? String(row[mapping.odporucitel] || "").trim() : "";

        result.contractNumber = contractNumber;
        result.statusName = statusName;
        result.agentName = agentName;
        result.commissionStr = commissionStr;
        result.note = noteText;
        if (specialistaRaw) result.specialistaStr = specialistaRaw;
        if (odporucitelRaw) result.odporucitelStr = odporucitelRaw;

        if (contractNumber) {
          const contract = allContracts.find(c =>
            c.contractNumber === contractNumber ||
            c.proposalNumber === contractNumber ||
            c.kik === contractNumber
          );
          if (contract) {
            result.contractId = contract.id;
            result.currentStatusId = contract.statusId;
            if ((contract as any).subjectId) {
              const subj = subjectMapById.get((contract as any).subjectId);
              if (subj) {
                result.subjectName = subj.type === "person" || subj.type === "szco"
                  ? `${subj.firstName || ""} ${subj.lastName || ""}`.trim()
                  : subj.companyName || "";
                result.subjectType = subj.type;
              }
            }
            if (!specialistaRaw && (contract as any).specialistaUid) {
              result.specialistaStr = (contract as any).specialistaUid;
            }
          } else {
            result.errors.push(`Zmluva "${contractNumber}" nenájdená`);
          }
        } else if (mapping.contractNumber) {
          result.errors.push("Chýba číslo zmluvy");
        }

        if (specialistaRaw) {
          const specSubj = subjectMapByUid.get(specialistaRaw);
          if (!specSubj) result.warnings.push(`Špecialist UID "${specialistaRaw}" nenájdený`);
        }
        if (odporucitelRaw) {
          const odpSubj = subjectMapByUid.get(odporucitelRaw);
          if (!odpSubj) result.warnings.push(`Odporúčateľ UID "${odporucitelRaw}" nenájdený`);
        }

        if (statusName) {
          const normalizedInput = statusName.toLowerCase().trim();
          const status = allStatuses.find(s => s.name.toLowerCase().trim() === normalizedInput);
          if (status) {
            result.statusId = status.id;
            result.statusColor = status.color;
            result.definesContractEnd = status.definesContractEnd;
          } else {
            result.errors.push(`Stav "${statusName}" nenájdený v číselníku`);
          }
        }

        if (commissionStr) {
          const parsed = parseFloat(commissionStr.replace(",", ".").replace(/[^0-9.\-]/g, ""));
          if (!isNaN(parsed)) {
            result.commissionAmount = parsed;
            totalCommission += parsed;
          } else {
            result.warnings.push(`Neplatná suma provízie: "${commissionStr}"`);
          }
        }

        if (agentName) {
          const normalizedAgent = agentName.toLowerCase().trim();
          const agent = allUsers.find(u => {
            const fullName = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase().trim();
            const reverseName = `${u.lastName || ""} ${u.firstName || ""}`.toLowerCase().trim();
            return fullName === normalizedAgent || reverseName === normalizedAgent ||
              (u.username || "").toLowerCase() === normalizedAgent;
          });
          if (agent) {
            result.agentId = agent.id;
          } else {
            result.warnings.push(`Sprostredkovateľ "${agentName}" nenájdený`);
          }
        }

        if (result.errors.length > 0) errorCount++;
        results.push(result);
      }

      res.json({
        results,
        totalRows: rows.length,
        errorCount,
        warningCount: results.filter(r => r.warnings.length > 0 && r.errors.length === 0).length,
        successCount: results.filter(r => r.errors.length === 0).length,
        totalCommission,
      });
    } catch (err: any) {
      console.error("Bulk import validate error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/bulk-import/execute", isAuthenticated, async (req: any, res) => {
    try {
      const { rows, mapping, fileName } = req.body;
      if (!rows || !mapping) return res.status(400).json({ message: "Chýbajú dáta alebo mapovanie" });

      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Používateľ nenájdený" });

      const companyId = appUser.activeCompanyId;
      const allStatuses = await storage.getContractStatuses();
      const allContracts = await storage.getContracts(companyId ? { companyId } : undefined);
      const allUsers = await storage.getAppUsers();

      const revalidated: any[] = [];
      for (const row of rows) {
        const result: any = { originalData: row, errors: [], contractId: null, statusId: null, agentId: null, commissionAmount: 0, currentStatusId: null, note: "", specialistaStr: null, odporucitelStr: null };

        const contractNumber = mapping.contractNumber ? String(row[mapping.contractNumber] || "").trim() : "";
        const statusName = mapping.status ? String(row[mapping.status] || "").trim() : "";
        const agentName = mapping.agent ? String(row[mapping.agent] || "").trim() : "";
        const commissionStr = mapping.commission ? String(row[mapping.commission] || "").trim() : "";
        const specialistaRaw = mapping.specialista ? String(row[mapping.specialista] || "").trim() : "";
        const odporucitelRaw = mapping.odporucitel ? String(row[mapping.odporucitel] || "").trim() : "";
        result.note = mapping.note ? String(row[mapping.note] || "").trim() : "";
        result.contractNumber = contractNumber;
        result.statusName = statusName;
        if (specialistaRaw) result.specialistaStr = specialistaRaw;
        if (odporucitelRaw) result.odporucitelStr = odporucitelRaw;

        if (contractNumber) {
          const contract = allContracts.find(c =>
            c.contractNumber === contractNumber ||
            c.proposalNumber === contractNumber ||
            c.kik === contractNumber
          );
          if (contract) {
            result.contractId = contract.id;
            result.currentStatusId = contract.statusId;
          } else {
            result.errors.push(`Zmluva "${contractNumber}" nenájdená`);
          }
        } else if (mapping.contractNumber) {
          result.errors.push("Chýba číslo zmluvy");
        }

        if (statusName) {
          const status = allStatuses.find(s => s.name.toLowerCase().trim() === statusName.toLowerCase().trim());
          if (status) {
            result.statusId = status.id;
            result.definesContractEnd = status.definesContractEnd;
          } else {
            result.errors.push(`Stav "${statusName}" nenájdený`);
          }
        }

        if (commissionStr) {
          const parsed = parseFloat(commissionStr.replace(",", ".").replace(/[^0-9.\-]/g, ""));
          if (!isNaN(parsed)) result.commissionAmount = parsed;
        }

        if (agentName) {
          const normalizedAgent = agentName.toLowerCase().trim();
          const agent = allUsers.find(u => {
            const fullName = `${u.firstName || ""} ${u.lastName || ""}`.toLowerCase().trim();
            const reverseName = `${u.lastName || ""} ${u.firstName || ""}`.toLowerCase().trim();
            return fullName === normalizedAgent || reverseName === normalizedAgent ||
              (u.username || "").toLowerCase() === normalizedAgent;
          });
          if (agent) result.agentId = agent.id;
        }

        revalidated.push(result);
      }

      const validRows = revalidated.filter(r => r.errors.length === 0 && r.contractId && r.statusId);
      const errorRows = revalidated.filter(r => r.errors.length > 0);

      if (validRows.length === 0) {
        return res.status(400).json({ message: "Žiadny platný riadok na import", errorCount: errorRows.length });
      }

      let successCount = 0;
      let errorCount = errorRows.length;
      let totalCommission = 0;
      let importLogId: number | null = null;

      await db.transaction(async (tx) => {
        const [importLog] = await tx.insert(importLogs).values({
          fileName: fileName || "import.xlsx",
          userId: appUser.id,
          companyId: companyId || null,
          rawData: rows,
          mappingConfig: mapping,
          totalRows: rows.length,
          status: "completed",
        }).returning();
        importLogId = importLog.id;

        for (const row of validRows) {
          const existingLogs = await tx.select().from(contractStatusChangeLogs)
            .where(eq(contractStatusChangeLogs.contractId, row.contractId));
          const sameStatusCount = existingLogs.filter(l => l.newStatusId === row.statusId).length;

          await tx.insert(contractStatusChangeLogs).values({
            contractId: row.contractId,
            oldStatusId: row.currentStatusId || null,
            newStatusId: row.statusId,
            changedByUserId: appUser.id,
            changedAt: new Date(),
            statusIteration: sameStatusCount + 1,
            statusNote: row.note || null,
            importId: importLog.id,
          });

          const statusDef = allStatuses.find(s => s.id === row.statusId);
          const contractUpdate: any = {
            statusId: row.statusId,
            lastStatusUpdate: new Date(),
          };
          if (statusDef?.definesContractEnd) {
            contractUpdate.expiryDate = new Date();
          } else {
            contractUpdate.expiryDate = null;
          }
          if (row.specialistaStr) contractUpdate.specialistaUid = row.specialistaStr;
          await tx.update(contracts)
            .set(contractUpdate)
            .where(eq(contracts.id, row.contractId));

          if (row.commissionAmount && row.commissionAmount !== 0) {
            await tx.insert(commissions).values({
              contractId: row.contractId,
              importId: importLog.id,
              amount: String(row.commissionAmount),
              currency: "EUR",
              agentId: row.agentId || appUser.id,
              note: row.note || null,
              status: "predbezna",
              creditDate: new Date(),
            });
            totalCommission += row.commissionAmount;
          }

          successCount++;
        }

        await tx.update(importLogs)
          .set({
            successCount,
            errorCount,
            totalCommission: String(totalCommission),
          })
          .where(eq(importLogs.id, importLog.id));
      });

      await logAudit(req, {
        action: "BULK_IMPORT",
        module: "hromadny-import",
        entityId: importLogId,
        entityName: fileName || "import.xlsx",
        newData: { successCount, errorCount, totalCommission, totalRows: rows.length },
      });

      res.json({
        importId: importLogId,
        successCount,
        errorCount,
        totalCommission,
      });
    } catch (err: any) {
      console.error("Bulk import execute error:", err);
      res.status(500).json({ message: `Import zlyhal: ${err.message}. Žiadne dáta neboli zapísané.` });
    }
  });

  app.get("/api/bulk-import/logs", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Používateľ nenájdený" });
      const logs = await storage.getImportLogs(appUser.activeCompanyId || undefined);
      const users = await storage.getAppUsers();
      const enriched = logs.map(log => ({
        ...log,
        userName: (() => {
          const u = users.find(u => u.id === log.userId);
          return u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username : "Neznámy";
        })(),
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/bulk-import/logs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const log = await storage.getImportLog(id);
      if (!log) return res.status(404).json({ message: "Import nenájdený" });
      const importCommissions = await storage.getCommissionsByImport(id);
      const users = await storage.getAppUsers();
      const user = users.find(u => u.id === log.userId);
      res.json({
        ...log,
        userName: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username : "Neznámy",
        commissions: importCommissions,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === CLIENT DATA TABS & CATEGORIES ===
  app.get("/api/client-data-tabs", isAuthenticated, async (_req: any, res) => {
    try {
      const tabs = await storage.getClientDataTabs();
      res.json(tabs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/client-data-categories", isAuthenticated, async (req: any, res) => {
    try {
      const tabId = req.query.tabId ? Number(req.query.tabId) : undefined;
      const categories = await storage.getClientDataCategories(tabId);
      res.json(categories);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === UNCLASSIFIED DATA TRENDS ===
  app.get("/api/data-trends/unclassified", isAuthenticated, async (_req: any, res) => {
    try {
      const allSubjects = await storage.getSubjects();
      const fieldCounts: Record<string, number> = {};
      const knownStaticKeys = new Set([
        "firstName", "lastName", "companyName", "email", "phone", "birthNumber",
        "idCardNumber", "iban", "swift", "type", "uid", "details", "createdAt",
        "deletedAt", "isActive", "listStatus", "bonitaPoints", "cgnRating",
        "meno", "priezvisko", "telefon", "rodne_cislo", "cislo_dokladu", "bic",
        "nazov_organizacie", "ico", "titul_pred", "titul_za", "datum_narodenia",
        "vek", "pohlavie", "miesto_narodenia", "statna_prislusnost",
      ]);

      for (const subj of allSubjects) {
        const details = (subj.details || {}) as Record<string, any>;
        const dynFields = details.dynamicFields || {};
        for (const key of Object.keys(dynFields)) {
          if (!knownStaticKeys.has(key) && dynFields[key]) {
            fieldCounts[key] = (fieldCounts[key] || 0) + 1;
          }
        }
      }

      const trends = Object.entries(fieldCounts)
        .filter(([_, count]) => count >= 20)
        .map(([fieldKey, count]) => ({ fieldKey, count, isTrend: true }))
        .sort((a, b) => b.count - a.count);

      const allUnclassified = Object.entries(fieldCounts)
        .map(([fieldKey, count]) => ({ fieldKey, count, isTrend: count >= 20 }))
        .sort((a, b) => b.count - a.count);

      res.json({ trends, allUnclassified, totalSubjects: allSubjects.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === CLIENT MARKETING CONSENTS ===
  app.get("/api/subjects/:id/marketing-consents", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
      const consents = await storage.getClientMarketingConsents(subjectId, companyId);
      res.json(consents);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/marketing-consents", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const { companyId, consentType, isGranted, note } = req.body;
      if (!companyId) return res.status(400).json({ message: "companyId je povinné" });
      const consent = await storage.upsertClientMarketingConsent({
        subjectId,
        companyId,
        consentType: consentType || "marketing",
        isGranted: isGranted ?? false,
        note: note || null,
      });
      await logAudit(req, { action: "UPDATE", module: "marketing-consents", entityId: subjectId, entityName: `Súhlas: ${consentType || "marketing"}`, newData: consent });
      res.json(consent);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === SUBJECT UPDATE (generic field update for edit mode and inline edits) ===
  const ALLOWED_SUBJECT_FIELDS = new Set([
    "firstName", "lastName", "companyName", "email", "phone",
    "birthNumber", "idCardNumber", "iban", "swift",
    "continentId", "stateId", "myCompanyId", "type",
    "lifecycleStatus", "deathDate", "deathCertificateNumber", "isDeceased",
  ]);

  app.patch("/api/subjects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID subjektu" });

      const existing = await storage.getSubject(subjectId);
      if (!existing) return res.status(404).json({ message: "Subjekt nenájdený" });

      const userCompanyId = req.appUser?.activeCompanyId;
      if (userCompanyId && existing.myCompanyId != null && Number(existing.myCompanyId) !== Number(userCompanyId)) {
        return res.status(403).json({ message: "Subjekt nepatrí do vašej aktívnej spoločnosti" });
      }

      if (!isAdmin(req.appUser)) {
        const accessible = await isSubjectAccessible(req.appUser, existing);
        if (!accessible) {
          return res.status(403).json({ message: "Nemáte oprávnenie upravovať tento subjekt" });
        }
      }

      const { changeReason, changeContext, details, ...rawFields } = req.body;

      const updates: Record<string, any> = {};
      for (const [key, val] of Object.entries(rawFields)) {
        if (ALLOWED_SUBJECT_FIELDS.has(key)) updates[key] = val;
      }

      if (details && typeof details === "object") {
        const existingDetails = (existing.details || {}) as Record<string, any>;
        const existingDynamic = existingDetails.dynamicFields || {};
        const incomingDynamic = details.dynamicFields || {};
        const { dynamicFields: _df, ...otherIncoming } = details;
        updates.details = {
          ...existingDetails,
          ...otherIncoming,
          dynamicFields: { ...existingDynamic, ...incomingDynamic },
        };
      }

      const patchIco = (updates.details as any)?.ico || (updates.details as any)?.dynamicFields?.ico || (updates.details as any)?.dynamicFields?.zi_ico;
      if (patchIco && (existing.type === "company" || existing.type === "szco" || existing.type === "organization")) {
        const icoResult = validateSlovakICO(patchIco);
        if (!icoResult.valid) {
          return res.status(400).json({ message: `Neplatné IČO: ${icoResult.error}` });
        }
        if (icoResult.normalized && updates.details && typeof updates.details === 'object') {
          if ((updates.details as any).ico) (updates.details as any).ico = icoResult.normalized;
          if ((updates.details as any)?.dynamicFields?.ico) (updates.details as any).dynamicFields.ico = icoResult.normalized;
          if ((updates.details as any)?.dynamicFields?.zi_ico) (updates.details as any).dynamicFields.zi_ico = icoResult.normalized;
        }
      }

      if (changeReason) updates.changeReason = changeReason;

      const appUser = req.appUser;
      const userName = appUser ? [appUser.firstName, appUser.lastName].filter(Boolean).join(' ') || appUser.email || 'Neznámy' : undefined;
      const userId = appUser?.id;

      if (updates.lifecycleStatus === "in_memoriam" && existing.lifecycleStatus !== "in_memoriam") {
        updates.isDeceased = true;
        updates.isActive = false;
        try {
          await db.update(clientMarketingConsents)
            .set({ isGranted: false, revokedAt: new Date(), note: "Automaticky zrušené - In Memoriam" })
            .where(and(
              eq(clientMarketingConsents.subjectId, subjectId),
              eq(clientMarketingConsents.isGranted, true)
            ));
        } catch (e) {}
        const existDet = (updates.details || existing.details || {}) as Record<string, any>;
        const existDyn = existDet.dynamicFields || {};
        updates.details = {
          ...existDet,
          dynamicFields: {
            ...existDyn,
            pravna_sposobilost: "Nie",
          },
        };
      }

      if (updates.lifecycleStatus === "active" && existing.lifecycleStatus === "in_memoriam") {
        updates.isDeceased = false;
      }

      // === DÔKAZNÝ MATERIÁL: Auto-generate evidence for zaniknutá/v_likvidácii (PO/SZČO only) ===
      const isCompanyType = existing.type === "company" || existing.type === "szco";
      const isTerminationStatus = updates.lifecycleStatus === "zaniknuta" || updates.lifecycleStatus === "v_likvidacii";
      const statusChanged = updates.lifecycleStatus && updates.lifecycleStatus !== existing.lifecycleStatus;
      let evidenceCreated: any = null;

      if (isCompanyType && isTerminationStatus && statusChanged) {
        updates.isActive = false;
        const registryType: "orsr" | "zrsr" = existing.type === "company" ? "orsr" : "zrsr";
        const registryName = registryType === "orsr" ? "Obchodný register SR (ORSR)" : "Živnostenský register SR (ŽRSR)";
        const evidenceChangeReason = `Status overený z ${registryName}. Zmenu statusu overil a zdokumentoval: ArutsoK`;
        if (!updates.changeReason) updates.changeReason = evidenceChangeReason;
      }

      const updated = await storage.updateSubject(subjectId, updates, userId, userName, changeContext);

      // Create evidence record AFTER the update (to link to field history)
      if (isCompanyType && isTerminationStatus && statusChanged) {
        try {
          const registryType: "orsr" | "zrsr" = existing.type === "company" ? "orsr" : "zrsr";
          const registryName = registryType === "orsr" ? "Obchodný register SR (ORSR)" : "Živnostenský register SR (ŽRSR)";
          const registryUrl = registryType === "orsr" ? "https://www.orsr.sk" : "https://www.zrsr.sk";
          const statusLabel = updates.lifecycleStatus === "zaniknuta" ? "Zaniknutá" : "V likvidácii";
          const subjectName = existing.companyName || [existing.firstName, existing.lastName].filter(Boolean).join(" ") || "Neznámy subjekt";
          const captureTime = new Date().toISOString();

          // Find the field history entry for this change
          const [historyEntry] = await db.select()
            .from(subjectFieldHistory)
            .where(and(
              eq(subjectFieldHistory.subjectId, subjectId),
              eq(subjectFieldHistory.fieldKey, "lifecycle_status")
            ))
            .orderBy(desc(subjectFieldHistory.changedAt))
            .limit(1);

          const evidenceHtml = `
<div style="font-family: 'Segoe UI', sans-serif; background: #0a0e17; color: #e0e0e0; padding: 32px; border: 2px solid #374151; border-radius: 8px; max-width: 720px;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid #374151;">
    <div>
      <h2 style="margin: 0; color: #f59e0b; font-size: 18px;">📸 Dôkazný materiál – ${registryName}</h2>
      <p style="margin: 4px 0 0; color: #9ca3af; font-size: 12px;">Automatický záznam z overenia statusu</p>
    </div>
    <div style="text-align: right;">
      <span style="background: #7c3aed; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600;">ArutsoK v1.0</span>
    </div>
  </div>
  <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
    <tr><td style="padding: 8px 12px; color: #9ca3af; width: 180px;">Subjekt:</td><td style="padding: 8px 12px; font-weight: 600;">${subjectName}</td></tr>
    <tr><td style="padding: 8px 12px; color: #9ca3af;">IČO:</td><td style="padding: 8px 12px;">${(existing as any).ico || (existing as any).birthNumber || "–"}</td></tr>
    <tr><td style="padding: 8px 12px; color: #9ca3af;">Register:</td><td style="padding: 8px 12px;">${registryName}</td></tr>
    <tr><td style="padding: 8px 12px; color: #9ca3af;">URL registra:</td><td style="padding: 8px 12px;"><a href="${registryUrl}" style="color: #60a5fa;">${registryUrl}</a></td></tr>
    <tr style="background: ${updates.lifecycleStatus === "zaniknuta" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)"};">
      <td style="padding: 8px 12px; color: #9ca3af;">Zistený status:</td>
      <td style="padding: 8px 12px; font-weight: 700; color: ${updates.lifecycleStatus === "zaniknuta" ? "#ef4444" : "#f59e0b"};">🚫 ${statusLabel}</td>
    </tr>
    <tr><td style="padding: 8px 12px; color: #9ca3af;">Dátum overenia:</td><td style="padding: 8px 12px;">${formatDateTimeSK()}</td></tr>
  </table>
  <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #374151; display: flex; justify-content: space-between; align-items: center;">
    <p style="margin: 0; font-size: 11px; color: #6b7280;">Zmenu statusu overil a zdokumentoval: <strong style="color: #a78bfa;">ArutsoK</strong></p>
    <p style="margin: 0; font-size: 10px; color: #4b5563;">ID: ${existing.uid || subjectId}</p>
  </div>
</div>`.trim();

          const [evidence] = await db.insert(statusEvidence).values({
            subjectId,
            lifecycleStatus: updates.lifecycleStatus!,
            registryType,
            evidenceHtml,
            verifiedByName: "ArutsoK",
            fieldHistoryId: historyEntry?.id || null,
            metadata: {
              subjectName,
              ico: (existing as any).ico || undefined,
              registryUrl,
              statusFound: statusLabel,
              captureTimestamp: captureTime,
            },
          }).returning();
          evidenceCreated = evidence;
        } catch (e) {
          console.error("[STATUS EVIDENCE] Error creating evidence:", e);
        }
      }

      const SENSITIVE_AUDIT_FIELDS = ['birthNumber', 'idCardNumber', 'iban', 'email', 'phone'];
      const sensitiveChanges: Record<string, { old: any; new: any }> = {};
      for (const field of SENSITIVE_AUDIT_FIELDS) {
        if (updates[field] !== undefined && String((existing as any)[field] ?? '') !== String(updates[field] ?? '')) {
          sensitiveChanges[field] = { old: (existing as any)[field], new: updates[field] };
        }
      }

      await logAudit(req, {
        action: "UPDATE",
        module: "subjects",
        entityId: subjectId,
        entityName: existing.uid || `Subject ${subjectId}`,
        oldData: existing,
        newData: updated,
      });

      if (Object.keys(sensitiveChanges).length > 0) {
        logAudit(req, {
          action: "sensitive_field_change",
          module: "subjects",
          entityId: subjectId,
          entityName: existing.uid || `Subject ${subjectId}`,
          oldData: Object.fromEntries(Object.entries(sensitiveChanges).map(([k, v]) => [k, v.old])),
          newData: Object.fromEntries(Object.entries(sensitiveChanges).map(([k, v]) => [k, v.new])),
        }).catch(() => {});
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === SUBJECT UI PREFERENCES (summary_fields for PDF export, field_notes for SuperAdmin) ===
  app.patch("/api/subjects/:id/ui-preferences", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const { summary_fields, field_notes } = req.body;
      const updatePayload: Record<string, any> = {};
      if (summary_fields && typeof summary_fields === "object" && !Array.isArray(summary_fields)) {
        updatePayload.summary_fields = summary_fields;
      }
      if (field_notes && typeof field_notes === "object" && !Array.isArray(field_notes)) {
        updatePayload.field_notes = field_notes;
      }
      if (Object.keys(updatePayload).length === 0) {
        return res.status(400).json({ message: "Musíte poskytnúť summary_fields alebo field_notes" });
      }
      const updated = await storage.updateSubjectUiPreferences(subjectId, updatePayload);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === GDPR DATA EXPORT ===
  app.get("/api/subjects/:id/gdpr-export", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      
      if (!await checkKlientiSubjectAccess(appUser, subjectId)) {
        return res.status(403).json({ message: "Prístup zamietnutý" });
      }

      await logAudit(req, { action: "EXPORT", module: "gdpr-export", entityId: subjectId });
      
      const subject = await storage.getSubject(subjectId);
      if (!subject) return res.status(404).json({ message: "Subjekt nenájdený" });
      
      const legalExport: Record<string, any> = {
        exportDate: new Date().toISOString(),
        exportType: "GDPR_DATA_SUBJECT_REQUEST",
        subject: {
          uid: subject.uid,
          type: subject.type,
          firstName: subject.firstName,
          lastName: subject.lastName,
          companyName: subject.companyName,
          email: subject.email,
          phone: subject.phone,
          birthNumber: subject.birthNumber ? "***" : null,
          isActive: subject.isActive,
          createdAt: subject.createdAt,
        },
        identityData: (() => {
          const details = (subject.details || {}) as Record<string, any>;
          const dynFields = details.dynamicFields || {};
          const LEGAL_FIELDS = [
            'titul_pred', 'meno', 'priezvisko', 'titul_za', 'datum_narodenia',
            'pohlavie', 'miesto_narodenia', 'statna_prislusnost', 'rodne_priezvisko',
            'typ_dokladu', 'cislo_dokladu', 'platnost_dokladu', 'vydal_doklad',
            'adresa_trvaly_ulica', 'adresa_trvaly_cislo', 'adresa_trvaly_mesto',
            'adresa_trvaly_psc', 'adresa_trvaly_stat',
            'adresa_prechodny_ulica', 'adresa_prechodny_cislo', 'adresa_prechodny_mesto',
            'adresa_prechodny_psc', 'adresa_prechodny_stat',
            'email', 'telefon', 'telefon2',
          ];
          const filtered: Record<string, any> = {};
          for (const key of LEGAL_FIELDS) {
            if (dynFields[key]) filtered[key] = dynFields[key];
          }
          return filtered;
        })(),
        _excluded: [
          "bonitaPoints - Interné obchodné tajomstvo",
          "cgnRating - Interné obchodné tajomstvo",
          "listStatus - Interné obchodné tajomstvo",
          "internalNotes - Interné obchodné tajomstvo",
          "riskLinks - Interné obchodné tajomstvo",
          "auditLogs - Interné obchodné tajomstvo",
          "fieldHistory - Interné obchodné tajomstvo",
        ],
      };
      
      const allContracts = await storage.getContracts();
      const subjectContracts = allContracts.filter((c: any) => c.subjectId === subjectId);
      legalExport.contracts = subjectContracts.map((c: any) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        status: c.statusName || c.statusId,
        productName: c.productName,
        createdAt: c.createdAt,
        signedAt: c.signedDate,
      }));
      
      const consents = await storage.getClientMarketingConsents(subjectId);
      legalExport.consents = consents.map((c: any) => ({
        consentType: c.consentType,
        isGranted: c.isGranted,
        grantedAt: c.grantedAt,
        revokedAt: c.revokedAt,
      }));
      
      await storage.createAuditLog({
        userId: appUser.id,
        username: appUser.username,
        action: "GDPR_EXPORT",
        module: "subjects",
        entityId: subjectId,
        entityName: `GDPR export subjektu ${subjectId}`,
      });
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${subject.uid?.replace(/\s/g, '')}-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(legalExport);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === SUBJECT DOCUMENTS (Generated PDFs) ===
  app.get("/api/subjects/:id/documents", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const docs = await storage.getSubjectDocuments(subjectId);
      res.json(docs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/documents/:docId/audit-view", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      await storage.createAuditLog({
        userId: appUser.id, username: appUser.username, action: "DOCUMENT_VIEWED",
        module: "dokumentacia", entityId: subjectId,
        entityName: `Zobrazenie dokumentu ${req.params.docId} subjektu ${subjectId}`,
      });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/subjects/:id/documents/:docId/audit-print", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      await storage.createAuditLog({
        userId: appUser.id, username: appUser.username, action: "DOCUMENT_PRINTED",
        module: "dokumentacia", entityId: subjectId,
        entityName: `Tlač dokumentu ${req.params.docId} subjektu ${subjectId}`,
      });
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/subjects/:id/generate-doc/:docType", isAuthenticated, async (req: any, res) => {
    try {
      const PDFDocument = (await import("pdfkit")).default;
      const subjectId = Number(req.params.id);
      const docType = req.params.docType as string;
      if (!["aml", "gdpr", "client-card"].includes(docType)) {
        return res.status(400).json({ message: "Neplatný typ dokumentu" });
      }

      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });

      const subject = await storage.getSubject(subjectId);
      if (!subject) return res.status(404).json({ message: "Subjekt nenájdený" });

      const auditCode = `DOC-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const now = new Date();
      const formattedDate = formatDateTimeSK(now);
      const subjectName = subject.type === "company" ? (subject.companyName || "—") : `${subject.firstName || ""} ${subject.lastName || ""}`.trim() || "—";

      const QRCode = await import("qrcode");
      const subjectUrl = `https://secure-agent-hub.replit.app/subjekt/${subject.uid || subjectId}?ts=${formatTimestampForFile(now)}`;
      const qrDataUrl = await QRCode.toDataURL(subjectUrl, { width: 80, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
      const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ""), "base64");

      const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: `ArutsoK - ${docType}`, Author: appUser.username } });
      const fileTs = formatTimestampForFile(now);
      const filename = `${docType}_${subjectId}_${fileTs}.pdf`;
      const filePath = path.join(UPLOADS_DIR, "generated-docs", filename);
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const drawQRAndTimestamp = () => {
        doc.image(qrBuffer, 465, 10, { width: 80 });
        doc.fontSize(7).font("Helvetica").text(formattedDate, 455, 93, { width: 90, align: "center" });
      };

      const drawHeader = (title: string) => {
        doc.fontSize(18).font("Helvetica-Bold").text("ArutsoK", 50, 50);
        doc.fontSize(10).font("Helvetica").text(`UID: ${subject.uid || "—"}`, 50, 72);
        drawQRAndTimestamp();
        doc.moveTo(50, 90).lineTo(445, 90).stroke("#333333");
        doc.fontSize(14).font("Helvetica-Bold").text(title, 50, 100);
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica").text(`Subjekt: ${subjectName}`, 50);
        doc.text(`Typ: ${subject.type === "person" ? "Fyzická osoba" : subject.type === "szco" ? "SZČO" : "Právnická osoba"}`);
        doc.moveDown(1);
      };

      const drawFooter = () => {
        const pageH = doc.page.height;
        doc.moveTo(50, pageH - 80).lineTo(545, pageH - 80).stroke("#cccccc");
        doc.fontSize(8).font("Helvetica")
          .text(`Audit kód: ${auditCode}`, 50, pageH - 70)
          .text(`Vygenerované: ${formattedDate}`, 50, pageH - 58)
          .text(`Používateľ: ${appUser.username} (ID: ${appUser.id})`, 50, pageH - 46)
          .text("Dokument vygenerovaný systémom ArutsoK. Dôverný materiál.", 50, pageH - 34);
      };

      const drawTable = (rows: [string, string][], startY?: number) => {
        let y = startY || doc.y;
        for (const [label, value] of rows) {
          if (y > doc.page.height - 120) { doc.addPage(); drawFooter(); y = 50; }
          doc.fontSize(9).font("Helvetica-Bold").text(label, 50, y, { width: 200 });
          doc.fontSize(9).font("Helvetica").text(value || "—", 260, y, { width: 280 });
          y += 18;
        }
        doc.y = y;
      };

      const details = (subject.details || {}) as Record<string, any>;
      const dynFields = details.dynamicFields || {};

      if (docType === "aml") {
        drawHeader("Záznam o AML preverení");
        doc.fontSize(11).font("Helvetica-Bold").text("PEP & Compliance status", 50);
        doc.moveDown(0.5);
        const pepVal = dynFields.pep || "Nevyplnené";
        const peoVal = dynFields.ekon_peo || "Nevyplnené";
        drawTable([
          ["PEP (Politicky exponovaná osoba)", pepVal],
          ["PEP – verejná funkcia", dynFields.pep_funkcia || ""],
          ["PEP – vzťah k PEP osobe", dynFields.pep_vztah || ""],
          ["PEO (Politicky exponovaná osoba)", peoVal],
          ["PEO – zdôvodnenie", dynFields.ekon_peo_zdovodnenie || ""],
          ["Konečný užívateľ výhod", dynFields.ekon_kuv || ""],
        ]);
        doc.moveDown(1);
        doc.fontSize(11).font("Helvetica-Bold").text("KUV (Koneční užívatelia výhod)", 50);
        doc.moveDown(0.5);
        for (let i = 1; i <= 3; i++) {
          const meno = dynFields[`kuv_meno_${i}`];
          if (meno) {
            drawTable([
              [`KUV ${i} – Meno`, meno],
              [`KUV ${i} – Rodné číslo`, dynFields[`kuv_rc_${i}`] || ""],
              [`KUV ${i} – % podiel`, dynFields[`kuv_podiel_${i}`] || ""],
            ]);
            doc.moveDown(0.3);
          }
        }
        doc.moveDown(1);
        doc.fontSize(10).font("Helvetica").text(`Dátum kontroly: ${formattedDate}`);
        const amlFields = ["pep", "pep_funkcia", "pep_vztah", "kuv_meno_1", "ekon_peo"];
        const filled = amlFields.filter(k => !!dynFields[k]).length;
        doc.text(`AML kompletnosť: ${filled}/${amlFields.length} polí vyplnených`);
        const semafor = filled > 0 && dynFields.pep ? "ZELENÝ (kompletné)" : "ORANŽOVÝ (nekompletné)";
        doc.text(`Semafor: ${semafor}`);
      } else if (docType === "gdpr") {
        drawHeader("GDPR doložka klienta");
        doc.fontSize(11).font("Helvetica-Bold").text("Osobné údaje", 50);
        doc.moveDown(0.5);
        drawTable([
          ["Meno", `${subject.firstName || ""} ${subject.lastName || ""}`.trim()],
          ["UID", subject.uid || ""],
          ["Email", subject.email || ""],
          ["Telefón", subject.phone || ""],
          ["Rodné číslo", subject.birthNumber ? "***" : "Nevyplnené"],
          ["Dátum narodenia", dynFields.datum_narodenia || ""],
          ["Štátna príslušnosť", dynFields.statna_prislusnost || ""],
        ]);
        doc.moveDown(1);
        doc.fontSize(11).font("Helvetica-Bold").text("Marketingové súhlasy", 50);
        doc.moveDown(0.5);
        const consents = await storage.getClientMarketingConsents(subjectId);
        if (consents.length === 0) {
          doc.fontSize(9).font("Helvetica").text("Žiadne marketingové súhlasy neboli zaznamenané.");
        } else {
          for (const c of consents) {
            const status = (c as any).isGranted ? "UDELENÝ" : "ODVOLANÝ";
            const date = (c as any).grantedAt ? new Date((c as any).grantedAt).toLocaleDateString("sk-SK") : "—";
            drawTable([
              ["Typ súhlasu", (c as any).consentType || "marketing"],
              ["Stav", status],
              ["Dátum udelenia", date],
            ]);
            doc.moveDown(0.3);
          }
        }
        doc.moveDown(1);
        doc.fontSize(11).font("Helvetica-Bold").text("Spracúvané údaje", 50);
        doc.moveDown(0.5);
        const processedFields = Object.keys(dynFields).filter(k => !!dynFields[k]);
        doc.fontSize(9).font("Helvetica").text(`Počet spracúvaných polí: ${processedFields.length}`);
        if (processedFields.length > 0) {
          doc.text(`Polia: ${processedFields.slice(0, 20).join(", ")}${processedFields.length > 20 ? "..." : ""}`);
        }
      } else if (docType === "client-card") {
        drawHeader("Karta subjektu");
        doc.fontSize(11).font("Helvetica-Bold").text("Identita", 50);
        doc.moveDown(0.5);
        drawTable([
          ["Meno", `${subject.firstName || ""} ${subject.lastName || ""}`.trim()],
          ["Firma", subject.companyName || ""],
          ["UID", subject.uid || ""],
          ["Typ", subject.type === "person" ? "FO" : subject.type === "szco" ? "SZČO" : "PO"],
          ["Email", subject.email || ""],
          ["Telefón", subject.phone || ""],
          ["IBAN", (subject as any).iban || ""],
          ["Dátum narodenia", dynFields.datum_narodenia || ""],
          ["Miesto narodenia", dynFields.miesto_narodenia || ""],
          ["Rodné priezvisko", dynFields.rodne_priezvisko || ""],
        ]);
        doc.moveDown(1);
        doc.fontSize(11).font("Helvetica-Bold").text("Adresa", 50);
        doc.moveDown(0.5);
        drawTable([
          ["Ulica", dynFields.tp_ulica || ""],
          ["Mesto", dynFields.tp_mesto || ""],
          ["PSČ", dynFields.tp_psc || ""],
          ["Štát", dynFields.tp_stat || ""],
        ]);
        doc.moveDown(1);
        doc.fontSize(11).font("Helvetica-Bold").text("AML Status", 50);
        doc.moveDown(0.5);
        drawTable([
          ["PEP", dynFields.pep || "Nevyplnené"],
          ["PEO", dynFields.ekon_peo || "Nevyplnené"],
        ]);
        doc.moveDown(1);
        doc.fontSize(11).font("Helvetica-Bold").text("Prepojené zmluvy", 50);
        doc.moveDown(0.5);
        const allContracts = await storage.getContracts();
        const subjectContracts = allContracts.filter((c: any) => c.subjectId === subjectId);
        if (subjectContracts.length === 0) {
          doc.fontSize(9).font("Helvetica").text("Žiadne prepojené zmluvy.");
        } else {
          for (const c of subjectContracts.slice(0, 20)) {
            drawTable([
              ["Číslo zmluvy", (c as any).contractNumber || "—"],
              ["Stav", (c as any).statusName || `ID: ${(c as any).statusId}`],
              ["Partner", (c as any).partnerName || "—"],
            ]);
            doc.moveDown(0.2);
          }
          if (subjectContracts.length > 20) {
            doc.fontSize(9).font("Helvetica").text(`... a ďalších ${subjectContracts.length - 20} zmlúv`);
          }
        }
      }

      drawFooter();
      doc.end();

      await new Promise<void>((resolve, reject) => {
        writeStream.on("finish", resolve);
        writeStream.on("error", reject);
      });

      const stats = fs.statSync(filePath);
      const dbDocType = docType === "client-card" ? "client_card" : docType === "aml" ? "aml_record" : "gdpr_card";
      const savedDoc = await storage.createSubjectDocument({
        subjectId,
        docType: dbDocType,
        filename,
        auditCode,
        generatedByUserId: appUser.id,
        generatedByUsername: appUser.username,
        fileSize: stats.size,
      });

      await storage.createAuditLog({
        userId: appUser.id, username: appUser.username, action: "DOCUMENT_GENERATED",
        module: "dokumentacia", entityId: subjectId,
        entityName: `Generovanie ${dbDocType} dokumentu pre subjekt ${subjectId}`,
        newData: { docType: dbDocType, auditCode, filename },
      });

      res.json(savedDoc);
    } catch (err: any) {
      console.error("PDF generation error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // === SUBJECT BONITA POINTS LOG ===
  app.get("/api/subjects/:id/points-log", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const logs = await storage.getSubjectPointsLog(subjectId);
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/bonita-summary", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const subject = await storage.getSubject(subjectId);
      if (!subject) return res.status(404).json({ message: "Subjekt nenajdeny" });
      const identifierType = subject.birthNumber ? "rc" : "ico";
      const identifierValue = subject.birthNumber || ((subject.details as any)?.ico || (subject.details as any)?.dynamicFields?.ico);
      let globalLogs: any[] = [];
      let crossCompanySubjects: any[] = [];
      if (identifierValue) {
        globalLogs = await storage.getPointsByIdentifier(identifierType, identifierValue, 10);
        crossCompanySubjects = await storage.findSubjectsByIdentifier(identifierType, identifierValue);
      } else {
        globalLogs = await storage.getSubjectPointsLog(subjectId);
      }
      const totalPoints = globalLogs.reduce((sum: number, l: any) => sum + l.points, 0);
      res.json({
        totalPoints,
        listStatus: subject.listStatus,
        cgnRating: subject.cgnRating,
        logs: globalLogs,
        crossCompanyCount: crossCompanySubjects.length,
        identifierType: identifierValue ? identifierType : null,
        identifierValue: identifierValue || null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/add-point", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const { points, pointType, reason, contractId } = req.body;
      if (!reason || reason.trim().length === 0) {
        return res.status(400).json({ message: "Dôvod je povinný pri udeľovaní bodov" });
      }
      if (!pointType || !['cerveny', 'oranzovy', 'modry'].includes(pointType)) {
        return res.status(400).json({ message: "Typ bodu je povinný. Povolené: cerveny, oranzovy, modry" });
      }
      if (points === undefined || points === null || typeof points !== 'number') {
        return res.status(400).json({ message: "Počet bodov je povinný" });
      }
      const subject = await storage.getSubject(subjectId);
      if (!subject) return res.status(404).json({ message: "Subjekt nenajdený" });

      const identifierType = subject.birthNumber ? "rc" : "ico";
      const identifierValue = subject.birthNumber || ((subject.details as any)?.dynamicFields?.ico);

      await db.insert(subjectPointsLog).values({
        subjectId,
        contractId: contractId || null,
        points,
        pointType,
        reason: reason.trim(),
        identifierType: identifierValue ? identifierType : null,
        identifierValue: identifierValue || null,
        companyId: req.appUser?.activeCompanyId || null,
        createdByUserId: req.appUser?.id || null,
      });

      const allLogs = identifierValue
        ? await storage.getPointsByIdentifier(identifierType, identifierValue, 10)
        : await storage.getSubjectPointsLog(subjectId);
      const newTotal = allLogs
        .filter((l: any) => !l.pointType || l.pointType === 'cerveny')
        .reduce((sum: number, l: any) => sum + l.points, 0);
      await db.update(subjects).set({ bonitaPoints: newTotal }).where(eq(subjects.id, subjectId));

      if (newTotal <= -5 && subject.listStatus !== "cerveny") {
        const existingAlert = await db.select().from(redListAlerts)
          .where(and(eq(redListAlerts.subjectId, subjectId), eq(redListAlerts.status, "pending")))
          .then(r => r[0]);
        if (!existingAlert) {
          await db.insert(redListAlerts).values({
            subjectId,
            bonitaPoints: newTotal,
            status: "pending",
            dismissCount: 0,
          });
          await logAudit(req, { action: "CREATE", module: "red_list_alerts", entityId: subjectId, entityName: `Červený zoznam alert: bonita ${newTotal} bodov`, oldData: {}, newData: { bonitaPoints: newTotal, trigger: "bonita_threshold" } });
        }
      }

      await logAudit(req, { action: "ADD_POINT", module: "subjekty_bonita", entityId: subjectId, entityName: `${pointType} bod (${points}) pre subjekt ${subject.uid}: ${reason}` });
      res.json({ totalPoints: newTotal });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === SUBJECT LIST STATUS (Červený/Čierny zoznam) ===
  app.patch("/api/subjects/:id/list-status", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const subjectId = Number(req.params.id);
      const { listStatus, reason } = req.body;

      const userPerms = appUser?.permissionGroup;
      const isSuperAdmin = userPerms?.name?.toLowerCase().includes("superadmin") || userPerms?.name?.toLowerCase().includes("prezident");
      if (!isSuperAdmin) {
        return res.status(403).json({ message: "Len SuperAdmin/Prezident môže meniť stav zoznamu" });
      }

      if (listStatus !== "cerveny" && listStatus !== "cierny" && listStatus !== null) {
        return res.status(400).json({ message: "Neplatný stav zoznamu" });
      }

      const redListCompanyId = listStatus === "cerveny" ? (appUser?.activeCompanyId || null) : null;
      const updated = await storage.updateSubjectListStatus(subjectId, listStatus, appUser?.id || 0, reason, redListCompanyId);

      await logAudit(req, {
        action: "UPDATE",
        module: "subjekty",
        entityId: subjectId,
        entityName: `Zmena listu: ${listStatus || 'zrušený'}`,
        oldData: {},
        newData: { listStatus, reason, redListCompanyId },
      });

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === RED LIST ALERTS (Červený zoznam - upozornenia) ===
  app.get("/api/red-list-alerts/pending", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident';
      const pgName = (appUser?.permissionGroup?.name || "").toLowerCase();
      const isAdminPg = pgName.includes("admin") || pgName.includes("superadmin") || pgName.includes("prezident");
      if (!isAdmin && !isAdminPg) return res.status(403).json({ message: "Len admin/superadmin" });

      const alerts = await db.select().from(redListAlerts)
        .where(eq(redListAlerts.status, "pending"))
        .orderBy(desc(redListAlerts.createdAt));

      const enriched = await Promise.all(alerts.map(async (alert) => {
        const subject = await storage.getSubject(alert.subjectId);
        const details = subject?.details as any;
        const titleBefore = subject?.titleBefore || details?.dynamicFields?.titul_pred || "";
        const titleAfter = subject?.titleAfter || details?.dynamicFields?.titul_za || "";
        return {
          ...alert,
          subjectUid: subject?.uid || "",
          subjectName: subject?.type === "person"
            ? `${titleBefore ? titleBefore + " " : ""}${subject?.firstName || ""} ${subject?.lastName || ""}${titleAfter ? ", " + titleAfter : ""}`
            : subject?.companyName || "",
          subjectType: subject?.type || "person",
        };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/red-list-alerts/:id/dismiss", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident';
      const pgName = (appUser?.permissionGroup?.name || "").toLowerCase();
      const isAdminPg = pgName.includes("admin") || pgName.includes("superadmin") || pgName.includes("prezident");
      if (!isAdmin && !isAdminPg) return res.status(403).json({ message: "Len admin/superadmin" });

      const alertId = Number(req.params.id);
      const [updated] = await db.update(redListAlerts)
        .set({ dismissCount: sql`${redListAlerts.dismissCount} + 1` })
        .where(and(eq(redListAlerts.id, alertId), eq(redListAlerts.status, "pending")))
        .returning();

      if (!updated) return res.status(404).json({ message: "Alert nenájdený" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/red-list-alerts/:id/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident';
      const pgName = (appUser?.permissionGroup?.name || "").toLowerCase();
      const isAdminPg = pgName.includes("admin") || pgName.includes("superadmin") || pgName.includes("prezident");
      if (!isAdmin && !isAdminPg) return res.status(403).json({ message: "Len admin/superadmin" });

      const alertId = Number(req.params.id);
      const alert = await db.select().from(redListAlerts).where(eq(redListAlerts.id, alertId)).then(r => r[0]);
      if (!alert || alert.status !== "pending") return res.status(404).json({ message: "Alert nenájdený alebo už vyriešený" });

      const [updated] = await db.update(redListAlerts)
        .set({ status: "confirmed", resolvedAt: new Date(), resolvedByUserId: appUser?.id || null })
        .where(eq(redListAlerts.id, alertId))
        .returning();

      const companyId = appUser?.activeCompanyId || null;
      await storage.updateSubjectListStatus(alert.subjectId, "cerveny", appUser?.id || 0, `Potvrdený červený zoznam adminom: bonita ${alert.bonitaPoints} bodov`, companyId);

      try {
        await storage.ensureSubjectInGroup(alert.subjectId, "group_cerveny_zoznam");
      } catch (e) { /* group may not exist yet */ }

      await logAudit(req, {
        action: "UPDATE",
        module: "red_list_alerts",
        entityId: alert.subjectId,
        entityName: `Červený zoznam potvrdený pre subjekt ${alert.subjectId}`,
        oldData: { status: "pending" },
        newData: { status: "confirmed", listStatus: "cerveny" },
      });

      const subject = await storage.getSubject(alert.subjectId);
      const details = subject?.details as any;
      const titleBefore = subject?.titleBefore || details?.dynamicFields?.titul_pred || "";
      const titleAfter = subject?.titleAfter || details?.dynamicFields?.titul_za || "";
      const fullName = subject?.type === "person"
        ? `${titleBefore ? titleBefore + " " : ""}${subject?.firstName || ""} ${subject?.lastName || ""}${titleAfter ? ", " + titleAfter : ""}`
        : subject?.companyName || "";
      const formattedUid = subject?.uid ? subject.uid.replace(/(\d{3})(?=\d)/g, "$1 ") : "";
      const confirmedAt = new Date();
      const confirmedAtStr = formatDateTimeSK(confirmedAt);

      const subjectContracts = await db.select().from(contracts)
        .where(and(eq(contracts.subjectId, alert.subjectId), isNull(contracts.deletedAt)));
      const acquirerUserIds = new Set<number>();
      for (const c of subjectContracts) {
        const acqs = await storage.getContractAcquirers(c.id);
        for (const a of acqs) acquirerUserIds.add(a.userId);
        if (c.ziskatelUid) {
          const [user] = await db.select().from(appUsers).where(eq(appUsers.uid, c.ziskatelUid));
          if (user) acquirerUserIds.add(user.id);
        }
      }

      for (const userId of acquirerUserIds) {
        await db.insert(notificationQueue).values({
          recipientUserId: userId,
          notificationType: "red_list_confirmed",
          title: "Subjekt presunutý na červený zoznam",
          message: JSON.stringify({
            subjectId: alert.subjectId,
            subjectUid: formattedUid,
            subjectName: fullName,
            confirmedAt: confirmedAtStr,
            reason: `Bonita skóre kleslo na ${alert.bonitaPoints} bodov (prah -5). Subjekt mal viacero stornovaných zmlúv kratších ako 1 rok.`,
          }),
          priority: "high",
          status: "sent",
        });
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/red-list-alerts/recent-confirmed", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident';
      const pgName = (appUser?.permissionGroup?.name || "").toLowerCase();
      const isAdminPg = pgName.includes("admin") || pgName.includes("superadmin") || pgName.includes("prezident");
      if (!isAdmin && !isAdminPg) return res.status(403).json({ message: "Len admin/superadmin" });

      const confirmed = await db.select().from(redListAlerts)
        .where(eq(redListAlerts.status, "confirmed"))
        .orderBy(desc(redListAlerts.resolvedAt))
        .limit(10);

      const enriched = await Promise.all(confirmed.map(async (alert) => {
        const subject = await storage.getSubject(alert.subjectId);
        const resolver = alert.resolvedByUserId ? await db.select().from(appUsers).where(eq(appUsers.id, alert.resolvedByUserId)).then(r => r[0]) : null;
        const details = subject?.details as any;
        const titleBefore = subject?.titleBefore || details?.dynamicFields?.titul_pred || "";
        const titleAfter = subject?.titleAfter || details?.dynamicFields?.titul_za || "";
        return {
          ...alert,
          subjectUid: subject?.uid || "",
          subjectName: subject?.type === "person"
            ? `${titleBefore ? titleBefore + " " : ""}${subject?.firstName || ""} ${subject?.lastName || ""}${titleAfter ? ", " + titleAfter : ""}`
            : subject?.companyName || "",
          resolvedByName: resolver ? `${resolver.firstName || ""} ${resolver.lastName || ""}`.trim() : "",
        };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === BLACK LIST RECENT (Čierny zoznam - posledné presuny) ===
  app.get("/api/black-list/recent", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident';
      const pgName = (appUser?.permissionGroup?.name || "").toLowerCase();
      const isAdminPg = pgName.includes("admin") || pgName.includes("superadmin") || pgName.includes("prezident");
      if (!isAdmin && !isAdminPg) return res.status(403).json({ message: "Len admin/superadmin" });

      const blacklistGroup = await db.select().from(clientGroups).where(eq(clientGroups.groupCode, "group_cierny_zoznam")).then(r => r[0]);
      if (!blacklistGroup) return res.json([]);

      const recentMembers = await db.select().from(clientGroupMembers)
        .where(eq(clientGroupMembers.groupId, blacklistGroup.id))
        .orderBy(desc(clientGroupMembers.createdAt))
        .limit(10);

      const enriched = await Promise.all(recentMembers.map(async (member) => {
        const subject = await storage.getSubject(member.subjectId);
        const details = subject?.details as any;
        const titleBefore = subject?.titleBefore || details?.dynamicFields?.titul_pred || "";
        const titleAfter = subject?.titleAfter || details?.dynamicFields?.titul_za || "";
        const subjectName = subject?.type === "person"
          ? `${titleBefore ? titleBefore + " " : ""}${subject?.firstName || ""} ${subject?.lastName || ""}${titleAfter ? ", " + titleAfter : ""}`
          : subject?.companyName || "";

        const auditEntry = await db.select().from(auditLogs)
          .where(and(
            eq(auditLogs.module, "cierny_zoznam"),
            eq(auditLogs.action, "BLACKLIST"),
            eq(auditLogs.entityId, member.subjectId)
          ))
          .orderBy(desc(auditLogs.createdAt))
          .limit(1)
          .then(r => r[0]);

        let addedByName = "";
        let reason = "";
        if (auditEntry) {
          const newData = auditEntry.newData as any;
          addedByName = newData?.addedByUsername || "";
          reason = newData?.reason || "";
        }

        return {
          id: member.id,
          subjectId: member.subjectId,
          subjectUid: subject?.uid || "",
          subjectName,
          addedAt: member.createdAt,
          addedByName,
          reason,
        };
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === CGN RATING UPDATE ===
  app.patch("/api/subjects/:id/cgn-rating", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const { cgnRating } = req.body;
      const [updated] = await db.update(subjects).set({ cgnRating }).where(eq(subjects.id, subjectId)).returning();
      await logAudit(req, {
        action: "UPDATE",
        module: "subjekty",
        entityId: subjectId,
        entityName: `CGN rating: ${cgnRating || 'zrušený'}`,
        oldData: {},
        newData: { cgnRating },
      });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/linked-companies", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const allSubjects = await storage.getSubjects();
      const linked = allSubjects.filter((s: any) => s.linkedFoId === subjectId && !s.deletedAt);
      res.json(linked);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/field-history", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const fieldKey = req.query.fieldKey as string | undefined;
      const history = await storage.getSubjectFieldHistory(subjectId, fieldKey);
      res.json(history);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/field-history/keys", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const keys = await storage.getSubjectFieldHistoryKeys(subjectId);
      res.json(keys);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/field-history/counts", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const counts = await storage.getSubjectFieldHistoryCounts(subjectId);
      res.json(counts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/field-history/freshness", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const freshness = await storage.getSubjectFieldHistoryFreshness(subjectId);
      res.json(freshness);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/field-history/restore", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const { historyEntryId } = req.body;
      if (!historyEntryId || typeof historyEntryId !== 'number' || !Number.isInteger(historyEntryId) || historyEntryId <= 0) {
        return res.status(400).json({ message: "historyEntryId musí byť platné celé číslo" });
      }
      const userName = [appUser.firstName, appUser.lastName].filter(Boolean).join(' ') || appUser.email || 'Neznámy';
      const restoreResult = await storage.restoreFieldValue(subjectId, historyEntryId, appUser.id, userName);
      if ('skipped' in restoreResult && restoreResult.skipped) {
        return res.json({ skipped: true, message: restoreResult.message });
      }
      const restoreLog = restoreResult as any;
      await logAudit(req, {
        action: "RESTORE",
        module: "subjekty",
        entityId: subjectId,
        entityName: `Obnova hodnoty poľa '${restoreLog.fieldKey}' subjektu ${subjectId}`,
        newData: { fieldKey: restoreLog.fieldKey, restoredValue: restoreLog.newValue, fromDate: restoreLog.restoredFromDate },
      });
      res.json(restoreLog);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === SUBJECT ADDRESSES COLLECTION ===
  app.get("/api/subjects/:id/addresses", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const addresses = await storage.getSubjectAddresses(subjectId);
      res.json(addresses);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/addresses", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const { addressType, ulica, supisneCislo, orientacneCislo, obecMesto, psc, stat, isHlavna } = req.body;
      if (!addressType || !["trvaly", "prechodny", "korespondencna"].includes(addressType)) {
        return res.status(400).json({ message: "Neplatný typ adresy" });
      }
      const userName = [appUser.firstName, appUser.lastName].filter(Boolean).join(' ') || appUser.email || 'Neznámy';
      const created = await storage.createSubjectAddress({
        subjectId, addressType, ulica, supisneCislo, orientacneCislo, obecMesto, psc, stat: stat || "Slovensko", isHlavna: isHlavna || false,
      }, appUser.id, userName);
      await logAudit(req, { action: "Vytvorenie", module: "Adresy", entityId: created.id, entityName: `Adresa ${addressType} pre subjekt ${subjectId}`, newData: req.body });
      res.json(created);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/subjects/:id/addresses/:addressId", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const subjectId = Number(req.params.id);
      const addressId = Number(req.params.addressId);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const userName = [appUser.firstName, appUser.lastName].filter(Boolean).join(' ') || appUser.email || 'Neznámy';
      const { ulica, supisneCislo, orientacneCislo, obecMesto, psc, stat } = req.body;
      const updated = await storage.updateSubjectAddress(addressId, subjectId, { ulica, supisneCislo, orientacneCislo, obecMesto, psc, stat }, appUser.id, userName);
      await logAudit(req, { action: "Uprava", module: "Adresy", entityId: addressId, entityName: `Adresa ${updated.addressType} pre subjekt ${subjectId}`, newData: req.body });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/subjects/:id/addresses/:addressId", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const subjectId = Number(req.params.id);
      const addressId = Number(req.params.addressId);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      await storage.deleteSubjectAddress(addressId, subjectId);
      await logAudit(req, { action: "Vymazanie", module: "Adresy", entityId: addressId, entityName: `Adresa pre subjekt ${subjectId}` });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/addresses/:addressId/set-hlavna", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const subjectId = Number(req.params.id);
      const addressId = Number(req.params.addressId);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const userName = [appUser.firstName, appUser.lastName].filter(Boolean).join(' ') || appUser.email || 'Neznámy';
      await storage.setHlavnaAddress(addressId, subjectId, appUser.id, userName);
      await logAudit(req, { action: "Uprava", module: "Adresy", entityId: addressId, entityName: `Nastavenie hlavnej adresy pre subjekt ${subjectId}` });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/address-inheritance-candidates", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const inheritanceRoles = ['byva_spolu', 'rodic_zakonny_zastupca', 'manzel_manzelka', 'partner_druh', 'dieta_opravnena_osoba'];
      const result = await db.execute(sql`
        SELECT DISTINCT s.id, s.uid, s.first_name, s.last_name, s.company_name, s.type,
               rrt.label as relation_label, rrt.code as relation_code
        FROM subject_relations sr
        JOIN relation_role_types rrt ON sr.role_type_id = rrt.id
        JOIN subjects s ON s.id = CASE 
          WHEN sr.source_subject_id = ${subjectId} THEN sr.target_subject_id
          ELSE sr.source_subject_id
        END
        WHERE (sr.source_subject_id = ${subjectId} OR sr.target_subject_id = ${subjectId})
        AND sr.is_active = true
        AND rrt.code IN (${sql.join(inheritanceRoles.map(r => sql`${r}`), sql`, `)})
        AND s.is_active = true
        AND s.id != ${subjectId}
      `);
      const candidates = ((result as any).rows || []).map((r: any) => ({
        subjectId: r.id,
        uid: r.uid,
        name: r.type === 'person' ? [r.first_name, r.last_name].filter(Boolean).join(' ') : (r.company_name || ''),
        relationLabel: r.relation_label,
        relationCode: r.relation_code,
      }));
      res.json(candidates);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/propagate-address", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const sourceSubjectId = Number(req.params.id);
      const { targetSubjectIds, addressType, addressFields } = req.body;

      if (!Array.isArray(targetSubjectIds) || targetSubjectIds.length === 0) {
        return res.status(400).json({ message: "Neboli vybrané žiadne subjekty" });
      }
      if (!addressFields || typeof addressFields !== 'object') {
        return res.status(400).json({ message: "Chýbajú adresné polia" });
      }

      const userName = [appUser.firstName, appUser.lastName].filter(Boolean).join(' ') || appUser.email || 'Neznámy';
      const results: any[] = [];

      for (const targetId of targetSubjectIds) {
        try {
          const existingAddresses = await storage.getSubjectAddresses(targetId);
          const existing = existingAddresses.find((a: any) => a.addressType === (addressType || 'trvaly'));

          if (existing) {
            const updated = await storage.updateSubjectAddress(existing.id, targetId, addressFields, appUser.id, userName);
            results.push({ subjectId: targetId, action: 'updated', addressId: updated.id });
          } else {
            const created = await storage.createSubjectAddress({
              subjectId: targetId,
              addressType: addressType || 'trvaly',
              ...addressFields,
            }, appUser.id, userName);
            results.push({ subjectId: targetId, action: 'created', addressId: created.id });
          }
          await logAudit(req, { action: "PROPAGATE", module: "Adresy", entityId: targetId, entityName: `Propagácia adresy zo subjektu ${sourceSubjectId}`, newData: addressFields });
        } catch (e: any) {
          results.push({ subjectId: targetId, action: 'error', error: e.message });
        }
      }

      res.json({ success: true, results, propagatedCount: results.filter(r => r.action !== 'error').length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === SUBJECT OBJECTS (Module B - aggregated objects) ===
  app.get("/api/subjects/:id/objects", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const objects = await storage.getSubjectObjects(subjectId);
      res.json(objects);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/objects/:id", isAuthenticated, async (req: any, res) => {
    try {
      const obj = await storage.getSubjectObject(Number(req.params.id));
      if (!obj) return res.status(404).json({ message: "Objekt neexistuje" });
      res.json(obj);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/objects/:id/sources", isAuthenticated, async (req: any, res) => {
    try {
      const sources = await storage.getObjectDataSources(Number(req.params.id));
      res.json(sources);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/contracts/:id/sync-objects", isAuthenticated, async (req: any, res) => {
    try {
      const contractId = Number(req.params.id);
      const { subjectId } = req.body;
      if (!subjectId) return res.status(400).json({ message: "subjectId je povinný" });
      await storage.syncObjectFromContract(contractId, subjectId);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/hierarchy", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Invalid subject ID" });
      const hierarchy = await storage.getSubjectHierarchy(subjectId);
      res.json(hierarchy);
    } catch (err: any) {
      console.error("Subject hierarchy error:", err);
      res.status(500).json({ message: err?.message || "Error fetching hierarchy" });
    }
  });

  app.get("/api/subjects/:id/object-hierarchy", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);

      const subjectContracts = await db.select().from(contracts).where(eq(contracts.subjectId, subjectId));
      if (!subjectContracts.length) return res.json({ objects: [], noObjectProducts: [] });

      const objectKeyParams = await db.select().from(subjectParameters).where(eq(subjectParameters.isObjectKey, true));
      const objectKeyFieldKeys = new Set(objectKeyParams.map(p => p.fieldKey));

      const allObjects = await db.select().from(subjectObjects)
        .where(and(eq(subjectObjects.subjectId, subjectId), eq(subjectObjects.isActive, true)));

      const allSources = allObjects.length > 0
        ? await db.select().from(objectDataSources)
            .where(inArray(objectDataSources.objectId, allObjects.map(o => o.id)))
        : [];

      type ParamNode = { id: number; name: string; value: string; productName: string; productId: number; contractId: number };
      type PanelNode = { id: number; name: string; params: ParamNode[] };
      type FolderNode = { id: number; name: string; panels: PanelNode[] };
      type ProductNode = { id: number; name: string; contractId: number; folders: FolderNode[] };
      type SectionNode = { id: number; name: string; products: ProductNode[] };
      type SectorNode = { id: number; name: string; sections: SectionNode[] };
      type ObjectNode = { id: number; uid: string; objectType: string; objectLabel: string; keyValues: Record<string, string>; updatedAt: string | null; sectors: SectorNode[] };

      const objectMap = new Map<number, ObjectNode>();
      for (const obj of allObjects) {
        objectMap.set(obj.id, {
          id: obj.id,
          uid: obj.uid,
          objectType: obj.objectType,
          objectLabel: obj.objectLabel,
          keyValues: (obj.keyValues || {}) as Record<string, string>,
          updatedAt: obj.updatedAt?.toISOString() || null,
          sectors: [],
        });
      }

      const noObjectProducts: { contractId: number; productName: string; sectorName: string; sectionName: string; folders: FolderNode[] }[] = [];

      for (const contract of subjectContracts) {
        if (!contract.sectorProductId) continue;

        const [sp] = await db.select().from(sectorProducts).where(eq(sectorProducts.id, contract.sectorProductId));
        if (!sp) continue;
        const [section] = await db.select().from(sections).where(eq(sections.id, sp.sectionId));
        if (!section) continue;
        const [sector] = await db.select().from(sectors).where(eq(sectors.id, section.sectorId));
        if (!sector) continue;

        const paramValues = await db.select().from(contractParameterValues)
          .where(eq(contractParameterValues.contractId, contract.id));

        const paramIds = paramValues.map(pv => pv.parameterId);
        const allParams = paramIds.length > 0
          ? await db.select().from(parameters).where(inArray(parameters.id, paramIds))
          : [];

        const ppList = await db.select().from(productPanels)
          .where(eq(productPanels.sectorProductId, sp.id));
        const panelIds = ppList.map(pp => pp.panelId);

        const panelRows = panelIds.length > 0
          ? await db.select().from(panels).where(inArray(panels.id, panelIds))
          : [];

        const fpList = panelIds.length > 0
          ? await db.select().from(folderPanels).where(inArray(folderPanels.panelId, panelIds))
          : [];
        const folderIds = [...new Set(fpList.map(fp => fp.folderId))];
        const folderRows = folderIds.length > 0
          ? await db.select().from(contractFolders).where(inArray(contractFolders.id, folderIds))
          : [];

        const ppParams = panelIds.length > 0
          ? await db.select().from(panelParameters).where(inArray(panelParameters.panelId, panelIds))
          : [];

        const folderNodeMap = new Map<number, FolderNode>();
        for (const folder of folderRows) {
          folderNodeMap.set(folder.id, { id: folder.id, name: folder.name, panels: [] });
        }

        const unassignedFolder: FolderNode = { id: 0, name: "Ostatné", panels: [] };

        for (const panelRow of panelRows) {
          const panelParamList = ppParams.filter(pp => pp.panelId === panelRow.id);
          const panelNode: PanelNode = { id: panelRow.id, name: panelRow.name, params: [] };

          for (const pp of panelParamList) {
            const pv = paramValues.find(v => v.parameterId === pp.parameterId);
            if (!pv?.value) continue;
            const param = allParams.find(p => p.id === pp.parameterId);
            if (!param) continue;
            panelNode.params.push({
              id: param.id,
              name: param.name,
              value: pv.value,
              productName: sp.name,
              productId: sp.id,
              contractId: contract.id,
            });
          }

          if (panelNode.params.length === 0) continue;

          const fp = fpList.find(f => f.panelId === panelRow.id);
          if (fp && folderNodeMap.has(fp.folderId)) {
            folderNodeMap.get(fp.folderId)!.panels.push(panelNode);
          } else {
            unassignedFolder.panels.push(panelNode);
          }
        }

        const contractFolderNodes: FolderNode[] = [
          ...Array.from(folderNodeMap.values()).filter(f => f.panels.length > 0),
          ...(unassignedFolder.panels.length > 0 ? [unassignedFolder] : []),
        ];

        const matchingSource = allSources.find(s => s.contractId === contract.id);
        const objectId = matchingSource?.objectId;

        let hasObjectKey = false;
        for (const pv of paramValues) {
          const param = allParams.find(p => p.id === pv.parameterId);
          if (param) {
            const targetKey = param.targetFieldKey || param.name;
            if (objectKeyFieldKeys.has(targetKey) && pv.value) {
              hasObjectKey = true;
              break;
            }
          }
        }

        if (objectId && objectMap.has(objectId)) {
          const objNode = objectMap.get(objectId)!;
          let sectorNode = objNode.sectors.find(s => s.id === sector.id);
          if (!sectorNode) {
            sectorNode = { id: sector.id, name: sector.name, sections: [] };
            objNode.sectors.push(sectorNode);
          }
          let sectionNode = sectorNode.sections.find(s => s.id === section.id);
          if (!sectionNode) {
            sectionNode = { id: section.id, name: section.name, products: [] };
            sectorNode.sections.push(sectionNode);
          }
          sectionNode.products.push({
            id: sp.id,
            name: sp.name,
            contractId: contract.id,
            folders: contractFolderNodes,
          });
        } else if (!hasObjectKey) {
          noObjectProducts.push({
            contractId: contract.id,
            productName: sp.name,
            sectorName: sector.name,
            sectionName: section.name,
            folders: contractFolderNodes,
          });
        } else {
          noObjectProducts.push({
            contractId: contract.id,
            productName: sp.name,
            sectorName: sector.name,
            sectionName: section.name,
            folders: contractFolderNodes,
          });
        }
      }

      const objectNodes = Array.from(objectMap.values()).filter(o => o.sectors.length > 0);

      const conflicts: { objectId: number; paramName: string; values: { productName: string; value: string; contractId: number }[] }[] = [];
      for (const obj of objectNodes) {
        const paramByName = new Map<string, { productName: string; value: string; contractId: number }[]>();
        for (const sector of obj.sectors) {
          for (const section of sector.sections) {
            for (const product of section.products) {
              for (const folder of product.folders) {
                for (const panel of folder.panels) {
                  for (const param of panel.params) {
                    if (!paramByName.has(param.name)) paramByName.set(param.name, []);
                    paramByName.get(param.name)!.push({ productName: product.name, value: param.value, contractId: product.contractId });
                  }
                }
              }
            }
          }
        }
        for (const [paramName, entries] of paramByName) {
          const uniqueVals = new Set(entries.map(e => e.value));
          if (uniqueVals.size > 1) {
            conflicts.push({ objectId: obj.id, paramName, values: entries });
          }
        }
      }

      res.json({ objects: objectNodes, noObjectProducts, conflicts });
    } catch (err: any) {
      console.error("Object hierarchy error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/anonymize", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      const subjectId = Number(req.params.id);
      const result = await storage.anonymizeSubject(subjectId, appUser.id);
      await logAudit(req, { action: "ANONYMIZE", module: "subjekty", entityId: subjectId, entityName: `Anonymizácia subjektu ${result.uid}` });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/reveal", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const userPerms = appUser?.permissionGroup;
      const isSuperAdmin = userPerms?.name?.toLowerCase().includes("superadmin") || userPerms?.name?.toLowerCase().includes("prezident") || appUser?.role === 'superadmin';
      if (!isSuperAdmin) {
        return res.status(403).json({ message: "Len SuperAdmin môže odkryť anonymizované údaje" });
      }
      const subjectId = Number(req.params.id);
      const data = await storage.revealAnonymizedSubject(subjectId);
      await logAudit(req, { action: "REVEAL", module: "subjekty", entityId: subjectId, entityName: `Odkrytie anonymizovaného subjektu ${subjectId}` });
      res.json(data);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/collaborators", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const collaborators = await storage.getSubjectCollaborators(subjectId);
      res.json(collaborators);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/collaborators", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const { role, collaboratorUserId, collaboratorName, note } = req.body;
      if (!role || !['tiper', 'specialist', 'spravca'].includes(role)) {
        return res.status(400).json({ message: "Neplatná rola. Povolené: tiper, specialist, spravca" });
      }
      const collab = await storage.addSubjectCollaborator({
        subjectId,
        collaboratorUserId: collaboratorUserId || null,
        collaboratorName: collaboratorName || null,
        role,
        note: note || null,
        isActive: true,
        createdByUserId: req.appUser?.id || null,
      });
      await logAudit(req, { action: "CREATE", module: "subjekty_collaborators", entityId: collab.id, entityName: `${role} pre subjekt ${subjectId}` });
      res.status(201).json(collab);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/subjects/collaborators/:id/deactivate", isAuthenticated, async (req: any, res) => {
    try {
      const collabId = Number(req.params.id);
      const result = await storage.deactivateSubjectCollaborator(collabId);
      await logAudit(req, { action: "DEACTIVATE", module: "subjekty_collaborators", entityId: collabId });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.patch("/api/subjects/:id/supplementary-index", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { supplementaryIndex } = req.body;
      const appUser = req.appUser;
      const pgName = (appUser as any)?.permissionGroup?.name?.toLowerCase() || "";
      if (!pgName.includes("superadmin") && !pgName.includes("prezident")) {
        return res.status(403).json({ message: "Iba SuperAdmin môže nastaviť dodatkový index" });
      }
      await db.update(subjects).set({ supplementaryIndex }).where(eq(subjects.id, id));
      await logAudit(req, { action: "UPDATE", module: "Subjekty", entityId: id, entityName: `Dodatkový index: ${supplementaryIndex}` });
      res.json({ success: true, supplementaryIndex });
    } catch (err) {
      console.error("Supplementary index error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch("/api/subjects/:id/registration-status", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { registrationStatus } = req.body;
      const valid = ["potencialny", "tiper", "klient"];
      if (!valid.includes(registrationStatus)) {
        return res.status(400).json({ message: "Neplatný status: " + registrationStatus });
      }
      const appUser = req.appUser;
      if (!hasAdminAccess(appUser)) {
        return res.status(403).json({ message: "Nedostatočné oprávnenia" });
      }
      const [subj] = await db.select().from(subjects).where(eq(subjects.id, id)).limit(1);
      if (!subj) return res.status(404).json({ message: "Subjekt neexistuje" });
      const oldStatus = subj.registrationStatus || "tiper";
      if (oldStatus === registrationStatus) return res.json({ success: true });
      await db.update(subjects).set({ registrationStatus }).where(eq(subjects.id, id));
      await storage.recordFieldChanges(id, { registrationStatus: oldStatus }, { registrationStatus }, appUser?.id, "Manuálna zmena stavu overenia", appUser?.firstName + " " + appUser?.lastName);
      await logAudit(req, { action: "UPDATE", module: "subjekty", entityId: id, entityName: `${subj.firstName || ""} ${subj.lastName || subj.companyName || ""}`.trim(), oldData: { registrationStatus: oldStatus }, newData: { registrationStatus } });
      res.json({ success: true, registrationStatus });
    } catch (err) {
      console.error("Registration status update error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/admin/big-reset", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const pgName = (appUser as any)?.permissionGroup?.name?.toLowerCase() || "";
      if (!pgName.includes("superadmin") && !pgName.includes("prezident")) {
        return res.status(403).json({ message: "Iba SuperAdmin môže vykonať reset" });
      }
      const { confirmCode } = req.body;
      if (confirmCode !== "RESET-ARUTSOK-2025") {
        return res.status(400).json({ message: "Nesprávny potvrdzovací kód" });
      }
      
      await db.delete(subjectPointsLog);
      await db.delete(subjectFieldHistory);
      await db.delete(subjectCollaborators);
      await db.delete(clientMarketingConsents);
      await db.delete(clientDocumentHistory);
      await db.delete(contractAcquirers);
      await db.delete(contractStatusChangeLogs);
      await db.delete(contractPasswords);
      await db.delete(contractRewardDistributions);
      await db.delete(contractParameterValues);
      await db.delete(contracts);
      await db.delete(subjectArchive);
      await db.delete(subjects);
      await db.delete(auditLogs);
      
      await db.update(globalCounters).set({ currentValue: 0 }).where(eq(globalCounters.counterName, "subject_uid"));
      await db.update(globalCounters).set({ currentValue: 0 }).where(eq(globalCounters.counterName, "contract_global_number"));
      
      await logAudit(req, { action: "RESET", module: "System", entityName: "Veľký Reset - vymazanie všetkých testovacích dát" });
      
      res.json({ success: true, message: "Všetky testovacie dáta boli vymazané. UID počítadlo resetované." });
    } catch (err) {
      console.error("Big reset error:", err);
      res.status(500).json({ message: "Chyba pri resete: " + (err as any).message });
    }
  });

  app.post("/api/subjects/check-duplicates", isAuthenticated, async (req: any, res) => {
    try {
      const { birthNumber, spz, vin } = req.body;
      let encryptedBN = birthNumber;
      if (birthNumber) {
        encryptedBN = encryptField(birthNumber);
      }
      const results = await storage.checkDuplicates({ birthNumber: encryptedBN, spz, vin });
      res.json(results.map((s: any) => ({ id: s.id, uid: s.uid, type: s.type, firstName: s.firstName, lastName: s.lastName, companyName: s.companyName })));
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/risk-links", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const [riskLinks, foPoRisks] = await Promise.all([
        storage.findRiskLinks(subjectId),
        storage.findLinkedFoPoRisks(subjectId),
      ]);
      res.json({ riskLinks, foPoRisks });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/log-view", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });

      if (!await checkKlientiSubjectAccess(appUser, subjectId)) {
        return res.status(403).json({ message: "Prístup zamietnutý" });
      }

      const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
      const ua = req.headers['user-agent'] || '';
      const deviceType = /mobile|android|iphone|ipad/i.test(ua) ? 'mobile' : /tablet/i.test(ua) ? 'tablet' : 'desktop';

      await storage.createAuditLog({
        userId: appUser.id,
        username: appUser.username,
        action: "VIEW_PROFILE",
        module: "subjects",
        entityId: subjectId,
        entityName: `Náhľad profilu subjektu ${subjectId}`,
      });

      await db.insert(activityEvents).values({
        subjectId,
        eventType: "card_open",
        userId: appUser.id,
        username: appUser.username,
        ipAddress: typeof ip === 'string' ? ip : JSON.stringify(ip),
        deviceType,
      });

      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/subjects/:id/log-field-access", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const { fields } = req.body;
      if (!Array.isArray(fields) || fields.length === 0) return res.json({ ok: true });
      const appUser = req.appUser;
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      await storage.createAuditLog({
        userId: appUser.id,
        username: appUser.username,
        action: "FIELD_VIEW",
        module: "subjekty",
        entityId: subjectId,
        entityName: `Zobrazenie citlivých polí: ${fields.join(", ")}`,
        newData: { fields },
      });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Internal error" });
    }
  });

  app.post("/api/admin/recalculate-all-bonita", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const userPerms = appUser?.permissionGroup;
      const isSuperAdmin = userPerms?.name?.toLowerCase().includes("superadmin") || userPerms?.name?.toLowerCase().includes("prezident");
      if (!isSuperAdmin) {
        return res.status(403).json({ message: "Len SuperAdmin/Prezident môže spustiť hromadný prepočet" });
      }

      console.log("[BONITA MIGRATION] Starting bulk recalculation...");
      const result = await storage.recalculateAllBonita();
      console.log(`[BONITA MIGRATION] Done: processed=${result.processed}, updated=${result.updated}, errors=${result.errors}`);

      await logAudit(req, {
        action: "ADMIN",
        module: "bonita",
        entityId: 0,
        entityName: "Hromadný prepočet bonity",
        oldData: {},
        newData: result,
      });

      res.json(result);
    } catch (err: any) {
      console.error("[BONITA MIGRATION] Error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  await seedDatabase();

  {
    const allPgs = await storage.getPermissionGroups();
    let synced = 0;
    for (const pg of allPgs) {
      const existing = await storage.getClientGroupByPermissionGroupId(pg.id);
      if (!existing) {
        await storage.createClientGroup({ name: pg.name, permissionGroupId: pg.id });
        synced++;
      }
    }
    if (synced > 0) console.log(`[SYNC] Auto-created ${synced} client groups from permission groups`);
  }

  {
    const systemGroups: Array<{ name: string; groupCode: string; allowLogin?: boolean }> = [
      { name: "Klienti", groupCode: "group_klient" },
      { name: "Registrovaní klienti", groupCode: "group_registrovany" },
      { name: "Červený zoznam", groupCode: "group_cerveny_zoznam" },
      { name: "Čierny zoznam - Podvodníci", groupCode: "group_cierny_zoznam", allowLogin: false },
    ];
    for (const sg of systemGroups) {
      const existing = await db.select().from(clientGroups).where(eq(clientGroups.groupCode, sg.groupCode));
      if (existing.length === 0) {
        await db.insert(clientGroups).values({ name: sg.name, groupCode: sg.groupCode, isSystem: true, permissionLevel: 1, ...(sg.allowLogin !== undefined ? { allowLogin: sg.allowLogin } : {}) });
        console.log(`[SEED] Created system group: ${sg.name}`);
      } else {
        const updates: any = {};
        if (!existing[0].isSystem) updates.isSystem = true;
        if (sg.allowLogin !== undefined && existing[0].allowLogin !== sg.allowLogin) updates.allowLogin = sg.allowLogin;
        if (Object.keys(updates).length > 0) {
          await db.update(clientGroups).set(updates).where(eq(clientGroups.id, existing[0].id));
        }
      }
    }
  }

  await storage.autoArchiveExpiredBindings();
  setInterval(() => storage.autoArchiveExpiredBindings(), 60 * 60 * 1000);

  scheduleUndeliveredContractsCheck();

  // === ANALYTICS & REPORTING ===
  app.get("/api/reports/production", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin';
      if (!isAdmin) return res.status(403).json({ message: "Len admin/superadmin" });

      const stateId = getEnforcedStateId(req);
      const filterFrom = req.query.from as string | undefined;
      const filterTo = req.query.to as string | undefined;
      const filterPartnerId = req.query.partnerId ? Number(req.query.partnerId) : undefined;
      const filterAgentId = req.query.agentId ? Number(req.query.agentId) : undefined;
      const filterStatus = req.query.status ? Number(req.query.status) : undefined;
      const filterContractType = req.query.contractType as string | undefined;
      const filterPremiumMin = req.query.premiumMin ? Number(req.query.premiumMin) : undefined;
      const filterPremiumMax = req.query.premiumMax ? Number(req.query.premiumMax) : undefined;
      const filterPaymentFrequency = req.query.paymentFrequency as string | undefined;
      const filterExpiryFrom = req.query.expiryFrom as string | undefined;
      const filterExpiryTo = req.query.expiryTo as string | undefined;
      const filterListStatus = req.query.listStatus as string | undefined;
      const filterSubjectType = req.query.subjectType as string | undefined;
      const filterPsc = req.query.psc as string | undefined;

      const conditions: any[] = [eq(contracts.isDeleted, false)];
      if (stateId) conditions.push(eq(contracts.stateId, stateId));
      if (filterPartnerId) conditions.push(eq(contracts.partnerId, filterPartnerId));
      if (filterStatus) conditions.push(eq(contracts.statusId, filterStatus));
      if (filterContractType) conditions.push(eq(contracts.contractType, filterContractType));
      if (filterFrom) conditions.push(gte(contracts.signedDate, new Date(filterFrom)));
      if (filterTo) conditions.push(lte(contracts.signedDate, new Date(filterTo)));
      if (filterPremiumMin) conditions.push(gte(contracts.premiumAmount, filterPremiumMin));
      if (filterPremiumMax) conditions.push(lte(contracts.premiumAmount, filterPremiumMax));
      if (filterPaymentFrequency) conditions.push(eq(contracts.paymentFrequency, filterPaymentFrequency));
      if (filterExpiryFrom) conditions.push(gte(contracts.expiryDate, new Date(filterExpiryFrom)));
      if (filterExpiryTo) conditions.push(lte(contracts.expiryDate, new Date(filterExpiryTo)));

      if (filterPsc) {
        const pscSubjectRows = await db.select({ subjectId: subjectAddresses.subjectId })
          .from(subjectAddresses)
          .where(eq(subjectAddresses.psc, filterPsc));
        const pscSubjectIds = pscSubjectRows.map((r: any) => r.subjectId);
        if (pscSubjectIds.length > 0) {
          conditions.push(inArray(contracts.subjectId, pscSubjectIds));
        } else {
          return res.json({ kpi: { totalPremium: 0, stornoCount: 0, stornoAmount: 0, actualCashflow: 0, netProduction: 0, crossSellPotential: 0, redListCount: 0 }, records: [], totalRecords: 0, partnerBreakdown: [], monthlyTrend: [], contractTypes: [] });
        }
      }

      if (filterAgentId) {
        const agentContractIdRows = await db.select({ contractId: contractAcquirers.contractId })
          .from(contractAcquirers)
          .where(eq(contractAcquirers.userId, filterAgentId));
        const agentContractIdSet = agentContractIdRows.map((r: any) => r.contractId);
        if (agentContractIdSet.length > 0) {
          conditions.push(inArray(contracts.id, agentContractIdSet));
        } else {
          return res.json({ kpi: { totalPremium: 0, stornoCount: 0, stornoAmount: 0, actualCashflow: 0, netProduction: 0, crossSellPotential: 0, redListCount: 0 }, records: [], totalRecords: 0, partnerBreakdown: [], monthlyTrend: [], contractTypes: [] });
        }
      }

      const filtered: any[] = await db.select({
        id: contracts.id,
        uid: contracts.uid,
        globalNumber: contracts.globalNumber,
        contractNumber: contracts.contractNumber,
        premiumAmount: contracts.premiumAmount,
        annualPremium: contracts.annualPremium,
        commissionAmount: contracts.commissionAmount,
        signedDate: contracts.signedDate,
        expiryDate: contracts.expiryDate,
        subjectId: contracts.subjectId,
        partnerId: contracts.partnerId,
        statusId: contracts.statusId,
        contractType: contracts.contractType,
        paymentFrequency: contracts.paymentFrequency,
        dynamicPanelValues: contracts.dynamicPanelValues,
      }).from(contracts)
        .where(and(...conditions))
        .orderBy(desc(contracts.id))
        .limit(2000);

      const allStatuses = await storage.getContractStatuses(stateId);
      const statusMap = new Map(allStatuses.map((s: any) => [s.id, s]));
      const stornoStatusIds = new Set(allStatuses.filter((s: any) => s.isStorno).map((s: any) => s.id));

      let totalPremium = 0;
      let stornoCount = 0;
      let stornoAmount = 0;
      let actualCashflow = 0;

      for (const c of filtered) {
        const premium = c.premiumAmount || c.annualPremium || 0;
        const isStorno = c.statusId ? stornoStatusIds.has(c.statusId) : false;
        if (isStorno) {
          stornoCount++;
          stornoAmount += premium;
        } else {
          totalPremium += premium;
        }
        actualCashflow += c.commissionAmount || 0;
      }

      const netProduction = totalPremium - stornoAmount;

      const subjectIds = [...new Set(filtered.map((c: any) => c.subjectId).filter(Boolean))];
      const subjectMap = new Map<number, any>();
      for (const sid of subjectIds) {
        const s = await storage.getSubject(sid);
        if (s) subjectMap.set(sid, s);
      }

      const partnerIds = [...new Set(filtered.map((c: any) => c.partnerId).filter(Boolean))];
      const partnerMap = new Map<number, any>();
      for (const pid of partnerIds) {
        const p = await storage.getPartner(pid);
        if (p) partnerMap.set(pid, p);
      }

      let postFilteredContracts = filtered;
      if (filterListStatus) {
        const targetStatus = filterListStatus === 'clean' ? null : filterListStatus;
        postFilteredContracts = postFilteredContracts.filter((c: any) => {
          const subj = c.subjectId ? subjectMap.get(c.subjectId) : null;
          if (!subj) return false;
          return targetStatus === null ? (!subj.listStatus) : subj.listStatus === targetStatus;
        });
      }
      if (filterSubjectType) {
        const allowedTypes = filterSubjectType.split(",").map((t: string) => t.trim()).filter(Boolean);
        postFilteredContracts = postFilteredContracts.filter((c: any) => {
          const subj = c.subjectId ? subjectMap.get(c.subjectId) : null;
          return subj?.type && allowedTypes.includes(subj.type);
        });
      }

      const subjectContractCounts = new Map<number, { count: number; hasLife: boolean }>();
      for (const c of postFilteredContracts) {
        if (!c.subjectId) continue;
        const existing = subjectContractCounts.get(c.subjectId) || { count: 0, hasLife: false };
        existing.count++;
        const ct = (c.contractType || '').toLowerCase();
        if (ct.includes('život') || ct.includes('zivot') || ct === 'life') existing.hasLife = true;
        subjectContractCounts.set(c.subjectId, existing);
      }
      let crossSellPotential = 0;
      for (const [, data] of subjectContractCounts) {
        if (data.count >= 3 && !data.hasLife) crossSellPotential++;
      }

      let redListCount = 0;
      const redListSubjectIds = new Set<number>();
      for (const [sid, subj] of subjectMap) {
        if (subj.listStatus === 'cerveny') {
          redListCount++;
          redListSubjectIds.add(sid);
        }
      }

      const records = postFilteredContracts.map((c: any) => {
        const subject = c.subjectId ? subjectMap.get(c.subjectId) : null;
        const st = c.statusId ? statusMap.get(c.statusId) : null;
        const df = c.dynamicPanelValues as any;
        return {
          contractUid: c.uid || c.contractNumber || `${c.id}`,
          globalNumber: c.globalNumber,
          clientName: subject ? (subject.type === 'person'
            ? `${subject.titleBefore ? subject.titleBefore + ' ' : ''}${subject.firstName || ''} ${subject.lastName || ''}${subject.titleAfter ? ', ' + subject.titleAfter : ''}`.trim()
            : subject.companyName || '') : '',
          licensePlate: df?.spz || df?.SPZ || df?.ecv || df?.ECV || '',
          premiumAmount: c.premiumAmount || c.annualPremium || 0,
          statusName: st?.name || '',
          statusColor: st?.color || null,
          signedDate: c.signedDate,
          expiryDate: c.expiryDate,
          partnerName: c.partnerId ? partnerMap.get(c.partnerId)?.name || '' : '',
          contractType: c.contractType || '',
          paymentFrequency: c.paymentFrequency || '',
          subjectType: subject?.type || '',
          listStatus: subject?.listStatus || null,
        };
      });

      const partnerPremiums = new Map<string, { totalPremium: number; count: number }>();
      const monthlyPremiums = new Map<string, number>();
      const contractTypeSet = new Set<string>();

      for (const c of postFilteredContracts) {
        const premium = c.premiumAmount || c.annualPremium || 0;
        const pName = c.partnerId ? (partnerMap.get(c.partnerId)?.name || 'Neznámy') : 'Bez partnera';
        const existing = partnerPremiums.get(pName) || { totalPremium: 0, count: 0 };
        existing.totalPremium += premium;
        existing.count++;
        partnerPremiums.set(pName, existing);

        if (c.signedDate) {
          const d = new Date(c.signedDate);
          const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          monthlyPremiums.set(monthKey, (monthlyPremiums.get(monthKey) || 0) + premium);
        }

        if (c.contractType) contractTypeSet.add(c.contractType);
      }

      const partnerBreakdown = [...partnerPremiums.entries()]
        .map(([name, data]) => ({ partnerName: name, totalPremium: data.totalPremium, count: data.count }))
        .sort((a, b) => b.totalPremium - a.totalPremium);

      const monthlyTrend = [...monthlyPremiums.entries()]
        .map(([month, totalPremium]) => ({ month, totalPremium }))
        .sort((a, b) => a.month.localeCompare(b.month));

      const usedModuleC = !!(filterPsc || filterPaymentFrequency || filterPremiumMin || filterPremiumMax);
      if (records.length > 500 || usedModuleC) {
        await logAudit(req, {
          action: usedModuleC ? "DEEP_DIVE_ACCESS" : "MASSIVE_DATA_ACCESS",
          module: "reports",
          entityName: `Production report: ${records.length} records${usedModuleC ? ' [Module C filters]' : ''}`,
          newData: { recordCount: records.length, filters: { from: filterFrom, to: filterTo, partnerId: filterPartnerId, agentId: filterAgentId, status: filterStatus, contractType: filterContractType, premiumMin: filterPremiumMin, premiumMax: filterPremiumMax, paymentFrequency: filterPaymentFrequency, listStatus: filterListStatus, subjectType: filterSubjectType, psc: filterPsc, stateId } },
        });
      }

      res.json({
        kpi: { totalPremium, stornoCount, stornoAmount, actualCashflow, netProduction, crossSellPotential, redListCount },
        records,
        totalRecords: records.length,
        partnerBreakdown,
        monthlyTrend,
        contractTypes: [...contractTypeSet].sort(),
      });
    } catch (err: any) {
      console.error("Reports production error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/reports/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!isAdmin(appUser)) {
        return res.status(403).json({ message: "Len admin/superadmin" });
      }

      const filterFrom = req.query.from as string | undefined;
      const filterTo = req.query.to as string | undefined;
      const filterStatusId = req.query.statusId ? Number(req.query.statusId) : undefined;

      const conditions: any[] = [];
      if (filterFrom) conditions.push(gte(systemNotifications.createdAt, new Date(filterFrom)));
      if (filterTo) {
        const toDate = new Date(filterTo);
        toDate.setHours(23, 59, 59, 999);
        conditions.push(lte(systemNotifications.createdAt, toDate));
      }
      if (filterStatusId) {
        const matchingContractRows = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.statusId, filterStatusId));
        const matchingContractIds = matchingContractRows.map(r => r.id);
        if (matchingContractIds.length > 0) {
          conditions.push(inArray(systemNotifications.relatedContractId, matchingContractIds));
        } else {
          return res.json({ kpi: { total: 0, sent: 0, failed: 0, pending: 0 }, dailyTimeline: [], monthlyOverview: [], failedList: [] });
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const allNotifications = await db.select({
        id: systemNotifications.id,
        recipientEmail: systemNotifications.recipientEmail,
        recipientName: systemNotifications.recipientName,
        subject: systemNotifications.subject,
        status: systemNotifications.status,
        notificationType: systemNotifications.notificationType,
        relatedContractId: systemNotifications.relatedContractId,
        errorDetails: systemNotifications.errorDetails,
        sentAt: systemNotifications.sentAt,
        createdAt: systemNotifications.createdAt,
      }).from(systemNotifications)
        .where(whereClause)
        .orderBy(desc(systemNotifications.createdAt))
        .limit(5000);

      let sentCount = 0;
      let failedCount = 0;
      let pendingCount = 0;
      let emailCount = 0;
      let smsCount = 0;

      for (const n of allNotifications) {
        if (n.status === 'sent') sentCount++;
        else if (n.status === 'failed') failedCount++;
        else pendingCount++;
        if (n.notificationType?.includes('sms')) smsCount++;
        else emailCount++;
      }

      const dailyMap = new Map<string, { sent: number; failed: number; pending: number; email: number; sms: number }>();
      for (const n of allNotifications) {
        const d = n.createdAt ? new Date(n.createdAt) : new Date();
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const entry = dailyMap.get(dayKey) || { sent: 0, failed: 0, pending: 0, email: 0, sms: 0 };
        if (n.status === 'sent') entry.sent++;
        else if (n.status === 'failed') entry.failed++;
        else entry.pending++;
        if (n.notificationType?.includes('sms')) entry.sms++;
        else entry.email++;
        dailyMap.set(dayKey, entry);
      }

      const dailyTimeline = [...dailyMap.entries()]
        .map(([date, counts]) => ({ date, ...counts }))
        .sort((a, b) => a.date.localeCompare(b.date));

      const monthlyMap = new Map<string, { sent: number; failed: number; pending: number }>();
      for (const n of allNotifications) {
        const d = n.createdAt ? new Date(n.createdAt) : new Date();
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const entry = monthlyMap.get(monthKey) || { sent: 0, failed: 0, pending: 0 };
        if (n.status === 'sent') entry.sent++;
        else if (n.status === 'failed') entry.failed++;
        else entry.pending++;
        monthlyMap.set(monthKey, entry);
      }

      const monthlyOverview = [...monthlyMap.entries()]
        .map(([month, counts]) => ({ month, ...counts }))
        .sort((a, b) => a.month.localeCompare(b.month));

      const failedNotifications = allNotifications.filter(n => n.status === 'failed');

      const contractIds = [...new Set(failedNotifications.map(n => n.relatedContractId).filter(Boolean))] as number[];
      const contractMap = new Map<number, any>();
      if (contractIds.length > 0) {
        const contractRows = await db.select({
          id: contracts.id,
          contractNumber: contracts.contractNumber,
          uid: contracts.uid,
          statusId: contracts.statusId,
        }).from(contracts).where(inArray(contracts.id, contractIds));
        for (const c of contractRows) {
          contractMap.set(c.id, c);
        }
      }

      const allStatuses = await storage.getContractStatuses();
      const statusMap = new Map(allStatuses.map((s: any) => [s.id, s.name]));

      const failedList = failedNotifications.map(n => {
        const contract = n.relatedContractId ? contractMap.get(n.relatedContractId) : null;
        return {
          id: n.id,
          recipientEmail: n.recipientEmail,
          recipientName: n.recipientName,
          notificationType: n.notificationType,
          errorDetails: n.errorDetails,
          contractNumber: contract?.contractNumber || contract?.uid || null,
          contractStatusName: contract?.statusId ? statusMap.get(contract.statusId) || null : null,
          createdAt: n.createdAt,
        };
      });

      await logAudit(req, {
        action: "REPORT_VIEW",
        module: "reports",
        entityName: `Notification report: ${allNotifications.length} records`,
        newData: { from: filterFrom, to: filterTo, statusId: filterStatusId },
      });

      res.json({
        kpi: {
          total: allNotifications.length,
          sent: sentCount,
          failed: failedCount,
          pending: pendingCount,
          email: emailCount,
          sms: smsCount,
        },
        dailyTimeline,
        monthlyOverview,
        failedList,
      });
    } catch (err: any) {
      console.error("Reports notifications error:", err);
      res.status(500).json({ message: err.message });
    }
  });

  // === HOLDING DASHBOARD — MODULE C ===

  let ecbRateCache: { rate: number; timestamp: number } | null = null;
  const ECB_CACHE_DURATION = 24 * 60 * 60 * 1000;
  const ECB_FALLBACK_RATE = 25.2;

  async function fetchEcbRate(): Promise<number> {
    if (ecbRateCache && (Date.now() - ecbRateCache.timestamp) < ECB_CACHE_DURATION) {
      return ecbRateCache.rate;
    }
    try {
      const resp = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml");
      const text = await resp.text();
      const match = text.match(/currency='CZK'\s+rate='([0-9.]+)'/);
      if (match) {
        const rate = parseFloat(match[1]);
        ecbRateCache = { rate, timestamp: Date.now() };
        return rate;
      }
    } catch (err) {
      console.error("[ECB] Failed to fetch rate:", err);
    }
    if (ecbRateCache) return ecbRateCache.rate;
    ecbRateCache = { rate: ECB_FALLBACK_RATE, timestamp: Date.now() };
    return ECB_FALLBACK_RATE;
  }

  const holdingExportCounters = new Map<number, { count: number; firstAt: number }>();

  function checkExportLimit(userId: number): { allowed: boolean; count: number } {
    const now = Date.now();
    const entry = holdingExportCounters.get(userId);
    if (!entry || (now - entry.firstAt) > 3600000) {
      holdingExportCounters.set(userId, { count: 1, firstAt: now });
      return { allowed: true, count: 1 };
    }
    entry.count++;
    if (entry.count > 3) {
      return { allowed: false, count: entry.count };
    }
    return { allowed: true, count: entry.count };
  }

  function enforceHoldingAccess(req: any, res: any): { isHolding: boolean } | null {
    if (!isAdmin(req.appUser)) {
      res.status(403).json({ message: "Prístup vyžaduje administrátora" });
      return null;
    }
    const isHolding = isArchitekt(req.appUser);
    if (!isHolding && !req.appUser.activeCompanyId) {
      res.status(400).json({ message: "Vyberte aktívnu spoločnosť pred prístupom k dashboardu" });
      return null;
    }
    return { isHolding };
  }

  app.get("/api/holding-dashboard/kpi", isAuthenticated, async (req: any, res) => {
    try {
      const access = enforceHoldingAccess(req, res);
      if (!access) return;

      const companyFilter = access.isHolding && req.query.allCompanies === "true"
        ? sql`1=1`
        : req.appUser.activeCompanyId
          ? eq(contracts.companyId, req.appUser.activeCompanyId)
          : sql`1=1`;

      const subjectCompanyFilter = access.isHolding && req.query.allCompanies === "true"
        ? sql`1=1`
        : req.appUser.activeCompanyId
          ? eq(subjects.myCompanyId, req.appUser.activeCompanyId)
          : sql`1=1`;

      const [subjectCount] = await db.select({
        count: sql<number>`count(*)::int`
      }).from(subjects).where(and(
        eq(subjects.isActive, true),
        isNull(subjects.deletedAt),
        subjectCompanyFilter
      ));

      const allStatuses = await db.select().from(contractStatuses);
      const stornoStatusIds = allStatuses.filter(s => s.isStorno).map(s => s.id);

      const [contractStats] = await db.select({
        totalCount: sql<number>`count(*)::int`,
        totalPremium: sql<number>`COALESCE(sum(COALESCE(premium_amount, annual_premium, 0)), 0)::int`,
        stornoCount: sql<number>`count(*) FILTER (WHERE ${stornoStatusIds.length > 0 ? inArray(contracts.statusId, stornoStatusIds) : sql`false`})::int`,
      }).from(contracts).where(and(
        eq(contracts.isDeleted, false),
        companyFilter
      ));

      const [crossSellData] = await db.select({
        totalSubjectsWithContracts: sql<number>`count(DISTINCT subject_id)::int`,
        totalContracts: sql<number>`count(*)::int`,
      }).from(contracts).where(and(
        eq(contracts.isDeleted, false),
        companyFilter,
        isNotNull(contracts.subjectId)
      ));

      const crossSellIndex = crossSellData.totalSubjectsWithContracts > 0
        ? Math.round((crossSellData.totalContracts / crossSellData.totalSubjectsWithContracts) * 100) / 100
        : 0;

      const stornoRate = contractStats.totalCount > 0
        ? Math.round((contractStats.stornoCount / contractStats.totalCount) * 10000) / 100
        : 0;

      res.json({
        totalSubjects: subjectCount.count,
        totalContracts: contractStats.totalCount,
        gwp: contractStats.totalPremium,
        crossSellIndex,
        stornoRate,
        stornoCount: contractStats.stornoCount,
        isHoldingView: access.isHolding && req.query.allCompanies === "true",
      });
    } catch (err: any) {
      console.error("[HOLDING-KPI]", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/holding-dashboard/crosssell", isAuthenticated, async (req: any, res) => {
    try {
      const access = enforceHoldingAccess(req, res);
      if (!access) return;

      const companyFilter = access.isHolding && req.query.allCompanies === "true"
        ? sql`1=1`
        : req.appUser.activeCompanyId
          ? eq(contracts.companyId, req.appUser.activeCompanyId)
          : sql`1=1`;

      const allSectors = await db.select().from(sectors).where(eq(sectors.isActive, true));

      const sectorEmojis: Record<number, string> = {};
      const EMOJI_MAP: Record<string, string> = {
        "poistenie": "🛡️", "zivotne": "❤️", "majetok": "🏠", "auto": "🚗", "pzp": "🚗",
        "kasko": "🚙", "cestovne": "✈️", "zodpovednost": "⚖️", "uver": "💰", "hypo": "🏦",
        "investic": "📈", "sporenie": "🐷", "dochodok": "👴", "uraz": "🩹", "nehnutel": "🏗️",
        "priemysel": "🏭", "flot": "🚛", "zdravot": "🏥", "pravne": "📋", "energia": "⚡",
      };
      for (const sec of allSectors) {
        const nameLower = sec.name.toLowerCase();
        let emoji = "📄";
        for (const [key, em] of Object.entries(EMOJI_MAP)) {
          if (nameLower.includes(key)) { emoji = em; break; }
        }
        sectorEmojis[sec.id] = emoji;
      }

      const contractsWithSectors = await db.select({
        subjectId: contracts.subjectId,
        sectorProductId: contracts.sectorProductId,
        productId: contracts.productId,
      }).from(contracts).where(and(
        eq(contracts.isDeleted, false),
        isNotNull(contracts.subjectId),
        companyFilter
      ));

      const allSectorProducts = await db.select().from(sectorProducts);
      const spSectorMap = new Map(allSectorProducts.map(sp => [sp.id, sp.sectionId]));
      const allSections = await db.select().from(sections);
      const sectionSectorMap = new Map(allSections.map(sec => [sec.id, sec.sectorId]));

      const subjectSectorCoverage = new Map<number, Set<number>>();
      for (const c of contractsWithSectors) {
        if (!c.subjectId) continue;
        let sectorId: number | null = null;
        if (c.sectorProductId) {
          const sectionId = spSectorMap.get(c.sectorProductId);
          if (sectionId) sectorId = sectionSectorMap.get(sectionId) || null;
        }
        if (!sectorId) continue;
        if (!subjectSectorCoverage.has(c.subjectId)) subjectSectorCoverage.set(c.subjectId, new Set());
        subjectSectorCoverage.get(c.subjectId)!.add(sectorId);
      }

      const sectorCoverage: Record<number, number> = {};
      const sectorGaps: Record<number, number> = {};
      const totalSubjects = subjectSectorCoverage.size;

      for (const sec of allSectors) {
        sectorCoverage[sec.id] = 0;
        sectorGaps[sec.id] = 0;
      }

      for (const [, coveredSectors] of subjectSectorCoverage) {
        for (const sec of allSectors) {
          if (coveredSectors.has(sec.id)) {
            sectorCoverage[sec.id]++;
          } else {
            sectorGaps[sec.id]++;
          }
        }
      }

      const matrix = allSectors.map(sec => ({
        sectorId: sec.id,
        sectorName: sec.name,
        emoji: sectorEmojis[sec.id] || "📄",
        covered: sectorCoverage[sec.id] || 0,
        gaps: sectorGaps[sec.id] || 0,
        coveragePercent: totalSubjects > 0 ? Math.round((sectorCoverage[sec.id] / totalSubjects) * 100) : 0,
      }));

      res.json({
        totalSubjectsWithContracts: totalSubjects,
        sectors: matrix,
      });
    } catch (err: any) {
      console.error("[HOLDING-CROSSSELL]", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/holding-dashboard/divisions", isAuthenticated, async (req: any, res) => {
    try {
      const access = enforceHoldingAccess(req, res);
      if (!access) return;

      const allDivisions = await db.select().from(divisions).where(eq(divisions.isActive, true));
      const allSectors = await db.select().from(sectors).where(eq(sectors.isActive, true));
      const sectorDivisionMap = new Map(allSectors.map(s => [s.id, s.divisionId]));

      const allSectorProducts = await db.select().from(sectorProducts);
      const spSectionMap = new Map(allSectorProducts.map(sp => [sp.id, sp.sectionId]));
      const allSections = await db.select().from(sections);
      const sectionSectorMap2 = new Map(allSections.map(sec => [sec.id, sec.sectorId]));

      const companyFilter = access.isHolding && req.query.allCompanies === "true"
        ? sql`1=1`
        : req.appUser.activeCompanyId
          ? eq(contracts.companyId, req.appUser.activeCompanyId)
          : sql`1=1`;

      const allContracts = await db.select({
        id: contracts.id,
        sectorProductId: contracts.sectorProductId,
        premiumAmount: contracts.premiumAmount,
        annualPremium: contracts.annualPremium,
        statusId: contracts.statusId,
        currency: contracts.currency,
      }).from(contracts).where(and(
        eq(contracts.isDeleted, false),
        companyFilter
      ));

      const allStatuses = await db.select().from(contractStatuses);
      const stornoStatusIds2 = new Set(allStatuses.filter(s => s.isStorno).map(s => s.id));

      const divisionStats = new Map<number, { production: number; count: number; storno: number }>();
      for (const div of allDivisions) {
        divisionStats.set(div.id, { production: 0, count: 0, storno: 0 });
      }

      for (const c of allContracts) {
        let divisionId: number | null = null;
        if (c.sectorProductId) {
          const sectionId = spSectionMap.get(c.sectorProductId);
          if (sectionId) {
            const sectorId = sectionSectorMap2.get(sectionId);
            if (sectorId) divisionId = sectorDivisionMap.get(sectorId) || null;
          }
        }
        if (!divisionId) continue;
        const stats = divisionStats.get(divisionId);
        if (!stats) continue;
        stats.count++;
        stats.production += c.premiumAmount || c.annualPremium || 0;
        if (c.statusId && stornoStatusIds2.has(c.statusId)) stats.storno++;
      }

      const heatmap = allDivisions.map(div => {
        const stats = divisionStats.get(div.id) || { production: 0, count: 0, storno: 0 };
        return {
          divisionId: div.id,
          divisionName: div.name,
          emoji: div.emoji || "📁",
          production: stats.production,
          contractCount: stats.count,
          stornoCount: stats.storno,
          stornoRate: stats.count > 0 ? Math.round((stats.storno / stats.count) * 10000) / 100 : 0,
        };
      });

      res.json({ divisions: heatmap });
    } catch (err: any) {
      console.error("[HOLDING-DIVISIONS]", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/holding-dashboard/exchange-rate", isAuthenticated, async (req: any, res) => {
    try {
      const access = enforceHoldingAccess(req, res);
      if (!access) return;

      const rate = await fetchEcbRate();
      res.json({
        eurCzk: rate,
        czkEur: Math.round((1 / rate) * 1000000) / 1000000,
        cachedAt: ecbRateCache?.timestamp ? new Date(ecbRateCache.timestamp).toISOString() : null,
        source: "ECB",
      });
    } catch (err: any) {
      console.error("[ECB-RATE]", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/holding-dashboard/export-log", isAuthenticated, async (req: any, res) => {
    try {
      const access = enforceHoldingAccess(req, res);
      if (!access) return;

      const appUser = req.appUser;
      const { exportType, reportName } = req.body;

      const { allowed, count } = checkExportLimit(appUser.id);

      await logAudit(req, {
        action: "HOLDING_EXPORT",
        module: "holding_dashboard",
        entityName: reportName || "Holding Export",
        newData: { exportType, reportName, exportCount: count, limitExceeded: !allowed },
      });

      if (!allowed) {
        const architects = await db.select().from(appUsers).where(
          and(eq(appUsers.role, "architekt"))
        );
        for (const arch of architects) {
          try {
            await db.insert(systemNotifications).values({
              recipientUserId: arch.id,
              type: "anti_mass_export",
              subject: "Anti-Mass-Export upozornenie",
              body: `Používateľ ${appUser.username} vygeneroval ${count} holdingových reportov za poslednú hodinu. Limit 3/h prekročený.`,
              status: "pending",
            } as any);
          } catch {}
        }

        return res.status(429).json({
          message: "Prekročili ste limit 3 veľkých holdingových reportov za hodinu. Architekt bol notifikovaný.",
          count,
        });
      }

      res.json({ success: true, count });
    } catch (err: any) {
      console.error("[HOLDING-EXPORT]", err);
      res.status(500).json({ message: err.message });
    }
  });

  // === SUBJECT PHOTOS (Profile Photo with Versioning) ===
  app.get("/api/subjects/:id/photos", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const photos = await db.select().from(subjectPhotos)
        .where(eq(subjectPhotos.subjectId, subjectId))
        .orderBy(subjectPhotos.createdAt);
      res.json(photos);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/subjects/:id/active-photo", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const allPhotos = await db.select().from(subjectPhotos)
        .where(eq(subjectPhotos.subjectId, subjectId));
      const activePhotos = allPhotos
        .filter(p => p.isActive)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      res.json(activePhotos.length > 0 ? activePhotos[0] : null);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/subject-photos/file/:filename", isAuthenticated, async (req: any, res) => {
    try {
      const filename = req.params.filename;
      if (filename.includes("..") || filename.includes("/")) {
        return res.status(400).json({ message: "Invalid filename" });
      }
      const [photo] = (await db.select().from(subjectPhotos)).filter(p => p.fileName === filename);
      if (photo) {
        if (!await checkKlientiSubjectAccess(req.appUser, photo.subjectId)) {
          return res.status(403).json({ message: "Pristup zamietnuty" });
        }
      }
      const filePath = path.join(UPLOADS_DIR, "subject-photos", filename);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      res.sendFile(filePath);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/subjects/:id/photos/upload", isAuthenticated, (req: any, _res, next) => {
    (req as any)._uploadSection = "subject-photos";
    next();
  }, upload.single("photo"), async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Ziaden subor nebol nahrany" });
      const secScan = await scanUploadedFile(file.path, file.originalname, file.mimetype);
      if (!secScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: ${secScan.reason}` });

      const source = req.body.source || "manual";
      const sourceDocumentId = req.body.sourceDocumentId || null;
      const fileType = req.body.fileType || "profile";

      let processedFileName = file.filename;
      const isSignature = fileType === "signature";

      if (isSignature) {
        try {
          const inputPath = path.join(UPLOADS_DIR, "subject-photos", file.filename);
          const resizedName = `sig-${file.filename}`;
          const outputPath = path.join(UPLOADS_DIR, "subject-photos", resizedName);
          await sharp(inputPath)
            .resize(800, null, { fit: "inside", withoutEnlargement: true })
            .toFile(outputPath);
          processedFileName = resizedName;
        } catch (resizeErr) {
          console.error("Signature resize failed, using original:", resizeErr);
        }
      } else if (req.body.cropFace === "true") {
        try {
          const inputPath = path.join(UPLOADS_DIR, "subject-photos", file.filename);
          const croppedName = `cropped-${file.filename}`;
          const outputPath = path.join(UPLOADS_DIR, "subject-photos", croppedName);

          const metadata = await sharp(inputPath).metadata();
          const w = metadata.width || 400;
          const h = metadata.height || 400;
          const size = Math.min(w, h);
          const left = Math.round((w - size) / 2);
          const topOffset = Math.round(Math.max(0, (h * 0.1)));
          const faceHeight = Math.min(size, h - topOffset);

          await sharp(inputPath)
            .extract({ left, top: topOffset, width: size, height: faceHeight })
            .resize(300, 300, { fit: "cover", position: "attention" })
            .toFile(outputPath);

          processedFileName = croppedName;
        } catch (cropErr) {
          console.error("Face crop failed, using original:", cropErr);
        }
      } else {
        try {
          const inputPath = path.join(UPLOADS_DIR, "subject-photos", file.filename);
          const resizedName = `resized-${file.filename}`;
          const outputPath = path.join(UPLOADS_DIR, "subject-photos", resizedName);
          await sharp(inputPath)
            .resize(300, 300, { fit: "cover", position: "attention" })
            .toFile(outputPath);
          processedFileName = resizedName;
        } catch (resizeErr) {
          console.error("Resize failed, using original:", resizeErr);
        }
      }

      if (!isSignature) {
        await db.update(subjectPhotos)
          .set({ isActive: false, validTo: new Date() })
          .where(and(eq(subjectPhotos.subjectId, subjectId), eq(subjectPhotos.fileType, "profile")));
      }

      const [photo] = await db.insert(subjectPhotos).values({
        subjectId,
        fileName: processedFileName,
        filePath: `/api/subject-photos/file/${processedFileName}`,
        fileType: fileType as any,
        source: source as any,
        sourceDocumentId,
        isActive: true,
        validFrom: new Date(),
        createdByUserId: req.appUser?.id || null,
      }).returning();

      await logAudit(req, {
        action: "CREATE",
        module: "subject_photo",
        entityId: subjectId,
        entityName: `Profilova fotka subjektu ${subjectId}`,
        newData: { photoId: photo.id, source, fileName: processedFileName },
      });

      res.json(photo);
    } catch (err) {
      console.error("Photo upload error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/subjects/:id/photos/from-document", isAuthenticated, (req: any, _res, next) => {
    (req as any)._uploadSection = "subject-photos";
    next();
  }, upload.single("photo"), async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Ziaden subor nebol nahrany" });
      const secScan = await scanUploadedFile(file.path, file.originalname, file.mimetype);
      if (!secScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: ${secScan.reason}` });

      const documentType = req.body.documentType || "id_card";
      const sourceDocumentId = req.body.sourceDocumentId || null;

      let processedFileName = file.filename;
      try {
        const inputPath = path.join(UPLOADS_DIR, "subject-photos", file.filename);
        const croppedName = `face-${file.filename}`;
        const outputPath = path.join(UPLOADS_DIR, "subject-photos", croppedName);

        await sharp(inputPath)
          .resize(300, 300, { fit: "cover", position: "attention" })
          .toFile(outputPath);

        processedFileName = croppedName;
      } catch (cropErr) {
        console.error("Document face crop failed:", cropErr);
      }

      const fileType = req.body.fileType || "id_scan";

      await db.update(subjectPhotos)
        .set({ isActive: false, validTo: new Date() })
        .where(and(eq(subjectPhotos.subjectId, subjectId), eq(subjectPhotos.fileType, fileType)));

      const [photo] = await db.insert(subjectPhotos).values({
        subjectId,
        fileName: processedFileName,
        filePath: `/api/subject-photos/file/${processedFileName}`,
        fileType: fileType as any,
        source: documentType === "passport" ? "passport" : "id_card",
        sourceDocumentId,
        isActive: true,
        validFrom: new Date(),
        createdByUserId: req.appUser?.id || null,
      }).returning();

      await logAudit(req, {
        action: "CREATE",
        module: "subject_photo",
        entityId: subjectId,
        entityName: `Automaticka fotka z dokumentu`,
        newData: { photoId: photo.id, documentType, fileType },
      });

      res.json(photo);
    } catch (err) {
      console.error("Document photo extract error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch("/api/subjects/:id/photos/:photoId/activate", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = Number(req.params.id);
      const photoId = Number(req.params.photoId);

      await db.update(subjectPhotos)
        .set({ isActive: false, validTo: new Date() })
        .where(eq(subjectPhotos.subjectId, subjectId));

      const [updated] = await db.update(subjectPhotos)
        .set({ isActive: true, validFrom: new Date(), validTo: null })
        .where(eq(subjectPhotos.id, photoId))
        .returning();

      await logAudit(req, {
        action: "UPDATE",
        module: "subject_photo",
        entityId: subjectId,
        entityName: `Aktivovana fotka ${photoId}`,
        newData: { photoId },
      });

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === CONTRACT RENUMBERING (Fix Poradia - Inteligentny posun) ===
  app.patch("/api/contracts/:id/renumber", isAuthenticated, async (req: any, res) => {
    try {
      const contractId = Number(req.params.id);
      const { newSortOrder } = req.body;
      if (typeof newSortOrder !== "number" || newSortOrder < 1) {
        return res.status(400).json({ message: "Neplatne poradove cislo" });
      }

      const contract = await storage.getContract(contractId);
      if (!contract) return res.status(404).json({ message: "Zmluva nenajdena" });

      const appUser = req.appUser;
      if (appUser && appUser.activeStateId && contract.stateId && contract.stateId !== appUser.activeStateId) {
        return res.status(403).json({ message: "Uprava zmluvy z ineho statu nie je povolena" });
      }

      if (!contract.inventoryId) {
        await storage.updateContract(contractId, { sortOrderInInventory: newSortOrder });
        return res.json({ success: true, updated: 1 });
      }

      const allContracts = await db.select().from(contracts)
        .where(eq(contracts.inventoryId, contract.inventoryId));

      const sorted = allContracts
        .filter(c => c.id !== contractId)
        .sort((a, b) => (a.sortOrderInInventory || 0) - (b.sortOrderInInventory || 0));

      const conflicting = sorted.filter(c => (c.sortOrderInInventory || 0) >= newSortOrder);
      let updatedCount = 0;

      for (const c of conflicting) {
        const currentOrder = c.sortOrderInInventory || 0;
        await storage.updateContract(c.id, { sortOrderInInventory: currentOrder + 1 });
        updatedCount++;
      }

      await storage.updateContract(contractId, { sortOrderInInventory: newSortOrder });
      updatedCount++;

      await logAudit(req, {
        action: "UPDATE",
        module: "contract_renumber",
        entityId: contractId,
        entityName: `Renumber zmluvy na ${newSortOrder}`,
        newData: { newSortOrder, shiftedContracts: conflicting.length },
      });

      res.json({ success: true, updated: updatedCount, shifted: conflicting.length });
    } catch (err) {
      console.error("Contract renumber error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Batch endpoint for getting active photos for multiple subjects (for list view)
  app.post("/api/subjects/batch-photos", isAuthenticated, async (req: any, res) => {
    try {
      const { subjectIds } = req.body;
      if (!Array.isArray(subjectIds)) return res.json({});

      const allPhotos = await db.select().from(subjectPhotos);
      const activePhotos: Record<number, { id: number; filePath: string }> = {};

      for (const photo of allPhotos) {
        if (photo.isActive && subjectIds.includes(photo.subjectId)) {
          activePhotos[photo.subjectId] = { id: photo.id, filePath: photo.filePath };
        }
      }

      res.json(activePhotos);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === DYNAMIC SUBJECT SCHEMA (EAV) ===

  app.get("/api/subject-schema/:clientTypeId", isAuthenticated, async (req, res) => {
    try {
      const clientTypeId = Number(req.params.clientTypeId);
      if (!clientTypeId) return res.status(400).json({ message: "clientTypeId required" });

      const allSections = await db.select().from(subjectParamSections)
        .where(eq(subjectParamSections.clientTypeId, clientTypeId))
        .orderBy(subjectParamSections.sortOrder);

      const allParams = await db.select().from(subjectParameters)
        .where(and(
          eq(subjectParameters.clientTypeId, clientTypeId),
          eq(subjectParameters.isActive, true)
        ))
        .orderBy(subjectParameters.sortOrder);

      const parentSections = allSections.filter(s => !s.isPanel && !s.parentSectionId);
      const panels = allSections.filter(s => s.isPanel || !!s.parentSectionId);

      const filteredPanels = panels.filter(p => {
        const name = p.name || "";
        return !name.startsWith("[ZLÚČENÉ]");
      });

      const sections = parentSections.map(sec => ({
        id: sec.id,
        clientTypeId: sec.clientTypeId,
        name: sec.name,
        code: sec.code,
        folderCategory: sec.folderCategory,
        sortOrder: sec.sortOrder || 0,
        isCollection: sec.isCollection || false,
        gridColumns: sec.gridColumns || 1,
        panels: filteredPanels
          .filter(p => p.parentSectionId === sec.id)
          .map(panel => ({
            id: panel.id,
            clientTypeId: panel.clientTypeId,
            sectionId: sec.id,
            name: panel.name,
            code: panel.code,
            gridColumns: panel.gridColumns || 1,
            sortOrder: panel.sortOrder || 0,
            isCollection: panel.isCollection || false,
            fields: allParams
              .filter(f => f.panelId === panel.id)
              .map(f => ({
                id: f.id,
                clientTypeId: f.clientTypeId,
                sectionId: f.sectionId,
                panelId: f.panelId,
                fieldKey: f.fieldKey,
                label: f.label,
                shortLabel: f.shortLabel || undefined,
                fieldType: f.fieldType,
                isRequired: f.isRequired || false,
                isHidden: f.isHidden || false,
                options: (f.options as string[]) || [],
                defaultValue: f.defaultValue || null,
                visibilityRule: f.visibilityRule as { dependsOn: string; value: string } | null,
                unit: f.unit || null,
                decimalPlaces: f.decimalPlaces || 2,
                fieldCategory: f.fieldCategory,
                categoryCode: f.categoryCode || undefined,
                sortOrder: f.sortOrder || 0,
                rowNumber: f.rowNumber || 0,
                widthPercent: f.widthPercent || 100,
                extractionHints: f.extractionHints || null,
                code: f.code || undefined,
              })),
          })),
      }));

      res.json({ clientTypeId, sections });
    } catch (err: any) {
      console.error("Error fetching subject schema:", err?.message || err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === AI PARAMETER MAP ===

  app.get("/api/ai/parameter-map", isAuthenticated, async (req, res) => {
    try {
      const clientTypeId = req.query.clientTypeId ? Number(req.query.clientTypeId) : undefined;

      let params;
      if (clientTypeId) {
        params = await db.select().from(subjectParameters)
          .where(and(
            eq(subjectParameters.clientTypeId, clientTypeId),
            eq(subjectParameters.isActive, true)
          ))
          .orderBy(subjectParameters.sortOrder);
      } else {
        params = await db.select().from(subjectParameters)
          .where(eq(subjectParameters.isActive, true))
          .orderBy(subjectParameters.sortOrder);
      }

      const parameterMap = params.map(p => ({
        id: p.id,
        fieldKey: p.fieldKey,
        code: p.code,
        label: p.label,
        fieldType: p.fieldType,
        options: p.options,
        extractionHints: p.extractionHints,
        sectionId: p.sectionId,
        panelId: p.panelId,
        clientTypeId: p.clientTypeId,
      }));

      res.json({
        totalActive: parameterMap.length,
        generatedAt: new Date().toISOString(),
        parameters: parameterMap,
      });
    } catch (err: any) {
      console.error("Error fetching AI parameter map:", err?.message || err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === UNIFIED CATALOG API (A ↔ B ↔ C Architecture) ===

  app.get("/api/unified-catalog/counts", isAuthenticated, async (req, res) => {
    try {
      const clientTypeId = req.query.clientTypeId ? Number(req.query.clientTypeId) : 1;

      const typeMap: Record<number, string> = { 1: "person", 3: "szco", 4: "company" };
      const subjectType = typeMap[clientTypeId] || "person";

      const subjectCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM subjects
        WHERE deleted_at IS NULL AND type = ${subjectType}
      `);
      const activeSubjects = Number(subjectCount.rows[0]?.count || 0);

      const dynamicFieldsPerCategory = await db.execute(sql`
        SELECT sp.category_code, COUNT(*) as field_count
        FROM subject_parameters sp
        WHERE sp.client_type_id = ${clientTypeId}
          AND sp.is_active = true
          AND sp.category_code IS NOT NULL
          AND sp.category_code != ''
        GROUP BY sp.category_code
      `);

      const contractFieldsPerCategory = await db.execute(sql`
        SELECT scm.target_category_code as category_code, COUNT(DISTINCT p.id) as field_count
        FROM sector_category_mapping scm
        JOIN sections sec ON sec.id = scm.section_id
        JOIN sector_products sp ON sp.section_id = sec.id AND sp.deleted_at IS NULL
        JOIN sector_product_parameters spp ON spp.sector_product_id = sp.id
        JOIN parameters p ON p.id = spp.parameter_id AND p.deleted_at IS NULL
        WHERE scm.is_active = true
        GROUP BY scm.target_category_code
      `);

      const CATEGORY_CODE_TO_KEY: Record<string, string> = {
        identita: "identita", doklady: "identita", adresa: "identita",
        legislativa: "legislativa", aml: "legislativa",
        rodina: "rodina",
        financie: "financie", ekonomika: "financie", majetok: "financie", reality: "financie", prenajom: "financie",
        profil: "profil", zdravotny: "profil", investicny: "profil", marketing: "profil",
        digitalna: "digitalna", kontakt: "digitalna",
        servis: "servis", vozidla: "servis", polnohospodarstvo: "servis", retail: "servis", agro: "servis",
      };

      const categoryCounts: Record<string, { fields: number; dataPoints: number }> = {
        identita: { fields: 0, dataPoints: 0 },
        legislativa: { fields: 0, dataPoints: 0 },
        rodina: { fields: 0, dataPoints: 0 },
        financie: { fields: 0, dataPoints: 0 },
        profil: { fields: 0, dataPoints: 0 },
        digitalna: { fields: 0, dataPoints: 0 },
        servis: { fields: 0, dataPoints: 0 },
        relacie: { fields: 0, dataPoints: 0 },
      };

      for (const row of dynamicFieldsPerCategory.rows as any[]) {
        const key = CATEGORY_CODE_TO_KEY[row.category_code] || "servis";
        if (categoryCounts[key]) {
          categoryCounts[key].fields += Number(row.field_count);
        }
      }

      for (const row of contractFieldsPerCategory.rows as any[]) {
        const key = CATEGORY_CODE_TO_KEY[row.category_code] || "servis";
        if (categoryCounts[key]) {
          categoryCounts[key].fields += Number(row.field_count);
        }
      }

      for (const key of Object.keys(categoryCounts)) {
        categoryCounts[key].dataPoints = categoryCounts[key].fields * activeSubjects;
      }

      const relationCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM subject_relations WHERE is_active = true
      `);
      categoryCounts.relacie.dataPoints = Number(relationCount.rows[0]?.count || 0);

      const totalFields = Object.values(categoryCounts).reduce((sum, c) => sum + c.fields, 0);
      const totalDataPoints = Object.values(categoryCounts).reduce((sum, c) => sum + c.dataPoints, 0);

      const totalDynamic = await db.execute(sql`
        SELECT COUNT(*) as count FROM subject_parameters
        WHERE client_type_id = ${clientTypeId} AND is_active = true
      `);

      const totalContract = await db.execute(sql`
        SELECT COUNT(DISTINCT p.id) as count
        FROM parameters p WHERE p.deleted_at IS NULL
      `);

      res.json({
        categoryCounts,
        activeSubjects,
        totalFields,
        totalDataPoints,
        totalDynamic: Number(totalDynamic.rows[0]?.count || 0),
        totalContract: Number(totalContract.rows[0]?.count || 0),
      });
    } catch (err: any) {
      console.error("Error in unified catalog counts:", err?.message || err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/sector-category-mappings", isAuthenticated, async (req, res) => {
    try {
      const mappings = await db.execute(sql`
        SELECT scm.*, s.name as sector_name, sec.name as section_name,
               sps.name as target_section_name
        FROM sector_category_mapping scm
        LEFT JOIN sectors s ON s.id = scm.sector_id
        LEFT JOIN sections sec ON sec.id = scm.section_id
        LEFT JOIN subject_param_sections sps ON sps.id = scm.target_section_id
        WHERE scm.is_active = true
        ORDER BY scm.sort_order
      `);
      res.json(mappings.rows);
    } catch (err: any) {
      console.error("Error fetching sector-category mappings:", err?.message || err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/sector-category-mappings", isAuthenticated, async (req, res) => {
    try {
      const { sectorId, sectionId, targetCategoryCode, targetSectionId, moduleSource } = req.body;
      if (!targetCategoryCode) return res.status(400).json({ message: "targetCategoryCode required" });
      const result = await db.insert(sectorCategoryMapping).values({
        sectorId: sectorId || null,
        sectionId: sectionId || null,
        targetCategoryCode,
        targetSectionId: targetSectionId || null,
        moduleSource: moduleSource || "A",
        sortOrder: req.body.sortOrder || 0,
      }).returning();
      res.json(result[0]);
    } catch (err: any) {
      console.error("Error creating sector-category mapping:", err?.message || err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === DYNAMIC SUBJECT PARAMETERS API ===

  app.get("/api/subject-param-sections", isAuthenticated, async (req, res) => {
    try {
      const clientTypeId = req.query.clientTypeId ? Number(req.query.clientTypeId) : undefined;
      const sections = await storage.getSubjectParamSections(clientTypeId);
      res.json(sections);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  function generateAutoCode(name: string, prefix: string = ""): string {
    const slug = name
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 30);
    const suffix = Math.random().toString(36).substring(2, 6);
    return `${prefix}${slug}_${suffix}`;
  }

  app.post("/api/subject-param-sections", isAuthenticated, async (req, res) => {
    try {
      const { name, clientTypeId } = req.body;
      if (!name || !clientTypeId) return res.status(400).json({ message: "name, clientTypeId required" });
      const code = req.body.code || generateAutoCode(name, "sec_");
      const folderCategory = req.body.folderCategory || "general";
      const section = await storage.createSubjectParamSection({ ...req.body, code, folderCategory });
      res.json(section);
    } catch (err: any) {
      console.error("Error creating subject param section:", err?.message || err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch("/api/subject-param-sections/:id", isAuthenticated, async (req, res) => {
    try {
      const section = await storage.updateSubjectParamSection(Number(req.params.id), req.body);
      res.json(section);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.get("/api/subject-param-sections/:id/dependencies", isAuthenticated, async (req, res) => {
    try {
      const deps = await storage.getSectionDependencies(Number(req.params.id));
      res.json(deps);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.delete("/api/subject-param-sections/:id", isAuthenticated, async (req, res) => {
    try {
      const sectionId = Number(req.params.id);
      const deps = await storage.getSectionDependencies(sectionId);
      if (deps.parameterCount > 0) {
        return res.status(400).json({
          message: `Sekciu nie je možné vymazať – obsahuje ${deps.parameterCount} parametrov/panelov.`,
          dependencies: deps,
        });
      }
      const section = await storage.getSubjectParamSections();
      const found = section.find(s => s.id === sectionId);
      await storage.deleteSubjectParamSection(sectionId);
      const appUser = (req as any).user;
      const userName = [appUser?.firstName, appUser?.lastName].filter(Boolean).join(' ') || appUser?.email || 'Neznámy';
      await storage.createAuditLog({
        userId: appUser?.id || null,
        username: userName,
        action: "delete",
        module: "kniznica_parametrov",
        entityId: sectionId,
        entityName: found?.name || `Sekcia ${sectionId}`,
        oldData: found || null,
        newData: null,
      });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.get("/api/subject-parameters", isAuthenticated, async (req, res) => {
    try {
      const clientTypeId = req.query.clientTypeId ? Number(req.query.clientTypeId) : undefined;
      const params = await storage.getSubjectParameters(clientTypeId);
      res.json(params);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.get("/api/subject-parameters/resolved", isAuthenticated, async (req, res) => {
    try {
      const templateId = Number(req.query.templateId);
      const contractDate = req.query.contractDate ? new Date(req.query.contractDate as string) : undefined;
      if (!templateId) return res.status(400).json({ message: "templateId required" });
      const params = await storage.getResolvedParametersForTemplate(templateId, contractDate);
      res.json(params);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.get("/api/subject-parameters/:id", isAuthenticated, async (req, res) => {
    try {
      const param = await storage.getSubjectParameter(Number(req.params.id));
      if (!param) return res.status(404).json({ message: "Not found" });
      res.json(param);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/subject-parameters", isAuthenticated, async (req, res) => {
    try {
      const { label, fieldType, clientTypeId } = req.body;
      if (!label || !fieldType || !clientTypeId) return res.status(400).json({ message: "label, fieldType, clientTypeId required" });
      const fieldKey = req.body.fieldKey || generateAutoCode(label, "f_");
      const code = req.body.code || generateAutoCode(label, "p_");
      const fieldCategory = req.body.fieldCategory || "general";
      const param = await storage.createSubjectParameter({ ...req.body, fieldKey, code, fieldCategory });
      res.json(param);
    } catch (err: any) {
      console.error("Error creating subject parameter:", err?.message || err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.post("/api/subject-parameters/batch-reorder", isAuthenticated, async (req, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ message: "items must be array" });
      for (const item of items) {
        const updates: any = { sortOrder: item.sortOrder };
        if (item.panelId !== undefined) updates.panelId = item.panelId;
        await storage.updateSubjectParameter(item.id, updates);
      }
      res.json({ success: true, updated: items.length });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.patch("/api/subject-parameters/:id", isAuthenticated, async (req, res) => {
    try {
      const param = await storage.updateSubjectParameter(Number(req.params.id), req.body);
      res.json(param);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.get("/api/subject-parameters/:id/dependencies", isAuthenticated, async (req, res) => {
    try {
      const deps = await storage.getParameterDependencies(Number(req.params.id));
      res.json(deps);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.delete("/api/subject-parameters/:id", isAuthenticated, async (req, res) => {
    try {
      const paramId = Number(req.params.id);
      const deps = await storage.getParameterDependencies(paramId);
      if (deps.historyCount > 0 || deps.templateCount > 0) {
        return res.status(400).json({
          message: `Parameter nie je možné vymazať – existuje ${deps.subjectCount} subjektov s dátami a ${deps.templateCount} šablón.`,
          dependencies: deps,
        });
      }
      const param = await storage.getSubjectParameter(paramId);
      await storage.deleteSubjectParameter(paramId);
      const appUser = (req as any).user;
      const userName = [appUser?.firstName, appUser?.lastName].filter(Boolean).join(' ') || appUser?.email || 'Neznámy';
      await storage.createAuditLog({
        userId: appUser?.id || null,
        username: userName,
        action: "delete",
        module: "kniznica_parametrov",
        entityId: paramId,
        entityName: param?.label || `Parameter ${paramId}`,
        oldData: param || null,
        newData: null,
      });
      res.json({ success: true });
    } catch (err: any) {
      console.error("Error deleting subject parameter:", err?.message || err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // Parameter Synonyms field-counts
  app.get("/api/parameter-synonyms/field-counts", isAuthenticated, async (req, res) => {
    try {
      const result = await db.execute(sql`
        SELECT sp.field_key, COUNT(ps.id)::int as count
        FROM subject_parameters sp
        JOIN parameter_synonyms ps ON ps.parameter_id = sp.id
        GROUP BY sp.field_key
      `);
      const counts: Record<string, number> = {};
      for (const row of result.rows as any[]) {
        counts[row.field_key] = row.count;
      }
      res.json(counts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Parameter Synonyms CRUD
  app.get("/api/subject-parameters/:parameterId/synonyms", isAuthenticated, async (req, res) => {
    try {
      const synonyms = await storage.getParameterSynonyms(Number(req.params.parameterId));
      res.json(synonyms);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/subject-parameters/:parameterId/synonyms", isAuthenticated, async (req, res) => {
    try {
      const { synonym } = req.body;
      if (!synonym) return res.status(400).json({ message: "synonym required" });
      const syn = await storage.createParameterSynonym({
        parameterId: Number(req.params.parameterId),
        synonym,
        language: req.body.language || "sk",
        source: req.body.source || "manual",
        confidence: req.body.confidence ?? 100,
      });
      res.json(syn);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.delete("/api/parameter-synonyms/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteParameterSynonym(Number(req.params.id));
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/parameter-synonyms/:id/confirm", isAuthenticated, async (req: any, res) => {
    try {
      const synonymId = Number(req.params.id);
      const { documentName, sourceText } = req.body;
      const appUser = req.appUser;

      const updated = await storage.confirmSynonym(synonymId);

      await storage.createSynonymConfirmationLog({
        synonymId,
        userId: appUser?.id || null,
        username: appUser?.username || 'system',
        documentName: documentName || null,
        sourceText: sourceText || null,
        action: "confirm",
      });

      await logAudit(req, {
        action: "confirm_synonym",
        module: "parameter_synonyms",
        entityId: synonymId,
        entityName: updated.synonym,
        newData: { confirmationCount: updated.confirmationCount, status: updated.status },
      });

      res.json(updated);
    } catch (err) {
      console.error("[SYNONYM CONFIRM ERROR]", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/parameter-synonyms/:id/logs", isAuthenticated, async (req, res) => {
    try {
      const logs = await storage.getSynonymConfirmationLogs(Number(req.params.id));
      res.json(logs);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/parameter-synonyms/match", isAuthenticated, async (req, res) => {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ message: "text required" });
      const matches = await storage.matchParameterBySynonym(text);
      res.json(matches);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  // === FIELD LAYOUT CONFIGS (Architect Mode) ===
  app.get("/api/field-layout-configs", isAuthenticated, async (req, res) => {
    try {
      const configs = await db.select().from(fieldLayoutConfigs);
      res.json(configs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/field-layout-configs/save", isAuthenticated, async (req, res) => {
    try {
      const configs = req.body.configs as any[];
      if (!Array.isArray(configs)) return res.status(400).json({ message: "configs must be an array" });

      for (const config of configs) {
        const existing = await db.select().from(fieldLayoutConfigs)
          .where(and(
            eq(fieldLayoutConfigs.fieldKey, config.fieldKey),
            eq(fieldLayoutConfigs.clientType, config.clientType),
            eq(fieldLayoutConfigs.sectionCategory, config.sectionCategory)
          ))
          .limit(1);

        if (existing.length > 0) {
          await db.update(fieldLayoutConfigs)
            .set({
              sortOrder: config.sortOrder,
              widthClass: config.widthClass,
              rowGroup: config.rowGroup,
              updatedAt: new Date(),
            })
            .where(eq(fieldLayoutConfigs.id, existing[0].id));
        } else {
          await db.insert(fieldLayoutConfigs).values({
            fieldKey: config.fieldKey,
            clientType: config.clientType,
            sectionCategory: config.sectionCategory,
            sortOrder: config.sortOrder,
            widthClass: config.widthClass,
            rowGroup: config.rowGroup,
          });
        }
      }

      res.json({ ok: true, saved: configs.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === DÁTOVÁ LINKA (OCR Processing Module) ===
  const dataLinkaUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        const dir = path.join(UPLOADS_DIR, "datova-linka");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (_req, file, cb) => {
        const ts = formatTimestampForFile();
        const rnd = Math.round(Math.random() * 1e4);
        const ext = path.extname(file.originalname);
        cb(null, `OCR_${ts}_${rnd}${ext}`);
      },
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = [".pdf", ".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp"];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    },
  });

  app.post("/api/datova-linka/upload", isAuthenticated, dataLinkaUpload.array("documents", 100), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ message: "Žiadne súbory" });
      const multiScan = await scanMultipleFiles(files);
      if (!multiScan.safe) return res.status(400).json({ message: `⚠️ Bezpečnostná chyba: Súbor "${multiScan.failedFile}" bol vyhodnotený ako rizikový a bol odstránený. ${multiScan.reason}` });

      const appUser = req.appUser;
      const jobs = [];

      for (const file of files) {
        const [job] = await db.insert(ocrProcessingJobs).values({
          fileName: file.filename,
          originalName: file.originalname,
          filePath: file.path,
          status: "queued",
          uploadedByUserId: appUser?.id || null,
          uploadedByUsername: appUser?.username || "unknown",
        }).returning();
        jobs.push(job);
      }

      logAudit(req, "CREATE", "datova_linka", undefined, undefined, undefined, { uploadedFiles: files.length, jobIds: jobs.map(j => j.id) });
      res.json({ jobs, totalUploaded: files.length });
    } catch (err: any) {
      console.error("[DATOVA LINKA UPLOAD ERROR]", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/datova-linka/process/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const jobId = Number(req.params.jobId);
      const [job] = await db.select().from(ocrProcessingJobs).where(eq(ocrProcessingJobs.id, jobId));
      if (!job) return res.status(404).json({ message: "Job nenájdený" });
      if (job.status === "processing") return res.status(409).json({ message: "Job sa už spracúva" });
      if (job.status === "completed") return res.status(200).json({ message: "Job je už dokončený", job });

      await db.update(ocrProcessingJobs).set({ status: "processing", startedAt: new Date() }).where(eq(ocrProcessingJobs.id, jobId));

      let ocrResult;
      try {
        const { analyzeDocument, isAzureConfigured } = await import("./services/azure-ocr");
        if (!isAzureConfigured()) {
          await db.update(ocrProcessingJobs).set({ status: "failed", error: "Azure Document Intelligence nie je nakonfigurovaný", completedAt: new Date() }).where(eq(ocrProcessingJobs.id, jobId));
          return res.status(503).json({ message: "Azure Document Intelligence nie je nakonfigurovaný. Nastavte AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT a AZURE_DOCUMENT_INTELLIGENCE_KEY." });
        }
        ocrResult = await analyzeDocument(job.filePath);
      } catch (ocrErr: any) {
        await db.update(ocrProcessingJobs).set({ status: "failed", error: ocrErr.message, completedAt: new Date() }).where(eq(ocrProcessingJobs.id, jobId));
        return res.status(500).json({ message: "OCR spracovanie zlyhalo", error: ocrErr.message });
      }

      const allParams = await storage.getSubjectParameters();
      const allSynonyms = await storage.getAllParameterSynonyms();

      const synonymMap = new Map<number, string[]>();
      const synonymDetailMap = new Map<string, { id: number; status: string; confirmationCount: number }>();
      for (const syn of allSynonyms) {
        if (!synonymMap.has(syn.parameterId)) synonymMap.set(syn.parameterId, []);
        synonymMap.get(syn.parameterId)!.push(syn.synonym.toLowerCase());
        synonymDetailMap.set(`${syn.parameterId}:${syn.synonym.toLowerCase()}`, {
          id: syn.id,
          status: syn.status,
          confirmationCount: syn.confirmationCount,
        });
      }

      const CONFIRMATION_THRESHOLD = 5;
      const combinedText = ocrResult.text + "\n" + ocrResult.keyValuePairs.map(kv => `${kv.key}: ${kv.value}`).join("\n");
      const lines = combinedText.split(/\n/);

      const results: any[] = [];
      for (const param of allParams) {
        const searchTerms = [param.label.toLowerCase()];
        if (param.shortLabel) searchTerms.push(param.shortLabel.toLowerCase());
        const paramSynonyms = synonymMap.get(param.id) || [];
        searchTerms.push(...paramSynonyms);

        let bestMatch: { value: string | null; matchType: string; confidence: number; matchedTerm?: string } | null = null;

        for (const line of lines) {
          const lowerLine = line.toLowerCase().trim();
          if (!lowerLine) continue;
          for (const term of searchTerms) {
            if (lowerLine.includes(term)) {
              const afterTerm = line.substring(lowerLine.indexOf(term) + term.length).replace(/^[\s:=\-]+/, "").trim();
              const extractedValue = afterTerm || null;
              const hints = (param as any).extractionHints;
              if (hints?.regex && extractedValue) {
                try {
                  const regex = new RegExp(hints.regex);
                  const match = extractedValue.match(regex);
                  if (match) {
                    bestMatch = { value: match[0], matchType: "regex", confidence: 95, matchedTerm: term };
                    break;
                  }
                } catch {}
              }
              if (!bestMatch || bestMatch.confidence < 80) {
                bestMatch = {
                  value: extractedValue,
                  matchType: paramSynonyms.includes(term) ? "synonym" : "label",
                  confidence: paramSynonyms.includes(term) ? 85 : 75,
                  matchedTerm: term,
                };
              }
            }
          }
          if (bestMatch?.confidence === 95) break;
        }

        if (bestMatch) {
          const synDetail = bestMatch.matchedTerm ? synonymDetailMap.get(`${param.id}:${bestMatch.matchedTerm}`) : undefined;
          const isSynonymMatch = bestMatch.matchType === "synonym" && synDetail;
          const isLearning = isSynonymMatch && synDetail!.status === "learning";
          results.push({
            parameterId: param.id,
            fieldKey: param.fieldKey,
            label: param.label,
            matchedValue: bestMatch.value,
            matchType: bestMatch.matchType,
            confidence: bestMatch.confidence,
            needsConfirmation: isLearning ? true : bestMatch.confidence < 95,
            synonymId: synDetail?.id,
            synonymStatus: synDetail?.status,
            synonymConfirmationCount: synDetail?.confirmationCount,
            isProposal: isLearning || false,
          });
        }
      }

      results.sort((a, b) => b.confidence - a.confidence);

      const DATE_FIELD_KEYWORDS = ["datum", "date", "platnost", "expir", "podpis", "narod", "vydaj", "ukonc"];
      for (const r of results) {
        if (r.matchedValue && DATE_FIELD_KEYWORDS.some(kw => r.fieldKey?.toLowerCase().includes(kw) || r.label?.toLowerCase().includes(kw))) {
          r.matchedValue = normalizeExtractedDate(r.matchedValue);
        }
      }

      const OCR_DUPLICATE_LIMIT = 5;
      const valueCounts = new Map<string, number>();
      const flaggedDuplicates: string[] = [];
      for (const r of results) {
        if (r.matchedValue) {
          const normalizedVal = String(r.matchedValue).trim().toLowerCase();
          const count = (valueCounts.get(normalizedVal) || 0) + 1;
          valueCounts.set(normalizedVal, count);
          if (count > OCR_DUPLICATE_LIMIT) {
            r.needsConfirmation = true;
            r.duplicateWarning = true;
            if (!flaggedDuplicates.includes(normalizedVal)) flaggedDuplicates.push(normalizedVal);
          }
        }
      }

      const registryConflicts: { field: string; contractValue: string; registryValue: string; source: string }[] = [];
      try {
        const REGISTRY_FIELD_MAP: Record<string, string> = {
          obchodne_meno: "name",
          company_name: "name",
          nazov_firmy: "name",
          address: "street",
          adresa: "street",
          ulica: "street",
          sidlo: "city",
          mesto: "city",
          psc: "zip",
          dic: "dic",
          pravna_forma: "legalForm",
        };

        const icoField = results.find((r: any) => r.fieldKey && (r.fieldKey.toLowerCase() === "ico" || r.fieldKey.toLowerCase().includes("ico")) && r.matchedValue);

        let matchedSnapshot: any = null;
        if (job.subjectId) {
          const snapshots = await db.select().from(registrySnapshots)
            .where(eq(registrySnapshots.subjectId, job.subjectId))
            .orderBy(desc(registrySnapshots.fetchedAt))
            .limit(1);
          if (snapshots.length > 0) matchedSnapshot = snapshots[0];
        }
        if (!matchedSnapshot && icoField?.matchedValue) {
          const snapshots = await db.select().from(registrySnapshots)
            .where(eq(registrySnapshots.ico, icoField.matchedValue.trim()))
            .orderBy(desc(registrySnapshots.fetchedAt))
            .limit(1);
          if (snapshots.length > 0) matchedSnapshot = snapshots[0];
        }

        if (matchedSnapshot) {
          const parsed = matchedSnapshot.parsedFields as Record<string, any>;
          const snapshotSource = matchedSnapshot.source || "ORSR";

          for (const r of results) {
            if (!r.matchedValue || !r.fieldKey) continue;
            const registryKey = REGISTRY_FIELD_MAP[r.fieldKey.toLowerCase()];
            if (!registryKey || !parsed[registryKey]) continue;

            const contractVal = r.matchedValue.trim();
            const registryVal = String(parsed[registryKey]).trim();
            if (contractVal.toLowerCase() !== registryVal.toLowerCase()) {
              registryConflicts.push({
                field: r.fieldKey,
                contractValue: contractVal,
                registryValue: registryVal,
                source: snapshotSource,
              });
              r.registryConflict = {
                registryValue: registryVal,
                source: snapshotSource,
              };

              try {
                await storage.proposeRegistrySynonym(r.parameterId, contractVal, registryVal);
              } catch (synErr) {
                console.error("[REGISTRY SYNONYM PROPOSAL ERROR]", synErr);
              }
            }
          }
        }
      } catch (regErr) {
        console.error("[REGISTRY AUDIT ERROR]", regErr);
      }

      await db.update(ocrProcessingJobs).set({
        status: "completed",
        extractedText: ocrResult.text,
        extractedFields: JSON.stringify(results),
        pageCount: ocrResult.pages,
        completedAt: new Date(),
      }).where(eq(ocrProcessingJobs.id, jobId));

      logAudit(req, "PROCESS", "datova_linka", String(jobId), job.originalName, undefined, {
        pageCount: ocrResult.pages,
        fieldsExtracted: results.length,
        keyValuePairs: ocrResult.keyValuePairs.length,
        duplicatesOverLimit: flaggedDuplicates.length,
        registryConflicts: registryConflicts.length,
      });

      res.json({
        jobId,
        status: "completed",
        pageCount: ocrResult.pages,
        extractedFields: results,
        duplicateWarnings: flaggedDuplicates.length > 0 ? flaggedDuplicates : undefined,
        registryConflicts: registryConflicts.length > 0 ? registryConflicts : undefined,
        keyValuePairs: ocrResult.keyValuePairs,
        tables: ocrResult.tables,
        confirmedCount: results.filter((r: any) => !r.needsConfirmation).length,
        needsConfirmationCount: results.filter((r: any) => r.needsConfirmation).length,
      });
    } catch (err: any) {
      console.error("[DATOVA LINKA PROCESS ERROR]", err);
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/datova-linka/jobs", isAuthenticated, async (_req, res) => {
    try {
      const jobs = await db.select().from(ocrProcessingJobs).orderBy(desc(ocrProcessingJobs.createdAt));
      res.json(jobs);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/datova-linka/jobs/:jobId", isAuthenticated, async (req, res) => {
    try {
      const jobId = Number(req.params.jobId);
      const [job] = await db.select().from(ocrProcessingJobs).where(eq(ocrProcessingJobs.id, jobId));
      if (!job) return res.status(404).json({ message: "Job nenájdený" });
      res.json({
        ...job,
        extractedFields: job.extractedFields ? JSON.parse(job.extractedFields) : [],
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/datova-linka/confirm-field", isAuthenticated, async (req: any, res) => {
    try {
      const { synonymId, jobId, documentName } = req.body;
      if (!synonymId) return res.status(400).json({ message: "synonymId je povinné" });

      const updated = await storage.confirmSynonym(Number(synonymId));
      const appUser = req.appUser;

      try {
        const synonymConfirmationLogsTable = (await import("@shared/schema")).synonymConfirmationLogs;
        await db.insert(synonymConfirmationLogsTable).values({
          synonymId: Number(synonymId),
          userId: appUser?.id || null,
          username: appUser?.username || "unknown",
          documentName: documentName || null,
          sourceText: `datova-linka-job-${jobId || "manual"}`,
          action: "confirm",
        });
      } catch {}

      logAudit(req, "CONFIRM_SYNONYM", "datova_linka", String(synonymId), undefined, undefined, {
        synonymId,
        newStatus: updated.status,
        confirmationCount: updated.confirmationCount,
      });

      res.json({ synonym: updated, message: updated.status === "confirmed" ? "Synonymum potvrdené (5/5)" : `Potvrdenie ${updated.confirmationCount}/5` });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/datova-linka/resume", isAuthenticated, async (_req, res) => {
    try {
      const interrupted = await db.select().from(ocrProcessingJobs).where(
        or(eq(ocrProcessingJobs.status, "interrupted"), eq(ocrProcessingJobs.status, "processing"))
      );
      if (interrupted.length === 0) return res.json({ message: "Žiadne prerušené joby", resumed: 0 });

      for (const job of interrupted) {
        await db.update(ocrProcessingJobs).set({ status: "queued", startedAt: null }).where(eq(ocrProcessingJobs.id, job.id));
      }

      res.json({ message: `${interrupted.length} jobov obnovených`, resumed: interrupted.length, jobIds: interrupted.map(j => j.id) });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/datova-linka/process-all", isAuthenticated, async (_req, res) => {
    try {
      const queued = await db.select().from(ocrProcessingJobs).where(eq(ocrProcessingJobs.status, "queued"));
      res.json({ message: `${queued.length} jobov zaradených na spracovanie`, queuedCount: queued.length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.delete("/api/datova-linka/jobs/:jobId", isAuthenticated, async (req: any, res) => {
    try {
      const jobId = Number(req.params.jobId);
      const [job] = await db.select().from(ocrProcessingJobs).where(eq(ocrProcessingJobs.id, jobId));
      if (!job) return res.status(404).json({ message: "Job nenájdený" });

      if (fs.existsSync(job.filePath)) {
        fs.unlinkSync(job.filePath);
      }
      await db.delete(ocrProcessingJobs).where(eq(ocrProcessingJobs.id, jobId));

      logAudit(req, "DELETE", "datova_linka", String(jobId), job.originalName);
      res.json({ message: "Job vymazaný" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // AI Field Extraction - maps document text to parameters via synonyms + regex hints
  app.post("/api/ai/extract-fields", isAuthenticated, async (req, res) => {
    try {
      const { text, clientTypeId } = req.body;
      if (!text) return res.status(400).json({ message: "text required" });

      const allParams = await storage.getSubjectParameters(clientTypeId ? Number(clientTypeId) : undefined);
      const allSynonyms = await storage.getAllParameterSynonyms();

      const synonymMap = new Map<number, string[]>();
      const synonymDetailMap = new Map<string, { id: number; status: string; confirmationCount: number }>();
      for (const syn of allSynonyms) {
        if (!synonymMap.has(syn.parameterId)) synonymMap.set(syn.parameterId, []);
        synonymMap.get(syn.parameterId)!.push(syn.synonym.toLowerCase());
        synonymDetailMap.set(`${syn.parameterId}:${syn.synonym.toLowerCase()}`, {
          id: syn.id,
          status: syn.status,
          confirmationCount: syn.confirmationCount,
        });
      }

      const CONFIRMATION_THRESHOLD = 5;
      const CONFIDENCE_THRESHOLD = 95;

      const documentTypeAnchors: Record<string, string[]> = {
        "Technický preukaz": ["vin", "kw", "šp", "značka vozidla", "druh vozidla", "farba vozidla", "rok výroby", "evidenčné číslo", "celková hmotnosť"],
        "Občiansky preukaz": ["rodné číslo", "dátum narodenia", "miesto narodenia", "trvalý pobyt", "číslo op", "platnosť do", "štátna príslušnosť"],
        "Cestovný pas": ["passport", "číslo pasu", "pas č", "platnosť pasu", "miesto vydania"],
        "Poistná zmluva": ["poistné", "poistná suma", "poisťovňa", "poistená osoba", "poistná doba", "poistné obdobie", "výška poistného"],
        "Živnostenský list": ["ičo", "predmet podnikania", "obchodné meno", "živnostenské oprávnenie", "miesto podnikania"],
        "Zmluva o poistení zodpovednosti": ["zodpovednosť", "limit plnenia", "spoluúčasť", "územná platnosť", "predmet činnosti", "profesijná zodpovednosť", "všeobecná zodpovednosť", "regresy"],
        "Flotilová zmluva": ["flotila", "hromadná zmluva", "počet vozidiel", "referent flotily", "fleet", "správca flotily", "kapacita flotily"],
        "Prílohy k zmluve": ["asistenčné služby", "odtiahnutie", "náhradné vozidlo", "ubytovanie v núdzi", "právna ochrana", "gap poistenie", "vernostné zľavy", "bonusy", "doplnkové poistenie"],
        "Doplnkové poistenia": ["doplnkové poistenie", "gap", "právna ochrana", "asistencia", "odtiahnutie vozidla", "náhradné vozidlo", "úroveň asistencie", "premium asistencia", "rozšírená asistencia"],
      };
      const lowerText = text.toLowerCase();
      let detectedDocumentType: string | null = null;
      let maxAnchorHits = 0;
      for (const [docType, anchors] of Object.entries(documentTypeAnchors)) {
        const hits = anchors.filter(a => lowerText.includes(a)).length;
        if (hits > maxAnchorHits && hits >= 2) {
          maxAnchorHits = hits;
          detectedDocumentType = docType;
        }
      }

      const results: { parameterId: number; fieldKey: string; label: string; matchedValue: string | null; matchType: string; confidence: number; needsConfirmation: boolean; synonymId?: number; synonymStatus?: string; synonymConfirmationCount?: number; isProposal?: boolean }[] = [];
      const lines = text.split(/\n/);

      for (const param of allParams) {
        const searchTerms = [param.label.toLowerCase()];
        if (param.shortLabel) searchTerms.push(param.shortLabel.toLowerCase());
        const paramSynonyms = synonymMap.get(param.id) || [];
        searchTerms.push(...paramSynonyms);

        let bestMatch: { value: string | null; matchType: string; confidence: number; matchedTerm?: string } | null = null;

        for (const line of lines) {
          const lowerLine = line.toLowerCase().trim();
          if (!lowerLine) continue;

          for (const term of searchTerms) {
            if (lowerLine.includes(term)) {
              const afterTerm = line.substring(lowerLine.indexOf(term) + term.length).replace(/^[\s:=\-]+/, "").trim();
              const extractedValue = afterTerm || null;

              const hints = (param as any).extractionHints;
              if (hints?.regex && extractedValue) {
                try {
                  const regex = new RegExp(hints.regex);
                  const match = extractedValue.match(regex);
                  if (match) {
                    bestMatch = { value: match[0], matchType: "regex", confidence: 95, matchedTerm: term };
                    break;
                  }
                } catch {}
              }

              if (!bestMatch || bestMatch.confidence < 80) {
                bestMatch = {
                  value: extractedValue,
                  matchType: paramSynonyms.includes(term) ? "synonym" : "label",
                  confidence: paramSynonyms.includes(term) ? 85 : 75,
                  matchedTerm: term,
                };
              }
            }
          }

          if (bestMatch?.confidence === 95) break;
        }

        if (bestMatch) {
          const synDetail = bestMatch.matchedTerm ? synonymDetailMap.get(`${param.id}:${bestMatch.matchedTerm}`) : undefined;
          const isSynonymMatch = bestMatch.matchType === "synonym" && synDetail;
          const isLearning = isSynonymMatch && synDetail.status === "learning";
          results.push({
            parameterId: param.id,
            fieldKey: param.fieldKey,
            label: param.label,
            matchedValue: bestMatch.value,
            matchType: bestMatch.matchType,
            confidence: bestMatch.confidence,
            needsConfirmation: isLearning ? true : bestMatch.confidence < CONFIDENCE_THRESHOLD,
            synonymId: synDetail?.id,
            synonymStatus: synDetail?.status,
            synonymConfirmationCount: synDetail?.confirmationCount,
            isProposal: isLearning || false,
          });
        }
      }

      results.sort((a, b) => b.confidence - a.confidence);

      const matchedLabels = new Set(results.map(r => r.label.toLowerCase()));
      const unmatchedLines: string[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.length < 3) continue;
        const parts = trimmed.split(/[\s:=\-]+/);
        const fieldCandidate = parts[0]?.toLowerCase();
        if (fieldCandidate && !matchedLabels.has(fieldCandidate)) {
          const isKnownField = results.some(r => trimmed.toLowerCase().includes(r.label.toLowerCase()));
          if (!isKnownField) {
            unmatchedLines.push(trimmed);
          }
        }
      }

      if (unmatchedLines.length > 0) {
        for (const line of unmatchedLines.slice(0, 20)) {
          const colonIdx = line.indexOf(":");
          const eqIdx = line.indexOf("=");
          const sepIdx = colonIdx >= 0 ? colonIdx : eqIdx;
          const extractedKey = sepIdx >= 0 ? line.substring(0, sepIdx).trim() : line.substring(0, 30).trim();
          const extractedValue = sepIdx >= 0 ? line.substring(sepIdx + 1).trim() : null;
          try {
            await storage.createUnknownExtractedField({
              extractedKey,
              extractedValue,
              sourceText: line,
              status: "new",
              clientTypeId: clientTypeId ? Number(clientTypeId) : null,
            });
          } catch {}
        }
      }

      const confirmedResults = results.filter(r => !r.needsConfirmation);
      const needsConfirmationResults = results.filter(r => r.needsConfirmation);
      const proposalResults = results.filter(r => r.isProposal);
      res.json({
        extracted: results,
        totalParams: allParams.length,
        matchedCount: results.length,
        confirmedCount: confirmedResults.length,
        needsConfirmationCount: needsConfirmationResults.length,
        proposalCount: proposalResults.length,
        unmatchedCount: unmatchedLines.length,
        confidenceThreshold: CONFIDENCE_THRESHOLD,
        confirmationThreshold: CONFIRMATION_THRESHOLD,
        detectedDocumentType,
      });
    } catch (err) {
      console.error("[AI EXTRACT ERROR]", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/subject-templates", isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getSubjectTemplates();
      res.json(templates);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.get("/api/subject-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const tmpl = await storage.getSubjectTemplate(Number(req.params.id));
      if (!tmpl) return res.status(404).json({ message: "Not found" });
      res.json(tmpl);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/subject-templates", isAuthenticated, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ message: "name required" });
      const code = req.body.code || generateAutoCode(name, "tmpl_");
      const tmpl = await storage.createSubjectTemplate({ ...req.body, code });
      res.json(tmpl);
    } catch (err: any) {
      console.error("Error creating subject template:", err?.message || err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.patch("/api/subject-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const tmpl = await storage.updateSubjectTemplate(Number(req.params.id), req.body);
      res.json(tmpl);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.get("/api/subject-templates/:id/dependencies", isAuthenticated, async (req, res) => {
    try {
      const deps = await storage.getTemplateDependencies(Number(req.params.id));
      res.json(deps);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.delete("/api/subject-templates/:id", isAuthenticated, async (req, res) => {
    try {
      const templateId = Number(req.params.id);
      const deps = await storage.getTemplateDependencies(templateId);
      if (deps.parameterCount > 0) {
        return res.status(400).json({
          message: `Šablónu nie je možné vymazať – obsahuje ${deps.parameterCount} naviazaných parametrov.`,
          dependencies: deps,
        });
      }
      const templates = await storage.getSubjectTemplates();
      const found = templates.find(t => t.id === templateId);
      await storage.deleteSubjectTemplate(templateId);
      const appUser = (req as any).user;
      const userName = [appUser?.firstName, appUser?.lastName].filter(Boolean).join(' ') || appUser?.email || 'Neznámy';
      await storage.createAuditLog({
        userId: appUser?.id || null,
        username: userName,
        action: "delete",
        module: "kniznica_parametrov",
        entityId: templateId,
        entityName: found?.name || `Šablóna ${templateId}`,
        oldData: found || null,
        newData: null,
      });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.get("/api/subject-template-params/:templateId", isAuthenticated, async (req, res) => {
    try {
      const params = await storage.getSubjectTemplateParams(Number(req.params.templateId));
      res.json(params);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/subject-template-params", isAuthenticated, async (req, res) => {
    try {
      const { templateId, parameterId } = req.body;
      if (!templateId || !parameterId) return res.status(400).json({ message: "templateId, parameterId required" });
      const tp = await storage.createSubjectTemplateParam(req.body);
      res.json(tp);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.patch("/api/subject-template-params/:id", isAuthenticated, async (req, res) => {
    try {
      const tp = await storage.updateSubjectTemplateParam(Number(req.params.id), req.body);
      res.json(tp);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.delete("/api/subject-template-params/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteSubjectTemplateParam(Number(req.params.id));
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/subject-template-params/bulk/:templateId", isAuthenticated, async (req, res) => {
    try {
      const { paramIds } = req.body;
      await storage.bulkSetTemplateParams(Number(req.params.templateId), paramIds || []);
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  // Unknown Extracted Fields CRUD
  app.get("/api/unknown-extracted-fields", isAuthenticated, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const fields = await storage.getUnknownExtractedFields(status);
      res.json(fields);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/unknown-extracted-fields", isAuthenticated, async (req, res) => {
    try {
      const field = await storage.createUnknownExtractedField(req.body);
      res.json(field);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.patch("/api/unknown-extracted-fields/:id", isAuthenticated, async (req, res) => {
    try {
      const field = await storage.updateUnknownExtractedField(Number(req.params.id), req.body);
      res.json(field);
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.delete("/api/unknown-extracted-fields/:id", isAuthenticated, async (req, res) => {
    try {
      const fieldId = Number(req.params.id);
      const fields = await storage.getUnknownExtractedFields();
      const found = fields.find(f => f.id === fieldId);
      await storage.deleteUnknownExtractedField(fieldId);
      const appUser = (req as any).user;
      const userName = [appUser?.firstName, appUser?.lastName].filter(Boolean).join(' ') || appUser?.email || 'Neznámy';
      await storage.createAuditLog({
        userId: appUser?.id || null,
        username: userName,
        action: "delete",
        module: "kniznica_parametrov",
        entityId: fieldId,
        entityName: found?.extractedKey || `Neznáme pole ${fieldId}`,
        oldData: found || null,
        newData: null,
      });
      res.json({ success: true });
    } catch (err) { res.status(500).json({ message: "Internal error" }); }
  });

  app.post("/api/admin/seed-subject-parameters", isAuthenticated, async (req, res) => {
    try {
      const existing = await storage.getSubjectParameters();
      if (existing.length > 0) {
        return res.json({ message: "Already seeded", count: existing.length });
      }
      await seedSubjectParameters();
      const afterCount = await storage.getSubjectParameters();
      res.json({ message: "Seeded successfully", count: afterCount.length });
    } catch (err: any) {
      console.error("[SEED PARAMS ERROR]", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/admin/cleanup-orphan-panels", isAuthenticated, async (_req, res) => {
    try {
      const allSections = await db.execute(sql`SELECT id, name, folder_category, is_panel, parent_section_id FROM subject_param_sections`);
      const rows = allSections.rows as any[];
      const sectionMap = new Map(rows.map(r => [r.id, r]));
      let fixed = 0;
      let deleted = 0;

      for (const row of rows) {
        if (row.is_panel && row.parent_section_id) {
          const parent = sectionMap.get(row.parent_section_id);
          if (parent && row.folder_category !== parent.folder_category) {
            await db.execute(sql`UPDATE subject_param_sections SET folder_category = ${parent.folder_category} WHERE id = ${row.id}`);
            fixed++;
          }
        }
        if (row.is_panel && !row.parent_section_id) {
          const paramCount = await db.execute(sql`SELECT COUNT(*) as cnt FROM subject_parameters WHERE panel_id = ${row.id}`);
          const cnt = Number((paramCount.rows[0] as any)?.cnt || 0);
          if (cnt === 0) {
            await db.execute(sql`DELETE FROM subject_param_sections WHERE id = ${row.id}`);
            deleted++;
          }
        }
      }

      const orphanParams = await db.execute(sql`
        UPDATE subject_parameters sp
        SET field_category = sps.folder_category
        FROM subject_param_sections sps
        WHERE sp.panel_id = sps.id
          AND sps.folder_category IS NOT NULL
          AND sp.field_category <> sps.folder_category
      `);
      const paramFixed = (orphanParams as any).rowCount || 0;

      res.json({
        message: "Upratovanie dokončené",
        panelCategoryFixed: fixed,
        orphanPanelsDeleted: deleted,
        paramCategoryFixed: paramFixed,
      });
    } catch (err: any) {
      console.error("[CLEANUP ERROR]", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.get("/api/document-validity/statuses", isAuthenticated, async (_req, res) => {
    try {
      const statuses = await db.execute(sql`
        SELECT s.id as subject_id, s.uid, s.first_name, s.last_name, s.company_name, s.type,
               ds.field_key, ds.expiry_date, ds.status, ds.days_remaining
        FROM subject_document_status ds
        JOIN subjects s ON s.id = ds.subject_id
        WHERE ds.status IN ('expired', 'expiring')
        ORDER BY ds.status ASC, ds.days_remaining ASC
      `);
      res.json(statuses.rows || []);
    } catch (err: any) {
      console.error("[DOC VALIDITY ERROR]", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  app.post("/api/document-validity/refresh", isAuthenticated, async (_req, res) => {
    try {
      const count = await refreshDocumentStatuses();
      res.json({ message: "Refreshed", count });
    } catch (err: any) {
      console.error("[DOC VALIDITY REFRESH ERROR]", err);
      res.status(500).json({ message: err?.message || "Internal error" });
    }
  });

  refreshDocumentStatuses().catch(err => console.error("[DOC VALIDITY INIT ERROR]", err));
  setInterval(() => {
    refreshDocumentStatuses().catch(err => console.error("[DOC VALIDITY CRON ERROR]", err));
  }, 60 * 60 * 1000);

  // === DATA CONFLICT ALERTS (Blbuvzdornosť) ===
  const conflictAlertCreateSchema = z.object({
    subjectId: z.number().int().positive(),
    fieldKey: z.string().min(1),
    existingValue: z.string().optional().nullable(),
    conflictingValue: z.string().optional().nullable(),
    sourceDocument: z.string().optional().nullable(),
    sourceDocumentId: z.number().int().optional().nullable(),
    status: z.enum(["pending", "resolved", "dismissed"]).default("pending"),
    collectionKey: z.string().optional().nullable(),
    severity: z.enum(["info", "warning", "critical"]).default("warning"),
  });

  const conflictResolveSchema = z.object({
    resolution: z.enum(["keep_existing", "use_new", "merge", "dismissed"]),
    resolvedByName: z.string().optional(),
  });

  const dedupCheckSchema = z.object({
    subjectId: z.number().int().positive(),
    docNumber: z.string().optional().nullable(),
    amount: z.string().optional().nullable(),
    transactionDate: z.string().optional().nullable(),
    sectionCode: z.string().default("retail_obchod"),
    collectionIndex: z.number().int().default(0),
  });

  app.get("/api/conflict-alerts/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID subjektu" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const status = (req.query.status as string) || undefined;
      let query = db.select().from(dataConflictAlerts).where(eq(dataConflictAlerts.subjectId, subjectId));
      if (status) {
        query = db.select().from(dataConflictAlerts).where(and(eq(dataConflictAlerts.subjectId, subjectId), eq(dataConflictAlerts.status, status)));
      }
      const alerts = await query;
      res.json(alerts);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní konfliktov" });
    }
  });

  app.post("/api/conflict-alerts", isAuthenticated, async (req, res) => {
    try {
      const parsed = conflictAlertCreateSchema.parse(req.body);
      if (!await checkKlientiSubjectAccess((req as any).appUser, parsed.subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const [alert] = await db.insert(dataConflictAlerts).values(parsed).returning();
      res.json(alert);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Neplatné dáta", errors: err.errors });
      res.status(500).json({ message: err?.message || "Chyba pri vytváraní konfliktu" });
    }
  });

  app.patch("/api/conflict-alerts/:id/resolve", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Neplatné ID" });
      const parsed = conflictResolveSchema.parse(req.body);
      const user = (req as any).user;
      const [updated] = await db.update(dataConflictAlerts)
        .set({
          status: "resolved",
          resolution: parsed.resolution,
          resolvedAt: new Date(),
          resolvedByUserId: user?.id || null,
          resolvedByName: parsed.resolvedByName || user?.username || "system",
        })
        .where(eq(dataConflictAlerts.id, id))
        .returning();
      if (!updated) return res.status(404).json({ message: "Konflikt nenájdený" });
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Neplatné dáta", errors: err.errors });
      res.status(500).json({ message: err?.message || "Chyba pri riešení konfliktu" });
    }
  });

  // === TRANSACTION DEDUP LOG (Blbuvzdornosť - duplicate detection) ===
  app.get("/api/transaction-dedup/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID subjektu" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const logs = await db.select().from(transactionDedupLog).where(eq(transactionDedupLog.subjectId, subjectId));
      res.json(logs);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní deduplikácie" });
    }
  });

  app.post("/api/transaction-dedup/check", isAuthenticated, async (req, res) => {
    try {
      const parsed = dedupCheckSchema.parse(req.body);
      if (!await checkKlientiSubjectAccess((req as any).appUser, parsed.subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const fingerprint = `${(parsed.docNumber || "").trim()}|${(parsed.amount || "").trim()}|${(parsed.transactionDate || "").trim()}`;

      const existing = await db.select().from(transactionDedupLog)
        .where(and(
          eq(transactionDedupLog.subjectId, parsed.subjectId),
          eq(transactionDedupLog.fingerprint, fingerprint)
        ));

      if (existing.length > 0) {
        res.json({ isDuplicate: true, existingEntries: existing, fingerprint });
      } else {
        const [entry] = await db.insert(transactionDedupLog).values({
          subjectId: parsed.subjectId,
          docNumber: parsed.docNumber,
          amount: parsed.amount,
          transactionDate: parsed.transactionDate,
          sectionCode: parsed.sectionCode,
          collectionIndex: parsed.collectionIndex,
          fingerprint,
        }).returning();
        res.json({ isDuplicate: false, entry, fingerprint });
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Neplatné dáta", errors: err.errors });
      res.status(500).json({ message: err?.message || "Chyba pri kontrole duplicít" });
    }
  });

  // === CONFLICT DETECTION ON SAVE (auto-detect conflicts when updating subject data) ===
  app.post("/api/conflict-detect/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID subjektu" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });
      const { newData, sourceDocument } = req.body;
      if (!newData || typeof newData !== "object") return res.status(400).json({ message: "Chýba newData objekt" });

      const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
      if (!subject) return res.status(404).json({ message: "Subjekt nenájdený" });

      const existingData = (subject as any).clientData || {};
      const conflicts: any[] = [];

      const normalize = (v: any): string => {
        if (v === null || v === undefined) return "";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v).trim();
      };

      for (const [key, newValue] of Object.entries(newData)) {
        const existingNorm = normalize(existingData[key]);
        const newNorm = normalize(newValue);
        if (existingNorm && newNorm && existingNorm !== newNorm) {
          conflicts.push({
            subjectId,
            fieldKey: key,
            existingValue: existingNorm,
            conflictingValue: newNorm,
            sourceDocument: sourceDocument || "manual_edit",
            status: "pending",
            severity: "warning",
          });
        }
      }

      if (conflicts.length > 0) {
        for (const c of conflicts) {
          await db.insert(dataConflictAlerts).values(c);
        }
      }

      res.json({ conflictsFound: conflicts.length, conflicts });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri detekcii konfliktov" });
    }
  });

  // === RELATION ROLE TYPES (Číselník rolí) ===
  app.get("/api/relation-role-types", isAuthenticated, async (_req, res) => {
    try {
      const roles = await db.select().from(relationRoleTypes).where(eq(relationRoleTypes.isActive, true));
      res.json(roles);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní rolí" });
    }
  });

  app.get("/api/relation-role-types/:category", isAuthenticated, async (req, res) => {
    try {
      const roles = await db.select().from(relationRoleTypes).where(
        and(eq(relationRoleTypes.category, req.params.category), eq(relationRoleTypes.isActive, true))
      );
      res.json(roles);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní rolí" });
    }
  });

  // === SUBJECT RELATIONS (Global cross-entity links) ===
  const createRelationSchema = z.object({
    sourceSubjectId: z.number().int().positive(),
    targetSubjectId: z.number().int().positive(),
    roleTypeId: z.number().int().positive(),
    category: z.string().min(1),
    contextSector: z.string().optional().nullable(),
    contextSectionCode: z.string().optional().nullable(),
    contextPanelCode: z.string().optional().nullable(),
    collectionIndex: z.number().int().optional().nullable(),
    fieldKey: z.string().optional().nullable(),
    relationMeta: z.record(z.any()).optional(),
    validFrom: z.string().optional().nullable(),
    validTo: z.string().optional().nullable(),
    isDraft: z.boolean().optional(),
  });

  app.get("/api/subject-relations/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID subjektu" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const asSource = await db.select({
        relation: subjectRelations,
        roleType: relationRoleTypes,
        targetSubject: {
          id: subjects.id,
          uid: subjects.uid,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          companyName: subjects.companyName,
          type: subjects.type,
        },
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .innerJoin(subjects, eq(subjectRelations.targetSubjectId, subjects.id))
        .where(and(eq(subjectRelations.sourceSubjectId, subjectId), eq(subjectRelations.isActive, true)));

      const asTarget = await db.select({
        relation: subjectRelations,
        roleType: relationRoleTypes,
        sourceSubject: {
          id: subjects.id,
          uid: subjects.uid,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          companyName: subjects.companyName,
          type: subjects.type,
        },
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .innerJoin(subjects, eq(subjectRelations.sourceSubjectId, subjects.id))
        .where(and(eq(subjectRelations.targetSubjectId, subjectId), eq(subjectRelations.isActive, true)));

      const categories: Record<string, { label: string; relations: any[] }> = {
        zmluvna_strana: { label: "Zmluvná strana", relations: [] },
        predmet_zaujmu: { label: "Predmet záujmu", relations: [] },
        beneficient: { label: "Beneficient", relations: [] },
        kontakt: { label: "Kontakt", relations: [] },
      };

      for (const r of asSource) {
        const cat = r.relation.category;
        if (categories[cat]) {
          categories[cat].relations.push({
            ...r.relation,
            roleLabel: r.roleType.label,
            roleCode: r.roleType.code,
            direction: "outgoing",
            linkedSubject: r.targetSubject,
          });
        }
      }

      for (const r of asTarget) {
        const cat = r.relation.category;
        if (categories[cat]) {
          categories[cat].relations.push({
            ...r.relation,
            roleLabel: r.roleType.label,
            roleCode: r.roleType.code,
            direction: "incoming",
            linkedSubject: r.sourceSubject,
          });
        }
      }

      const summary = {
        totalRelations: asSource.length + asTarget.length,
        byCategory: Object.entries(categories).map(([key, val]) => ({
          category: key,
          label: val.label,
          count: val.relations.length,
        })),
      };

      res.json({ categories, summary, asSource: asSource.length, asTarget: asTarget.length });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní relácií" });
    }
  });

  app.post("/api/subject-relations", isAuthenticated, async (req, res) => {
    try {
      const parsed = createRelationSchema.parse(req.body);
      if (!await checkKlientiSubjectAccess((req as any).appUser, parsed.sourceSubjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const user = (req as any).user;
      const [relation] = await db.insert(subjectRelations).values({
        ...parsed,
        validFrom: parsed.validFrom ? new Date(parsed.validFrom) : new Date(),
        validTo: parsed.validTo ? new Date(parsed.validTo) : null,
        createdByUserId: user?.id || null,
        createdByName: user?.username || "system",
      }).returning();

      if (parsed.roleTypeId) {
        try {
          const [roleType] = await db.select().from(relationRoleTypes).where(eq(relationRoleTypes.id, parsed.roleTypeId));
          if (roleType && (roleType.code === 'nadriadeny' || roleType.code === 'podriadeny')) {
            const sourceId = parsed.sourceSubjectId;
            const targetId = parsed.targetSubjectId;
            const nadriadeId = roleType.code === 'nadriadeny' ? sourceId : targetId;
            const podriadeId = roleType.code === 'nadriadeny' ? targetId : sourceId;
            const allUsers = await storage.getAppUsers();
            const nadriadeUser = allUsers.find((u: any) => u.subjectId === nadriadeId);
            const podriadeUser = allUsers.find((u: any) => u.subjectId === podriadeId);
            if (nadriadeUser && podriadeUser) {
              await db.update(appUsers).set({ managerId: nadriadeUser.id }).where(eq(appUsers.id, podriadeUser.id));
            }
          }
        } catch (e) { console.error("[RELATION_SYNC] Error syncing manager_id:", e); }
      }

      res.json(relation);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Neplatné dáta", errors: err.errors });
      res.status(500).json({ message: err?.message || "Chyba pri vytváraní relácie" });
    }
  });

  app.patch("/api/subject-relations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Neplatné ID" });

      const { roleTypeId, category, contextSector, contextSectionCode, validTo, isActive, relationMeta } = req.body;
      const updateData: any = { updatedAt: new Date() };
      if (roleTypeId !== undefined) updateData.roleTypeId = roleTypeId;
      if (category !== undefined) updateData.category = category;
      if (contextSector !== undefined) updateData.contextSector = contextSector;
      if (contextSectionCode !== undefined) updateData.contextSectionCode = contextSectionCode;
      if (validTo !== undefined) updateData.validTo = validTo ? new Date(validTo) : null;
      if (isActive !== undefined) updateData.isActive = isActive;
      if (relationMeta !== undefined) updateData.relationMeta = relationMeta;

      const [updated] = await db.update(subjectRelations).set(updateData).where(eq(subjectRelations.id, id)).returning();
      if (!updated) return res.status(404).json({ message: "Relácia nenájdená" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri úprave relácie" });
    }
  });

  app.delete("/api/subject-relations/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Neplatné ID" });

      const [deactivated] = await db.update(subjectRelations)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(subjectRelations.id, id))
        .returning();
      if (!deactivated) return res.status(404).json({ message: "Relácia nenájdená" });
      res.json({ message: "Relácia deaktivovaná", relation: deactivated });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri deaktivácii relácie" });
    }
  });

  // === CROSS-ENTITY INTELLIGENCE (Summary of all relations for a subject) ===
  app.get("/api/subject-relations-summary/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID subjektu" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const allRelations = await db.select({
        roleLabel: relationRoleTypes.label,
        roleCode: relationRoleTypes.code,
        category: subjectRelations.category,
        contextSector: subjectRelations.contextSector,
        contextSectionCode: subjectRelations.contextSectionCode,
        direction: sql<string>`CASE WHEN ${subjectRelations.sourceSubjectId} = ${subjectId} THEN 'outgoing' ELSE 'incoming' END`,
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .where(and(
          or(
            eq(subjectRelations.sourceSubjectId, subjectId),
            eq(subjectRelations.targetSubjectId, subjectId)
          ),
          eq(subjectRelations.isActive, true)
        ));

      const grouped: Record<string, { count: number; roles: string[] }> = {};
      for (const r of allRelations) {
        const key = r.roleLabel;
        if (!grouped[key]) grouped[key] = { count: 0, roles: [] };
        grouped[key].count++;
        if (r.contextSector && !grouped[key].roles.includes(r.contextSector)) {
          grouped[key].roles.push(r.contextSector);
        }
      }

      const sentences = Object.entries(grouped).map(([role, data]) => {
        const sectorInfo = data.roles.length > 0 ? ` (${data.roles.join(", ")})` : "";
        return `${role} pri ${data.count} záznamoch${sectorInfo}`;
      });

      res.json({
        subjectId,
        totalRelations: allRelations.length,
        summary: sentences.join(", "),
        details: grouped,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri generovaní súhrnu" });
    }
  });

  // === STATUS EVIDENCE (Dôkazný materiál ORSR/ŽRSR) ===
  app.get("/api/subjects/:id/status-evidence", isAuthenticated, async (req, res) => {
    try {
      const subjectId = Number(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      const evidence = await db.select().from(statusEvidence)
        .where(eq(statusEvidence.subjectId, subjectId))
        .orderBy(desc(statusEvidence.capturedAt));
      res.json(evidence);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/status-evidence/:id", isAuthenticated, async (req, res) => {
    try {
      const evidenceId = Number(req.params.id);
      if (isNaN(evidenceId)) return res.status(400).json({ message: "Neplatné ID" });
      const [evidence] = await db.select().from(statusEvidence)
        .where(eq(statusEvidence.id, evidenceId));
      if (!evidence) return res.status(404).json({ message: "Dôkaz nenájdený" });
      res.json(evidence);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get("/api/subjects/:id/status-evidence/by-history/:historyId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = Number(req.params.id);
      const historyId = Number(req.params.historyId);
      if (isNaN(subjectId) || isNaN(historyId)) return res.status(400).json({ message: "Neplatné ID" });
      const [evidence] = await db.select().from(statusEvidence)
        .where(and(
          eq(statusEvidence.subjectId, subjectId),
          eq(statusEvidence.fieldHistoryId, historyId)
        ));
      res.json(evidence || null);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // === FAMILY CLUSTER (Rodinný klaster - subjects with matching surname + address) ===
  app.get("/api/subjects/:id/family-cluster", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
      if (!subject) return res.status(404).json({ message: "Subjekt nenájdený" });

      const lastName = subject.lastName?.trim().toLowerCase();
      const details = subject.details as Record<string, any> || {};
      const address = (details.trvaly_pobyt || details.adresa || "").trim().toLowerCase();

      if (!lastName) return res.json({ members: [], totalFamilyWealth: 0, totalContracts: 0 });

      const allSubjects = await db.select({
        id: subjects.id,
        uid: subjects.uid,
        firstName: subjects.firstName,
        lastName: subjects.lastName,
        type: subjects.type,
        email: subjects.email,
        phone: subjects.phone,
        details: subjects.details,
        isActive: subjects.isActive,
        lifecycleStatus: subjects.lifecycleStatus,
      }).from(subjects).where(and(
        sql`LOWER(TRIM(${subjects.lastName})) = ${lastName}`,
        eq(subjects.isActive, true),
      ));

      const members = allSubjects.filter(s => {
        if (s.id === subjectId) return false;
        if (!address) return true;
        const sDetails = s.details as Record<string, any> || {};
        const sAddress = (sDetails.trvaly_pobyt || sDetails.adresa || "").trim().toLowerCase();
        if (!sAddress) return true;
        return sAddress.includes(address) || address.includes(sAddress);
      });

      const memberIds = [subjectId, ...members.map(m => m.id)];

      let totalFamilyWealth = 0;
      let totalContracts = 0;
      if (memberIds.length > 0) {
        const contractData = await db.select({
          totalPremium: sql<number>`COALESCE(SUM(${contracts.annualPremium}), 0)`,
          count: sql<number>`COUNT(*)::int`,
        }).from(contracts).where(and(
          inArray(contracts.subjectId, memberIds),
          sql`${contracts.isDeleted} = false`,
        ));
        totalFamilyWealth = Number(contractData[0]?.totalPremium || 0);
        totalContracts = Number(contractData[0]?.count || 0);
      }

      const subjectContract = await db.select({
        totalPremium: sql<number>`COALESCE(SUM(${contracts.annualPremium}), 0)`,
        count: sql<number>`COUNT(*)::int`,
      }).from(contracts).where(and(
        eq(contracts.subjectId, subjectId),
        sql`${contracts.isDeleted} = false`,
      ));

      const membersWithContracts = await Promise.all(members.map(async m => {
        const mc = await db.select({
          totalPremium: sql<number>`COALESCE(SUM(${contracts.annualPremium}), 0)`,
          count: sql<number>`COUNT(*)::int`,
        }).from(contracts).where(and(
          eq(contracts.subjectId, m.id),
          sql`${contracts.isDeleted} = false`,
        ));
        return {
          ...m,
          contractCount: Number(mc[0]?.count || 0),
          annualPremium: Number(mc[0]?.totalPremium || 0),
        };
      }));

      res.json({
        members: membersWithContracts,
        currentSubject: {
          contractCount: Number(subjectContract[0]?.count || 0),
          annualPremium: Number(subjectContract[0]?.totalPremium || 0),
        },
        totalFamilyWealth,
        totalContracts,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní rodinného klastra" });
    }
  });

  // === SUBJECT PORTFOLIO (Osobné portfólio subjektu - all contracts for a subject) ===
  app.get("/api/subjects/:id/portfolio", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const activeDivisionId = (req as any).appUser?.activeDivisionId;

      const conditions: any[] = [
        eq(contracts.subjectId, subjectId),
        sql`${contracts.isDeleted} = false`,
      ];

      if (activeDivisionId) {
        conditions.push(
          sql`${contracts.sectorProductId} IN (
            SELECT sp.id FROM sector_products sp
            JOIN sections sec ON sp.section_id = sec.id
            JOIN sectors s ON sec.sector_id = s.id
            WHERE s.division_id = ${activeDivisionId}
          )`
        );
      }

      const subjectContracts = await db.select({
        id: contracts.id,
        uid: contracts.uid,
        contractNumber: contracts.contractNumber,
        proposalNumber: contracts.proposalNumber,
        contractType: contracts.contractType,
        premiumAmount: contracts.premiumAmount,
        annualPremium: contracts.annualPremium,
        currency: contracts.currency,
        signedDate: contracts.signedDate,
        effectiveDate: contracts.effectiveDate,
        expiryDate: contracts.expiryDate,
        statusName: contractStatuses.name,
        statusColor: contractStatuses.color,
        partnerName: sql<string>`(SELECT name FROM partners WHERE id = ${contracts.partnerId})`,
        productName: sql<string>`(SELECT name FROM products WHERE id = ${contracts.productId})`,
        sectorName: sql<string>`(SELECT s.name FROM sector_products sp JOIN sectors s ON sp.sector_id = s.id WHERE sp.id = ${contracts.sectorProductId})`,
      })
        .from(contracts)
        .leftJoin(contractStatuses, eq(contracts.statusId, contractStatuses.id))
        .where(and(...conditions))
        .orderBy(desc(contracts.createdAt));

      const totalPremium = subjectContracts.reduce((sum, c) => sum + (c.annualPremium || 0), 0);

      res.json({
        contracts: subjectContracts,
        totalContracts: subjectContracts.length,
        totalAnnualPremium: totalPremium,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní portfólia" });
    }
  });

  // === SUBJECT RELATIONS (Relácie subjektu) ===
  app.get("/api/subject-relations/:id", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ categories: {} });

      if (!await checkKlientiSubjectAccess(req.appUser, subjectId)) {
        return res.status(403).json({ categories: {} });
      }

      const outgoing = await db.select({
        relation: subjectRelations,
        roleType: relationRoleTypes,
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .where(and(eq(subjectRelations.sourceSubjectId, subjectId), eq(subjectRelations.isActive, true)));

      const incoming = await db.select({
        relation: subjectRelations,
        roleType: relationRoleTypes,
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .where(and(eq(subjectRelations.targetSubjectId, subjectId), eq(subjectRelations.isActive, true)));

      const allSubjectIds = new Set<number>();
      outgoing.forEach(r => allSubjectIds.add(r.relation.targetSubjectId));
      incoming.forEach(r => allSubjectIds.add(r.relation.sourceSubjectId));

      const subjectNames: Record<number, string> = {};
      if (allSubjectIds.size > 0) {
        const subs = await db.select({ id: subjects.id, firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type })
          .from(subjects)
          .where(inArray(subjects.id, [...allSubjectIds]));
        subs.forEach(s => {
          subjectNames[s.id] = s.type === "person" ? `${s.firstName || ""} ${s.lastName || ""}`.trim() : (s.companyName || `ID ${s.id}`);
        });
      }

      const categories: Record<string, { label: string; count: number; relations: Array<{ id: number; relationType: string; relatedSubjectName: string; relatedSubjectId: number; direction: string }> }> = {};

      const addRelation = (r: any, direction: string, relatedId: number) => {
        const cat = r.roleType.category || "ostatne";
        const catLabel = cat === "rodina" ? "Rodina" : cat === "obchod" ? "Obchod" : cat === "pravne" ? "Právne" : "Ostatné";
        if (!categories[cat]) categories[cat] = { label: catLabel, count: 0, relations: [] };
        categories[cat].relations.push({
          id: r.relation.id,
          relationType: r.roleType.label || r.roleType.code,
          relatedSubjectName: subjectNames[relatedId] || `ID ${relatedId}`,
          relatedSubjectId: relatedId,
          direction,
        });
        categories[cat].count++;
      };

      outgoing.forEach(r => addRelation(r, "outgoing", r.relation.targetSubjectId));
      incoming.forEach(r => addRelation(r, "incoming", r.relation.sourceSubjectId));

      res.json({ categories });
    } catch (err: any) {
      res.status(500).json({ categories: {} });
    }
  });

  // === AI SUGGESTED RELATIONS (Navrhované prepojenia) ===
  app.get("/api/subjects/:id/suggested-relations", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });

      const suggestions = await db.select({
        suggestion: suggestedRelations,
        matchedSubject: {
          id: subjects.id,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          companyName: subjects.companyName,
          type: subjects.type,
        },
      })
        .from(suggestedRelations)
        .leftJoin(subjects, eq(suggestedRelations.matchedSubjectId, subjects.id))
        .where(and(
          eq(suggestedRelations.sourceSubjectId, subjectId),
          or(
            eq(suggestedRelations.status, "pending"),
            eq(suggestedRelations.status, "confirmed"),
          ),
        ))
        .orderBy(desc(suggestedRelations.createdAt));

      res.json(suggestions);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní návrhov" });
    }
  });

  app.post("/api/suggested-relations", isAuthenticated, async (req, res) => {
    try {
      const schema = z.object({
        sourceSubjectId: z.number().int(),
        detectedName: z.string().min(1),
        detectedRole: z.string().optional(),
        contractId: z.number().int().optional(),
        matchedSubjectId: z.number().int().optional(),
      });
      const parsed = schema.parse(req.body);

      const [suggestion] = await db.insert(suggestedRelations).values({
        sourceSubjectId: parsed.sourceSubjectId,
        detectedName: parsed.detectedName,
        detectedRole: parsed.detectedRole || null,
        contractId: parsed.contractId || null,
        matchedSubjectId: parsed.matchedSubjectId || null,
        createdBy: "ai",
      }).returning();

      res.json(suggestion);
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Neplatné dáta", errors: err.errors });
      res.status(500).json({ message: err?.message || "Chyba pri vytváraní návrhu" });
    }
  });

  app.post("/api/suggested-relations/:id/confirm", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Neplatné ID" });

      const user = (req as any).appUser || (req as any).user;

      const [existing] = await db.select().from(suggestedRelations).where(eq(suggestedRelations.id, id));
      if (!existing) return res.status(404).json({ message: "Návrh nenájdený" });

      const newCount = (existing.confirmCount || 0) + 1;
      const autoPromote = newCount >= 5;

      let autoPromotedRelationId = existing.autoPromotedRelationId;

      if (autoPromote && !existing.autoPromotedRelationId) {
        const familyRoleType = await db.select().from(relationRoleTypes)
          .where(eq(relationRoleTypes.code, "rodinny_prislusnik"))
          .limit(1);

        let roleTypeId = familyRoleType[0]?.id;
        if (!roleTypeId) {
          const [newRole] = await db.insert(relationRoleTypes).values({
            category: "family",
            code: "rodinny_prislusnik",
            label: "Rodinný príslušník",
            labelEn: "Family member",
            isActive: true,
            sortOrder: 100,
          }).returning();
          roleTypeId = newRole.id;
        }

        if (existing.matchedSubjectId) {
          const [relation] = await db.insert(subjectRelations).values({
            sourceSubjectId: existing.sourceSubjectId,
            targetSubjectId: existing.matchedSubjectId,
            roleTypeId,
            category: "family",
            createdByUserId: user?.id || null,
            createdByName: user?.username || "system",
          }).returning();
          autoPromotedRelationId = relation.id;
        }
      }

      const [updated] = await db.update(suggestedRelations).set({
        confirmCount: newCount,
        status: autoPromote ? "auto_confirmed" : "confirmed",
        lastConfirmedAt: new Date(),
        lastConfirmedByUserId: user?.id || null,
        lastConfirmedByName: user?.username || "system",
        autoPromotedRelationId,
        updatedAt: new Date(),
      }).where(eq(suggestedRelations.id, id)).returning();

      res.json({ suggestion: updated, autoPromoted: autoPromote });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri potvrdení návrhu" });
    }
  });

  app.post("/api/suggested-relations/:id/reject", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Neplatné ID" });

      const [updated] = await db.update(suggestedRelations).set({
        status: "rejected",
        updatedAt: new Date(),
      }).where(eq(suggestedRelations.id, id)).returning();

      if (!updated) return res.status(404).json({ message: "Návrh nenájdený" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri zamietnutí návrhu" });
    }
  });

  // === DRAFT SUBJECT CREATION (Auto-create when unknown name detected) ===
  const createDraftSubjectSchema = z.object({
    firstName: z.string().optional().nullable(),
    lastName: z.string().optional().nullable(),
    companyName: z.string().optional().nullable(),
    type: z.enum(["FO", "PO", "SZCO"]).default("FO"),
    sourceContext: z.string().optional(),
    sourceRelationRoleCode: z.string().optional(),
    sourceSubjectId: z.number().int().optional(),
  });

  app.post("/api/subjects/draft", isAuthenticated, async (req, res) => {
    try {
      const parsed = createDraftSubjectSchema.parse(req.body);

      if (!parsed.firstName && !parsed.lastName && !parsed.companyName) {
        return res.status(400).json({ message: "Meno alebo názov firmy je povinný" });
      }

      const searchName = parsed.companyName
        ? parsed.companyName.toLowerCase().trim()
        : `${(parsed.firstName || "").toLowerCase().trim()} ${(parsed.lastName || "").toLowerCase().trim()}`.trim();

      const existingSubjects = await db.select().from(subjects).where(
        and(
          eq(subjects.isActive, true),
          parsed.companyName
            ? sql`LOWER(${subjects.companyName}) = ${searchName}`
            : sql`LOWER(CONCAT(COALESCE(${subjects.firstName},''), ' ', COALESCE(${subjects.lastName},''))) = ${searchName}`
        )
      );

      if (existingSubjects.length > 0) {
        return res.json({
          isDuplicate: true,
          existingSubjects: existingSubjects.map(s => ({
            id: s.id,
            uid: s.uid,
            firstName: s.firstName,
            lastName: s.lastName,
            companyName: s.companyName,
            type: s.type,
          })),
          message: "Subjekt s týmto menom už existuje",
        });
      }

      const [counterRow] = await db
        .update(globalCounters)
        .set({ currentValue: sql`${globalCounters.currentValue} + 1` })
        .where(eq(globalCounters.counterName, "subject_uid"))
        .returning();

      let uidNum = counterRow?.currentValue || 1;
      const uid = String(uidNum).padStart(12, "0");
      const user = (req as any).user;

      const [newSubject] = await db.insert(subjects).values({
        uid,
        type: parsed.type,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        companyName: parsed.companyName,
        isActive: true,
        details: { isDraft: true, draftSource: parsed.sourceContext || "relation_auto" },
        registeredByUserId: user?.id || null,
      }).returning();

      if (parsed.sourceSubjectId && parsed.sourceRelationRoleCode) {
        const [roleType] = await db.select().from(relationRoleTypes).where(eq(relationRoleTypes.code, parsed.sourceRelationRoleCode));
        if (roleType) {
          await db.insert(subjectRelations).values({
            sourceSubjectId: parsed.sourceSubjectId,
            targetSubjectId: newSubject.id,
            roleTypeId: roleType.id,
            category: roleType.category,
            contextSector: parsed.sourceContext,
            isDraft: true,
            createdByUserId: user?.id || null,
            createdByName: user?.username || "system",
          });
        }
      }

      res.json({
        isDuplicate: false,
        subject: {
          id: newSubject.id,
          uid: newSubject.uid,
          firstName: newSubject.firstName,
          lastName: newSubject.lastName,
          companyName: newSubject.companyName,
          type: newSubject.type,
          isDraft: true,
        },
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: "Neplatné dáta", errors: err.errors });
      res.status(500).json({ message: err?.message || "Chyba pri vytváraní draft subjektu" });
    }
  });

  // === FAMILY RELATIONS: MATURITY SEMAPHORE (Semafor dospelosti) ===
  const FAMILY_ROLE_CODES = ['rodic_zakonny_zastupca', 'dieta_opravnena_osoba', 'manzel_manzelka', 'partner_druh', 'stary_rodic', 'vnuk_vnucka', 'surodenc', 'iny_pribuzny'];
  const GUARDIAN_ROLE_CODES = ['rodic_zakonny_zastupca', 'stary_rodic'];
  const CHILD_ROLE_CODES = ['dieta_opravnena_osoba', 'vnuk_vnucka'];
  const INHERITABLE_ADDRESS_FIELDS = [
    'adr_ulica', 'adr_cislo_domu', 'adr_obec', 'adr_psc', 'adr_okres', 'adr_kraj', 'adr_stat',
    'adr_koresp_ulica', 'adr_koresp_cislo', 'adr_koresp_obec', 'adr_koresp_psc',
    'adr_koresp_okres', 'adr_koresp_kraj', 'adr_koresp_stat'
  ];

  async function refreshMaturityAlerts(): Promise<number> {
    try {
      const familyRelations = await db.select({
        relation: subjectRelations,
        roleType: relationRoleTypes,
        childSubject: {
          id: subjects.id,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          details: subjects.details,
          type: subjects.type,
        },
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .innerJoin(subjects, eq(subjectRelations.targetSubjectId, subjects.id))
        .where(and(
          eq(subjectRelations.isActive, true),
          eq(relationRoleTypes.category, "rodina"),
          sql`${relationRoleTypes.code} IN ('dieta_opravnena_osoba', 'vnuk_vnucka')`,
          eq(subjects.isActive, true)
        ));

      let alertCount = 0;
      const now = new Date();

      for (const fr of familyRelations) {
        const details = (fr.childSubject.details as any) || {};
        const dynFields = details.dynamicFields || details;
        const dobStr = dynFields.datum_narodenia || dynFields.p_datum_nar;
        if (!dobStr) continue;

        const dob = new Date(dobStr);
        if (isNaN(dob.getTime())) continue;

        const maturityDate = new Date(dob);
        maturityDate.setFullYear(maturityDate.getFullYear() + 18);

        const diffMs = maturityDate.getTime() - now.getTime();
        const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        let alertType: string;
        if (daysUntil <= 0) alertType = "reached";
        else if (daysUntil <= 30) alertType = "imminent";
        else if (daysUntil <= 90) alertType = "approaching";
        else if (daysUntil <= 365) alertType = "upcoming";
        else continue;

        const existing = await db.select().from(maturityAlerts).where(
          and(
            eq(maturityAlerts.subjectId, fr.childSubject.id),
            eq(maturityAlerts.status, "pending")
          )
        );

        if (existing.length > 0) {
          await db.update(maturityAlerts).set({
            alertType,
            daysUntilMaturity: daysUntil,
            updatedAt: new Date(),
          }).where(eq(maturityAlerts.id, existing[0].id));
        } else {
          await db.insert(maturityAlerts).values({
            subjectId: fr.childSubject.id,
            dateOfBirth: dob,
            maturityDate,
            parentSubjectId: fr.relation.sourceSubjectId,
            guardianRelationId: fr.relation.id,
            alertType,
            daysUntilMaturity: daysUntil,
            status: "pending",
          });
        }
        alertCount++;
      }

      console.log(`[MATURITY SEMAPHORE] Refreshed ${alertCount} maturity alerts`);
      return alertCount;
    } catch (err) {
      console.error("[MATURITY SEMAPHORE ERROR]", err);
      return 0;
    }
  }

  refreshMaturityAlerts().catch(err => console.error("[MATURITY SEMAPHORE INIT ERROR]", err));

  async function processAutoAdultTransitions(): Promise<number> {
    try {
      const reachedAlerts = await db.select({ alert: maturityAlerts, subject: { id: subjects.id, uid: subjects.uid, firstName: subjects.firstName, lastName: subjects.lastName, details: subjects.details } })
        .from(maturityAlerts)
        .innerJoin(subjects, eq(maturityAlerts.subjectId, subjects.id))
        .where(and(eq(maturityAlerts.alertType, "reached"), eq(maturityAlerts.status, "pending")));

      let processed = 0;
      for (const ra of reachedAlerts) {
        const existingEvent = await db.select({ id: maturityEvents.id }).from(maturityEvents)
          .where(and(eq(maturityEvents.subjectId, ra.subject.id), eq(maturityEvents.status, "completed"))).limit(1);
        if (existingEvent.length > 0) continue;

        try {
          const guardianRelations = await db.select({ rel: subjectRelations, roleType: relationRoleTypes })
            .from(subjectRelations)
            .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
            .where(and(
              eq(subjectRelations.targetSubjectId, ra.subject.id),
              eq(subjectRelations.isActive, true),
              eq(relationRoleTypes.category, "rodina"),
              sql`${relationRoleTypes.code} IN ('rodic_zakonny_zastupca', 'stary_rodic')`
            ));

          const guardianIds = guardianRelations.map(g => g.rel.sourceSubjectId);
          const actions: string[] = [];
          const notifsSent: any[] = [];
          const blocksCreated: any[] = [];
          const consentsRevoked: any[] = [];

          const revokedConsents = await db.update(accessConsentLog).set({
            isActive: false, revokedAt: new Date(), revokedReason: "auto_adult_transition",
            revokedByName: "SYSTEM"
          }).where(and(
            eq(accessConsentLog.grantorSubjectId, ra.subject.id),
            eq(accessConsentLog.consentType, "post_maturity_sharing"),
            eq(accessConsentLog.isActive, true)
          )).returning();
          consentsRevoked.push(...revokedConsents.map(c => c.id));
          actions.push(`Revoked ${revokedConsents.length} consents`);

          const sensitiveBlocks = ["EKONOMIKA", "AML", "DOKLADY", "INVESTIČNÝ PROFIL", "ZDRAVOTNÝ PROFIL"];
          for (const block of sensitiveBlocks) {
            const [pb] = await db.insert(privacyBlocks).values({
              subjectId: ra.subject.id, blockType: "section", blockKey: block,
              isPrivate: true, reason: "Auto-transition pri dosiahnutí 18 rokov",
              setByName: "SYSTEM",
            }).returning();
            blocksCreated.push(pb.id);
          }
          actions.push(`Created ${sensitiveBlocks.length} privacy blocks`);

          for (const gr of guardianRelations) {
            await db.insert(guardianshipArchive).values({
              guardianSubjectId: gr.rel.sourceSubjectId,
              wardSubjectId: ra.subject.id,
              relationId: gr.rel.id,
              guardianType: "fo",
              roleCode: gr.roleType.code,
              roleLabel: gr.roleType.label,
              legalBasis: "Dosiahnutie dospelosti - automatický prechod",
              startedAt: gr.rel.validFrom || gr.rel.createdAt,
              endedAt: new Date(),
              endReason: "auto_adult_transition",
              archivalTrigger: "maturity",
              archivedByName: "SYSTEM",
            });
            await db.update(subjectRelations).set({
              isActive: false, validTo: new Date(), updatedAt: new Date(),
              relationMeta: sql`COALESCE(relation_meta, '{}'::jsonb) || '{"deactivatedReason":"auto_adult_transition","deactivatedBy":"SYSTEM"}'::jsonb`
            }).where(eq(subjectRelations.id, gr.rel.id));
          }
          actions.push(`Archived ${guardianRelations.length} guardian relations`);

          const wardName = `${ra.subject.firstName || ""} ${ra.subject.lastName || ""}`.trim() || ra.subject.uid;
          await db.insert(notificationQueue).values({
            recipientSubjectId: ra.subject.id,
            notificationType: "adult_transition",
            title: "Dosiahli ste 18 rokov",
            message: `Vaše citlivé údaje boli automaticky zabezpečené. Zákonní zástupcovia nemajú automatický prístup k vašim finančným a zdravotným údajom.`,
            priority: "high", status: "sent",
            metadata: { eventType: "auto_adult_transition", subjectId: ra.subject.id },
          });
          notifsSent.push({ recipientId: ra.subject.id, type: "ward" });

          for (const gId of guardianIds) {
            await db.insert(notificationQueue).values({
              recipientSubjectId: gId,
              notificationType: "adult_transition",
              title: `${wardName} dosiahol/a 18 rokov`,
              message: `Automatická zmena: Prístup k citlivým údajom subjektu ${wardName} bol obmedzený. Pre obnovenie prístupu je potrebný explicitný súhlas.`,
              priority: "high", status: "sent",
              metadata: { eventType: "auto_adult_transition", wardSubjectId: ra.subject.id },
            });
            notifsSent.push({ recipientId: gId, type: "guardian" });
          }
          actions.push(`Sent ${notifsSent.length} notifications`);

          await db.insert(maturityEvents).values({
            subjectId: ra.subject.id, eventType: "auto_adult_transition",
            triggerAge: 18, processedAt: new Date(), status: "completed",
            guardianSubjectIds: guardianIds, actionsPerformed: actions,
            notificationsSent: notifsSent, privacyBlocksCreated: blocksCreated,
            consentsRevoked, completedAt: new Date(),
          });

          await db.update(maturityAlerts).set({ status: "resolved", resolvedAt: new Date(), resolvedByName: "SYSTEM" }).where(eq(maturityAlerts.id, ra.alert.id));

          processed++;
        } catch (subErr: any) {
          await db.insert(maturityEvents).values({
            subjectId: ra.subject.id, eventType: "auto_adult_transition",
            triggerAge: 18, status: "failed", errorDetails: subErr?.message,
          });
        }
      }
      console.log(`[AUTO ADULT TRANSITION] Processed ${processed} transitions`);
      return processed;
    } catch (err) {
      console.error("[AUTO ADULT TRANSITION ERROR]", err);
      return 0;
    }
  }

  processAutoAdultTransitions().catch(err => console.error("[AUTO ADULT TRANSITION INIT ERROR]", err));
  setInterval(() => {
    refreshMaturityAlerts().catch(err => console.error("[MATURITY SEMAPHORE CRON ERROR]", err));
    processAutoAdultTransitions().catch(err => console.error("[AUTO ADULT TRANSITION CRON ERROR]", err));
  }, 60 * 60 * 1000);


  app.get("/api/maturity-alerts", isAuthenticated, async (req, res) => {
    try {
      const status = (req.query.status as string) || "pending";
      const alerts = await db.select({
        alert: maturityAlerts,
        childSubject: {
          id: subjects.id,
          uid: subjects.uid,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          type: subjects.type,
        },
      })
        .from(maturityAlerts)
        .innerJoin(subjects, eq(maturityAlerts.subjectId, subjects.id))
        .where(eq(maturityAlerts.status, status))
        .orderBy(maturityAlerts.daysUntilMaturity);

      const enriched = [];
      for (const a of alerts) {
        let parentName = null;
        if (a.alert.parentSubjectId) {
          const [parent] = await db.select({ firstName: subjects.firstName, lastName: subjects.lastName, uid: subjects.uid })
            .from(subjects).where(eq(subjects.id, a.alert.parentSubjectId));
          if (parent) parentName = `${parent.firstName || ""} ${parent.lastName || ""}`.trim();
        }
        enriched.push({
          ...a.alert,
          childName: `${a.childSubject.firstName || ""} ${a.childSubject.lastName || ""}`.trim(),
          childUid: a.childSubject.uid,
          childType: a.childSubject.type,
          parentName,
        });
      }

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní alertov dospelosti" });
    }
  });

  app.get("/api/maturity-alerts/subject/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const alerts = await db.select().from(maturityAlerts).where(
        and(
          or(eq(maturityAlerts.subjectId, subjectId), eq(maturityAlerts.parentSubjectId, subjectId)),
          eq(maturityAlerts.status, "pending")
        )
      );

      const childAlerts = alerts.filter(a => a.subjectId === subjectId);
      const parentAlerts = alerts.filter(a => a.parentSubjectId === subjectId);

      res.json({ childAlerts, parentAlerts, total: alerts.length });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní alertov" });
    }
  });

  app.patch("/api/maturity-alerts/:id/resolve", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Neplatné ID" });

      const { resolution, legalBasis } = req.body;
      const user = (req as any).appUser;

      const [alert] = await db.select().from(maturityAlerts).where(eq(maturityAlerts.id, id));
      if (!alert) return res.status(404).json({ message: "Alert nenájdený" });

      const [updated] = await db.update(maturityAlerts).set({
        status: "resolved",
        resolution: resolution || "manually_resolved",
        resolvedAt: new Date(),
        resolvedByUserId: user?.id,
        resolvedByName: user?.username,
        updatedAt: new Date(),
      }).where(eq(maturityAlerts.id, id)).returning();

      if (alert.guardianRelationId && (resolution === "detach" || resolution === "retain")) {
        const [relation] = await db.select({
          rel: subjectRelations,
          roleType: relationRoleTypes,
        }).from(subjectRelations)
          .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
          .where(eq(subjectRelations.id, alert.guardianRelationId));

        if (relation) {
          const guardianSubject = await db.select({ type: subjects.type }).from(subjects)
            .where(eq(subjects.id, relation.rel.sourceSubjectId));
          const guardianType = guardianSubject[0]?.type === "company" ? "po" : "fo";

          await db.insert(guardianshipArchive).values({
            guardianSubjectId: relation.rel.sourceSubjectId,
            wardSubjectId: alert.subjectId,
            relationId: alert.guardianRelationId,
            guardianType,
            roleCode: relation.roleType.code,
            roleLabel: relation.roleType.label,
            legalBasis: legalBasis || null,
            startedAt: relation.rel.validFrom || relation.rel.createdAt,
            endedAt: new Date(),
            endReason: resolution === "detach" ? "maturity_reached_detach" : "maturity_reached_retain",
            archivalTrigger: "maturity",
            archivedByUserId: user?.id,
            archivedByName: user?.username,
            meta: { alertId: alert.id, alertType: alert.alertType, daysUntilMaturity: alert.daysUntilMaturity },
          });

          if (resolution === "detach") {
            await db.update(subjectRelations).set({
              isActive: false,
              validTo: new Date(),
              updatedAt: new Date(),
              relationMeta: sql`COALESCE(relation_meta, '{}'::jsonb) || ${JSON.stringify({ deactivatedReason: "maturity_detach", deactivatedAt: new Date().toISOString(), deactivatedBy: user?.username })}::jsonb`,
            }).where(eq(subjectRelations.id, alert.guardianRelationId));
          } else if (resolution === "retain") {
            await db.update(subjectRelations).set({
              updatedAt: new Date(),
              relationMeta: sql`COALESCE(relation_meta, '{}'::jsonb) || ${JSON.stringify({ retainedAfterMaturity: true, legalBasis: legalBasis || "obmedzená spôsobilosť", retainedAt: new Date().toISOString(), retainedBy: user?.username })}::jsonb`,
            }).where(eq(subjectRelations.id, alert.guardianRelationId));
          }
        }
      }

      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri riešení alertu" });
    }
  });

  // === GUARDIANSHIP: Universal guardian access hierarchy ===
  const GUARDIAN_ROLE_CODE_SET = ['rodic_zakonny_zastupca'];

  app.get("/api/guardianship/wards/:guardianId", isAuthenticated, async (req, res) => {
    try {
      const guardianId = parseInt(req.params.guardianId);
      if (isNaN(guardianId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, guardianId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const search = (req.query.search as string) || "";
      const offset = (page - 1) * limit;

      let wardsQuery = db.select({
        relation: subjectRelations,
        roleType: relationRoleTypes,
        ward: {
          id: subjects.id,
          uid: subjects.uid,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          companyName: subjects.companyName,
          type: subjects.type,
          email: subjects.email,
          phone: subjects.phone,
          birthNumber: subjects.birthNumber,
          details: subjects.details,
          isActive: subjects.isActive,
        },
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .innerJoin(subjects, eq(subjectRelations.targetSubjectId, subjects.id))
        .where(and(
          eq(subjectRelations.sourceSubjectId, guardianId),
          eq(subjectRelations.isActive, true),
          eq(relationRoleTypes.category, "rodina"),
          sql`${relationRoleTypes.code} IN ('rodic_zakonny_zastupca', 'stary_rodic')`,
          eq(subjects.isActive, true),
          ...(search ? [sql`(${subjects.firstName} || ' ' || ${subjects.lastName}) ILIKE ${'%' + search + '%'}`] : [])
        ))
        .limit(limit)
        .offset(offset);

      const wards = await wardsQuery;

      const [countResult] = await db.select({ count: sql<number>`count(*)::int` })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .innerJoin(subjects, eq(subjectRelations.targetSubjectId, subjects.id))
        .where(and(
          eq(subjectRelations.sourceSubjectId, guardianId),
          eq(subjectRelations.isActive, true),
          eq(relationRoleTypes.category, "rodina"),
          sql`${relationRoleTypes.code} IN ('rodic_zakonny_zastupca', 'stary_rodic')`,
          eq(subjects.isActive, true),
          ...(search ? [sql`(${subjects.firstName} || ' ' || ${subjects.lastName}) ILIKE ${'%' + search + '%'}`] : [])
        ));

      const computeAge = (details: any) => {
        const dyn = details?.dynamicFields || details || {};
        const dob = dyn.datum_narodenia || dyn.p_datum_nar;
        if (!dob) return null;
        const d = new Date(dob);
        if (isNaN(d.getTime())) return null;
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
        return age;
      };

      const wardsList = wards.map(w => {
        const age = computeAge(w.ward.details);
        const dyn = (w.ward.details as any)?.dynamicFields || (w.ward.details as any) || {};
        return {
          relationId: w.relation.id,
          subjectId: w.ward.id,
          uid: w.ward.uid,
          name: w.ward.companyName || `${w.ward.firstName || ""} ${w.ward.lastName || ""}`.trim(),
          type: w.ward.type,
          email: w.ward.email,
          phone: w.ward.phone,
          birthNumber: w.ward.birthNumber,
          roleCode: w.roleType.code,
          roleLabel: w.roleType.label,
          age,
          isMinor: age !== null && age < 18,
          dateOfBirth: dyn.datum_narodenia || dyn.p_datum_nar || null,
          contextSector: w.relation.contextSector,
          validFrom: w.relation.validFrom,
          meta: w.relation.relationMeta,
        };
      });

      res.json({
        wards: wardsList,
        total: countResult?.count || 0,
        page,
        limit,
        totalPages: Math.ceil((countResult?.count || 0) / limit),
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní zastupovaných osôb" });
    }
  });

  app.get("/api/guardianship/guardians/:wardId", isAuthenticated, async (req, res) => {
    try {
      const wardId = parseInt(req.params.wardId);
      if (isNaN(wardId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, wardId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const guardians = await db.select({
        relation: subjectRelations,
        roleType: relationRoleTypes,
        guardian: {
          id: subjects.id,
          uid: subjects.uid,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          companyName: subjects.companyName,
          type: subjects.type,
          email: subjects.email,
          phone: subjects.phone,
        },
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .innerJoin(subjects, eq(subjectRelations.sourceSubjectId, subjects.id))
        .where(and(
          eq(subjectRelations.targetSubjectId, wardId),
          eq(subjectRelations.isActive, true),
          eq(relationRoleTypes.category, "rodina"),
          sql`${relationRoleTypes.code} IN ('rodic_zakonny_zastupca', 'stary_rodic')`,
          eq(subjects.isActive, true)
        ));

      const guardiansList = guardians.map(g => ({
        relationId: g.relation.id,
        subjectId: g.guardian.id,
        uid: g.guardian.uid,
        name: g.guardian.companyName || `${g.guardian.firstName || ""} ${g.guardian.lastName || ""}`.trim(),
        type: g.guardian.type,
        email: g.guardian.email,
        phone: g.guardian.phone,
        roleCode: g.roleType.code,
        roleLabel: g.roleType.label,
        validFrom: g.relation.validFrom,
        meta: g.relation.relationMeta,
      }));

      res.json({ guardians: guardiansList, total: guardiansList.length });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní zákonných zástupcov" });
    }
  });

  app.get("/api/guardianship/history/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const history = await db.select().from(guardianshipArchive).where(
        or(
          eq(guardianshipArchive.guardianSubjectId, subjectId),
          eq(guardianshipArchive.wardSubjectId, subjectId)
        )
      ).orderBy(sql`${guardianshipArchive.createdAt} DESC`);

      const enriched = [];
      for (const h of history) {
        let guardianName = null, wardName = null;
        const [gSubj] = await db.select({ firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type })
          .from(subjects).where(eq(subjects.id, h.guardianSubjectId));
        const [wSubj] = await db.select({ firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type })
          .from(subjects).where(eq(subjects.id, h.wardSubjectId));
        if (gSubj) guardianName = gSubj.companyName || `${gSubj.firstName || ""} ${gSubj.lastName || ""}`.trim();
        if (wSubj) wardName = wSubj.companyName || `${wSubj.firstName || ""} ${wSubj.lastName || ""}`.trim();
        enriched.push({ ...h, guardianName, wardName });
      }

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní histórie zastupovania" });
    }
  });

  app.post("/api/guardianship/detach", isAuthenticated, async (req, res) => {
    try {
      const { relationId, reason, legalBasis } = req.body;
      if (!relationId) return res.status(400).json({ message: "Chýba ID relácie" });

      const user = (req as any).appUser;
      const [relation] = await db.select({
        rel: subjectRelations,
        roleType: relationRoleTypes,
      }).from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .where(eq(subjectRelations.id, relationId));

      if (!relation) return res.status(404).json({ message: "Relácia nenájdená" });
      if (!await checkKlientiSubjectAccess(user, relation.rel.sourceSubjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const guardianSubject = await db.select({ type: subjects.type }).from(subjects)
        .where(eq(subjects.id, relation.rel.sourceSubjectId));
      const guardianType = guardianSubject[0]?.type === "company" ? "po" : "fo";

      await db.insert(guardianshipArchive).values({
        guardianSubjectId: relation.rel.sourceSubjectId,
        wardSubjectId: relation.rel.targetSubjectId,
        relationId,
        guardianType,
        roleCode: relation.roleType.code,
        roleLabel: relation.roleType.label,
        legalBasis: legalBasis || null,
        startedAt: relation.rel.validFrom || relation.rel.createdAt,
        endedAt: new Date(),
        endReason: reason || "manual_detach",
        archivalTrigger: "manual",
        archivedByUserId: user?.id,
        archivedByName: user?.username,
      });

      await db.update(subjectRelations).set({
        isActive: false,
        validTo: new Date(),
        updatedAt: new Date(),
        relationMeta: sql`COALESCE(relation_meta, '{}'::jsonb) || ${JSON.stringify({ deactivatedReason: reason || "manual_detach", deactivatedAt: new Date().toISOString(), deactivatedBy: user?.username })}::jsonb`,
      }).where(eq(subjectRelations.id, relationId));

      res.json({ success: true, message: "Zastupovanie ukončené a archivované" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri ukončení zastupovania" });
    }
  });

  // === GDPR & PRIVACY: Households, Privacy Blocks, Access Consent ===

  // --- HOUSEHOLDS ---
  // Create household
  app.post("/api/households", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).appUser;
      const { name, description, address, memberSubjectIds } = req.body;
      if (!name) return res.status(400).json({ message: "Názov domácnosti je povinný" });

      const [counter] = await db.select().from(globalCounters).where(eq(globalCounters.counterName, "subject"));
      const nextVal = (counter?.currentValue || 0) + 1;
      await db.update(globalCounters).set({ currentValue: nextVal }).where(eq(globalCounters.counterName, "subject"));
      const uid = `DOM-${String(nextVal).padStart(6, '0')}`;

      const [household] = await db.insert(households).values({
        uid,
        name,
        description: description || null,
        address: address || null,
        createdByUserId: user?.id,
        createdByName: user?.username,
      }).returning();

      if (memberSubjectIds && Array.isArray(memberSubjectIds)) {
        for (const sid of memberSubjectIds) {
          await db.insert(householdMembers).values({
            householdId: household.id,
            subjectId: sid,
            role: "clen",
            addedByUserId: user?.id,
            addedByName: user?.username,
          });

          for (const otherId of memberSubjectIds.filter((s: number) => s !== sid)) {
            await db.insert(accessConsentLog).values({
              grantorSubjectId: sid,
              granteeSubjectId: otherId,
              consentType: "household_membership",
              action: "grant",
              scope: "household_shared",
              reason: `Pridanie do domácnosti ${household.name}`,
              householdId: household.id,
              grantedByUserId: user?.id,
              grantedByName: user?.username,
            });
          }
        }
      }

      await logAudit(req, { action: "CREATE", module: "households", entityId: household.id, entityName: `Domácnosť: ${name}`, newData: { uid, name, memberCount: memberSubjectIds?.length || 0 } });
      res.json(household);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri vytváraní domácnosti" });
    }
  });

  // List households for a subject
  app.get("/api/households/subject/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const memberships = await db.select({
        membership: householdMembers,
        household: households,
      })
        .from(householdMembers)
        .innerJoin(households, eq(householdMembers.householdId, households.id))
        .where(and(
          eq(householdMembers.subjectId, subjectId),
          eq(householdMembers.isActive, true),
          eq(households.isActive, true)
        ));

      const result = [];
      for (const m of memberships) {
        const members = await db.select({
          member: householdMembers,
          subject: {
            id: subjects.id,
            uid: subjects.uid,
            firstName: subjects.firstName,
            lastName: subjects.lastName,
            companyName: subjects.companyName,
            type: subjects.type,
            email: subjects.email,
            phone: subjects.phone,
          },
        })
          .from(householdMembers)
          .innerJoin(subjects, eq(householdMembers.subjectId, subjects.id))
          .where(and(
            eq(householdMembers.householdId, m.household.id),
            eq(householdMembers.isActive, true)
          ));

        const assets = await db.select().from(householdAssets).where(and(
          eq(householdAssets.householdId, m.household.id),
          eq(householdAssets.isActive, true)
        ));

        result.push({
          ...m.household,
          myRole: m.membership.role,
          members: members.map(mb => ({
            memberId: mb.member.id,
            subjectId: mb.subject.id,
            uid: mb.subject.uid,
            name: mb.subject.companyName || `${mb.subject.firstName || ""} ${mb.subject.lastName || ""}`.trim(),
            type: mb.subject.type,
            email: mb.subject.email,
            phone: mb.subject.phone,
            role: mb.member.role,
            joinedAt: mb.member.joinedAt,
          })),
          assets,
        });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní domácností" });
    }
  });

  // Add member to household
  app.post("/api/households/:householdId/members", isAuthenticated, async (req, res) => {
    try {
      const householdId = parseInt(req.params.householdId);
      const { subjectId, role } = req.body;
      const user = (req as any).appUser;
      if (isNaN(householdId) || !subjectId) return res.status(400).json({ message: "Neplatné parametre" });

      const [household] = await db.select().from(households).where(eq(households.id, householdId));
      if (!household) return res.status(404).json({ message: "Domácnosť nenájdená" });

      const existing = await db.select().from(householdMembers).where(and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.subjectId, subjectId),
        eq(householdMembers.isActive, true)
      ));
      if (existing.length > 0) return res.status(409).json({ message: "Subjekt je už členom domácnosti" });

      const [member] = await db.insert(householdMembers).values({
        householdId,
        subjectId,
        role: role || "clen",
        addedByUserId: user?.id,
        addedByName: user?.username,
      }).returning();

      const existingMembers = await db.select().from(householdMembers).where(and(
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.isActive, true),
        sql`${householdMembers.subjectId} != ${subjectId}`
      ));

      for (const em of existingMembers) {
        await db.insert(accessConsentLog).values({
          grantorSubjectId: subjectId,
          granteeSubjectId: em.subjectId,
          consentType: "household_membership",
          action: "grant",
          scope: "household_shared",
          reason: `Pridanie do domácnosti ${household.name}`,
          householdId,
          grantedByUserId: user?.id,
          grantedByName: user?.username,
        });
        await db.insert(accessConsentLog).values({
          grantorSubjectId: em.subjectId,
          granteeSubjectId: subjectId,
          consentType: "household_membership",
          action: "grant",
          scope: "household_shared",
          reason: `Nový člen domácnosti ${household.name}`,
          householdId,
          grantedByUserId: user?.id,
          grantedByName: user?.username,
        });
      }

      await logAudit(req, { action: "ADD_MEMBER", module: "households", entityId: householdId, entityName: `Člen pridaný do domácnosti ${household.name}`, newData: { subjectId, role: role || "clen" } });
      res.json(member);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri pridávaní člena" });
    }
  });

  // Remove member from household
  app.post("/api/households/:householdId/members/:memberId/remove", isAuthenticated, async (req, res) => {
    try {
      const householdId = parseInt(req.params.householdId);
      const memberId = parseInt(req.params.memberId);
      const user = (req as any).appUser;
      const { reason } = req.body;

      const [member] = await db.select().from(householdMembers).where(eq(householdMembers.id, memberId));
      if (!member) return res.status(404).json({ message: "Člen nenájdený" });

      await db.update(householdMembers).set({
        isActive: false,
        leftAt: new Date(),
      }).where(eq(householdMembers.id, memberId));

      await db.update(accessConsentLog).set({
        isActive: false,
        revokedAt: new Date(),
        revokedByUserId: user?.id,
        revokedByName: user?.username,
        revokedReason: reason || "Odstránenie z domácnosti",
      }).where(and(
        eq(accessConsentLog.householdId, householdId),
        eq(accessConsentLog.isActive, true),
        or(
          eq(accessConsentLog.grantorSubjectId, member.subjectId),
          eq(accessConsentLog.granteeSubjectId, member.subjectId)
        )
      ));

      await logAudit(req, { action: "REMOVE_MEMBER", module: "households", entityId: householdId, entityName: `Člen odstránený z domácnosti`, oldData: { subjectId: member.subjectId }, newData: { reason: reason || "manual" } });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri odstraňovaní člena" });
    }
  });

  // Add/update household asset
  app.post("/api/households/:householdId/assets", isAuthenticated, async (req, res) => {
    try {
      const householdId = parseInt(req.params.householdId);
      const user = (req as any).appUser;
      const { assetType, name, description, value, currency, details, validFrom, validTo, sourceType } = req.body;
      if (!assetType || !name) return res.status(400).json({ message: "Typ a názov majetku sú povinné" });

      const [asset] = await db.insert(householdAssets).values({
        householdId,
        assetType,
        name,
        description: description || null,
        value: value || null,
        currency: currency || "EUR",
        details: details || {},
        sourceType: sourceType || "manual",
        validFrom: validFrom ? new Date(validFrom) : null,
        validTo: validTo ? new Date(validTo) : null,
        createdByUserId: user?.id,
        createdByName: user?.username,
      }).returning();

      await logAudit(req, { action: "ADD_ASSET", module: "households", entityId: householdId, entityName: `Majetok: ${name}`, newData: { assetType, name, value } });
      res.json(asset);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri pridávaní majetku" });
    }
  });

  // Remove household asset
  app.delete("/api/household-assets/:assetId", isAuthenticated, async (req, res) => {
    try {
      const assetId = parseInt(req.params.assetId);
      const user = (req as any).appUser;

      await db.update(householdAssets).set({
        isActive: false,
        updatedAt: new Date(),
      }).where(eq(householdAssets.id, assetId));

      await logAudit(req, { action: "REMOVE_ASSET", module: "households", entityId: assetId, entityName: "Majetok deaktivovaný" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri odstraňovaní majetku" });
    }
  });

  // --- PRIVACY BLOCKS ---
  // Get privacy blocks for a subject
  app.get("/api/privacy-blocks/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const blocks = await db.select().from(privacyBlocks).where(eq(privacyBlocks.subjectId, subjectId));
      res.json(blocks);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  // Toggle privacy on a dynamic block
  app.post("/api/privacy-blocks", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).appUser;
      const { subjectId, blockType, blockKey, collectionIndex, isPrivate, reason } = req.body;
      if (!subjectId || !blockType || !blockKey) return res.status(400).json({ message: "Chýbajú povinné parametre" });
      if (!await checkKlientiSubjectAccess(user, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const existing = await db.select().from(privacyBlocks).where(and(
        eq(privacyBlocks.subjectId, subjectId),
        eq(privacyBlocks.blockType, blockType),
        eq(privacyBlocks.blockKey, blockKey),
        collectionIndex != null ? eq(privacyBlocks.collectionIndex, collectionIndex) : sql`${privacyBlocks.collectionIndex} IS NULL`
      ));

      let result;
      if (existing.length > 0) {
        [result] = await db.update(privacyBlocks).set({
          isPrivate: isPrivate !== false,
          reason: reason || null,
          setByUserId: user?.id,
          setByName: user?.username,
          updatedAt: new Date(),
        }).where(eq(privacyBlocks.id, existing[0].id)).returning();
      } else {
        [result] = await db.insert(privacyBlocks).values({
          subjectId,
          blockType,
          blockKey,
          collectionIndex: collectionIndex || null,
          isPrivate: isPrivate !== false,
          reason: reason || null,
          setByUserId: user?.id,
          setByName: user?.username,
        }).returning();
      }

      await logAudit(req, {
        action: isPrivate !== false ? "SET_PRIVATE" : "SET_PUBLIC",
        module: "privacy",
        entityId: subjectId,
        entityName: `Blok ${blockType}/${blockKey} nastavený ako ${isPrivate !== false ? "súkromný" : "verejný"}`,
        newData: { blockType, blockKey, collectionIndex, isPrivate }
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri nastavení súkromia" });
    }
  });

  // --- ACCESS CONSENT (18+ Privacy Trigger & general consent) ---
  // Get consent status between two subjects
  app.get("/api/access-consent/:grantorId/:granteeId", isAuthenticated, async (req, res) => {
    try {
      const grantorId = parseInt(req.params.grantorId);
      const granteeId = parseInt(req.params.granteeId);

      const consents = await db.select().from(accessConsentLog).where(and(
        eq(accessConsentLog.grantorSubjectId, grantorId),
        eq(accessConsentLog.granteeSubjectId, granteeId),
        eq(accessConsentLog.isActive, true)
      ));

      res.json(consents);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  // Get all consent logs for a subject
  app.get("/api/access-consent/subject/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const consents = await db.select().from(accessConsentLog).where(or(
        eq(accessConsentLog.grantorSubjectId, subjectId),
        eq(accessConsentLog.granteeSubjectId, subjectId)
      )).orderBy(sql`${accessConsentLog.createdAt} DESC`).limit(100);

      const subjectIds = new Set<number>();
      consents.forEach(c => { subjectIds.add(c.grantorSubjectId); subjectIds.add(c.granteeSubjectId); });
      const subjectsMap = new Map<number, any>();
      if (subjectIds.size > 0) {
        const subs = await db.select({ id: subjects.id, firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName }).from(subjects).where(sql`${subjects.id} IN (${sql.join([...subjectIds].map(id => sql`${id}`), sql`, `)})`);
        subs.forEach(s => subjectsMap.set(s.id, s));
      }

      const enriched = consents.map(c => ({
        ...c,
        grantorName: (() => { const s = subjectsMap.get(c.grantorSubjectId); return s ? (s.companyName || `${s.firstName || ""} ${s.lastName || ""}`.trim()) : "—"; })(),
        granteeName: (() => { const s = subjectsMap.get(c.granteeSubjectId); return s ? (s.companyName || `${s.firstName || ""} ${s.lastName || ""}`.trim()) : "—"; })(),
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní súhlasov" });
    }
  });

  // Grant/revoke access consent (for 18+ privacy trigger and manual consent)
  app.post("/api/access-consent", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).appUser;
      const { grantorSubjectId, granteeSubjectId, consentType, action, scope, reason, legalBasis, relationId } = req.body;
      if (!grantorSubjectId || !granteeSubjectId || !consentType || !action) return res.status(400).json({ message: "Chýbajú povinné parametre" });
      if (!await checkKlientiSubjectAccess(user, grantorSubjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      if (action === "grant") {
        const [consent] = await db.insert(accessConsentLog).values({
          grantorSubjectId,
          granteeSubjectId,
          consentType,
          action: "grant",
          scope: scope || "full",
          reason: reason || null,
          legalBasis: legalBasis || null,
          relationId: relationId || null,
          grantedByUserId: user?.id,
          grantedByName: user?.username,
        }).returning();

        await logAudit(req, { action: "GRANT_ACCESS", module: "privacy", entityId: grantorSubjectId, entityName: `Súhlas udelený subjektu ${granteeSubjectId}`, newData: { consentType, scope, reason } });
        res.json(consent);
      } else if (action === "revoke") {
        const revoked = await db.update(accessConsentLog).set({
          isActive: false,
          revokedAt: new Date(),
          revokedByUserId: user?.id,
          revokedByName: user?.username,
          revokedReason: reason || null,
        }).where(and(
          eq(accessConsentLog.grantorSubjectId, grantorSubjectId),
          eq(accessConsentLog.granteeSubjectId, granteeSubjectId),
          eq(accessConsentLog.consentType, consentType),
          eq(accessConsentLog.isActive, true)
        )).returning();

        await db.insert(accessConsentLog).values({
          grantorSubjectId,
          granteeSubjectId,
          consentType,
          action: "revoke",
          scope: scope || "full",
          reason: reason || null,
          isActive: false,
          revokedAt: new Date(),
          revokedByUserId: user?.id,
          revokedByName: user?.username,
          revokedReason: reason || null,
          grantedByUserId: user?.id,
          grantedByName: user?.username,
        });

        await logAudit(req, { action: "REVOKE_ACCESS", module: "privacy", entityId: grantorSubjectId, entityName: `Súhlas odobraný subjektu ${granteeSubjectId}`, oldData: { consentType }, newData: { reason } });
        res.json({ success: true, revokedCount: revoked.length });
      } else {
        return res.status(400).json({ message: "Neplatná akcia. Použite 'grant' alebo 'revoke'" });
      }
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri správe súhlasu" });
    }
  });

  // Check if subject has reached 18 and needs privacy restriction
  app.get("/api/privacy-trigger/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });

      const [subject] = await db.select().from(subjects).where(eq(subjects.id, subjectId));
      if (!subject) return res.status(404).json({ message: "Subjekt nenájdený" });

      const details = (subject.details as any) || {};
      const dyn = details.dynamicFields || details;
      const dob = dyn.datum_narodenia || dyn.p_datum_nar;

      if (!dob) return res.json({ isAdult: false, needsConsentReview: false, hasActiveConsent: false });

      const dobDate = new Date(dob);
      const now = new Date();
      let age = now.getFullYear() - dobDate.getFullYear();
      if (now.getMonth() < dobDate.getMonth() || (now.getMonth() === dobDate.getMonth() && now.getDate() < dobDate.getDate())) age--;

      const isAdult = age >= 18;

      const guardianRelations = await db.select({ id: subjectRelations.id, sourceId: subjectRelations.sourceSubjectId })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .where(and(
          eq(subjectRelations.targetSubjectId, subjectId),
          eq(subjectRelations.isActive, true),
          eq(relationRoleTypes.category, "rodina"),
          sql`${relationRoleTypes.code} IN ('rodic_zakonny_zastupca', 'stary_rodic')`
        ));

      const activeConsents = await db.select().from(accessConsentLog).where(and(
        eq(accessConsentLog.grantorSubjectId, subjectId),
        eq(accessConsentLog.consentType, "post_maturity_sharing"),
        eq(accessConsentLog.isActive, true)
      ));

      const needsConsentReview = isAdult && guardianRelations.length > 0 && activeConsents.length === 0;

      res.json({
        isAdult,
        age,
        needsConsentReview,
        hasActiveConsent: activeConsents.length > 0,
        guardianCount: guardianRelations.length,
        guardianIds: guardianRelations.map(g => g.sourceId),
        consentDetails: activeConsents,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri kontrole privacy triggeru" });
    }
  });

  // === ADDRESS GROUPS (Adresná skupina - Objekt XY) ===
  app.post("/api/address-groups", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).appUser;
      const { name, groupType, address, description, contractId, memberSubjectIds } = req.body;
      if (!name) return res.status(400).json({ message: "Názov skupiny je povinný" });

      const [counter] = await db.select().from(globalCounters).where(eq(globalCounters.counterName, "subject"));
      const nextVal = (counter?.currentValue || 0) + 1;
      await db.update(globalCounters).set({ currentValue: nextVal }).where(eq(globalCounters.counterName, "subject"));
      const uid = `AGR-${String(nextVal).padStart(6, '0')}`;

      const [group] = await db.insert(addressGroups).values({
        uid, name, groupType: groupType || "address", address: address || null,
        description: description || null, contractId: contractId || null,
        createdByUserId: user?.id, createdByName: user?.username,
      }).returning();

      if (memberSubjectIds && Array.isArray(memberSubjectIds)) {
        for (const sid of memberSubjectIds) {
          await db.insert(addressGroupMembers).values({
            groupId: group.id, subjectId: sid,
            addedByUserId: user?.id, addedByName: user?.username,
          });
        }
      }

      await logAudit(req, { action: "CREATE", module: "address_groups", entityId: group.id, entityName: `Adresná skupina: ${name}`, newData: { uid, name, groupType, memberCount: memberSubjectIds?.length || 0 } });
      res.json(group);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri vytváraní skupiny" });
    }
  });

  app.get("/api/address-groups/subject/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const memberships = await db.select({ membership: addressGroupMembers, group: addressGroups })
        .from(addressGroupMembers)
        .innerJoin(addressGroups, eq(addressGroupMembers.groupId, addressGroups.id))
        .where(and(eq(addressGroupMembers.subjectId, subjectId), eq(addressGroupMembers.isActive, true), eq(addressGroups.isActive, true)));

      const result = [];
      for (const m of memberships) {
        const members = await db.select({
          member: addressGroupMembers,
          subject: { id: subjects.id, uid: subjects.uid, firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type },
        }).from(addressGroupMembers)
          .innerJoin(subjects, eq(addressGroupMembers.subjectId, subjects.id))
          .where(and(eq(addressGroupMembers.groupId, m.group.id), eq(addressGroupMembers.isActive, true)));

        result.push({
          ...m.group,
          myRole: m.membership.role,
          members: members.map(mb => ({
            memberId: mb.member.id, subjectId: mb.subject.id, uid: mb.subject.uid,
            name: mb.subject.companyName || `${mb.subject.firstName || ""} ${mb.subject.lastName || ""}`.trim(),
            type: mb.subject.type, role: mb.member.role, note: mb.member.note,
          })),
        });
      }
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní skupín" });
    }
  });

  app.post("/api/address-groups/:groupId/members", isAuthenticated, async (req, res) => {
    try {
      const groupId = parseInt(req.params.groupId);
      const { subjectId, role, note } = req.body;
      const user = (req as any).appUser;
      if (isNaN(groupId) || !subjectId) return res.status(400).json({ message: "Neplatné parametre" });

      const existing = await db.select().from(addressGroupMembers).where(and(
        eq(addressGroupMembers.groupId, groupId), eq(addressGroupMembers.subjectId, subjectId), eq(addressGroupMembers.isActive, true)
      ));
      if (existing.length > 0) return res.status(409).json({ message: "Subjekt je už členom skupiny" });

      const [member] = await db.insert(addressGroupMembers).values({
        groupId, subjectId, role: role || "clen", note: note || null,
        addedByUserId: user?.id, addedByName: user?.username,
      }).returning();

      await logAudit(req, { action: "ADD_MEMBER", module: "address_groups", entityId: groupId, entityName: `Člen pridaný do adresnej skupiny`, newData: { subjectId, role } });
      res.json(member);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri pridávaní člena" });
    }
  });

  app.post("/api/address-groups/:groupId/members/:memberId/remove", isAuthenticated, async (req, res) => {
    try {
      const memberId = parseInt(req.params.memberId);
      await db.update(addressGroupMembers).set({ isActive: false, leftAt: new Date() }).where(eq(addressGroupMembers.id, memberId));
      await logAudit(req, { action: "REMOVE_MEMBER", module: "address_groups", entityId: memberId, entityName: "Člen odstránený z adresnej skupiny" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/address-groups", isAuthenticated, async (req, res) => {
    try {
      const search = (req.query.search as string || "").toLowerCase();
      let groups = await db.select().from(addressGroups).where(eq(addressGroups.isActive, true));
      if (search) {
        groups = groups.filter(g => g.name.toLowerCase().includes(search) || (g.address || "").toLowerCase().includes(search) || g.uid.toLowerCase().includes(search));
      }
      res.json(groups);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  // === COMPANY SUBJECT ROLES (PO Štruktúra) ===
  app.get("/api/company-roles/:companySubjectId", isAuthenticated, async (req, res) => {
    try {
      const companySubjectId = parseInt(req.params.companySubjectId);
      if (isNaN(companySubjectId)) return res.status(400).json({ message: "Neplatné ID" });

      const roles = await db.select({
        role: companySubjectRoles,
        person: { id: subjects.id, uid: subjects.uid, firstName: subjects.firstName, lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type, email: subjects.email, phone: subjects.phone },
      }).from(companySubjectRoles)
        .innerJoin(subjects, eq(companySubjectRoles.personSubjectId, subjects.id))
        .where(and(eq(companySubjectRoles.companySubjectId, companySubjectId), eq(companySubjectRoles.isActive, true)));

      const enriched = roles.map(r => ({
        ...r.role,
        personName: r.person.companyName || `${r.person.firstName || ""} ${r.person.lastName || ""}`.trim(),
        personUid: r.person.uid, personType: r.person.type,
        personEmail: r.person.email, personPhone: r.person.phone,
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/company-roles/person/:personSubjectId", isAuthenticated, async (req, res) => {
    try {
      const personSubjectId = parseInt(req.params.personSubjectId);
      if (isNaN(personSubjectId)) return res.status(400).json({ message: "Neplatné ID" });

      const roles = await db.select({
        role: companySubjectRoles,
        company: { id: subjects.id, uid: subjects.uid, companyName: subjects.companyName, type: subjects.type },
      }).from(companySubjectRoles)
        .innerJoin(subjects, eq(companySubjectRoles.companySubjectId, subjects.id))
        .where(and(eq(companySubjectRoles.personSubjectId, personSubjectId), eq(companySubjectRoles.isActive, true)));

      const enriched = roles.map(r => ({
        ...r.role,
        companyName: r.company.companyName || `Firma ${r.company.id}`,
        companyUid: r.company.uid,
      }));
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.post("/api/company-roles", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).appUser;
      const { companySubjectId, personSubjectId, roleType, allowedSections, description, validFrom, validTo } = req.body;
      if (!companySubjectId || !personSubjectId || !roleType) return res.status(400).json({ message: "Chýbajú povinné parametre" });
      if (!["statutar", "ubo", "zamestnanec", "operator"].includes(roleType)) return res.status(400).json({ message: "Neplatný typ roly" });

      const existing = await db.select().from(companySubjectRoles).where(and(
        eq(companySubjectRoles.companySubjectId, companySubjectId),
        eq(companySubjectRoles.personSubjectId, personSubjectId),
        eq(companySubjectRoles.roleType, roleType),
        eq(companySubjectRoles.isActive, true)
      ));
      if (existing.length > 0) return res.status(409).json({ message: "Táto rola už existuje" });

      const [role] = await db.insert(companySubjectRoles).values({
        companySubjectId, personSubjectId, roleType,
        allowedSections: allowedSections || [],
        description: description || null,
        validFrom: validFrom ? new Date(validFrom) : new Date(),
        validTo: validTo ? new Date(validTo) : null,
        assignedByUserId: user?.id, assignedByName: user?.username,
      }).returning();

      const roleLabels: Record<string, string> = { statutar: "Štatutár", ubo: "UBO", zamestnanec: "Zamestnanec", operator: "Operátor" };
      await logAudit(req, { action: "ASSIGN_ROLE", module: "company_roles", entityId: companySubjectId, entityName: `Rola ${roleLabels[roleType]} priradená subjektu ${personSubjectId}`, newData: { roleType, allowedSections } });
      res.json(role);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri priraďovaní roly" });
    }
  });

  app.patch("/api/company-roles/:roleId", isAuthenticated, async (req, res) => {
    try {
      const roleId = parseInt(req.params.roleId);
      const { allowedSections, description, validTo, isActive } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (allowedSections !== undefined) updates.allowedSections = allowedSections;
      if (description !== undefined) updates.description = description;
      if (validTo !== undefined) updates.validTo = validTo ? new Date(validTo) : null;
      if (isActive !== undefined) updates.isActive = isActive;

      const [updated] = await db.update(companySubjectRoles).set(updates).where(eq(companySubjectRoles.id, roleId)).returning();
      await logAudit(req, { action: "UPDATE_ROLE", module: "company_roles", entityId: roleId, entityName: "Aktualizácia firemnej roly", newData: updates });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.delete("/api/company-roles/:roleId", isAuthenticated, async (req, res) => {
    try {
      const roleId = parseInt(req.params.roleId);
      await db.update(companySubjectRoles).set({ isActive: false, updatedAt: new Date() }).where(eq(companySubjectRoles.id, roleId));
      await logAudit(req, { action: "REMOVE_ROLE", module: "company_roles", entityId: roleId, entityName: "Firemná rola deaktivovaná" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  // === NOTIFICATION QUEUE & BULK JOBS ===
  app.get("/api/notifications/my", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).appUser;
      const notifs = await db.select().from(notificationQueue)
        .where(and(eq(notificationQueue.recipientUserId, user?.id), eq(notificationQueue.status, "sent")))
        .orderBy(sql`${notificationQueue.createdAt} DESC`).limit(50);
      res.json(notifs);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.post("/api/notifications/:notifId/read", isAuthenticated, async (req, res) => {
    try {
      const notifId = parseInt(req.params.notifId);
      await db.update(notificationQueue).set({ readAt: new Date(), status: "read" }).where(eq(notificationQueue.id, notifId));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/notifications/unread-count", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).appUser;
      const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(notificationQueue)
        .where(and(eq(notificationQueue.recipientUserId, user?.id), eq(notificationQueue.status, "sent")));
      res.json({ count: result?.count || 0 });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.post("/api/batch-notifications", isAuthenticated, async (req, res) => {
    try {
      const user = (req as any).appUser;
      const { notificationType, title, message, recipientSubjectIds, priority, sendToAll } = req.body;

      let finalRecipientIds: number[] = recipientSubjectIds || [];
      if (sendToAll) {
        const conditions: any[] = [eq(subjects.isActive, true)];
        if (user?.activeCompanyId) conditions.push(eq(subjects.myCompanyId, user.activeCompanyId));
        const allSubjects = await db.select({ id: subjects.id }).from(subjects).where(and(...conditions));
        finalRecipientIds = allSubjects.map(s => s.id);
      }

      if (!notificationType || !title || !message || !finalRecipientIds.length) return res.status(400).json({ message: "Chýbajú povinné parametre" });

      const batchId = `BATCH-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const [job] = await db.insert(batchJobs).values({
        batchId, jobType: "bulk_notification", status: "processing",
        totalItems: finalRecipientIds.length, processedItems: 0, failedItems: 0, progress: 0,
        metadata: { notificationType, title },
        createdByUserId: user?.id, createdByName: user?.username, startedAt: new Date(),
      }).returning();

      const recipientsCopy = [...finalRecipientIds];
      (async () => {
        let processed = 0, failed = 0;
        const BATCH_SIZE = 100;
        for (let i = 0; i < recipientsCopy.length; i += BATCH_SIZE) {
          const batch = recipientsCopy.slice(i, i + BATCH_SIZE);
          const values = batch.map((sid: number) => ({
            batchId, recipientSubjectId: sid, notificationType,
            title, message, priority: priority || "normal", status: "sent" as const,
          }));
          try {
            await db.insert(notificationQueue).values(values);
            processed += batch.length;
          } catch (e: any) {
            failed += batch.length;
          }
          const progress = Math.round(((processed + failed) / recipientsCopy.length) * 100);
          await db.update(batchJobs).set({ processedItems: processed, failedItems: failed, progress, updatedAt: new Date() }).where(eq(batchJobs.id, job.id));
        }
        await db.update(batchJobs).set({
          status: failed > 0 ? "completed_with_errors" : "completed",
          processedItems: processed, failedItems: failed, progress: 100,
          completedAt: new Date(), updatedAt: new Date(),
          result: { totalSent: processed, totalFailed: failed },
        }).where(eq(batchJobs.id, job.id));
        console.log(`[BATCH NOTIFICATION] ${batchId}: ${processed} sent, ${failed} failed`);
      })();

      await logAudit(req, { action: "BULK_NOTIFY", module: "notifications", entityId: job.id, entityName: `Hromadná notifikácia: ${title}`, newData: { batchId, recipientCount: finalRecipientIds.length } });
      res.json({ batchId, jobId: job.id, totalItems: finalRecipientIds.length, status: "processing" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri hromadnom odoslaní" });
    }
  });

  app.get("/api/batch-jobs/:batchId", isAuthenticated, async (req, res) => {
    try {
      const batchId = req.params.batchId;
      const [job] = await db.select().from(batchJobs).where(eq(batchJobs.batchId, batchId));
      if (!job) return res.status(404).json({ message: "Batch job nenájdený" });
      res.json(job);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/batch-jobs", isAuthenticated, async (req, res) => {
    try {
      const jobs = await db.select().from(batchJobs).orderBy(sql`${batchJobs.createdAt} DESC`).limit(50);
      res.json(jobs);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  // === MATURITY EVENTS (Auto-transition log) ===
  app.get("/api/maturity-events", isAuthenticated, async (req, res) => {
    try {
      const events = await db.select().from(maturityEvents).orderBy(sql`${maturityEvents.createdAt} DESC`).limit(50);
      const enriched = [];
      for (const e of events) {
        const [subj] = await db.select({ id: subjects.id, uid: subjects.uid, firstName: subjects.firstName, lastName: subjects.lastName }).from(subjects).where(eq(subjects.id, e.subjectId));
        enriched.push({ ...e, subjectName: subj ? `${subj.firstName || ""} ${subj.lastName || ""}`.trim() : `${e.subjectId}`, subjectUid: subj?.uid });
      }
      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  // === FAMILY RELATIONS: PARAMETER INHERITANCE ===
  app.post("/api/family/check-inheritance", isAuthenticated, async (req, res) => {
    try {
      const { sourceSubjectId, changedFields } = req.body;
      if (!sourceSubjectId || !changedFields) return res.status(400).json({ message: "Chýbajú povinné parametre" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, sourceSubjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const addressChanged = Object.keys(changedFields).filter(k => INHERITABLE_ADDRESS_FIELDS.includes(k));
      if (addressChanged.length === 0) return res.json({ hasInheritableChanges: false, children: [] });

      const childRelations = await db.select({
        relation: subjectRelations,
        roleType: relationRoleTypes,
        childSubject: {
          id: subjects.id,
          uid: subjects.uid,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          details: subjects.details,
        },
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .innerJoin(subjects, eq(subjectRelations.targetSubjectId, subjects.id))
        .where(and(
          eq(subjectRelations.sourceSubjectId, sourceSubjectId),
          eq(subjectRelations.isActive, true),
          eq(relationRoleTypes.category, "rodina"),
          sql`${relationRoleTypes.code} IN ('dieta_opravnena_osoba', 'vnuk_vnucka')`,
          eq(subjects.isActive, true)
        ));

      if (childRelations.length === 0) return res.json({ hasInheritableChanges: false, children: [] });

      const children = childRelations.map(cr => {
        const childDetails = (cr.childSubject.details as any) || {};
        const childDyn = childDetails.dynamicFields || childDetails;
        const currentValues: Record<string, any> = {};
        for (const fk of addressChanged) {
          currentValues[fk] = childDyn[fk] || null;
        }
        return {
          subjectId: cr.childSubject.id,
          uid: cr.childSubject.uid,
          name: `${cr.childSubject.firstName || ""} ${cr.childSubject.lastName || ""}`.trim(),
          relationId: cr.relation.id,
          roleLabel: cr.roleType.label,
          currentValues,
        };
      });

      res.json({
        hasInheritableChanges: true,
        changedFields: addressChanged,
        newValues: Object.fromEntries(addressChanged.map(k => [k, changedFields[k]])),
        children,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri kontrole dedičnosti" });
    }
  });

  app.post("/api/family/apply-inheritance", isAuthenticated, async (req, res) => {
    try {
      const { sourceSubjectId, targetSubjectIds, fieldKeys, newValues } = req.body;
      if (!sourceSubjectId || !targetSubjectIds?.length || !fieldKeys?.length || !newValues) {
        return res.status(400).json({ message: "Chýbajú povinné parametre" });
      }
      if (!await checkKlientiSubjectAccess((req as any).appUser, sourceSubjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const user = (req as any).appUser;
      const results = [];

      for (const targetId of targetSubjectIds) {
        const [target] = await db.select().from(subjects).where(eq(subjects.id, targetId));
        if (!target) continue;

        const targetDetails = (target.details as any) || {};
        const targetDyn = targetDetails.dynamicFields || targetDetails;
        const oldValues: Record<string, any> = {};

        for (const fk of fieldKeys) {
          oldValues[fk] = targetDyn[fk] || null;
          targetDyn[fk] = newValues[fk];
        }

        if (targetDetails.dynamicFields) {
          targetDetails.dynamicFields = targetDyn;
        }

        await db.update(subjects).set({
          details: targetDetails.dynamicFields ? targetDetails : targetDyn,
        }).where(eq(subjects.id, targetId));

        for (const fk of fieldKeys) {
          const oldStr = oldValues[fk] != null ? String(oldValues[fk]) : '';
          const newStr = newValues[fk] != null ? String(newValues[fk]) : '';
          if (oldStr !== newStr) {
            await db.insert(subjectFieldHistory).values({
              subjectId: targetId,
              fieldKey: fk,
              fieldSource: "inheritance",
              oldValue: oldValues[fk] != null ? String(oldValues[fk]) : null,
              newValue: newValues[fk] != null ? String(newValues[fk]) : null,
              changedByUserId: user?.id,
              changedByName: user?.username || "system",
              changeReason: `Zdedené od rodiča (subjekt ${sourceSubjectId})`,
            });
          }
        }

        results.push({ subjectId: targetId, updated: true, fieldsUpdated: fieldKeys.length });
      }

      res.json({ success: true, results });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri aplikovaní dedičnosti" });
    }
  });

  app.get("/api/inheritance-prompts/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const prompts = await db.select().from(inheritancePrompts).where(
        and(
          or(eq(inheritancePrompts.sourceSubjectId, subjectId), eq(inheritancePrompts.targetSubjectId, subjectId)),
          eq(inheritancePrompts.status, "pending")
        )
      );
      res.json(prompts);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní promptov dedičnosti" });
    }
  });

  // === FAMILY RELATIONS: AI EXTRACTION HINTS FOR CHILDREN'S INSURANCE ===
  app.get("/api/family/extraction-rules", isAuthenticated, async (_req, res) => {
    res.json({
      contractTypes: [
        {
          pattern: "Detské poistenie|Detské životné|Detské sporenie|Sporenie pre deti|Junior sporenie|Detský investičný",
          roles: {
            poistnik: { familyRole: "rodic_zakonny_zastupca", direction: "parent_is_poistnik" },
            poisteny: { familyRole: "dieta_opravnena_osoba", direction: "child_is_poisteny" },
          },
          autoCreateRelation: true,
          description: "Detské poistenie - rodič je poistník, dieťa je poistený",
        },
        {
          pattern: "Sporenie|III\\. pilier|Doplnkové dôchodkové|DDS",
          roles: {
            poistnik: { familyRole: "stary_rodic", direction: "grandparent_may_be_poistnik" },
            poisteny: { familyRole: "vnuk_vnucka", direction: "grandchild_is_beneficiary" },
          },
          autoCreateRelation: true,
          description: "Sporenie - starý rodič môže byť poistník, vnuk/vnučka je oprávnená osoba",
        },
        {
          pattern: "Životné poistenie|Kapitálové životné|Investičné životné|IŽP|KŽP",
          roles: {
            poistnik: { familyRole: "manzel_manzelka", direction: "spouse_may_be_beneficiary" },
            opravnena_osoba: { familyRole: "dieta_opravnena_osoba", direction: "child_as_beneficiary" },
          },
          autoCreateRelation: true,
          description: "Životné poistenie - manžel/ka ako oprávnená osoba, deti ako beneficienti",
        },
      ],
      fieldMappings: {
        poistnik_meno: ["meno poistníka", "poistník meno", "policyholder name", "zákonný zástupca"],
        poistnik_rod_cislo: ["rodné číslo poistníka", "RČ poistníka"],
        poisteny_meno: ["meno poisteného", "poistený meno", "insured name", "meno dieťaťa"],
        poisteny_rod_cislo: ["rodné číslo poisteného", "RČ poisteného", "RČ dieťaťa"],
        opravnena_osoba_meno: ["oprávnená osoba", "beneficient", "beneficiary"],
      },
    });
  });

  app.post("/api/family/auto-link-from-contract", isAuthenticated, async (req, res) => {
    try {
      const { contractType, poistnikSubjectId, poistenySubjectId, sectorCode } = req.body;
      if (!poistnikSubjectId || !poistenySubjectId) {
        return res.status(400).json({ message: "Poistník aj poistený subjekt sú povinné" });
      }

      const rules = [
        { pattern: /Detské poistenie|Detské životné|Detské sporenie|Sporenie pre deti|Junior/i, parentRole: "rodic_zakonny_zastupca", childRole: "dieta_opravnena_osoba" },
        { pattern: /Sporenie|III\. pilier|Doplnkové dôchodkové|DDS/i, parentRole: "stary_rodic", childRole: "vnuk_vnucka" },
        { pattern: /Životné poistenie|Kapitálové životné|IŽP|KŽP/i, parentRole: "rodic_zakonny_zastupca", childRole: "dieta_opravnena_osoba" },
      ];

      let parentRoleCode = "rodic_zakonny_zastupca";
      let childRoleCode = "dieta_opravnena_osoba";
      for (const rule of rules) {
        if (rule.pattern.test(contractType || "")) {
          parentRoleCode = rule.parentRole;
          childRoleCode = rule.childRole;
          break;
        }
      }

      const existingRelation = await db.select().from(subjectRelations).where(
        and(
          eq(subjectRelations.sourceSubjectId, poistnikSubjectId),
          eq(subjectRelations.targetSubjectId, poistenySubjectId),
          eq(subjectRelations.isActive, true),
          eq(subjectRelations.category, "rodina")
        )
      );

      if (existingRelation.length > 0) {
        return res.json({ alreadyLinked: true, relation: existingRelation[0], message: "Rodinná väzba už existuje" });
      }

      const [parentRoleType] = await db.select().from(relationRoleTypes).where(eq(relationRoleTypes.code, parentRoleCode));
      if (!parentRoleType) return res.status(400).json({ message: "Rola nenájdená" });

      const user = (req as any).appUser;
      const [relation] = await db.insert(subjectRelations).values({
        sourceSubjectId: poistnikSubjectId,
        targetSubjectId: poistenySubjectId,
        roleTypeId: parentRoleType.id,
        category: "rodina",
        contextSector: sectorCode || "Poistenie",
        relationMeta: { autoCreated: true, contractType, aiExtracted: true },
        createdByUserId: user?.id,
        createdByName: user?.username || "ai_extraction",
      }).returning();

      res.json({ created: true, relation, message: "Rodinná väzba automaticky vytvorená z kontraktu" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri automatickom prepojení" });
    }
  });

  // === FAMILY SPIDER: Get family tree for a subject ===
  app.get("/api/family/tree/:subjectId", isAuthenticated, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      if (isNaN(subjectId)) return res.status(400).json({ message: "Neplatné ID" });
      if (!await checkKlientiSubjectAccess((req as any).appUser, subjectId)) return res.status(403).json({ message: "Prístup zamietnutý" });

      const outgoing = await db.select({
        relation: subjectRelations,
        roleType: relationRoleTypes,
        linkedSubject: {
          id: subjects.id,
          uid: subjects.uid,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          type: subjects.type,
          details: subjects.details,
        },
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .innerJoin(subjects, eq(subjectRelations.targetSubjectId, subjects.id))
        .where(and(
          eq(subjectRelations.sourceSubjectId, subjectId),
          eq(subjectRelations.isActive, true),
          eq(relationRoleTypes.category, "rodina")
        ));

      const incoming = await db.select({
        relation: subjectRelations,
        roleType: relationRoleTypes,
        linkedSubject: {
          id: subjects.id,
          uid: subjects.uid,
          firstName: subjects.firstName,
          lastName: subjects.lastName,
          type: subjects.type,
          details: subjects.details,
        },
      })
        .from(subjectRelations)
        .innerJoin(relationRoleTypes, eq(subjectRelations.roleTypeId, relationRoleTypes.id))
        .innerJoin(subjects, eq(subjectRelations.sourceSubjectId, subjects.id))
        .where(and(
          eq(subjectRelations.targetSubjectId, subjectId),
          eq(subjectRelations.isActive, true),
          eq(relationRoleTypes.category, "rodina")
        ));

      const computeAge = (details: any) => {
        const dyn = details?.dynamicFields || details || {};
        const dob = dyn.datum_narodenia || dyn.p_datum_nar;
        if (!dob) return null;
        const d = new Date(dob);
        if (isNaN(d.getTime())) return null;
        const now = new Date();
        let age = now.getFullYear() - d.getFullYear();
        if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
        return age;
      };

      const mapRelation = (r: any, direction: string) => {
        const age = computeAge(r.linkedSubject.details);
        return {
          relationId: r.relation.id,
          subjectId: r.linkedSubject.id,
          uid: r.linkedSubject.uid,
          name: `${r.linkedSubject.firstName || ""} ${r.linkedSubject.lastName || ""}`.trim(),
          type: r.linkedSubject.type,
          roleCode: r.roleType.code,
          roleLabel: r.roleType.label,
          direction,
          age,
          isMinor: age !== null && age < 18,
          contextSector: r.relation.contextSector,
          meta: r.relation.relationMeta,
        };
      };

      const familyMembers = [
        ...outgoing.map(r => mapRelation(r, "outgoing")),
        ...incoming.map(r => mapRelation(r, "incoming")),
      ];

      const parents = familyMembers.filter(m => ['rodic_zakonny_zastupca', 'stary_rodic'].includes(m.roleCode) && m.direction === "incoming");
      const children = familyMembers.filter(m => ['dieta_opravnena_osoba', 'vnuk_vnucka'].includes(m.roleCode) && m.direction === "outgoing");
      const spouses = familyMembers.filter(m => ['manzel_manzelka', 'partner_druh'].includes(m.roleCode));
      const siblings = familyMembers.filter(m => m.roleCode === 'surodenc');
      const others = familyMembers.filter(m => m.roleCode === 'iny_pribuzny');

      res.json({
        subjectId,
        totalFamilyMembers: familyMembers.length,
        parents,
        children,
        spouses,
        siblings,
        others,
        allMembers: familyMembers,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní rodinného stromu" });
    }
  });

  // === NETWORK (Financie > Sieť - ATK) ===

  app.get("/api/network/tree", isAuthenticated, async (req: any, res) => {
    try {
      const rootId = req.query.rootId ? parseInt(req.query.rootId as string) : null;
      const SK_ROOT_UID = "421 000 000 000 000";

      let rootSubject: any = null;
      if (rootId) {
        [rootSubject] = await db.select().from(subjects).where(and(eq(subjects.id, rootId), isNull(subjects.deletedAt))).limit(1);
      } else {
        [rootSubject] = await db.select().from(subjects).where(and(eq(subjects.uid, SK_ROOT_UID), isNull(subjects.deletedAt))).limit(1);
      }

      if (!rootSubject) {
        const [firstSubject] = await db.select().from(subjects).where(
          and(isNull(subjects.deletedAt), eq(subjects.isActive, true))
        ).orderBy(subjects.id).limit(1);
        rootSubject = firstSubject || null;
      }
      if (!rootSubject) {
        return res.json({ root: null, links: [], subjects: [] });
      }

      const allLinks = await db.select().from(networkLinks).where(eq(networkLinks.isActive, true));

      const subjectIds = new Set<number>();
      subjectIds.add(rootSubject.id);
      allLinks.forEach(l => {
        subjectIds.add(l.subjectId);
        subjectIds.add(l.guarantorSubjectId);
      });

      const allSubjects = subjectIds.size > 0
        ? await db.select({
            id: subjects.id,
            uid: subjects.uid,
            firstName: subjects.firstName,
            lastName: subjects.lastName,
            companyName: subjects.companyName,
            type: subjects.type,
            registrationStatus: subjects.registrationStatus,
            lifecycleStatus: subjects.lifecycleStatus,
            isActive: subjects.isActive,
          }).from(subjects).where(
            and(
              inArray(subjects.id, Array.from(subjectIds)),
              isNull(subjects.deletedAt)
            )
          )
        : [];

      res.json({
        root: rootSubject,
        links: allLinks,
        subjects: allSubjects,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri načítaní siete" });
    }
  });

  app.get("/api/network/links/:subjectId", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);
      const links = await db.select().from(networkLinks).where(
        or(
          eq(networkLinks.subjectId, subjectId),
          eq(networkLinks.guarantorSubjectId, subjectId)
        )
      );
      res.json(links);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.post("/api/network/links", isAuthenticated, async (req: any, res) => {
    try {
      const { subjectId, guarantorSubjectId, linkType, phase, sourceContractId, roleOnContract } = req.body;
      if (!subjectId || !guarantorSubjectId) {
        return res.status(400).json({ message: "subjectId a guarantorSubjectId sú povinné" });
      }

      const existing = await db.select().from(networkLinks).where(
        and(
          eq(networkLinks.subjectId, subjectId),
          eq(networkLinks.guarantorSubjectId, guarantorSubjectId),
          eq(networkLinks.isActive, true),
          eq(networkLinks.linkType, linkType || "active")
        )
      ).limit(1);

      if (existing.length > 0) {
        return res.json(existing[0]);
      }

      const appUser = req.appUser;
      const [link] = await db.insert(networkLinks).values({
        subjectId,
        guarantorSubjectId,
        linkType: linkType || "active",
        phase: phase || "klient",
        sourceContractId: sourceContractId || null,
        roleOnContract: roleOnContract || null,
        confirmedByUserId: appUser?.id,
        confirmedByName: appUser?.fullName || appUser?.username,
      }).returning();

      await db.insert(auditLogs).values({
        userId: appUser?.id || 0,
        action: "network_link_created",
        entityType: "network_link",
        entityId: String(link.id),
        details: { subjectId, guarantorSubjectId, linkType: linkType || "active", phase: phase || "klient" },
      });

      res.json(link);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri vytváraní prepojenia" });
    }
  });

  app.post("/api/network/confirm-guarantor", isAuthenticated, async (req: any, res) => {
    try {
      const { subjectId, chosenGuarantorId } = req.body;
      if (!subjectId || !chosenGuarantorId) {
        return res.status(400).json({ message: "subjectId a chosenGuarantorId sú povinné" });
      }

      const appUser = req.appUser;
      const now = new Date();

      const activeLinks = await db.select().from(networkLinks).where(
        and(
          eq(networkLinks.subjectId, subjectId),
          eq(networkLinks.isActive, true)
        )
      );

      for (const link of activeLinks) {
        if (link.guarantorSubjectId === chosenGuarantorId) {
          await db.update(networkLinks).set({
            linkType: "active",
            phase: "specialist",
            confirmedAt: now,
            confirmedByUserId: appUser?.id,
            confirmedByName: appUser?.fullName || appUser?.username,
            updatedAt: now,
          }).where(eq(networkLinks.id, link.id));
        } else {
          await db.update(networkLinks).set({
            linkType: "frozen",
            isFrozenAt: now,
            frozenReason: "Kariérna konverzia — subjekt si zvolil iného garanta",
            updatedAt: now,
          }).where(eq(networkLinks.id, link.id));
        }
      }

      await db.insert(auditLogs).values({
        userId: appUser?.id || 0,
        action: "guarantor_confirmed",
        entityType: "network_link",
        entityId: String(subjectId),
        details: { subjectId, chosenGuarantorId, frozenCount: activeLinks.filter(l => l.guarantorSubjectId !== chosenGuarantorId).length },
      });

      res.json({ message: "Garant potvrdený, ostatné prepojenia zamrznuté" });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri potvrdení garanta" });
    }
  });

  fs.mkdirSync(path.join(UPLOADS_DIR, "transfer-protocols"), { recursive: true });

  function getTransferApprovalStep(request: any): { step: number; stepName: string; waitingFor: string } {
    if (!request.requesterApprovedAt) return { step: 1, stepName: "Žiadateľ", waitingFor: "requester" };
    if (!request.receivingGuarantorApprovedAt) return { step: 2, stepName: "Prijímajúci garant", waitingFor: "receiving" };
    if (!request.leavingGuarantorApprovedAt) return { step: 3, stepName: "Odchádzajúci garant", waitingFor: "leaving" };
    if (!request.adminApprovedAt) return { step: 4, stepName: "Administrátor", waitingFor: "admin" };
    return { step: 5, stepName: "Dokončené", waitingFor: "none" };
  }

  async function generateTransferProtocolPDF(request: any, appUser: any): Promise<{ pdfPath: string; auditCode: string }> {
    const PDFDocument = (await import("pdfkit")).default;
    const QRCode = await import("qrcode");
    const now = new Date();
    const formattedDate = formatDateTimeSK(now);
    const auditCode = `TPR-${Date.now()}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const fileTs = formatTimestampForFile(now);
    const filename = `prestupovy_protokol_${request.id}_${fileTs}.pdf`;
    const filePath = path.join(UPLOADS_DIR, "transfer-protocols", filename);

    const subjectIds = [request.subjectId, request.currentGuarantorId, request.requestedGuarantorId];
    const relSubs = await db.select({
      id: subjects.id, firstName: subjects.firstName, lastName: subjects.lastName,
      companyName: subjects.companyName, type: subjects.type, uid: subjects.uid,
    }).from(subjects).where(inArray(subjects.id, subjectIds));
    const subMap = new Map(relSubs.map(s => [s.id, s]));
    const getName = (id: number) => {
      const s = subMap.get(id);
      if (!s) return `ID: ${id}`;
      return s.type === "company" ? (s.companyName || "—") : `${s.firstName || ""} ${s.lastName || ""}`.trim() || "—";
    };

    const verifyUrl = `https://secure-agent-hub.replit.app/prestup?audit=${auditCode}&ts=${fileTs}`;
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 80, margin: 1, color: { dark: "#000000", light: "#ffffff" } });
    const qrBuffer = Buffer.from(qrDataUrl.replace(/^data:image\/png;base64,/, ""), "base64");

    const doc = new PDFDocument({ size: "A4", margin: 50, info: { Title: "Prestupový protokol", Author: "ArutsoK" } });
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.save();
    doc.fontSize(60).font("Helvetica-Bold").opacity(0.04).rotate(-45, { origin: [300, 420] })
      .text("ArutsoK HOLDING", 80, 350);
    doc.restore();

    doc.image(qrBuffer, 465, 10, { width: 80 });
    doc.fontSize(7).font("Helvetica").text(formattedDate, 455, 93, { width: 90, align: "center" });

    doc.fontSize(18).font("Helvetica-Bold").text("Prestupový protokol", 50, 50);
    doc.moveTo(50, 75).lineTo(445, 75).stroke("#333333");
    doc.fontSize(10).font("Helvetica").text(`Číslo žiadosti: ${request.id}`, 50, 85);
    doc.text(`Audit kód: ${auditCode}`, 50, 100);
    doc.moveDown(1.5);

    const drawRow = (label: string, value: string) => {
      const y = doc.y;
      doc.fontSize(9).font("Helvetica-Bold").text(label, 50, y, { width: 200 });
      doc.fontSize(9).font("Helvetica").text(value || "—", 260, y, { width: 280 });
      doc.y = y + 20;
    };

    doc.fontSize(12).font("Helvetica-Bold").text("Údaje o prestupe", 50);
    doc.moveDown(0.5);
    drawRow("Subjekt:", getName(request.subjectId));
    drawRow("Pôvodný garant:", getName(request.currentGuarantorId));
    drawRow("Nový garant:", getName(request.requestedGuarantorId));
    drawRow("Dôvod:", request.reason);
    doc.moveDown(1);

    doc.fontSize(12).font("Helvetica-Bold").text("Schvaľovací reťazec", 50);
    doc.moveDown(0.5);
    const steps = [
      { label: "1. Žiadateľ", name: request.requestedByName, time: request.requesterApprovedAt },
      { label: "2. Prijímajúci garant", name: request.receivingGuarantorName, time: request.receivingGuarantorApprovedAt },
      { label: "3. Odchádzajúci garant", name: request.leavingGuarantorName, time: request.leavingGuarantorApprovedAt },
      { label: "4. Administrátor", name: request.reviewedByName, time: request.adminApprovedAt },
    ];
    for (const step of steps) {
      drawRow(`${step.label}:`, `${step.name || "—"} — ${step.time ? formatDateTimeSK(new Date(step.time)) : "—"}`);
    }

    const pageH = doc.page.height;
    doc.moveTo(50, pageH - 80).lineTo(545, pageH - 80).stroke("#cccccc");
    doc.fontSize(8).font("Helvetica")
      .text(`Audit kód: ${auditCode}`, 50, pageH - 70)
      .text(`Vygenerované: ${formattedDate}`, 50, pageH - 58)
      .text(`Systém: ArutsoK — Dôverný materiál`, 50, pageH - 46);

    doc.end();
    await new Promise<void>((resolve, reject) => { writeStream.on("finish", resolve); writeStream.on("error", reject); });
    return { pdfPath: filePath, auditCode };
  }

  app.get("/api/network/transfer-requests", isAuthenticated, async (req: any, res) => {
    try {
      const statusFilter = req.query.status as string | undefined;
      let query;
      if (statusFilter && statusFilter !== "all") {
        query = db.select().from(guarantorTransferRequests).where(
          eq(guarantorTransferRequests.status, statusFilter)
        ).orderBy(desc(guarantorTransferRequests.createdAt));
      } else {
        query = db.select().from(guarantorTransferRequests).orderBy(desc(guarantorTransferRequests.createdAt));
      }
      const requests = await query;

      const subjectIds = new Set<number>();
      requests.forEach(r => {
        subjectIds.add(r.subjectId);
        subjectIds.add(r.currentGuarantorId);
        subjectIds.add(r.requestedGuarantorId);
      });

      const relatedSubjects = subjectIds.size > 0
        ? await db.select({
            id: subjects.id, uid: subjects.uid, firstName: subjects.firstName,
            lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type,
          }).from(subjects).where(inArray(subjects.id, Array.from(subjectIds)))
        : [];

      const enriched = requests.map(r => ({
        ...r,
        currentStep: getTransferApprovalStep(r),
      }));

      res.json({ requests: enriched, subjects: relatedSubjects });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.post("/api/network/transfer-requests", isAuthenticated, async (req: any, res) => {
    try {
      const { subjectId, currentGuarantorId, requestedGuarantorId, reason } = req.body;
      if (!subjectId || !currentGuarantorId || !requestedGuarantorId || !reason) {
        return res.status(400).json({ message: "Všetky polia sú povinné" });
      }

      const appUser = req.appUser;
      const now = new Date();
      const [request] = await db.insert(guarantorTransferRequests).values({
        subjectId,
        currentGuarantorId,
        requestedGuarantorId,
        reason,
        status: "pending_all_approvals",
        requestedByUserId: appUser?.id,
        requestedByName: appUser?.fullName || appUser?.username,
        requesterApprovedAt: now,
      }).returning();

      await db.insert(auditLogs).values({
        userId: appUser?.id || 0,
        username: appUser?.fullName || appUser?.username || "",
        action: "transfer_request_created",
        module: "Network",
        entityId: request.id,
        entityName: `Transfer ${request.id}`,
        newData: { subjectId, currentGuarantorId, requestedGuarantorId, reason },
      });

      res.json({ ...request, currentStep: getTransferApprovalStep(request) });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri vytváraní žiadosti" });
    }
  });

  app.patch("/api/network/transfer-requests/:id/approve", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reviewNote } = req.body;
      const appUser = req.appUser;

      const [existing] = await db.select().from(guarantorTransferRequests).where(eq(guarantorTransferRequests.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Žiadosť nenájdená" });
      if (existing.status !== "pending_all_approvals") return res.status(400).json({ message: "Žiadosť už bola vybavená" });

      const step = getTransferApprovalStep(existing);
      const now = new Date();
      const userName = appUser.fullName || appUser.username;
      let updateData: any = { updatedAt: now };

      if (step.waitingFor === "receiving") {
        const isLinkedToReceiving = appUser.linkedSubjectId === existing.requestedGuarantorId;
        if (!isLinkedToReceiving && !isAdmin(appUser)) {
          return res.status(403).json({ message: "Nemáte oprávnenie schváliť tento krok. Len prijímajúci garant alebo admin môže schváliť." });
        }
        updateData.receivingGuarantorUserId = appUser.id;
        updateData.receivingGuarantorName = userName;
        updateData.receivingGuarantorApprovedAt = now;
      } else if (step.waitingFor === "leaving") {
        const isLinkedToLeaving = appUser.linkedSubjectId === existing.currentGuarantorId;
        if (!isLinkedToLeaving && !isAdmin(appUser)) {
          return res.status(403).json({ message: "Nemáte oprávnenie schváliť tento krok. Len odchádzajúci garant alebo admin môže schváliť." });
        }
        updateData.leavingGuarantorUserId = appUser.id;
        updateData.leavingGuarantorName = userName;
        updateData.leavingGuarantorApprovedAt = now;
      } else if (step.waitingFor === "admin") {
        if (!isAdmin(appUser)) {
          return res.status(403).json({ message: "Len administrátor môže vykonať finálne schválenie" });
        }
        updateData.reviewedByUserId = appUser.id;
        updateData.reviewedByName = userName;
        updateData.reviewedAt = now;
        updateData.adminApprovedAt = now;
        updateData.reviewNote = reviewNote || null;
        updateData.status = "approved";
      } else {
        return res.status(400).json({ message: "Žiadosť je už plne schválená" });
      }

      const [updated] = await db.update(guarantorTransferRequests).set(updateData)
        .where(eq(guarantorTransferRequests.id, id)).returning();

      if (updated.status === "approved") {
        await db.update(networkLinks).set({
          linkType: "frozen", isFrozenAt: now,
          frozenReason: "Prestupový protokol schválený", updatedAt: now,
        }).where(
          and(
            eq(networkLinks.subjectId, existing.subjectId),
            eq(networkLinks.guarantorSubjectId, existing.currentGuarantorId),
            eq(networkLinks.linkType, "active")
          )
        );

        const existingNewLink = await db.select().from(networkLinks).where(
          and(
            eq(networkLinks.subjectId, existing.subjectId),
            eq(networkLinks.guarantorSubjectId, existing.requestedGuarantorId),
          )
        ).limit(1);

        if (existingNewLink.length > 0) {
          await db.update(networkLinks).set({
            linkType: "active", isFrozenAt: null, frozenReason: null,
            confirmedAt: now, confirmedByUserId: appUser.id,
            confirmedByName: userName, updatedAt: now,
          }).where(eq(networkLinks.id, existingNewLink[0].id));
        } else {
          await db.insert(networkLinks).values({
            subjectId: existing.subjectId,
            guarantorSubjectId: existing.requestedGuarantorId,
            linkType: "active", phase: "specialist",
            confirmedAt: now, confirmedByUserId: appUser.id,
            confirmedByName: userName,
          });
        }

        try {
          const [freshRequest] = await db.select().from(guarantorTransferRequests).where(eq(guarantorTransferRequests.id, id)).limit(1);
          const { pdfPath, auditCode } = await generateTransferProtocolPDF(freshRequest || updated, appUser);
          await db.update(guarantorTransferRequests).set({
            pdfPath: pdfPath, pdfAuditCode: auditCode,
          }).where(eq(guarantorTransferRequests.id, id));
          (updated as any).pdfPath = pdfPath;
          (updated as any).pdfAuditCode = auditCode;
        } catch (pdfErr: any) {
          console.error("PDF generation error:", pdfErr);
        }
      }

      await db.insert(auditLogs).values({
        userId: appUser.id,
        username: appUser.fullName || appUser.username || "",
        action: `transfer_step_${step.waitingFor}_approved`,
        module: "Network",
        entityId: id,
        entityName: `Transfer ${id}`,
        newData: { step: step.step, stepName: step.stepName, reviewNote },
      });

      res.json({ ...updated, currentStep: getTransferApprovalStep(updated) });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri spracovaní žiadosti" });
    }
  });

  app.patch("/api/network/transfer-requests/:id/reject", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { reviewNote } = req.body;
      const appUser = req.appUser;

      const [existing] = await db.select().from(guarantorTransferRequests).where(eq(guarantorTransferRequests.id, id)).limit(1);
      if (!existing) return res.status(404).json({ message: "Žiadosť nenájdená" });
      if (existing.status !== "pending_all_approvals") return res.status(400).json({ message: "Žiadosť už bola vybavená" });

      const step = getTransferApprovalStep(existing);
      const isLinkedToReceiving = appUser.linkedSubjectId === existing.requestedGuarantorId;
      const isLinkedToLeaving = appUser.linkedSubjectId === existing.currentGuarantorId;
      const isRequester = appUser.id === existing.requestedByUserId;
      const canReject = isAdmin(appUser) || isLinkedToReceiving || isLinkedToLeaving || isRequester ||
        (step.waitingFor === "receiving" && isLinkedToReceiving) ||
        (step.waitingFor === "leaving" && isLinkedToLeaving);
      if (!canReject) {
        return res.status(403).json({ message: "Nemáte oprávnenie zamietnuť túto žiadosť" });
      }

      const now = new Date();
      const [updated] = await db.update(guarantorTransferRequests).set({
        status: "rejected",
        reviewedByUserId: appUser.id,
        reviewedByName: appUser.fullName || appUser.username,
        reviewedAt: now,
        reviewNote: reviewNote || null,
        updatedAt: now,
      }).where(eq(guarantorTransferRequests.id, id)).returning();

      await db.insert(auditLogs).values({
        userId: appUser.id,
        username: appUser.fullName || appUser.username || "",
        action: "transfer_request_rejected",
        module: "Network",
        entityId: id,
        entityName: `Transfer ${id}`,
        newData: { reviewNote },
      });

      res.json({ ...updated, currentStep: getTransferApprovalStep(updated) });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba pri zamietnutí žiadosti" });
    }
  });

  app.get("/api/network/transfer-requests/:id/pdf", isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const [request] = await db.select().from(guarantorTransferRequests).where(eq(guarantorTransferRequests.id, id)).limit(1);
      if (!request) return res.status(404).json({ message: "Žiadosť nenájdená" });
      if (!request.pdfPath) return res.status(404).json({ message: "PDF ešte nebolo vygenerované" });
      if (!fs.existsSync(request.pdfPath)) return res.status(404).json({ message: "Súbor PDF nenájdený" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `inline; filename="prestupovy_protokol_${id}.pdf"`);
      fs.createReadStream(request.pdfPath).pipe(res);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/my-tasks", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser) {
        return res.status(401).json({ message: "Nie je prihlásený používateľ" });
      }
      const pendingRequests = await db.select().from(guarantorTransferRequests)
        .where(eq(guarantorTransferRequests.status, "pending_all_approvals"))
        .orderBy(desc(guarantorTransferRequests.createdAt));

      const tasks: any[] = [];
      for (const r of pendingRequests) {
        const step = getTransferApprovalStep(r);
        let isMyTask = false;
        let taskRole = "";

        if (isAdmin(appUser)) {
          isMyTask = true;
          if (step.waitingFor === "receiving") taskRole = "Administrátor — čaká: Prijímajúci garant";
          else if (step.waitingFor === "leaving") taskRole = "Administrátor — čaká: Odchádzajúci garant";
          else if (step.waitingFor === "admin") taskRole = "Administrátor — finálne schválenie";
          else taskRole = "Administrátor";
        } else if (step.waitingFor === "receiving" && appUser.linkedSubjectId === r.requestedGuarantorId) {
          isMyTask = true;
          taskRole = "Prijímajúci garant";
        } else if (step.waitingFor === "leaving" && appUser.linkedSubjectId === r.currentGuarantorId) {
          isMyTask = true;
          taskRole = "Odchádzajúci garant";
        }

        if (isMyTask) {
          tasks.push({ ...r, currentStep: step, taskRole });
        }
      }

      const subjectIds = new Set<number>();
      tasks.forEach(t => {
        subjectIds.add(t.subjectId);
        subjectIds.add(t.currentGuarantorId);
        subjectIds.add(t.requestedGuarantorId);
      });

      const relatedSubjects = subjectIds.size > 0
        ? await db.select({
            id: subjects.id, uid: subjects.uid, firstName: subjects.firstName,
            lastName: subjects.lastName, companyName: subjects.companyName, type: subjects.type,
          }).from(subjects).where(inArray(subjects.id, Array.from(subjectIds)))
        : [];

      const interventionStatusIds = (await db.select({ id: contractStatuses.id })
        .from(contractStatuses)
        .where(eq(contractStatuses.isIntervention, true))
      ).map(s => s.id);

      let interventionContracts: any[] = [];
      if (interventionStatusIds.length > 0) {
        const allIntervention = await db.select({
          id: contracts.id,
          uid: contracts.uid,
          contractNumber: contracts.contractNumber,
          statusId: contracts.statusId,
          klientUid: contracts.klientUid,
          specialistaUid: contracts.specialistaUid,
          partnerId: contracts.partnerId,
          productId: contracts.productId,
          incompleteData: contracts.incompleteData,
          incompleteDataReason: contracts.incompleteDataReason,
          lastStatusUpdate: contracts.lastStatusUpdate,
          createdAt: contracts.createdAt,
        }).from(contracts).where(
          and(
            inArray(contracts.statusId, interventionStatusIds),
            eq(contracts.isDeleted, false)
          )
        ).orderBy(desc(contracts.lastStatusUpdate));

        if (isAdmin(appUser)) {
          interventionContracts = allIntervention;
        } else if (appUser.linkedSubjectId) {
          const linkedSubject = await db.select({ uid: subjects.uid }).from(subjects).where(eq(subjects.id, appUser.linkedSubjectId)).limit(1);
          const userSubjectUid = linkedSubject[0]?.uid || null;
          const userIdStr = String(appUser.linkedSubjectId);
          interventionContracts = allIntervention.filter(c =>
            c.specialistaUid === userIdStr || c.klientUid === userIdStr ||
            (userSubjectUid && (c.specialistaUid === userSubjectUid || c.klientUid === userSubjectUid))
          );
        }
      }

      const statusList = interventionStatusIds.length > 0
        ? await db.select({ id: contractStatuses.id, name: contractStatuses.name })
            .from(contractStatuses)
            .where(inArray(contractStatuses.id, interventionStatusIds))
        : [];

      const allPhase7 = await db.select({
        id: contracts.id,
        uid: contracts.uid,
        contractNumber: contracts.contractNumber,
        statusId: contracts.statusId,
        lifecyclePhase: contracts.lifecyclePhase,
        klientUid: contracts.klientUid,
        specialistaUid: contracts.specialistaUid,
        subjectId: contracts.subjectId,
        partnerId: contracts.partnerId,
        incompleteData: contracts.incompleteData,
        incompleteDataReason: contracts.incompleteDataReason,
        lastStatusUpdate: contracts.lastStatusUpdate,
        updatedAt: contracts.updatedAt,
        createdAt: contracts.createdAt,
      }).from(contracts).where(
        and(eq(contracts.lifecyclePhase, 7), eq(contracts.isDeleted, false))
      ).orderBy(desc(contracts.lastStatusUpdate));

      let internalInterventions: any[];
      if (isAdmin(appUser)) {
        internalInterventions = allPhase7;
      } else if (appUser.linkedSubjectId) {
        const lnkSub = await db.select({ uid: subjects.uid }).from(subjects).where(eq(subjects.id, appUser.linkedSubjectId)).limit(1);
        const uUid = lnkSub[0]?.uid || null;
        const uIdStr = String(appUser.linkedSubjectId);
        internalInterventions = allPhase7.filter(c =>
          c.specialistaUid === uIdStr || c.klientUid === uIdStr ||
          (uUid && (c.specialistaUid === uUid || c.klientUid === uUid)) ||
          c.subjectId === appUser.linkedSubjectId
        );
      } else {
        internalInterventions = [];
      }

      const companyId = appUser?.activeCompanyId || undefined;
      const stateId = appUser?.activeStateId || undefined;
      const allRejected = await storage.getRejectedContracts(companyId, stateId);
      const allArchived = await storage.getArchivedContracts(companyId, stateId);

      let rejectedContracts: any[];
      let archivedContracts: any[];
      if (isAdmin(appUser)) {
        rejectedContracts = allRejected;
        archivedContracts = allArchived;
      } else if (appUser.linkedSubjectId) {
        const lnkSub2 = await db.select({ uid: subjects.uid }).from(subjects).where(eq(subjects.id, appUser.linkedSubjectId)).limit(1);
        const uUid2 = lnkSub2[0]?.uid || null;
        const uIdStr2 = String(appUser.linkedSubjectId);
        const filterFn = (c: any) =>
          c.specialistaUid === uIdStr2 || c.klientUid === uIdStr2 ||
          (uUid2 && (c.specialistaUid === uUid2 || c.klientUid === uUid2)) ||
          c.subjectId === appUser.linkedSubjectId;
        rejectedContracts = allRejected.filter(filterFn);
        archivedContracts = allArchived.filter(filterFn);
      } else {
        rejectedContracts = [];
        archivedContracts = [];
      }

      const excludeIds = new Set([
        ...rejectedContracts.map((c: any) => c.id),
        ...archivedContracts.map((c: any) => c.id),
      ]);
      const dedupedInterventions = interventionContracts.filter((c: any) => !excludeIds.has(c.id));

      const upcomingEvents = await storage.getUpcomingEvents(5);

      let nbsReportTasks: any[] = [];
      if (appUser.role === 'admin' || appUser.role === 'superadmin') {
        const now = new Date();
        const cy = now.getFullYear();
        function getNbsDeadlineTask(period: string, year: number): Date {
          switch (period) {
            case "1q": return new Date(year, 4, 31);
            case "2q": return new Date(year, 7, 31);
            case "3q": return new Date(year, 10, 30);
            case "4q": return new Date(year + 1, 1, 28);
            case "annual": return new Date(year + 1, 2, 31);
            default: return new Date(year, 11, 31);
          }
        }
        const periodLabels: Record<string, string> = { "1q": "1Q", "2q": "2Q", "3q": "3Q", "4q": "4Q", "annual": "Ročný report" };
        const yearsCheck = [cy, cy - 1];
        const allNbs = await db.select().from(nbsReportStatuses)
          .where(inArray(nbsReportStatuses.year, yearsCheck));
        const periods = ["1q", "2q", "3q", "4q", "annual"];
        for (const year of yearsCheck) {
          for (const period of periods) {
            const deadline = getNbsDeadlineTask(period, year);
            const diffMs = deadline.getTime() - now.getTime();
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (daysLeft > 25) continue;
            const report = allNbs.find(r => r.year === year && r.period === period);
            if (!report || report.status !== "sent") {
              nbsReportTasks.push({
                period,
                periodLabel: periodLabels[period] || period.toUpperCase(),
                year,
                status: report?.status || "not_sent",
                deadline: deadline.toISOString(),
                daysLeft,
              });
            }
          }
        }
        nbsReportTasks.sort((a, b) => a.period.localeCompare(b.period));
      }

      res.json({
        tasks, subjects: relatedSubjects,
        interventions: dedupedInterventions, interventionStatuses: statusList,
        internalInterventions, rejectedContracts, archivedContracts,
        upcomingEvents, nbsReportTasks,
      });
    } catch (err: any) {
      console.error("[MY-TASKS ERROR]", err);
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/my-tasks/count", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const pendingRequests = await db.select().from(guarantorTransferRequests)
        .where(eq(guarantorTransferRequests.status, "pending_all_approvals"));

      let transferCount = 0;
      for (const r of pendingRequests) {
        const step = getTransferApprovalStep(r);
        if (isAdmin(appUser)) {
          transferCount++;
        } else if (step.waitingFor === "receiving" && appUser.linkedSubjectId === r.requestedGuarantorId) {
          transferCount++;
        } else if (step.waitingFor === "leaving" && appUser.linkedSubjectId === r.currentGuarantorId) {
          transferCount++;
        }
      }

      const interventionStatusIds = (await db.select({ id: contractStatuses.id })
        .from(contractStatuses)
        .where(eq(contractStatuses.isIntervention, true))
      ).map(s => s.id);

      let interventionCount = 0;
      if (interventionStatusIds.length > 0) {
        const allIntervention = await db.select({ id: contracts.id, specialistaUid: contracts.specialistaUid, klientUid: contracts.klientUid })
          .from(contracts)
          .where(and(inArray(contracts.statusId, interventionStatusIds), eq(contracts.isDeleted, false)));

        if (isAdmin(appUser)) {
          interventionCount = allIntervention.length;
        } else if (appUser.linkedSubjectId) {
          const linkedSubject = await db.select({ uid: subjects.uid }).from(subjects).where(eq(subjects.id, appUser.linkedSubjectId)).limit(1);
          const userSubjectUid = linkedSubject[0]?.uid || null;
          const userIdStr = String(appUser.linkedSubjectId);
          interventionCount = allIntervention.filter(c =>
            c.specialistaUid === userIdStr || c.klientUid === userIdStr ||
            (userSubjectUid && (c.specialistaUid === userSubjectUid || c.klientUid === userSubjectUid))
          ).length;
        }
      }

      const allPhase7Count = await db.select({ id: contracts.id, specialistaUid: contracts.specialistaUid, klientUid: contracts.klientUid, subjectId: contracts.subjectId })
        .from(contracts)
        .where(and(eq(contracts.lifecyclePhase, 7), eq(contracts.isDeleted, false)));

      let internalInterventionCount = 0;
      if (isAdmin(appUser)) {
        internalInterventionCount = allPhase7Count.length;
      } else if (appUser.linkedSubjectId) {
        const lnkSub = await db.select({ uid: subjects.uid }).from(subjects).where(eq(subjects.id, appUser.linkedSubjectId)).limit(1);
        const uUid = lnkSub[0]?.uid || null;
        const uIdStr = String(appUser.linkedSubjectId);
        internalInterventionCount = allPhase7Count.filter(c =>
          c.specialistaUid === uIdStr || c.klientUid === uIdStr ||
          (uUid && (c.specialistaUid === uUid || c.klientUid === uUid)) ||
          c.subjectId === appUser.linkedSubjectId
        ).length;
      }

      const cmpId = appUser?.activeCompanyId || undefined;
      const stId = appUser?.activeStateId || undefined;
      const allRej = await storage.getRejectedContracts(cmpId, stId);
      const allArch = await storage.getArchivedContracts(cmpId, stId);

      let rejectedIds: Set<number>;
      let archivedIds: Set<number>;
      let rejectedCount = 0;
      let archivedCount = 0;
      if (isAdmin(appUser)) {
        rejectedIds = new Set(allRej.map((c: any) => c.id));
        archivedIds = new Set(allArch.map((c: any) => c.id));
        rejectedCount = allRej.length;
        archivedCount = allArch.length;
      } else if (appUser.linkedSubjectId) {
        const lnkSub2 = await db.select({ uid: subjects.uid }).from(subjects).where(eq(subjects.id, appUser.linkedSubjectId)).limit(1);
        const uUid2 = lnkSub2[0]?.uid || null;
        const uIdStr2 = String(appUser.linkedSubjectId);
        const filterFn = (c: any) =>
          c.specialistaUid === uIdStr2 || c.klientUid === uIdStr2 ||
          (uUid2 && (c.specialistaUid === uUid2 || c.klientUid === uUid2)) ||
          c.subjectId === appUser.linkedSubjectId;
        const filteredRej = allRej.filter(filterFn);
        const filteredArch = allArch.filter(filterFn);
        rejectedIds = new Set(filteredRej.map((c: any) => c.id));
        archivedIds = new Set(filteredArch.map((c: any) => c.id));
        rejectedCount = filteredRej.length;
        archivedCount = filteredArch.length;
      } else {
        rejectedIds = new Set();
        archivedIds = new Set();
      }

      const excludeFromInterventions = new Set([...rejectedIds, ...archivedIds]);
      if (excludeFromInterventions.size > 0 && interventionCount > 0) {
        if (interventionStatusIds.length > 0) {
          const allInt = await db.select({ id: contracts.id, specialistaUid: contracts.specialistaUid, klientUid: contracts.klientUid })
            .from(contracts)
            .where(and(inArray(contracts.statusId, interventionStatusIds), eq(contracts.isDeleted, false)));
          if (isAdmin(appUser)) {
            interventionCount = allInt.filter(c => !excludeFromInterventions.has(c.id)).length;
          } else if (appUser.linkedSubjectId) {
            const linkedSubject = await db.select({ uid: subjects.uid }).from(subjects).where(eq(subjects.id, appUser.linkedSubjectId)).limit(1);
            const userSubjectUid = linkedSubject[0]?.uid || null;
            const userIdStr = String(appUser.linkedSubjectId);
            interventionCount = allInt.filter(c =>
              !excludeFromInterventions.has(c.id) && (
                c.specialistaUid === userIdStr || c.klientUid === userIdStr ||
                (userSubjectUid && (c.specialistaUid === userSubjectUid || c.klientUid === userSubjectUid))
              )
            ).length;
          }
        }
      }

      const upcomingEvents = await storage.getUpcomingEvents(5);
      const upcomingEventsCount = upcomingEvents.length;
      const todayEventsCount = await storage.getTodayEventsCount();
      const nonCalendarCount = transferCount + interventionCount + internalInterventionCount + rejectedCount + archivedCount;

      let nbsAlert = { show: false, daysLeft: 0 };
      if (appUser.role === 'admin' || appUser.role === 'superadmin') {
        const now = new Date();
        const currentYear = now.getFullYear();

        function getNbsDeadline(period: string, year: number): Date {
          switch (period) {
            case "1q": return new Date(year, 4, 31);
            case "2q": return new Date(year, 7, 31);
            case "3q": return new Date(year, 10, 30);
            case "4q": return new Date(year + 1, 1, 28);
            case "annual": return new Date(year + 1, 2, 31);
            default: return new Date(year, 11, 31);
          }
        }

        const yearsToCheck = [currentYear, currentYear - 1];
        const allNbsReports = await db.select().from(nbsReportStatuses)
          .where(inArray(nbsReportStatuses.year, yearsToCheck));

        const periods = ["1q", "2q", "3q", "4q", "annual"];
        let closestDays = Infinity;

        for (const year of yearsToCheck) {
          for (const period of periods) {
            const deadline = getNbsDeadline(period, year);
            const diffMs = deadline.getTime() - now.getTime();
            const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            if (daysLeft > 25) continue;

            const report = allNbsReports.find(r => r.year === year && r.period === period);
            if (!report || report.status !== "sent") {
              if (daysLeft < closestDays) closestDays = daysLeft;
            }
          }
        }

        if (closestDays <= 25) {
          nbsAlert = { show: true, daysLeft: closestDays };
        }
      }

      res.json({
        count: nonCalendarCount > 0 ? nonCalendarCount : todayEventsCount,
        nonCalendarCount,
        upcomingEventsCount,
        todayEventsCount,
        nbsAlert,
      });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  app.get("/api/network/subject-acquirers/:subjectId", isAuthenticated, async (req: any, res) => {
    try {
      const subjectId = parseInt(req.params.subjectId);

      const subjectContracts = await db.select({
        id: contracts.id,
        contractNumber: contracts.contractNumber,
        specialistaUid: contracts.specialistaUid,
      }).from(contracts).where(
        and(
          eq(contracts.klientUid, String(subjectId)),
          eq(contracts.isDeleted, false)
        )
      );

      const acquirerUids = new Set<string>();
      subjectContracts.forEach(c => {
        if (c.specialistaUid) acquirerUids.add(c.specialistaUid);
      });

      const acquirers = acquirerUids.size > 0
        ? await db.select({
            id: subjects.id,
            uid: subjects.uid,
            firstName: subjects.firstName,
            lastName: subjects.lastName,
            companyName: subjects.companyName,
            type: subjects.type,
          }).from(subjects).where(
            and(
              inArray(subjects.uid, Array.from(acquirerUids)),
              isNull(subjects.deletedAt)
            )
          )
        : [];

      res.json({ subjectId, contracts: subjectContracts, acquirers });
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Chyba" });
    }
  });

  setInterval(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const expiredEvents = await db.execute(sql`
        SELECT s.id, s.details FROM subjects s 
        WHERE s.is_active = true AND s.deleted_at IS NULL 
        AND s.details IS NOT NULL
      `);
      let archiveCount = 0;
      for (const row of expiredEvents.rows) {
        const details = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
        if (!details) continue;
        const eventDateDo = details.event_datum_do;
        const eventStatus = details.event_status;
        if (eventDateDo && eventStatus && eventStatus !== "Archív" && eventStatus !== "Ukončené") {
          if (eventDateDo < today) {
            const updatedDetails = { ...details, event_status: "Archív" };
            await db.update(subjects).set({ details: updatedDetails }).where(eq(subjects.id, row.id as number));
            await db.insert(auditLogs).values({
              userId: 0,
              action: "event_auto_archive",
              entityType: "subject",
              entityId: String(row.id),
              details: { fieldKey: "event_status", oldValue: eventStatus, newValue: "Archív", reason: "Auto-archív: podujatie uplynulo", author: "ArutsoK" },
            });
            archiveCount++;
          }
        }
      }
      if (archiveCount > 0) console.log(`[CRON] Auto-archived ${archiveCount} expired events`);
    } catch (err) {
      console.error("[CRON] Event auto-archive error:", err);
    }
  }, 60 * 60 * 1000);

  // === CRON: Dynamic auto-archive (výhrady -> archív, per-product limit) ===
  setInterval(async () => {
    try {
      if (await isMigrationModeOn()) return;
      const objectionsInPhase3 = await db.select()
        .from(contracts)
        .where(and(
          eq(contracts.lifecyclePhase, 3),
          eq(contracts.isDeleted, false),
          sql`${contracts.objectionEnteredAt} IS NOT NULL`
        ));

      let archiveCount = 0;
      for (const contract of objectionsInPhase3) {
        const limits = await getProductDaysLimits(contract.sectorProductId);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - limits.objectionDays);

        if (new Date(contract.objectionEnteredAt!) < cutoffDate) {
          await db.update(contracts).set({
            lifecyclePhase: 4,
            updatedAt: new Date(),
          }).where(eq(contracts.id, contract.id));

          await db.insert(contractLifecycleHistory).values({
            contractId: contract.id,
            phase: 4,
            phaseName: LIFECYCLE_PHASES[4],
            changedByUserId: null,
            note: `Automatický presun do archívu po ${limits.objectionDays} dňoch výhrad`,
          });

          await db.insert(auditLogs).values({
            username: "ArutsoK System",
            action: "LIFECYCLE_AUTO_ARCHIVE",
            module: "zmluvy",
            entityId: contract.id,
            entityName: contract.contractNumber || contract.proposalNumber || `ID ${contract.id}`,
            oldData: { lifecyclePhase: 3 },
            newData: { lifecyclePhase: 4, objectionDaysLimit: limits.objectionDays },
          });

          archiveCount++;
        }
      }
      if (archiveCount > 0) console.log(`[CRON] Lifecycle auto-archive: ${archiveCount} contracts moved from phase 3 to phase 4 (dynamic limits)`);
    } catch (err) {
      console.error("[CRON] Lifecycle auto-archive error:", err);
    }
  }, 60 * 60 * 1000);

  // === CRON: Auto-archive phase 1 contracts after 30 days ===
  setInterval(async () => {
    try {
      if (await isMigrationModeOn()) return;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);

      const stalePhase1 = await db.select()
        .from(contracts)
        .where(and(
          eq(contracts.lifecyclePhase, 1),
          eq(contracts.isDeleted, false),
          sql`${contracts.createdAt} < ${cutoff}`
        ));

      let archiveCount = 0;
      for (const contract of stalePhase1) {
        await db.update(contracts).set({
          lifecyclePhase: 4,
          updatedAt: new Date(),
        }).where(eq(contracts.id, contract.id));

        await db.insert(contractLifecycleHistory).values({
          contractId: contract.id,
          phase: 4,
          phaseName: LIFECYCLE_PHASES[4] || "Archív zmlúv (s výhradami)",
          changedByUserId: null,
          note: `Automatický presun do archívu – zmluva bola vo fáze 1 (Nahratie) viac ako 30 dní bez odoslania`,
        });

        await db.insert(auditLogs).values({
          username: "ArutsoK System",
          action: "LIFECYCLE_PHASE1_AUTO_ARCHIVE",
          module: "zmluvy",
          entityId: contract.id,
          entityName: contract.contractNumber || contract.proposalNumber || `ID ${contract.id}`,
          oldData: { lifecyclePhase: 1 },
          newData: { lifecyclePhase: 4, reason: "30 dní vo fáze 1 bez odoslania" },
        });

        archiveCount++;
      }
      if (archiveCount > 0) console.log(`[CRON] Phase 1 auto-archive: ${archiveCount} contracts moved to phase 4 after 30 days`);
    } catch (err) {
      console.error("[CRON] Phase 1 auto-archive error:", err);
    }
  }, 60 * 60 * 1000);

  // === CRON: Supiska 24h countdown finalization ===
  setInterval(async () => {
    try {
      if (await isMigrationModeOn()) return;
      const odpocetSupisky = await db.select().from(supisky).where(
        and(
          eq((supisky as any).supiskaType, "processing"),
          eq(supisky.status, "Odpocet"),
        )
      );
      let finalizedCount = 0;
      const now = new Date();
      for (const sup of odpocetSupisky) {
        if (!sup.receivedByPartnerAt) continue;
        const elapsed = now.getTime() - new Date(sup.receivedByPartnerAt).getTime();
        if (elapsed >= 24 * 60 * 60 * 1000) {
          const count = await finalizeSupiskaReceive(sup.id);
          finalizedCount += count;
          console.log(`[CRON] Supiska ${sup.name} (id=${sup.id}) finalized after 24h countdown: ${count} contracts`);
        }
      }
      if (finalizedCount > 0) console.log(`[CRON] Supiska 24h countdown: finalized ${finalizedCount} contracts total`);
    } catch (err) {
      console.error("[CRON] Supiska 24h countdown error:", err);
    }
  }, 5 * 60 * 1000);

  // === CRON: Dynamic permanent delete + 24h pre-deletion notification ===
  setInterval(async () => {
    try {
      if (await isMigrationModeOn()) return;
      const archiveContracts = await db.select()
        .from(contracts)
        .where(and(
          eq(contracts.lifecyclePhase, 4),
          eq(contracts.isDeleted, false),
          sql`${contracts.objectionEnteredAt} IS NOT NULL`
        ));

      const contractsToNotify: { id: number; sectorProductId: number | null }[] = [];
      let deleteCount = 0;

      for (const contract of archiveContracts) {
        const limits = await getProductDaysLimits(contract.sectorProductId);
        const totalDays = limits.objectionDays + limits.archiveDays;
        const notifyDays = totalDays - 1;

        const deleteCutoff = new Date();
        deleteCutoff.setDate(deleteCutoff.getDate() - totalDays);

        const notifyCutoff = new Date();
        notifyCutoff.setDate(notifyCutoff.getDate() - notifyDays);

        const objDate = new Date(contract.objectionEnteredAt!);

        if (objDate < deleteCutoff) {
          await db.update(contracts).set({
            isDeleted: true,
            deletedAt: new Date(),
            deletedBy: "ArutsoK System",
            subjectId: null,
            importedRawData: null,
            notes: null,
            documents: [],
            checkedDocuments: [],
            dynamicPanelValues: {},
            updatedAt: new Date(),
          }).where(eq(contracts.id, contract.id));

          await db.insert(auditLogs).values({
            username: "ArutsoK System",
            action: "LIFECYCLE_ARCHIVE_CLEANUP",
            module: "zmluvy",
            entityId: contract.id,
            entityName: contract.contractNumber || contract.proposalNumber || `ID ${contract.id}`,
            oldData: { lifecyclePhase: 4, objectionEnteredAt: contract.objectionEnteredAt },
            newData: { isDeleted: true, dataCleared: true, reason: `Lehota ${totalDays} dní uplynula` },
          });

          deleteCount++;
        } else if (objDate < notifyCutoff && objDate >= deleteCutoff) {
          const alreadyNotified = await db.select({ id: systemNotifications.id })
            .from(systemNotifications)
            .where(and(
              eq(systemNotifications.relatedContractId, contract.id),
              eq(systemNotifications.notificationType, "pre_deletion_warning")
            ))
            .limit(1);

          if (alreadyNotified.length === 0) {
            contractsToNotify.push({ id: contract.id, sectorProductId: contract.sectorProductId });
          }
        }
      }

      if (contractsToNotify.length > 0) {
        notifyPreDeletion(contractsToNotify).catch(err =>
          console.error("[EMAIL] Pre-deletion notification error:", err)
        );
      }

      if (deleteCount > 0) console.log(`[CRON] Lifecycle archive cleanup: ${deleteCount} contracts soft-deleted + data cleared (dynamic limits)`);
    } catch (err) {
      console.error("[CRON] Lifecycle permanent delete error:", err);
    }
  }, 60 * 60 * 1000);

  // === API: System notifications (admin view) ===
  app.get("/api/system-notifications", isAuthenticated, async (req: any, res) => {
    try {
      const limit = Number(req.query.limit) || 50;
      const notifications = await db.select()
        .from(systemNotifications)
        .orderBy(desc(systemNotifications.createdAt))
        .limit(limit);
      res.json(notifications);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Error" });
    }
  });

  app.get("/api/system-notifications/stats", isAuthenticated, async (req: any, res) => {
    try {
      const stats = await db.select({
        status: systemNotifications.status,
        count: sql<number>`COUNT(*)::int`,
      })
        .from(systemNotifications)
        .groupBy(systemNotifications.status);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ message: err?.message || "Error" });
    }
  });

  // === CRON: Lifecycle eject→stop auto-transition (daily) ===
  setInterval(async () => {
    try {
      if (await isMigrationModeOn()) return;
      const expiredProducts = await storage.getEjectExpiredProducts();
      for (const product of expiredProducts) {
        await storage.updateSectorProductLifecycleStatus(product.id, "stop", null, product.statusEndDate);
        await db.insert(auditLogs).values({
          username: "ArutsoK System",
          action: "LIFECYCLE_AUTO_STOP",
          module: "SektoroveProdukty",
          entityId: product.id,
          entityName: product.name,
          oldData: { lifecycleStatus: "eject" },
          newData: { lifecycleStatus: "stop", reason: "Automatický prechod: dátum ukončenia prekročený" },
        });
      }
      const expiredPartners = await storage.getEjectExpiredPartners();
      for (const partner of expiredPartners) {
        await storage.updatePartnerLifecycleStatus(partner.id, "stop", null, partner.statusEndDate);
        const affectedProducts = await storage.bulkUpdateProductsLifecycleByPartner(partner.id, "stop");
        await db.insert(auditLogs).values({
          username: "ArutsoK System",
          action: "LIFECYCLE_AUTO_STOP",
          module: "partneri",
          entityId: partner.id,
          entityName: partner.name,
          oldData: { lifecycleStatus: "eject" },
          newData: { lifecycleStatus: "stop", reason: "Automatický prechod: dátum ukončenia prekročený" },
        });
        for (const product of affectedProducts) {
          await db.insert(auditLogs).values({
            username: "ArutsoK System",
            action: "LIFECYCLE_AUTO_STOP",
            module: "SektoroveProdukty",
            entityId: product.id,
            entityName: product.name,
            oldData: { lifecycleStatus: "inherited" },
            newData: { lifecycleStatus: "stop", reason: `Dedičnosť z partnera ${partner.name}` },
          });
        }
      }
      if (expiredProducts.length > 0 || expiredPartners.length > 0) {
        console.log(`[CRON] Lifecycle eject→stop: ${expiredProducts.length} products, ${expiredPartners.length} partners auto-stopped`);
      }
    } catch (err) {
      console.error("[CRON] Lifecycle eject→stop error:", err);
    }
  }, 24 * 60 * 60 * 1000);

  app.post("/api/seed/test-contracts", isAuthenticated, async (req: any, res) => {
    if (req.user?.role !== 'admin' && req.user?.role !== 'superadmin') {
      return res.status(403).json({ message: "Prístup zamietnutý" });
    }
    try {
      const result = await seedTestContracts();
      res.json(result);
    } catch (err: any) {
      console.error("[SEED TEST CONTRACTS ERROR]", err);
      res.status(500).json({ message: err.message });
    }
  });

  if (process.env.NODE_ENV === 'development') {
    seedTestContracts().catch(err => console.error("[AUTO-SEED TEST CONTRACTS ERROR]", err));
  }

  // === DÁTOVÁ LINKA BACKGROUND WORKER ===
  let ocrWorkerRunning = false;
  let ocrWorkerShutdown = false;

  async function processNextOcrJob() {
    if (ocrWorkerShutdown || ocrWorkerRunning) return;
    ocrWorkerRunning = true;

    try {
      const [nextJob] = await db.select().from(ocrProcessingJobs)
        .where(eq(ocrProcessingJobs.status, "queued"))
        .orderBy(asc(ocrProcessingJobs.createdAt))
        .limit(1);

      if (!nextJob) {
        ocrWorkerRunning = false;
        return;
      }

      console.log(`[OCR WORKER] Spracúvam job ${nextJob.id}: ${nextJob.originalName}`);
      await db.update(ocrProcessingJobs).set({ status: "processing", startedAt: new Date() }).where(eq(ocrProcessingJobs.id, nextJob.id));

      try {
        const { analyzeDocument, isAzureConfigured } = await import("./services/azure-ocr");
        if (!isAzureConfigured()) {
          await db.update(ocrProcessingJobs).set({ status: "failed", error: "Azure nie je nakonfigurovaný", completedAt: new Date() }).where(eq(ocrProcessingJobs.id, nextJob.id));
          ocrWorkerRunning = false;
          return;
        }

        const ocrResult = await analyzeDocument(nextJob.filePath);

        if (ocrWorkerShutdown) {
          await db.update(ocrProcessingJobs).set({ status: "interrupted" }).where(eq(ocrProcessingJobs.id, nextJob.id));
          ocrWorkerRunning = false;
          return;
        }

        const allParams = await storage.getSubjectParameters();
        const allSynonyms = await storage.getAllParameterSynonyms();
        const synonymMap = new Map<number, string[]>();
        const synonymDetailMap = new Map<string, { id: number; status: string; confirmationCount: number }>();
        for (const syn of allSynonyms) {
          if (!synonymMap.has(syn.parameterId)) synonymMap.set(syn.parameterId, []);
          synonymMap.get(syn.parameterId)!.push(syn.synonym.toLowerCase());
          synonymDetailMap.set(`${syn.parameterId}:${syn.synonym.toLowerCase()}`, { id: syn.id, status: syn.status, confirmationCount: syn.confirmationCount });
        }

        const combinedText = ocrResult.text + "\n" + ocrResult.keyValuePairs.map(kv => `${kv.key}: ${kv.value}`).join("\n");
        const lines = combinedText.split(/\n/);
        const results: any[] = [];

        for (const param of allParams) {
          const searchTerms = [param.label.toLowerCase()];
          if (param.shortLabel) searchTerms.push(param.shortLabel.toLowerCase());
          const paramSynonyms = synonymMap.get(param.id) || [];
          searchTerms.push(...paramSynonyms);
          let bestMatch: any = null;

          for (const line of lines) {
            const lowerLine = line.toLowerCase().trim();
            if (!lowerLine) continue;
            for (const term of searchTerms) {
              if (lowerLine.includes(term)) {
                const afterTerm = line.substring(lowerLine.indexOf(term) + term.length).replace(/^[\s:=\-]+/, "").trim();
                const extractedValue = afterTerm || null;
                const hints = (param as any).extractionHints;
                if (hints?.regex && extractedValue) {
                  try { const m = extractedValue.match(new RegExp(hints.regex)); if (m) { bestMatch = { value: m[0], matchType: "regex", confidence: 95, matchedTerm: term }; break; } } catch {}
                }
                if (!bestMatch || bestMatch.confidence < 80) {
                  bestMatch = { value: extractedValue, matchType: paramSynonyms.includes(term) ? "synonym" : "label", confidence: paramSynonyms.includes(term) ? 85 : 75, matchedTerm: term };
                }
              }
            }
            if (bestMatch?.confidence === 95) break;
          }

          if (bestMatch) {
            const synDetail = bestMatch.matchedTerm ? synonymDetailMap.get(`${param.id}:${bestMatch.matchedTerm}`) : undefined;
            const isSynonymMatch = bestMatch.matchType === "synonym" && synDetail;
            const isLearning = isSynonymMatch && synDetail!.status === "learning";
            results.push({
              parameterId: param.id, fieldKey: param.fieldKey, label: param.label, matchedValue: bestMatch.value,
              matchType: bestMatch.matchType, confidence: bestMatch.confidence,
              needsConfirmation: isLearning ? true : bestMatch.confidence < 95,
              synonymId: synDetail?.id, synonymStatus: synDetail?.status, synonymConfirmationCount: synDetail?.confirmationCount,
              isProposal: isLearning || false,
            });
          }
        }

        results.sort((a, b) => b.confidence - a.confidence);

        const DATE_FIELD_KEYWORDS = ["datum", "date", "platnost", "expir", "podpis", "narod", "vydaj", "ukonc"];
        for (const r of results) {
          if (r.matchedValue && DATE_FIELD_KEYWORDS.some(kw => r.fieldKey?.toLowerCase().includes(kw) || r.label?.toLowerCase().includes(kw))) {
            r.matchedValue = normalizeExtractedDate(r.matchedValue);
          }
        }

        const OCR_DUPLICATE_LIMIT = 5;
        const valueCounts = new Map<string, number>();
        for (const r of results) {
          if (r.matchedValue) {
            const normalizedVal = String(r.matchedValue).trim().toLowerCase();
            const count = (valueCounts.get(normalizedVal) || 0) + 1;
            valueCounts.set(normalizedVal, count);
            if (count > OCR_DUPLICATE_LIMIT) {
              r.needsConfirmation = true;
              r.duplicateWarning = true;
            }
          }
        }

        try {
          const REGISTRY_FIELD_MAP_WORKER: Record<string, string> = {
            obchodne_meno: "name", company_name: "name", nazov_firmy: "name",
            address: "street", adresa: "street", ulica: "street",
            sidlo: "city", mesto: "city", psc: "zip", dic: "dic", pravna_forma: "legalForm",
          };
          const icoFieldW = results.find((r: any) => r.fieldKey && (r.fieldKey.toLowerCase() === "ico" || r.fieldKey.toLowerCase().includes("ico")) && r.matchedValue);
          let workerSnapshot: any = null;
          if (nextJob.subjectId) {
            const snaps = await db.select().from(registrySnapshots).where(eq(registrySnapshots.subjectId, nextJob.subjectId)).orderBy(desc(registrySnapshots.fetchedAt)).limit(1);
            if (snaps.length > 0) workerSnapshot = snaps[0];
          }
          if (!workerSnapshot && icoFieldW?.matchedValue) {
            const snaps = await db.select().from(registrySnapshots).where(eq(registrySnapshots.ico, icoFieldW.matchedValue.trim())).orderBy(desc(registrySnapshots.fetchedAt)).limit(1);
            if (snaps.length > 0) workerSnapshot = snaps[0];
          }
          if (workerSnapshot) {
            const parsedW = workerSnapshot.parsedFields as Record<string, any>;
            const srcW = workerSnapshot.source || "ORSR";
            for (const r of results) {
              if (!r.matchedValue || !r.fieldKey) continue;
              const regKey = REGISTRY_FIELD_MAP_WORKER[r.fieldKey.toLowerCase()];
              if (!regKey || !parsedW[regKey]) continue;
              const cVal = r.matchedValue.trim();
              const rVal = String(parsedW[regKey]).trim();
              if (cVal.toLowerCase() !== rVal.toLowerCase()) {
                r.registryConflict = { registryValue: rVal, source: srcW };
                try { await storage.proposeRegistrySynonym(r.parameterId, cVal, rVal); } catch {}
              }
            }
          }
        } catch (regErrW: any) {
          console.error("[OCR WORKER] Registry audit error:", regErrW.message);
        }

        await db.update(ocrProcessingJobs).set({
          status: "completed", extractedText: ocrResult.text, extractedFields: JSON.stringify(results),
          pageCount: ocrResult.pages, completedAt: new Date(),
        }).where(eq(ocrProcessingJobs.id, nextJob.id));

        console.log(`[OCR WORKER] Job ${nextJob.id} dokončený: ${ocrResult.pages} strán, ${results.length} polí`);
      } catch (err: any) {
        console.error(`[OCR WORKER] Job ${nextJob.id} zlyhal:`, err.message);
        await db.update(ocrProcessingJobs).set({ status: "failed", error: err.message, completedAt: new Date() }).where(eq(ocrProcessingJobs.id, nextJob.id));
      }
    } catch (err: any) {
      console.error("[OCR WORKER] Chyba workera:", err.message);
    } finally {
      ocrWorkerRunning = false;
    }
  }

  const ocrWorkerInterval = setInterval(processNextOcrJob, 10000);
  console.log("[OCR WORKER] Background worker spustený (interval 10s)");

  process.on("SIGTERM", async () => {
    console.log("[OCR WORKER] SIGTERM prijatý, zastavujem...");
    ocrWorkerShutdown = true;
    clearInterval(ocrWorkerInterval);
    const processing = await db.select().from(ocrProcessingJobs).where(eq(ocrProcessingJobs.status, "processing"));
    for (const job of processing) {
      await db.update(ocrProcessingJobs).set({ status: "interrupted" }).where(eq(ocrProcessingJobs.id, job.id));
    }
  });

  return httpServer;
}

async function seedTestContracts() {
  const existingContracts = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.isDeleted, false)).limit(5);
  if (existingContracts.length >= 5) {
    return { message: "Už existuje 5+ zmlúv, seed preskočený", count: existingContracts.length };
  }

  const allSubjects = await db.select().from(subjects).limit(10);
  const allPartners = await db.select().from(partners).where(eq(partners.isDeleted, false)).limit(10);
  const allProducts = await db.select().from(products).where(eq(products.isDeleted, false)).limit(10);
  const allStatuses = await db.select().from(contractStatuses).limit(10);
  const allCompanies = await db.select().from(myCompanies).where(eq(myCompanies.isDeleted, false)).limit(5);

  const subjectId = allSubjects.length > 0 ? allSubjects[0].id : null;
  const subjectId2 = allSubjects.length > 1 ? allSubjects[1].id : subjectId;
  const subjectId3 = allSubjects.length > 2 ? allSubjects[2].id : subjectId;
  const partnerId = allPartners.length > 0 ? allPartners[0].id : null;
  const partnerId2 = allPartners.length > 1 ? allPartners[1].id : partnerId;
  const productId = allProducts.length > 0 ? allProducts[0].id : null;
  const productId2 = allProducts.length > 1 ? allProducts[1].id : productId;
  const statusId = allStatuses.length > 0 ? allStatuses[0].id : null;
  const statusId2 = allStatuses.length > 1 ? allStatuses[1].id : statusId;
  const companyId = allCompanies.length > 0 ? allCompanies[0].id : null;

  const now = new Date();
  const daysMs = 24 * 60 * 60 * 1000;

  const testContracts = [
    {
      contractNumber: "TST-2025-001",
      proposalNumber: "NAV-001",
      subjectId,
      partnerId,
      productId,
      statusId,
      companyId,
      contractType: "Nova",
      paymentFrequency: "mesačne",
      signedDate: new Date(now.getTime() - 365 * daysMs),
      effectiveDate: new Date(now.getTime() - 360 * daysMs),
      expiryDate: new Date(now.getTime() + 60 * daysMs),
      premiumAmount: 15000,
      annualPremium: 18000,
      commissionAmount: 2500,
      currency: "EUR",
      notes: "Testovacia zmluva - blížiaca sa expirácia (60 dní)",
      lifecyclePhase: 5,
      isDeleted: false,
    },
    {
      contractNumber: "TST-2025-002",
      proposalNumber: "NAV-002",
      subjectId: subjectId2,
      partnerId: partnerId2,
      productId: productId2,
      statusId: statusId2,
      companyId,
      contractType: "Nova",
      paymentFrequency: "štvrťročne",
      signedDate: new Date(now.getTime() - 400 * daysMs),
      effectiveDate: new Date(now.getTime() - 395 * daysMs),
      expiryDate: new Date(now.getTime() + 30 * daysMs),
      premiumAmount: 25000,
      annualPremium: 30000,
      commissionAmount: 4000,
      currency: "EUR",
      notes: "Testovacia zmluva - blížiaca sa expirácia (30 dní)",
      lifecyclePhase: 6,
      isDeleted: false,
    },
    {
      contractNumber: "TST-2025-003",
      proposalNumber: "NAV-003",
      subjectId: subjectId3,
      partnerId,
      productId,
      statusId,
      companyId,
      contractType: "Nova",
      paymentFrequency: "ročne",
      signedDate: new Date(now.getTime() - 730 * daysMs),
      effectiveDate: new Date(now.getTime() - 725 * daysMs),
      expiryDate: new Date(now.getTime() - 45 * daysMs),
      premiumAmount: 50000,
      annualPremium: 50000,
      commissionAmount: 7500,
      currency: "EUR",
      notes: "Testovacia zmluva - expirovaná",
      lifecyclePhase: 10,
      isDeleted: false,
    },
    {
      contractNumber: "TST-2025-004",
      proposalNumber: "NAV-004",
      subjectId,
      partnerId: partnerId2,
      productId: productId2,
      statusId: statusId2,
      companyId,
      contractType: "Nova",
      paymentFrequency: "mesačne",
      signedDate: new Date(now.getTime() - 180 * daysMs),
      effectiveDate: new Date(now.getTime() - 175 * daysMs),
      expiryDate: new Date(now.getTime() + 550 * daysMs),
      premiumAmount: 12000,
      annualPremium: 14400,
      commissionAmount: 1800,
      currency: "EUR",
      notes: "Testovacia zmluva - aktívna",
      lifecyclePhase: 5,
      isDeleted: false,
    },
    {
      contractNumber: "TST-2025-005",
      proposalNumber: "NAV-005",
      subjectId: subjectId2,
      partnerId,
      productId,
      statusId,
      companyId,
      contractType: "Nova",
      paymentFrequency: "polročne",
      signedDate: new Date(now.getTime() - 90 * daysMs),
      effectiveDate: new Date(now.getTime() - 85 * daysMs),
      expiryDate: new Date(now.getTime() + 1000 * daysMs),
      premiumAmount: 35000,
      annualPremium: 42000,
      commissionAmount: 5200,
      currency: "EUR",
      notes: "Testovacia zmluva - aktívna",
      lifecyclePhase: 5,
      isDeleted: false,
    },
  ];

  const inserted = [];
  for (const c of testContracts) {
    const existing = await db.select({ id: contracts.id }).from(contracts).where(eq(contracts.contractNumber, c.contractNumber!)).limit(1);
    if (existing.length > 0) continue;
    const [row] = await db.insert(contracts).values(c as any).returning();
    inserted.push(row);
  }

  console.log(`[SEED] Vytvorených ${inserted.length} testovacích zmlúv`);
  return { message: `Vytvorených ${inserted.length} testovacích zmlúv`, count: inserted.length, ids: inserted.map(r => r.id) };
}

async function refreshDocumentStatuses(): Promise<number> {
  const VALIDITY_FIELDS = ['op_platnost', 'pas_platnost', 'platnost_dokladu'];

  const subjects = await db.execute(sql`
    SELECT id, details FROM subjects WHERE is_active = true AND deleted_at IS NULL
  `);

  let count = 0;
  for (const subject of (subjects.rows || [])) {
    const details = (subject as any).details || {};
    const dynamicFields = details.dynamicFields || details;

    for (const fieldKey of VALIDITY_FIELDS) {
      const dateVal = dynamicFields[fieldKey];
      if (!dateVal) continue;

      const expiry = new Date(dateVal);
      expiry.setHours(23, 59, 59, 999);
      const now = new Date();
      const diffMs = expiry.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let status = 'valid';
      if (daysRemaining <= 0) status = 'expired';
      else if (daysRemaining <= 90) status = 'expiring';

      await db.execute(sql`
        INSERT INTO subject_document_status (subject_id, field_key, expiry_date, status, days_remaining, updated_at)
        VALUES (${(subject as any).id}, ${fieldKey}, ${dateVal}::date, ${status}, ${daysRemaining}, NOW())
        ON CONFLICT (subject_id, field_key) 
        DO UPDATE SET expiry_date = ${dateVal}::date, status = ${status}, days_remaining = ${daysRemaining}, updated_at = NOW()
      `);
      count++;
    }

    const docs = dynamicFields.documents || [];
    for (let i = 0; i < docs.length; i++) {
      const doc = docs[i];
      if (!doc.validUntil) continue;
      const fk = `doc_${i}_validUntil`;

      const expiry = new Date(doc.validUntil);
      expiry.setHours(23, 59, 59, 999);
      const now = new Date();
      const diffMs = expiry.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let status = 'valid';
      if (daysRemaining <= 0) status = 'expired';
      else if (daysRemaining <= 90) status = 'expiring';

      await db.execute(sql`
        INSERT INTO subject_document_status (subject_id, field_key, expiry_date, status, days_remaining, updated_at)
        VALUES (${(subject as any).id}, ${fk}, ${doc.validUntil}::date, ${status}, ${daysRemaining}, NOW())
        ON CONFLICT (subject_id, field_key) 
        DO UPDATE SET expiry_date = ${doc.validUntil}::date, status = ${status}, days_remaining = ${daysRemaining}, updated_at = NOW()
      `);
      count++;
    }
  }

  console.log(`[DOC VALIDITY] Refreshed ${count} document statuses`);
  return count;
}

function scheduleUndeliveredContractsCheck() {
  const TARGET_HOUR = 3;
  const TARGET_MINUTE = 30;

  function runAndScheduleNext() {
    storage.autoMoveUndeliveredContracts().then(count => {
      if (count > 0) {
        console.log(`[CRON] autoMoveUndeliveredContracts: ${count} zmluv presunutych do vyhrad`);
      }
    }).catch(err => {
      console.error("[CRON] autoMoveUndeliveredContracts error:", err);
    });
    scheduleNext();
  }

  function scheduleNext() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(TARGET_HOUR, TARGET_MINUTE, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    const delay = next.getTime() - now.getTime();
    setTimeout(runAndScheduleNext, delay);
  }

  scheduleNext();
}

async function seedDatabase() {
  const existingContinents = await storage.getContinents();
  if (existingContinents.length === 0) {
    const [europe] = await db.insert(continents).values({ name: "Europa", code: "01" }).returning();
    const [namerica] = await db.insert(continents).values({ name: "Severn\u00e1 Amerika", code: "02" }).returning();
    
    const [slovakia] = await db.insert(states).values([
      { continentId: europe.id, name: "Slovensko", code: "421", currency: "EUR", flagUrl: "https://flagcdn.com/w40/sk.png" },
      { continentId: europe.id, name: "\u010cesko", code: "420", currency: "CZK", flagUrl: "https://flagcdn.com/w40/cz.png" },
      { continentId: namerica.id, name: "USA", code: "001", currency: "USD", flagUrl: "https://flagcdn.com/w40/us.png" },
    ]).returning();
    
    const [company1] = await db.insert(myCompanies).values([
      { name: "SFA Financie s.r.o.", specialization: "SFA", code: "01", ico: "12345678", dic: "2012345678", city: "Bratislava", street: "Hlavn\u00e1", streetNumber: "1", postalCode: "81101", stateId: slovakia.id },
      { name: "Reality Pro s.r.o.", specialization: "Reality", code: "02", ico: "87654321", city: "Ko\u0161ice", street: "Hlavn\u00e1", streetNumber: "55", postalCode: "04001", stateId: slovakia.id },
    ]).returning();

    await db.insert(appUsers).values({
      username: "admin",
      password: "password123",
      firstName: "Super",
      lastName: "Admin",
      role: "admin",
      securityLevel: 4,
      adminCode: "1234",
      allowedCompanyIds: [company1.id],
      activeCompanyId: company1.id,
      activeStateId: slovakia.id,
    });

    await storage.createSubject({
      type: "person",
      firstName: "Super",
      lastName: "Admin",
      continentId: europe.id,
      stateId: slovakia.id,
      myCompanyId: company1.id,
      isActive: true,
      details: { role: "SuperAdmin" },
    });
  }

  const existingTypes = await storage.getClientTypes();
  if (existingTypes.length === 0) {
    await db.insert(clientTypes).values([
      { code: "FO", name: "Fyzicka osoba", baseParameter: "rc", isActive: true },
      { code: "PO", name: "Pravnicka osoba", baseParameter: "ico", isActive: true },
      { code: "SZCO", name: "Samostatne zamestnan\u00e1 osoba", baseParameter: "ico", isActive: true },
    ]);
  }

  const existingTabs = await storage.getClientDataTabs();
  if (existingTabs.length === 0) {
    const [tab1] = await db.insert(clientDataTabs).values({ code: "identita", name: "Identita", icon: "UserCheck", sortOrder: 0 }).returning();
    const [tab2] = await db.insert(clientDataTabs).values({ code: "legislativa", name: "Legislat\u00edva", icon: "Scale", sortOrder: 1 }).returning();
    const [tab3] = await db.insert(clientDataTabs).values({ code: "rodina", name: "Rodina a vz\u0165ahy", icon: "Users", sortOrder: 2 }).returning();
    const [tab4] = await db.insert(clientDataTabs).values({ code: "financie", name: "Financie a majetok", icon: "Wallet", sortOrder: 3 }).returning();
    const [tab5] = await db.insert(clientDataTabs).values({ code: "profil", name: "Profil a marketing", icon: "BarChart3", sortOrder: 4 }).returning();
    const [tab6] = await db.insert(clientDataTabs).values({ code: "digital", name: "Digit\u00e1lna stopa", icon: "Wifi", sortOrder: 5 }).returning();
    const [tab7] = await db.insert(clientDataTabs).values({ code: "servis", name: "Servis a arch\u00edv", icon: "Archive", sortOrder: 6 }).returning();

    await db.insert(clientDataCategories).values([
      { tabId: tab1.id, code: "povinne", name: "Povinn\u00e9", description: "Z\u00e1kladn\u00e9 identifika\u010dn\u00e9 \u00fadaje", color: "#ef4444", icon: "AlertCircle", sortOrder: 0 },
      { tabId: tab1.id, code: "dobrovolne", name: "Dobrovo\u013en\u00e9", description: "Dop\u013a\u0148uj\u00face osobn\u00e9 \u00fadaje", color: "#f59e0b", icon: "Plus", sortOrder: 1 },
      { tabId: tab1.id, code: "dokumentacne", name: "Dokumenta\u010dn\u00e9", description: "Doklady toto\u017enosti a k\u00f3pie", color: "#6366f1", icon: "FileText", sortOrder: 2 },
      { tabId: tab1.id, code: "komunikacne", name: "Komunika\u010dn\u00e9", description: "Kontaktn\u00e9 \u00fadaje a kan\u00e1ly", color: "#06b6d4", icon: "MessageSquare", sortOrder: 3 },
      { tabId: tab2.id, code: "zakonne", name: "Z\u00e1konn\u00e9", description: "Z\u00e1konom vy\u017eadovan\u00e9 \u00fadaje", color: "#dc2626", icon: "Gavel", sortOrder: 0 },
      { tabId: tab2.id, code: "aml", name: "AML", description: "Anti-money laundering \u00fadaje", color: "#b91c1c", icon: "Shield", sortOrder: 1 },
      { tabId: tab2.id, code: "pravne", name: "Pr\u00e1vne", description: "Pr\u00e1vne z\u00e1le\u017eitosti a exek\u00facie", color: "#7c3aed", icon: "Scale", sortOrder: 2 },
      { tabId: tab2.id, code: "citlive", name: "Citliv\u00e9", description: "Osobitn\u00e1 kateg\u00f3ria osobn\u00fdch \u00fadajov", color: "#be185d", icon: "Lock", sortOrder: 3 },
      { tabId: tab3.id, code: "vztahove", name: "Vz\u0165ahov\u00e9", description: "Rodinn\u00e9 a osobn\u00e9 vz\u0165ahy", color: "#ec4899", icon: "Heart", sortOrder: 0 },
      { tabId: tab3.id, code: "dedicske", name: "Dedi\u010dsk\u00e9", description: "Dedi\u010dsk\u00e9 inform\u00e1cie", color: "#a855f7", icon: "Scroll", sortOrder: 1 },
      { tabId: tab3.id, code: "rodokmen", name: "Rodokme\u0148", description: "Genealogick\u00e9 \u00fadaje", color: "#8b5cf6", icon: "GitBranch", sortOrder: 2 },
      { tabId: tab3.id, code: "socialne", name: "Soci\u00e1lne", description: "Soci\u00e1lne v\u00e4zby a komunity", color: "#f472b6", icon: "Users", sortOrder: 3 },
      { tabId: tab4.id, code: "majetkove", name: "Majetkov\u00e9", description: "Nehnute\u013enosti a majetok", color: "#059669", icon: "Building", sortOrder: 0 },
      { tabId: tab4.id, code: "zmluvne", name: "Zmluvn\u00e9", description: "\u00dadaje viazan\u00e9 na zmluvy", color: "#0d9488", icon: "FileSignature", sortOrder: 1 },
      { tabId: tab4.id, code: "transakcne", name: "Transak\u010dn\u00e9", description: "Hist\u00f3ria transakci\u00ed", color: "#0891b2", icon: "ArrowLeftRight", sortOrder: 2 },
      { tabId: tab4.id, code: "bonita", name: "Bonita a Discipl\u00edna", description: "Kreditn\u00fd rating a platobn\u00e1 mor\u00e1lka", color: "#16a34a", icon: "TrendingUp", sortOrder: 3 },
      { tabId: tab5.id, code: "doplnkove", name: "Doplnkov\u00e9/Servisn\u00e9", description: "Servisn\u00e9 a doplnkov\u00e9 inform\u00e1cie", color: "#f97316", icon: "Settings", sortOrder: 0 },
      { tabId: tab5.id, code: "marketingove", name: "Marketingov\u00e9", description: "S\u00fahlasy a preferencie (per firma)", color: "#eab308", icon: "Megaphone", sortOrder: 1 },
      { tabId: tab5.id, code: "segmentacne", name: "Segmenta\u010dn\u00e9", description: "Segment\u00e1cia a cie\u013eov\u00e9 skupiny", color: "#84cc16", icon: "Target", sortOrder: 2 },
      { tabId: tab5.id, code: "psychograficke", name: "Psychografick\u00e9", description: "Osobnostn\u00e9 rysy a hodnoty", color: "#a3e635", icon: "Brain", sortOrder: 3 },
      { tabId: tab5.id, code: "vzdelanostne", name: "Vzdelanostn\u00e9", description: "Vzdelanie a kvalifik\u00e1cie", color: "#22d3ee", icon: "GraduationCap", sortOrder: 4 },
      { tabId: tab6.id, code: "digitalne", name: "Digit\u00e1lne/Tech", description: "Digit\u00e1lne \u00fa\u010dty a zariadenia", color: "#3b82f6", icon: "Monitor", sortOrder: 0 },
      { tabId: tab6.id, code: "geolokacne", name: "Geoloka\u010dn\u00e9", description: "Polohy a adresy", color: "#2563eb", icon: "MapPin", sortOrder: 1 },
      { tabId: tab6.id, code: "behavioralne", name: "Behavior\u00e1lne", description: "Vzorce spr\u00e1vania", color: "#1d4ed8", icon: "Activity", sortOrder: 2 },
      { tabId: tab6.id, code: "biometricke", name: "Biometrick\u00e9", description: "Biometrick\u00e9 identifik\u00e1tory", color: "#7c3aed", icon: "Fingerprint", sortOrder: 3 },
      { tabId: tab6.id, code: "iot_zdravie", name: "IoT (Zdravie)", description: "Zdravotn\u00e9 a IoT d\u00e1ta", color: "#10b981", icon: "Heartbeat", sortOrder: 4 },
      { tabId: tab7.id, code: "systemove", name: "Syst\u00e9mov\u00e9", description: "Intern\u00e9 syst\u00e9mov\u00e9 z\u00e1znamy", color: "#64748b", icon: "Database", sortOrder: 0 },
      { tabId: tab7.id, code: "staznostne", name: "S\u0165a\u017enostn\u00e9", description: "Reklam\u00e1cie a s\u0165a\u017enosti", color: "#ef4444", icon: "AlertTriangle", sortOrder: 1 },
      { tabId: tab7.id, code: "externy_scoring", name: "Extern\u00fd scoring", description: "Extern\u00e9 hodnotenia a scoring", color: "#0ea5e9", icon: "BarChart", sortOrder: 2 },
      { tabId: tab7.id, code: "ai_predikcie", name: "AI predikcie", description: "Strojov\u00e9 u\u010denie a predikcie", color: "#8b5cf6", icon: "Cpu", sortOrder: 3 },
    ]);
    console.log("[SEED] Created 7 client data tabs and 30 categories");
  }
}

async function seedSubjectParameters() {
  const STATIC_SECTIONS = [
    { clientTypeId: 1, name: "POVINNÉ ÚDAJE", code: "fo_povinne", folderCategory: "povinne", sortOrder: 0, isPanel: false, gridColumns: 1 },
    { clientTypeId: 1, name: "DOPLNKOVÉ ÚDAJE", code: "fo_doplnkove", folderCategory: "doplnkove", sortOrder: 1, isPanel: false, gridColumns: 1 },
    { clientTypeId: 1, name: "VOLITEĽNÉ ÚDAJE", code: "fo_volitelne", folderCategory: "volitelne", sortOrder: 2, isPanel: false, gridColumns: 1 },
    { clientTypeId: 1, name: "Osobné údaje", code: "fo_osobne", folderCategory: "povinne", sortOrder: 0, isPanel: true, parentSectionId: null, gridColumns: 5 },
    { clientTypeId: 1, name: "Adresa", code: "fo_adresa", folderCategory: "povinne", sortOrder: 1, isPanel: true, gridColumns: 4 },
    { clientTypeId: 1, name: "Cudzinec bez rodného čísla", code: "fo_cudzinec", folderCategory: "povinne", sortOrder: 2, isPanel: true, gridColumns: 1 },
    { clientTypeId: 1, name: "Doklady", code: "fo_doklady", folderCategory: "povinne", sortOrder: 3, isPanel: true, gridColumns: 4 },
    { clientTypeId: 1, name: "Kontaktné údaje", code: "fo_kontakt", folderCategory: "povinne", sortOrder: 4, isPanel: true, gridColumns: 2 },
    { clientTypeId: 1, name: "Rodinný kontakt a zastihnutie", code: "fo_rodina", folderCategory: "doplnkove", sortOrder: 0, isPanel: true, gridColumns: 2 },
    { clientTypeId: 1, name: "Doručovacia adresa", code: "fo_dorucovacia", folderCategory: "doplnkove", sortOrder: 1, isPanel: true, gridColumns: 4 },
    { clientTypeId: 1, name: "AML – PEP a KUV", code: "fo_aml", folderCategory: "doplnkove", sortOrder: 2, isPanel: true, gridColumns: 3 },
    { clientTypeId: 1, name: "Zákonné údaje", code: "fo_zakonne", folderCategory: "doplnkove", sortOrder: 3, isPanel: true, gridColumns: 2 },
    { clientTypeId: 1, name: "Bankové údaje", code: "fo_zmluvne", folderCategory: "doplnkove", sortOrder: 4, isPanel: true, gridColumns: 3 },
    { clientTypeId: 1, name: "Majetkové údaje", code: "fo_majetkove", folderCategory: "doplnkove", sortOrder: 5, isPanel: true, gridColumns: 2 },
    { clientTypeId: 3, name: "POVINNÉ ÚDAJE", code: "szco_povinne", folderCategory: "povinne", sortOrder: 0, isPanel: false, gridColumns: 1 },
    { clientTypeId: 3, name: "DOPLNKOVÉ ÚDAJE", code: "szco_doplnkove", folderCategory: "doplnkove", sortOrder: 1, isPanel: false, gridColumns: 1 },
    { clientTypeId: 3, name: "VOLITEĽNÉ ÚDAJE", code: "szco_volitelne", folderCategory: "volitelne", sortOrder: 2, isPanel: false, gridColumns: 1 },
    { clientTypeId: 3, name: "Subjekt SZČO", code: "szco_subjekt", folderCategory: "povinne", sortOrder: 0, isPanel: true, gridColumns: 2 },
    { clientTypeId: 3, name: "Sídlo", code: "szco_sidlo", folderCategory: "povinne", sortOrder: 1, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "Osobné údaje", code: "szco_osobne", folderCategory: "povinne", sortOrder: 2, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "Adresa trvalého pobytu", code: "szco_adresa", folderCategory: "povinne", sortOrder: 3, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "Kontaktné údaje", code: "szco_kontakt", folderCategory: "povinne", sortOrder: 4, isPanel: true, gridColumns: 2 },
    { clientTypeId: 3, name: "Doklady", code: "szco_doklady", folderCategory: "povinne", sortOrder: 5, isPanel: true, gridColumns: 4 },
    { clientTypeId: 3, name: "AML – KUV", code: "szco_aml", folderCategory: "doplnkove", sortOrder: 0, isPanel: true, gridColumns: 3 },
    { clientTypeId: 3, name: "Firemný profil", code: "szco_firemny", folderCategory: "doplnkove", sortOrder: 1, isPanel: true, gridColumns: 2 },
    { clientTypeId: 3, name: "Zákonné údaje", code: "szco_zakonne", folderCategory: "doplnkove", sortOrder: 2, isPanel: true, gridColumns: 2 },
    { clientTypeId: 3, name: "Bankové údaje", code: "szco_zmluvne", folderCategory: "doplnkove", sortOrder: 3, isPanel: true, gridColumns: 3 },
    { clientTypeId: 4, name: "POVINNÉ ÚDAJE", code: "po_povinne", folderCategory: "povinne", sortOrder: 0, isPanel: false, gridColumns: 1 },
    { clientTypeId: 4, name: "DOPLNKOVÉ ÚDAJE", code: "po_doplnkove", folderCategory: "doplnkove", sortOrder: 1, isPanel: false, gridColumns: 1 },
    { clientTypeId: 4, name: "VOLITEĽNÉ ÚDAJE", code: "po_volitelne", folderCategory: "volitelne", sortOrder: 2, isPanel: false, gridColumns: 1 },
    { clientTypeId: 4, name: "Subjekt PO", code: "po_subjekt", folderCategory: "povinne", sortOrder: 0, isPanel: true, gridColumns: 2 },
    { clientTypeId: 4, name: "Sídlo", code: "po_sidlo", folderCategory: "povinne", sortOrder: 1, isPanel: true, gridColumns: 4 },
    { clientTypeId: 4, name: "Kontaktné údaje", code: "po_kontakt", folderCategory: "povinne", sortOrder: 2, isPanel: true, gridColumns: 2 },
    { clientTypeId: 4, name: "AML – KUV", code: "po_aml", folderCategory: "doplnkove", sortOrder: 0, isPanel: true, gridColumns: 3 },
    { clientTypeId: 4, name: "Firemný profil", code: "po_firemny", folderCategory: "doplnkove", sortOrder: 1, isPanel: true, gridColumns: 2 },
    { clientTypeId: 4, name: "Zákonné údaje", code: "po_zakonne", folderCategory: "doplnkove", sortOrder: 2, isPanel: true, gridColumns: 2 },
    { clientTypeId: 4, name: "Bankové údaje", code: "po_zmluvne", folderCategory: "doplnkove", sortOrder: 3, isPanel: true, gridColumns: 3 },
    { clientTypeId: 4, name: "Štatutári", code: "po_statutari", folderCategory: "doplnkove", sortOrder: 4, isPanel: true, gridColumns: 2 },
  ];

  const sectionMap: Record<string, number> = {};
  for (const sec of STATIC_SECTIONS) {
    const [inserted] = await db.insert(subjectParamSections).values(sec as any).returning();
    sectionMap[sec.code] = inserted.id;
  }

  const parentCodes: Record<string, string> = {
    fo_osobne: "fo_povinne", fo_adresa: "fo_povinne", fo_cudzinec: "fo_povinne", fo_doklady: "fo_povinne", fo_kontakt: "fo_povinne",
    fo_rodina: "fo_doplnkove", fo_dorucovacia: "fo_doplnkove", fo_aml: "fo_doplnkove", fo_zakonne: "fo_doplnkove", fo_zmluvne: "fo_doplnkove", fo_majetkove: "fo_doplnkove",
    szco_subjekt: "szco_povinne", szco_sidlo: "szco_povinne", szco_osobne: "szco_povinne", szco_adresa: "szco_povinne", szco_kontakt: "szco_povinne", szco_doklady: "szco_povinne",
    szco_aml: "szco_doplnkove", szco_firemny: "szco_doplnkove", szco_zakonne: "szco_doplnkove", szco_zmluvne: "szco_doplnkove",
    po_subjekt: "po_povinne", po_sidlo: "po_povinne", po_kontakt: "po_povinne",
    po_aml: "po_doplnkove", po_firemny: "po_doplnkove", po_zakonne: "po_doplnkove", po_zmluvne: "po_doplnkove", po_statutari: "po_doplnkove",
  };

  for (const [childCode, parentCode] of Object.entries(parentCodes)) {
    const childId = sectionMap[childCode];
    const parentId = sectionMap[parentCode];
    if (childId && parentId) {
      await db.update(subjectParamSections).set({ parentSectionId: parentId }).where(eq(subjectParamSections.id, childId));
    }
  }

  type FieldSeed = {
    clientTypeId: number; sectionCode: string; panelCode: string | null; fieldKey: string; label: string;
    shortLabel?: string; fieldType: string; isRequired: boolean; isHidden: boolean; options: string[];
    defaultValue: string | null; visibilityRule: { dependsOn: string; value: string } | null;
    unit: string | null; decimalPlaces: number; fieldCategory: string; categoryCode?: string;
    sortOrder: number; rowNumber: number; widthPercent: number;
  };

  const FIELDS: FieldSeed[] = [
    // === FO: Osobné údaje ===
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "titul_pred", label: "Titul pred menom", shortLabel: "Titul pred", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 1, widthPercent: 12 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "meno", label: "Meno", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 1, widthPercent: 33 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "priezvisko", label: "Priezvisko", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 1, widthPercent: 43 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "titul_za", label: "Titul za menom", shortLabel: "Titul za", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 12 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "rodne_priezvisko", label: "Rodné priezvisko", shortLabel: "Rod. priez.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 2, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "rodne_cislo", label: "Rodné číslo", shortLabel: "Rod. číslo", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 2, widthPercent: 25 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "datum_narodenia", label: "Dátum narodenia", shortLabel: "Dát. nar.", fieldType: "date", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 70, rowNumber: 2, widthPercent: 25 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "vek", label: "Vek", fieldType: "number", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 80, rowNumber: 3, widthPercent: 15 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "pohlavie", label: "Pohlavie", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["muž", "žena"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 90, rowNumber: 3, widthPercent: 20 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "miesto_narodenia", label: "Miesto narodenia", shortLabel: "Miesto nar.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 100, rowNumber: 4, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_osobne", fieldKey: "statna_prislusnost", label: "Štátna príslušnosť", shortLabel: "Št. príslušnosť", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 110, rowNumber: 4, widthPercent: 50 },
    // === FO: Adresa ===
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "tp_ulica", label: "Ulica (trvalý pobyt)", shortLabel: "Ulica", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "tp_supisne", label: "Súpisné číslo", shortLabel: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "tp_orientacne", label: "Orientačné číslo", shortLabel: "Orient. č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "tp_mesto", label: "Mesto", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "tp_psc", label: "PSČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "tp_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "korespond_rovnaka", label: "Adresa prech. pobytu sa zhoduje s trvalou", shortLabel: "Prech. = trvalá", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 100, rowNumber: 2, widthPercent: 100 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "ka_ulica", label: "Ulica (prechodný pobyt)", shortLabel: "Ulica (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 110, rowNumber: 3, widthPercent: 40 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "ka_supisne", label: "Súpisné číslo (prechodný)", shortLabel: "Súp. č. (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 120, rowNumber: 3, widthPercent: 30 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "ka_orientacne", label: "Orientačné číslo (prechodný)", shortLabel: "Or. č. (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 130, rowNumber: 3, widthPercent: 30 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "ka_mesto", label: "Mesto (prechodný)", shortLabel: "Mesto (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 140, rowNumber: 4, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "ka_psc", label: "PSČ (prechodný)", shortLabel: "PSČ (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 150, rowNumber: 4, widthPercent: 25 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "ka_stat", label: "Štát (prechodný)", shortLabel: "Štát (prech.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "korespond_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 160, rowNumber: 4, widthPercent: 25 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "kontaktna_rovnaka", label: "Kontaktná adresa sa zhoduje s trvalou", shortLabel: "Kontakt. = trvalá", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 200, rowNumber: 5, widthPercent: 100 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "koa_ulica", label: "Ulica (kontaktná)", shortLabel: "Ulica (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 210, rowNumber: 6, widthPercent: 40 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "koa_supisne", label: "Súpisné číslo (kontaktná)", shortLabel: "Súp. č. (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 220, rowNumber: 6, widthPercent: 30 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "koa_orientacne", label: "Orientačné číslo (kontaktná)", shortLabel: "Or. č. (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 230, rowNumber: 6, widthPercent: 30 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "koa_mesto", label: "Mesto (kontaktná)", shortLabel: "Mesto (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 240, rowNumber: 7, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "koa_psc", label: "PSČ (kontaktná)", shortLabel: "PSČ (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 250, rowNumber: 7, widthPercent: 25 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_adresa", fieldKey: "koa_stat", label: "Štát (kontaktná)", shortLabel: "Štát (kont.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "kontaktna_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 260, rowNumber: 7, widthPercent: 25 },
    // === FO: Doklady ===
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_doklady", fieldKey: "typ_dokladu", label: "Typ dokladu totožnosti", shortLabel: "Typ dokladu", fieldType: "jedna_moznost", isRequired: true, isHidden: false, options: ["Občiansky preukaz", "Cestovný pas", "Vodičský preukaz", "Povolenie na pobyt", "Preukaz diplomata", "Iný"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 20 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_doklady", fieldKey: "typ_dokladu_iny", label: "Špecifikácia dokladu", shortLabel: "Špecifikácia", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_dokladu", value: "Iný" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 20 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_doklady", fieldKey: "cislo_dokladu", label: "Číslo dokladu totožnosti", shortLabel: "Č. dokladu", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_doklady", fieldKey: "platnost_dokladu", label: "Platnosť dokladu do", shortLabel: "Platnosť do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 0, widthPercent: 20 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_doklady", fieldKey: "vydal_organ", label: "Vydal (orgán)", shortLabel: "Vydal", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_doklady", fieldKey: "kod_vydavajuceho_organu", label: "Kód vydávajúceho orgánu", shortLabel: "Kód orgánu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 100 },
    // === FO: Kontakt ===
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_kontakt", fieldKey: "telefon", label: "Telefónne číslo (primárne)", shortLabel: "Tel. číslo", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_povinne", panelCode: "fo_kontakt", fieldKey: "email", label: "Email (primárny)", shortLabel: "Email", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
    // === FO: Doplnkove - Rodina ===
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_rodina", fieldKey: "rodinny_kontakt_meno", label: "Meno rodinného kontaktu", shortLabel: "Rod. kontakt", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "komunikacne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_rodina", fieldKey: "rodinny_kontakt_telefon", label: "Telefón rodinného kontaktu", shortLabel: "Rod. telefón", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "komunikacne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_rodina", fieldKey: "rodinny_kontakt_vztah", label: "Vzťah", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Manžel/ka", "Partner/ka", "Rodič", "Dieťa", "Súrodenec", "Iný"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "komunikacne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_rodina", fieldKey: "zastihnutie", label: "Najlepšie zastihnutie", shortLabel: "Zastihnutie", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Ráno (8-12)", "Poobede (12-17)", "Večer (17-21)", "Kedykoľvek"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "komunikacne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
    // === FO: Doplnkove - Dorucovacia ===
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_dorucovacia", fieldKey: "doruc_rovnaka", label: "Doručovacia adresa sa zhoduje s trvalou", shortLabel: "Doruč. = trvalá", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "geolokacne", sortOrder: 10, rowNumber: 0, widthPercent: 100 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_dorucovacia", fieldKey: "doruc_ulica", label: "Ulica (doručovacia)", shortLabel: "Ulica (doruč.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "geolokacne", sortOrder: 20, rowNumber: 1, widthPercent: 100 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_dorucovacia", fieldKey: "doruc_mesto", label: "Mesto (doručovacia)", shortLabel: "Mesto (doruč.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "geolokacne", sortOrder: 30, rowNumber: 2, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_dorucovacia", fieldKey: "doruc_psc", label: "PSČ (doručovacia)", shortLabel: "PSČ (doruč.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "geolokacne", sortOrder: 40, rowNumber: 2, widthPercent: 25 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_dorucovacia", fieldKey: "doruc_stat", label: "Štát (doručovacia)", shortLabel: "Štát (doruč.)", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "doruc_rovnaka", value: "false" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "geolokacne", sortOrder: 50, rowNumber: 2, widthPercent: 25 },
    // === FO: AML ===
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_aml", fieldKey: "pep", label: "Politicky exponovaná osoba (PEP)", shortLabel: "PEP", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["Áno", "Nie"], defaultValue: "Nie", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 10, rowNumber: 0, widthPercent: 33 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_aml", fieldKey: "pep_funkcia", label: "PEP – verejná funkcia", shortLabel: "PEP funkcia", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "pep", value: "Áno" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 20, rowNumber: 0, widthPercent: 33 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_aml", fieldKey: "pep_vztah", label: "PEP – vzťah k PEP osobe", shortLabel: "PEP vzťah", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "pep", value: "Áno" }, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 30, rowNumber: 0, widthPercent: 33 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_aml", fieldKey: "kuv_meno_1", label: "KUV 1 – Meno a priezvisko", shortLabel: "KUV 1 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 40, rowNumber: 1, widthPercent: 40 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_aml", fieldKey: "kuv_rc_1", label: "KUV 1 – Rodné číslo", shortLabel: "KUV 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 50, rowNumber: 1, widthPercent: 30 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_aml", fieldKey: "kuv_podiel_1", label: "KUV 1 – % podiel", shortLabel: "KUV 1 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 60, rowNumber: 1, widthPercent: 30 },
    // === FO: Zákonné ===
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_zakonne", fieldKey: "dic", label: "DIČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_zakonne", fieldKey: "ic_dph", label: "IČ DPH", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_zakonne", fieldKey: "suhlas_gdpr", label: "Súhlas so spracovaním osobných údajov (GDPR)", shortLabel: "GDPR súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_zakonne", fieldKey: "suhlas_marketing", label: "Súhlas s marketingovou komunikáciou", shortLabel: "Marketing súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
    // === FO: Bankové ===
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_zmluvne", fieldKey: "iban", label: "IBAN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_zmluvne", fieldKey: "bic", label: "BIC/SWIFT", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_zmluvne", fieldKey: "cislo_uctu", label: "Číslo účtu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    // === FO: Majetkové ===
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_majetkove", fieldKey: "spz", label: "ŠPZ vozidla", shortLabel: "ŠPZ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "majetkove", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 1, sectionCode: "fo_doplnkove", panelCode: "fo_majetkove", fieldKey: "vin", label: "VIN číslo", shortLabel: "VIN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "majetkove", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
    // === SZČO: Subjekt ===
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_subjekt", fieldKey: "nazov_firmy", label: "Obchodné meno SZČO", shortLabel: "Obch. meno", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 60 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_subjekt", fieldKey: "ico", label: "IČO", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 40 },
    // === SZČO: Sídlo ===
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_sidlo", fieldKey: "sidlo_ulica", label: "Ulica (sídlo)", shortLabel: "Ulica", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_sidlo", fieldKey: "sidlo_supisne", label: "Súpisné číslo", shortLabel: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_sidlo", fieldKey: "sidlo_orientacne", label: "Orientačné číslo", shortLabel: "Orient. č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_sidlo", fieldKey: "sidlo_mesto", label: "Mesto/Obec", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_sidlo", fieldKey: "sidlo_psc", label: "PSČ", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_sidlo", fieldKey: "sidlo_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },
    // === SZČO: Osobné ===
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_osobne", fieldKey: "titul_pred", label: "Titul pred menom", shortLabel: "Titul pred", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 12 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_osobne", fieldKey: "meno", label: "Meno", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 33 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_osobne", fieldKey: "priezvisko", label: "Priezvisko", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 43 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_osobne", fieldKey: "titul_za", label: "Titul za menom", shortLabel: "Titul za", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 0, widthPercent: 12 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_osobne", fieldKey: "rodne_cislo", label: "Rodné číslo", shortLabel: "Rod. číslo", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 33 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_osobne", fieldKey: "datum_narodenia", label: "Dátum narodenia", shortLabel: "Dát. narodenia", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 33 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_osobne", fieldKey: "vek", label: "Vek", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 70, rowNumber: 1, widthPercent: 15 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_osobne", fieldKey: "statna_prislusnost", label: "Štátna príslušnosť", shortLabel: "Št. príslušnosť", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 80, rowNumber: 2, widthPercent: 100 },
    // === SZČO: Kontakt ===
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_kontakt", fieldKey: "telefon", label: "Telefónne číslo (primárne)", shortLabel: "Tel. číslo", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_kontakt", fieldKey: "email", label: "Email (primárny)", shortLabel: "Email", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
    // === SZČO: Doklady ===
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_doklady", fieldKey: "typ_dokladu", label: "Typ dokladu totožnosti", shortLabel: "Typ dokladu", fieldType: "jedna_moznost", isRequired: true, isHidden: false, options: ["Občiansky preukaz", "Cestovný pas", "Vodičský preukaz", "Povolenie na pobyt", "Preukaz diplomata", "Iný"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 20 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_doklady", fieldKey: "typ_dokladu_iny", label: "Špecifikácia dokladu", shortLabel: "Špecifikácia", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: { dependsOn: "typ_dokladu", value: "Iný" }, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 20 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_doklady", fieldKey: "cislo_dokladu", label: "Číslo dokladu totožnosti", shortLabel: "Č. dokladu", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_doklady", fieldKey: "platnost_dokladu", label: "Platnosť dokladu do", shortLabel: "Platnosť do", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 0, widthPercent: 20 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_doklady", fieldKey: "vydal_organ", label: "Vydal (orgán)", shortLabel: "Vydal", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_doklady", fieldKey: "kod_vydavajuceho_organu", label: "Kód vydávajúceho orgánu", shortLabel: "Kód orgánu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 100 },
    // === SZČO: Adresa ===
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_adresa", fieldKey: "tp_ulica", label: "Ulica (trvalý pobyt)", shortLabel: "Ulica", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_adresa", fieldKey: "tp_supisne", label: "Súpisné číslo", shortLabel: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_adresa", fieldKey: "tp_orientacne", label: "Orientačné číslo", shortLabel: "Orient. č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_adresa", fieldKey: "tp_mesto", label: "Mesto", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_adresa", fieldKey: "tp_psc", label: "PSČ", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
    { clientTypeId: 3, sectionCode: "szco_povinne", panelCode: "szco_adresa", fieldKey: "tp_stat", label: "Štát", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },
    // === SZČO: AML ===
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_aml", fieldKey: "kuv_meno_1", label: "KUV 1 – Meno a priezvisko", shortLabel: "KUV 1 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_aml", fieldKey: "kuv_rc_1", label: "KUV 1 – Rodné číslo", shortLabel: "KUV 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_aml", fieldKey: "kuv_podiel_1", label: "KUV 1 – % podiel", shortLabel: "KUV 1 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    // === SZČO: Zákonné ===
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_zakonne", fieldKey: "dic", label: "DIČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_zakonne", fieldKey: "ic_dph", label: "IČ DPH", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_zakonne", fieldKey: "suhlas_gdpr", label: "Súhlas so spracovaním osobných údajov (GDPR)", shortLabel: "GDPR súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_zakonne", fieldKey: "suhlas_marketing", label: "Súhlas s marketingovou komunikáciou", shortLabel: "Marketing súhlas", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
    // === SZČO: Bankové ===
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_zmluvne", fieldKey: "iban", label: "IBAN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_zmluvne", fieldKey: "bic", label: "BIC/SWIFT", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_zmluvne", fieldKey: "cislo_uctu", label: "Číslo účtu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    // === SZČO: Firemný profil ===
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_firemny", fieldKey: "obrat", label: "Obrat (ročný)", shortLabel: "Obrat", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 3, sectionCode: "szco_doplnkove", panelCode: "szco_firemny", fieldKey: "pocet_zamestnancov", label: "Počet zamestnancov", shortLabel: "Zamestnanci", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
    // === PO: Subjekt ===
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_subjekt", fieldKey: "nazov_firmy", label: "Obchodné meno", shortLabel: "Obch. meno", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 60 },
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_subjekt", fieldKey: "ico", label: "IČO", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 40 },
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_subjekt", fieldKey: "pravna_forma", label: "Právna forma", shortLabel: "Právna forma", fieldType: "jedna_moznost", isRequired: false, isHidden: false, options: ["s.r.o.", "a.s.", "k.s.", "v.o.s.", "družstvo", "nezisková org.", "iná"], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_subjekt", fieldKey: "datum_zalozenia", label: "Dátum založenia", shortLabel: "Založenie", fieldType: "date", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
    // === PO: Sídlo ===
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_sidlo", fieldKey: "sidlo_ulica", label: "Ulica (sídlo)", shortLabel: "Ulica", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_sidlo", fieldKey: "sidlo_supisne", label: "Súpisné číslo", shortLabel: "Súpisné č.", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_sidlo", fieldKey: "sidlo_orientacne", label: "Orientačné číslo", shortLabel: "Orient. č.", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_sidlo", fieldKey: "sidlo_mesto", label: "Mesto/Obec", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_sidlo", fieldKey: "sidlo_psc", label: "PSČ", fieldType: "short_text", isRequired: true, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 50, rowNumber: 1, widthPercent: 25 },
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_sidlo", fieldKey: "sidlo_stat", label: "Štát", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 60, rowNumber: 1, widthPercent: 25 },
    // === PO: Kontakt ===
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_kontakt", fieldKey: "telefon", label: "Telefónne číslo", shortLabel: "Telefón", fieldType: "phone", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 4, sectionCode: "po_povinne", panelCode: "po_kontakt", fieldKey: "email", label: "Email", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "povinne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
    // === PO: AML ===
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_aml", fieldKey: "kuv_meno_1", label: "KUV 1 – Meno a priezvisko", shortLabel: "KUV 1 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_aml", fieldKey: "kuv_rc_1", label: "KUV 1 – Rodné číslo / IČO", shortLabel: "KUV 1 RČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_aml", fieldKey: "kuv_podiel_1", label: "KUV 1 – % podiel", shortLabel: "KUV 1 %", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "%", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "aml", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    // === PO: Zákonné ===
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_zakonne", fieldKey: "dic", label: "DIČ", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_zakonne", fieldKey: "ic_dph", label: "IČ DPH", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_zakonne", fieldKey: "suhlas_gdpr", label: "Súhlas GDPR", shortLabel: "GDPR", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 30, rowNumber: 1, widthPercent: 50 },
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_zakonne", fieldKey: "suhlas_marketing", label: "Súhlas marketing", shortLabel: "Marketing", fieldType: "switch", isRequired: false, isHidden: false, options: [], defaultValue: "false", visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zakonne", sortOrder: 40, rowNumber: 1, widthPercent: 50 },
    // === PO: Bankové ===
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_zmluvne", fieldKey: "iban", label: "IBAN", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 10, rowNumber: 0, widthPercent: 40 },
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_zmluvne", fieldKey: "bic", label: "BIC/SWIFT", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 20, rowNumber: 0, widthPercent: 30 },
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_zmluvne", fieldKey: "cislo_uctu", label: "Číslo účtu", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "zmluvne", sortOrder: 30, rowNumber: 0, widthPercent: 30 },
    // === PO: Firemný profil ===
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_firemny", fieldKey: "obrat", label: "Obrat (ročný)", shortLabel: "Obrat", fieldType: "desatinne_cislo", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: "€", decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_firemny", fieldKey: "pocet_zamestnancov", label: "Počet zamestnancov", shortLabel: "Zamestnanci", fieldType: "number", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 0, fieldCategory: "doplnkove", categoryCode: "firemny_profil", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
    // === PO: Štatutári ===
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_statutari", fieldKey: "statutar_meno_1", label: "Štatutár 1 – Meno", shortLabel: "Štat. 1 Meno", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "statutarne", sortOrder: 10, rowNumber: 0, widthPercent: 50 },
    { clientTypeId: 4, sectionCode: "po_doplnkove", panelCode: "po_statutari", fieldKey: "statutar_funkcia_1", label: "Štatutár 1 – Funkcia", shortLabel: "Štat. 1 Funkcia", fieldType: "short_text", isRequired: false, isHidden: false, options: [], defaultValue: null, visibilityRule: null, unit: null, decimalPlaces: 2, fieldCategory: "doplnkove", categoryCode: "statutarne", sortOrder: 20, rowNumber: 0, widthPercent: 50 },
  ];

  const allInsertedParams: number[] = [];
  for (const f of FIELDS) {
    const sectionId = f.sectionCode ? sectionMap[f.sectionCode] : null;
    const panelId = f.panelCode ? sectionMap[f.panelCode] : null;
    const [inserted] = await db.insert(subjectParameters).values({
      clientTypeId: f.clientTypeId,
      sectionId: sectionId || null,
      panelId: panelId || null,
      fieldKey: f.fieldKey,
      label: f.label,
      shortLabel: f.shortLabel || null,
      fieldType: f.fieldType,
      isRequired: f.isRequired,
      isHidden: f.isHidden,
      options: f.options as any,
      defaultValue: f.defaultValue,
      visibilityRule: f.visibilityRule as any,
      unit: f.unit,
      decimalPlaces: f.decimalPlaces,
      fieldCategory: f.fieldCategory,
      categoryCode: f.categoryCode || null,
      sortOrder: f.sortOrder,
      rowNumber: f.rowNumber,
      widthPercent: f.widthPercent,
    } as any).returning();
    allInsertedParams.push(inserted.id);
  }

  const [defaultTemplate] = await db.insert(subjectTemplates).values({
    name: "Základná šablóna (všetky polia)",
    code: "zakladna_sablona",
    description: "Predvolená šablóna obsahujúca všetky parametre pre všetky typy subjektov",
    isDefault: true,
    isActive: true,
  } as any).returning();

  const templateParamValues = allInsertedParams.map((pid, idx) => ({
    templateId: defaultTemplate.id,
    parameterId: pid,
    sortOrder: idx * 10,
  }));

  for (let i = 0; i < templateParamValues.length; i += 50) {
    const batch = templateParamValues.slice(i, i + 50);
    await db.insert(subjectTemplateParams).values(batch);
  }

  console.log(`[SEED] Created ${STATIC_SECTIONS.length} sections, ${allInsertedParams.length} parameters, 1 default template`);
}
