import { db } from "./db";
import { 
  subjects, myCompanies, partners, contacts, products, commissionSchemes, continents, states, subjectArchive, companyArchive, appUsers,
  type Subject, type InsertSubject, 
  type MyCompany, type InsertMyCompany,
  type Partner, 
  type Contact, 
  type Product, 
  type CommissionScheme,
  type UpdateSubjectRequest, type UpdateMyCompanyRequest,
  type AppUser
} from "@shared/schema";
import { eq, like, and, or, ne } from "drizzle-orm";

export interface IStorage {
  getContinents(): Promise<{ id: number; name: string; code: string }[]>;
  getStates(continentId?: number): Promise<{ id: number; name: string; code: string; flagUrl: string | null; continentId: number }[]>;
  
  getMyCompanies(): Promise<MyCompany[]>;
  getMyCompany(id: number): Promise<MyCompany | undefined>;
  createMyCompany(company: InsertMyCompany): Promise<MyCompany>;
  updateMyCompany(id: number, updates: UpdateMyCompanyRequest): Promise<MyCompany>;
  softDeleteMyCompany(id: number): Promise<void>;
  
  getPartners(): Promise<Partner[]>;
  createPartner(partner: Omit<Partner, "id">): Promise<Partner>;
  
  getContacts(): Promise<Contact[]>;
  createContact(contact: Omit<Contact, "id">): Promise<Contact>;
  
  getSubjects(params?: { search?: string; type?: 'person' | 'company'; isActive?: boolean }): Promise<Subject[]>;
  getSubject(id: number): Promise<Subject | undefined>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  updateSubject(id: number, updates: UpdateSubjectRequest): Promise<Subject>;
  archiveSubject(id: number, reason: string): Promise<void>;
  
  getProducts(): Promise<Product[]>;
  createProduct(product: Omit<Product, "id">): Promise<Product>;
  getCommissions(productId?: number): Promise<CommissionScheme[]>;
  createCommission(commission: Omit<CommissionScheme, "id">): Promise<CommissionScheme>;

  getAppUserByReplitId(replitId: string): Promise<AppUser | undefined>;
  updateAppUser(id: number, data: Partial<AppUser>): Promise<AppUser>;
}

export class DatabaseStorage implements IStorage {
  async getContinents() {
    return await db.select().from(continents);
  }
  
  async getStates(continentId?: number) {
    if (continentId) {
      return await db.select().from(states).where(eq(states.continentId, continentId));
    }
    return await db.select().from(states);
  }

  async getMyCompanies() {
    return await db.select().from(myCompanies).where(eq(myCompanies.isDeleted, false));
  }

  async getMyCompany(id: number) {
    const [company] = await db.select().from(myCompanies).where(and(eq(myCompanies.id, id), eq(myCompanies.isDeleted, false)));
    return company;
  }

  async createMyCompany(company: InsertMyCompany) {
    const [newCompany] = await db.insert(myCompanies).values(company).returning();
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
      .set({ ...companyUpdates, updatedAt: new Date() })
      .where(eq(myCompanies.id, id))
      .returning();
      
    return updated;
  }

  async softDeleteMyCompany(id: number) {
    const original = await this.getMyCompany(id);
    if (!original) throw new Error("Company not found");
    
    await db.insert(companyArchive).values({
      originalId: id,
      data: original as any,
      reason: "Soft Delete",
    });
    
    await db.update(myCompanies).set({ isDeleted: true }).where(eq(myCompanies.id, id));
  }

  async getPartners() {
    return await db.select().from(partners);
  }

  async createPartner(partner: Omit<Partner, "id">) {
    const [newPartner] = await db.insert(partners).values(partner).returning();
    return newPartner;
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

    const randomPart = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0').match(/.{1,3}/g)?.join(' ') || '000 000 000';
    const uid = `${continent.code}-${company.code}-${state.code}-${randomPart}`;
    
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

  async getProducts() {
    return await db.select().from(products);
  }

  async createProduct(product: Omit<Product, "id">) {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async getCommissions(productId?: number) {
    if (productId) return await db.select().from(commissionSchemes).where(eq(commissionSchemes.productId, productId));
    return await db.select().from(commissionSchemes);
  }

  async createCommission(commission: Omit<CommissionScheme, "id">) {
    const [newCommission] = await db.insert(commissionSchemes).values(commission).returning();
    return newCommission;
  }

  async getAppUserByReplitId(replitId: string) {
    const [user] = await db.select().from(appUsers).where(eq(appUsers.replitId, replitId));
    return user;
  }

  async updateAppUser(id: number, data: Partial<AppUser>) {
    const [updated] = await db.update(appUsers).set(data).where(eq(appUsers.id, id)).returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
