import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { z } from "zod";
import { continents, states, myCompanies, appUsers, clientTypes, clientSubGroups, clientGroupMembers, productFolderAssignments, folderPanels, panelParameters, clientTypeSections, clientTypeFields, userClientGroupMemberships, clientGroups, permissionGroups, insertCareerLevelSchema, insertProductPointRateSchema, careerLevels } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import multer from "multer";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import { encryptField, decryptField } from "./crypto";

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
      userId: appUser?.id || null,
      username: appUser?.username || req.user?.claims?.email || 'system',
      action: params.action,
      module: params.module,
      entityId: params.entityId || null,
      entityName: params.entityName || null,
      oldData: params.oldData || null,
      newData: params.newData || null,
      processingTimeSec: processingTime,
      ipAddress: typeof ip === 'string' ? ip : JSON.stringify(ip),
    });
  } catch (err) {
    console.error("Audit log error:", err);
  }
}

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(path.join(UPLOADS_DIR, "official"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "work"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "logos"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "amendments"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "profiles"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "flags"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "status-change-docs"), { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const section = (req.params as any).section || (req as any)._uploadSection;
    const validDirs = ["official", "work", "logos", "amendments", "profiles", "flags", "status-change-docs"];
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
  limits: { fileSize: 20 * 1024 * 1024 },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  await setupAuth(app);
  registerAuthRoutes(app);

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

      let effectiveTimeout = 180;
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

      res.json({ ...appUser, effectiveSessionTimeoutSeconds: effectiveTimeout, careerLevel });
    } catch (err) {
      console.error("Error in /api/app-user/me:", err);
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
      if (!appUser) return res.status(404).json({ message: "App user not found" });
      const profile = await storage.getUserProfile(appUser.id);
      if (!profile) return res.status(404).json({ message: "Profile not found" });
      res.json(profile);
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
  function anonymizeSubject(subject: any): any {
    const isCompany = subject.type === "company" || subject.type === "szco";
    return {
      ...subject,
      firstName: subject.firstName ? subject.firstName.charAt(0) + "***" : null,
      lastName: subject.lastName ? subject.lastName.charAt(0) + "***" : null,
      companyName: isCompany && subject.companyName ? subject.companyName.charAt(0) + "***" : subject.companyName,
      email: null,
      phone: null,
      birthNumber: "***",
      idCardNumber: null,
      iban: null,
      swift: null,
      details: {},
      isAnonymized: true,
    };
  }

  app.get(api.subjects.list.path, async (req: any, res) => {
    const appUser = req.appUser;
    const activeCompanyId = appUser?.activeCompanyId || (req.query.activeCompanyId ? Number(req.query.activeCompanyId) : undefined);
    const params = {
      search: req.query.search as string,
      type: req.query.type as 'person' | 'company',
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      myCompanyId: activeCompanyId,
      stateId: appUser?.activeStateId || undefined,
    };
    let allSubjects = await storage.getSubjects(params);

    const statusFiltersRaw = req.query.statusFilters as string | undefined;

    if (statusFiltersRaw) {
      const filters = statusFiltersRaw.split(",").map((f: string) => f.trim());
      allSubjects = allSubjects.filter((s: any) => {
        const status = getSubjectStatusCategory(s, activeCompanyId);
        return filters.includes(status);
      });
    }

    const forContract = req.query.forContract === 'true';
    const isPrivileged = appUser?.role === 'superadmin' || appUser?.role === 'prezident';

    if (appUser?.id) {
      const acquirerSubjectIds = await storage.getSubjectIdsWhereUserIsAcquirer(appUser.id);
      const acquirerSubjectIdSet = new Set(acquirerSubjectIds);

      allSubjects = allSubjects.map((s: any) => {
        const isRegistrator = s.registeredByUserId === appUser.id;
        const isAcquirerOnContract = acquirerSubjectIdSet.has(s.id);
        const isOwner = isRegistrator || isAcquirerOnContract;

        if (forContract && !isPrivileged && !isOwner) {
          return { ...anonymizeSubject(s), isOwner: false, isAnonymized: true };
        }
        return { ...maskSubjectBirthNumber(s, appUser), isOwner: isOwner || isPrivileged, isAnonymized: false };
      });
      res.json(allSubjects);
    } else {
      res.json(allSubjects.map((s: any) => ({ ...maskSubjectBirthNumber(s, appUser), isOwner: true, isAnonymized: false })));
    }
  });

  function getSubjectStatusCategory(subject: any, activeCompanyId?: number): string {
    if (subject.isDeceased) return "deceased";
    if (!subject.isActive) return "inactive";
    if (activeCompanyId && subject.myCompanyId !== activeCompanyId) return "other_company";
    if ((subject.contractCount ?? 0) === 0) return "no_contract";
    return "active";
  }

  app.get(api.subjects.get.path, async (req: any, res) => {
    const subject = await storage.getSubject(Number(req.params.id));
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.json(maskSubjectBirthNumber(subject, req.appUser));
  });

  function canViewBirthNumber(appUser: any): boolean {
    if (!appUser) return false;
    return appUser.role === 'superadmin' || appUser.role === 'prezident';
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
      if (input.birthNumber) {
        input.birthNumber = encryptField(input.birthNumber);
      }
      const created = await storage.createSubject(input);
      await logAudit(req, { action: "CREATE", module: "subjekty", entityId: created.id, entityName: (created.firstName ? created.firstName + ' ' + created.lastName : created.companyName) || undefined, newData: { ...input, birthNumber: input.birthNumber ? '***' : undefined } });
      res.status(201).json(maskSubjectBirthNumber(created, req.appUser));
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
      const isRegistrator = original.registeredByUserId === appUser.id;
      const acquirerSubjectIds = await storage.getSubjectIdsWhereUserIsAcquirer(appUser.id);
      const isAcquirer = acquirerSubjectIds.includes(subjectId);
      const isOwner = isRegistrator || isAcquirer;

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Nemate opravnenie editovat tento subjekt. Iba vlastnik (Ziskatel) alebo Admin moze menit udaje." });
      }

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
        },
      });
      res.json(maskSubjectBirthNumber(updated, appUser));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message === "Subject not found") return res.status(404).json({ message: err.message });
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
  }, upload.array("documents", 10), async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const contractId = Number(req.params.id);
      const contract = await storage.getContract(contractId);
      if (!contract) return res.status(404).json({ message: "Zmluva nenajdena" });

      const { newStatusId, changedAt, visibleToClient, statusNote, parameterValues } = req.body;
      if (!newStatusId) return res.status(400).json({ message: "Novy stav je povinny" });

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

      const docs: any[] = [];
      if (req.files && Array.isArray(req.files)) {
        for (const file of req.files) {
          docs.push({
            id: Date.now().toString() + "-" + Math.random().toString(36).slice(2, 8),
            name: file.originalname,
            url: `/api/files/status-change-docs/${file.filename}`,
            uploadedAt: new Date().toISOString(),
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

      await storage.updateContract(contractId, {
        statusId: Number(newStatusId),
        lastStatusUpdate: new Date(),
      } as any);

      const allStatuses = await storage.getContractStatuses();
      const status = allStatuses.find(s => s.id === Number(newStatusId));
      if (status?.assignsNumber && !contract.globalNumber) {
        const counter = await storage.getNextCounterValue("global_contract_number");
        await storage.updateContract(contractId, { globalNumber: counter } as any);
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
      const result: Record<number, { companies: number[]; visibility: { entityType: string; entityId: number }[] }> = {};
      for (const s of statuses) {
        const companies = await storage.getContractStatusCompanies(s.id);
        const visibility = await storage.getContractStatusVisibility(s.id);
        result[s.id] = {
          companies: companies.map(c => c.companyId),
          visibility: visibility.map(v => ({ entityType: v.entityType, entityId: v.entityId })),
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
      const input = api.contractsApi.create.input.parse(req.body);
      const appUser = req.appUser;
      const createData = { ...input, uploadedByUserId: appUser?.id || null };
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
      (createData as any).globalNumber = nextGlobalNumber;
      const created = await storage.createContract(createData as any);
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

      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(file.path);
      const sheet = workbook.worksheets[0];
      if (!sheet) return res.status(400).json({ message: "Excel neobsahuje žiadny hárok" });

      const allSubjects = await storage.getSubjects();
      const uidMap = new Map<string, typeof allSubjects[0]>();
      for (const s of allSubjects) {
        if (s.uid) uidMap.set(s.uid, s);
      }

      const headers: string[] = [];
      sheet.getRow(1).eachCell((cell, colNumber) => {
        headers[colNumber] = String(cell.value || "").trim().toLowerCase();
      });

      const results: { row: number; status: string; contractId?: number; error?: string }[] = [];
      const appUser = req.appUser;
      const defaultStatus = await storage.getSystemContractStatusByName("Nahrata do systemu");

      for (let rowNum = 2; rowNum <= sheet.rowCount; rowNum++) {
        const row = sheet.getRow(rowNum);
        const rowData: Record<string, string> = {};
        row.eachCell((cell, colNumber) => {
          const header = headers[colNumber];
          if (header) rowData[header] = String(cell.value || "").trim();
        });

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
          let needsManualVerification = false;
          if (klientUidVal && uidMap.has(klientUidVal)) {
            subjectId = uidMap.get(klientUidVal)!.id;
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

          const nextGlobalNumber = await storage.getNextCounterValue("contract_global_number");

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
            statusId: defaultStatus?.id || null,
            globalNumber: nextGlobalNumber,
            uploadedByUserId: appUser?.id || null,
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
          results.push({ row: rowNum, status: "ok", contractId: created.id });
        } catch (rowErr: any) {
          results.push({ row: rowNum, status: "error", error: rowErr.message || "Neznáma chyba" });
        }
      }

      await logAudit(req, { action: "IMPORT", module: "zmluvy", entityName: `Excel import: ${results.filter(r => r.status === 'ok').length} úspešných z ${results.length}` });

      res.json({
        total: results.length,
        success: results.filter(r => r.status === "ok").length,
        errors: results.filter(r => r.status === "error").length,
        details: results,
      });
    } catch (err: any) {
      console.error("Excel import error:", err);
      res.status(500).json({ message: "Chyba pri importe: " + (err.message || "Neznáma chyba") });
    }
  });

  app.put(api.contractsApi.update.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.contractsApi.update.input.parse(req.body);
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
      const updated = await storage.updateContract(Number(req.params.id), input);
      if (input.statusId && input.statusId !== old.statusId) {
        await storage.createContractStatusChangeLog({
          contractId: Number(req.params.id),
          oldStatusId: old.statusId,
          newStatusId: input.statusId,
          changedByUserId: appUser?.id || null,
          parameterValues: {},
        });
      }
      await logAudit(req, { action: "UPDATE", module: "zmluvy", entityId: Number(req.params.id), oldData: old, newData: input });
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
      await storage.saveContractParameterValues(Number(req.params.contractId), values);
      await logAudit(req, { action: "UPDATE", module: "contract_parameter_values", entityId: Number(req.params.contractId), entityName: "parameter values saved" });
      res.json({ success: true });
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

  // === CLIENT TYPE REORDER ===
  app.put("/api/client-types/:typeId/fields/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ message: "Items array required" });
      for (const item of items) {
        await storage.updateClientTypeField(item.id, { sortOrder: item.sortOrder });
      }
      await logAudit(req, { action: "UPDATE", module: "pravidla_typov", entityName: "reorder fields" });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  app.put("/api/client-types/:typeId/sections/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const { items } = req.body;
      if (!Array.isArray(items)) return res.status(400).json({ message: "Items array required" });
      for (const item of items) {
        await storage.updateClientTypeSection(item.id, { sortOrder: item.sortOrder });
      }
      await logAudit(req, { action: "UPDATE", module: "pravidla_typov", entityName: "reorder sections" });
      res.json({ success: true });
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
      const enforcedState = getEnforcedStateId(req);
      const allSubjects = await storage.getSubjects();
      const filtered = allSubjects
        .filter(s => {
          if (enforcedState && s.stateId !== enforcedState) return false;
          const fullName = `${s.firstName || ""} ${s.lastName || ""} ${s.companyName || ""} ${s.uid || ""}`.toLowerCase();
          return fullName.includes(q);
        })
        .slice(0, 20);
      res.json(filtered);
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

      res.json({ companies: deletedCompanies, partners: deletedPartners, products: deletedProducts, contracts: deletedContracts });
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
          return res.status(400).json({ message: "Neznamy typ entity" });
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

      const interventionStatusNames = ["Nedodana / Chybna", "Neprijata - vyhrady", "Treba doplnit tlacivo pre banku", "Čaká na schválenie", "Nedorucena 30 dni"];
      const interventionStatusIds = new Set(
        statuses.filter(s => interventionStatusNames.includes(s.name)).map(s => s.id)
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

  // === CLIENT TYPES (Dynamic Parameter System) ===
  app.get("/api/client-types", isAuthenticated, async (_req, res) => {
    try {
      const types = await storage.getClientTypes();
      const allSections = await db.select().from(clientTypeSections);
      const allFields = await db.select().from(clientTypeFields);
      const sectionCountByType: Record<number, number> = {};
      const fieldCountByType: Record<number, number> = {};
      for (const s of allSections) {
        sectionCountByType[s.clientTypeId] = (sectionCountByType[s.clientTypeId] || 0) + 1;
      }
      for (const f of allFields) {
        fieldCountByType[f.clientTypeId] = (fieldCountByType[f.clientTypeId] || 0) + 1;
      }
      const typesWithCounts = types.map(t => ({
        ...t,
        childCount: (sectionCountByType[t.id] || 0) + (fieldCountByType[t.id] || 0),
      }));
      res.json(typesWithCounts);
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
      const defaultSections = [
        { clientTypeId: created.id, name: "POVINNÉ ÚDAJE", folderCategory: "povinne", sortOrder: 0 },
        { clientTypeId: created.id, name: "DOPLNKOVÉ ÚDAJE", folderCategory: "doplnkove", sortOrder: 1 },
        { clientTypeId: created.id, name: "VOLITEĽNÉ ÚDAJE", folderCategory: "volitelne", sortOrder: 2 },
      ];
      for (const sec of defaultSections) {
        await storage.createClientTypeSection(sec);
      }
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

  // === CLIENT TYPE SECTIONS ===
  app.get("/api/client-types/:typeId/sections", isAuthenticated, async (req, res) => {
    try {
      const sections = await storage.getClientTypeSections(Number(req.params.typeId));
      res.json(sections);
    } catch {
      res.status(500).json({ message: "Failed to get sections" });
    }
  });

  app.post("/api/client-types/:typeId/sections", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const created = await storage.createClientTypeSection({
        ...req.body,
        clientTypeId: Number(req.params.typeId),
      });
      res.json(created);
    } catch {
      res.status(500).json({ message: "Failed to create section" });
    }
  });

  app.patch("/api/client-type-sections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const updated = await storage.updateClientTypeSection(Number(req.params.id), req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update section" });
    }
  });

  app.delete("/api/client-type-sections/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      await storage.deleteClientTypeSection(Number(req.params.id));
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Failed to delete section" });
    }
  });

  // === CLIENT TYPE PANELS ===
  app.get("/api/client-types/:typeId/panels", isAuthenticated, async (req, res) => {
    try {
      const panels = await storage.getClientTypePanels(Number(req.params.typeId));
      res.json(panels);
    } catch {
      res.status(500).json({ message: "Failed to get panels" });
    }
  });

  app.post("/api/client-types/:typeId/panels", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const created = await storage.createClientTypePanel({
        ...req.body,
        clientTypeId: Number(req.params.typeId),
      });
      res.json(created);
    } catch {
      res.status(500).json({ message: "Failed to create panel" });
    }
  });

  app.patch("/api/client-type-panels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const updated = await storage.updateClientTypePanel(Number(req.params.id), req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update panel" });
    }
  });

  app.delete("/api/client-type-panels/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      await storage.deleteClientTypePanel(Number(req.params.id));
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Failed to delete panel" });
    }
  });

  app.put("/api/client-types/:typeId/panels/reorder", isAuthenticated, async (req: any, res) => {
    try {
      const items: { id: number; sortOrder: number }[] = req.body.items;
      for (const item of items) {
        await storage.updateClientTypePanel(item.id, { sortOrder: item.sortOrder });
      }
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Failed to reorder panels" });
    }
  });

  // === CLIENT TYPE FIELDS ===
  app.get("/api/client-types/:typeId/fields", isAuthenticated, async (req, res) => {
    try {
      const fields = await storage.getClientTypeFields(Number(req.params.typeId));
      res.json(fields);
    } catch {
      res.status(500).json({ message: "Failed to get fields" });
    }
  });

  app.post("/api/client-types/:typeId/fields", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const isAllowed = appUser && (["admin", "superadmin", "prezident"].includes(appUser.role) || appUser.permissionGroupId);
      if (!isAllowed) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const created = await storage.createClientTypeField({
        ...req.body,
        clientTypeId: Number(req.params.typeId),
      });
      res.json(created);
    } catch {
      res.status(500).json({ message: "Failed to create field" });
    }
  });

  app.patch("/api/client-type-fields/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const isAllowed = appUser && (["admin", "superadmin", "prezident"].includes(appUser.role) || appUser.permissionGroupId);
      if (!isAllowed) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      const updated = await storage.updateClientTypeField(Number(req.params.id), req.body);
      res.json(updated);
    } catch {
      res.status(500).json({ message: "Failed to update field" });
    }
  });

  app.delete("/api/client-type-fields/:id", isAuthenticated, async (req: any, res) => {
    try {
      const appUser = req.appUser;
      const isAllowed = appUser && (["admin", "superadmin", "prezident"].includes(appUser.role) || appUser.permissionGroupId);
      if (!isAllowed) {
        return res.status(403).json({ message: "Nedostatocne opravnenia" });
      }
      await storage.deleteClientTypeField(Number(req.params.id));
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Failed to delete field" });
    }
  });

  // === DUPLICATE CHECK ===
  app.post("/api/subjects/check-duplicate", isAuthenticated, async (req, res) => {
    try {
      const { birthNumber, ico } = req.body;
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
      } else {
        res.json({ isDuplicate: false });
      }
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

  await seedDatabase();
  await storage.autoArchiveExpiredBindings();
  setInterval(() => storage.autoArchiveExpiredBindings(), 60 * 60 * 1000);

  scheduleUndeliveredContractsCheck();

  return httpServer;
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
}
