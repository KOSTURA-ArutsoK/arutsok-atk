import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { z } from "zod";
import { continents, states, myCompanies } from "@shared/schema"; // For seeding
import { db } from "./db";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Auth Setup
  await setupAuth(app);
  registerAuthRoutes(app);

  // === HIERARCHY ===
  app.get(api.hierarchy.continents.path, async (req, res) => {
    const continents = await storage.getContinents();
    res.json(continents);
  });

  app.get(api.hierarchy.states.path, async (req, res) => {
    const continentId = req.query.continentId ? parseInt(req.query.continentId as string) : undefined;
    const states = await storage.getStates(continentId);
    res.json(states);
  });

  // === MY COMPANIES ===
  app.get(api.myCompanies.list.path, async (req, res) => {
    const list = await storage.getMyCompanies();
    res.json(list);
  });

  app.post(api.myCompanies.create.path, async (req, res) => {
    try {
      const input = api.myCompanies.create.input.parse(req.body);
      const created = await storage.createMyCompany(input);
      res.status(201).json(created);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // === PARTNERS ===
  app.get(api.partners.list.path, async (req, res) => {
    const list = await storage.getPartners();
    res.json(list);
  });
  
  app.post(api.partners.create.path, async (req, res) => {
    try {
      const input = api.partners.create.input.parse(req.body);
      const created = await storage.createPartner(input);
      res.status(201).json(created);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
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
    const list = await storage.getSubjects(params);
    res.json(list);
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
      res.status(201).json(created);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      // Check for specific logic errors (e.g. missing hierarchy)
      if (err instanceof Error && err.message.includes("hierarchy")) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  });

  app.put(api.subjects.update.path, async (req, res) => {
    try {
      const input = api.subjects.update.input.parse(req.body);
      const updated = await storage.updateSubject(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error && err.message === "Subject not found") {
        return res.status(404).json({ message: err.message });
      }
      throw err;
    }
  });
  
  app.post(api.subjects.archive.path, async (req, res) => {
    try {
      const { reason } = req.body;
      await storage.archiveSubject(Number(req.params.id), reason);
      res.json({ success: true });
    } catch (err) {
      if (err instanceof Error && err.message === "Subject not found") {
        return res.status(404).json({ message: err.message });
      }
      throw err;
    }
  });

  // === PRODUCTS & COMMISSIONS ===
  app.get(api.products.list.path, async (req, res) => {
    const list = await storage.getProducts();
    res.json(list);
  });
  
  app.post(api.products.create.path, async (req, res) => {
    try {
      const input = api.products.create.input.parse(req.body);
      const created = await storage.createProduct(input);
      res.status(201).json(created);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.commissions.list.path, async (req, res) => {
    const productId = req.query.productId ? parseInt(req.query.productId as string) : undefined;
    const list = await storage.getCommissions(productId);
    res.json(list);
  });
  
  app.post(api.commissions.create.path, async (req, res) => {
    try {
      const input = api.commissions.create.input.parse(req.body);
      const created = await storage.createCommission(input);
      res.status(201).json(created);
    } catch (err) {
       if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

// Helper to seed data
export async function seedDatabase() {
  const existingContinents = await storage.getContinents();
  if (existingContinents.length === 0) {
    const [europe] = await db.insert(continents).values({ name: "Europa", code: "01" }).returning();
    const [namerica] = await db.insert(continents).values({ name: "Severná Amerika", code: "02" }).returning();
    
    // States
    const [slovakia] = await db.insert(states).values([
      { continentId: europe.id, name: "Slovensko", code: "421", flagUrl: "https://flagcdn.com/w40/sk.png" },
      { continentId: europe.id, name: "Česko", code: "420", flagUrl: "https://flagcdn.com/w40/cz.png" },
      { continentId: namerica.id, name: "USA", code: "001", flagUrl: "https://flagcdn.com/w40/us.png" },
    ]).returning();
    
    // My Company
    const [company] = await db.insert(myCompanies).values([
      { name: "My Security Firm", specialization: "Weapons", code: "01" },
      { name: "My Reality Corp", specialization: "Reality", code: "02" },
    ]).returning();

    // SuperAdmin User
    await db.insert(users).values({
      username: "admin",
      password: "password123", // Temporary password
      firstName: "Super",
      lastName: "Admin",
      role: "admin",
      securityLevel: 4,
      adminCode: "1234",
      allowedCompanyIds: [company.id]
    });

    // Create the SuperAdmin Subject
    await storage.createSubject({
      type: "person",
      firstName: "Super",
      lastName: "Admin",
      continentId: europe.id,
      stateId: slovakia.id,
      myCompanyId: company.id,
      isActive: true,
      details: { role: "SuperAdmin" }
    });
  }
}
