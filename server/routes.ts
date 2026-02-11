import type { Express } from "express";
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

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
fs.mkdirSync(path.join(UPLOADS_DIR, "official"), { recursive: true });
fs.mkdirSync(path.join(UPLOADS_DIR, "work"), { recursive: true });

const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const section = (req.params as any).section === "work" ? "work" : "official";
    cb(null, path.join(UPLOADS_DIR, section));
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

  // === APP USER (links Replit auth user to CRM user) ===
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
      const replitUserId = req.user?.claims?.sub;
      const appUser = await storage.getAppUserByReplitId(replitUserId);
      if (!appUser) return res.status(404).json({ message: "User not found" });
      
      const { activeCompanyId, activeStateId } = req.body;
      const updated = await storage.updateAppUser(appUser.id, { activeCompanyId, activeStateId });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Internal error" });
    }
  });

  // === HIERARCHY ===
  app.get(api.hierarchy.continents.path, async (req, res) => {
    res.json(await storage.getContinents());
  });

  app.get(api.hierarchy.states.path, async (req, res) => {
    const continentId = req.query.continentId ? parseInt(req.query.continentId as string) : undefined;
    res.json(await storage.getStates(continentId));
  });

  // === MY COMPANIES ===
  app.get(api.myCompanies.list.path, isAuthenticated, async (req, res) => {
    res.json(await storage.getMyCompanies());
  });

  app.get(api.myCompanies.get.path, isAuthenticated, async (req, res) => {
    const company = await storage.getMyCompany(Number(req.params.id));
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json(company);
  });

  app.post(api.myCompanies.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.myCompanies.create.input.parse(req.body);
      const created = await storage.createMyCompany(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  app.put(api.myCompanies.update.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.myCompanies.update.input.parse(req.body);
      const updated = await storage.updateMyCompany(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message === "Company not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  app.delete(api.myCompanies.delete.path, isAuthenticated, async (req, res) => {
    try {
      await storage.softDeleteMyCompany(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error && err.message === "Company not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  // === PARTNERS ===
  app.get(api.partners.list.path, async (req, res) => {
    res.json(await storage.getPartners());
  });
  
  app.post(api.partners.create.path, async (req, res) => {
    try {
      const input = api.partners.create.input.parse(req.body);
      res.status(201).json(await storage.createPartner(input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
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
      res.status(201).json(await storage.createSubject(input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message.includes("hierarchy")) return res.status(400).json({ message: err.message });
      throw err;
    }
  });

  app.put(api.subjects.update.path, async (req, res) => {
    try {
      const input = api.subjects.update.input.parse(req.body);
      res.json(await storage.updateSubject(Number(req.params.id), input));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      if (err instanceof Error && err.message === "Subject not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });
  
  app.post(api.subjects.archive.path, async (req, res) => {
    try {
      await storage.archiveSubject(Number(req.params.id), req.body.reason);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error && err.message === "Subject not found") return res.status(404).json({ message: err.message });
      throw err;
    }
  });

  // === PRODUCTS & COMMISSIONS ===
  app.get(api.products.list.path, async (req, res) => { res.json(await storage.getProducts()); });
  app.post(api.products.create.path, async (req, res) => {
    try {
      res.status(201).json(await storage.createProduct(api.products.create.input.parse(req.body)));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });
  app.get(api.commissions.list.path, async (req, res) => {
    const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
    res.json(await storage.getCommissions(productId));
  });
  app.post(api.commissions.create.path, async (req, res) => {
    try {
      res.status(201).json(await storage.createCommission(api.commissions.create.input.parse(req.body)));
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      throw err;
    }
  });

  // === FILE UPLOAD / DOWNLOAD / DELETE ===
  app.post("/api/my-companies/:companyId/files/:section", isAuthenticated, upload.single("file"), async (req, res) => {
    try {
      const companyId = Number(req.params.companyId);
      const section = req.params.section as "official" | "work";
      if (!["official", "work"].includes(section)) return res.status(400).json({ message: "Invalid section" });

      const company = await storage.getMyCompany(companyId);
      if (!company) return res.status(404).json({ message: "Company not found" });

      const file = req.file;
      if (!file) return res.status(400).json({ message: "No file uploaded" });

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
    } catch (err) {
      console.error("File upload error:", err);
      res.status(500).json({ message: "Upload failed" });
    }
  });

  app.get("/api/files/:section/:filename", isAuthenticated, (req, res) => {
    const { section, filename } = req.params;
    if (!["official", "work"].includes(section)) return res.status(400).json({ message: "Invalid section" });
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

  await seedDatabase();
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
