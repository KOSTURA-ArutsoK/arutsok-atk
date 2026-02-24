import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { z } from "zod";
import { continents, states, myCompanies, appUsers, clientTypes, clientSubGroups, clientGroupMembers, productFolderAssignments, folderPanels, panelParameters, userClientGroupMemberships, clientGroups, permissionGroups, insertCareerLevelSchema, insertProductPointRateSchema, careerLevels, importLogs, commissions, contracts, contractStatuses, contractStatusChangeLogs, clientDataTabs, clientDataCategories, subjects, subjectPointsLog, subjectFieldHistory, subjectCollaborators, clientMarketingConsents, clientDocumentHistory, contractAcquirers, contractPasswords, contractRewardDistributions, contractParameterValues, subjectArchive, auditLogs, globalCounters, subjectPhotos, activityEvents, subjectParamSections, subjectParameters, subjectTemplates, subjectTemplateParams, commissionCalculationLogs, parameterSynonyms, dataConflictAlerts, transactionDedupLog, relationRoleTypes, subjectRelations, maturityAlerts, inheritancePrompts, guardianshipArchive, households, householdMembers, householdAssets, privacyBlocks, accessConsentLog, maturityEvents, addressGroups, addressGroupMembers, companySubjectRoles, notificationQueue, batchJobs, subjectObjects, objectDataSources, sectors, sections, sectorProducts, parameters, panels, productPanels, contractFolders, fieldLayoutConfigs, sectorCategoryMapping, suggestedRelations, statusEvidence, contractLifecycleHistory, systemNotifications, partners, products } from "@shared/schema";
import { notifyObjectionCreated, notifyPreDeletion, getProductDaysLimits } from "./email";
import { seedSubjectParameters, seedAssetPanels, seedEventAndEntityPanels } from "./seed-subject-params";
import sharp from "sharp";
import { db } from "./db";
import { eq, and, or, isNotNull, sql, inArray, desc, asc } from "drizzle-orm";
import multer from "multer";
import ExcelJS from "exceljs";
import { parse as csvParse } from "csv-parse/sync";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { encryptField, decryptField } from "./crypto";

function stripBallast(str: string): string {
  return str.replace(/[\s\-\+\(\)\/\.]/g, "");
}

async function isMigrationModeOn(): Promise<boolean> {
  try {
    const val = await storage.getSystemSetting("MIGRATION_MODE");
    return val === "ON";
  } catch {
    return false;
  }
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
    const replitUserId = req.user?.claims?.sub;
    let appUser: any = null;
    if (replitUserId) {
      appUser = await storage.getAppUserByReplitId(replitUserId);
    }
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    const clientProcessingTime = req.body?.processingTimeSec ? Number(req.body.processingTimeSec) : 0;
    const serverTimeSec = req._auditStartTime ? Math.round((performance.now() - req._auditStartTime) / 1000) : 0;
    const processingTime = params.processingTimeSec || clientProcessingTime || serverTimeSec;

    await storage.createAuditLog({
      userId: migrationOn ? null : (appUser?.id || null),
      username: migrationOn ? "Systémový import" : (appUser?.username || req.user?.claims?.email || 'system'),
      action: params.action,
      module: params.module,
      entityId: params.entityId || null,
      entityName: params.entityName || null,
      oldData: params.oldData || null,
      newData: params.newData || null,
      processingTimeSec: processingTime,
      ipAddress: migrationOn ? "migration" : (typeof ip === 'string' ? ip : JSON.stringify(ip)),
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
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
    const validDirs = ["official", "work", "logos", "amendments", "profiles", "flags", "status-change-docs", "subject-photos"];
    const dir = validDirs.includes(section) ? section : "official";
    cb(null, path.join(UPLOADS_DIR, dir));
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e6);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const LIFECYCLE_PHASES: Record<number, string> = {
    1: "Čakajúce na odoslanie",
    2: "Odoslané na sprievodke",
    3: "Neprijaté zmluvy – výhrady",
    4: "Archív zmlúv (z výhradami)",
    5: "Prijaté do centrály",
    6: "Kontrakt v spracovaní",
    7: "Interná intervencia ku zmluve",
    8: "Pripravené na odoslanie",
    9: "Odoslané obch. partnerovi",
    10: "Prijaté obch. partnerom",
  };

  await setupAuth(app);
  registerAuthRoutes(app);

  seedAssetPanels().catch(err => console.error("[SEED-ASSETS ERROR]", err));
  seedEventAndEntityPanels().catch(err => console.error("[SEED-EVENTS ERROR]", err));

  app.use((req: any, _res, next) => {
    req._auditStartTime = performance.now();
    next();
  });

  app.use(async (req: any, _res, next) => {
    try {
      if (req.isAuthenticated && req.isAuthenticated() && req.user?.claims?.sub) {
        const appUser = await storage.getAppUserByReplitId(req.user.claims.sub);
        if (appUser) {
          req.appUser = appUser;
        }
      }
    } catch (err) {
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
      const replitUserId = req.user?.claims?.sub;
      if (!replitUserId) return res.status(404).json({ message: "No user" });
      
      let appUser = await storage.getAppUserByReplitId(replitUserId);
      
      if (!appUser) {
        const allUsers = await db.select().from(appUsers);
        if (allUsers.length > 0) {
          const admin = allUsers[0];
          await db.update(appUsers).set({ replitId: replitUserId }).where(eq(appUsers.id, admin.id));
          appUser = await storage.getAppUserByReplitId(replitUserId);
        }
      }
      
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

      res.json({ ...appUser, effectiveSessionTimeoutSeconds: effectiveTimeout, careerLevel, permissionGroup });
    } catch (err) {
      console.error("Error in /api/app-user/me:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.get("/api/app-users/my-points", isAuthenticated, async (req: any, res) => {
    try {
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
      if (!appUser) return res.status(404).json({ message: "User not found" });
      
      const updates: Record<string, any> = {};
      if (validated.activeCompanyId !== undefined) updates.activeCompanyId = validated.activeCompanyId;
      if (validated.activeStateId !== undefined) updates.activeStateId = validated.activeStateId;
      if (validated.activeCompanyId === null) updates.activeCompanyId = null;
      
      const oldData = { activeCompanyId: appUser.activeCompanyId, activeStateId: appUser.activeStateId };
      const updated = await storage.updateAppUser(appUser.id, updates);
      await logAudit(req, { action: "UPDATE", module: "nastavenia", entityId: appUser.id, entityName: appUser.username, oldData, newData: updates });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
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
    res.json(await storage.getPartners(includeDeleted));
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
      if (!appUser) return res.status(404).json({ message: "App user not found" });

      const file = req.file;
      if (!file) return res.status(400).json({ message: "No photo uploaded" });

      const ext = path.extname(file.originalname).toLowerCase();
      if (!['.jpg', '.jpeg', '.png'].includes(ext)) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ message: "Only .jpg and .png formats are allowed" });
      }

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
      return res.json(own ? [maskSubjectBirthNumber(own, appUser)] : []);
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

    const allCompanies = await storage.getMyCompanies();
    const companyMap = new Map(allCompanies.map(c => [c.id, c.name]));
    allSubjects = allSubjects.map((s: any) => ({
      ...s,
      companyName: companyMap.get(s.myCompanyId) || null,
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
    
    res.json(allSubjects.map((s: any) => {
      const masked = maskSubjectBirthNumber(s, appUser);
      if (!canSeeNotes && masked.uiPreferences) {
        const prefs = { ...(masked.uiPreferences as any) };
        delete prefs.field_notes;
        masked.uiPreferences = prefs;
      }
      return masked;
    }));
  });

  function getSubjectStatusCategory(subject: any, activeCompanyId?: number): string {
    if (subject.isDeceased) return "deceased";
    if (!subject.isActive) return "inactive";
    if (activeCompanyId && subject.myCompanyId !== activeCompanyId) return "other_company";
    if ((subject.contractCount ?? 0) === 0) return "no_contract";
    return "active";
  }

  app.get(api.subjects.get.path, async (req: any, res) => {
    const subjectId = Number(req.params.id);
    if (req.appUser?.permissionGroupId) {
      const [pg] = await db.select().from(permissionGroups).where(eq(permissionGroups.id, req.appUser.permissionGroupId));
      if (pg?.name === 'Klienti' && req.appUser.linkedSubjectId !== subjectId) {
        return res.status(403).json({ message: "Prístup zamietnutý" });
      }
    }
    const subject = await storage.getSubject(subjectId);
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    const masked = maskSubjectBirthNumber(subject, req.appUser);
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

  function maskSubjectBirthNumber(subject: any, appUser: any): any {
    if (!subject || !subject.birthNumber) return subject;
    if (canViewBirthNumber(appUser)) {
      const decrypted = decryptField(subject.birthNumber);
      return { ...subject, birthNumber: decrypted || "***" };
    }
    if (appUser?.subjectId && subject.id === appUser.subjectId) {
      const decrypted = decryptField(subject.birthNumber);
      return { ...subject, birthNumber: decrypted || "***" };
    }
    return { ...subject, birthNumber: "***" };
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

  app.post(api.subjects.create.path, async (req: any, res) => {
    try {
      const input = api.subjects.create.input.parse(req.body);
      if (req.appUser?.activeCompanyId) {
        input.myCompanyId = req.appUser.activeCompanyId;
      }
      if (req.appUser?.activeStateId) {
        input.stateId = req.appUser.activeStateId;
      }
      if (req.appUser?.id) {
        input.registeredByUserId = req.appUser.id;
      }

      if (input.type === 'szco') {
        if (input.birthNumber) {
          input.birthNumber = encryptField(input.birthNumber);
        }
        if (!input.linkedFoId) input.linkedFoId = null;
        const created = await storage.createSubject(input);
        await logAudit(req, { action: "CREATE", module: "subjekty", entityId: created.id, entityName: created.companyName || `${created.firstName} ${created.lastName} - SZCO #${created.uid}`, newData: { ...input, birthNumber: undefined } });
        res.status(201).json(maskSubjectBirthNumber(created, req.appUser));
      } else {
        if (input.birthNumber) {
          input.birthNumber = encryptField(input.birthNumber);
        }
        const created = await storage.createSubject(input);
        await logAudit(req, { action: "CREATE", module: "subjekty", entityId: created.id, entityName: (created.firstName ? created.firstName + ' ' + created.lastName : created.companyName) || undefined, newData: { ...input, birthNumber: input.birthNumber ? '***' : undefined } });
        res.status(201).json(maskSubjectBirthNumber(created, req.appUser));
      }
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message.includes("hierarchy")) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.put(api.subjects.update.path, async (req: any, res) => {
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
        input.birthNumber = encryptField(input.birthNumber);
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

      res.json(maskSubjectBirthNumber(updated, appUser));
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

  app.post(api.subjects.archive.path, async (req, res) => {
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
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
      const updated = await storage.updateCommissionRate(id, req.body);
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

      const logData = {
        contractId,
        contractNumber: contract.contractNumber,
        rateId: rate.id,
        agentId: agentId || null,
        agentLevel,
        managerId,
        managerLevel,
        premiumAmount: String(premium),
        rateType: rate.rateType,
        rateValue: rate.rateValue,
        baseCommission: String(baseCommission),
        differentialCommission: String(differentialCommission),
        totalCommission: String(baseCommission + differentialCommission),
        pointsEarned: String(pointsEarned),
        actorId: appUser?.id || null,
        actorUsername: appUser?.username || "system",
        processingTimeSec: processingTimeSec ? Math.round(processingTimeSec) : 0,
        inputSnapshot: { contractId, agentId, rateId: rate.id, premium, rateValue, agentLevel, managerLevel },
      };

      const calcLog = await storage.createCommissionCalculationLog(logData);
      await logAudit(req, { action: "CALCULATE", module: "provizie", entityId: contractId, newData: logData });

      res.json({
        success: true,
        calculation: calcLog,
        baseCommission,
        differentialCommission,
        totalCommission: baseCommission + differentialCommission,
        pointsEarned,
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

  app.post(api.appUserAdmin.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.appUserAdmin.create.input.parse(req.body);
      const created = await storage.createAppUser(input);
      await logAudit(req, { action: "CREATE", module: "pouzivatelia", entityName: input.username });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.appUserAdmin.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.appUserAdmin.update.input.parse(req.body);
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
    if (!["official", "work", "logos", "amendments", "profiles", "flags"].includes(section)) return res.status(400).json({ message: "Invalid section" });
    const filePath = path.join(UPLOADS_DIR, section, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File not found" });
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
    if (appUser?.role === 'superadmin') return queryStateId;
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
      // ArutsoK 43 - Protect system status name from being changed
      const statuses = await storage.getContractStatuses();
      const target = statuses.find(s => s.id === Number(req.params.id));
      if (target?.isSystem && input.name && input.name !== target.name) {
        return res.status(400).json({ message: "Nazov systemoveho stavu nie je mozne zmenit" });
      }
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
      const statuses = await storage.getContractStatuses();
      const target = statuses.find(s => s.id === statusId);
      if (target?.isSystem) {
        return res.status(400).json({ message: "Systemovy stav nie je mozne vymazat" });
      }
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

      await logAudit(req, {
        action: "STATUS_CHANGE",
        module: "zmluvy",
        entityId: contractId,
        entityName: `Zmena stavu zmluvy #${contractId}`,
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

      const migrationOn = await isMigrationModeOn();
      const now = new Date();
      const updateData: Record<string, any> = {
        lifecyclePhase: phase,
        updatedAt: migrationOn ? (contract.signedDate || now) : now,
      };

      if (phase === 3) {
        updateData.objectionEnteredAt = migrationOn ? (contract.signedDate || now) : now;
      }

      if (phase === 5) {
        updateData.receivedByCentralAt = migrationOn ? (contract.signedDate || now) : now;
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

  // === CONTRACT LIFECYCLE HISTORY (Stroj času) ===
  app.get("/api/contracts/:id/lifecycle-history", isAuthenticated, async (req: any, res) => {
    try {
      const contractId = Number(req.params.id);
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
        .orderBy(desc(contractLifecycleHistory.changedAt));

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
      const inventory = await storage.getContractInventories();
      const target = inventory.find(i => i.id === inventoryId);
      if (!target) {
        return res.status(404).json({ message: "Sprievodka nenajdena" });
      }
      const seqNum = await storage.getNextCounterValue("sprievodka_sequence");
      await storage.updateContractInventory(inventoryId, { 
        sequenceNumber: seqNum, 
        name: `Sprievodka c. ${seqNum}`,
        isDispatched: true 
      } as any);
      const dispatchStatus = await storage.getSystemContractStatusByName("Odoslana na sprievodke");
      for (let i = 0; i < contractIds.length; i++) {
        const updateData: any = { 
          inventoryId, 
          sortOrderInInventory: i + 1,
          dispatchedAt: new Date(),
        };
        if (dispatchStatus) updateData.statusId = dispatchStatus.id;
        await storage.updateContract(Number(contractIds[i]), updateData);
      }
      await logAudit(req, {
        action: "CREATE",
        module: "sprievodka_dispatch",
        entityId: inventoryId,
        entityName: `Sprievodka c. ${seqNum}`,
        newData: { contractIds, sequenceNumber: seqNum },
      });
      res.json({ success: true, dispatchedCount: contractIds.length, sequenceNumber: seqNum });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
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
      const inventory = await storage.getContractInventories();
      const target = inventory.find(i => i.id === inventoryId);
      if (!target) {
        return res.status(404).json({ message: "Sprievodka nenajdena" });
      }
      const acceptedStatus = await storage.getSystemContractStatusByName("Prijata centrom - OK");
      if (!acceptedStatus) {
        return res.status(500).json({ message: "Systemovy stav 'Prijata centrom - OK' neexistuje" });
      }
      let rejectedStatus = await storage.getSystemContractStatusByName("Neprijata - vyhrady");
      if (!rejectedStatus) {
        rejectedStatus = await storage.createContractStatus({
          name: "Neprijata - vyhrady",
          color: "#ef4444",
          sortOrder: 999,
          isCommissionable: false,
          isFinal: false,
          assignsNumber: false,
          definesContractEnd: false,
          isSystem: true,
        } as any);
      }
      const globalNumbers: Record<number, number> = {};
      const acceptedContractIds = contractIds.map(Number);
      for (const cId of acceptedContractIds) {
        const contract = await storage.getContract(cId);
        if (!contract) continue;
        if (contract.statusId === acceptedStatus.id) continue;
        const updateData: any = {
          statusId: acceptedStatus.id,
          acceptedAt: new Date(),
        };
        if (acceptedStatus.assignsNumber && !contract.globalNumber) {
          const globalNum = await storage.getNextCounterValue("global_contract_number");
          updateData.globalNumber = globalNum;
          globalNumbers[cId] = globalNum;
        }
        await storage.updateContract(cId, updateData);
        await storage.createContractStatusChangeLog({
          contractId: cId,
          oldStatusId: contract.statusId,
          newStatusId: acceptedStatus.id,
          changedByUserId: req.appUser?.id || null,
          parameterValues: {},
        });
      }
      const allContractsInInventory = await storage.getContracts({ inventoryId });
      const rejectedContractIds: number[] = [];
      for (const c of allContractsInInventory) {
        if (!acceptedContractIds.includes(c.id) && c.statusId !== acceptedStatus.id && c.statusId !== rejectedStatus.id) {
          await storage.updateContract(c.id, {
            statusId: rejectedStatus.id,
          } as any);
          await storage.createContractStatusChangeLog({
            contractId: c.id,
            oldStatusId: c.statusId,
            newStatusId: rejectedStatus.id,
            changedByUserId: req.appUser?.id || null,
            parameterValues: {},
          });
          rejectedContractIds.push(c.id);
        }
      }
      await storage.updateContractInventory(inventoryId, { isAccepted: true } as any);
      await logAudit(req, {
        action: "UPDATE",
        module: "sprievodka_accept",
        entityId: inventoryId,
        entityName: target.name,
        newData: { contractIds: acceptedContractIds, statusId: acceptedStatus.id, globalNumbers },
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
        entityName: `Hromadné pečiatkovanie - Súpiska #${inventoryId}`,
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
        entityName: `Hromadné pečiatkovanie - Sprievodka #${templateId}`,
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
    const filters = {
      stateId: getEnforcedStateId(req),
      statusId: req.query.statusId ? parseInt(req.query.statusId as string) : undefined,
      inventoryId: req.query.inventoryId ? parseInt(req.query.inventoryId as string) : undefined,
      includeDeleted: req.query.includeDeleted === 'true',
      unprocessed: req.query.unprocessed === 'true',
      companyId: appUser?.activeCompanyId || undefined,
    };
    const allContracts = await storage.getContracts(filters);
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
      return res.json(contractsWithAccess);
    }
    res.json(allContracts);
  });

  app.get(api.contractsApi.get.path, isAuthenticated, async (req: any, res) => {
    const contract = await storage.getContract(Number(req.params.id));
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    const appUser = req.appUser;
    if (appUser && appUser.activeStateId && contract.stateId && contract.stateId !== appUser.activeStateId && appUser.role !== 'superadmin') {
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
      const createData = { ...input, uploadedByUserId: appUser?.id || null } as any;
      if (appUser?.activeStateId) {
        createData.stateId = appUser.activeStateId;
      }
      if (appUser?.activeCompanyId) {
        createData.companyId = appUser.activeCompanyId;
      }
      if (!createData.statusId) {
        const defaultStatus = await storage.getSystemContractStatusByName("Nahrata do systemu");
        if (defaultStatus) {
          createData.statusId = defaultStatus.id;
        }
      }
      const nextGlobalNumber = await storage.getNextCounterValue("contract_global_number");
      createData.globalNumber = nextGlobalNumber;

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
      await logAudit(req, { action: "CREATE", module: "zmluvy", entityId: created.id, entityName: created.contractNumber || `Zmluva #${created.id}`, newData: input });
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
      await logAudit(req, { action: "VERIFY", module: "zmluvy", entityId: contractId, entityName: contract.contractNumber || `Zmluva #${contractId}` });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/contracts/import-excel", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Nebol nahratý žiadny súbor" });

      const fileName = file.originalname || "import";
      const isCSV = /\.csv$/i.test(fileName);
      let headers: string[] = [];
      const rawRows: Record<string, string>[] = [];

      if (isCSV) {
        const csvContent = fs.readFileSync(file.path, "utf-8");
        const records = csvParse(csvContent, { columns: true, skip_empty_lines: true, delimiter: [";", ",", "\t"], relax_column_count: true });
        if (records.length === 0) return res.status(400).json({ message: "CSV neobsahuje žiadne dáta" });
        headers = Object.keys(records[0] as Record<string, unknown>).map((h: string) => h.trim().toLowerCase());
        for (const rec of records) {
          const rowData: Record<string, string> = {};
          for (const [k, v] of Object.entries(rec as Record<string, unknown>)) {
            rowData[k.trim().toLowerCase()] = String(v || "").trim();
          }
          rawRows.push(rowData);
        }
      } else {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(file.path);
        const sheet = workbook.worksheets[0];
        if (!sheet) return res.status(400).json({ message: "Excel neobsahuje žiadny hárok" });

        sheet.getRow(1).eachCell((cell, colNumber) => {
          headers[colNumber] = String(cell.value || "").trim().toLowerCase();
        });

        for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
          const row = sheet.getRow(rowNum);
          const rowData: Record<string, string> = {};
          let hasData = false;
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber];
            if (header) {
              const val = String(cell.value || "").trim();
              rowData[header] = val;
              if (val) hasData = true;
            }
          });
          if (hasData) rawRows.push(rowData);
        }
      }

      const allSubjects = await storage.getSubjects();
      const uidMap = new Map<string, typeof allSubjects[0]>();
      for (const s of allSubjects) {
        if (s.uid) uidMap.set(s.uid, s);
      }

      const allPanelParams = await db.select().from(panelParameters).where(isNotNull(panelParameters.targetCategoryCode));
      const categoryMappings = new Map<string, string>();
      for (const pp of allPanelParams) {
        if (pp.targetCategoryCode) {
          const paramName = (pp as any).name || `param_${pp.parameterId}`;
          categoryMappings.set(String(paramName).toLowerCase(), pp.targetCategoryCode);
        }
      }

      const vinSpzTracker = new Map<string, { uid: string; subjectId: number; row: number }>();
      const duplicityWarnings: { row: number; field: string; value: string; existingUid: string; newUid: string }[] = [];

      const results: { row: number; status: string; action?: string; contractId?: number; subjectId?: number; warnings?: string[]; error?: string }[] = [];
      const appUser = req.appUser;
      const defaultStatus = await storage.getSystemContractStatusByName("Nahrata do systemu");
      const batchId = req.body?.batchId || `IMPORT-${Date.now()}`;

      for (let i = 0; i < rawRows.length; i++) {
        const rowData = rawRows[i];
        const rowNum = i + 2;
        const rowWarnings: string[] = [];

        try {
          const klientUidVal = rowData["klient_uid"] || rowData["klientuid"] || rowData["klient"] || rowData["klient_id"] || null;
          const ziskatelUidVal = rowData["ziskatel_uid"] || rowData["ziskateluid"] || rowData["ziskatel"] || rowData["ziskatel_id"] || null;
          const specialistaUidVal = rowData["specialista_uid"] || rowData["specialistauid"] || rowData["specialista"] || rowData["specialista_id"] || null;
          const zakonnyZastupcaUidVal = rowData["zakonny_zastupca_uid"] || rowData["zakonny_zastupca_id"] || rowData["zastupca"] || rowData["zastupca_id"] || null;
          const konatelUidVal = rowData["konatel_uid"] || rowData["konateluid"] || rowData["konatel"] || rowData["konatel_id"] || null;
          const szcoUidVal = rowData["szco_uid"] || rowData["szcouid"] || rowData["szco"] || rowData["szco_id"] || null;
          const szcoIcoVal = rowData["szco_ico"] || rowData["ico"] || rowData["szco_ico_number"] || null;
          const szcoRcVal = rowData["szco_rc"] || rowData["szco_rodne_cislo"] || rowData["szco_rodnecislo"] || null;

          let subjectId: number | null = null;
          let subjectAction: "matched" | "updated" | "created" = "matched";
          let needsManualVerification = false;

          if (klientUidVal && uidMap.has(klientUidVal)) {
            subjectId = uidMap.get(klientUidVal)!.id;
            subjectAction = "matched";
          }

          const rc = rowData["rodne_cislo"] || rowData["rc"] || rowData["birth_number"] || null;
          const ico = rowData["ico"] || rowData["ic_organizacie"] || null;
          const firstName = rowData["meno"] || rowData["first_name"] || null;
          const lastName = rowData["priezvisko"] || rowData["last_name"] || null;
          const companyName = rowData["nazov_firmy"] || rowData["company_name"] || null;
          const email = rowData["email"] || null;
          const phone = rowData["telefon"] || rowData["phone"] || null;

          if (!subjectId && rc) {
            const existing = allSubjects.find(s => {
              if (!s.birthNumber) return false;
              const decrypted = decryptField(s.birthNumber);
              return decrypted !== null && decrypted === rc;
            });
            if (existing) {
              subjectId = existing.id;
              subjectAction = "updated";
              const updates: any = {};
              if (firstName && firstName !== existing.firstName) updates.firstName = firstName;
              if (lastName && lastName !== existing.lastName) updates.lastName = lastName;
              if (email && email !== existing.email) updates.email = email;
              if (phone && phone !== existing.phone) updates.phone = phone;
              if (Object.keys(updates).length > 0) {
                updates.changeReason = "Automatická aktualizácia z importu zmlúv";
                await storage.updateSubject(existing.id, updates);
              }
            }
          }
          if (!subjectId && ico) {
            const existing = allSubjects.find(s => {
              const details = s.details as any;
              return details?.ico === ico || details?.dynamicFields?.ico === ico;
            });
            if (existing) {
              subjectId = existing.id;
              subjectAction = "updated";
              const updates: any = {};
              if (firstName && firstName !== existing.firstName) updates.firstName = firstName;
              if (lastName && lastName !== existing.lastName) updates.lastName = lastName;
              if (email && email !== existing.email) updates.email = email;
              if (phone && phone !== existing.phone) updates.phone = phone;
              if (Object.keys(updates).length > 0) {
                updates.changeReason = "Automatická aktualizácia z importu zmlúv";
                await storage.updateSubject(existing.id, updates);
              }
            }
          }
          if (!subjectId && (firstName || companyName)) {
            try {
              const isCompany = !!companyName && !firstName;
              const newSubject = await storage.createSubject({
                type: isCompany ? "company" : "person",
                firstName: firstName || null,
                lastName: lastName || null,
                companyName: companyName || null,
                email: email || null,
                phone: phone || null,
                birthNumber: rc ? encryptField(rc) : null,
                stateId: appUser?.activeStateId || null,
                myCompanyId: appUser?.activeCompanyId || null,
                details: ico ? { dynamicFields: { ico } } : {},
              } as any);
              subjectId = newSubject.id;
              subjectAction = "created";
              allSubjects.push(newSubject);
              if (newSubject.uid) uidMap.set(newSubject.uid, newSubject);
            } catch (createErr) {
              console.error("Import: Failed to create subject:", createErr);
            }
          }

          let resolvedSzcoUid = szcoUidVal;
          if (!szcoUidVal && (szcoIcoVal || szcoRcVal)) {
            let szcoSubject: typeof allSubjects[0] | undefined;
            if (szcoIcoVal) {
              szcoSubject = allSubjects.find(s => {
                const details = s.details as any;
                return details?.ico === szcoIcoVal;
              });
            }
            if (!szcoSubject && szcoRcVal) {
              szcoSubject = allSubjects.find(s => {
                if (!s.birthNumber) return false;
                const decrypted = decryptField(s.birthNumber);
                return decrypted !== null && decrypted === szcoRcVal;
              });
            }
            if (!szcoSubject) {
              const szcoName = rowData["szco_meno"] || rowData["szco_name"] || null;
              const szcoCity = rowData["szco_mesto"] || rowData["szco_city"] || null;
              if (szcoName && szcoCity) {
                szcoSubject = allSubjects.find(s => {
                  const fullName = `${s.firstName || ''} ${s.lastName || ''}`.trim().toLowerCase();
                  return fullName === szcoName.toLowerCase() && (s.city || '').toLowerCase() === szcoCity.toLowerCase();
                });
                if (szcoSubject) needsManualVerification = true;
              }
            }
            if (szcoSubject) {
              resolvedSzcoUid = szcoSubject.uid;
            }
          }

          const spz = rowData["spz"] || rowData["ecv"] || rowData["licence_plate"] || null;
          const vin = rowData["vin"] || rowData["vin_cislo"] || null;
          const currentSubjectUid = subjectId ? (allSubjects.find(s => s.id === subjectId)?.uid || `ID:${subjectId}`) : "neznámy";

          if (spz) {
            const spzUpper = spz.toUpperCase();
            const existingSpz = vinSpzTracker.get(`spz:${spzUpper}`);
            if (existingSpz && existingSpz.subjectId !== subjectId) {
              duplicityWarnings.push({ row: rowNum, field: "ŠPZ", value: spzUpper, existingUid: existingSpz.uid, newUid: currentSubjectUid });
              rowWarnings.push(`Potenciálny konflikt majetku: ŠPZ ${spzUpper} je priradené aj k UID ${existingSpz.uid}`);
            } else {
              const dbDuplicates = await storage.checkDuplicates({ spz: spzUpper });
              const conflicting = dbDuplicates.filter(s => s.id !== subjectId);
              if (conflicting.length > 0) {
                for (const c of conflicting) {
                  duplicityWarnings.push({ row: rowNum, field: "ŠPZ", value: spzUpper, existingUid: c.uid || `ID:${c.id}`, newUid: currentSubjectUid });
                  rowWarnings.push(`Potenciálny konflikt majetku: ŠPZ ${spzUpper} je priradené aj k UID ${c.uid || c.id}`);
                }
              }
            }
            vinSpzTracker.set(`spz:${spzUpper}`, { uid: currentSubjectUid, subjectId: subjectId || 0, row: rowNum });
          }

          if (vin) {
            const vinUpper = vin.toUpperCase();
            const existingVin = vinSpzTracker.get(`vin:${vinUpper}`);
            if (existingVin && existingVin.subjectId !== subjectId) {
              duplicityWarnings.push({ row: rowNum, field: "VIN", value: vinUpper, existingUid: existingVin.uid, newUid: currentSubjectUid });
              rowWarnings.push(`Potenciálny konflikt majetku: VIN ${vinUpper} je priradené aj k UID ${existingVin.uid}`);
            } else {
              const dbDuplicates = await storage.checkDuplicates({ vin: vinUpper });
              const conflicting = dbDuplicates.filter(s => s.id !== subjectId);
              if (conflicting.length > 0) {
                for (const c of conflicting) {
                  duplicityWarnings.push({ row: rowNum, field: "VIN", value: vinUpper, existingUid: c.uid || `ID:${c.id}`, newUid: currentSubjectUid });
                  rowWarnings.push(`Potenciálny konflikt majetku: VIN ${vinUpper} je priradené aj k UID ${c.uid || c.id}`);
                }
              }
            }
            vinSpzTracker.set(`vin:${vinUpper}`, { uid: currentSubjectUid, subjectId: subjectId || 0, row: rowNum });
          }

          const stornoDate = rowData["datum_storna"] || rowData["storno_date"] || rowData["datum_ukoncenia"] || null;
          let contractStatusId = defaultStatus?.id || null;
          let pendingBonusMalus = false;

          if (!stornoDate) {
            let pendingStatus = await storage.getSystemContractStatusByName("Čaká na posúdenie bonusu/malusu");
            if (!pendingStatus) {
              pendingStatus = await storage.createContractStatus({
                name: "Čaká na posúdenie bonusu/malusu",
                color: "#f59e0b",
                sortOrder: 997,
                isCommissionable: false,
                isFinal: false,
                assignsNumber: false,
                definesContractEnd: false,
                isSystem: true,
              } as any);
            }
            if (pendingStatus) {
              contractStatusId = pendingStatus.id;
              pendingBonusMalus = true;
              rowWarnings.push("Chýba dátum storna – zmluva čaká na manuálne posúdenie bonusu/malusu");
            }
          }

          const nextGlobalNumber = await storage.getNextCounterValue("contract_global_number");

          const telefon = rowData["telefon"] || rowData["phone"] || rowData["tel"] || null;
          const missingFields: string[] = [];
          if (!spz) missingFields.push("ŠPZ");
          if (!telefon) missingFields.push("Telefón");
          const isIncomplete = missingFields.length > 0;

          const contractData: any = {
            contractNumber: rowData["cislo_zmluvy"] || rowData["contract_number"] || null,
            proposalNumber: rowData["cislo_navrhu"] || rowData["proposal_number"] || null,
            kik: rowData["kik"] || null,
            subjectId,
            klientUid: klientUidVal,
            ziskatelUid: ziskatelUidVal,
            specialistaUid: specialistaUidVal,
            zakonnyZastupcaUid: zakonnyZastupcaUidVal,
            konatelUid: konatelUidVal,
            szcoUid: resolvedSzcoUid,
            szcoRodneCislo: szcoRcVal ? encryptField(szcoRcVal) : null,
            szcoIco: szcoIcoVal,
            needsManualVerification,
            premiumAmount: rowData["lehotne_poistne"] || rowData["premium"] ? parseInt(rowData["lehotne_poistne"] || rowData["premium"]) : null,
            paymentFrequency: rowData["frekvencia"] || rowData["payment_frequency"] || null,
            currency: rowData["mena"] || rowData["currency"] || "EUR",
            notes: rowData["poznamky"] || rowData["notes"] || null,
            stateId: appUser?.activeStateId || null,
            companyId: appUser?.activeCompanyId || null,
            statusId: contractStatusId,
            globalNumber: nextGlobalNumber,
            uploadedByUserId: appUser?.id || null,
            incompleteData: isIncomplete,
            incompleteDataReason: isIncomplete ? `Chýba: ${missingFields.join(", ")}` : null,
            importedAt: new Date(),
            importBatchId: batchId,
          };

          const created = await storage.createContract(contractData);
          if (created.statusId) {
            await storage.createContractStatusChangeLog({
              contractId: created.id,
              oldStatusId: null,
              newStatusId: created.statusId,
              changedByUserId: appUser?.id || null,
              parameterValues: {},
            });
          }

          if (subjectId) {
            const dynUpdates: Record<string, string> = {};
            for (const [headerKey, value] of Object.entries(rowData)) {
              if (!value) continue;
              if (categoryMappings.has(headerKey)) {
                dynUpdates[categoryMappings.get(headerKey)!] = value;
              }
            }
            if (spz) dynUpdates["spz"] = spz;
            if (vin) dynUpdates["vin"] = vin;

            if (Object.keys(dynUpdates).length > 0) {
              try {
                const subject = await storage.getSubject(subjectId);
                if (subject) {
                  const existingDetails = (subject.details || {}) as Record<string, any>;
                  const existingDynamic = existingDetails.dynamicFields || {};
                  await storage.updateSubject(subjectId, {
                    details: {
                      ...existingDetails,
                      dynamicFields: { ...existingDynamic, ...dynUpdates },
                    },
                    changeReason: "Automatické mapovanie dát z importu zmlúv do kategórií klienta",
                  });
                }
              } catch (mapErr) {
                console.error("Import category mapping error:", mapErr);
                rowWarnings.push("Nepodarilo sa namapovať dáta do kategórií klienta");
              }
            }
          }

          results.push({
            row: rowNum,
            status: "ok",
            action: subjectAction,
            contractId: created.id,
            subjectId: subjectId || undefined,
            warnings: rowWarnings.length > 0 ? rowWarnings : undefined,
          });
        } catch (rowErr: any) {
          results.push({ row: rowNum, status: "error", error: rowErr.message || "Neznáma chyba" });
        }
      }

      if (duplicityWarnings.length > 0) {
        for (const dw of duplicityWarnings) {
          await logAudit(req, {
            action: "DUPLICITY_WARNING",
            module: "import-zmluv",
            entityName: `Potenciálny konflikt majetku: ${dw.field} ${dw.value}`,
            newData: { row: dw.row, field: dw.field, value: dw.value, existingUid: dw.existingUid, newUid: dw.newUid },
          });
        }
      }

      const successCount = results.filter(r => r.status === "ok").length;
      const errorCount = results.filter(r => r.status === "error").length;
      const createdCount = results.filter(r => r.action === "created").length;
      const updatedCount = results.filter(r => r.action === "updated").length;
      const warningCount = results.filter(r => r.warnings && r.warnings.length > 0).length;

      await logAudit(req, {
        action: "IMPORT",
        module: "zmluvy",
        entityName: `Import ${fileName}: ${successCount} úspešných, ${createdCount} nových subjektov, ${updatedCount} aktualizovaných, ${errorCount} chýb, ${duplicityWarnings.length} duplicitných varovaní`,
        newData: { successCount, errorCount, createdCount, updatedCount, duplicityWarnings: duplicityWarnings.length },
      });

      res.json({
        total: results.length,
        success: successCount,
        errors: errorCount,
        created: createdCount,
        updated: updatedCount,
        warnings: warningCount,
        duplicityWarnings,
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
      if (appUser && appUser.activeStateId && old.stateId && old.stateId !== appUser.activeStateId && appUser.role !== 'superadmin') {
        return res.status(403).json({ message: "Uprava zmluvy z ineho statu nie je povolena" });
      }
      if (old.isLocked && appUser && appUser.role !== 'admin' && appUser.role !== 'superadmin') {
        return res.status(403).json({ message: "Zmluva je zamknuta v supiske. Iba admin moze upravovat zamknute zmluvy." });
      }
      if (old.globalNumber && input.globalNumber && input.globalNumber !== old.globalNumber) {
        return res.status(400).json({ message: "Globalne poradove cislo zmluvy nie je mozne zmenit" });
      }
      delete input.globalNumber;

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
      const auditNewData = criticalFieldJustification
        ? { ...input, _criticalFieldJustification: criticalFieldJustification }
        : input;
      const auditEntityName = criticalFieldJustification
        ? `Zmena kritických údajov - Odôvodnenie: ${criticalFieldJustification}`
        : undefined;
      await logAudit(req, { action: "UPDATE", module: "zmluvy", entityId: Number(req.params.id), oldData: old, newData: auditNewData, entityName: auditEntityName });
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
      if (appUser.activeStateId && contract.stateId && contract.stateId !== appUser.activeStateId && appUser.role !== 'superadmin') {
        return res.status(403).json({ message: "Vymazanie zmluvy z ineho statu nie je povolene" });
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
    if (enforcedState && group.stateId !== enforcedState) {
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
          if (!group || group.stateId !== enforcedState) {
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
      if (enforcedState && existing.stateId !== enforcedState) {
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
      const enforcedState = getEnforcedStateId(req);
      if (enforcedState && existing.stateId !== enforcedState) {
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
    if (enforcedState && group.stateId !== enforcedState) {
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
      if (enforcedState && group.stateId !== enforcedState) {
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
      if (enforcedState && group.stateId !== enforcedState) {
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
          if (!group || group.stateId !== enforcedState) {
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
    if (enforcedState && group.stateId !== enforcedState) {
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
      if (enforcedState && group.stateId !== enforcedState) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const data = { ...req.body, groupId: Number(req.params.groupId) };
      const created = await storage.addClientGroupMember(data);
      await logAudit(req, { action: "CREATE", module: "clenovia_skupiny", entityId: created.id });
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
      if (enforcedState && group.stateId !== enforcedState) {
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
      if (enforcedState && group.stateId !== enforcedState) {
        return res.status(403).json({ message: "Pristup zamietnuty" });
      }
      const { subjectIds } = req.body;
      if (!Array.isArray(subjectIds) || subjectIds.length === 0) {
        return res.status(400).json({ message: "Ziadni klienti na priradenie" });
      }
      const added = await storage.bulkAddClientGroupMembers(Number(req.params.groupId), subjectIds);
      await logAudit(req, { action: "CREATE", module: "clenovia_skupiny", entityName: `Hromadne priradenie ${added} klientov` });
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

      const archivePassword = process.env.ARCHIVE_RESTORE_PASSWORD || "ArutsoK2025!Restore";
      if (!password || password !== archivePassword) {
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
        entityName: `${entityType} #${numId}`,
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

      const archivePassword = process.env.ARCHIVE_RESTORE_PASSWORD || "ArutsoK2025!Restore";
      if (!password || password !== archivePassword) {
        return res.status(401).json({ message: "Nespravne bezpecnostne heslo" });
      }

      await storage.permanentDeleteEntity(entityType, numId);

      await logAudit(req, {
        action: "PERMANENT_DELETE",
        module: "kos",
        entityId: numId,
        entityName: `${entityType} #${numId}`,
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
  app.get("/api/system-settings/:key", async (_req, res) => {
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
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
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

      res.json({
        totalContracts,
        activeContractsCount: activeContracts.length,
        interventionCount: interventionContracts.length,
        totalAnnualPremium,
        activeStatusIds: activeStatusIdList,
        interventionStatusIds: interventionStatusIdList,
      });
    } catch (err: any) {
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
      const validKeys = ["stats", "recent_subjects", "my_companies", "recent_partners", "recent_products", "audit_activity", "upcoming_events"];
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
  app.post("/api/subjects/check-duplicate", isAuthenticated, async (req, res) => {
    try {
      const { birthNumber, ico, spz, vin } = req.body;
      const existing = await storage.checkDuplicateSubject({ birthNumber, ico });
      if (existing) {
        res.json({
          isDuplicate: true,
          subject: {
            id: existing.id,
            uid: existing.uid,
            name: existing.name,
            type: existing.type,
            matchedField: existing.matchedField,
          },
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

  app.get("/api/sectors", isAuthenticated, async (_req, res) => {
    try {
      const sectors = await storage.getSectors();
      res.json(sectors);
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
      const sectionsList = await storage.getSections(sectorId);
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
      const sectorProducts = await storage.getSectorProducts(sectionId);
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
  app.post("/api/bulk-import/parse", isAuthenticated, upload.single("file"), async (req: any, res) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Žiadny súbor nebol nahraný" });

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
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

      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
      if (!appUser) return res.status(401).json({ message: "Používateľ nenájdený" });

      const companyId = appUser.activeCompanyId;
      const allStatuses = await storage.getContractStatuses();
      const allContracts = await storage.getContracts(companyId ? { companyId } : undefined);
      const allUsers = await storage.getAppUsers();

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
        };

        const contractNumber = mapping.contractNumber ? String(row[mapping.contractNumber] || "").trim() : "";
        const statusName = mapping.status ? String(row[mapping.status] || "").trim() : "";
        const agentName = mapping.agent ? String(row[mapping.agent] || "").trim() : "";
        const commissionStr = mapping.commission ? String(row[mapping.commission] || "").trim() : "";
        const noteText = mapping.note ? String(row[mapping.note] || "").trim() : "";

        result.contractNumber = contractNumber;
        result.statusName = statusName;
        result.agentName = agentName;
        result.commissionStr = commissionStr;
        result.note = noteText;

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

      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
      if (!appUser) return res.status(401).json({ message: "Používateľ nenájdený" });

      const companyId = appUser.activeCompanyId;
      const allStatuses = await storage.getContractStatuses();
      const allContracts = await storage.getContracts(companyId ? { companyId } : undefined);
      const allUsers = await storage.getAppUsers();

      const revalidated: any[] = [];
      for (const row of rows) {
        const result: any = { originalData: row, errors: [], contractId: null, statusId: null, agentId: null, commissionAmount: 0, currentStatusId: null, note: "" };

        const contractNumber = mapping.contractNumber ? String(row[mapping.contractNumber] || "").trim() : "";
        const statusName = mapping.status ? String(row[mapping.status] || "").trim() : "";
        const agentName = mapping.agent ? String(row[mapping.agent] || "").trim() : "";
        const commissionStr = mapping.commission ? String(row[mapping.commission] || "").trim() : "";
        result.note = mapping.note ? String(row[mapping.note] || "").trim() : "";
        result.contractNumber = contractNumber;
        result.statusName = statusName;

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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
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
    <tr><td style="padding: 8px 12px; color: #9ca3af;">Dátum overenia:</td><td style="padding: 8px 12px;">${new Date().toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td></tr>
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

      await logAudit(req, {
        action: "UPDATE",
        module: "subjects",
        entityId: subjectId,
        entityName: existing.uid || `Subject #${subjectId}`,
        oldData: existing,
        newData: updated,
      });
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
      const appUser = await storage.getAppUserByReplitId(req.user.claims.sub);
      if (!appUser) return res.status(401).json({ message: "Unauthorized" });
      
      if (!await checkKlientiSubjectAccess(appUser, subjectId)) {
        return res.status(403).json({ message: "Prístup zamietnutý" });
      }
      
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
        entityName: `GDPR export subjektu #${subjectId}`,
      });
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="gdpr-export-${subject.uid?.replace(/\s/g, '')}-${new Date().toISOString().split('T')[0]}.json"`);
      res.json(legalExport);
    } catch (err: any) {
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

      await logAudit(req, { action: "ADD_POINT", module: "subjekty_bonita", entityId: subjectId, entityName: `${pointType} bod (${points}) pre subjekt #${subject.uid}: ${reason}` });
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

      if (listStatus === "cierny" || listStatus === null) {
        const userPerms = appUser?.permissionGroup;
        const isSuperAdmin = userPerms?.name?.toLowerCase().includes("superadmin") || userPerms?.name?.toLowerCase().includes("prezident");
        if (!isSuperAdmin) {
          return res.status(403).json({ message: "Len SuperAdmin/Prezident môže meniť Čierny zoznam" });
        }
      }

      if (listStatus !== "cerveny" && listStatus !== "cierny" && listStatus !== null) {
        return res.status(400).json({ message: "Neplatný stav zoznamu" });
      }

      const updated = await storage.updateSubjectListStatus(subjectId, listStatus, appUser?.id || 0, reason);

      await logAudit(req, {
        action: "UPDATE",
        module: "subjekty",
        entityId: subjectId,
        entityName: `Zmena listu: ${listStatus || 'zrušený'}`,
        oldData: {},
        newData: { listStatus, reason },
      });

      res.json(updated);
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
      const restoreLog = await storage.restoreFieldValue(subjectId, historyEntryId, appUser.id, userName);
      await logAudit(req, {
        action: "RESTORE",
        module: "subjekty",
        entityId: subjectId,
        entityName: `Obnova hodnoty poľa '${restoreLog.fieldKey}' subjektu #${subjectId}`,
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
      await logAudit(req, { action: "Vytvorenie", module: "Adresy", entityId: created.id, entityName: `Adresa ${addressType} pre subjekt #${subjectId}`, newData: req.body });
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
      await logAudit(req, { action: "Uprava", module: "Adresy", entityId: addressId, entityName: `Adresa ${updated.addressType} pre subjekt #${subjectId}`, newData: req.body });
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
      await logAudit(req, { action: "Vymazanie", module: "Adresy", entityId: addressId, entityName: `Adresa pre subjekt #${subjectId}` });
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
      await logAudit(req, { action: "Uprava", module: "Adresy", entityId: addressId, entityName: `Nastavenie hlavnej adresy pre subjekt #${subjectId}` });
      res.json({ success: true });
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
      await logAudit(req, { action: "ANONYMIZE", module: "subjekty", entityId: subjectId, entityName: `Anonymizácia subjektu #${result.uid}` });
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
      await logAudit(req, { action: "REVEAL", module: "subjekty", entityId: subjectId, entityName: `Odkrytie anonymizovaného subjektu #${subjectId}` });
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
      await logAudit(req, { action: "CREATE", module: "subjekty_collaborators", entityId: collab.id, entityName: `${role} pre subjekt #${subjectId}` });
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
      const appUser = await storage.getAppUserByReplitId(req.user.claims.sub);
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
        entityName: `Náhľad profilu subjektu #${subjectId}`,
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

  await storage.autoArchiveExpiredBindings();
  setInterval(() => storage.autoArchiveExpiredBindings(), 60 * 60 * 1000);

  scheduleUndeliveredContractsCheck();

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
      if (appUser && appUser.activeStateId && contract.stateId && contract.stateId !== appUser.activeStateId && appUser.role !== 'superadmin') {
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
        entityName: found?.name || `Sekcia #${sectionId}`,
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
        entityName: param?.label || `Parameter #${paramId}`,
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);

      const updated = await storage.confirmSynonym(synonymId);

      await storage.createSynonymConfirmationLog({
        synonymId,
        userId: appUser?.id || null,
        username: appUser?.username || req.user?.claims?.email || 'system',
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
        entityName: found?.name || `Šablóna #${templateId}`,
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
        entityName: found?.extractedKey || `Neznáme pole #${fieldId}`,
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
        .where(and(
          eq(contracts.subjectId, subjectId),
          sql`${contracts.isDeleted} = false`,
        ))
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

  // === SUBJECT RELATIONS (Relácie subjektu pre Svätyňu) ===
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

        await logAudit(req, { action: "GRANT_ACCESS", module: "privacy", entityId: grantorSubjectId, entityName: `Súhlas udelený subjektu #${granteeSubjectId}`, newData: { consentType, scope, reason } });
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

        await logAudit(req, { action: "REVOKE_ACCESS", module: "privacy", entityId: grantorSubjectId, entityName: `Súhlas odobraný subjektu #${granteeSubjectId}`, oldData: { consentType }, newData: { reason } });
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
        companyName: r.company.companyName || `Firma #${r.company.id}`,
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
      await logAudit(req, { action: "ASSIGN_ROLE", module: "company_roles", entityId: companySubjectId, entityName: `Rola ${roleLabels[roleType]} priradená subjektu #${personSubjectId}`, newData: { roleType, allowedSections } });
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
        enriched.push({ ...e, subjectName: subj ? `${subj.firstName || ""} ${subj.lastName || ""}`.trim() : `#${e.subjectId}`, subjectUid: subj?.uid });
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
          await db.insert(subjectFieldHistory).values({
            subjectId: targetId,
            fieldKey: fk,
            fieldSource: "inheritance",
            oldValue: oldValues[fk] != null ? String(oldValues[fk]) : null,
            newValue: newValues[fk] != null ? String(newValues[fk]) : null,
            changedByUserId: user?.id,
            changedByName: user?.username || "system",
            changeReason: `Zdedené od rodiča (subjekt #${sourceSubjectId})`,
          });
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
          await db.insert(auditLogs).values({
            username: "ArutsoK System",
            action: "LIFECYCLE_PERMANENT_DELETE",
            module: "zmluvy",
            entityId: contract.id,
            entityName: contract.contractNumber || contract.proposalNumber || `ID ${contract.id}`,
            oldData: contract,
            newData: null,
          });

          await db.delete(contracts).where(eq(contracts.id, contract.id));
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

      if (deleteCount > 0) console.log(`[CRON] Lifecycle permanent delete: ${deleteCount} contracts permanently deleted (dynamic limits)`);
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

  return httpServer;
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
      { continentId: europe.id, name: "Slovensko", code: "421", flagUrl: "https://flagcdn.com/w40/sk.png" },
      { continentId: europe.id, name: "\u010cesko", code: "420", flagUrl: "https://flagcdn.com/w40/cz.png" },
      { continentId: namerica.id, name: "USA", code: "001", flagUrl: "https://flagcdn.com/w40/us.png" },
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
