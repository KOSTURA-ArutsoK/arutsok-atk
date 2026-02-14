import { db } from "./db";
import { 
  subjects, myCompanies, partners, contacts, products, commissionSchemes, 
  continents, states, subjectArchive, companyArchive, appUsers, appUserArchive,
  companyOfficers, partnerContracts, partnerContacts, partnerProducts,
  contactProductAssignments, communicationMatrix, globalCounters,
  companyContacts, contractAmendments, userProfiles,
  permissionGroups, permissions, auditLogs,
  systemSettings, verificationCodes, categoryTimeouts, dashboardPreferences, userDashboardLayouts,
  commissionRates, commissionCalculationLogs,
  type Subject, type InsertSubject, 
  type MyCompany, type InsertMyCompany,
  type Partner, type InsertPartner,
  type Contact, 
  type Product, type InsertProduct,
  type CommissionScheme, type InsertCommissionScheme,
  type CommissionRate, type InsertCommissionRate,
  type CommissionCalculationLog, type InsertCommissionCalculationLog,
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
  type SystemSetting, type VerificationCode,
  type CategoryTimeout, type InsertCategoryTimeout,
  type DashboardPreference, type InsertDashboardPreference,
  type UserDashboardLayout,
  type ClientType, type InsertClientType,
  type ClientTypeSection, type InsertClientTypeSection,
  type ClientTypeField, type InsertClientTypeField,
  clientTypes, clientTypeSections, clientTypeFields,
  contractStatuses, contractTemplates, contractInventories, contracts, contractPasswords, contractParameterValues,
  type ContractStatus, type InsertContractStatus,
  type ContractTemplate, type InsertContractTemplate,
  type ContractInventory, type InsertContractInventory,
  type Contract, type InsertContract,
  type ContractPassword, type InsertContractPassword,
  type ContractParameterValue, type InsertContractParameterValue,
  clientGroups, clientSubGroups, clientGroupMembers,
  type ClientGroup, type InsertClientGroup,
  type ClientSubGroup, type InsertClientSubGroup,
  type ClientGroupMember, type InsertClientGroupMember,
  supisky, supiskaContracts,
  type Supiska, type InsertSupiska,
  type SupiskaContract, type InsertSupiskaContract,
  sectors, sections, parameters, sectorParameters, productSectors, productParameters,
  sectorProducts, sectorProductParameters,
  type Sector, type InsertSector,
  type Section, type InsertSection,
  type SectorProduct, type InsertSectorProduct,
  type Parameter, type InsertParameter,
  type SectorParameter, type ProductSector, type ProductParameter,
  type SectorProductParameter,
  calendarEvents,
  type CalendarEvent, type InsertCalendarEvent,
  panels, panelParameters, productPanels,
  type Panel, type InsertPanel,
  type PanelParameter, type InsertPanelParameter,
  type ProductPanel, type InsertProductPanel,
  stateFlagHistory, companyLogoHistory,
  type StateFlagHistory, type CompanyLogoHistory,
  type State, type InsertState,
  contractFolders, folderPanels,
  type ContractFolder, type InsertContractFolder,
  type FolderPanel, type InsertFolderPanel,
} from "@shared/schema";
import { eq, and, or, ne, like, sql, lte, gte, desc } from "drizzle-orm";

export interface IStorage {
  generateUID(stateCode: string, continentCode?: string): Promise<string>;

  getContinents(): Promise<{ id: number; name: string; code: string }[]>;
  getStates(continentId?: number): Promise<State[]>;
  getState(id: number): Promise<State | undefined>;
  createState(data: InsertState): Promise<State>;
  updateState(id: number, data: Partial<InsertState>): Promise<State>;
  deleteState(id: number): Promise<void>;
  getStateFlagHistory(stateId: number): Promise<StateFlagHistory[]>;
  addStateFlagHistory(stateId: number, flagUrl: string): Promise<StateFlagHistory>;
  getCompanyLogoHistory(companyId: number): Promise<CompanyLogoHistory[]>;
  addCompanyLogoHistory(companyId: number, logoUrl: string, originalName?: string): Promise<CompanyLogoHistory>;
  
  getMyCompanies(includeDeleted?: boolean): Promise<MyCompany[]>;
  getMyCompany(id: number): Promise<MyCompany | undefined>;
  createMyCompany(company: InsertMyCompany): Promise<MyCompany>;
  updateMyCompany(id: number, updates: UpdateMyCompanyRequest): Promise<MyCompany>;
  softDeleteMyCompany(id: number, deletedBy: string, ip: string): Promise<void>;
  restoreMyCompany(id: number): Promise<void>;

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
  restorePartner(id: number): Promise<void>;

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
  restoreProduct(id: number): Promise<void>;
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

  getAuditLogs(filters?: { userId?: number; module?: string; action?: string; dateFrom?: string; dateTo?: string; entityId?: number; limit?: number; offset?: number }): Promise<AuditLog[]>;
  getAuditLogCount(filters?: { userId?: number; module?: string; action?: string; dateFrom?: string; dateTo?: string; entityId?: number }): Promise<number>;
  createAuditLog(data: InsertAuditLog): Promise<AuditLog>;

  getSystemSetting(key: string): Promise<string | null>;
  setSystemSetting(key: string, value: string): Promise<SystemSetting>;
  getAllSystemSettings(): Promise<SystemSetting[]>;

  findClientByEmailPhone(email: string, phone: string): Promise<Subject | undefined>;
  createVerificationCode(subjectId: number, channel: string, code: string, expiresAt: Date): Promise<VerificationCode>;
  getValidVerificationCode(subjectId: number, channel: string, code: string): Promise<VerificationCode | undefined>;
  markVerificationCodeUsed(id: number): Promise<void>;

  getCategoryTimeouts(): Promise<CategoryTimeout[]>;
  createCategoryTimeout(data: InsertCategoryTimeout): Promise<CategoryTimeout>;
  updateCategoryTimeout(id: number, data: Partial<InsertCategoryTimeout>): Promise<CategoryTimeout>;
  deleteCategoryTimeout(id: number): Promise<void>;

  getDashboardPreferences(appUserId: number): Promise<DashboardPreference[]>;
  setDashboardPreference(appUserId: number, widgetKey: string, enabled: boolean): Promise<DashboardPreference>;
  bulkSetDashboardPreferences(appUserId: number, prefs: { widgetKey: string; enabled: boolean }[]): Promise<DashboardPreference[]>;

  getDashboardLayout(appUserId: number): Promise<UserDashboardLayout | undefined>;
  saveDashboardLayout(appUserId: number, widgetOrder: string[]): Promise<UserDashboardLayout>;

  getClientTypes(): Promise<ClientType[]>;
  getClientType(id: number): Promise<ClientType | undefined>;
  createClientType(data: InsertClientType): Promise<ClientType>;
  updateClientType(id: number, data: Partial<InsertClientType>): Promise<ClientType>;
  deleteClientType(id: number): Promise<void>;

  getClientTypeSections(clientTypeId: number): Promise<ClientTypeSection[]>;
  createClientTypeSection(data: InsertClientTypeSection): Promise<ClientTypeSection>;
  updateClientTypeSection(id: number, data: Partial<InsertClientTypeSection>): Promise<ClientTypeSection>;
  deleteClientTypeSection(id: number): Promise<void>;

  getClientTypeFields(clientTypeId: number): Promise<ClientTypeField[]>;
  createClientTypeField(data: InsertClientTypeField): Promise<ClientTypeField>;
  updateClientTypeField(id: number, data: Partial<InsertClientTypeField>): Promise<ClientTypeField>;
  deleteClientTypeField(id: number): Promise<void>;

  checkDuplicateSubject(params: { birthNumber?: string; ico?: string }): Promise<Subject | undefined>;

  // Contract Statuses
  getContractStatuses(stateId?: number): Promise<ContractStatus[]>;
  createContractStatus(data: InsertContractStatus): Promise<ContractStatus>;
  updateContractStatus(id: number, data: Partial<InsertContractStatus>): Promise<ContractStatus>;
  deleteContractStatus(id: number): Promise<void>;
  reorderContractStatuses(items: { id: number; sortOrder: number }[]): Promise<void>;

  // Contract Templates
  getContractTemplates(stateId?: number): Promise<ContractTemplate[]>;
  createContractTemplate(data: InsertContractTemplate): Promise<ContractTemplate>;
  updateContractTemplate(id: number, data: Partial<InsertContractTemplate>): Promise<ContractTemplate>;
  deleteContractTemplate(id: number): Promise<void>;

  // Contract Inventories
  getContractInventories(stateId?: number): Promise<ContractInventory[]>;
  createContractInventory(data: InsertContractInventory): Promise<ContractInventory>;
  updateContractInventory(id: number, data: Partial<InsertContractInventory>): Promise<ContractInventory>;
  deleteContractInventory(id: number): Promise<void>;
  reorderContractInventories(items: { id: number; sortOrder: number }[]): Promise<void>;

  // Contracts
  getContracts(filters?: { stateId?: number; statusId?: number; inventoryId?: number; includeDeleted?: boolean }): Promise<Contract[]>;
  getContract(id: number): Promise<Contract | undefined>;
  createContract(data: InsertContract): Promise<Contract>;
  updateContract(id: number, data: Partial<InsertContract>): Promise<Contract>;
  softDeleteContract(id: number, deletedBy: string, ip: string): Promise<void>;
  restoreContract(id: number): Promise<void>;

  getContractPasswords(contractId: number): Promise<ContractPassword[]>;
  createContractPassword(data: InsertContractPassword): Promise<ContractPassword>;
  deleteContractPassword(id: number): Promise<void>;

  getContractParameterValues(contractId: number): Promise<ContractParameterValue[]>;
  saveContractParameterValues(contractId: number, values: { parameterId: number; value: string }[]): Promise<void>;

  // Client Groups
  getClientGroups(stateId?: number): Promise<ClientGroup[]>;
  getClientGroup(id: number): Promise<ClientGroup | undefined>;
  createClientGroup(data: InsertClientGroup): Promise<ClientGroup>;
  updateClientGroup(id: number, data: Partial<InsertClientGroup>): Promise<ClientGroup>;
  deleteClientGroup(id: number): Promise<void>;
  reorderClientGroups(items: { id: number; sortOrder: number }[]): Promise<void>;

  // Client Sub-Groups
  getClientSubGroups(groupId: number): Promise<ClientSubGroup[]>;
  createClientSubGroup(data: InsertClientSubGroup): Promise<ClientSubGroup>;
  deleteClientSubGroup(id: number): Promise<void>;
  reorderClientSubGroups(items: { id: number; sortOrder: number }[]): Promise<void>;

  // Client Group Members
  getClientGroupMembers(groupId: number): Promise<(ClientGroupMember & { subject?: Subject })[]>;
  addClientGroupMember(data: InsertClientGroupMember): Promise<ClientGroupMember>;
  bulkAddClientGroupMembers(groupId: number, subjectIds: number[]): Promise<number>;
  removeClientGroupMember(id: number): Promise<void>;
  getClientGroupMemberCount(groupId: number): Promise<number>;
  getClientSubGroupMemberCount(subGroupId: number): Promise<number>;
  isSubjectLoginAllowed(subjectId: number): Promise<boolean>;

  // Supisky
  getSupisky(filters?: { stateId?: number; companyId?: number }): Promise<Supiska[]>;
  getSupiska(id: number): Promise<Supiska | undefined>;
  createSupiska(data: InsertSupiska): Promise<Supiska>;
  updateSupiska(id: number, data: Partial<InsertSupiska>): Promise<Supiska>;
  deleteSupiska(id: number): Promise<void>;
  generateSupiskaId(): Promise<string>;
  getSupiskaContracts(supiskaId: number): Promise<SupiskaContract[]>;
  addContractsToSupiska(supiskaId: number, contractIds: number[]): Promise<number>;
  removeContractFromSupiska(supiskaId: number, contractId: number): Promise<void>;
  lockContractsBySupiska(supiskaId: number, lockedBy: string): Promise<void>;
  unlockContractsBySupiska(supiskaId: number): Promise<void>;

  // Commission Rates (Sadzby)
  getCommissionRates(filters?: { partnerId?: number; productId?: number; stateId?: number; isActive?: boolean }): Promise<CommissionRate[]>;
  getCommissionRate(id: number): Promise<CommissionRate | undefined>;
  createCommissionRate(data: InsertCommissionRate): Promise<CommissionRate>;
  updateCommissionRate(id: number, data: Partial<InsertCommissionRate>): Promise<CommissionRate>;
  deleteCommissionRate(id: number): Promise<void>;

  // Commission Calculation Logs
  getCommissionCalculationLogs(filters?: { contractId?: number; agentId?: number; managerId?: number; limit?: number }): Promise<CommissionCalculationLog[]>;
  createCommissionCalculationLog(data: InsertCommissionCalculationLog): Promise<CommissionCalculationLog>;

  // Provzie data (incoming from partners)
  getProvizieData(stateId?: number): Promise<any[]>;
  // Odmeny data (outgoing to agents)
  getOdmenyData(stateId?: number): Promise<any[]>;

  // Sectors
  getSectors(): Promise<Sector[]>;
  getSector(id: number): Promise<Sector | undefined>;
  createSector(data: InsertSector): Promise<Sector>;
  updateSector(id: number, data: Partial<InsertSector>): Promise<Sector>;
  deleteSector(id: number): Promise<void>;

  // Sections (ArutsoK 28)
  getSections(sectorId?: number): Promise<Section[]>;
  getSection(id: number): Promise<Section | undefined>;
  createSection(data: InsertSection): Promise<Section>;
  updateSection(id: number, data: Partial<InsertSection>): Promise<Section>;
  deleteSection(id: number): Promise<void>;

  // Parameters
  getParameters(): Promise<Parameter[]>;
  getParameter(id: number): Promise<Parameter | undefined>;
  createParameter(data: InsertParameter): Promise<Parameter>;
  updateParameter(id: number, data: Partial<InsertParameter>): Promise<Parameter>;
  deleteParameter(id: number): Promise<void>;

  // Sector Products (ArutsoK 28 - now linked via sectionId)
  getSectorProducts(sectionId?: number): Promise<SectorProduct[]>;
  getSectorProduct(id: number): Promise<SectorProduct | undefined>;
  createSectorProduct(data: InsertSectorProduct): Promise<SectorProduct>;
  updateSectorProduct(id: number, data: Partial<InsertSectorProduct>): Promise<SectorProduct>;
  deleteSectorProduct(id: number): Promise<void>;

  // Sector-Product-Parameter assignments (ArutsoK 25)
  getSectorProductParameters(sectorProductId: number): Promise<SectorProductParameter[]>;
  setSectorProductParameters(sectorProductId: number, parameterIds: number[]): Promise<void>;

  // Sector-Parameter assignments (legacy)
  getSectorParameters(sectorId: number): Promise<SectorParameter[]>;
  setSectorParameters(sectorId: number, parameterIds: number[]): Promise<void>;

  // Product-Sector assignments
  getProductSectors(productId: number): Promise<ProductSector[]>;
  setProductSectors(productId: number, sectorIds: number[]): Promise<void>;

  // Product-Parameter assignments
  getProductParameters(productId: number): Promise<ProductParameter[]>;
  setProductParameters(productId: number, params: { parameterId: number; overrideRequired?: boolean; overrideHelpText?: string }[]): Promise<void>;

  // Panels (ArutsoK 27)
  getPanels(): Promise<Panel[]>;
  getPanel(id: number): Promise<Panel | undefined>;
  createPanel(data: InsertPanel): Promise<Panel>;
  updatePanel(id: number, data: Partial<InsertPanel>): Promise<Panel>;
  deletePanel(id: number): Promise<void>;

  // Panel-Parameter assignments (ArutsoK 27)
  getPanelParameters(panelId: number): Promise<PanelParameter[]>;
  setPanelParameters(panelId: number, parameterIds: number[]): Promise<void>;

  // Product-Panel assignments (ArutsoK 27)
  getProductPanels(sectorProductId: number): Promise<ProductPanel[]>;
  setProductPanels(sectorProductId: number, panelIds: number[]): Promise<void>;

  // Contract Folders (ArutsoK 35)
  getContractFolders(): Promise<ContractFolder[]>;
  getContractFolder(id: number): Promise<ContractFolder | undefined>;
  createContractFolder(data: InsertContractFolder): Promise<ContractFolder>;
  updateContractFolder(id: number, data: Partial<InsertContractFolder>): Promise<ContractFolder>;
  deleteContractFolder(id: number): Promise<void>;
  getFolderPanels(folderId: number): Promise<FolderPanel[]>;
  setFolderPanels(folderId: number, assignments: { panelId: number; gridColumns: number }[]): Promise<void>;

  // Calendar Events
  getCalendarEvents(): Promise<CalendarEvent[]>;
  getCalendarEvent(id: number): Promise<CalendarEvent | undefined>;
  createCalendarEvent(data: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent>;
  deleteCalendarEvent(id: number): Promise<void>;
  getUpcomingEvents(limit?: number): Promise<CalendarEvent[]>;
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
  
  async getStates(continentId?: number): Promise<State[]> {
    if (continentId) {
      return await db.select().from(states).where(eq(states.continentId, continentId)).orderBy(desc(states.id));
    }
    return await db.select().from(states).orderBy(desc(states.id));
  }

  async getState(id: number): Promise<State | undefined> {
    const [state] = await db.select().from(states).where(eq(states.id, id));
    return state;
  }

  async createState(data: InsertState): Promise<State> {
    const [newState] = await db.insert(states).values(data).returning();
    return newState;
  }

  async updateState(id: number, data: Partial<InsertState>): Promise<State> {
    const [updated] = await db.update(states).set(data).where(eq(states.id, id)).returning();
    return updated;
  }

  async deleteState(id: number): Promise<void> {
    await db.delete(states).where(eq(states.id, id));
  }

  async getStateFlagHistory(stateId: number): Promise<StateFlagHistory[]> {
    return await db.select().from(stateFlagHistory).where(eq(stateFlagHistory.stateId, stateId)).orderBy(desc(stateFlagHistory.replacedAt));
  }

  async addStateFlagHistory(stateId: number, flagUrl: string): Promise<StateFlagHistory> {
    const [entry] = await db.insert(stateFlagHistory).values({ stateId, flagUrl }).returning();
    return entry;
  }

  async getCompanyLogoHistory(companyId: number): Promise<CompanyLogoHistory[]> {
    return await db.select().from(companyLogoHistory).where(eq(companyLogoHistory.companyId, companyId)).orderBy(desc(companyLogoHistory.replacedAt));
  }

  async addCompanyLogoHistory(companyId: number, logoUrl: string, originalName?: string): Promise<CompanyLogoHistory> {
    const [entry] = await db.insert(companyLogoHistory).values({ companyId, logoUrl, originalName: originalName || null }).returning();
    return entry;
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

  async restoreMyCompany(id: number) {
    await db.update(myCompanies).set({
      isDeleted: false,
      deletedBy: null,
      deletedAt: null,
      deletedFromIp: null,
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

  async restorePartner(id: number) {
    await db.update(partners).set({
      isDeleted: false,
      deletedBy: null,
      deletedAt: null,
      deletedFromIp: null,
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

  async restoreProduct(id: number) {
    await db.update(products).set({
      isDeleted: false,
      deletedBy: null,
      deletedAt: null,
      deletedFromIp: null,
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

  async getAuditLogs(filters?: { userId?: number; module?: string; action?: string; dateFrom?: string; dateTo?: string; entityId?: number; limit?: number; offset?: number }): Promise<AuditLog[]> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters?.module) conditions.push(eq(auditLogs.module, filters.module));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
    if (filters?.dateFrom) conditions.push(sql`${auditLogs.createdAt} >= ${filters.dateFrom}::timestamp`);
    if (filters?.dateTo) conditions.push(sql`${auditLogs.createdAt} <= ${filters.dateTo}::timestamp + interval '1 day'`);

    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    if (conditions.length === 0) {
      return await db.select().from(auditLogs).orderBy(sql`${auditLogs.createdAt} DESC`).limit(limit).offset(offset);
    }
    return await db.select().from(auditLogs).where(and(...conditions)).orderBy(sql`${auditLogs.createdAt} DESC`).limit(limit).offset(offset);
  }

  async getAuditLogCount(filters?: { userId?: number; module?: string; action?: string; dateFrom?: string; dateTo?: string; entityId?: number }): Promise<number> {
    const conditions: any[] = [];
    if (filters?.userId) conditions.push(eq(auditLogs.userId, filters.userId));
    if (filters?.module) conditions.push(eq(auditLogs.module, filters.module));
    if (filters?.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters?.entityId) conditions.push(eq(auditLogs.entityId, filters.entityId));
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

  async getSystemSetting(key: string): Promise<string | null> {
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return row?.value ?? null;
  }

  async setSystemSetting(key: string, value: string): Promise<SystemSetting> {
    const existing = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    if (existing.length > 0) {
      const [updated] = await db.update(systemSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(systemSettings).values({ key, value }).returning();
    return created;
  }

  async getAllSystemSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }

  async findClientByEmailPhone(email: string, phone: string): Promise<Subject | undefined> {
    const [match] = await db.select().from(subjects).where(
      and(
        eq(subjects.type, "person"),
        eq(subjects.isActive, true),
        sql`LOWER(${subjects.email}) = LOWER(${email})`,
        eq(subjects.phone, phone)
      )
    );
    return match;
  }

  async createVerificationCode(subjectId: number, channel: string, code: string, expiresAt: Date): Promise<VerificationCode> {
    const [vc] = await db.insert(verificationCodes).values({
      subjectId,
      channel,
      code,
      expiresAt,
    }).returning();
    return vc;
  }

  async getValidVerificationCode(subjectId: number, channel: string, code: string): Promise<VerificationCode | undefined> {
    const [vc] = await db.select().from(verificationCodes).where(
      and(
        eq(verificationCodes.subjectId, subjectId),
        eq(verificationCodes.channel, channel),
        eq(verificationCodes.code, code),
        sql`${verificationCodes.expiresAt} > NOW()`,
        sql`${verificationCodes.usedAt} IS NULL`
      )
    );
    return vc;
  }

  async markVerificationCodeUsed(id: number): Promise<void> {
    await db.update(verificationCodes)
      .set({ usedAt: new Date() })
      .where(eq(verificationCodes.id, id));
  }

  async getCategoryTimeouts(): Promise<CategoryTimeout[]> {
    return await db.select().from(categoryTimeouts);
  }

  async createCategoryTimeout(data: InsertCategoryTimeout): Promise<CategoryTimeout> {
    const [created] = await db.insert(categoryTimeouts).values(data).returning();
    return created;
  }

  async updateCategoryTimeout(id: number, data: Partial<InsertCategoryTimeout>): Promise<CategoryTimeout> {
    const [updated] = await db.update(categoryTimeouts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(categoryTimeouts.id, id))
      .returning();
    return updated;
  }

  async deleteCategoryTimeout(id: number): Promise<void> {
    await db.delete(categoryTimeouts).where(eq(categoryTimeouts.id, id));
  }

  async getDashboardPreferences(appUserId: number): Promise<DashboardPreference[]> {
    return await db.select().from(dashboardPreferences)
      .where(eq(dashboardPreferences.appUserId, appUserId));
  }

  async setDashboardPreference(appUserId: number, widgetKey: string, enabled: boolean): Promise<DashboardPreference> {
    const existing = await db.select().from(dashboardPreferences)
      .where(and(
        eq(dashboardPreferences.appUserId, appUserId),
        eq(dashboardPreferences.widgetKey, widgetKey)
      ));
    if (existing.length > 0) {
      const [updated] = await db.update(dashboardPreferences)
        .set({ enabled })
        .where(eq(dashboardPreferences.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(dashboardPreferences)
      .values({ appUserId, widgetKey, enabled })
      .returning();
    return created;
  }

  async bulkSetDashboardPreferences(appUserId: number, prefs: { widgetKey: string; enabled: boolean }[]): Promise<DashboardPreference[]> {
    const results: DashboardPreference[] = [];
    for (const p of prefs) {
      const result = await this.setDashboardPreference(appUserId, p.widgetKey, p.enabled);
      results.push(result);
    }
    return results;
  }

  async getDashboardLayout(appUserId: number): Promise<UserDashboardLayout | undefined> {
    const rows = await db.select().from(userDashboardLayouts)
      .where(eq(userDashboardLayouts.appUserId, appUserId))
      .limit(1);
    return rows[0];
  }

  async saveDashboardLayout(appUserId: number, widgetOrder: string[]): Promise<UserDashboardLayout> {
    const existing = await this.getDashboardLayout(appUserId);
    if (existing) {
      const [updated] = await db.update(userDashboardLayouts)
        .set({ widgetOrder, updatedAt: new Date() })
        .where(eq(userDashboardLayouts.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(userDashboardLayouts)
      .values({ appUserId, widgetOrder })
      .returning();
    return created;
  }

  async getClientTypes(): Promise<ClientType[]> {
    return await db.select().from(clientTypes).orderBy(clientTypes.sortOrder);
  }

  async getClientType(id: number): Promise<ClientType | undefined> {
    const [ct] = await db.select().from(clientTypes).where(eq(clientTypes.id, id));
    return ct;
  }

  async createClientType(data: InsertClientType): Promise<ClientType> {
    const [created] = await db.insert(clientTypes).values(data).returning();
    return created;
  }

  async updateClientType(id: number, data: Partial<InsertClientType>): Promise<ClientType> {
    const [updated] = await db.update(clientTypes).set(data).where(eq(clientTypes.id, id)).returning();
    return updated;
  }

  async deleteClientType(id: number): Promise<void> {
    await db.delete(clientTypeFields).where(eq(clientTypeFields.clientTypeId, id));
    await db.delete(clientTypeSections).where(eq(clientTypeSections.clientTypeId, id));
    await db.delete(clientTypes).where(eq(clientTypes.id, id));
  }

  async getClientTypeSections(clientTypeId: number): Promise<ClientTypeSection[]> {
    return await db.select().from(clientTypeSections)
      .where(eq(clientTypeSections.clientTypeId, clientTypeId))
      .orderBy(clientTypeSections.sortOrder);
  }

  async createClientTypeSection(data: InsertClientTypeSection): Promise<ClientTypeSection> {
    const [created] = await db.insert(clientTypeSections).values(data).returning();
    return created;
  }

  async updateClientTypeSection(id: number, data: Partial<InsertClientTypeSection>): Promise<ClientTypeSection> {
    const [updated] = await db.update(clientTypeSections).set(data).where(eq(clientTypeSections.id, id)).returning();
    return updated;
  }

  async deleteClientTypeSection(id: number): Promise<void> {
    await db.update(clientTypeFields).set({ sectionId: null }).where(eq(clientTypeFields.sectionId, id));
    await db.delete(clientTypeSections).where(eq(clientTypeSections.id, id));
  }

  async getClientTypeFields(clientTypeId: number): Promise<ClientTypeField[]> {
    return await db.select().from(clientTypeFields)
      .where(eq(clientTypeFields.clientTypeId, clientTypeId))
      .orderBy(clientTypeFields.sortOrder);
  }

  async createClientTypeField(data: InsertClientTypeField): Promise<ClientTypeField> {
    const [created] = await db.insert(clientTypeFields).values(data as any).returning();
    return created;
  }

  async updateClientTypeField(id: number, data: Partial<InsertClientTypeField>): Promise<ClientTypeField> {
    const [updated] = await db.update(clientTypeFields).set(data as any).where(eq(clientTypeFields.id, id)).returning();
    return updated;
  }

  async deleteClientTypeField(id: number): Promise<void> {
    await db.delete(clientTypeFields).where(eq(clientTypeFields.id, id));
  }

  async checkDuplicateSubject(params: { birthNumber?: string; ico?: string }): Promise<Subject | undefined> {
    if (params.birthNumber) {
      const [found] = await db.select().from(subjects)
        .where(eq(subjects.birthNumber, params.birthNumber));
      return found;
    }
    if (params.ico) {
      const [found] = await db.select().from(subjects)
        .where(sql`${subjects.details}->>'ico' = ${params.ico}`);
      return found;
    }
    return undefined;
  }

  // === Contract Statuses ===

  async getContractStatuses(stateId?: number): Promise<ContractStatus[]> {
    if (stateId) {
      return await db.select().from(contractStatuses)
        .where(eq(contractStatuses.stateId, stateId))
        .orderBy(contractStatuses.sortOrder);
    }
    return await db.select().from(contractStatuses).orderBy(contractStatuses.sortOrder);
  }

  async createContractStatus(data: InsertContractStatus): Promise<ContractStatus> {
    const [created] = await db.insert(contractStatuses).values(data).returning();
    return created;
  }

  async updateContractStatus(id: number, data: Partial<InsertContractStatus>): Promise<ContractStatus> {
    const [updated] = await db.update(contractStatuses).set(data).where(eq(contractStatuses.id, id)).returning();
    return updated;
  }

  async deleteContractStatus(id: number): Promise<void> {
    await db.delete(contractStatuses).where(eq(contractStatuses.id, id));
  }

  async reorderContractStatuses(items: { id: number; sortOrder: number }[]): Promise<void> {
    for (const item of items) {
      await db.update(contractStatuses).set({ sortOrder: item.sortOrder }).where(eq(contractStatuses.id, item.id));
    }
  }

  // === Contract Templates ===

  async getContractTemplates(stateId?: number): Promise<ContractTemplate[]> {
    if (stateId) {
      return await db.select().from(contractTemplates)
        .where(eq(contractTemplates.stateId, stateId))
        .orderBy(contractTemplates.name);
    }
    return await db.select().from(contractTemplates).orderBy(contractTemplates.name);
  }

  async createContractTemplate(data: InsertContractTemplate): Promise<ContractTemplate> {
    const [created] = await db.insert(contractTemplates).values(data).returning();
    return created;
  }

  async updateContractTemplate(id: number, data: Partial<InsertContractTemplate>): Promise<ContractTemplate> {
    const [updated] = await db.update(contractTemplates).set({ ...data, updatedAt: new Date() }).where(eq(contractTemplates.id, id)).returning();
    return updated;
  }

  async deleteContractTemplate(id: number): Promise<void> {
    await db.delete(contractTemplates).where(eq(contractTemplates.id, id));
  }

  // === Contract Inventories ===

  async getContractInventories(stateId?: number): Promise<ContractInventory[]> {
    if (stateId) {
      return await db.select().from(contractInventories)
        .where(eq(contractInventories.stateId, stateId))
        .orderBy(contractInventories.sortOrder);
    }
    return await db.select().from(contractInventories).orderBy(contractInventories.sortOrder);
  }

  async createContractInventory(data: InsertContractInventory): Promise<ContractInventory> {
    const [created] = await db.insert(contractInventories).values(data).returning();
    return created;
  }

  async updateContractInventory(id: number, data: Partial<InsertContractInventory>): Promise<ContractInventory> {
    const [updated] = await db.update(contractInventories).set({ ...data, updatedAt: new Date() }).where(eq(contractInventories.id, id)).returning();
    return updated;
  }

  async deleteContractInventory(id: number): Promise<void> {
    await db.delete(contractInventories).where(eq(contractInventories.id, id));
  }

  async reorderContractInventories(items: { id: number; sortOrder: number }[]): Promise<void> {
    for (const item of items) {
      await db.update(contractInventories).set({ sortOrder: item.sortOrder }).where(eq(contractInventories.id, item.id));
    }
  }

  // === Contracts ===

  async getContracts(filters?: { stateId?: number; statusId?: number; inventoryId?: number; includeDeleted?: boolean }): Promise<Contract[]> {
    const conditions = [];
    if (!filters?.includeDeleted) {
      conditions.push(eq(contracts.isDeleted, false));
    }
    if (filters?.stateId) {
      conditions.push(eq(contracts.stateId, filters.stateId));
    }
    if (filters?.statusId) {
      conditions.push(eq(contracts.statusId, filters.statusId));
    }
    if (filters?.inventoryId) {
      conditions.push(eq(contracts.inventoryId, filters.inventoryId));
    }
    if (conditions.length > 0) {
      return await db.select().from(contracts).where(and(...conditions)).orderBy(sql`${contracts.createdAt} DESC`);
    }
    return await db.select().from(contracts).orderBy(sql`${contracts.createdAt} DESC`);
  }

  async getContract(id: number): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract;
  }

  async createContract(data: InsertContract): Promise<Contract> {
    const [created] = await db.insert(contracts).values(data as any).returning();
    return created;
  }

  async updateContract(id: number, data: Partial<InsertContract>): Promise<Contract> {
    const [updated] = await db.update(contracts).set({ ...data, updatedAt: new Date() } as any).where(eq(contracts.id, id)).returning();
    return updated;
  }

  async softDeleteContract(id: number, deletedBy: string, ip: string): Promise<void> {
    await db.update(contracts).set({
      isDeleted: true,
      deletedBy,
      deletedAt: new Date(),
      deletedFromIp: ip,
    }).where(eq(contracts.id, id));
  }

  async restoreContract(id: number): Promise<void> {
    await db.update(contracts).set({
      isDeleted: false,
      deletedBy: null,
      deletedAt: null,
      deletedFromIp: null,
    }).where(eq(contracts.id, id));
  }

  async getContractPasswords(contractId: number): Promise<ContractPassword[]> {
    return await db.select().from(contractPasswords)
      .where(eq(contractPasswords.contractId, contractId))
      .orderBy(desc(contractPasswords.createdAt));
  }

  async createContractPassword(data: InsertContractPassword): Promise<ContractPassword> {
    const [created] = await db.insert(contractPasswords).values(data as any).returning();
    return created;
  }

  async deleteContractPassword(id: number): Promise<void> {
    await db.delete(contractPasswords).where(eq(contractPasswords.id, id));
  }

  async getContractParameterValues(contractId: number): Promise<ContractParameterValue[]> {
    return await db.select().from(contractParameterValues)
      .where(eq(contractParameterValues.contractId, contractId));
  }

  async saveContractParameterValues(contractId: number, values: { parameterId: number; value: string }[]): Promise<void> {
    await db.delete(contractParameterValues).where(eq(contractParameterValues.contractId, contractId));
    if (values.length > 0) {
      await db.insert(contractParameterValues).values(
        values.map(v => ({ contractId, parameterId: v.parameterId, value: v.value }))
      );
    }
  }

  // === CLIENT GROUPS ===
  async getClientGroups(stateId?: number): Promise<ClientGroup[]> {
    if (stateId) {
      return await db.select().from(clientGroups)
        .where(eq(clientGroups.stateId, stateId))
        .orderBy(clientGroups.sortOrder);
    }
    return await db.select().from(clientGroups).orderBy(clientGroups.sortOrder);
  }

  async getClientGroup(id: number): Promise<ClientGroup | undefined> {
    const [group] = await db.select().from(clientGroups).where(eq(clientGroups.id, id));
    return group;
  }

  async createClientGroup(data: InsertClientGroup): Promise<ClientGroup> {
    const [created] = await db.insert(clientGroups).values(data as any).returning();
    return created;
  }

  async updateClientGroup(id: number, data: Partial<InsertClientGroup>): Promise<ClientGroup> {
    const [updated] = await db.update(clientGroups)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(clientGroups.id, id)).returning();
    return updated;
  }

  async deleteClientGroup(id: number): Promise<void> {
    await db.delete(clientGroupMembers).where(eq(clientGroupMembers.groupId, id));
    await db.delete(clientSubGroups).where(eq(clientSubGroups.groupId, id));
    await db.delete(clientGroups).where(eq(clientGroups.id, id));
  }

  async reorderClientGroups(items: { id: number; sortOrder: number }[]): Promise<void> {
    for (const item of items) {
      await db.update(clientGroups).set({ sortOrder: item.sortOrder }).where(eq(clientGroups.id, item.id));
    }
  }

  // === CLIENT SUB-GROUPS ===
  async getClientSubGroups(groupId: number): Promise<ClientSubGroup[]> {
    return await db.select().from(clientSubGroups)
      .where(eq(clientSubGroups.groupId, groupId))
      .orderBy(clientSubGroups.sortOrder);
  }

  async createClientSubGroup(data: InsertClientSubGroup): Promise<ClientSubGroup> {
    const [created] = await db.insert(clientSubGroups).values(data as any).returning();
    return created;
  }

  async deleteClientSubGroup(id: number): Promise<void> {
    await db.update(clientGroupMembers)
      .set({ subGroupId: null })
      .where(eq(clientGroupMembers.subGroupId, id));
    await db.delete(clientSubGroups).where(eq(clientSubGroups.id, id));
  }

  async reorderClientSubGroups(items: { id: number; sortOrder: number }[]): Promise<void> {
    for (const item of items) {
      await db.update(clientSubGroups).set({ sortOrder: item.sortOrder }).where(eq(clientSubGroups.id, item.id));
    }
  }

  // === CLIENT GROUP MEMBERS ===
  async getClientGroupMembers(groupId: number): Promise<(ClientGroupMember & { subject?: Subject })[]> {
    const members = await db.select().from(clientGroupMembers)
      .where(eq(clientGroupMembers.groupId, groupId));
    const result: (ClientGroupMember & { subject?: Subject })[] = [];
    for (const member of members) {
      const [subject] = await db.select().from(subjects).where(eq(subjects.id, member.subjectId));
      result.push({ ...member, subject });
    }
    return result;
  }

  async addClientGroupMember(data: InsertClientGroupMember): Promise<ClientGroupMember> {
    const [created] = await db.insert(clientGroupMembers).values(data as any).returning();
    return created;
  }

  async bulkAddClientGroupMembers(groupId: number, subjectIds: number[]): Promise<number> {
    let added = 0;
    for (const subjectId of subjectIds) {
      const existing = await db.select().from(clientGroupMembers)
        .where(and(eq(clientGroupMembers.groupId, groupId), eq(clientGroupMembers.subjectId, subjectId)))
        .then(r => r[0]);
      if (!existing) {
        await db.insert(clientGroupMembers).values({ groupId, subjectId } as any);
        added++;
      }
    }
    return added;
  }

  async removeClientGroupMember(id: number): Promise<void> {
    await db.delete(clientGroupMembers).where(eq(clientGroupMembers.id, id));
  }

  async getClientGroupMemberCount(groupId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(clientGroupMembers)
      .where(eq(clientGroupMembers.groupId, groupId));
    return result[0]?.count || 0;
  }

  async getClientSubGroupMemberCount(subGroupId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` })
      .from(clientGroupMembers)
      .where(eq(clientGroupMembers.subGroupId, subGroupId));
    return result[0]?.count || 0;
  }

  async isSubjectLoginAllowed(subjectId: number): Promise<boolean> {
    const memberships = await db.select({
      allowLogin: clientGroups.allowLogin,
    })
      .from(clientGroupMembers)
      .innerJoin(clientGroups, eq(clientGroupMembers.groupId, clientGroups.id))
      .where(
        eq(clientGroupMembers.subjectId, subjectId)
      );
    if (memberships.length === 0) return true;
    const blocked = memberships.some(m => m.allowLogin === false);
    return !blocked;
  }

  async getSupisky(filters?: { stateId?: number; companyId?: number }): Promise<Supiska[]> {
    const conditions: any[] = [];
    if (filters?.stateId) conditions.push(eq(supisky.stateId, filters.stateId));
    if (filters?.companyId) conditions.push(eq(supisky.companyId, filters.companyId));
    if (conditions.length > 0) {
      return db.select().from(supisky).where(and(...conditions)).orderBy(sql`${supisky.createdAt} DESC`);
    }
    return db.select().from(supisky).orderBy(sql`${supisky.createdAt} DESC`);
  }

  async getSupiska(id: number): Promise<Supiska | undefined> {
    const [result] = await db.select().from(supisky).where(eq(supisky.id, id));
    return result;
  }

  async createSupiska(data: InsertSupiska): Promise<Supiska> {
    const [result] = await db.insert(supisky).values(data).returning();
    return result;
  }

  async updateSupiska(id: number, data: Partial<InsertSupiska>): Promise<Supiska> {
    const [result] = await db.update(supisky)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(supisky.id, id))
      .returning();
    return result;
  }

  async deleteSupiska(id: number): Promise<void> {
    await db.delete(supiskaContracts).where(eq(supiskaContracts.supiskaId, id));
    await db.delete(supisky).where(eq(supisky.id, id));
  }

  async generateSupiskaId(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await db.execute(sql`
      SELECT COUNT(*)::int as cnt FROM supisky WHERE EXTRACT(YEAR FROM created_at) = ${year}
    `);
    const count = Number(result.rows[0]?.cnt ?? 0) + 1;
    return `SUP-${year}-${String(count).padStart(4, '0')}`;
  }

  async getSupiskaContracts(supiskaId: number): Promise<SupiskaContract[]> {
    return db.select().from(supiskaContracts).where(eq(supiskaContracts.supiskaId, supiskaId));
  }

  async addContractsToSupiska(supiskaId: number, contractIds: number[]): Promise<number> {
    let added = 0;
    for (const contractId of contractIds) {
      const existing = await db.select().from(supiskaContracts)
        .where(and(eq(supiskaContracts.supiskaId, supiskaId), eq(supiskaContracts.contractId, contractId)));
      if (existing.length === 0) {
        await db.insert(supiskaContracts).values({ supiskaId, contractId });
        added++;
      }
    }
    return added;
  }

  async removeContractFromSupiska(supiskaId: number, contractId: number): Promise<void> {
    await db.delete(supiskaContracts)
      .where(and(eq(supiskaContracts.supiskaId, supiskaId), eq(supiskaContracts.contractId, contractId)));
    await db.update(contracts)
      .set({ isLocked: false, lockedBy: null, lockedAt: null, lockedBySupiskaId: null })
      .where(eq(contracts.id, contractId));
  }

  async lockContractsBySupiska(supiskaId: number, lockedBy: string): Promise<void> {
    const links = await this.getSupiskaContracts(supiskaId);
    const contractIds = links.map(l => l.contractId);
    if (contractIds.length === 0) return;
    for (const cId of contractIds) {
      await db.update(contracts)
        .set({ isLocked: true, lockedBy, lockedAt: new Date(), lockedBySupiskaId: supiskaId })
        .where(eq(contracts.id, cId));
    }
  }

  async unlockContractsBySupiska(supiskaId: number): Promise<void> {
    const links = await this.getSupiskaContracts(supiskaId);
    const contractIds = links.map(l => l.contractId);
    if (contractIds.length === 0) return;
    for (const cId of contractIds) {
      await db.update(contracts)
        .set({ isLocked: false, lockedBy: null, lockedAt: null, lockedBySupiskaId: null })
        .where(eq(contracts.id, cId));
    }
  }

  // === Commission Rates (Sadzby) ===
  async getCommissionRates(filters?: { partnerId?: number; productId?: number; stateId?: number; isActive?: boolean }): Promise<CommissionRate[]> {
    const conditions: any[] = [];
    if (filters?.partnerId) conditions.push(eq(commissionRates.partnerId, filters.partnerId));
    if (filters?.productId) conditions.push(eq(commissionRates.productId, filters.productId));
    if (filters?.stateId) conditions.push(eq(commissionRates.stateId, filters.stateId));
    if (filters?.isActive !== undefined) conditions.push(eq(commissionRates.isActive, filters.isActive));
    if (conditions.length > 0) {
      return db.select().from(commissionRates).where(and(...conditions)).orderBy(commissionRates.createdAt);
    }
    return db.select().from(commissionRates).orderBy(commissionRates.createdAt);
  }

  async getCommissionRate(id: number): Promise<CommissionRate | undefined> {
    const [rate] = await db.select().from(commissionRates).where(eq(commissionRates.id, id));
    return rate;
  }

  async createCommissionRate(data: InsertCommissionRate): Promise<CommissionRate> {
    const [rate] = await db.insert(commissionRates).values(data).returning();
    return rate;
  }

  async updateCommissionRate(id: number, data: Partial<InsertCommissionRate>): Promise<CommissionRate> {
    const [rate] = await db.update(commissionRates).set({ ...data, updatedAt: new Date() }).where(eq(commissionRates.id, id)).returning();
    return rate;
  }

  async deleteCommissionRate(id: number): Promise<void> {
    await db.delete(commissionRates).where(eq(commissionRates.id, id));
  }

  // === Commission Calculation Logs ===
  async getCommissionCalculationLogs(filters?: { contractId?: number; agentId?: number; managerId?: number; limit?: number }): Promise<CommissionCalculationLog[]> {
    const conditions: any[] = [];
    if (filters?.contractId) conditions.push(eq(commissionCalculationLogs.contractId, filters.contractId));
    if (filters?.agentId) conditions.push(eq(commissionCalculationLogs.agentId, filters.agentId));
    if (filters?.managerId) conditions.push(eq(commissionCalculationLogs.managerId, filters.managerId));
    const query = conditions.length > 0
      ? db.select().from(commissionCalculationLogs).where(and(...conditions)).orderBy(desc(commissionCalculationLogs.createdAt))
      : db.select().from(commissionCalculationLogs).orderBy(desc(commissionCalculationLogs.createdAt));
    if (filters?.limit) return query.limit(filters.limit);
    return query;
  }

  async createCommissionCalculationLog(data: InsertCommissionCalculationLog): Promise<CommissionCalculationLog> {
    const [log] = await db.insert(commissionCalculationLogs).values(data).returning();
    return log;
  }

  // === Provzie Data (incoming from partners) ===
  async getProvizieData(stateId?: number): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT 
        c.id as contract_id,
        c.contract_number,
        c.premium_amount,
        c.commission_amount,
        c.signed_date,
        c.state_id,
        s.first_name || ' ' || s.last_name as client_name,
        s.kik_id,
        p.name as partner_name,
        pr.name as product_name,
        cr.rate_type,
        cr.rate_value,
        cr.points_factor,
        CASE 
          WHEN cr.rate_type = 'percent' THEN ROUND(COALESCE(c.premium_amount, 0) * COALESCE(cr.rate_value::numeric, 0) / 100, 2)
          WHEN cr.rate_type = 'fixed' THEN COALESCE(cr.rate_value::numeric, 0)
          ELSE 0
        END as calculated_commission,
        ROUND(COALESCE(c.premium_amount, 0) * COALESCE(cr.points_factor::numeric, 0) / 100, 4) as points_earned
      FROM contracts c
      LEFT JOIN subjects s ON c.subject_id = s.id
      LEFT JOIN partners p ON c.partner_id = p.id
      LEFT JOIN products pr ON c.product_id = pr.id
      LEFT JOIN commission_rates cr ON cr.partner_id = c.partner_id AND cr.product_id = c.product_id AND cr.is_active = true
      WHERE c.is_deleted = false
      ${stateId ? sql`AND c.state_id = ${stateId}` : sql``}
      ORDER BY c.created_at DESC
    `);
    return result.rows as any[];
  }

  // === Odmeny Data (outgoing to agents) ===
  async getOdmenyData(stateId?: number): Promise<any[]> {
    const result = await db.execute(sql`
      SELECT
        ccl.id,
        ccl.contract_number,
        ccl.premium_amount,
        ccl.rate_type,
        ccl.rate_value,
        ccl.base_commission,
        ccl.differential_commission,
        ccl.total_commission,
        ccl.points_earned,
        ccl.agent_level,
        ccl.manager_level,
        ccl.created_at,
        agent.username as agent_name,
        agent.first_name as agent_first_name,
        agent.last_name as agent_last_name,
        mgr.username as manager_name,
        mgr.first_name as manager_first_name,
        mgr.last_name as manager_last_name,
        c.contract_number as cn,
        p.name as partner_name,
        pr.name as product_name,
        s.first_name || ' ' || s.last_name as client_name
      FROM commission_calculation_logs ccl
      LEFT JOIN app_users agent ON ccl.agent_id = agent.id
      LEFT JOIN app_users mgr ON ccl.manager_id = mgr.id
      LEFT JOIN contracts c ON ccl.contract_id = c.id
      LEFT JOIN partners p ON c.partner_id = p.id
      LEFT JOIN products pr ON c.product_id = pr.id
      LEFT JOIN subjects s ON c.subject_id = s.id
      ${stateId ? sql`WHERE c.state_id = ${stateId}` : sql``}
      ORDER BY ccl.created_at DESC
    `);
    return result.rows as any[];
  }
  // === Sectors CRUD (ArutsoK 25: descending sort) ===
  async getSectors(): Promise<Sector[]> {
    return await db.select().from(sectors).orderBy(desc(sectors.id));
  }

  async getSector(id: number): Promise<Sector | undefined> {
    const [sector] = await db.select().from(sectors).where(eq(sectors.id, id));
    return sector;
  }

  async createSector(data: InsertSector): Promise<Sector> {
    const [sector] = await db.insert(sectors).values(data).returning();
    return sector;
  }

  async updateSector(id: number, data: Partial<InsertSector>): Promise<Sector> {
    const [sector] = await db.update(sectors).set(data).where(eq(sectors.id, id)).returning();
    return sector;
  }

  async deleteSector(id: number): Promise<void> {
    const secs = await db.select().from(sections).where(eq(sections.sectorId, id));
    for (const sec of secs) {
      const sps = await db.select().from(sectorProducts).where(eq(sectorProducts.sectionId, sec.id));
      for (const sp of sps) {
        await db.delete(sectorProductParameters).where(eq(sectorProductParameters.sectorProductId, sp.id));
        await db.delete(productPanels).where(eq(productPanels.sectorProductId, sp.id));
      }
      await db.delete(sectorProducts).where(eq(sectorProducts.sectionId, sec.id));
    }
    await db.delete(sections).where(eq(sections.sectorId, id));
    await db.delete(sectorParameters).where(eq(sectorParameters.sectorId, id));
    await db.delete(sectors).where(eq(sectors.id, id));
  }

  // === Sections CRUD (ArutsoK 28) ===
  async getSections(sectorId?: number): Promise<Section[]> {
    if (sectorId !== undefined) {
      return await db.select().from(sections).where(eq(sections.sectorId, sectorId)).orderBy(desc(sections.id));
    }
    return await db.select().from(sections).orderBy(desc(sections.id));
  }

  async getSection(id: number): Promise<Section | undefined> {
    const [section] = await db.select().from(sections).where(eq(sections.id, id));
    return section;
  }

  async createSection(data: InsertSection): Promise<Section> {
    const [section] = await db.insert(sections).values(data).returning();
    return section;
  }

  async updateSection(id: number, data: Partial<InsertSection>): Promise<Section> {
    const [section] = await db.update(sections).set(data).where(eq(sections.id, id)).returning();
    return section;
  }

  async deleteSection(id: number): Promise<void> {
    const sps = await db.select().from(sectorProducts).where(eq(sectorProducts.sectionId, id));
    for (const sp of sps) {
      await db.delete(sectorProductParameters).where(eq(sectorProductParameters.sectorProductId, sp.id));
      await db.delete(productPanels).where(eq(productPanels.sectorProductId, sp.id));
    }
    await db.delete(sectorProducts).where(eq(sectorProducts.sectionId, id));
    await db.delete(sections).where(eq(sections.id, id));
  }

  // === Sector Products CRUD (ArutsoK 28 - now linked via sectionId) ===
  async getSectorProducts(sectionId?: number): Promise<SectorProduct[]> {
    if (sectionId !== undefined) {
      return await db.select().from(sectorProducts).where(eq(sectorProducts.sectionId, sectionId)).orderBy(desc(sectorProducts.id));
    }
    return await db.select().from(sectorProducts).orderBy(desc(sectorProducts.id));
  }

  async getSectorProduct(id: number): Promise<SectorProduct | undefined> {
    const [sp] = await db.select().from(sectorProducts).where(eq(sectorProducts.id, id));
    return sp;
  }

  async createSectorProduct(data: InsertSectorProduct): Promise<SectorProduct> {
    const [sp] = await db.insert(sectorProducts).values(data).returning();
    return sp;
  }

  async updateSectorProduct(id: number, data: Partial<InsertSectorProduct>): Promise<SectorProduct> {
    const [sp] = await db.update(sectorProducts).set(data).where(eq(sectorProducts.id, id)).returning();
    return sp;
  }

  async deleteSectorProduct(id: number): Promise<void> {
    await db.delete(sectorProductParameters).where(eq(sectorProductParameters.sectorProductId, id));
    await db.delete(sectorProducts).where(eq(sectorProducts.id, id));
  }

  // === Sector-Product-Parameter assignments (ArutsoK 25) ===
  async getSectorProductParameters(sectorProductId: number): Promise<SectorProductParameter[]> {
    return await db.select().from(sectorProductParameters).where(eq(sectorProductParameters.sectorProductId, sectorProductId));
  }

  async setSectorProductParameters(sectorProductId: number, parameterIds: number[]): Promise<void> {
    await db.delete(sectorProductParameters).where(eq(sectorProductParameters.sectorProductId, sectorProductId));
    if (parameterIds.length > 0) {
      await db.insert(sectorProductParameters).values(
        parameterIds.map(parameterId => ({ sectorProductId, parameterId }))
      );
    }
  }

  // === Parameters CRUD (ArutsoK 25: descending sort) ===
  async getParameters(): Promise<Parameter[]> {
    return await db.select().from(parameters).orderBy(desc(parameters.id));
  }

  async getParameter(id: number): Promise<Parameter | undefined> {
    const [parameter] = await db.select().from(parameters).where(eq(parameters.id, id));
    return parameter;
  }

  async createParameter(data: InsertParameter): Promise<Parameter> {
    const [parameter] = await db.insert(parameters).values(data).returning();
    return parameter;
  }

  async updateParameter(id: number, data: Partial<InsertParameter>): Promise<Parameter> {
    const [parameter] = await db.update(parameters).set(data).where(eq(parameters.id, id)).returning();
    return parameter;
  }

  async deleteParameter(id: number): Promise<void> {
    await db.delete(sectorParameters).where(eq(sectorParameters.parameterId, id));
    await db.delete(sectorProductParameters).where(eq(sectorProductParameters.parameterId, id));
    await db.delete(productParameters).where(eq(productParameters.parameterId, id));
    await db.delete(parameters).where(eq(parameters.id, id));
  }

  // === Sector-Parameter assignments ===
  async getSectorParameters(sectorId: number): Promise<SectorParameter[]> {
    return await db.select().from(sectorParameters).where(eq(sectorParameters.sectorId, sectorId));
  }

  async setSectorParameters(sectorId: number, parameterIds: number[]): Promise<void> {
    await db.delete(sectorParameters).where(eq(sectorParameters.sectorId, sectorId));
    if (parameterIds.length > 0) {
      await db.insert(sectorParameters).values(
        parameterIds.map(parameterId => ({ sectorId, parameterId }))
      );
    }
  }

  // === Product-Sector assignments ===
  async getProductSectors(productId: number): Promise<ProductSector[]> {
    return await db.select().from(productSectors).where(eq(productSectors.productId, productId));
  }

  async setProductSectors(productId: number, sectorIds: number[]): Promise<void> {
    await db.delete(productSectors).where(eq(productSectors.productId, productId));
    if (sectorIds.length > 0) {
      await db.insert(productSectors).values(
        sectorIds.map(sectorId => ({ productId, sectorId }))
      );
    }
  }

  // === Product-Parameter assignments ===
  async getProductParameters(productId: number): Promise<ProductParameter[]> {
    return await db.select().from(productParameters).where(eq(productParameters.productId, productId));
  }

  async setProductParameters(productId: number, params: { parameterId: number; overrideRequired?: boolean; overrideHelpText?: string }[]): Promise<void> {
    await db.delete(productParameters).where(eq(productParameters.productId, productId));
    if (params.length > 0) {
      await db.insert(productParameters).values(
        params.map(p => ({
          productId,
          parameterId: p.parameterId,
          overrideRequired: p.overrideRequired,
          overrideHelpText: p.overrideHelpText,
        }))
      );
    }
  }

  // === CALENDAR EVENTS ===
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    return await db.select().from(calendarEvents).orderBy(calendarEvents.startDate);
  }

  async getCalendarEvent(id: number): Promise<CalendarEvent | undefined> {
    const [event] = await db.select().from(calendarEvents).where(eq(calendarEvents.id, id));
    return event;
  }

  async createCalendarEvent(data: InsertCalendarEvent): Promise<CalendarEvent> {
    const [event] = await db.insert(calendarEvents).values(data).returning();
    return event;
  }

  async updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent> {
    const [event] = await db.update(calendarEvents).set({ ...data, updatedAt: new Date() }).where(eq(calendarEvents.id, id)).returning();
    return event;
  }

  async deleteCalendarEvent(id: number): Promise<void> {
    await db.delete(calendarEvents).where(eq(calendarEvents.id, id));
  }

  async getUpcomingEvents(limit: number = 5): Promise<CalendarEvent[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return await db.select().from(calendarEvents)
      .where(gte(calendarEvents.startDate, today))
      .orderBy(calendarEvents.startDate)
      .limit(limit);
  }

  // === PANELS CRUD (ArutsoK 27) ===
  async getPanels(): Promise<Panel[]> {
    return await db.select().from(panels).orderBy(desc(panels.id));
  }

  async getPanel(id: number): Promise<Panel | undefined> {
    const [panel] = await db.select().from(panels).where(eq(panels.id, id));
    return panel;
  }

  async createPanel(data: InsertPanel): Promise<Panel> {
    const [panel] = await db.insert(panels).values(data).returning();
    return panel;
  }

  async updatePanel(id: number, data: Partial<InsertPanel>): Promise<Panel> {
    const [panel] = await db.update(panels).set(data).where(eq(panels.id, id)).returning();
    return panel;
  }

  async deletePanel(id: number): Promise<void> {
    await db.delete(panelParameters).where(eq(panelParameters.panelId, id));
    await db.delete(productPanels).where(eq(productPanels.panelId, id));
    await db.delete(panels).where(eq(panels.id, id));
  }

  // === Panel-Parameter assignments (ArutsoK 27) ===
  async getPanelParameters(panelId: number): Promise<PanelParameter[]> {
    return await db.select().from(panelParameters)
      .where(eq(panelParameters.panelId, panelId))
      .orderBy(panelParameters.sortOrder);
  }

  async setPanelParameters(panelId: number, parameterIds: number[]): Promise<void> {
    await db.delete(panelParameters).where(eq(panelParameters.panelId, panelId));
    if (parameterIds.length > 0) {
      await db.insert(panelParameters).values(
        parameterIds.map((parameterId, index) => ({
          panelId,
          parameterId,
          sortOrder: index,
        }))
      );
    }
  }

  // === Product-Panel assignments (ArutsoK 27) ===
  async getProductPanels(sectorProductId: number): Promise<ProductPanel[]> {
    return await db.select().from(productPanels)
      .where(eq(productPanels.sectorProductId, sectorProductId))
      .orderBy(productPanels.sortOrder);
  }

  async setProductPanels(sectorProductId: number, panelIds: number[]): Promise<void> {
    await db.delete(productPanels).where(eq(productPanels.sectorProductId, sectorProductId));
    if (panelIds.length > 0) {
      await db.insert(productPanels).values(
        panelIds.map((panelId, index) => ({
          sectorProductId,
          panelId,
          sortOrder: index,
        }))
      );
    }
  }

  // === Contract Folders (ArutsoK 35) ===
  async getContractFolders(): Promise<ContractFolder[]> {
    return await db.select().from(contractFolders).orderBy(contractFolders.sortOrder);
  }

  async getContractFolder(id: number): Promise<ContractFolder | undefined> {
    const [folder] = await db.select().from(contractFolders).where(eq(contractFolders.id, id));
    return folder;
  }

  async createContractFolder(data: InsertContractFolder): Promise<ContractFolder> {
    const [folder] = await db.insert(contractFolders).values(data).returning();
    return folder;
  }

  async updateContractFolder(id: number, data: Partial<InsertContractFolder>): Promise<ContractFolder> {
    const [folder] = await db.update(contractFolders).set(data).where(eq(contractFolders.id, id)).returning();
    return folder;
  }

  async deleteContractFolder(id: number): Promise<void> {
    await db.delete(folderPanels).where(eq(folderPanels.folderId, id));
    await db.delete(contractFolders).where(eq(contractFolders.id, id));
  }

  async getFolderPanels(folderId: number): Promise<FolderPanel[]> {
    return await db.select().from(folderPanels)
      .where(eq(folderPanels.folderId, folderId))
      .orderBy(folderPanels.sortOrder);
  }

  async setFolderPanels(folderId: number, assignments: { panelId: number; gridColumns: number }[]): Promise<void> {
    await db.delete(folderPanels).where(eq(folderPanels.folderId, folderId));
    if (assignments.length > 0) {
      await db.insert(folderPanels).values(
        assignments.map((a, index) => ({
          folderId,
          panelId: a.panelId,
          gridColumns: a.gridColumns,
          sortOrder: index,
        }))
      );
    }
  }
}

export const storage = new DatabaseStorage();
