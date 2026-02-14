import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { z } from "zod";
import { continents, states, myCompanies, appUsers, clientTypes, clientSubGroups, clientGroupMembers, productFolderAssignments, folderPanels, panelParameters } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import multer from "multer";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";

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

const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const section = (req.params as any).section || (req as any)._uploadSection;
    const validDirs = ["official", "work", "logos", "amendments", "profiles", "flags"];
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
      res.json(appUser);
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
  app.get(api.subjects.list.path, async (req, res) => {
    const params = {
      search: req.query.search as string,
      type: req.query.type as 'person' | 'company',
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
    };
    res.json(await storage.getSubjects(params));
  });

  app.get(api.subjects.get.path, async (req, res) => {
    const subject = await storage.getSubject(Number(req.params.id));
    if (!subject) return res.status(404).json({ message: "Subject not found" });
    res.json(subject);
  });

  app.post(api.subjects.create.path, async (req, res) => {
    try {
      const input = api.subjects.create.input.parse(req.body);
      const created = await storage.createSubject(input);
      await logAudit(req, { action: "CREATE", module: "subjekty", entityId: created.id, entityName: (created.firstName ? created.firstName + ' ' + created.lastName : created.companyName) || undefined, newData: input });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message.includes("hierarchy")) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.put(api.subjects.update.path, async (req, res) => {
    try {
      const input = api.subjects.update.input.parse(req.body);
      const updated = await storage.updateSubject(Number(req.params.id), input);
      await logAudit(req, { action: "UPDATE", module: "subjekty", entityId: Number(req.params.id), newData: input });
      res.json(updated);
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
      const input = api.products.create.input.parse(req.body);

      if (input.partnerId && input.companyId) {
        const contracts = await storage.getPartnerContracts(input.partnerId);
        const hasContract = contracts.some(c => c.companyId === input.companyId);
        if (!hasContract) {
          return res.status(400).json({ message: "Spolocnost nema aktivnu zmluvu s tymto partnerom" });
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
      const input = api.products.update.input.parse(req.body);
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
      await storage.deletePermissionGroup(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "skupiny_pravomoci", entityId: Number(req.params.id) });
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
      // ArutsoK 43 - Protect system statuses from deletion
      const statuses = await storage.getContractStatuses();
      const target = statuses.find(s => s.id === Number(req.params.id));
      if (target?.isSystem) {
        return res.status(400).json({ message: "Systemovy stav nie je mozne vymazat" });
      }
      await storage.deleteContractStatus(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "stavy_zmluv", entityId: Number(req.params.id) });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
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
      await storage.deleteContractTemplate(Number(req.params.id));
      await logAudit(req, { action: "DELETE", module: "sablony_zmluv", entityId: Number(req.params.id) });
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
      for (let i = 0; i < contractIds.length; i++) {
        await storage.updateContract(Number(contractIds[i]), { 
          inventoryId, 
          sortOrderInInventory: i + 1 
        } as any);
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

  // ArutsoK 46 - Phase 2: Accept contracts (Central Office verifies and accepts)
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
      const systemStatus = await storage.getSystemContractStatus();
      if (!systemStatus) {
        return res.status(500).json({ message: "Systemovy stav 'Nahrata do systemu' neexistuje" });
      }
      const registrationNumbers: Record<number, string> = {};
      for (const contractId of contractIds) {
        const contract = await storage.getContract(Number(contractId));
        if (!contract) continue;
        const stateCode = contract.stateId 
          ? (await db.select().from(states).where(eq(states.id, contract.stateId)).limit(1))?.[0]?.code || "000"
          : "000";
        const regSeq = await storage.getNextCounterValue("contract_registration");
        const paddedSeq = regSeq.toString().padStart(12, "0");
        const formatted = `${stateCode} ${paddedSeq.replace(/(\d{3})(?=\d)/g, "$1 ")}`;
        registrationNumbers[Number(contractId)] = formatted;
        await storage.updateContract(Number(contractId), { 
          statusId: systemStatus.id,
          registrationNumber: formatted 
        } as any);
      }
      const allContractsInInventory = await storage.getContracts({ inventoryId });
      const allAccepted = allContractsInInventory.every(c => 
        contractIds.includes(c.id) || c.statusId === systemStatus.id
      );
      if (allAccepted) {
        await storage.updateContractInventory(inventoryId, { isAccepted: true } as any);
      }
      await logAudit(req, {
        action: "UPDATE",
        module: "sprievodka_accept",
        entityId: inventoryId,
        entityName: target.name,
        newData: { contractIds, statusId: systemStatus.id, allAccepted, registrationNumbers },
      });
      res.json({ success: true, acceptedCount: contractIds.length, allAccepted, registrationNumbers });
    } catch (err) {
      console.error("Accept error:", err);
      res.status(500).json({ message: "Internal error" });
    }
  });

  // ArutsoK 45 - Get dispatched contracts (pending acceptance)
  app.get("/api/contracts/dispatched", isAuthenticated, async (_req: any, res) => {
    try {
      const dispatched = await storage.getDispatchedContracts();
      res.json(dispatched);
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
  app.get(api.contractsApi.list.path, isAuthenticated, async (req: any, res) => {
    const filters = {
      stateId: getEnforcedStateId(req),
      statusId: req.query.statusId ? parseInt(req.query.statusId as string) : undefined,
      inventoryId: req.query.inventoryId ? parseInt(req.query.inventoryId as string) : undefined,
      includeDeleted: req.query.includeDeleted === 'true',
      // ArutsoK 43 - Filter for unprocessed contracts (Evidencia zmluv)
      unprocessed: req.query.unprocessed === 'true',
    };
    res.json(await storage.getContracts(filters));
  });

  app.get(api.contractsApi.get.path, isAuthenticated, async (req: any, res) => {
    const contract = await storage.getContract(Number(req.params.id));
    if (!contract) return res.status(404).json({ message: "Contract not found" });
    const appUser = req.appUser;
    if (appUser && appUser.activeStateId && contract.stateId && contract.stateId !== appUser.activeStateId && appUser.role !== 'superadmin') {
      return res.status(403).json({ message: "Pristup k zmluve z ineho statu nie je povoleny" });
    }
    res.json(contract);
  });

  app.post(api.contractsApi.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const input = api.contractsApi.create.input.parse(req.body);
      const appUser = req.appUser;
      if (appUser && appUser.activeStateId && input.stateId && input.stateId !== appUser.activeStateId) {
        if (appUser.role !== 'superadmin') {
          return res.status(400).json({ message: "Zmluva musi patrit do aktivneho statu" });
        }
      }
      const created = await storage.createContract(input);
      await logAudit(req, { action: "CREATE", module: "zmluvy", entityId: created.id, entityName: created.contractNumber || `Zmluva #${created.id}`, newData: input });
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Internal error" });
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
      const updated = await storage.updateContract(Number(req.params.id), input);
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
        { header: "KIK ID", key: "kikId", width: 18 },
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
          kikId: (c as any).uid || c.id.toString(),
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

      const headers = ["KIK ID", "Meno klienta", "Partner", "Produkt", "Cislo zmluvy", "Suma poistneho", "Datum podpisu"];
      const rows = contractList.map(c => {
        const subject = subjects.find(s => s.id === c.subjectId);
        const partner = partnersData.find(p => p.id === c.partnerId);
        const product = productsData.find(p => p.id === c.productId);
        return [
          (c as any).uid || c.id.toString(),
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
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
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
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
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
      if (!appUser || !["admin", "superadmin"].includes(appUser.role)) {
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
            name: existing.type === 'person'
              ? `${existing.firstName} ${existing.lastName}`
              : existing.companyName,
            type: existing.type,
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

  await seedDatabase();
  await storage.autoArchiveExpiredBindings();
  setInterval(() => storage.autoArchiveExpiredBindings(), 60 * 60 * 1000);
  return httpServer;
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
