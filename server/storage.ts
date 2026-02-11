import { db } from "./db";
import { 
  subjects, myCompanies, partners, contacts, products, commissionSchemes, 
  continents, states, subjectArchive, companyArchive, appUsers, appUserArchive,
  companyOfficers, partnerContracts, partnerContacts, partnerProducts,
  contactProductAssignments, communicationMatrix, globalCounters,
  companyContacts, contractAmendments, userProfiles,
  permissionGroups, permissions, auditLogs,
  type Subject, type InsertSubject, 
  type MyCompany, type InsertMyCompany,
  type Partner, type InsertPartner,
  type Contact, 
  type Product, type InsertProduct,
  type CommissionScheme, type InsertCommissionScheme,
  type UpdateSubjectRequest, type UpdateMyCompanyRequest, type UpdatePartnerRequest,
  type AppUser, type InsertAppUser,
  type CompanyOfficer, type InsertCompanyOfficer,
  type PartnerContact, type InsertPartnerContact,
  type PartnerProduct, type InsertPartnerProduct,
  type PartnerContract, type InsertPartnerContract,
  type CommunicationMatrixEntry,
  type CompanyContact,
  type ContractAmendment, type InsertContractAmendment,
  type UserProfile, type InsertUserProfile,
  type PermissionGroup, type InsertPermissionGroup,
  type Permission, type InsertPermission,
  type AuditLog, type InsertAuditLog,
} from "@shared/schema";
import { eq, and, or, ne, like, sql, lte } from "drizzle-orm";

export interface IStorage {
  generateUID(stateCode: string, continentCode?: string): Promise<string>;

  getContinents(): Promise<{ id: number; name: string; code: string }[]>;
  getStates(continentId?: number): Promise<{ id: number; name: string; code: string; flagUrl: string | null; continentId: number }[]>;
  createState(data: { continentId: number; name: string; code: string; flagUrl?: string }): Promise<{ id: number; name: string; code: string; flagUrl: string | null; continentId: number }>;
  
  getMyCompanies(includeDeleted?: boolean): Promise<MyCompany[]>;
  getMyCompany(id: number): Promise<MyCompany | undefined>;
  createMyCompany(company: InsertMyCompany): Promise<MyCompany>;
  updateMyCompany(id: number, updates: UpdateMyCompanyRequest): Promise<MyCompany>;
  softDeleteMyCompany(id: number, deletedBy: string, ip: string): Promise<void>;

  getCompanyOfficers(companyId: number, includeInactive?: boolean): Promise<CompanyOfficer[]>;
  createCompanyOfficer(data: InsertCompanyOfficer): Promise<CompanyOfficer>;
  updateCompanyOfficer(id: number, data: Partial<InsertCompanyOfficer>): Promise<CompanyOfficer>;
  deleteCompanyOfficer(id: number): Promise<void>;
  autoArchiveExpiredBindings(): Promise<void>;
  
  getPartners(includeDeleted?: boolean): Promise<Partner[]>;
  getPartner(id: number): Promise<Partner | undefined>;
  createPartner(partner: InsertPartner): Promise<Partner>;
  updatePartner(id: number, updates: UpdatePartnerRequest): Promise<Partner>;
  softDeletePartner(id: number, deletedBy: string, ip: string): Promise<void>;

  getPartnerContracts(partnerId: number): Promise<PartnerContract[]>;
  createPartnerContract(data: InsertPartnerContract): Promise<PartnerContract>;
  deletePartnerContract(id: number): Promise<void>;

  getPartnerContacts(partnerId: number, includeInactive?: boolean): Promise<PartnerContact[]>;
  createPartnerContact(data: InsertPartnerContact): Promise<PartnerContact>;
  updatePartnerContact(id: number, data: Partial<InsertPartnerContact>): Promise<PartnerContact>;
  deletePartnerContact(id: number): Promise<void>;
  swapContactForProduct(oldContactId: number, newContactData: InsertPartnerContact, productId: number): Promise<PartnerContact>;

  getPartnerProducts(partnerId: number): Promise<PartnerProduct[]>;
  createPartnerProduct(data: InsertPartnerProduct): Promise<PartnerProduct>;
  deletePartnerProduct(id: number): Promise<void>;

  getContactProductAssignments(contactId: number): Promise<{ id: number; contactId: number; productId: number }[]>;
  setContactProductAssignments(contactId: number, productIds: number[]): Promise<void>;

  getCommunicationMatrix(partnerId: number): Promise<CommunicationMatrixEntry[]>;
  createMatrixEntry(data: Omit<CommunicationMatrixEntry, "id" | "createdAt">): Promise<CommunicationMatrixEntry>;
  deleteMatrixEntry(id: number): Promise<void>;
  
  getContacts(): Promise<Contact[]>;
  createContact(contact: Omit<Contact, "id">): Promise<Contact>;
  
  getSubjects(params?: { search?: string; type?: 'person' | 'company'; isActive?: boolean }): Promise<Subject[]>;
  getSubject(id: number): Promise<Subject | undefined>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  updateSubject(id: number, updates: UpdateSubjectRequest): Promise<Subject>;
  archiveSubject(id: number, reason: string): Promise<void>;
  
  getProducts(includeDeleted?: boolean): Promise<Product[]>;
  getProduct(id: number): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product>;
  softDeleteProduct(id: number, deletedBy: string, ip: string): Promise<void>;
  getProductsByPartner(partnerId: number): Promise<Product[]>;
  getCommissions(productId?: number): Promise<CommissionScheme[]>;
  createCommission(commission: InsertCommissionScheme): Promise<CommissionScheme>;

  getSubjectCareerHistory(subjectId: number): Promise<{
    type: 'internal' | 'external';
    entityName: string;
    role: string;
    validFrom: Date | null;
    validTo: Date | null;
    isActive: boolean;
  }[]>;

  getContractAmendments(contractId: number): Promise<ContractAmendment[]>;
  createContractAmendment(data: InsertContractAmendment): Promise<ContractAmendment>;
  deleteContractAmendment(id: number): Promise<void>;

  getUserProfile(appUserId: number): Promise<UserProfile | undefined>;
  upsertUserProfile(data: InsertUserProfile): Promise<UserProfile>;

  getAppUserByReplitId(replitId: string): Promise<AppUser | undefined>;
  getAppUsers(): Promise<AppUser[]>;
  createAppUser(data: InsertAppUser): Promise<AppUser>;
  updateAppUser(id: number, data: Partial<AppUser>): Promise<AppUser>;
  updateAppUserWithArchive(id: number, data: Partial<AppUser>, reason: string): Promise<AppUser>;

  getPermissionGroups(): Promise<PermissionGroup[]>;
  createPermissionGroup(data: InsertPermissionGroup): Promise<PermissionGroup>;
  updatePermissionGroup(id: number, data: Partial<InsertPermissionGroup>): Promise<PermissionGroup>;
  deletePermissionGroup(id: number): Promise<void>;

  getPermissions(groupId: number): Promise<Permission[]>;
  getAllPermissions(): Promise<Permission[]>;
  setPermission(data: InsertPermission): Promise<Permission>;
  syncPermissionsTable(): Promise<void>;

  getAuditLogs(filters?: { userId?: number; module?: string; action?: string; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }): Promise<AuditLog[]>;
  getAuditLogCount(filters?: { userId?: number; module?: string; action?: string; dateFrom?: string; dateTo?: string }): Promise<number>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;
}

export class DatabaseStorage implements IStorage {

  async generateUID(stateCode: string, continentCode?: string): Promise<string> {
    const result = await db.execute(
      sql`UPDATE global_counters SET current_value = current_value + 1 WHERE counter_name = 'entity_sequence' RETURNING current_value`
    );
    const currentValue = Number(result.rows[0].current_value);
    const padded = currentValue.toString().padStart(12, '0');
    const formatted = padded.match(/.{1,3}/g)!.join(' ');
    const continent = continentCode || '01';
    return `01-${continent}-${stateCode}-${formatted}`;
  }

  async getContinents() {
    return await db.select().from(continents);
  }
  
  async getStates(continentId?: number) {
    if (continentId) {
      return await db.select().from(states).where(eq(states.continentId, continentId));
    }
    return await db.select().from(states);
  }

  async createState(data: { continentId: number; name: string; code: string; flagUrl?: string }) {
    const [newState] = await db.insert(states).values({
      continentId: data.continentId,
      name: data.name,
      code: data.code,
      flagUrl: data.flagUrl || null,
    }).returning();
    return newState;
  }

  async getMyCompanies(includeDeleted?: boolean) {
    if (includeDeleted) {
      return await db.select().from(myCompanies);
    }
    return await db.select().from(myCompanies).where(eq(myCompanies.isDeleted, false));
  }

  async getMyCompany(id: number) {
    const [company] = await db.select().from(myCompanies).where(and(eq(myCompanies.id, id), eq(myCompanies.isDeleted, false)));
    return company;
  }

  async createMyCompany(company: InsertMyCompany) {
    const [newCompany] = await db.insert(myCompanies).values(company as any).returning();
    return newCompany;
  }

  async updateMyCompany(id: number, updates: UpdateMyCompanyRequest) {
    const original = await this.getMyCompany(id);
    if (!original) throw new Error("Company not found");
    
    await db.insert(companyArchive).values({
      originalId: id,
      data: original as any,
      reason: updates.changeReason || "Update",
    });

    const { changeReason, ...companyUpdates } = updates;
    const [updated] = await db.update(myCompanies)
      .set({ ...companyUpdates, updatedAt: new Date() } as any)
      .where(eq(myCompanies.id, id))
      .returning();
      
    return updated;
  }

  async softDeleteMyCompany(id: number, deletedBy: string, ip: string) {
    const original = await this.getMyCompany(id);
    if (!original) throw new Error("Company not found");
    
    await db.insert(companyArchive).values({
      originalId: id,
      data: original as any,
      reason: "Soft Delete",
    });
    
    await db.update(myCompanies).set({ 
      isDeleted: true,
      deletedBy,
      deletedAt: new Date(),
      deletedFromIp: ip,
    }).where(eq(myCompanies.id, id));
  }

  async getCompanyOfficers(companyId: number, includeInactive?: boolean) {
    if (includeInactive) {
      return await db.select().from(companyOfficers).where(eq(companyOfficers.companyId, companyId));
    }
    return await db.select().from(companyOfficers).where(and(eq(companyOfficers.companyId, companyId), eq(companyOfficers.isActive, true)));
  }

  async createCompanyOfficer(data: InsertCompanyOfficer) {
    const [officer] = await db.insert(companyOfficers).values(data).returning();
    return officer;
  }

  async updateCompanyOfficer(id: number, data: Partial<InsertCompanyOfficer>) {
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value;
    }
    if (updateData.validTo) {
      const validToDate = new Date(updateData.validTo);
      if (validToDate <= new Date()) {
        updateData.isActive = false;
      }
    }
    const [updated] = await db.update(companyOfficers).set(updateData).where(eq(companyOfficers.id, id)).returning();
    return updated;
  }

  async deleteCompanyOfficer(id: number) {
    await db.delete(companyOfficers).where(eq(companyOfficers.id, id));
  }

  async autoArchiveExpiredBindings() {
    const now = new Date();
    await db.update(companyOfficers)
      .set({ isActive: false })
      .where(and(eq(companyOfficers.isActive, true), lte(companyOfficers.validTo, now)));
    await db.update(partnerContacts)
      .set({ isActive: false })
      .where(and(eq(partnerContacts.isActive, true), lte(partnerContacts.validTo, now)));
    await db.update(companyContacts)
      .set({ isActive: false })
      .where(and(eq(companyContacts.isActive, true), lte(companyContacts.validTo, now)));
  }

  async getPartners(includeDeleted?: boolean) {
    if (includeDeleted) {
      return await db.select().from(partners);
    }
    return await db.select().from(partners).where(eq(partners.isDeleted, false));
  }

  async getPartner(id: number) {
    const [partner] = await db.select().from(partners).where(eq(partners.id, id));
    return partner;
  }

  async createPartner(partner: InsertPartner) {
    const stateCode = partner.code || '000';
    const uid = await this.generateUID(stateCode);
    const [newPartner] = await db.insert(partners).values({ ...partner, uid } as any).returning();
    return newPartner;
  }

  async updatePartner(id: number, updates: UpdatePartnerRequest) {
    const original = await this.getPartner(id);
    if (!original) throw new Error("Partner not found");

    await db.insert(companyArchive).values({
      originalId: id,
      data: original as any,
      reason: updates.changeReason || "Partner Update",
    });

    const { changeReason, ...partnerUpdates } = updates;
    const [updated] = await db.update(partners)
      .set({ ...partnerUpdates, updatedAt: new Date() } as any)
      .where(eq(partners.id, id))
      .returning();

    return updated;
  }

  async softDeletePartner(id: number, deletedBy: string, ip: string) {
    const original = await this.getPartner(id);
    if (!original) throw new Error("Partner not found");

    await db.insert(companyArchive).values({
      originalId: id,
      data: original as any,
      reason: "Soft Delete",
    });

    await db.update(partners).set({
      isDeleted: true,
      deletedBy,
      deletedAt: new Date(),
      deletedFromIp: ip,
    }).where(eq(partners.id, id));
  }

  async getPartnerContracts(partnerId: number) {
    return await db.select().from(partnerContracts).where(eq(partnerContracts.partnerId, partnerId));
  }

  async createPartnerContract(data: InsertPartnerContract) {
    const [contract] = await db.insert(partnerContracts).values(data as any).returning();
    return contract;
  }

  async deletePartnerContract(id: number) {
    await db.delete(partnerContracts).where(eq(partnerContracts.id, id));
  }

  async getPartnerContacts(partnerId: number, includeInactive?: boolean) {
    if (includeInactive) {
      return await db.select().from(partnerContacts).where(eq(partnerContacts.partnerId, partnerId));
    }
    return await db.select().from(partnerContacts).where(and(eq(partnerContacts.partnerId, partnerId), eq(partnerContacts.isActive, true)));
  }

  async createPartnerContact(data: InsertPartnerContact) {
    const insertData: any = { ...data };
    if (insertData.validTo) {
      const validToDate = new Date(insertData.validTo);
      if (validToDate <= new Date()) {
        insertData.isActive = false;
      }
    }
    const [contact] = await db.insert(partnerContacts).values(insertData).returning();
    return contact;
  }

  async updatePartnerContact(id: number, data: Partial<InsertPartnerContact>) {
    const updateData: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updateData[key] = value;
    }
    if (updateData.validTo) {
      const validToDate = new Date(updateData.validTo);
      if (validToDate <= new Date()) {
        updateData.isActive = false;
      }
    }
    const [updated] = await db.update(partnerContacts).set(updateData).where(eq(partnerContacts.id, id)).returning();
    return updated;
  }

  async deletePartnerContact(id: number) {
    await db.delete(contactProductAssignments).where(eq(contactProductAssignments.contactId, id));
    await db.delete(partnerContacts).where(eq(partnerContacts.id, id));
  }

  async swapContactForProduct(oldContactId: number, newContactData: InsertPartnerContact, productId: number) {
    await this.updatePartnerContact(oldContactId, { validTo: new Date() as any, isActive: false } as any);
    await db.delete(contactProductAssignments).where(
      and(eq(contactProductAssignments.contactId, oldContactId), eq(contactProductAssignments.productId, productId))
    );
    const newContact = await this.createPartnerContact(newContactData);
    await db.insert(contactProductAssignments).values({ contactId: newContact.id, productId });
    return newContact;
  }

  async getPartnerProducts(partnerId: number) {
    return await db.select().from(partnerProducts).where(eq(partnerProducts.partnerId, partnerId));
  }

  async createPartnerProduct(data: InsertPartnerProduct) {
    const [product] = await db.insert(partnerProducts).values(data).returning();
    return product;
  }

  async deletePartnerProduct(id: number) {
    await db.delete(contactProductAssignments).where(eq(contactProductAssignments.productId, id));
    await db.delete(partnerProducts).where(eq(partnerProducts.id, id));
  }

  async getContactProductAssignments(contactId: number) {
    return await db.select().from(contactProductAssignments).where(eq(contactProductAssignments.contactId, contactId));
  }

  async setContactProductAssignments(contactId: number, productIds: number[]) {
    await db.delete(contactProductAssignments).where(eq(contactProductAssignments.contactId, contactId));
    if (productIds.length > 0) {
      await db.insert(contactProductAssignments).values(
        productIds.map(productId => ({ contactId, productId }))
      );
    }
  }

  async getCommunicationMatrix(partnerId: number) {
    return await db.select().from(communicationMatrix).where(eq(communicationMatrix.partnerId, partnerId));
  }

  async createMatrixEntry(data: Omit<CommunicationMatrixEntry, "id" | "createdAt">) {
    const [entry] = await db.insert(communicationMatrix).values(data).returning();
    return entry;
  }

  async deleteMatrixEntry(id: number) {
    await db.delete(communicationMatrix).where(eq(communicationMatrix.id, id));
  }

  async getContacts() {
    return await db.select().from(contacts);
  }
  
  async createContact(contact: Omit<Contact, "id">) {
    const [newContact] = await db.insert(contacts).values(contact).returning();
    return newContact;
  }

  async getSubjects(params?: { search?: string; type?: 'person' | 'company'; isActive?: boolean }) {
    let query = db.select().from(subjects);
    const conditions = [];
    
    if (params?.search) {
      conditions.push(
        or(
          like(subjects.firstName, `%${params.search}%`),
          like(subjects.lastName, `%${params.search}%`),
          like(subjects.companyName, `%${params.search}%`),
          like(subjects.uid, `%${params.search}%`)
        )
      );
    }
    if (params?.type) conditions.push(eq(subjects.type, params.type));
    if (params?.isActive !== undefined) conditions.push(eq(subjects.isActive, params.isActive));
    
    if (conditions.length > 0) return await query.where(and(...conditions));
    return await query;
  }

  async getSubject(id: number) {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id));
    return subject;
  }

  async createSubject(insertSubject: InsertSubject) {
    const continent = insertSubject.continentId ? await db.select().from(continents).where(eq(continents.id, insertSubject.continentId)).then(r => r[0]) : null;
    const state = insertSubject.stateId ? await db.select().from(states).where(eq(states.id, insertSubject.stateId)).then(r => r[0]) : null;
    const company = insertSubject.myCompanyId ? await db.select().from(myCompanies).where(eq(myCompanies.id, insertSubject.myCompanyId)).then(r => r[0]) : null;
    
    if (!continent || !state || !company) {
      throw new Error("Invalid hierarchy references for UID generation");
    }

    const uid = await this.generateUID(state.code, continent.code);
    
    const [subject] = await db.insert(subjects).values({ ...insertSubject, uid }).returning();
    return subject;
  }

  async updateSubject(id: number, updates: UpdateSubjectRequest) {
    const original = await this.getSubject(id);
    if (!original) throw new Error("Subject not found");
    
    await db.insert(subjectArchive).values({
      originalId: id,
      uid: original.uid,
      data: original as any,
      reason: updates.changeReason || "Update",
    });

    const { changeReason, ...subjectUpdates } = updates;
    const [updated] = await db.update(subjects).set(subjectUpdates).where(eq(subjects.id, id)).returning();
    return updated;
  }
  
  async archiveSubject(id: number, reason: string) {
    const original = await this.getSubject(id);
    if (!original) throw new Error("Subject not found");
    
    await db.insert(subjectArchive).values({
      originalId: id,
      uid: original.uid,
      data: original as any,
      reason,
    });
    await db.update(subjects).set({ isActive: false }).where(eq(subjects.id, id));
  }

  async getProducts(includeDeleted?: boolean) {
    if (includeDeleted) return await db.select().from(products);
    return await db.select().from(products).where(eq(products.isDeleted, false));
  }

  async getProduct(id: number) {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(product: InsertProduct) {
    const company = product.companyId ? await this.getMyCompany(product.companyId) : null;
    const state = product.stateId ? await db.select().from(states).where(eq(states.id, product.stateId)).then(r => r[0]) : null;
    const displayName = `${company?.code || '???'} - ${state?.code || '???'} - ${product.code}`;
    const [newProduct] = await db.insert(products).values({ ...product, displayName }).returning();
    return newProduct;
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>) {
    const original = await this.getProduct(id);
    if (!original) throw new Error("Product not found");
    await db.insert(companyArchive).values({
      originalId: id,
      data: original as any,
      reason: "Product Update",
    });
    if (updates.companyId || updates.stateId || updates.code) {
      const companyId = updates.companyId || original.companyId;
      const stateId = updates.stateId || original.stateId;
      const code = updates.code || original.code;
      const company = companyId ? await this.getMyCompany(companyId) : null;
      const state = stateId ? await db.select().from(states).where(eq(states.id, stateId)).then(r => r[0]) : null;
      (updates as any).displayName = `${company?.code || '???'} - ${state?.code || '???'} - ${code}`;
    }
    const [updated] = await db.update(products).set({ ...updates, updatedAt: new Date() } as any).where(eq(products.id, id)).returning();
    return updated;
  }

  async softDeleteProduct(id: number, deletedBy: string, ip: string) {
    const original = await this.getProduct(id);
    if (!original) throw new Error("Product not found");
    await db.insert(companyArchive).values({
      originalId: id,
      data: original as any,
      reason: "Soft Delete Product",
    });
    await db.update(products).set({
      isDeleted: true,
      deletedBy,
      deletedAt: new Date(),
      deletedFromIp: ip,
    }).where(eq(products.id, id));
  }

  async getProductsByPartner(partnerId: number) {
    return await db.select().from(products).where(and(eq(products.partnerId, partnerId), eq(products.isDeleted, false)));
  }

  async getCommissions(productId?: number) {
    if (productId) return await db.select().from(commissionSchemes).where(eq(commissionSchemes.productId, productId));
    return await db.select().from(commissionSchemes);
  }

  async createCommission(commission: InsertCommissionScheme) {
    const [newCommission] = await db.insert(commissionSchemes).values(commission).returning();
    return newCommission;
  }

  async getSubjectCareerHistory(subjectId: number) {
    const history: {
      type: 'internal' | 'external';
      entityName: string;
      role: string;
      validFrom: Date | null;
      validTo: Date | null;
      isActive: boolean;
    }[] = [];

    const officerRecords = await db.select().from(companyOfficers).where(eq(companyOfficers.subjectId, subjectId));
    for (const o of officerRecords) {
      const [company] = await db.select().from(myCompanies).where(eq(myCompanies.id, o.companyId));
      history.push({
        type: 'internal',
        entityName: company?.name || `Firma #${o.companyId}`,
        role: `Interny kontakt - ${o.type}`,
        validFrom: o.validFrom,
        validTo: o.validTo,
        isActive: o.isActive ?? true,
      });
    }

    const contactRecords = await db.select().from(partnerContacts).where(eq(partnerContacts.subjectId, subjectId));
    for (const c of contactRecords) {
      const [partner] = await db.select().from(partners).where(eq(partners.id, c.partnerId));
      history.push({
        type: 'external',
        entityName: partner?.name || `Partner #${c.partnerId}`,
        role: `Externy kontakt${c.position ? ` - ${c.position}` : ''}`,
        validFrom: c.validFrom,
        validTo: c.validTo,
        isActive: c.isActive ?? true,
      });
    }

    const internalContacts = await db.select().from(companyContacts).where(eq(companyContacts.subjectId, subjectId));
    for (const ic of internalContacts) {
      const [company] = await db.select().from(myCompanies).where(eq(myCompanies.id, ic.companyId));
      history.push({
        type: 'internal',
        entityName: company?.name || `Firma #${ic.companyId}`,
        role: `Interny kontakt - ${ic.contactType}`,
        validFrom: ic.validFrom,
        validTo: ic.validTo,
        isActive: ic.isActive ?? true,
      });
    }

    history.sort((a, b) => {
      const aDate = a.validFrom ? new Date(a.validFrom).getTime() : 0;
      const bDate = b.validFrom ? new Date(b.validFrom).getTime() : 0;
      return bDate - aDate;
    });

    return history;
  }

  async getContractAmendments(contractId: number) {
    return await db.select().from(contractAmendments).where(eq(contractAmendments.contractId, contractId));
  }

  async createContractAmendment(data: InsertContractAmendment) {
    const [amendment] = await db.insert(contractAmendments).values(data as any).returning();
    return amendment;
  }

  async deleteContractAmendment(id: number) {
    await db.delete(contractAmendments).where(eq(contractAmendments.id, id));
  }

  async getUserProfile(appUserId: number) {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.appUserId, appUserId));
    return profile;
  }

  async upsertUserProfile(data: InsertUserProfile) {
    if (data.appUserId) {
      const existing = await this.getUserProfile(data.appUserId);
      if (existing) {
        const [updated] = await db.update(userProfiles)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(userProfiles.id, existing.id))
          .returning();
        return updated;
      }
    }
    const [created] = await db.insert(userProfiles).values(data).returning();
    return created;
  }

  async getAppUserByReplitId(replitId: string) {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.replitId, replitId));
    return user;
  }

  async getAppUsers() {
    return await db.select().from(appUsers);
  }

  async createAppUser(data: InsertAppUser) {
    const [user] = await db.insert(appUsers).values(data).returning();
    return user;
  }

  async updateAppUser(id: number, data: Partial<AppUser>) {
    const filtered: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        filtered[key] = value;
      }
    }
    const [updated] = await db.update(appUsers).set(filtered).where(eq(appUsers.id, id)).returning();
    return updated;
  }

  async updateAppUserWithArchive(id: number, data: Partial<AppUser>, reason: string) {
    const [original] = await db.select().from(appUsers).where(eq(appUsers.id, id));
    if (!original) throw new Error("App user not found");
    await db.insert(appUserArchive).values({
      originalId: id,
      data: original as any,
      reason,
    });
    return await this.updateAppUser(id, data);
  }

  async getPermissionGroups() {
    return await db.select().from(permissionGroups);
  }

  async createPermissionGroup(data: InsertPermissionGroup) {
    const [group] = await db.insert(permissionGroups).values(data).returning();
    await this.syncPermissionsTable();
    return group;
  }

  async updatePermissionGroup(id: number, data: Partial<InsertPermissionGroup>) {
    const [updated] = await db.update(permissionGroups).set(data).where(eq(permissionGroups.id, id)).returning();
    return updated;
  }

  async deletePermissionGroup(id: number) {
    await db.delete(permissions).where(eq(permissions.groupId, id));
    await db.delete(permissionGroups).where(eq(permissionGroups.id, id));
  }

  async getPermissions(groupId: number) {
    return await db.select().from(permissions).where(eq(permissions.groupId, groupId));
  }

  async getAllPermissions() {
    return await db.select().from(permissions);
  }

  async setPermission(data: InsertPermission) {
    const existing = await db.select().from(permissions)
      .where(and(eq(permissions.groupId, data.groupId), eq(permissions.module, data.module)));
    if (existing.length > 0) {
      const [updated] = await db.update(permissions)
        .set(data)
        .where(eq(permissions.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(permissions).values(data).returning();
    return created;
  }

  async syncPermissionsTable() {
    const MODULES = [
      'dashboard', 'spolocnosti', 'partneri', 'produkty',
      'provizie', 'subjekty', 'nastavenia', 'historia',
      'pouzivatelia', 'skupiny_pravomoci'
    ];
    const groups = await this.getPermissionGroups();
    for (const group of groups) {
      const existing = await this.getPermissions(group.id);
      const existingModules = existing.map(p => p.module);
      const missing = MODULES.filter(m => !existingModules.includes(m));
      for (const module of missing) {
        await db.insert(permissions).values({
          groupId: group.id,
          module,
          canRead: false,
          canCreate: false,
          canEdit: false,
          canPublish: false,
          canDelete: false,
        });
      }
    }
  }

  async getAuditLogs(filters?: { userId?: number; module?: string; action?: string; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }): Promise<AuditLog[]> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters?.module) conditions.push(eq(auditLogs.module, filters.module));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters?.dateFrom) conditions.push(sql`${auditLogs.createdAt} >= ${filters.dateFrom}::timestamp`);
    if (filters?.dateTo) conditions.push(sql`${auditLogs.createdAt} <= ${filters.dateTo}::timestamp + interval '1 day'`);

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    if (conditions.length === 0) {
      return await db.select().from(auditLogs).orderBy(sql`${auditLogs.createdAt} DESC`).limit(limit).offset(offset);
    }
    return await db.select().from(auditLogs).where(and(...conditions)).orderBy(sql`${auditLogs.createdAt} DESC`).limit(limit).offset(offset);
  }

  async getAuditLogCount(filters?: { userId?: number; module?: string; action?: string; dateFrom?: string; dateTo?: string }): Promise<number> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters?.module) conditions.push(eq(auditLogs.module, filters.module));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters?.dateFrom) conditions.push(sql`${auditLogs.createdAt} >= ${filters.dateFrom}::timestamp`);
    if (filters?.dateTo) conditions.push(sql`${auditLogs.createdAt} <= ${filters.dateTo}::timestamp + interval '1 day'`);

    const result = conditions.length === 0
      ? await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs)
      : await db.select({ count: sql<number>`count(*)::int` }).from(auditLogs).where(and(...conditions));
    return result[0]?.count || 0;
  }

  async createAuditLog(data: InsertAuditLog): Promise<AuditLog> {
    const [log] = await db.insert(auditLogs).values(data).returning();
    return log;
  }
}

export const storage = new DatabaseStorage();
