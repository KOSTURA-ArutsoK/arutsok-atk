import { pgTable, text, serial, integer, boolean, timestamp, jsonb, bigint, numeric, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export * from "./models/auth";

export type LogoEntry = { name: string; url: string; uploadedAt: string; isPrimary: boolean; isArchived: boolean };
export type DocEntry = { name: string; url: string; uploadedAt: string; fileHash?: string; fileSize?: number };

export type DocumentEntry = {
  id: string;
  documentType: string;
  customDocType?: string;
  documentNumber: string;
  validUntil?: string;
  issuedBy?: string;
  issuingAuthorityCode?: string;
};

export type ContactEntry = {
  id: string;
  type: "phone" | "email";
  value: string;
  label?: string;
  isPrimary?: boolean;
};

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
  specialization: text("specialization"),
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
  collaborationDate: timestamp("collaboration_date"),
  logos: jsonb("logos").$type<LogoEntry[]>().default([]),
  notes: text("notes"),
  processingTimeSec: integer("processing_time_sec").default(0),
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
  linkedFoId: integer("linked_fo_id"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  continentId: integer("continent_id").references(() => continents.id),
  stateId: integer("state_id").references(() => states.id),
  myCompanyId: integer("my_company_id").references(() => myCompanies.id),
  email: text("email"),
  phone: text("phone"),
  birthNumber: text("birth_number"),
  idCardNumber: text("id_card_number"),
  kikId: text("kik_id"),
  iban: text("iban"),
  swift: text("swift"),
  commissionLevel: integer("commission_level"),
  details: jsonb("details").default({}),
  uiPreferences: jsonb("ui_preferences").$type<{ summary_fields: Record<string, boolean> }>().default({ summary_fields: {} }),
  processingTimeSec: integer("processing_time_sec").default(0),
  isActive: boolean("is_active").default(true),
  isDeceased: boolean("is_deceased").default(false),
  listStatus: text("list_status").$type<"cerveny" | "cierny" | null>(),
  listStatusChangedBy: integer("list_status_changed_by").references(() => appUsers.id),
  listStatusChangedAt: timestamp("list_status_changed_at"),
  listStatusReason: text("list_status_reason"),
  bonitaPoints: integer("bonita_points").default(0),
  cgnRating: text("cgn_rating"),
  registeredByUserId: integer("registered_by_user_id").references(() => appUsers.id),
  isAnonymized: boolean("is_anonymized").default(false),
  anonymizedAt: timestamp("anonymized_at"),
  anonymizedByUserId: integer("anonymized_by_user_id").references(() => appUsers.id),
  anonymizedData: text("anonymized_data"),
  supplementaryIndex: text("supplementary_index"),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const subjectArchive = pgTable("subject_archive", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id").notNull(),
  uid: text("uid").notNull(),
  data: jsonb("data").notNull(),
  archivedAt: timestamp("archived_at").defaultNow(),
  reason: text("reason"),
});

// === CLIENT DOCUMENT HISTORY (Archive of identity documents) ===
export const clientDocumentHistory = pgTable("client_document_history", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  documentType: text("document_type"),
  customDocType: text("custom_doc_type"),
  documentNumber: text("document_number"),
  validUntil: text("valid_until"),
  issuedBy: text("issued_by"),
  issuingAuthorityCode: text("issuing_authority_code"),
  archivedAt: timestamp("archived_at").defaultNow(),
  archivedByUserId: integer("archived_by_user_id").references(() => appUsers.id),
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

// === GLOBAL PRODUCT CATALOG ===
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => partners.id),
  companyId: integer("company_id").references(() => myCompanies.id),
  stateId: integer("state_id").references(() => states.id),
  code: text("code").notNull(),
  name: text("name").notNull(),
  displayName: text("display_name"),
  description: text("description"),
  allowedSpecialists: text("allowed_specialists").array(),
  notes: text("notes"),
  requiredDocuments: jsonb("required_documents").$type<string[]>().default([]),
  isDeleted: boolean("is_deleted").default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at"),
  deletedFromIp: text("deleted_from_ip"),
  processingTimeSec: integer("processing_time_sec").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === COMMISSION RATES (Sadzobnik - pricing history, append-only) ===
export const commissionSchemes = pgTable("commission_schemes", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to"),
  type: text("type").notNull(),
  value: integer("value").notNull(),
  coefficient: integer("coefficient"),
  currency: text("currency").default('EUR'),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RBAC: PERMISSION GROUPS ===
export const permissionGroups = pgTable("permission_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  sessionTimeoutSeconds: integer("session_timeout_seconds").notNull().default(180),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// === RBAC: PERMISSIONS MATRIX ===
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => permissionGroups.id),
  module: text("module").notNull(),
  canRead: boolean("can_read").default(false),
  canCreate: boolean("can_create").default(false),
  canEdit: boolean("can_edit").default(false),
  canPublish: boolean("can_publish").default(false),
  canDelete: boolean("can_delete").default(false),
});

// === APP USERS & SECURITY ===
export const appUsers = pgTable("app_users", {
  id: serial("id").primaryKey(),
  replitId: text("replit_id").unique(),
  uid: text("uid"),
  username: text("username").notNull().unique(),
  password: text("password"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  phone: text("phone"),
  role: text("role").default('user'),
  permissionGroupId: integer("permission_group_id"),
  mfaType: text("mfa_type").default('none'),
  allowedCompanyIds: integer("allowed_company_ids").array(),
  securityLevel: integer("security_level").default(1),
  adminCode: text("admin_code"),
  activeCompanyId: integer("active_company_id"),
  activeStateId: integer("active_state_id"),
  commissionLevel: integer("commission_level").default(1),
  managerId: integer("manager_id"),
  careerLevelId: integer("career_level_id").references(() => careerLevels.id),
  linkedSubjectId: integer("linked_subject_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === APP USER ARCHIVE (immutable history) ===
export const appUserArchive = pgTable("app_user_archive", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id").notNull(),
  data: jsonb("data").notNull(),
  archivedAt: timestamp("archived_at").defaultNow(),
  reason: text("reason"),
});

// === RELATIONS ===
export const subjectsRelations = relations(subjects, ({ one }) => ({
  continent: one(continents, { fields: [subjects.continentId], references: [continents.id] }),
  state: one(states, { fields: [subjects.stateId], references: [states.id] }),
  company: one(myCompanies, { fields: [subjects.myCompanyId], references: [myCompanies.id] }),
  linkedFo: one(subjects, { fields: [subjects.linkedFoId], references: [subjects.id] }),
}));

export const productsRelations = relations(products, ({ one }) => ({
  partner: one(partners, { fields: [products.partnerId], references: [partners.id] }),
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

// === AUDIT LOGS ===
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  username: text("username"),
  action: text("action").notNull(),
  module: text("module").notNull(),
  entityId: integer("entity_id"),
  entityName: text("entity_name"),
  oldData: jsonb("old_data"),
  newData: jsonb("new_data"),
  processingTimeSec: integer("processing_time_sec").default(0),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === SYSTEM SETTINGS ===
export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === VERIFICATION CODES (for registration MFA) ===
export const verificationCodes = pgTable("verification_codes", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  channel: text("channel").notNull(),
  code: text("code").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === CATEGORY TIMEOUTS (per client category/group) ===
export const categoryTimeouts = pgTable("category_timeouts", {
  id: serial("id").primaryKey(),
  categoryName: text("category_name").notNull().unique(),
  timeoutSeconds: integer("timeout_seconds").notNull().default(180),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === DASHBOARD PREFERENCES (per user) ===
export const dashboardPreferences = pgTable("dashboard_preferences", {
  id: serial("id").primaryKey(),
  appUserId: integer("app_user_id").notNull().references(() => appUsers.id),
  widgetKey: text("widget_key").notNull(),
  enabled: boolean("enabled").default(true),
});

// === DASHBOARD LAYOUTS (per user widget order - ArutsoK 22) ===
export const userDashboardLayouts = pgTable("user_dashboard_layouts", {
  id: serial("id").primaryKey(),
  appUserId: integer("app_user_id").notNull().references(() => appUsers.id),
  widgetOrder: text("widget_order").array().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === CLIENT TYPES (Dynamic Parameter System) ===
export const clientTypes = pgTable("client_types", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  baseParameter: text("base_parameter").notNull().default("rc"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});


// === CLIENT GROUPS (Skupiny klientov) ===
export const clientGroups = pgTable("client_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  entityType: text("entity_type").notNull().default("fyzicka_osoba"),
  allowLogin: boolean("allow_login").default(true),
  allowCalculators: boolean("allow_calculators").default(true),
  permissionLevel: integer("permission_level").notNull().default(1),
  permissionGroupId: integer("permission_group_id").references(() => permissionGroups.id),
  sortOrder: integer("sort_order").default(0),
  stateId: integer("state_id").references(() => states.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === CLIENT SUB-GROUPS (Podskupiny) ===
export const clientSubGroups = pgTable("client_sub_groups", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => clientGroups.id),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// === CLIENT GROUP MEMBERS (Group <-> Subject assignment) ===
export const clientGroupMembers = pgTable("client_group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => clientGroups.id),
  subGroupId: integer("sub_group_id").references(() => clientSubGroups.id),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// === USER CLIENT GROUP MEMBERSHIPS (User <-> ClientGroup multi-assignment) ===
export const userClientGroupMemberships = pgTable("user_client_group_memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => appUsers.id),
  groupId: integer("group_id").notNull().references(() => clientGroups.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// === CONTRACT STATUSES (Stavy zmluv) ===
export const contractStatuses = pgTable("contract_statuses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#3b82f6"),
  sortOrder: integer("sort_order").default(0),
  isSystem: boolean("is_system").default(false),
  isCommissionable: boolean("is_commissionable").default(false),
  isFinal: boolean("is_final").default(false),
  assignsNumber: boolean("assigns_number").default(false),
  definesContractEnd: boolean("defines_contract_end").default(false),
  isIntervention: boolean("is_intervention").default(false),
  isStorno: boolean("is_storno").default(false),
  stateId: integer("state_id").references(() => states.id),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// === CONTRACT STATUS COMPANIES (ArutsoK 49 - statuses linked to companies) ===
export const contractStatusCompanies = pgTable("contract_status_companies", {
  id: serial("id").primaryKey(),
  statusId: integer("status_id").notNull().references(() => contractStatuses.id, { onDelete: "cascade" }),
  companyId: integer("company_id").notNull().references(() => myCompanies.id, { onDelete: "cascade" }),
});

// === CONTRACT STATUS VISIBILITY (ArutsoK 49 - statuses linked to sectors/sections/products) ===
export const contractStatusVisibility = pgTable("contract_status_visibility", {
  id: serial("id").primaryKey(),
  statusId: integer("status_id").notNull().references(() => contractStatuses.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
});

// === CONTRACT STATUS CONTRACT TYPES (statuses linked to contract types) ===
export const contractStatusContractTypes = pgTable("contract_status_contract_types", {
  id: serial("id").primaryKey(),
  statusId: integer("status_id").notNull().references(() => contractStatuses.id, { onDelete: "cascade" }),
  contractType: text("contract_type").notNull(),
});

// === CONTRACT STATUS PARAMETERS (ArutsoK 49 - independent parameter sub-system for statuses) ===
export const contractStatusParameters = pgTable("contract_status_parameters", {
  id: serial("id").primaryKey(),
  statusId: integer("status_id").notNull().references(() => contractStatuses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  paramType: text("param_type").notNull().default("text"),
  helpText: text("help_text").default(""),
  options: text("options").array().default([]),
  isRequired: boolean("is_required").default(false),
  defaultValue: text("default_value").default(""),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// === CONTRACT STATUS CHANGE LOG (ArutsoK 49, extended ArutsoK 51, ArutsoK 52) ===
export const contractStatusChangeLogs = pgTable("contract_status_change_logs", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  oldStatusId: integer("old_status_id").references(() => contractStatuses.id),
  newStatusId: integer("new_status_id").notNull().references(() => contractStatuses.id),
  changedByUserId: integer("changed_by_user_id").references(() => appUsers.id),
  changedAt: timestamp("changed_at").defaultNow(),
  parameterValues: jsonb("parameter_values").$type<Record<string, string>>().default({}),
  visibleToClient: boolean("visible_to_client").default(false),
  statusNote: text("status_note"),
  statusChangeDocuments: jsonb("status_change_documents").$type<DocEntry[]>().default([]),
  statusIteration: integer("status_iteration").default(1),
  importId: integer("import_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === CONTRACT TEMPLATES (Sablony zmluv) ===
export const contractTemplates = pgTable("contract_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content"),
  fileUrl: text("file_url"),
  fileOriginalName: text("file_original_name"),
  productType: text("product_type"),
  stateId: integer("state_id").references(() => states.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// === CONTRACT INVENTORIES (Supisky - batches) ===
export const contractInventories = pgTable("contract_inventories", {
  id: serial("id").primaryKey(),
  sequenceNumber: integer("sequence_number"),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").default(0),
  stateId: integer("state_id").references(() => states.id),
  isClosed: boolean("is_closed").default(false),
  isAccepted: boolean("is_accepted").default(false),
  isDispatched: boolean("is_dispatched").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// === CONTRACTS (Zmluvy - main) ===
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  uid: text("uid"),
  contractNumber: text("contract_number"),
  proposalNumber: text("proposal_number"),
  kik: text("kik"),
  subjectId: integer("subject_id").references(() => subjects.id),
  partnerId: integer("partner_id").references(() => partners.id),
  productId: integer("product_id").references(() => products.id),
  sectorProductId: integer("sector_product_id").references(() => sectorProducts.id),
  statusId: integer("status_id").references(() => contractStatuses.id),
  templateId: integer("template_id").references(() => contractTemplates.id),
  inventoryId: integer("inventory_id").references(() => contractInventories.id),
  stateId: integer("state_id").references(() => states.id),
  companyId: integer("company_id").references(() => myCompanies.id),
  signingPlace: text("signing_place"),
  contractType: text("contract_type").default("Nova"),
  paymentFrequency: text("payment_frequency"),
  signedDate: timestamp("signed_date"),
  effectiveDate: timestamp("effective_date"),
  expiryDate: timestamp("expiry_date"),
  premiumAmount: integer("premium_amount"),
  annualPremium: integer("annual_premium"),
  commissionAmount: integer("commission_amount"),
  currency: text("currency").default("EUR"),
  notes: text("notes"),
  documents: jsonb("documents").$type<DocEntry[]>().default([]),
  checkedDocuments: jsonb("checked_documents").$type<string[]>().default([]),
  dynamicPanelValues: jsonb("dynamic_panel_values").$type<Record<string, string>>().default({}),
  sortOrderInInventory: integer("sort_order_in_inventory"),
  registrationNumber: text("registration_number"),
  globalNumber: integer("global_number"),
  uploadedByUserId: integer("uploaded_by_user_id").references(() => appUsers.id),
  dispatchedAt: timestamp("dispatched_at"),
  acceptedAt: timestamp("accepted_at"),
  lastStatusUpdate: timestamp("last_status_update"),
  klientUid: text("klient_uid"),
  ziskatelUid: text("ziskatel_uid"),
  specialistaUid: text("specialista_uid"),
  zakonnyZastupcaUid: text("zakonny_zastupca_uid"),
  konatelUid: text("konatel_uid"),
  szcoUid: text("szco_uid"),
  szcoRodneCislo: text("szco_rodne_cislo"),
  szcoIco: text("szco_ico"),
  needsManualVerification: boolean("needs_manual_verification").default(false),
  requiredPermissionLevel: integer("required_permission_level").default(1),
  processingTimeSec: integer("processing_time_sec").default(0),
  clientGroupId: integer("client_group_id").references(() => clientGroups.id),
  identifierType: text("identifier_type"),
  identifierValue: text("identifier_value"),
  isLocked: boolean("is_locked").default(false),
  lockedBy: text("locked_by"),
  lockedAt: timestamp("locked_at"),
  lockedBySupiskaId: integer("locked_by_supiska_id"),
  incompleteData: boolean("incomplete_data").default(false),
  incompleteDataReason: text("incomplete_data_reason"),
  importedAt: timestamp("imported_at"),
  importBatchId: text("import_batch_id"),
  isDeleted: boolean("is_deleted").default(false),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at"),
  deletedFromIp: text("deleted_from_ip"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === CONTRACT ACQUIRERS (Ziskatelov k zmluve) - ArutsoK 47 ===
export const contractAcquirers = pgTable("contract_acquirers", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  userId: integer("user_id").notNull().references(() => appUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// === CONTRACT PASSWORDS (Hesla k zmluve) - ArutsoK 32 ===
export const contractPasswords = pgTable("contract_passwords", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  password: text("password").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === CONTRACT REWARD DISTRIBUTIONS (Rozdelenie odmien) ===
export const contractRewardDistributions = pgTable("contract_reward_distributions", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  type: text("type").notNull(), // 'recommender' | 'specialist'
  uid: text("uid").notNull(),
  percentage: text("percentage").notNull().default("0"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// === CONTRACT PARAMETER VALUES ===
export const contractParameterValues = pgTable("contract_parameter_values", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  parameterId: integer("parameter_id").notNull(),
  value: text("value").default(""),
  snapshotLabel: text("snapshot_label"),
  snapshotType: text("snapshot_type"),
  snapshotOptions: text("snapshot_options").array().default([]),
  snapshotHelpText: text("snapshot_help_text"),
});

// === SUPISKY (Settlement Sheets) ===
export const supisky = pgTable("supisky", {
  id: serial("id").primaryKey(),
  supId: text("sup_id").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("Nova"),
  stateId: integer("state_id").references(() => states.id),
  companyId: integer("company_id").references(() => myCompanies.id),
  createdBy: text("created_by"),
  createdByUserId: integer("created_by_user_id"),
  sentAt: timestamp("sent_at"),
  sentBy: text("sent_by"),
  notes: text("notes"),
  processingTimeSec: integer("processing_time_sec").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === SUPISKA-CONTRACT JUNCTION ===
export const supiskaContracts = pgTable("supiska_contracts", {
  id: serial("id").primaryKey(),
  supiskaId: integer("supiska_id").notNull().references(() => supisky.id),
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// === COMMISSION RATES MATRIX (Sadzby - Partner+Product mapping) ===
export const commissionRates = pgTable("commission_rates", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").notNull().references(() => partners.id),
  productId: integer("product_id").notNull().references(() => products.id),
  companyId: integer("company_id").references(() => myCompanies.id),
  stateId: integer("state_id").references(() => states.id),
  rateType: text("rate_type").notNull().default("percent"),
  rateValue: numeric("rate_value", { precision: 10, scale: 4 }).notNull().default("0"),
  pointsFactor: numeric("points_factor", { precision: 10, scale: 4 }).default("1"),
  currency: text("currency").default("EUR"),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").default(true),
  notes: text("notes"),
  processingTimeSec: integer("processing_time_sec").default(0),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// === COMMISSION CALCULATION LOGS (Audit trail for calculations) ===
export const commissionCalculationLogs = pgTable("commission_calculation_logs", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => contracts.id),
  contractNumber: text("contract_number"),
  rateId: integer("rate_id").references(() => commissionRates.id),
  agentId: integer("agent_id").references(() => appUsers.id),
  agentLevel: integer("agent_level"),
  managerId: integer("manager_id").references(() => appUsers.id),
  managerLevel: integer("manager_level"),
  premiumAmount: numeric("premium_amount", { precision: 12, scale: 2 }).default("0"),
  rateType: text("rate_type"),
  rateValue: numeric("rate_value", { precision: 10, scale: 4 }).default("0"),
  baseCommission: numeric("base_commission", { precision: 12, scale: 2 }).default("0"),
  differentialCommission: numeric("differential_commission", { precision: 12, scale: 2 }).default("0"),
  totalCommission: numeric("total_commission", { precision: 12, scale: 2 }).default("0"),
  pointsEarned: numeric("points_earned", { precision: 10, scale: 4 }).default("0"),
  actorId: integer("actor_id").references(() => appUsers.id),
  actorUsername: text("actor_username"),
  processingTimeSec: integer("processing_time_sec").default(0),
  inputSnapshot: jsonb("input_snapshot").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const commissionRatesRelations = relations(commissionRates, ({ one }) => ({
  partner: one(partners, { fields: [commissionRates.partnerId], references: [partners.id] }),
  product: one(products, { fields: [commissionRates.productId], references: [products.id] }),
  company: one(myCompanies, { fields: [commissionRates.companyId], references: [myCompanies.id] }),
  state: one(states, { fields: [commissionRates.stateId], references: [states.id] }),
}));

export const contractsRelations = relations(contracts, ({ one }) => ({
  subject: one(subjects, { fields: [contracts.subjectId], references: [subjects.id] }),
  partner: one(partners, { fields: [contracts.partnerId], references: [partners.id] }),
  product: one(products, { fields: [contracts.productId], references: [products.id] }),
  sectorProduct: one(sectorProducts, { fields: [contracts.sectorProductId], references: [sectorProducts.id] }),
  status: one(contractStatuses, { fields: [contracts.statusId], references: [contractStatuses.id] }),
  template: one(contractTemplates, { fields: [contracts.templateId], references: [contractTemplates.id] }),
  inventory: one(contractInventories, { fields: [contracts.inventoryId], references: [contractInventories.id] }),
  state: one(states, { fields: [contracts.stateId], references: [states.id] }),
  company: one(myCompanies, { fields: [contracts.companyId], references: [myCompanies.id] }),
}));

// === ZOD SCHEMAS ===
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true, uid: true, createdAt: true });
export const insertMyCompanySchema = createInsertSchema(myCompanies).omit({ id: true, createdAt: true, updatedAt: true, isDeleted: true, uid: true, deletedBy: true, deletedAt: true, deletedFromIp: true });
export const insertPartnerSchema = createInsertSchema(partners).omit({ id: true, createdAt: true, updatedAt: true, isDeleted: true, uid: true, deletedBy: true, deletedAt: true, deletedFromIp: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true, isDeleted: true, deletedBy: true, deletedAt: true, deletedFromIp: true, displayName: true });
export const insertCommissionSchemeSchema = createInsertSchema(commissionSchemes).omit({ id: true, createdAt: true });
export const insertPermissionGroupSchema = createInsertSchema(permissionGroups).omit({ id: true, createdAt: true });
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });
export const insertAppUserSchema = createInsertSchema(appUsers).omit({ id: true, createdAt: true });
export const insertCompanyOfficerSchema = createInsertSchema(companyOfficers).omit({ id: true, createdAt: true });
export const insertPartnerContactSchema = createInsertSchema(partnerContacts).omit({ id: true, createdAt: true });
export const insertPartnerProductSchema = createInsertSchema(partnerProducts).omit({ id: true, createdAt: true });
export const insertPartnerContractSchema = createInsertSchema(partnerContracts).omit({ id: true, createdAt: true });
export const insertCommunicationMatrixSchema = createInsertSchema(communicationMatrix).omit({ id: true, createdAt: true });
export const insertCompanyContactSchema = createInsertSchema(companyContacts).omit({ id: true, createdAt: true });
export const insertClientDocumentHistorySchema = createInsertSchema(clientDocumentHistory).omit({ id: true, archivedAt: true });
export const insertContractAmendmentSchema = createInsertSchema(contractAmendments).omit({ id: true, createdAt: true });
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ id: true, updatedAt: true });
export const insertVerificationCodeSchema = createInsertSchema(verificationCodes).omit({ id: true, createdAt: true });
export const insertCategoryTimeoutSchema = createInsertSchema(categoryTimeouts).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDashboardPreferenceSchema = createInsertSchema(dashboardPreferences).omit({ id: true });
export const insertUserDashboardLayoutSchema = createInsertSchema(userDashboardLayouts).omit({ id: true, updatedAt: true });
export const insertClientTypeSchema = createInsertSchema(clientTypes).omit({ id: true, createdAt: true });
export const insertClientGroupSchema = createInsertSchema(clientGroups).omit({ id: true, createdAt: true, updatedAt: true });
export const insertClientSubGroupSchema = createInsertSchema(clientSubGroups).omit({ id: true, createdAt: true });
export const insertClientGroupMemberSchema = createInsertSchema(clientGroupMembers).omit({ id: true, createdAt: true });
export const insertUserClientGroupMembershipSchema = createInsertSchema(userClientGroupMemberships).omit({ id: true, createdAt: true });
export const insertContractStatusSchema = createInsertSchema(contractStatuses).omit({ id: true, createdAt: true });
export const insertContractStatusCompanySchema = createInsertSchema(contractStatusCompanies).omit({ id: true });
export const insertContractStatusVisibilitySchema = createInsertSchema(contractStatusVisibility).omit({ id: true });
export const insertContractStatusContractTypeSchema = createInsertSchema(contractStatusContractTypes).omit({ id: true });
export const insertContractStatusParameterSchema = createInsertSchema(contractStatusParameters).omit({ id: true, createdAt: true });
export const insertContractStatusChangeLogSchema = createInsertSchema(contractStatusChangeLogs).omit({ id: true, createdAt: true });
export const insertContractTemplateSchema = createInsertSchema(contractTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractInventorySchema = createInsertSchema(contractInventories).omit({ id: true, createdAt: true, updatedAt: true });
export const insertContractSchema = createInsertSchema(contracts).omit({ id: true, createdAt: true, updatedAt: true, isDeleted: true, deletedBy: true, deletedAt: true, deletedFromIp: true, uid: true, isLocked: true, lockedBy: true, lockedAt: true, lockedBySupiskaId: true });
export const insertContractAcquirerSchema = createInsertSchema(contractAcquirers).omit({ id: true, createdAt: true });
export const insertContractPasswordSchema = createInsertSchema(contractPasswords).omit({ id: true, createdAt: true });
export const insertContractParameterValueSchema = createInsertSchema(contractParameterValues).omit({ id: true });
export const insertContractRewardDistributionSchema = createInsertSchema(contractRewardDistributions).omit({ id: true, createdAt: true });
export const insertSupiskaSchema = createInsertSchema(supisky).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSupiskaContractSchema = createInsertSchema(supiskaContracts).omit({ id: true, createdAt: true });
export const insertCommissionRateSchema = createInsertSchema(commissionRates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCommissionCalculationLogSchema = createInsertSchema(commissionCalculationLogs).omit({ id: true, createdAt: true });

// === EXPLICIT TYPES ===
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type MyCompany = typeof myCompanies.$inferSelect;
export type InsertMyCompany = z.infer<typeof insertMyCompanySchema>;
export type Partner = typeof partners.$inferSelect;
export type InsertPartner = z.infer<typeof insertPartnerSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type CommissionScheme = typeof commissionSchemes.$inferSelect;
export type InsertCommissionScheme = z.infer<typeof insertCommissionSchemeSchema>;
export type Contact = typeof contacts.$inferSelect;
export type AppUser = typeof appUsers.$inferSelect;
export type AppUserWithCareerLevel = AppUser & { careerLevel?: CareerLevel | null; effectiveSessionTimeoutSeconds?: number };
export type InsertAppUser = z.infer<typeof insertAppUserSchema>;
export type PermissionGroup = typeof permissionGroups.$inferSelect;
export type InsertPermissionGroup = z.infer<typeof insertPermissionGroupSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
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
export type ClientDocumentHistory = typeof clientDocumentHistory.$inferSelect;
export type InsertClientDocumentHistory = z.infer<typeof insertClientDocumentHistorySchema>;
export type ContractAmendment = typeof contractAmendments.$inferSelect;
export type InsertContractAmendment = z.infer<typeof insertContractAmendmentSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;
export type VerificationCode = typeof verificationCodes.$inferSelect;
export type CategoryTimeout = typeof categoryTimeouts.$inferSelect;
export type InsertCategoryTimeout = z.infer<typeof insertCategoryTimeoutSchema>;
export type DashboardPreference = typeof dashboardPreferences.$inferSelect;
export type InsertDashboardPreference = z.infer<typeof insertDashboardPreferenceSchema>;
export type UserDashboardLayout = typeof userDashboardLayouts.$inferSelect;
export type InsertUserDashboardLayout = z.infer<typeof insertUserDashboardLayoutSchema>;

export type ClientType = typeof clientTypes.$inferSelect;
export type InsertClientType = z.infer<typeof insertClientTypeSchema>;

export type ClientGroup = typeof clientGroups.$inferSelect;
export type InsertClientGroup = z.infer<typeof insertClientGroupSchema>;
export type ClientSubGroup = typeof clientSubGroups.$inferSelect;
export type InsertClientSubGroup = z.infer<typeof insertClientSubGroupSchema>;
export type ClientGroupMember = typeof clientGroupMembers.$inferSelect;
export type InsertClientGroupMember = z.infer<typeof insertClientGroupMemberSchema>;
export type UserClientGroupMembership = typeof userClientGroupMemberships.$inferSelect;
export type InsertUserClientGroupMembership = z.infer<typeof insertUserClientGroupMembershipSchema>;

export type ContractStatus = typeof contractStatuses.$inferSelect;
export type ContractStatusCompany = typeof contractStatusCompanies.$inferSelect;
export type InsertContractStatusCompany = z.infer<typeof insertContractStatusCompanySchema>;
export type ContractStatusVisibility = typeof contractStatusVisibility.$inferSelect;
export type InsertContractStatusVisibility = z.infer<typeof insertContractStatusVisibilitySchema>;
export type ContractStatusContractType = typeof contractStatusContractTypes.$inferSelect;
export type InsertContractStatusContractType = z.infer<typeof insertContractStatusContractTypeSchema>;
export type ContractStatusParameter = typeof contractStatusParameters.$inferSelect;
export type InsertContractStatusParameter = z.infer<typeof insertContractStatusParameterSchema>;
export type ContractStatusChangeLog = typeof contractStatusChangeLogs.$inferSelect;
export type InsertContractStatusChangeLog = z.infer<typeof insertContractStatusChangeLogSchema>;
export type InsertContractStatus = z.infer<typeof insertContractStatusSchema>;
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type InsertContractTemplate = z.infer<typeof insertContractTemplateSchema>;
export type ContractInventory = typeof contractInventories.$inferSelect;
export type InsertContractInventory = z.infer<typeof insertContractInventorySchema>;
export type Contract = typeof contracts.$inferSelect;
export type InsertContract = z.infer<typeof insertContractSchema>;
export type ContractAcquirer = typeof contractAcquirers.$inferSelect;
export type InsertContractAcquirer = z.infer<typeof insertContractAcquirerSchema>;
export type ContractPassword = typeof contractPasswords.$inferSelect;
export type InsertContractPassword = z.infer<typeof insertContractPasswordSchema>;
export type ContractParameterValue = typeof contractParameterValues.$inferSelect;
export type InsertContractParameterValue = z.infer<typeof insertContractParameterValueSchema>;
export type ContractRewardDistribution = typeof contractRewardDistributions.$inferSelect;
export type InsertContractRewardDistribution = z.infer<typeof insertContractRewardDistributionSchema>;

export type Supiska = typeof supisky.$inferSelect;
export type InsertSupiska = z.infer<typeof insertSupiskaSchema>;
export type SupiskaContract = typeof supiskaContracts.$inferSelect;
export type InsertSupiskaContract = z.infer<typeof insertSupiskaContractSchema>;

export type CommissionRate = typeof commissionRates.$inferSelect;
export type InsertCommissionRate = z.infer<typeof insertCommissionRateSchema>;
export type CommissionCalculationLog = typeof commissionCalculationLogs.$inferSelect;
export type InsertCommissionCalculationLog = z.infer<typeof insertCommissionCalculationLogSchema>;

// === SECTORS ===
export const sectors = pgTable("sectors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  sectorType: text("sector_type").notNull().default("general"),
  partnerIds: integer("partner_ids").array().default([]),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertSectorSchema = createInsertSchema(sectors).omit({ id: true, createdAt: true });

// === SECTIONS (ArutsoK 28 - level between sectors and products) ===
export const sections = pgTable("sections", {
  id: serial("id").primaryKey(),
  sectorId: integer("sector_id").notNull(),
  name: text("name").notNull(),
  description: text("description").default(""),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertSectionSchema = createInsertSchema(sections).omit({ id: true, createdAt: true });

// === SECTOR PRODUCTS (ArutsoK 28 - products within a section) ===
export const sectorProducts = pgTable("sector_products", {
  id: serial("id").primaryKey(),
  sectionId: integer("section_id").notNull(),
  name: text("name").notNull(),
  abbreviation: text("abbreviation").default(""),
  partnerId: integer("partner_id"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertSectorProductSchema = createInsertSchema(sectorProducts).omit({ id: true, createdAt: true });

// === PARAMETERS ===
export const parameters = pgTable("parameters", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  paramType: text("param_type").notNull().default("text"),
  helpText: text("help_text").default(""),
  options: text("options").array().default([]),
  isRequired: boolean("is_required").default(false),
  defaultValue: text("default_value").default(""),
  unit: text("unit"),
  decimalPlaces: integer("decimal_places").default(2),
  targetCategoryCode: text("target_category_code"),
  targetFieldKey: text("target_field_key"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertParameterSchema = createInsertSchema(parameters).omit({ id: true, createdAt: true });

// === SECTOR_PARAMETERS (legacy, kept for backward compat) ===
export const sectorParameters = pgTable("sector_parameters", {
  id: serial("id").primaryKey(),
  sectorId: integer("sector_id").notNull(),
  parameterId: integer("parameter_id").notNull(),
});

export const insertSectorParameterSchema = createInsertSchema(sectorParameters).omit({ id: true });

// === SECTOR_PRODUCT_PARAMETERS (ArutsoK 25 - parameters linked to sector products) ===
export const sectorProductParameters = pgTable("sector_product_parameters", {
  id: serial("id").primaryKey(),
  sectorProductId: integer("sector_product_id").notNull(),
  parameterId: integer("parameter_id").notNull(),
});

export const insertSectorProductParameterSchema = createInsertSchema(sectorProductParameters).omit({ id: true });

// === PRODUCT_SECTORS (many-to-many) ===
export const productSectors = pgTable("product_sectors", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  sectorId: integer("sector_id").notNull(),
});

export const insertProductSectorSchema = createInsertSchema(productSectors).omit({ id: true });

// === PRODUCT_PARAMETERS (many-to-many) ===
export const productParameters = pgTable("product_parameters", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  parameterId: integer("parameter_id").notNull(),
  overrideRequired: boolean("override_required"),
  overrideHelpText: text("override_help_text"),
});

export const insertProductParameterSchema = createInsertSchema(productParameters).omit({ id: true });

export type Sector = typeof sectors.$inferSelect;
export type InsertSector = z.infer<typeof insertSectorSchema>;
export type Section = typeof sections.$inferSelect;
export type InsertSection = z.infer<typeof insertSectionSchema>;
export type SectorProduct = typeof sectorProducts.$inferSelect;
export type InsertSectorProduct = z.infer<typeof insertSectorProductSchema>;
export type Parameter = typeof parameters.$inferSelect;
export type InsertParameter = z.infer<typeof insertParameterSchema>;
export type SectorParameter = typeof sectorParameters.$inferSelect;
export type InsertSectorParameter = z.infer<typeof insertSectorParameterSchema>;
export type SectorProductParameter = typeof sectorProductParameters.$inferSelect;
export type InsertSectorProductParameter = z.infer<typeof insertSectorProductParameterSchema>;
export type ProductSector = typeof productSectors.$inferSelect;
export type InsertProductSector = z.infer<typeof insertProductSectorSchema>;
export type ProductParameter = typeof productParameters.$inferSelect;
export type InsertProductParameter = z.infer<typeof insertProductParameterSchema>;

// === PANELS (ArutsoK 27 - visual containers for parameters) ===
export const panels = pgTable("panels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertPanelSchema = createInsertSchema(panels).omit({ id: true, createdAt: true });

// === PANEL_PARAMETERS (ArutsoK 27 - parameters assigned to panels) ===
export const panelParameters = pgTable("panel_parameters", {
  id: serial("id").primaryKey(),
  panelId: integer("panel_id").notNull(),
  parameterId: integer("parameter_id").notNull(),
  sortOrder: integer("sort_order").default(0),
  targetCategoryCode: text("target_category_code"),
});

export const insertPanelParameterSchema = createInsertSchema(panelParameters).omit({ id: true });

// === PRODUCT_PANELS (ArutsoK 27 - panels assigned to sector_products) ===
export const productPanels = pgTable("product_panels", {
  id: serial("id").primaryKey(),
  sectorProductId: integer("sector_product_id").notNull(),
  panelId: integer("panel_id").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const insertProductPanelSchema = createInsertSchema(productPanels).omit({ id: true });

export type Panel = typeof panels.$inferSelect;
export type InsertPanel = z.infer<typeof insertPanelSchema>;
export type PanelParameter = typeof panelParameters.$inferSelect;
export type InsertPanelParameter = z.infer<typeof insertPanelParameterSchema>;
export type ProductPanel = typeof productPanels.$inferSelect;
export type InsertProductPanel = z.infer<typeof insertProductPanelSchema>;

// === CONTRACT FOLDERS (ArutsoK 35 - visual containers for grouping panels in contract form) ===
export const contractFolders = pgTable("contract_folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

export const insertContractFolderSchema = createInsertSchema(contractFolders).omit({ id: true, createdAt: true });

// === FOLDER_PANELS (ArutsoK 35 - panels assigned to folders with grid layout) ===
export const folderPanels = pgTable("folder_panels", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").notNull(),
  panelId: integer("panel_id").notNull(),
  gridColumns: integer("grid_columns").notNull().default(1),
  sortOrder: integer("sort_order").default(0),
});

export const insertFolderPanelSchema = createInsertSchema(folderPanels).omit({ id: true });

export type ContractFolder = typeof contractFolders.$inferSelect;
export type InsertContractFolder = z.infer<typeof insertContractFolderSchema>;
export type FolderPanel = typeof folderPanels.$inferSelect;
export type InsertFolderPanel = z.infer<typeof insertFolderPanelSchema>;

// === CALENDAR EVENTS ===
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").default(""),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  allDay: boolean("all_day").default(false),
  color: text("color").default("#3b82f6"),
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).omit({ id: true, createdAt: true, updatedAt: true });
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;

// === STATE FLAG HISTORY (ArutsoK 31) ===
export const stateFlagHistory = pgTable("state_flag_history", {
  id: serial("id").primaryKey(),
  stateId: integer("state_id").notNull().references(() => states.id),
  flagUrl: text("flag_url").notNull(),
  replacedAt: timestamp("replaced_at").defaultNow(),
});

export type StateFlagHistory = typeof stateFlagHistory.$inferSelect;

// === COMPANY LOGO HISTORY (ArutsoK 31) ===
export const companyLogoHistory = pgTable("company_logo_history", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => myCompanies.id),
  logoUrl: text("logo_url").notNull(),
  originalName: text("original_name"),
  replacedAt: timestamp("replaced_at").defaultNow(),
});

export type CompanyLogoHistory = typeof companyLogoHistory.$inferSelect;

export const insertStateSchema = createInsertSchema(states).omit({ id: true });
export type State = typeof states.$inferSelect;
export type InsertState = z.infer<typeof insertStateSchema>;

// === PRODUCT FOLDER ASSIGNMENTS (ArutsoK 38 - folders assigned to products with sort_order) ===
export const productFolderAssignments = pgTable("product_folder_assignments", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull(),
  folderId: integer("folder_id").notNull(),
  sortOrder: integer("sort_order").default(0),
});

export const insertProductFolderAssignmentSchema = createInsertSchema(productFolderAssignments).omit({ id: true });
export type ProductFolderAssignment = typeof productFolderAssignments.$inferSelect;
export type InsertProductFolderAssignment = z.infer<typeof insertProductFolderAssignmentSchema>;

// === CONTRACT FIELD SETTINGS (ArutsoK 38 - PFA required field toggles) ===
export const contractFieldSettings = pgTable("contract_field_settings", {
  id: serial("id").primaryKey(),
  fieldKey: text("field_key").notNull().unique(),
  requiredForPfa: boolean("required_for_pfa").default(false),
});

export const insertContractFieldSettingSchema = createInsertSchema(contractFieldSettings).omit({ id: true });
export type ContractFieldSetting = typeof contractFieldSettings.$inferSelect;
export type InsertContractFieldSetting = z.infer<typeof insertContractFieldSettingSchema>;

// === CAREER LEVELS (Financie > Body) ===
export type CircleConfig = { visible: boolean; filled: boolean };

export const careerLevels = pgTable("career_levels", {
  id: serial("id").primaryKey(),
  positionCode: text("position_code").notNull().unique(),
  sortOrder: integer("sort_order").notNull().default(0),
  pointsFrom: text("points_from").notNull().default("0,00000000"),
  pointsTo: text("points_to").notNull().default("0,00000000"),
  pricePerPoint: text("price_per_point").notNull().default("0,00000000"),
  positionName: text("position_name").notNull().default(""),
  rewardPercent: text("reward_percent").notNull().default("0,00000000"),
  coefficient: text("coefficient").notNull().default("0,00000000"),
  colorZone: text("color_zone").notNull().default("white"),
  frameType: text("frame_type").notNull().default("none"),
  circleConfig: jsonb("circle_config").$type<CircleConfig[]>().notNull().default([
    { visible: true, filled: false },
    { visible: true, filled: false },
    { visible: true, filled: false },
    { visible: false, filled: false },
    { visible: false, filled: false },
    { visible: false, filled: false },
  ]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCareerLevelSchema = createInsertSchema(careerLevels).omit({ id: true, createdAt: true, updatedAt: true });
export type CareerLevel = typeof careerLevels.$inferSelect;
export type InsertCareerLevel = z.infer<typeof insertCareerLevelSchema>;

// === PRODUCT POINT RATES (Financie > Body - Blue Table) ===
export const productPointRates = pgTable("product_point_rates", {
  id: serial("id").primaryKey(),
  partnerId: integer("partner_id").references(() => partners.id),
  productId: integer("product_id").references(() => products.id),
  partnerName: text("partner_name"),
  productName: text("product_name"),
  basePoints: text("base_points").notNull().default("0,00000000"),
  commissionCoefficient: text("commission_coefficient").notNull().default("0,00000000"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertProductPointRateSchema = createInsertSchema(productPointRates).omit({ id: true, createdAt: true, updatedAt: true });
export type ProductPointRate = typeof productPointRates.$inferSelect;
export type InsertProductPointRate = z.infer<typeof insertProductPointRateSchema>;

// === ENTITY LINKS (Universal subject relationships) ===
export const entityLinks = pgTable("entity_links", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").notNull().references(() => subjects.id),
  targetId: integer("target_id").notNull().references(() => subjects.id),
  dateFrom: timestamp("date_from").notNull().defaultNow(),
  dateTo: timestamp("date_to"),
  createdAt: timestamp("created_at").defaultNow(),
  createdByUserId: integer("created_by_user_id").references(() => appUsers.id),
});

export const insertEntityLinkSchema = createInsertSchema(entityLinks).omit({ id: true, createdAt: true });
export type EntityLink = typeof entityLinks.$inferSelect;
export type InsertEntityLink = z.infer<typeof insertEntityLinkSchema>;

// === IMPORT LOGS (Hromadný import - záznamy) ===
export const importLogs = pgTable("import_logs", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  originalFileUrl: text("original_file_url"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  userId: integer("user_id").references(() => appUsers.id),
  companyId: integer("company_id").references(() => myCompanies.id),
  totalCommission: numeric("total_commission").default("0"),
  successCount: integer("success_count").default(0),
  errorCount: integer("error_count").default(0),
  totalRows: integer("total_rows").default(0),
  rawData: jsonb("raw_data").$type<Record<string, any>[]>().default([]),
  mappingConfig: jsonb("mapping_config").$type<Record<string, string>>().default({}),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow(),
});

// === COMMISSIONS (Provízie z importu) ===
export const commissions = pgTable("commissions", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").references(() => contracts.id),
  importId: integer("import_id").references(() => importLogs.id),
  amount: numeric("amount").notNull().default("0"),
  currency: text("currency").default("EUR"),
  agentId: integer("agent_id").references(() => appUsers.id),
  note: text("note"),
  status: text("status").notNull().default("predbezna"),
  creditDate: timestamp("credit_date"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertImportLogSchema = createInsertSchema(importLogs).omit({ id: true, createdAt: true });
export const insertCommissionSchema = createInsertSchema(commissions).omit({ id: true, createdAt: true });
export type ImportLog = typeof importLogs.$inferSelect;
export type InsertImportLog = z.infer<typeof insertImportLogSchema>;
export type Commission = typeof commissions.$inferSelect;
export type InsertCommission = z.infer<typeof insertCommissionSchema>;

// === SUBJECT POINTS LOG (Bonita point tracking) ===
export const subjectPointsLog = pgTable("subject_points_log", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  contractId: integer("contract_id").references(() => contracts.id),
  points: integer("points").notNull(),
  pointType: text("point_type").default("cerveny"),
  reason: text("reason").notNull(),
  identifierType: text("identifier_type"),
  identifierValue: text("identifier_value"),
  companyId: integer("company_id").references(() => myCompanies.id),
  createdByUserId: integer("created_by_user_id").references(() => appUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubjectPointsLogSchema = createInsertSchema(subjectPointsLog).omit({ id: true, createdAt: true });
export type SubjectPointsLog = typeof subjectPointsLog.$inferSelect;
export type InsertSubjectPointsLog = z.infer<typeof insertSubjectPointsLogSchema>;

// === CLIENT DATA TABS (7 logical tabs for SubjektView) ===
export const clientDataTabs = pgTable("client_data_tabs", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  icon: text("icon").default("FileText"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientDataTabSchema = createInsertSchema(clientDataTabs).omit({ id: true, createdAt: true });
export type ClientDataTab = typeof clientDataTabs.$inferSelect;
export type InsertClientDataTab = z.infer<typeof insertClientDataTabSchema>;

// === CLIENT DATA CATEGORIES (30 categories mapped to tabs) ===
export const clientDataCategories = pgTable("client_data_categories", {
  id: serial("id").primaryKey(),
  tabId: integer("tab_id").notNull().references(() => clientDataTabs.id),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").default(""),
  color: text("color").default("#6b7280"),
  icon: text("icon").default("Tag"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertClientDataCategorySchema = createInsertSchema(clientDataCategories).omit({ id: true, createdAt: true });
export type ClientDataCategory = typeof clientDataCategories.$inferSelect;
export type InsertClientDataCategory = z.infer<typeof insertClientDataCategorySchema>;

// === CLIENT MARKETING CONSENTS (M:N per client × company) ===
export const clientMarketingConsents = pgTable("client_marketing_consents", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  companyId: integer("company_id").notNull().references(() => myCompanies.id),
  consentType: text("consent_type").notNull().default("marketing"),
  isGranted: boolean("is_granted").default(false),
  grantedAt: timestamp("granted_at"),
  revokedAt: timestamp("revoked_at"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertClientMarketingConsentSchema = createInsertSchema(clientMarketingConsents).omit({ id: true, createdAt: true, updatedAt: true });
export type ClientMarketingConsent = typeof clientMarketingConsents.$inferSelect;
export type InsertClientMarketingConsent = z.infer<typeof insertClientMarketingConsentSchema>;

// === SUBJECT FIELD HISTORY (granular versioning per field) ===
export const subjectFieldHistory = pgTable("subject_field_history", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  fieldKey: text("field_key").notNull(),
  fieldSource: text("field_source").notNull().default("static"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  changedByUserId: integer("changed_by_user_id").references(() => appUsers.id),
  changedAt: timestamp("changed_at").defaultNow(),
  changeReason: text("change_reason"),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
});

export const insertSubjectFieldHistorySchema = createInsertSchema(subjectFieldHistory).omit({ id: true, changedAt: true });
export type SubjectFieldHistory = typeof subjectFieldHistory.$inferSelect;
export type InsertSubjectFieldHistory = z.infer<typeof insertSubjectFieldHistorySchema>;

// === SUBJECT COLLABORATORS (Tipér / Špecialista / Správca) ===
export const subjectCollaborators = pgTable("subject_collaborators", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  collaboratorUserId: integer("collaborator_user_id").references(() => appUsers.id),
  collaboratorName: text("collaborator_name"),
  role: text("role").notNull(),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  isActive: boolean("is_active").default(true),
  note: text("note"),
  createdByUserId: integer("created_by_user_id").references(() => appUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubjectCollaboratorSchema = createInsertSchema(subjectCollaborators).omit({ id: true, createdAt: true });
export type SubjectCollaborator = typeof subjectCollaborators.$inferSelect;
export type InsertSubjectCollaborator = z.infer<typeof insertSubjectCollaboratorSchema>;

// === SUBJECT PHOTOS (Profile Photo with Versioning) ===
export const subjectPhotos = pgTable("subject_photos", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").notNull().references(() => subjects.id),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  source: text("source").notNull().$type<"manual" | "id_card" | "passport" | "document">(),
  sourceDocumentId: text("source_document_id"),
  isActive: boolean("is_active").default(true),
  validFrom: timestamp("valid_from").defaultNow(),
  validTo: timestamp("valid_to"),
  createdByUserId: integer("created_by_user_id").references(() => appUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubjectPhotoSchema = createInsertSchema(subjectPhotos).omit({ id: true, createdAt: true });
export type SubjectPhoto = typeof subjectPhotos.$inferSelect;
export type InsertSubjectPhoto = z.infer<typeof insertSubjectPhotoSchema>;

// === ACTIVITY EVENTS (Timeline / Activity Tracking) ===
export const activityEvents = pgTable("activity_events", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").references(() => subjects.id),
  contractId: integer("contract_id").references(() => contracts.id),
  eventType: text("event_type").notNull().$type<"registration" | "card_open" | "field_change" | "communication" | "client_response" | "status_change">(),
  fieldName: text("field_name"),
  oldValue: text("old_value"),
  newValue: text("new_value"),
  messageText: text("message_text"),
  messageStatus: text("message_status").$type<"odoslane" | "dorucene" | "precitane">(),
  responseText: text("response_text"),
  ipAddress: text("ip_address"),
  deviceType: text("device_type"),
  userId: integer("user_id").references(() => appUsers.id),
  username: text("username"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertActivityEventSchema = createInsertSchema(activityEvents).omit({ id: true, createdAt: true });
export type ActivityEvent = typeof activityEvents.$inferSelect;
export type InsertActivityEvent = z.infer<typeof insertActivityEventSchema>;

// === DYNAMIC SUBJECT PARAMETERS (Knižnica parametrov) ===

export const subjectParamSections = pgTable("subject_param_sections", {
  id: serial("id").primaryKey(),
  clientTypeId: integer("client_type_id").notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  folderCategory: text("folder_category").notNull(),
  sortOrder: integer("sort_order").default(0),
  isPanel: boolean("is_panel").default(false),
  parentSectionId: integer("parent_section_id"),
  gridColumns: integer("grid_columns").default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubjectParamSectionSchema = createInsertSchema(subjectParamSections).omit({ id: true, createdAt: true });
export type SubjectParamSection = typeof subjectParamSections.$inferSelect;
export type InsertSubjectParamSection = z.infer<typeof insertSubjectParamSectionSchema>;

export const subjectParameters = pgTable("subject_parameters", {
  id: serial("id").primaryKey(),
  clientTypeId: integer("client_type_id").notNull(),
  sectionId: integer("section_id").references(() => subjectParamSections.id),
  panelId: integer("panel_id").references(() => subjectParamSections.id),
  fieldKey: text("field_key").notNull(),
  code: text("code"),
  label: text("label").notNull(),
  shortLabel: text("short_label"),
  fieldType: text("field_type").notNull(),
  isRequired: boolean("is_required").default(false),
  isHidden: boolean("is_hidden").default(false),
  isCollection: boolean("is_collection").default(false),
  extractionHints: jsonb("extraction_hints").$type<{ regex?: string; format?: string; examples?: string[] }>(),
  options: jsonb("options").$type<string[]>().default([]),
  defaultValue: text("default_value"),
  visibilityRule: jsonb("visibility_rule").$type<{ dependsOn: string; value: string } | null>(),
  unit: text("unit"),
  decimalPlaces: integer("decimal_places").default(2),
  fieldCategory: text("field_category").notNull(),
  categoryCode: text("category_code"),
  sortOrder: integer("sort_order").default(0),
  rowNumber: integer("row_number").default(0),
  widthPercent: integer("width_percent").default(100),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSubjectParameterSchema = createInsertSchema(subjectParameters).omit({ id: true, createdAt: true, updatedAt: true });
export type SubjectParameter = typeof subjectParameters.$inferSelect;
export type InsertSubjectParameter = z.infer<typeof insertSubjectParameterSchema>;

export const subjectTemplates = pgTable("subject_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  clientTypeId: integer("client_type_id"),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdByUserId: integer("created_by_user_id").references(() => appUsers.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertSubjectTemplateSchema = createInsertSchema(subjectTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type SubjectTemplate = typeof subjectTemplates.$inferSelect;
export type InsertSubjectTemplate = z.infer<typeof insertSubjectTemplateSchema>;

export const subjectTemplateParams = pgTable("subject_template_params", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => subjectTemplates.id, { onDelete: "cascade" }),
  parameterId: integer("parameter_id").notNull().references(() => subjectParameters.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").default(0),
  isRequired: boolean("is_required"),
  validFrom: timestamp("valid_from"),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSubjectTemplateParamSchema = createInsertSchema(subjectTemplateParams).omit({ id: true, createdAt: true });
export type SubjectTemplateParam = typeof subjectTemplateParams.$inferSelect;
export type InsertSubjectTemplateParam = z.infer<typeof insertSubjectTemplateParamSchema>;

export const parameterSynonyms = pgTable("parameter_synonyms", {
  id: serial("id").primaryKey(),
  parameterId: integer("parameter_id").notNull().references(() => subjectParameters.id, { onDelete: "cascade" }),
  synonym: varchar("synonym", { length: 255 }).notNull(),
  language: varchar("language", { length: 10 }).default("sk"),
  source: varchar("source", { length: 50 }).default("manual"),
  confidence: integer("confidence").default(100),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertParameterSynonymSchema = createInsertSchema(parameterSynonyms).omit({ id: true, createdAt: true });
export type ParameterSynonym = typeof parameterSynonyms.$inferSelect;
export type InsertParameterSynonym = z.infer<typeof insertParameterSynonymSchema>;

// === UNKNOWN EXTRACTED FIELDS (AI extraction misses) ===
export const unknownExtractedFields = pgTable("unknown_extracted_fields", {
  id: serial("id").primaryKey(),
  sourceText: text("source_text").notNull(),
  extractedKey: text("extracted_key").notNull(),
  extractedValue: text("extracted_value"),
  documentName: text("document_name"),
  clientTypeId: integer("client_type_id"),
  subjectId: integer("subject_id").references(() => subjects.id),
  contractId: integer("contract_id"),
  status: text("status").notNull().default("new"),
  assignedParameterId: integer("assigned_parameter_id").references(() => subjectParameters.id),
  resolvedByUserId: integer("resolved_by_user_id").references(() => appUsers.id),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUnknownExtractedFieldSchema = createInsertSchema(unknownExtractedFields).omit({ id: true, createdAt: true });
export type UnknownExtractedField = typeof unknownExtractedFields.$inferSelect;
export type InsertUnknownExtractedField = z.infer<typeof insertUnknownExtractedFieldSchema>;

export type CreateSubjectRequest = InsertSubject;
export type UpdateSubjectRequest = Partial<InsertSubject> & { changeReason?: string };
export type UpdateMyCompanyRequest = Partial<InsertMyCompany> & { changeReason?: string };
export type UpdatePartnerRequest = Partial<InsertPartner> & { changeReason?: string };
