import { db } from "./db";
import { 
  subjects, myCompanies, partners, contacts, products, commissionSchemes, continents, states, subjectArchive,
  type Subject, type InsertSubject, 
  type MyCompany, 
  type Partner, 
  type Contact, 
  type Product, 
  type CommissionScheme,
  type CreateSubjectRequest, type UpdateSubjectRequest
} from "@shared/schema";
import { eq, like, and, or } from "drizzle-orm";

export interface IStorage {
  // Hierarchy
  getContinents(): Promise<{ id: number; name: string; code: string }[]>;
  getStates(continentId?: number): Promise<{ id: number; name: string; code: string; flagUrl: string | null }[]>;
  
  // My Companies
  getMyCompanies(): Promise<MyCompany[]>;
  createMyCompany(company: Omit<MyCompany, "id">): Promise<MyCompany>;
  
  // Partners
  getPartners(): Promise<Partner[]>;
  createPartner(partner: Omit<Partner, "id">): Promise<Partner>;
  
  // Contacts
  getContacts(): Promise<Contact[]>;
  createContact(contact: Omit<Contact, "id">): Promise<Contact>;
  
  // Subjects
  getSubjects(params?: { search?: string; type?: 'person' | 'company'; isActive?: boolean }): Promise<Subject[]>;
  getSubject(id: number): Promise<Subject | undefined>;
  getSubjectByUid(uid: string): Promise<Subject | undefined>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  updateSubject(id: number, updates: UpdateSubjectRequest): Promise<Subject>;
  archiveSubject(id: number, reason: string): Promise<void>;
  
  // Products & Commissions
  getProducts(): Promise<Product[]>;
  createProduct(product: Omit<Product, "id">): Promise<Product>;
  getCommissions(productId?: number): Promise<CommissionScheme[]>;
  createCommission(commission: Omit<CommissionScheme, "id">): Promise<CommissionScheme>;
}

export class DatabaseStorage implements IStorage {
  // Hierarchy
  async getContinents() {
    return await db.select().from(continents);
  }
  
  async getStates(continentId?: number) {
    if (continentId) {
      return await db.select().from(states).where(eq(states.continentId, continentId));
    }
    return await db.select().from(states);
  }

  // My Companies
  async getMyCompanies() {
    return await db.select().from(myCompanies);
  }

  async createMyCompany(company: Omit<MyCompany, "id">) {
    const [newCompany] = await db.insert(myCompanies).values(company).returning();
    return newCompany;
  }

  // Partners
  async getPartners() {
    return await db.select().from(partners);
  }

  async createPartner(partner: Omit<Partner, "id">) {
    const [newPartner] = await db.insert(partners).values(partner).returning();
    return newPartner;
  }
  
  // Contacts
  async getContacts() {
    return await db.select().from(contacts);
  }
  
  async createContact(contact: Omit<Contact, "id">) {
    const [newContact] = await db.insert(contacts).values(contact).returning();
    return newContact;
  }

  // Subjects
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
    
    if (params?.type) {
      conditions.push(eq(subjects.type, params.type));
    }
    
    if (params?.isActive !== undefined) {
      conditions.push(eq(subjects.isActive, params.isActive));
    }
    
    if (conditions.length > 0) {
      return await query.where(and(...conditions));
    }
    
    return await query;
  }

  async getSubject(id: number) {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id));
    return subject;
  }

  async getSubjectByUid(uid: string) {
    const [subject] = await db.select().from(subjects).where(eq(subjects.uid, uid));
    return subject;
  }

  async createSubject(insertSubject: InsertSubject) {
    // Generate UID Logic
    // UID Format: [ContinentCode]-[MyCompanyCode]-[StateCode]-[RandomDigits]
    // 01-01-421-000 000 000 000
    // Fetch codes
    const continent = await db.select().from(continents).where(eq(continents.id, insertSubject.continentId || 0)).then(res => res[0]);
    const state = await db.select().from(states).where(eq(states.id, insertSubject.stateId || 0)).then(res => res[0]);
    const company = await db.select().from(myCompanies).where(eq(myCompanies.id, insertSubject.myCompanyId || 0)).then(res => res[0]);
    
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
    
    // Archive original
    await db.insert(subjectArchive).values({
      originalId: id,
      uid: original.uid,
      data: original as any,
      reason: updates.changeReason || "Update",
    });

    // Update current
    const { changeReason, ...subjectUpdates } = updates;
    const [updated] = await db.update(subjects)
      .set({ ...subjectUpdates })
      .where(eq(subjects.id, id))
      .returning();
      
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

  // Products & Commissions
  async getProducts() {
    return await db.select().from(products);
  }

  async createProduct(product: Omit<Product, "id">) {
    const [newProduct] = await db.insert(products).values(product).returning();
    return newProduct;
  }

  async getCommissions(productId?: number) {
    if (productId) {
      return await db.select().from(commissionSchemes).where(eq(commissionSchemes.productId, productId));
    }
    return await db.select().from(commissionSchemes);
  }

  async createCommission(commission: Omit<CommissionScheme, "id">) {
    const [newCommission] = await db.insert(commissionSchemes).values(commission).returning();
    return newCommission;
  }
}

export const storage = new DatabaseStorage();
