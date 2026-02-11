import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { z } from "zod";
import { continents, states, myCompanies, appUsers } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import multer from "multer";
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

const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const section = (req.params as any).section || (req as any)._uploadSection;
    const validDirs = ["official", "work", "logos", "amendments", "profiles"];
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

  // === AUDIT LOGS ===
  app.get(api.auditLogs.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const filters = {
        userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
        module: req.query.module as string || undefined,
        action: req.query.action as string || undefined,
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

  // === PERMISSION GROUPS ===
  app.get(api.permissionGroups.list.path, isAuthenticated, async (_req, res) => {
    res.json(await storage.getPermissionGroups());
  });

  app.post(api.permissionGroups.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.permissionGroups.create.input.parse(req.body);
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
    if (!["official", "work", "logos", "amendments", "profiles"].includes(section)) return res.status(400).json({ message: "Invalid section" });
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

  // === ARCHIVE MODULE ===
  app.get("/api/archive/deleted", isAuthenticated, async (_req, res) => {
    try {
      const allCompanies = await storage.getMyCompanies(true);
      const allPartners = await storage.getPartners(true);
      const allProducts = await storage.getProducts(true);

      const deletedCompanies = allCompanies.filter(c => c.isDeleted).map(c => ({
        ...c, entityType: "company" as const,
      }));
      const deletedPartners = allPartners.filter(p => p.isDeleted).map(p => ({
        ...p, entityType: "partner" as const,
      }));
      const deletedProducts = allProducts.filter(p => p.isDeleted).map(p => ({
        ...p, entityType: "product" as const,
      }));

      res.json({ companies: deletedCompanies, partners: deletedPartners, products: deletedProducts });
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
        default:
          return res.status(400).json({ message: "Neznamy typ entity" });
      }

      await logAudit(req, {
        action: "RESTORE",
        module: "archiv",
        entityId: numId,
        entityName: `${entityType} #${numId}`,
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

        console.log(`[MFA] SMS code for subject ${client.id}: ${smsCode}`);
        console.log(`[MFA] Email code for subject ${client.id}: ${emailCode}`);

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
}
