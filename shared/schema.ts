import { pgTable, text, serial, integer, boolean, timestamp, jsonb, bigint } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export type LogoEntry = { name: string; url: string; uploadedAt: string; isPrimary: boolean; isArchived: boolean };
export type DocEntry = { name: string; url: string; uploadedAt: string };

// === GLOBAL COUNTER (for 12-digit UID generation) ===
export const globalCounters = pgTable("global_counters", {
  id: serial("id").primaryKey(),
  counterName: text("counter_name").notNull().unique(),
  currentValue: bigint("current_value", { mode: "number" }).notNull().default(0),
});

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

// === MY FIRMS ===
export const myCompanies = pgTable("my_companies", {
  id: serial("id").primaryKey(),
  uid: text("uid"),
  name: text("name").notNull(),
  specialization: text("specialization").notNull(),
  code: text("code").notNull(),
  ico: text("ico"),
  dic: text("dic"),
  icDph: text("ic_dph"),
  logos: jsonb("logos").$type<LogoEntry[]>().default([]),
  businessActivities: jsonb("business_activities").$type<string[]>().default([]),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at"),
  deletedFromIp: text("deleted_from_ip"),
  street: text("street"),
  streetNumber: text("street_number"),
  orientNumber: text("orient_number"),
  postalCode: text("postal_code"),
  city: text("city"),
  stateId: integer("state_id"),
  description: text("description"),
  notes: text("notes"),
  officialDocs: jsonb("official_docs").$type<DocEntry[]>().default([]),
  workDocs: jsonb("work_docs").$type<DocEntry[]>().default([]),
  processingTimeSec: integer("processing_time_sec").default(0),
  isDeleted: boolean("is_deleted").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === COMPANY OFFICERS (Konatelia / Vlastnici) ===
export const companyOfficers = pgTable("company_officers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => myCompanies.id),
  type: text("type").notNull(),
  titleBefore: text("title_before"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  titleAfter: text("title_after"),
  subjectId: integer("subject_id"),
  ownerCompanyId: integer("owner_company_id"),
  ownerCompanyName: text("owner_company_name"),
  share: text("share"),
  street: text("street"),
  streetNumber: text("street_number"),
  orientNumber: text("orient_number"),
  postalCode: text("postal_code"),
  city: text("city"),
  stateId: integer("state_id"),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// === PARTNERS (External business partners) ===
export const partners = pgTable("partners", {
  id: serial("id").primaryKey(),
  uid: text("uid"),
  name: text("name").notNull(),
  code: text("code"),
  collaborationDate: timestamp("collaboration_date"),
  logos: jsonb("logos").$type<LogoEntry[]>().default([]),
  notes: text("notes"),
  isDeleted: boolean("is_deleted").default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at"),
  deletedFromIp: text("deleted_from_ip"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === PARTNER-COMPANY CONTRACTS ===
export const partnerContracts = pgTable("partner_contracts", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  companyId: integer("company_id").notNull().references(() => myCompanies.id),
  contractNumber: text("contract_number"),
  signedDate: timestamp("signed_date"),
  contractFile: jsonb("contract_file").$type<DocEntry | null>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === PARTNER CONTACTS (External) ===
export const partnerContacts = pgTable("partner_contacts", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  titleBefore: text("title_before"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  titleAfter: text("title_after"),
  position: text("position"),
  phone: text("phone"),
  email: text("email"),
  other: text("other"),
  isPrimary: boolean("is_primary").default(false),
  subjectId: integer("subject_id"),
  securityLevel: integer("security_level").default(1),
  allProducts: boolean("all_products").default(false),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// === PARTNER PRODUCTS ===
export const partnerProducts = pgTable("partner_products", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  productType: text("product_type").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === CONTACT-PRODUCT ASSIGNMENTS ===
export const contactProductAssignments = pgTable("contact_product_assignments", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").notNull().references(() => partnerContacts.id),
  productId: integer("product_id").notNull().references(() => partnerProducts.id),
});

// === COMMUNICATION MATRIX (Partner <-> Company mapping) ===
export const communicationMatrix = pgTable("communication_matrix", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  companyId: integer("company_id").notNull().references(() => myCompanies.id),
  externalContactId: integer("external_contact_id").references(() => partnerContacts.id),
  internalSubjectId: integer("internal_subject_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === COMPANY INTERNAL CONTACTS ===
export const companyContacts = pgTable("company_contacts", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => myCompanies.id),
  subjectId: integer("subject_id"),
  contactType: text("contact_type").notNull(),
  securityLevel: integer("security_level").default(1),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// === LEGACY CONTACTS (keep for backward compat) ===
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

// === CONTRACT AMENDMENTS (Dodatky k zmluvam) ===
export const contractAmendments = pgTable("contract_amendments", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => partnerContracts.id),
  name: text("name").notNull(),
  effectiveDate: timestamp("effective_date").notNull(),
  file: jsonb("file").$type<DocEntry | null>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// === USER PROFILES ===
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  appUserId: integer("app_user_id").references(() => appUsers.id),
  subjectId: integer("subject_id"),
  photoUrl: text("photo_url"),
  photoOriginalName: text("photo_original_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === COMPANY ARCHIVE ===
export const companyArchive = pgTable("company_archive", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id").notNull(),
  data: jsonb("data").notNull(),
  archivedAt: timestamp("archived_at").defaultNow(),
  reason: text("reason"),
});

// === PRODUCTS & COMMISSIONS (legacy, kept for backward compat) ===
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

// === APP USERS & SECURITY ===
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

export const partnerContactsRelations = relations(partnerContacts, ({ one }) => ({
  partner: one(partners, { fields: [partnerContacts.partnerId], references: [partners.id] }),
}));

export const partnerProductsRelations = relations(partnerProducts, ({ one }) => ({
  partner: one(partners, { fields: [partnerProducts.partnerId], references: [partners.id] }),
}));

export const companyOfficersRelations = relations(companyOfficers, ({ one }) => ({
  company: one(myCompanies, { fields: [companyOfficers.companyId], references: [myCompanies.id] }),
}));

// === ZOD SCHEMAS ===
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, uid: true, createdAt: true });
export const insertMyCompanySchema = createInsertSchema(myCompanies).omit({ id: true, createdAt: true, updatedAt: true, isDeleted: true, uid: true, deletedBy: true, deletedAt: true, deletedFromIp: true });
export const insertPartnerSchema = createInsertSchema(partners).omit({ id: true, createdAt: true, updatedAt: true, isDeleted: true, uid: true, deletedBy: true, deletedAt: true, deletedFromIp: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true });
export const insertCommissionSchemeSchema = createInsertSchema(commissionSchemes).omit({ id: true });
export const insertCompanyOfficerSchema = createInsertSchema(companyOfficers).omit({ id: true, createdAt: true });
export const insertPartnerContactSchema = createInsertSchema(partnerContacts).omit({ id: true, createdAt: true });
export const insertPartnerProductSchema = createInsertSchema(partnerProducts).omit({ id: true, createdAt: true });
export const insertPartnerContractSchema = createInsertSchema(partnerContracts).omit({ id: true, createdAt: true });
export const insertCommunicationMatrixSchema = createInsertSchema(communicationMatrix).omit({ id: true, createdAt: true });
export const insertCompanyContactSchema = createInsertSchema(companyContacts).omit({ id: true, createdAt: true });
export const insertContractAmendmentSchema = createInsertSchema(contractAmendments).omit({ id: true, createdAt: true });
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true, createdAt: true, updatedAt: true });

// === EXPLICIT TYPES ===
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type MyCompany = typeof myCompanies.$inferSelect;
export type InsertMyCompany = z.infer<typeof insertMyCompanySchema>;
export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Product = typeof products.$inferSelect;
export type CommissionScheme = typeof commissionSchemes.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type AppUser = typeof appUsers.$inferSelect;
export type CompanyOfficer = typeof companyOfficers.$inferSelect;
export type InsertCompanyOfficer = z.infer<typeof insertCompanyOfficerSchema>;
export type PartnerContact = typeof partnerContacts.$inferSelect;
export type InsertPartnerContact = z.infer<typeof insertPartnerContactSchema>;
export type PartnerProduct = typeof partnerProducts.$inferSelect;
export type InsertPartnerProduct = z.infer<typeof insertPartnerProductSchema>;
export type PartnerContract = typeof partnerContracts.$inferSelect;
export type InsertPartnerContract = z.infer<typeof insertPartnerContractSchema>;
export type CommunicationMatrixEntry = typeof communicationMatrix.$inferSelect;
export type CompanyContact = typeof companyContacts.$inferSelect;
export type ContractAmendment = typeof contractAmendments.$inferSelect;
export type InsertContractAmendment = z.infer<typeof insertContractAmendmentSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export type CreateSubjectRequest = InsertSubject;
export type UpdateSubjectRequest = Partial<InsertSubject> & { changeReason?: string };
export type UpdateMyCompanyRequest = Partial<InsertMyCompany> & { changeReason?: string };
export type UpdatePartnerRequest = Partial<InsertPartner> & { changeReason?: string };
