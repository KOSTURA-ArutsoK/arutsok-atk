import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// === GLOBAL HIERARCHY ===
export const continents = pgTable("continents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // e.g., "01"
});

export const states = pgTable("states", {
  id: serial("id").primaryKey(),
  continentId: integer("continent_id").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(), // e.g., "421"
  flagUrl: text("flag_url"),
});

// === MY FIRMS & PARTNERS ===
export const myCompanies = pgTable("my_companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  specialization: text("specialization").notNull(), // SFA, Reality, Weapons
  code: text("code").notNull(), // e.g., "01" for UID generation
});

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contractFiles: jsonb("contract_files").$type<string[]>().default([]), // URLs to files
});

// === COMMUNICATION MATRIX ===
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => partners.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'internal', 'external'
  securityLevel: integer("security_level").default(1), // 1-4
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  email: text("email"),
  phone: text("phone"),
});

// === SUBJECTS (CORE INTEGRITY) ===
// Unique ID Format: 01-01-421-000 000 000 000
// We store the components to generate it dynamically or store the string.
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  type: text("type").notNull(), // 'person', 'company'
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  
  // Hierarchy
  continentId: integer("continent_id").references(() => continents.id),
  stateId: integer("state_id").references(() => states.id),
  myCompanyId: integer("my_company_id").references(() => myCompanies.id),
  
  details: jsonb("details").default({}), // Address, IBAN, etc.
  
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subjectArchive = pgTable("subject_archive", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id").notNull(), // Link to current subject
  uid: text("uid").notNull(),
  data: jsonb("data").notNull(), // Snapshot of the subject data before change
  archivedAt: timestamp("archived_at").defaultNow(),
  reason: text("reason"),
});

// === PRODUCTS & COMMISSIONS ===
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => myCompanies.id),
  stateId: integer("state_id").references(() => states.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  allowedSpecialists: text("allowed_specialists").array(), // ['SDS', 'PaZ']
});

export const commissionSchemes = pgTable("commission_schemes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to"),
  
  type: text("type").notNull(), // 'points', 'percent', 'fix'
  value: integer("value").notNull(), // Base value or percentage
  coefficient: integer("coefficient"), // For points type
  currency: text("currency").default('EUR'),
});

// === USERS & SECURITY ===
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  replitId: text("replit_id").unique(), // For Replit Auth
  username: text("username").notNull().unique(),
  password: text("password"), // Added for legacy/admin login
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").default('user'), // admin, manager, agent
  allowedCompanyIds: integer("allowed_company_ids").array(),
  securityLevel: integer("security_level").default(1),
  adminCode: text("admin_code"), // 4-digit code for sensitive operations
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const subjectsRelations = relations(subjects, ({ one, many }) => ({
  continent: one(continents, { fields: [subjects.continentId], references: [continents.id] }),
  state: one(states, { fields: [subjects.stateId], references: [states.id] }),
  company: one(myCompanies, { fields: [subjects.myCompanyId], references: [myCompanies.id] }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  company: one(myCompanies, { fields: [products.companyId], references: [myCompanies.id] }),
  state: one(states, { fields: [products.stateId], references: [states.id] }),
}));

// === ZOD SCHEMAS ===
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, uid: true, createdAt: true });
export const insertMyCompanySchema = createInsertSchema(myCompanies).omit({ id: true });
export const insertPartnerSchema = createInsertSchema(partners).omit({ id: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertCommissionSchemeSchema = createInsertSchema(commissionSchemes).omit({ id: true });

// === EXPLICIT TYPES ===
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type MyCompany = typeof myCompanies.$inferSelect;
export type Partner = typeof partners.$inferSelect;
export type Product = typeof products.$inferSelect;
export type CommissionScheme = typeof commissionSchemes.$inferSelect;
export type Contact = typeof contacts.$inferSelect;

export type CreateSubjectRequest = InsertSubject;
export type UpdateSubjectRequest = Partial<InsertSubject> & { changeReason?: string };
