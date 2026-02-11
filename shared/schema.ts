import { pgTable, text, serial, integer, boolean, timestamp, jsonb, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

// === GLOBAL HIERARCHY ===
export const continents = pgTable("continents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
});

export const states = pgTable("states", {
  id: serial("id").primaryKey(),
  continentId: integer("continent_id").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  flagUrl: text("flag_url"),
});

// === MY FIRMS (expanded with full CRUD fields) ===
export const myCompanies = pgTable("my_companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  specialization: text("specialization").notNull(),
  code: text("code").notNull(),
  ico: text("ico"),
  dic: text("dic"),
  icDph: text("ic_dph"),
  street: text("street"),
  streetNumber: text("street_number"),
  orientNumber: text("orient_number"),
  postalCode: text("postal_code"),
  city: text("city"),
  stateId: integer("state_id"),
  description: text("description"),
  notes: text("notes"),
  officialDocs: jsonb("official_docs").$type<{name: string, url: string, uploadedAt: string}[]>().default([]),
  workDocs: jsonb("work_docs").$type<{name: string, url: string, uploadedAt: string}[]>().default([]),
  processingTimeSec: integer("processing_time_sec").default(0),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  contractFiles: jsonb("contract_files").$type<string[]>().default([]),
});

// === COMMUNICATION MATRIX ===
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => partners.id),
  name: text("name").notNull(),
  type: text("type").notNull(),
  securityLevel: integer("security_level").default(1),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  email: text("email"),
  phone: text("phone"),
});

// === SUBJECTS (CORE INTEGRITY) ===
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  uid: text("uid").notNull().unique(),
  type: text("type").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  continentId: integer("continent_id").references(() => continents.id),
  stateId: integer("state_id").references(() => states.id),
  myCompanyId: integer("my_company_id").references(() => myCompanies.id),
  details: jsonb("details").default({}),
  processingTimeSec: integer("processing_time_sec").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const subjectArchive = pgTable("subject_archive", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id").notNull(),
  uid: text("uid").notNull(),
  data: jsonb("data").notNull(),
  archivedAt: timestamp("archived_at").defaultNow(),
  reason: text("reason"),
});

// === COMPANY ARCHIVE ===
export const companyArchive = pgTable("company_archive", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id").notNull(),
  data: jsonb("data").notNull(),
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
  allowedSpecialists: text("allowed_specialists").array(),
});

export const commissionSchemes = pgTable("commission_schemes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to"),
  type: text("type").notNull(),
  value: integer("value").notNull(),
  coefficient: integer("coefficient"),
  currency: text("currency").default('EUR'),
});

// === APP USERS & SECURITY (CRM-specific users, separate from Replit Auth users) ===
export const appUsers = pgTable("app_users", {
  id: serial("id").primaryKey(),
  replitId: text("replit_id").unique(),
  username: text("username").notNull().unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: text("role").default('user'),
  allowedCompanyIds: integer("allowed_company_ids").array(),
  securityLevel: integer("security_level").default(1),
  adminCode: text("admin_code"),
  activeCompanyId: integer("active_company_id"),
  activeStateId: integer("active_state_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const subjectsRelations = relations(subjects, ({ one }) => ({
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
export const insertMyCompanySchema = createInsertSchema(myCompanies).omit({ id: true, createdAt: true, updatedAt: true, isDeleted: true });
export const insertPartnerSchema = createInsertSchema(partners).omit({ id: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertCommissionSchemeSchema = createInsertSchema(commissionSchemes).omit({ id: true });

// === EXPLICIT TYPES ===
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type MyCompany = typeof myCompanies.$inferSelect;
export type InsertMyCompany = z.infer<typeof insertMyCompanySchema>;
export type Partner = typeof partners.$inferSelect;
export type Product = typeof products.$inferSelect;
export type CommissionScheme = typeof commissionSchemes.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type AppUser = typeof appUsers.$inferSelect;

export type CreateSubjectRequest = InsertSubject;
export type UpdateSubjectRequest = Partial<InsertSubject> & { changeReason?: string };
export type UpdateMyCompanyRequest = Partial<InsertMyCompany> & { changeReason?: string };
