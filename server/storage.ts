import { db } from "./db";
import { decryptField } from "./crypto";
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
  clientTypes,
  contractStatuses, contractTemplates, contractInventories, contracts, contractPasswords, contractParameterValues,
  type ContractStatus, type InsertContractStatus,
  type ContractTemplate, type InsertContractTemplate,
  type ContractInventory, type InsertContractInventory,
  type Contract, type InsertContract,
  type ContractPassword, type InsertContractPassword,
  type ContractParameterValue, type InsertContractParameterValue,
  clientGroups, clientSubGroups, clientGroupMembers, userClientGroupMemberships,
  type ClientGroup, type InsertClientGroup,
  type ClientSubGroup, type InsertClientSubGroup,
  type ClientGroupMember, type InsertClientGroupMember,
  type UserClientGroupMembership,
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
  productFolderAssignments,
  type ProductFolderAssignment,
  contractFieldSettings,
  type ContractFieldSetting,
  careerLevels,
  type CareerLevel, type InsertCareerLevel,
  productPointRates,
  type ProductPointRate, type InsertProductPointRate,
  contractAcquirers,
  type ContractAcquirer, type InsertContractAcquirer,
  contractRewardDistributions,
  type ContractRewardDistribution, type InsertContractRewardDistribution,
  contractStatusCompanies, contractStatusVisibility, contractStatusContractTypes, contractStatusParameters, contractStatusChangeLogs,
  type ContractStatusCompany, type InsertContractStatusCompany,
  type ContractStatusVisibility, type InsertContractStatusVisibility,
  type ContractStatusContractType,
  type ContractStatusParameter, type InsertContractStatusParameter,
  type ContractStatusChangeLog, type InsertContractStatusChangeLog,
  entityLinks,
  type EntityLink, type InsertEntityLink,
  clientDocumentHistory,
  type ClientDocumentHistory, type InsertClientDocumentHistory,
  importLogs,
  type ImportLog, type InsertImportLog,
  commissions,
  type Commission, type InsertCommission,
  clientDataTabs, clientDataCategories, clientMarketingConsents,
  type ClientDataTab, type InsertClientDataTab,
  type ClientDataCategory, type InsertClientDataCategory,
  type ClientMarketingConsent, type InsertClientMarketingConsent,
  subjectPointsLog,
  type SubjectPointsLog, type InsertSubjectPointsLog,
  subjectFieldHistory,
  type SubjectFieldHistory, type InsertSubjectFieldHistory,
  subjectCollaborators,
  type SubjectCollaborator, type InsertSubjectCollaborator,
  subjectParamSections, subjectParameters, subjectTemplates, subjectTemplateParams,
  parameterSynonyms, unknownExtractedFields,
  type SubjectParamSection, type InsertSubjectParamSection,
  type SubjectParameter, type InsertSubjectParameter,
  type SubjectTemplate, type InsertSubjectTemplate,
  type SubjectTemplateParam, type InsertSubjectTemplateParam,
  type ParameterSynonym, type InsertParameterSynonym,
  type UnknownExtractedField, type InsertUnknownExtractedField,
} from "@shared/schema";
import { eq, and, or, ne, like, sql, lte, gte, gt, desc, asc, isNull, isNotNull, inArray } from "drizzle-orm";

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
  autoMoveUndeliveredContracts(): Promise<number>;
  
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
  
  getSubjects(params?: { search?: string; type?: 'person' | 'company'; isActive?: boolean; myCompanyId?: number }): Promise<Subject[]>;
  getSubject(id: number): Promise<Subject | undefined>;
  getSubjectByUid(uid: string): Promise<Subject | undefined>;
  getDynamicUIDPrefix(): Promise<string>;
  createSubject(subject: InsertSubject): Promise<Subject>;
  updateSubject(id: number, updates: UpdateSubjectRequest): Promise<Subject>;
  archiveSubject(id: number, reason: string): Promise<void>;

  getClientDocumentHistory(subjectId: number): Promise<ClientDocumentHistory[]>;
  createClientDocumentHistory(data: InsertClientDocumentHistory): Promise<ClientDocumentHistory>;

  getSubjectFieldHistory(subjectId: number, fieldKey?: string): Promise<SubjectFieldHistory[]>;
  recordFieldChanges(subjectId: number, original: any, updated: any, userId?: number, reason?: string): Promise<void>;

  anonymizeSubject(id: number, userId: number): Promise<Subject>;
  revealAnonymizedSubject(id: number): Promise<any>;

  getSubjectCollaborators(subjectId: number): Promise<SubjectCollaborator[]>;
  addSubjectCollaborator(data: InsertSubjectCollaborator): Promise<SubjectCollaborator>;
  deactivateSubjectCollaborator(id: number): Promise<SubjectCollaborator>;

  checkDuplicates(params: { birthNumber?: string; spz?: string; vin?: string }): Promise<Subject[]>;

  getEntityLinks(subjectId: number): Promise<EntityLink[]>;
  createEntityLink(data: InsertEntityLink): Promise<EntityLink>;
  closeEntityLink(id: number): Promise<EntityLink>;
  
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

  checkDuplicateSubject(params: { birthNumber?: string; ico?: string }): Promise<{ id: number; uid: string; name: string; type: string; matchedField: string } | undefined>;

  // Contract Statuses
  getContractStatuses(stateId?: number): Promise<ContractStatus[]>;
  getContractStatusUsageCounts(): Promise<{ statusId: number; count: number }[]>;
  createContractStatus(data: InsertContractStatus): Promise<ContractStatus>;
  updateContractStatus(id: number, data: Partial<InsertContractStatus>): Promise<ContractStatus>;
  deleteContractStatus(id: number): Promise<void>;
  reorderContractStatuses(items: { id: number; sortOrder: number }[]): Promise<void>;

  // Contract Status Companies (ArutsoK 49)
  getContractStatusCompanies(statusId: number): Promise<ContractStatusCompany[]>;
  setContractStatusCompanies(statusId: number, companyIds: number[]): Promise<void>;

  // Contract Status Visibility (ArutsoK 49)
  getContractStatusVisibility(statusId: number): Promise<ContractStatusVisibility[]>;
  setContractStatusVisibility(statusId: number, items: { entityType: string; entityId: number }[]): Promise<void>;

  // Contract Status Parameters (ArutsoK 49)
  getContractStatusParameters(statusId: number): Promise<ContractStatusParameter[]>;
  createContractStatusParameter(data: InsertContractStatusParameter): Promise<ContractStatusParameter>;
  updateContractStatusParameter(id: number, data: Partial<InsertContractStatusParameter>): Promise<ContractStatusParameter>;
  deleteContractStatusParameter(id: number): Promise<void>;
  reorderContractStatusParameters(items: { id: number; sortOrder: number }[]): Promise<void>;

  // Contract Status Change Logs (ArutsoK 49)
  getContractStatusChangeLogs(contractId: number): Promise<ContractStatusChangeLog[]>;
  createContractStatusChangeLog(data: InsertContractStatusChangeLog): Promise<ContractStatusChangeLog>;

  // Rejected contracts (ArutsoK 49)
  getRejectedContracts(companyId?: number, stateId?: number): Promise<Contract[]>;

  // Contract Templates
  getContractTemplates(stateId?: number): Promise<ContractTemplate[]>;
  createContractTemplate(data: InsertContractTemplate): Promise<ContractTemplate>;
  updateContractTemplate(id: number, data: Partial<InsertContractTemplate>): Promise<ContractTemplate>;
  deleteContractTemplate(id: number): Promise<void>;

  // Counters
  getNextCounterValue(counterName: string): Promise<number>;

  // Contract Inventories
  getContractInventories(stateId?: number): Promise<ContractInventory[]>;
  createContractInventory(data: InsertContractInventory): Promise<ContractInventory>;
  updateContractInventory(id: number, data: Partial<InsertContractInventory>): Promise<ContractInventory>;
  deleteContractInventory(id: number): Promise<void>;
  reorderContractInventories(items: { id: number; sortOrder: number }[]): Promise<void>;

  // Contracts
  getContracts(filters?: { stateId?: number; statusId?: number; inventoryId?: number; includeDeleted?: boolean; unprocessed?: boolean; dispatched?: boolean; companyId?: number }): Promise<Contract[]>;
  getDispatchedContracts(companyId?: number, stateId?: number): Promise<Contract[]>;
  getSystemContractStatus(): Promise<ContractStatus | undefined>;
  getContract(id: number): Promise<Contract | undefined>;
  createContract(data: InsertContract): Promise<Contract>;
  updateContract(id: number, data: Partial<InsertContract>): Promise<Contract>;
  softDeleteContract(id: number, deletedBy: string, ip: string): Promise<void>;
  restoreContract(id: number): Promise<void>;

  // Contract Acquirers (ArutsoK 47)
  getContractAcquirers(contractId: number): Promise<ContractAcquirer[]>;
  addContractAcquirer(data: InsertContractAcquirer): Promise<ContractAcquirer>;
  removeContractAcquirer(id: number): Promise<void>;
  getContractsByAcquirer(userId: number): Promise<Contract[]>;
  getSubjectIdsWhereUserIsAcquirer(userId: number): Promise<number[]>;
  checkContractDuplicate(contractNumber: string): Promise<{ exists: boolean; contract?: Contract; subjectName?: string }>;
  getSystemContractStatusByName(name: string): Promise<ContractStatus | undefined>;
  getAcceptedContracts(companyId?: number, stateId?: number): Promise<Contract[]>;
  getArchivedContracts(companyId?: number, stateId?: number): Promise<Contract[]>;

  getContractPasswords(contractId: number): Promise<ContractPassword[]>;
  createContractPassword(data: InsertContractPassword): Promise<ContractPassword>;
  deleteContractPassword(id: number): Promise<void>;

  getContractParameterValues(contractId: number): Promise<ContractParameterValue[]>;
  saveContractParameterValues(contractId: number, values: { parameterId: number; value: string; snapshotLabel?: string; snapshotType?: string; snapshotOptions?: string[]; snapshotHelpText?: string }[]): Promise<void>;

  getContractRewardDistributions(contractId: number): Promise<ContractRewardDistribution[]>;
  saveContractRewardDistributions(contractId: number, distributions: InsertContractRewardDistribution[]): Promise<ContractRewardDistribution[]>;

  // Client Groups
  getClientGroups(stateId?: number): Promise<ClientGroup[]>;
  getClientGroup(id: number): Promise<ClientGroup | undefined>;
  getClientGroupByPermissionGroupId(permissionGroupId: number): Promise<ClientGroup | undefined>;
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

  // User Client Group Memberships
  getUserClientGroupMemberships(userId: number): Promise<(UserClientGroupMembership & { group?: ClientGroup })[]>;
  addUserClientGroupMembership(userId: number, groupId: number): Promise<UserClientGroupMembership>;
  removeUserClientGroupMembership(userId: number, groupId: number): Promise<void>;
  setUserClientGroupMemberships(userId: number, groupIds: number[]): Promise<void>;
  getUserEffectivePermissionLevel(userId: number): Promise<number>;
  getUserEffectivePermissionGroupIds(userId: number): Promise<number[]>;

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

  // Product Folder Assignments (ArutsoK 38)
  getProductFolderAssignments(productId: number): Promise<ProductFolderAssignment[]>;
  setProductFolderAssignments(productId: number, assignments: { folderId: number; sortOrder: number }[]): Promise<void>;

  // Contract Field Settings (ArutsoK 38)
  getContractFieldSettings(): Promise<ContractFieldSetting[]>;
  upsertContractFieldSetting(fieldKey: string, requiredForPfa: boolean): Promise<ContractFieldSetting>;

  // Calendar Events
  getCalendarEvents(): Promise<CalendarEvent[]>;
  getCalendarEvent(id: number): Promise<CalendarEvent | undefined>;
  createCalendarEvent(data: InsertCalendarEvent): Promise<CalendarEvent>;
  updateCalendarEvent(id: number, data: Partial<InsertCalendarEvent>): Promise<CalendarEvent>;
  deleteCalendarEvent(id: number): Promise<void>;
  getUpcomingEvents(limit?: number): Promise<CalendarEvent[]>;

  // Career Levels
  getCareerLevels(): Promise<CareerLevel[]>;
  createCareerLevel(data: InsertCareerLevel): Promise<CareerLevel>;
  updateCareerLevel(id: number, data: Partial<InsertCareerLevel>): Promise<CareerLevel>;
  deleteCareerLevel(id: number): Promise<void>;

  // Product Point Rates
  getProductPointRates(): Promise<ProductPointRate[]>;
  createProductPointRate(data: InsertProductPointRate): Promise<ProductPointRate>;
  updateProductPointRate(id: number, data: Partial<InsertProductPointRate>): Promise<ProductPointRate>;
  deleteProductPointRate(id: number): Promise<void>;

  restoreEntity(entityType: string, id: number): Promise<void>;
  permanentDeleteEntity(entityType: string, id: number): Promise<void>;
  getAllDeletedEntities(): Promise<Array<{id: number; entityType: string; name: string; deletedAt: Date}>>;

  getImportLogs(companyId?: number): Promise<ImportLog[]>;
  getImportLog(id: number): Promise<ImportLog | undefined>;
  createImportLog(data: InsertImportLog): Promise<ImportLog>;

  getCommissionsByImport(importId: number): Promise<Commission[]>;
  getCommissionsByContract(contractId: number): Promise<Commission[]>;
  createCommissionRecord(data: InsertCommission): Promise<Commission>;

  // Client Data Tabs & Categories
  getClientDataTabs(): Promise<ClientDataTab[]>;
  getClientDataCategories(tabId?: number): Promise<ClientDataCategory[]>;

  // Client Marketing Consents (M:N per client × company)
  getClientMarketingConsents(subjectId: number, companyId?: number): Promise<ClientMarketingConsent[]>;
  upsertClientMarketingConsent(data: InsertClientMarketingConsent): Promise<ClientMarketingConsent>;

  updateSubjectUiPreferences(subjectId: number, prefs: Record<string, any>): Promise<Subject>;

  getSubjectPointsLog(subjectId: number): Promise<SubjectPointsLog[]>;
  getPointsByIdentifier(identifierType: string, identifierValue: string, windowYears?: number): Promise<SubjectPointsLog[]>;
  addSubjectPoints(data: InsertSubjectPointsLog): Promise<SubjectPointsLog>;
  recalculateBonitaPoints(subjectId: number): Promise<number>;
  findSubjectsByIdentifier(identifierType: string, identifierValue: string): Promise<Subject[]>;
  updateSubjectListStatus(subjectId: number, listStatus: "cerveny" | "cierny" | null, changedByUserId: number, reason?: string): Promise<Subject>;
  findRiskLinks(subjectId: number): Promise<Array<{ subjectId: number; name: string; uid: string; listStatus: string; matchType: string; matchValue: string }>>;
  findLinkedFoPoRisks(subjectId: number): Promise<Array<{ subjectId: number; name: string; uid: string; listStatus: string; relationship: string }>>;
  recalculateAllBonita(): Promise<{ processed: number; updated: number; errors: number }>;

  getSubjectParamSections(clientTypeId?: number): Promise<SubjectParamSection[]>;
  createSubjectParamSection(data: InsertSubjectParamSection): Promise<SubjectParamSection>;
  updateSubjectParamSection(id: number, data: Partial<InsertSubjectParamSection>): Promise<SubjectParamSection>;
  deleteSubjectParamSection(id: number): Promise<void>;

  getSubjectParameters(clientTypeId?: number): Promise<SubjectParameter[]>;
  getSubjectParameter(id: number): Promise<SubjectParameter | undefined>;
  createSubjectParameter(data: InsertSubjectParameter): Promise<SubjectParameter>;
  updateSubjectParameter(id: number, data: Partial<InsertSubjectParameter>): Promise<SubjectParameter>;
  deleteSubjectParameter(id: number): Promise<void>;

  getSubjectTemplates(): Promise<SubjectTemplate[]>;
  getSubjectTemplate(id: number): Promise<SubjectTemplate | undefined>;
  createSubjectTemplate(data: InsertSubjectTemplate): Promise<SubjectTemplate>;
  updateSubjectTemplate(id: number, data: Partial<InsertSubjectTemplate>): Promise<SubjectTemplate>;
  deleteSubjectTemplate(id: number): Promise<void>;

  getSubjectTemplateParams(templateId: number): Promise<SubjectTemplateParam[]>;
  createSubjectTemplateParam(data: InsertSubjectTemplateParam): Promise<SubjectTemplateParam>;
  updateSubjectTemplateParam(id: number, data: Partial<InsertSubjectTemplateParam>): Promise<SubjectTemplateParam>;
  deleteSubjectTemplateParam(id: number): Promise<void>;
  bulkSetTemplateParams(templateId: number, paramIds: number[]): Promise<void>;

  getResolvedParametersForTemplate(templateId: number, contractDate?: Date): Promise<SubjectParameter[]>;

  getParameterSynonyms(parameterId: number): Promise<ParameterSynonym[]>;
  getAllParameterSynonyms(): Promise<ParameterSynonym[]>;
  createParameterSynonym(data: InsertParameterSynonym): Promise<ParameterSynonym>;
  deleteParameterSynonym(id: number): Promise<void>;
  matchParameterBySynonym(text: string): Promise<{ parameterId: number; synonym: string; confidence: number }[]>;

  getParameterUsageCount(parameterId: number): Promise<number>;

  getUnknownExtractedFields(status?: string): Promise<UnknownExtractedField[]>;
  createUnknownExtractedField(data: InsertUnknownExtractedField): Promise<UnknownExtractedField>;
  updateUnknownExtractedField(id: number, data: Partial<InsertUnknownExtractedField>): Promise<UnknownExtractedField>;
  deleteUnknownExtractedField(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {

  async generateUID(stateCode: string, continentCode?: string): Promise<string> {
    const counterName = `uid_global`;
    const nextValue = await this.getNextCounterValue(counterName);
    const padded = nextValue.toString().padStart(12, '0');
    return `421${padded}`;
  }

  async getContinents() {
    return await db.select().from(continents);
  }
  
  async getStates(continentId?: number): Promise<State[]> {
    if (continentId) {
      return await db.select().from(states).where(eq(states.continentId, continentId)).orderBy(states.name);
    }
    return await db.select().from(states).orderBy(states.name);
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

  async autoMoveUndeliveredContracts(): Promise<number> {
    let undeliveredStatus = await this.getSystemContractStatusByName("Nedorucena 30 dni");
    if (!undeliveredStatus) {
      undeliveredStatus = await this.createContractStatus({
        name: "Nedorucena 30 dni",
        color: "#f97316",
        sortOrder: 998,
        isCommissionable: false,
        isFinal: false,
        assignsNumber: false,
        definesContractEnd: false,
        isSystem: true,
      } as any);
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const eligibleSupisky = await db
      .select({
        supiskaId: supisky.id,
        contractId: supiskaContracts.contractId,
        contractCount: sql<number>`count(${supiskaContracts.contractId}) over (partition by ${supisky.id})`,
      })
      .from(supisky)
      .innerJoin(supiskaContracts, eq(supiskaContracts.supiskaId, supisky.id))
      .where(and(
        eq(supisky.status, "Odoslana"),
        lte(supisky.sentAt, thirtyDaysAgo),
      ));

    const singleContractEntries = eligibleSupisky.filter(e => e.contractCount === 1);

    let movedCount = 0;
    for (const entry of singleContractEntries) {
      const contract = await this.getContract(entry.contractId);
      if (!contract || contract.isDeleted) continue;
      if (contract.statusId === undeliveredStatus.id) continue;

      const oldStatusId = contract.statusId;

      await db.update(contracts)
        .set({
          statusId: undeliveredStatus.id,
          lastStatusUpdate: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(contracts.id, entry.contractId));

      await this.createContractStatusChangeLog({
        contractId: entry.contractId,
        oldStatusId: oldStatusId,
        newStatusId: undeliveredStatus.id,
        changedByUserId: null,
        statusNote: "System: Zmluva automaticky presunuta do vyhrad – lehota 30 dni prekrocena.",
      } as any);

      await db.insert(auditLogs).values({
        userId: null,
        username: "SYSTEM",
        action: "auto_undelivered_30d",
        module: "contracts",
        entityId: entry.contractId,
        entityName: contract.contractNumber || contract.uid || `ID:${entry.contractId}`,
        oldData: { statusId: oldStatusId },
        newData: { statusId: undeliveredStatus.id },
      });

      movedCount++;
    }

    return movedCount;
  }

  async getPartners(includeDeleted?: boolean) {
    if (includeDeleted) {
      return await db.select().from(partners).orderBy(asc(partners.name));
    }
    return await db.select().from(partners).where(eq(partners.isDeleted, false)).orderBy(asc(partners.name));
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

  async getSubjects(params?: { search?: string; type?: 'person' | 'company'; isActive?: boolean; myCompanyId?: number; stateId?: number }) {
    const contractCountSub = sql<number>`(SELECT COUNT(*)::int FROM contracts WHERE contracts.subject_id = subjects.id)`;
    const conditions = [];

    if (params?.search) {
      const raw = params.search;
      const stripped = raw.replace(/[\s\-\+\(\)\/\.]/g, "");
      conditions.push(
        or(
          like(subjects.firstName, `%${raw}%`),
          like(subjects.lastName, `%${raw}%`),
          like(subjects.companyName, `%${raw}%`),
          like(subjects.uid, `%${raw}%`),
          sql`LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${subjects.phone},''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '/', ''), '.', '')) ILIKE ${'%' + stripped + '%'}`,
          sql`LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${subjects.email},''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '/', ''), '.', '')) ILIKE ${'%' + stripped + '%'}`,
          sql`LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${subjects.iban},''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '/', ''), '.', '')) ILIKE ${'%' + stripped + '%'}`,
          sql`LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${subjects.ico},''), ' ', ''), '-', ''), '+', ''), '(', ''), ')', ''), '/', ''), '.', '')) ILIKE ${'%' + stripped + '%'}`
        )
      );
    }
    if (params?.type) conditions.push(eq(subjects.type, params.type));
    if (params?.isActive !== undefined) conditions.push(eq(subjects.isActive, params.isActive));
    if (params?.myCompanyId) conditions.push(eq(subjects.myCompanyId, params.myCompanyId));
    if (params?.stateId) conditions.push(eq(subjects.stateId, params.stateId));
    conditions.push(isNull(subjects.deletedAt));

    const query = db.select({
      subject: subjects,
      contractCount: contractCountSub,
    }).from(subjects);

    const rows = await query.where(and(...conditions)).orderBy(desc(subjects.id));

    return rows.map(r => ({ ...r.subject, contractCount: r.contractCount ?? 0 }));
  }

  async getSubject(id: number) {
    const [subject] = await db.select().from(subjects).where(eq(subjects.id, id));
    return subject;
  }

  async getSubjectByUid(uid: string) {
    const raw = uid.replace(/\s/g, "");
    const formatted = raw.replace(/(\d{3})(?=\d)/g, "$1 ");
    const [subject] = await db.select().from(subjects).where(
      or(eq(subjects.uid, raw), eq(subjects.uid, formatted))
    );
    return subject;
  }

  async getDynamicUIDPrefix(): Promise<string> {
    const recentSubjects = await db
      .select({ uid: subjects.uid })
      .from(subjects)
      .where(eq(subjects.isActive, true))
      .orderBy(desc(subjects.id))
      .limit(10);

    if (recentSubjects.length === 0) return "";

    const uids = recentSubjects.map(s => s.uid?.replace(/\s/g, "")).filter((u): u is string => !!u && /^\d{12,15}$/.test(u));
    if (uids.length === 0) return "";

    let prefix = uids[0];
    for (let i = 1; i < uids.length; i++) {
      let common = "";
      for (let j = 0; j < prefix.length && j < uids[i].length; j++) {
        if (prefix[j] === uids[i][j]) {
          common += prefix[j];
        } else {
          break;
        }
      }
      prefix = common;
      if (prefix.length === 0) break;
    }

    const aligned = Math.floor(prefix.length / 3) * 3;
    return aligned > 0 && aligned < 15 ? prefix.slice(0, aligned) : "";
  }

  async createSubject(insertSubject: InsertSubject) {
    const state = insertSubject.stateId ? await db.select().from(states).where(eq(states.id, insertSubject.stateId)).then(r => r[0]) : null;
    const company = insertSubject.myCompanyId ? await db.select().from(myCompanies).where(eq(myCompanies.id, insertSubject.myCompanyId)).then(r => r[0]) : null;
    const continent = state?.continentId ? await db.select().from(continents).where(eq(continents.id, state.continentId)).then(r => r[0]) : null;
    
    if (!state || !company || !continent) {
      throw new Error("Invalid hierarchy references for UID generation");
    }

    if (!insertSubject.continentId && continent) {
      insertSubject.continentId = continent.id;
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

    await this.recordFieldChanges(id, original, subjectUpdates, undefined, changeReason);

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
    await db.update(subjects).set({ isActive: false, deletedAt: new Date() }).where(eq(subjects.id, id));
  }

  async getClientDocumentHistory(subjectId: number): Promise<ClientDocumentHistory[]> {
    return await db.select().from(clientDocumentHistory)
      .where(eq(clientDocumentHistory.subjectId, subjectId))
      .orderBy(desc(clientDocumentHistory.archivedAt));
  }

  async createClientDocumentHistory(data: InsertClientDocumentHistory): Promise<ClientDocumentHistory> {
    const [record] = await db.insert(clientDocumentHistory).values(data).returning();
    return record;
  }

  async getSubjectFieldHistory(subjectId: number, fieldKey?: string): Promise<SubjectFieldHistory[]> {
    if (fieldKey) {
      return await db.select().from(subjectFieldHistory)
        .where(and(eq(subjectFieldHistory.subjectId, subjectId), eq(subjectFieldHistory.fieldKey, fieldKey)))
        .orderBy(desc(subjectFieldHistory.changedAt));
    }
    return await db.select().from(subjectFieldHistory)
      .where(eq(subjectFieldHistory.subjectId, subjectId))
      .orderBy(desc(subjectFieldHistory.changedAt));
  }

  async recordFieldChanges(subjectId: number, original: any, updated: any, userId?: number, reason?: string): Promise<void> {
    const historyEntries: InsertSubjectFieldHistory[] = [];
    const staticKeys = ['firstName', 'lastName', 'companyName', 'email', 'phone', 'birthNumber',
      'idCardNumber', 'iban', 'swift', 'kikId', 'commissionLevel', 'listStatus', 'cgnRating',
      'isActive', 'isDeceased', 'type', 'linkedFoId'];

    for (const key of staticKeys) {
      const oldVal = original[key];
      const newVal = updated[key];
      if (newVal !== undefined && String(oldVal ?? '') !== String(newVal ?? '')) {
        historyEntries.push({
          subjectId,
          fieldKey: key,
          fieldSource: 'static',
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
          changedByUserId: userId ?? null,
          changeReason: reason ?? null,
        });
      }
    }

    const origDetails = (original.details as any) || {};
    const newDetails = (updated.details as any) || {};
    const origDynamic = origDetails.dynamicFields || {};
    const newDynamic = newDetails.dynamicFields || {};
    const allDynamicKeys = Array.from(new Set([...Object.keys(origDynamic), ...Object.keys(newDynamic)]));
    for (const key of allDynamicKeys) {
      const oldVal = origDynamic[key];
      const newVal = newDynamic[key];
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        historyEntries.push({
          subjectId,
          fieldKey: key,
          fieldSource: 'dynamic',
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
          changedByUserId: userId ?? null,
          changeReason: reason ?? null,
        });
      }
    }

    if (historyEntries.length > 0) {
      await db.insert(subjectFieldHistory).values(historyEntries);
    }
  }

  async anonymizeSubject(id: number, userId: number): Promise<Subject> {
    const original = await this.getSubject(id);
    if (!original) throw new Error("Subject not found");

    const { encryptField } = await import("./crypto");
    const piiData = {
      firstName: original.firstName,
      lastName: original.lastName,
      companyName: original.companyName,
      email: original.email,
      phone: original.phone,
      birthNumber: original.birthNumber,
      idCardNumber: original.idCardNumber,
      iban: original.iban,
      swift: original.swift,
      details: original.details,
    };
    const encryptedPayload = encryptField(JSON.stringify(piiData));

    const [updated] = await db.update(subjects).set({
      firstName: null,
      lastName: 'ANONYMIZOVANÝ',
      companyName: original.type === 'company' ? 'ANONYMIZOVANÁ FIRMA' : null,
      email: null,
      phone: null,
      birthNumber: null,
      idCardNumber: null,
      iban: null,
      swift: null,
      details: {},
      isAnonymized: true,
      anonymizedAt: new Date(),
      anonymizedByUserId: userId,
      anonymizedData: encryptedPayload,
    }).where(eq(subjects.id, id)).returning();
    return updated;
  }

  async revealAnonymizedSubject(id: number): Promise<any> {
    const subject = await this.getSubject(id);
    if (!subject || !subject.isAnonymized || !subject.anonymizedData) {
      throw new Error("Subject is not anonymized or data not found");
    }
    const { decryptField } = await import("./crypto");
    const decrypted = decryptField(subject.anonymizedData!);
    return JSON.parse(decrypted);
  }

  async getSubjectCollaborators(subjectId: number): Promise<SubjectCollaborator[]> {
    return await db.select().from(subjectCollaborators)
      .where(eq(subjectCollaborators.subjectId, subjectId))
      .orderBy(desc(subjectCollaborators.createdAt));
  }

  async addSubjectCollaborator(data: InsertSubjectCollaborator): Promise<SubjectCollaborator> {
    const existing = await db.select().from(subjectCollaborators)
      .where(and(
        eq(subjectCollaborators.subjectId, data.subjectId),
        eq(subjectCollaborators.role, data.role),
        eq(subjectCollaborators.isActive, true)
      ));
    if (existing.length > 0) {
      await db.update(subjectCollaborators).set({
        isActive: false,
        validTo: new Date(),
      }).where(eq(subjectCollaborators.id, existing[0].id));
    }
    const [collab] = await db.insert(subjectCollaborators).values(data).returning();
    return collab;
  }

  async deactivateSubjectCollaborator(id: number): Promise<SubjectCollaborator> {
    const [updated] = await db.update(subjectCollaborators).set({
      isActive: false,
      validTo: new Date(),
    }).where(eq(subjectCollaborators.id, id)).returning();
    return updated;
  }

  async checkDuplicates(params: { birthNumber?: string; spz?: string; vin?: string }): Promise<Subject[]> {
    const conditions: any[] = [];
    if (params.birthNumber) {
      conditions.push(eq(subjects.birthNumber, params.birthNumber));
    }
    const allSubjects = await db.select().from(subjects).where(isNull(subjects.deletedAt));
    const results: Subject[] = [];
    const seen = new Set<number>();

    if (params.birthNumber) {
      for (const s of allSubjects) {
        if (s.birthNumber === params.birthNumber && !seen.has(s.id)) {
          results.push(s);
          seen.add(s.id);
        }
      }
    }

    if (params.spz || params.vin) {
      for (const s of allSubjects) {
        if (seen.has(s.id)) continue;
        const details = (s.details as any) || {};
        const dynFields = details.dynamicFields || {};
        if (params.spz && Object.values(dynFields).some((v: any) => String(v).toLowerCase() === params.spz!.toLowerCase())) {
          results.push(s);
          seen.add(s.id);
        }
        if (params.vin && Object.values(dynFields).some((v: any) => String(v).toLowerCase() === params.vin!.toLowerCase())) {
          results.push(s);
          seen.add(s.id);
        }
      }
    }

    return results;
  }

  async getEntityLinks(subjectId: number): Promise<EntityLink[]> {
    return await db.select().from(entityLinks)
      .where(or(eq(entityLinks.sourceId, subjectId), eq(entityLinks.targetId, subjectId)))
      .orderBy(desc(entityLinks.dateFrom));
  }

  async createEntityLink(data: InsertEntityLink): Promise<EntityLink> {
    const [link] = await db.insert(entityLinks).values(data).returning();
    return link;
  }

  async closeEntityLink(id: number): Promise<EntityLink> {
    const [link] = await db.update(entityLinks)
      .set({ dateTo: new Date() })
      .where(eq(entityLinks.id, id))
      .returning();
    return link;
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
    return await db.select().from(permissionGroups).where(isNull(permissionGroups.deletedAt));
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
    await db.update(permissionGroups).set({ deletedAt: new Date() }).where(eq(permissionGroups.id, id));
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
      'dashboard', 'spolocnosti', 'staty', 'partneri', 'produkty',
      'subjekty', 'zmluvy', 'evidencia_zmluv', 'supisky', 'sektory',
      'provizie', 'odmeny', 'sadzby',
      'kalendar', 'novinky', 'dokumenty',
      'nastavenia', 'historia', 'pouzivatelia', 'skupiny_pravomoci',
      'archiv', 'pravidla_typov'
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
    const now = new Date();
    await db.update(clientTypes).set({ deletedAt: now } as any).where(eq(clientTypes.id, id));
  }

  async checkDuplicateSubject(params: { birthNumber?: string; ico?: string }): Promise<{ id: number; uid: string; name: string; type: string; matchedField: string } | undefined> {
    const makeResult = (id: number, uid: string, name: string, type: string, matchedField: string) => ({ id, uid, name, type, matchedField });
    const subjectName = (s: { type: string; firstName: string | null; lastName: string | null; companyName: string | null }) =>
      s.type === "person" ? `${s.firstName || ""} ${s.lastName || ""}`.trim() : s.companyName || "";

    if (params.birthNumber) {
      const normalizedInput = params.birthNumber.replace(/[\s\/\-]/g, "");
      const allWithBn = await db.select().from(subjects)
        .where(isNotNull(subjects.birthNumber));
      for (const s of allWithBn) {
        if (!s.birthNumber) continue;
        const decrypted = decryptField(s.birthNumber);
        const stored = decrypted || s.birthNumber;
        if (stored.replace(/[\s\/\-]/g, "") === normalizedInput) {
          return makeResult(s.id, s.uid || "", subjectName(s), s.type, "RC");
        }
      }
      const archivedSubjects = await db.select().from(subjectArchive);
      for (const a of archivedSubjects) {
        const data = a.data as any;
        if (!data?.birthNumber) continue;
        const decrypted = decryptField(data.birthNumber);
        const stored = decrypted || data.birthNumber;
        if (stored.replace(/[\s\/\-]/g, "") === normalizedInput) {
          return makeResult(a.originalId, a.uid, data.type === "person" ? `${data.firstName || ""} ${data.lastName || ""}`.trim() : data.companyName || "", data.type || "person", "RC");
        }
      }
    }

    if (params.ico) {
      const normalizedIco = params.ico.replace(/\s/g, "");
      const [foundSubject] = await db.select().from(subjects)
        .where(sql`REPLACE(${subjects.details}->>'ico', ' ', '') = ${normalizedIco}`);
      if (foundSubject) return makeResult(foundSubject.id, foundSubject.uid || "", foundSubject.companyName || `${foundSubject.firstName || ""} ${foundSubject.lastName || ""}`.trim(), foundSubject.type, "IČO");

      const archivedSubjects = await db.select().from(subjectArchive);
      for (const a of archivedSubjects) {
        const data = a.data as any;
        const archivedIco = data?.details?.ico || data?.ico;
        if (archivedIco && archivedIco.replace(/\s/g, "") === normalizedIco) {
          return makeResult(a.originalId, a.uid, data.companyName || `${data.firstName || ""} ${data.lastName || ""}`.trim(), data.type || "company", "IČO");
        }
      }

      const [foundCompany] = await db.select().from(myCompanies)
        .where(sql`REPLACE(${myCompanies.ico}, ' ', '') = ${normalizedIco}`);
      if (foundCompany) return makeResult(foundCompany.id, foundCompany.uid || "", foundCompany.name, "company", "IČO");

      const [foundPartner] = await db.select().from(partners)
        .where(sql`REPLACE(${partners.ico}, ' ', '') = ${normalizedIco}`);
      if (foundPartner) return makeResult(foundPartner.id, foundPartner.uid || "", foundPartner.name, "company", "IČO");
    }

    return undefined;
  }

  // === Contract Statuses ===

  async getContractStatuses(stateId?: number): Promise<ContractStatus[]> {
    if (stateId) {
      return await db.select().from(contractStatuses)
        .where(and(or(eq(contractStatuses.stateId, stateId), isNull(contractStatuses.stateId)), isNull(contractStatuses.deletedAt)))
        .orderBy(contractStatuses.sortOrder);
    }
    return await db.select().from(contractStatuses).where(isNull(contractStatuses.deletedAt)).orderBy(contractStatuses.sortOrder);
  }

  async getContractStatusUsageCounts(): Promise<{ statusId: number; count: number }[]> {
    const result = await db
      .select({
        statusId: contracts.statusId,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(contracts)
      .where(isNotNull(contracts.statusId))
      .groupBy(contracts.statusId);
    return result.map(r => ({ statusId: r.statusId!, count: r.count }));
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
    await db.update(contractStatuses).set({ deletedAt: new Date() }).where(eq(contractStatuses.id, id));
  }

  async reorderContractStatuses(items: { id: number; sortOrder: number }[]): Promise<void> {
    for (const item of items) {
      await db.update(contractStatuses).set({ sortOrder: item.sortOrder }).where(eq(contractStatuses.id, item.id));
    }
  }

  // === Contract Status Companies (ArutsoK 49) ===

  async getContractStatusCompanies(statusId: number): Promise<ContractStatusCompany[]> {
    return await db.select().from(contractStatusCompanies)
      .where(eq(contractStatusCompanies.statusId, statusId));
  }

  async setContractStatusCompanies(statusId: number, companyIds: number[]): Promise<void> {
    await db.delete(contractStatusCompanies).where(eq(contractStatusCompanies.statusId, statusId));
    if (companyIds.length > 0) {
      await db.insert(contractStatusCompanies).values(companyIds.map(companyId => ({ statusId, companyId })));
    }
  }

  // === Contract Status Visibility (ArutsoK 49) ===

  async getContractStatusVisibility(statusId: number): Promise<ContractStatusVisibility[]> {
    return await db.select().from(contractStatusVisibility)
      .where(eq(contractStatusVisibility.statusId, statusId));
  }

  async setContractStatusVisibility(statusId: number, items: { entityType: string; entityId: number }[]): Promise<void> {
    await db.delete(contractStatusVisibility).where(eq(contractStatusVisibility.statusId, statusId));
    if (items.length > 0) {
      await db.insert(contractStatusVisibility).values(items.map(i => ({ statusId, entityType: i.entityType, entityId: i.entityId })));
    }
  }

  // === Contract Status Contract Types ===

  async getContractStatusContractTypes(statusId: number): Promise<ContractStatusContractType[]> {
    return await db.select().from(contractStatusContractTypes)
      .where(eq(contractStatusContractTypes.statusId, statusId));
  }

  async setContractStatusContractTypes(statusId: number, types: string[]): Promise<void> {
    await db.delete(contractStatusContractTypes).where(eq(contractStatusContractTypes.statusId, statusId));
    if (types.length > 0) {
      await db.insert(contractStatusContractTypes).values(types.map(contractType => ({ statusId, contractType })));
    }
  }

  async getAllContractStatusContractTypes(): Promise<ContractStatusContractType[]> {
    return await db.select().from(contractStatusContractTypes);
  }

  // === Contract Status Parameters (ArutsoK 49) ===

  async getContractStatusParameters(statusId: number): Promise<ContractStatusParameter[]> {
    return await db.select().from(contractStatusParameters)
      .where(eq(contractStatusParameters.statusId, statusId))
      .orderBy(contractStatusParameters.sortOrder);
  }

  async createContractStatusParameter(data: InsertContractStatusParameter): Promise<ContractStatusParameter> {
    const [created] = await db.insert(contractStatusParameters).values(data as any).returning();
    return created;
  }

  async updateContractStatusParameter(id: number, data: Partial<InsertContractStatusParameter>): Promise<ContractStatusParameter> {
    const [updated] = await db.update(contractStatusParameters).set(data).where(eq(contractStatusParameters.id, id)).returning();
    return updated;
  }

  async deleteContractStatusParameter(id: number): Promise<void> {
    await db.delete(contractStatusParameters).where(eq(contractStatusParameters.id, id));
  }

  async reorderContractStatusParameters(items: { id: number; sortOrder: number }[]): Promise<void> {
    for (const item of items) {
      await db.update(contractStatusParameters).set({ sortOrder: item.sortOrder }).where(eq(contractStatusParameters.id, item.id));
    }
  }

  // === Contract Status Change Logs (ArutsoK 49) ===

  async getContractStatusChangeLogs(contractId: number): Promise<ContractStatusChangeLog[]> {
    return await db.select().from(contractStatusChangeLogs)
      .where(eq(contractStatusChangeLogs.contractId, contractId))
      .orderBy(desc(contractStatusChangeLogs.createdAt));
  }

  async createContractStatusChangeLog(data: InsertContractStatusChangeLog): Promise<ContractStatusChangeLog> {
    const existingCount = await db.select({ count: sql<number>`count(*)::int` })
      .from(contractStatusChangeLogs)
      .where(and(
        eq(contractStatusChangeLogs.contractId, data.contractId),
        eq(contractStatusChangeLogs.newStatusId, data.newStatusId),
      ));
    const iteration = (existingCount[0]?.count || 0) + 1;
    const [created] = await db.insert(contractStatusChangeLogs)
      .values({ ...data, statusIteration: iteration } as any)
      .returning();
    return created;
  }

  async getLatestStatusChangeLogsForContracts(contractIds: number[]): Promise<Record<number, { hasNote: boolean; hasDocs: boolean }>> {
    if (contractIds.length === 0) return {};
    const logs = await db.select().from(contractStatusChangeLogs)
      .where(inArray(contractStatusChangeLogs.contractId, contractIds))
      .orderBy(desc(contractStatusChangeLogs.changedAt));
    const result: Record<number, { hasNote: boolean; hasDocs: boolean }> = {};
    for (const log of logs) {
      if (result[log.contractId]) continue;
      result[log.contractId] = {
        hasNote: !!log.statusNote && log.statusNote.trim().length > 0,
        hasDocs: Array.isArray(log.statusChangeDocuments) && (log.statusChangeDocuments as any[]).length > 0,
      };
    }
    return result;
  }

  // === Rejected Contracts (ArutsoK 49) ===

  async getRejectedContracts(companyId?: number, stateId?: number): Promise<Contract[]> {
    const rejectedStatus = await this.getSystemContractStatusByName("Neprijata - vyhrady");
    const undeliveredStatus = await this.getSystemContractStatusByName("Nedorucena 30 dni");
    const statusIds: number[] = [];
    if (rejectedStatus) statusIds.push(rejectedStatus.id);
    if (undeliveredStatus) statusIds.push(undeliveredStatus.id);
    if (statusIds.length === 0) return [];
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    const conditions = [
      eq(contracts.isDeleted, false),
      inArray(contracts.statusId, statusIds),
      gt(contracts.updatedAt, hundredDaysAgo),
    ];
    if (companyId) conditions.push(eq(contracts.companyId, companyId));
    if (stateId) conditions.push(eq(contracts.stateId, stateId));
    return await db.select().from(contracts)
      .where(and(...conditions))
      .orderBy(sql`${contracts.updatedAt} DESC`);
  }

  // === Contract Templates ===

  async getContractTemplates(stateId?: number): Promise<ContractTemplate[]> {
    if (stateId) {
      return await db.select().from(contractTemplates)
        .where(and(eq(contractTemplates.stateId, stateId), isNull(contractTemplates.deletedAt)))
        .orderBy(contractTemplates.name);
    }
    return await db.select().from(contractTemplates).where(isNull(contractTemplates.deletedAt)).orderBy(contractTemplates.name);
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
    await db.update(contractTemplates).set({ deletedAt: new Date() }).where(eq(contractTemplates.id, id));
  }

  // === Counters ===

  async getNextCounterValue(counterName: string): Promise<number> {
    const [result] = await db
      .update(globalCounters)
      .set({ currentValue: sql`${globalCounters.currentValue} + 1` })
      .where(eq(globalCounters.counterName, counterName))
      .returning();
    if (result) return result.currentValue;
    const [created] = await db
      .insert(globalCounters)
      .values({ counterName, currentValue: 1 })
      .returning();
    return created.currentValue;
  }

  // === Contract Inventories ===

  async getContractInventories(stateId?: number): Promise<ContractInventory[]> {
    if (stateId) {
      return await db.select().from(contractInventories)
        .where(and(eq(contractInventories.stateId, stateId), isNull(contractInventories.deletedAt)))
        .orderBy(contractInventories.sortOrder);
    }
    return await db.select().from(contractInventories).where(isNull(contractInventories.deletedAt)).orderBy(contractInventories.sortOrder);
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
    await db.update(contractInventories).set({ deletedAt: new Date() }).where(eq(contractInventories.id, id));
  }

  async reorderContractInventories(items: { id: number; sortOrder: number }[]): Promise<void> {
    for (const item of items) {
      await db.update(contractInventories).set({ sortOrder: item.sortOrder }).where(eq(contractInventories.id, item.id));
    }
  }

  // === Contracts ===

  async getContracts(filters?: { stateId?: number; statusId?: number; inventoryId?: number; includeDeleted?: boolean; unprocessed?: boolean; dispatched?: boolean; companyId?: number }): Promise<Contract[]> {
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
    if (filters?.unprocessed) {
      conditions.push(isNull(contracts.inventoryId));
    }
    if (filters?.companyId) {
      conditions.push(eq(contracts.companyId, filters.companyId));
    }
    if (conditions.length > 0) {
      return await db.select().from(contracts).where(and(...conditions)).orderBy(sql`${contracts.createdAt} DESC`);
    }
    return await db.select().from(contracts).orderBy(sql`${contracts.createdAt} DESC`);
  }

  async getDispatchedContracts(companyId?: number, stateId?: number): Promise<Contract[]> {
    const conditions = [
      eq(contracts.isDeleted, false),
      isNotNull(contracts.inventoryId),
      eq(contractInventories.isAccepted, false),
      eq(contractInventories.isDispatched, true),
    ];
    if (companyId) conditions.push(eq(contracts.companyId, companyId));
    if (stateId) conditions.push(eq(contracts.stateId, stateId));
    return await db.select({ contract: contracts })
      .from(contracts)
      .innerJoin(contractInventories, eq(contracts.inventoryId, contractInventories.id))
      .where(and(...conditions))
      .orderBy(contracts.inventoryId, contracts.sortOrderInInventory)
      .then(rows => rows.map(r => r.contract));
  }

  async getSystemContractStatus(): Promise<ContractStatus | undefined> {
    const [status] = await db.select().from(contractStatuses).where(eq(contractStatuses.isSystem, true)).limit(1);
    return status;
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

  // === CONTRACT ACQUIRERS (ArutsoK 47) ===
  async getContractAcquirers(contractId: number): Promise<ContractAcquirer[]> {
    return await db.select().from(contractAcquirers)
      .where(eq(contractAcquirers.contractId, contractId))
      .orderBy(contractAcquirers.createdAt);
  }

  async addContractAcquirer(data: InsertContractAcquirer): Promise<ContractAcquirer> {
    const [created] = await db.insert(contractAcquirers).values(data as any).returning();
    return created;
  }

  async removeContractAcquirer(id: number): Promise<void> {
    await db.delete(contractAcquirers).where(eq(contractAcquirers.id, id));
  }

  async getContractsByAcquirer(userId: number): Promise<Contract[]> {
    const rows = await db.select({ contract: contracts })
      .from(contractAcquirers)
      .innerJoin(contracts, eq(contractAcquirers.contractId, contracts.id))
      .where(and(
        eq(contractAcquirers.userId, userId),
        eq(contracts.isDeleted, false)
      ));
    return rows.map(r => r.contract);
  }

  async getSubjectIdsWhereUserIsAcquirer(userId: number): Promise<number[]> {
    const rows = await db.selectDistinct({ subjectId: contracts.subjectId })
      .from(contractAcquirers)
      .innerJoin(contracts, eq(contractAcquirers.contractId, contracts.id))
      .where(and(
        eq(contractAcquirers.userId, userId),
        eq(contracts.isDeleted, false)
      ));
    return rows.filter(r => r.subjectId !== null).map(r => r.subjectId!);
  }

  async checkContractDuplicate(contractNumber: string): Promise<{ exists: boolean; contract?: Contract; subjectName?: string }> {
    if (!contractNumber || !contractNumber.trim()) return { exists: false };
    const [found] = await db.select().from(contracts)
      .where(and(
        eq(contracts.contractNumber, contractNumber.trim()),
        eq(contracts.isDeleted, false)
      ))
      .limit(1);
    if (!found) return { exists: false };
    let subjectName: string | undefined;
    if (found.subjectId) {
      const [subj] = await db.select().from(subjects).where(eq(subjects.id, found.subjectId)).limit(1);
      if (subj) {
        subjectName = subj.type === "person" ? `${subj.firstName} ${subj.lastName}` : (subj.companyName || undefined);
      }
    }
    return { exists: true, contract: found, subjectName };
  }

  async getSystemContractStatusByName(name: string): Promise<ContractStatus | undefined> {
    const [status] = await db.select().from(contractStatuses)
      .where(and(eq(contractStatuses.name, name), eq(contractStatuses.isSystem, true)))
      .limit(1);
    return status;
  }

  async getAcceptedContracts(companyId?: number, stateId?: number): Promise<Contract[]> {
    const acceptedStatus = await this.getSystemContractStatusByName("Prijata centrom - OK");
    if (!acceptedStatus) return [];
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const conditions = [
      eq(contracts.isDeleted, false),
      eq(contracts.statusId, acceptedStatus.id),
      gte(contracts.acceptedAt, oneYearAgo),
    ];
    if (companyId) conditions.push(eq(contracts.companyId, companyId));
    if (stateId) conditions.push(eq(contracts.stateId, stateId));
    return await db.select().from(contracts)
      .where(and(...conditions))
      .orderBy(sql`${contracts.acceptedAt} DESC`);
  }

  async getArchivedContracts(companyId?: number, stateId?: number): Promise<Contract[]> {
    const rejectedStatus = await this.getSystemContractStatusByName("Neprijata - vyhrady");
    const undeliveredStatus = await this.getSystemContractStatusByName("Nedorucena 30 dni");
    const statusIds: number[] = [];
    if (rejectedStatus) statusIds.push(rejectedStatus.id);
    if (undeliveredStatus) statusIds.push(undeliveredStatus.id);
    if (statusIds.length === 0) return [];
    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);
    const conditions = [
      eq(contracts.isDeleted, false),
      inArray(contracts.statusId, statusIds),
      lte(contracts.updatedAt, hundredDaysAgo),
    ];
    if (companyId) conditions.push(eq(contracts.companyId, companyId));
    if (stateId) conditions.push(eq(contracts.stateId, stateId));
    return await db.select().from(contracts)
      .where(and(...conditions))
      .orderBy(sql`${contracts.updatedAt} DESC`);
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

  async saveContractParameterValues(contractId: number, values: { parameterId: number; value: string; snapshotLabel?: string; snapshotType?: string; snapshotOptions?: string[]; snapshotHelpText?: string }[]): Promise<void> {
    await db.delete(contractParameterValues).where(eq(contractParameterValues.contractId, contractId));
    if (values.length > 0) {
      await db.insert(contractParameterValues).values(
        values.map(v => ({
          contractId,
          parameterId: v.parameterId,
          value: v.value,
          snapshotLabel: v.snapshotLabel || null,
          snapshotType: v.snapshotType || null,
          snapshotOptions: v.snapshotOptions || [],
          snapshotHelpText: v.snapshotHelpText || null,
        }))
      );
    }
  }

  async getContractRewardDistributions(contractId: number): Promise<ContractRewardDistribution[]> {
    return await db.select().from(contractRewardDistributions)
      .where(eq(contractRewardDistributions.contractId, contractId))
      .orderBy(asc(contractRewardDistributions.sortOrder));
  }

  async saveContractRewardDistributions(contractId: number, distributions: InsertContractRewardDistribution[]): Promise<ContractRewardDistribution[]> {
    await db.delete(contractRewardDistributions).where(eq(contractRewardDistributions.contractId, contractId));
    if (distributions.length === 0) return [];
    const inserted = await db.insert(contractRewardDistributions).values(
      distributions.map((d, i) => ({
        contractId,
        type: d.type,
        uid: d.uid,
        percentage: d.percentage,
        sortOrder: i,
      }))
    ).returning();
    return inserted;
  }

  // === CLIENT GROUPS ===
  async getClientGroups(stateId?: number): Promise<ClientGroup[]> {
    if (stateId) {
      return await db.select().from(clientGroups)
        .where(or(eq(clientGroups.stateId, stateId), isNull(clientGroups.stateId)))
        .orderBy(clientGroups.sortOrder);
    }
    return await db.select().from(clientGroups).orderBy(clientGroups.sortOrder);
  }

  async getClientGroup(id: number): Promise<ClientGroup | undefined> {
    const [group] = await db.select().from(clientGroups).where(eq(clientGroups.id, id));
    return group;
  }

  async getClientGroupByPermissionGroupId(permissionGroupId: number): Promise<ClientGroup | undefined> {
    const [group] = await db.select().from(clientGroups).where(eq(clientGroups.permissionGroupId, permissionGroupId));
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

  async getUserClientGroupMemberships(userId: number): Promise<(UserClientGroupMembership & { group?: ClientGroup })[]> {
    const rows = await db.select()
      .from(userClientGroupMemberships)
      .leftJoin(clientGroups, eq(userClientGroupMemberships.groupId, clientGroups.id))
      .where(eq(userClientGroupMemberships.userId, userId));
    return rows.map(r => ({
      ...r.user_client_group_memberships,
      group: r.client_groups || undefined,
    }));
  }

  async addUserClientGroupMembership(userId: number, groupId: number): Promise<UserClientGroupMembership> {
    const existing = await db.select().from(userClientGroupMemberships)
      .where(and(eq(userClientGroupMemberships.userId, userId), eq(userClientGroupMemberships.groupId, groupId)));
    if (existing.length > 0) return existing[0];
    const [row] = await db.insert(userClientGroupMemberships).values({ userId, groupId }).returning();
    return row;
  }

  async removeUserClientGroupMembership(userId: number, groupId: number): Promise<void> {
    await db.delete(userClientGroupMemberships)
      .where(and(eq(userClientGroupMemberships.userId, userId), eq(userClientGroupMemberships.groupId, groupId)));
  }

  async setUserClientGroupMemberships(userId: number, groupIds: number[]): Promise<void> {
    await db.delete(userClientGroupMemberships).where(eq(userClientGroupMemberships.userId, userId));
    if (groupIds.length > 0) {
      await db.insert(userClientGroupMemberships).values(groupIds.map(groupId => ({ userId, groupId })));
    }
  }

  async getUserEffectivePermissionLevel(userId: number): Promise<number> {
    const rows = await db.select({ permissionLevel: clientGroups.permissionLevel })
      .from(userClientGroupMemberships)
      .innerJoin(clientGroups, eq(userClientGroupMemberships.groupId, clientGroups.id))
      .where(eq(userClientGroupMemberships.userId, userId));
    if (rows.length === 0) return 1;
    return Math.max(...rows.map(r => r.permissionLevel));
  }

  async getUserEffectivePermissionGroupIds(userId: number): Promise<number[]> {
    const rows = await db.select({ permissionGroupId: clientGroups.permissionGroupId })
      .from(userClientGroupMemberships)
      .innerJoin(clientGroups, eq(userClientGroupMemberships.groupId, clientGroups.id))
      .where(eq(userClientGroupMemberships.userId, userId));
    const ids = rows
      .map(r => r.permissionGroupId)
      .filter((id): id is number => id !== null);
    return Array.from(new Set(ids));
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
    const conditions: any[] = [isNull(commissionRates.deletedAt)];
    if (filters?.partnerId) conditions.push(eq(commissionRates.partnerId, filters.partnerId));
    if (filters?.productId) conditions.push(eq(commissionRates.productId, filters.productId));
    if (filters?.stateId) conditions.push(eq(commissionRates.stateId, filters.stateId));
    if (filters?.isActive !== undefined) conditions.push(eq(commissionRates.isActive, filters.isActive));
    return db.select().from(commissionRates).where(and(...conditions)).orderBy(commissionRates.createdAt);
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
    await db.update(commissionRates).set({ deletedAt: new Date() }).where(eq(commissionRates.id, id));
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
        c.global_number,
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
    return await db.select().from(sectors).where(isNull(sectors.deletedAt)).orderBy(desc(sectors.id));
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
    const now = new Date();
    const secs = await db.select().from(sections).where(eq(sections.sectorId, id));
    for (const sec of secs) {
      await db.update(sectorProducts).set({ deletedAt: now }).where(eq(sectorProducts.sectionId, sec.id));
    }
    await db.update(sections).set({ deletedAt: now }).where(eq(sections.sectorId, id));
    await db.update(sectors).set({ deletedAt: now }).where(eq(sectors.id, id));
  }

  // === Sections CRUD (ArutsoK 28) ===
  async getSections(sectorId?: number): Promise<Section[]> {
    if (sectorId !== undefined) {
      return await db.select().from(sections).where(and(eq(sections.sectorId, sectorId), isNull(sections.deletedAt))).orderBy(desc(sections.id));
    }
    return await db.select().from(sections).where(isNull(sections.deletedAt)).orderBy(desc(sections.id));
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
    const now = new Date();
    await db.update(sectorProducts).set({ deletedAt: now }).where(eq(sectorProducts.sectionId, id));
    await db.update(sections).set({ deletedAt: now }).where(eq(sections.id, id));
  }

  // === Sector Products CRUD (ArutsoK 28 - now linked via sectionId) ===
  async getSectorProducts(sectionId?: number): Promise<SectorProduct[]> {
    if (sectionId !== undefined) {
      return await db.select().from(sectorProducts).where(and(eq(sectorProducts.sectionId, sectionId), isNull(sectorProducts.deletedAt))).orderBy(desc(sectorProducts.id));
    }
    return await db.select().from(sectorProducts).where(isNull(sectorProducts.deletedAt)).orderBy(desc(sectorProducts.id));
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
    await db.update(sectorProducts).set({ deletedAt: new Date() }).where(eq(sectorProducts.id, id));
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
    return await db.select().from(parameters).where(isNull(parameters.deletedAt)).orderBy(desc(parameters.id));
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
    await db.update(parameters).set({ deletedAt: new Date() }).where(eq(parameters.id, id));
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
    return await db.select().from(panels).where(isNull(panels.deletedAt)).orderBy(desc(panels.id));
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
    await db.update(panels).set({ deletedAt: new Date() }).where(eq(panels.id, id));
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
    return await db.select().from(contractFolders).where(isNull(contractFolders.deletedAt)).orderBy(contractFolders.sortOrder);
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
    await db.update(contractFolders).set({ deletedAt: new Date() }).where(eq(contractFolders.id, id));
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

  // Product Folder Assignments (ArutsoK 38)
  async getProductFolderAssignments(productId: number): Promise<ProductFolderAssignment[]> {
    return await db.select().from(productFolderAssignments)
      .where(eq(productFolderAssignments.productId, productId))
      .orderBy(productFolderAssignments.sortOrder);
  }

  async setProductFolderAssignments(productId: number, assignments: { folderId: number; sortOrder: number }[]): Promise<void> {
    await db.delete(productFolderAssignments).where(eq(productFolderAssignments.productId, productId));
    if (assignments.length > 0) {
      await db.insert(productFolderAssignments).values(
        assignments.map(a => ({
          productId,
          folderId: a.folderId,
          sortOrder: a.sortOrder,
        }))
      );
    }
  }

  // Contract Field Settings (ArutsoK 38)
  async getContractFieldSettings(): Promise<ContractFieldSetting[]> {
    return await db.select().from(contractFieldSettings);
  }

  async upsertContractFieldSetting(fieldKey: string, requiredForPfa: boolean): Promise<ContractFieldSetting> {
    const existing = await db.select().from(contractFieldSettings).where(eq(contractFieldSettings.fieldKey, fieldKey));
    if (existing.length > 0) {
      const [updated] = await db.update(contractFieldSettings)
        .set({ requiredForPfa })
        .where(eq(contractFieldSettings.fieldKey, fieldKey))
        .returning();
      return updated;
    }
    const [created] = await db.insert(contractFieldSettings).values({ fieldKey, requiredForPfa }).returning();
    return created;
  }

  async getCareerLevels(): Promise<CareerLevel[]> {
    return db.select().from(careerLevels).orderBy(desc(careerLevels.sortOrder));
  }

  async createCareerLevel(data: InsertCareerLevel): Promise<CareerLevel> {
    const [created] = await db.insert(careerLevels).values(data).returning();
    return created;
  }

  async updateCareerLevel(id: number, data: Partial<InsertCareerLevel>): Promise<CareerLevel> {
    const [updated] = await db.update(careerLevels)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(careerLevels.id, id))
      .returning();
    return updated;
  }

  async deleteCareerLevel(id: number): Promise<void> {
    await db.delete(careerLevels).where(eq(careerLevels.id, id));
  }

  async getProductPointRates(): Promise<ProductPointRate[]> {
    return db.select().from(productPointRates).orderBy(asc(productPointRates.id));
  }

  async createProductPointRate(data: InsertProductPointRate): Promise<ProductPointRate> {
    const [created] = await db.insert(productPointRates).values(data).returning();
    return created;
  }

  async updateProductPointRate(id: number, data: Partial<InsertProductPointRate>): Promise<ProductPointRate> {
    const [updated] = await db.update(productPointRates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(productPointRates.id, id))
      .returning();
    return updated;
  }

  async deleteProductPointRate(id: number): Promise<void> {
    await db.delete(productPointRates).where(eq(productPointRates.id, id));
  }

  async restoreEntity(entityType: string, id: number): Promise<void> {
    switch (entityType) {
      case 'subjects': await db.update(subjects).set({ deletedAt: null, isActive: true }).where(eq(subjects.id, id)); break;
      case 'sectors': await db.update(sectors).set({ deletedAt: null }).where(eq(sectors.id, id)); break;
      case 'sections': await db.update(sections).set({ deletedAt: null }).where(eq(sections.id, id)); break;
      case 'sectorProducts': await db.update(sectorProducts).set({ deletedAt: null }).where(eq(sectorProducts.id, id)); break;
      case 'parameters': await db.update(parameters).set({ deletedAt: null }).where(eq(parameters.id, id)); break;
      case 'panels': await db.update(panels).set({ deletedAt: null }).where(eq(panels.id, id)); break;
      case 'contractFolders': await db.update(contractFolders).set({ deletedAt: null }).where(eq(contractFolders.id, id)); break;
      case 'contractStatuses': await db.update(contractStatuses).set({ deletedAt: null }).where(eq(contractStatuses.id, id)); break;
      case 'contractTemplates': await db.update(contractTemplates).set({ deletedAt: null }).where(eq(contractTemplates.id, id)); break;
      case 'contractInventories': await db.update(contractInventories).set({ deletedAt: null }).where(eq(contractInventories.id, id)); break;
      case 'commissionRates': await db.update(commissionRates).set({ deletedAt: null }).where(eq(commissionRates.id, id)); break;
      case 'permissionGroups': await db.update(permissionGroups).set({ deletedAt: null }).where(eq(permissionGroups.id, id)); break;
      default: throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  async permanentDeleteEntity(entityType: string, id: number): Promise<void> {
    switch (entityType) {
      case 'subjects': await db.delete(subjects).where(and(eq(subjects.id, id), isNotNull(subjects.deletedAt))); break;
      case 'sectors': await db.delete(sectors).where(and(eq(sectors.id, id), isNotNull(sectors.deletedAt))); break;
      case 'sections': await db.delete(sections).where(and(eq(sections.id, id), isNotNull(sections.deletedAt))); break;
      case 'sectorProducts': await db.delete(sectorProducts).where(and(eq(sectorProducts.id, id), isNotNull(sectorProducts.deletedAt))); break;
      case 'parameters': await db.delete(parameters).where(and(eq(parameters.id, id), isNotNull(parameters.deletedAt))); break;
      case 'panels': await db.delete(panels).where(and(eq(panels.id, id), isNotNull(panels.deletedAt))); break;
      case 'contractFolders': await db.delete(contractFolders).where(and(eq(contractFolders.id, id), isNotNull(contractFolders.deletedAt))); break;
      case 'contractStatuses': await db.delete(contractStatuses).where(and(eq(contractStatuses.id, id), isNotNull(contractStatuses.deletedAt))); break;
      case 'contractTemplates': await db.delete(contractTemplates).where(and(eq(contractTemplates.id, id), isNotNull(contractTemplates.deletedAt))); break;
      case 'contractInventories': await db.delete(contractInventories).where(and(eq(contractInventories.id, id), isNotNull(contractInventories.deletedAt))); break;
      case 'commissionRates': await db.delete(commissionRates).where(and(eq(commissionRates.id, id), isNotNull(commissionRates.deletedAt))); break;
      case 'permissionGroups': await db.delete(permissionGroups).where(and(eq(permissionGroups.id, id), isNotNull(permissionGroups.deletedAt))); break;
      default: throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  async getAllDeletedEntities(): Promise<Array<{id: number; entityType: string; name: string; deletedAt: Date}>> {
    const results: Array<{id: number; entityType: string; name: string; deletedAt: Date}> = [];

    const deletedSubjects = await db.select().from(subjects).where(isNotNull(subjects.deletedAt));
    for (const s of deletedSubjects) {
      const name = s.type === 'company' ? (s.companyName || '') : `${s.firstName || ''} ${s.lastName || ''}`.trim();
      results.push({ id: s.id, entityType: 'Subjekt', name: name || s.uid, deletedAt: s.deletedAt! });
    }


    const deletedSectors = await db.select().from(sectors).where(isNotNull(sectors.deletedAt));
    for (const s of deletedSectors) results.push({ id: s.id, entityType: 'Sektor', name: s.name, deletedAt: s.deletedAt! });

    const deletedSections = await db.select().from(sections).where(isNotNull(sections.deletedAt));
    for (const s of deletedSections) results.push({ id: s.id, entityType: 'Sekcia', name: s.name, deletedAt: s.deletedAt! });

    const deletedSectorProducts = await db.select().from(sectorProducts).where(isNotNull(sectorProducts.deletedAt));
    for (const sp of deletedSectorProducts) results.push({ id: sp.id, entityType: 'Produkt sektora', name: sp.name, deletedAt: sp.deletedAt! });

    const deletedParameters = await db.select().from(parameters).where(isNotNull(parameters.deletedAt));
    for (const p of deletedParameters) results.push({ id: p.id, entityType: 'Parameter', name: p.name, deletedAt: p.deletedAt! });

    const deletedPanels = await db.select().from(panels).where(isNotNull(panels.deletedAt));
    for (const p of deletedPanels) results.push({ id: p.id, entityType: 'Panel', name: p.name, deletedAt: p.deletedAt! });

    const deletedContractFolders = await db.select().from(contractFolders).where(isNotNull(contractFolders.deletedAt));
    for (const f of deletedContractFolders) results.push({ id: f.id, entityType: 'Priečinok', name: f.name, deletedAt: f.deletedAt! });

    const deletedContractStatuses = await db.select().from(contractStatuses).where(isNotNull(contractStatuses.deletedAt));
    for (const s of deletedContractStatuses) results.push({ id: s.id, entityType: 'Stav zmluvy', name: s.name, deletedAt: s.deletedAt! });

    const deletedContractTemplates = await db.select().from(contractTemplates).where(isNotNull(contractTemplates.deletedAt));
    for (const t of deletedContractTemplates) results.push({ id: t.id, entityType: 'Šablóna zmluvy', name: t.name, deletedAt: t.deletedAt! });

    const deletedContractInventories = await db.select().from(contractInventories).where(isNotNull(contractInventories.deletedAt));
    for (const i of deletedContractInventories) results.push({ id: i.id, entityType: 'Supiska', name: i.name, deletedAt: i.deletedAt! });

    const deletedCommissionRates = await db.select().from(commissionRates).where(isNotNull(commissionRates.deletedAt));
    for (const r of deletedCommissionRates) results.push({ id: r.id, entityType: 'Provízna sadzba', name: `Sadzba #${r.id}`, deletedAt: r.deletedAt! });

    const deletedPermissionGroups = await db.select().from(permissionGroups).where(isNotNull(permissionGroups.deletedAt));
    for (const g of deletedPermissionGroups) results.push({ id: g.id, entityType: 'Skupina oprávnení', name: g.name, deletedAt: g.deletedAt! });

    results.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
    return results;
  }

  async getImportLogs(companyId?: number): Promise<ImportLog[]> {
    if (companyId) {
      return await db.select().from(importLogs).where(eq(importLogs.companyId, companyId)).orderBy(desc(importLogs.uploadedAt));
    }
    return await db.select().from(importLogs).orderBy(desc(importLogs.uploadedAt));
  }

  async getImportLog(id: number): Promise<ImportLog | undefined> {
    const [log] = await db.select().from(importLogs).where(eq(importLogs.id, id));
    return log;
  }

  async createImportLog(data: InsertImportLog): Promise<ImportLog> {
    const [log] = await db.insert(importLogs).values(data).returning();
    return log;
  }

  async getCommissionsByImport(importId: number): Promise<Commission[]> {
    return await db.select().from(commissions).where(eq(commissions.importId, importId)).orderBy(desc(commissions.createdAt));
  }

  async getCommissionsByContract(contractId: number): Promise<Commission[]> {
    return await db.select().from(commissions).where(eq(commissions.contractId, contractId)).orderBy(desc(commissions.createdAt));
  }

  async createCommissionRecord(data: InsertCommission): Promise<Commission> {
    const [c] = await db.insert(commissions).values(data).returning();
    return c;
  }

  async getClientDataTabs(): Promise<ClientDataTab[]> {
    return await db.select().from(clientDataTabs).where(eq(clientDataTabs.isActive, true)).orderBy(asc(clientDataTabs.sortOrder));
  }

  async getClientDataCategories(tabId?: number): Promise<ClientDataCategory[]> {
    if (tabId) {
      return await db.select().from(clientDataCategories).where(and(eq(clientDataCategories.tabId, tabId), eq(clientDataCategories.isActive, true))).orderBy(asc(clientDataCategories.sortOrder));
    }
    return await db.select().from(clientDataCategories).where(eq(clientDataCategories.isActive, true)).orderBy(asc(clientDataCategories.sortOrder));
  }

  async getClientMarketingConsents(subjectId: number, companyId?: number): Promise<ClientMarketingConsent[]> {
    if (companyId) {
      return await db.select().from(clientMarketingConsents).where(and(eq(clientMarketingConsents.subjectId, subjectId), eq(clientMarketingConsents.companyId, companyId)));
    }
    return await db.select().from(clientMarketingConsents).where(eq(clientMarketingConsents.subjectId, subjectId));
  }

  async upsertClientMarketingConsent(data: InsertClientMarketingConsent): Promise<ClientMarketingConsent> {
    const existing = await db.select().from(clientMarketingConsents).where(and(
      eq(clientMarketingConsents.subjectId, data.subjectId),
      eq(clientMarketingConsents.companyId, data.companyId),
      eq(clientMarketingConsents.consentType, data.consentType || 'marketing')
    ));
    if (existing.length > 0) {
      const [updated] = await db.update(clientMarketingConsents)
        .set({ isGranted: data.isGranted, grantedAt: data.isGranted ? new Date() : null, revokedAt: !data.isGranted ? new Date() : null, note: data.note, updatedAt: new Date() })
        .where(eq(clientMarketingConsents.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(clientMarketingConsents).values({ ...data, grantedAt: data.isGranted ? new Date() : null }).returning();
    return created;
  }

  async updateSubjectUiPreferences(subjectId: number, prefs: Record<string, any>): Promise<Subject> {
    const existing = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
    const currentPrefs = (existing[0]?.uiPreferences || {}) as Record<string, any>;
    const merged = { ...currentPrefs, ...prefs };
    const [updated] = await db.update(subjects).set({ uiPreferences: merged as any }).where(eq(subjects.id, subjectId)).returning();
    return updated;
  }

  async getSubjectPointsLog(subjectId: number): Promise<SubjectPointsLog[]> {
    return await db.select().from(subjectPointsLog)
      .where(eq(subjectPointsLog.subjectId, subjectId))
      .orderBy(desc(subjectPointsLog.createdAt));
  }

  async getPointsByIdentifier(identifierType: string, identifierValue: string, windowYears: number = 10): Promise<SubjectPointsLog[]> {
    const cutoffDate = new Date();
    cutoffDate.setFullYear(cutoffDate.getFullYear() - windowYears);
    return await db.select().from(subjectPointsLog)
      .where(and(
        eq(subjectPointsLog.identifierType, identifierType),
        eq(subjectPointsLog.identifierValue, identifierValue),
        gte(subjectPointsLog.createdAt, cutoffDate)
      ))
      .orderBy(desc(subjectPointsLog.createdAt));
  }

  async addSubjectPoints(data: InsertSubjectPointsLog): Promise<SubjectPointsLog> {
    const [created] = await db.insert(subjectPointsLog).values(data).returning();
    return created;
  }

  async recalculateBonitaPoints(subjectId: number): Promise<number> {
    const subject = await this.getSubject(subjectId);
    if (!subject) return 0;

    const identifierType = subject.birthNumber ? "rc" : "ico";
    const identifierValue = subject.birthNumber || (subject as any).details?.ico;
    if (!identifierValue) {
      const logs = await this.getSubjectPointsLog(subjectId);
      const total = logs.reduce((sum, l) => sum + l.points, 0);
      await db.update(subjects).set({ bonitaPoints: total }).where(eq(subjects.id, subjectId));
      return total;
    }

    const allLogs = await this.getPointsByIdentifier(identifierType, identifierValue, 10);
    const total = allLogs.reduce((sum, l) => sum + l.points, 0);

    const allSubjects = await this.findSubjectsByIdentifier(identifierType, identifierValue);
    for (const s of allSubjects) {
      await db.update(subjects).set({ bonitaPoints: total }).where(eq(subjects.id, s.id));
      if (total <= -5 && s.listStatus !== "cierny") {
        await db.update(subjects).set({
          listStatus: "cerveny",
          listStatusReason: `Automaticky: bodové saldo ${total} (prah -5)`,
          listStatusChangedAt: new Date(),
        }).where(and(eq(subjects.id, s.id), isNull(subjects.listStatus)));
      }
    }
    return total;
  }

  async findSubjectsByIdentifier(identifierType: string, identifierValue: string): Promise<Subject[]> {
    if (identifierType === "rc") {
      return await db.select().from(subjects)
        .where(and(eq(subjects.birthNumber, identifierValue), isNull(subjects.deletedAt)));
    }
    const allSubjects = await db.select().from(subjects).where(isNull(subjects.deletedAt));
    return allSubjects.filter(s => {
      const details = (s.details || {}) as Record<string, any>;
      return details.ico === identifierValue || details.dynamicFields?.ico === identifierValue;
    });
  }

  async updateSubjectListStatus(subjectId: number, listStatus: "cerveny" | "cierny" | null, changedByUserId: number, reason?: string): Promise<Subject> {
    const [updated] = await db.update(subjects).set({
      listStatus,
      listStatusChangedBy: changedByUserId,
      listStatusChangedAt: new Date(),
      listStatusReason: reason || null,
    }).where(eq(subjects.id, subjectId)).returning();
    return updated;
  }

  async findRiskLinks(subjectId: number): Promise<Array<{ subjectId: number; name: string; uid: string; listStatus: string; matchType: string; matchValue: string }>> {
    const subject = await this.getSubject(subjectId);
    if (!subject) return [];

    const riskySubjects = await db.select().from(subjects)
      .where(and(
        isNull(subjects.deletedAt),
        sql`${subjects.id} != ${subjectId}`,
        sql`${subjects.listStatus} IS NOT NULL`
      ));

    if (riskySubjects.length === 0) return [];

    const results: Array<{ subjectId: number; name: string; uid: string; listStatus: string; matchType: string; matchValue: string }> = [];
    const subjectDetails = (subject.details || {}) as Record<string, any>;
    const dynFields = subjectDetails.dynamicFields || {};

    const normalizePhone = (p: string) => p.replace(/[\s\-\+\(\)]/g, "");
    const rawPhone = subject.phone || dynFields.telefon || dynFields.phone || "";
    const myPhone = normalizePhone(rawPhone);
    const myEmail = (subject.email || dynFields.email || "").toLowerCase().trim();
    const collectAddresses = (dyn: Record<string, any>) => {
      const addrs: string[] = [];
      const tp = [dyn.tp_ulica, dyn.tp_mesto, dyn.tp_psc].filter(Boolean).join("|").toLowerCase();
      if (tp.length > 5) addrs.push(tp);
      const ka = [dyn.ka_ulica, dyn.ka_mesto, dyn.ka_psc].filter(Boolean).join("|").toLowerCase();
      if (ka.length > 5) addrs.push(ka);
      const doruc = [dyn.doruc_ulica, dyn.doruc_mesto, dyn.doruc_psc].filter(Boolean).join("|").toLowerCase();
      if (doruc.length > 5) addrs.push(doruc);
      const sidlo = [dyn.sidlo_ulica, dyn.sidlo_mesto, dyn.sidlo_psc].filter(Boolean).join("|").toLowerCase();
      if (sidlo.length > 5) addrs.push(sidlo);
      return addrs;
    };
    const myAddresses = collectAddresses(dynFields);

    for (const risky of riskySubjects) {
      const riskyDetails = (risky.details || {}) as Record<string, any>;
      const riskyDyn = riskyDetails.dynamicFields || {};
      const riskyName = risky.companyName || [risky.firstName, risky.lastName].filter(Boolean).join(" ") || risky.uid;

      if (myPhone && myPhone.length >= 6) {
        const riskyPhone = normalizePhone(risky.phone || riskyDyn.telefon || riskyDyn.phone || "");
        if (riskyPhone && riskyPhone.length >= 6 && riskyPhone === myPhone) {
          results.push({ subjectId: risky.id, name: riskyName, uid: risky.uid, listStatus: risky.listStatus!, matchType: "telefón", matchValue: rawPhone });
        }
      }

      if (myEmail && myEmail.length >= 3) {
        const riskyEmail = (risky.email || riskyDyn.email || "").toLowerCase().trim();
        if (riskyEmail && riskyEmail === myEmail) {
          results.push({ subjectId: risky.id, name: riskyName, uid: risky.uid, listStatus: risky.listStatus!, matchType: "e-mail", matchValue: myEmail });
        }
      }

      if (myAddresses.length > 0) {
        const riskyAddresses = collectAddresses(riskyDyn);
        for (const myAddr of myAddresses) {
          for (const riskyAddr of riskyAddresses) {
            if (riskyAddr === myAddr) {
              const addrParts = myAddr.split("|");
              results.push({ subjectId: risky.id, name: riskyName, uid: risky.uid, listStatus: risky.listStatus!, matchType: "adresa", matchValue: addrParts.join(", ") });
              break;
            }
          }
        }
      }
    }

    return results;
  }

  async findLinkedFoPoRisks(subjectId: number): Promise<Array<{ subjectId: number; name: string; uid: string; listStatus: string; relationship: string }>> {
    const subject = await this.getSubject(subjectId);
    if (!subject) return [];
    const results: Array<{ subjectId: number; name: string; uid: string; listStatus: string; relationship: string }> = [];

    if (subject.type === "company") {
      if (subject.linkedFoId) {
        const linkedFo = await this.getSubject(subject.linkedFoId);
        if (linkedFo && linkedFo.listStatus) {
          const foName = [linkedFo.firstName, linkedFo.lastName].filter(Boolean).join(" ") || linkedFo.uid;
          results.push({ subjectId: linkedFo.id, name: foName, uid: linkedFo.uid, listStatus: linkedFo.listStatus, relationship: "konateľ" });
        }
      }
    }

    if (subject.type === "person" || subject.type === "szco") {
      const linkedPos = await db.select().from(subjects)
        .where(and(
          eq(subjects.linkedFoId, subjectId),
          isNull(subjects.deletedAt),
          sql`${subjects.listStatus} IS NOT NULL`
        ));
      for (const po of linkedPos) {
        const poName = po.companyName || po.uid;
        results.push({ subjectId: po.id, name: poName, uid: po.uid, listStatus: po.listStatus!, relationship: "firma" });
      }
    }

    if (subject.type === "company") {
      if (subject.linkedFoId) {
        const otherPos = await db.select().from(subjects)
          .where(and(
            eq(subjects.linkedFoId, subject.linkedFoId),
            sql`${subjects.id} != ${subjectId}`,
            isNull(subjects.deletedAt),
            sql`${subjects.listStatus} IS NOT NULL`
          ));
        for (const po of otherPos) {
          const poName = po.companyName || po.uid;
          results.push({ subjectId: po.id, name: poName, uid: po.uid, listStatus: po.listStatus!, relationship: "spoločná firma konateľa" });
        }
      }
    }

    return results;
  }

  async recalculateAllBonita(): Promise<{ processed: number; updated: number; errors: number }> {
    const allContracts = await db.select().from(contracts)
      .where(isNull(contracts.deletedAt));
    
    const stornoStatuses = await db.select().from(contractStatuses)
      .where(eq(contractStatuses.isStorno, true));
    const stornoStatusIds = new Set(stornoStatuses.map(s => s.id));

    let processed = 0;
    let updated = 0;
    let errors = 0;

    const stornoContracts = allContracts.filter(c => 
      c.statusId && stornoStatusIds.has(c.statusId)
    );

    const existingLogs = await db.select().from(subjectPointsLog);
    const loggedContractIds = new Set(existingLogs.map(l => l.contractId));

    for (const contract of stornoContracts) {
      if (loggedContractIds.has(contract.id)) continue;
      if (!contract.subjectId) continue;

      try {
        const subject = await this.getSubject(contract.subjectId);
        if (!subject) continue;

        const signedDate = contract.signedDate ? new Date(contract.signedDate) : contract.createdAt ? new Date(contract.createdAt) : null;
        const now = new Date();
        const yearsActive = signedDate ? (now.getTime() - signedDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000) : 0;

        let points = -1;
        let reason = "Spätný prepočet: Storno zmluvy do 1 roka";
        if (yearsActive >= 2) {
          points = 2;
          reason = "Spätný prepočet: Storno zmluvy po 2+ rokoch (+2)";
        } else if (yearsActive >= 1) {
          points = 1;
          reason = "Spätný prepočet: Storno zmluvy po 1+ roku (+1)";
        }

        const identifierType = subject.birthNumber ? "rc" : "ico";
        const identifierValue = subject.birthNumber || ((subject.details as any)?.ico || (subject.details as any)?.dynamicFields?.ico);

        await this.addSubjectPoints({
          subjectId: contract.subjectId,
          contractId: contract.id,
          points,
          reason,
          identifierType: identifierValue ? identifierType : null,
          identifierValue: identifierValue || null,
          companyId: contract.companyId,
        });

        processed++;
      } catch (err) {
        errors++;
        console.error(`[BONITA MIGRATION] Error processing contract ${contract.id}:`, err);
      }
    }

    const allSubjectsWithPoints = await db.select({ id: subjects.id }).from(subjects)
      .where(isNull(subjects.deletedAt));
    
    for (const s of allSubjectsWithPoints) {
      try {
        await this.recalculateBonitaPoints(s.id);
        updated++;
      } catch (err) {
        errors++;
      }
    }

    return { processed, updated, errors };
  }

  async getSubjectParamSections(clientTypeId?: number): Promise<SubjectParamSection[]> {
    if (clientTypeId) {
      return db.select().from(subjectParamSections).where(eq(subjectParamSections.clientTypeId, clientTypeId)).orderBy(asc(subjectParamSections.sortOrder));
    }
    return db.select().from(subjectParamSections).orderBy(asc(subjectParamSections.sortOrder));
  }

  async createSubjectParamSection(data: InsertSubjectParamSection): Promise<SubjectParamSection> {
    const [section] = await db.insert(subjectParamSections).values(data).returning();
    return section;
  }

  async updateSubjectParamSection(id: number, data: Partial<InsertSubjectParamSection>): Promise<SubjectParamSection> {
    const [section] = await db.update(subjectParamSections).set(data).where(eq(subjectParamSections.id, id)).returning();
    return section;
  }

  async deleteSubjectParamSection(id: number): Promise<void> {
    await db.delete(subjectParamSections).where(eq(subjectParamSections.id, id));
  }

  async getSubjectParameters(clientTypeId?: number): Promise<SubjectParameter[]> {
    if (clientTypeId) {
      return db.select().from(subjectParameters)
        .where(and(eq(subjectParameters.clientTypeId, clientTypeId), eq(subjectParameters.isActive, true)))
        .orderBy(asc(subjectParameters.sortOrder));
    }
    return db.select().from(subjectParameters).where(eq(subjectParameters.isActive, true)).orderBy(asc(subjectParameters.sortOrder));
  }

  async getSubjectParameter(id: number): Promise<SubjectParameter | undefined> {
    const [param] = await db.select().from(subjectParameters).where(eq(subjectParameters.id, id));
    return param;
  }

  async createSubjectParameter(data: InsertSubjectParameter): Promise<SubjectParameter> {
    const [param] = await db.insert(subjectParameters).values(data).returning();
    return param;
  }

  async updateSubjectParameter(id: number, data: Partial<InsertSubjectParameter>): Promise<SubjectParameter> {
    const [param] = await db.update(subjectParameters).set({ ...data, updatedAt: new Date() }).where(eq(subjectParameters.id, id)).returning();
    return param;
  }

  async deleteSubjectParameter(id: number): Promise<void> {
    await db.update(subjectParameters).set({ isActive: false, updatedAt: new Date() }).where(eq(subjectParameters.id, id));
  }

  async getSubjectTemplates(): Promise<SubjectTemplate[]> {
    return db.select().from(subjectTemplates).where(eq(subjectTemplates.isActive, true)).orderBy(asc(subjectTemplates.name));
  }

  async getSubjectTemplate(id: number): Promise<SubjectTemplate | undefined> {
    const [tmpl] = await db.select().from(subjectTemplates).where(eq(subjectTemplates.id, id));
    return tmpl;
  }

  async createSubjectTemplate(data: InsertSubjectTemplate): Promise<SubjectTemplate> {
    const [tmpl] = await db.insert(subjectTemplates).values(data).returning();
    return tmpl;
  }

  async updateSubjectTemplate(id: number, data: Partial<InsertSubjectTemplate>): Promise<SubjectTemplate> {
    const [tmpl] = await db.update(subjectTemplates).set({ ...data, updatedAt: new Date() }).where(eq(subjectTemplates.id, id)).returning();
    return tmpl;
  }

  async deleteSubjectTemplate(id: number): Promise<void> {
    await db.update(subjectTemplates).set({ isActive: false, updatedAt: new Date() }).where(eq(subjectTemplates.id, id));
  }

  async getSubjectTemplateParams(templateId: number): Promise<SubjectTemplateParam[]> {
    return db.select().from(subjectTemplateParams).where(eq(subjectTemplateParams.templateId, templateId)).orderBy(asc(subjectTemplateParams.sortOrder));
  }

  async createSubjectTemplateParam(data: InsertSubjectTemplateParam): Promise<SubjectTemplateParam> {
    const [tp] = await db.insert(subjectTemplateParams).values(data).returning();
    return tp;
  }

  async updateSubjectTemplateParam(id: number, data: Partial<InsertSubjectTemplateParam>): Promise<SubjectTemplateParam> {
    const [tp] = await db.update(subjectTemplateParams).set(data).where(eq(subjectTemplateParams.id, id)).returning();
    return tp;
  }

  async deleteSubjectTemplateParam(id: number): Promise<void> {
    await db.delete(subjectTemplateParams).where(eq(subjectTemplateParams.id, id));
  }

  async bulkSetTemplateParams(templateId: number, paramIds: number[]): Promise<void> {
    await db.delete(subjectTemplateParams).where(eq(subjectTemplateParams.templateId, templateId));
    if (paramIds.length > 0) {
      const values = paramIds.map((pid, idx) => ({
        templateId,
        parameterId: pid,
        sortOrder: idx * 10,
      }));
      await db.insert(subjectTemplateParams).values(values);
    }
  }

  async getResolvedParametersForTemplate(templateId: number, contractDate?: Date): Promise<SubjectParameter[]> {
    const tps = await db.select().from(subjectTemplateParams)
      .where(eq(subjectTemplateParams.templateId, templateId))
      .orderBy(asc(subjectTemplateParams.sortOrder));

    if (tps.length === 0) return [];

    const paramIds = tps.map(tp => tp.parameterId);
    const params = await db.select().from(subjectParameters)
      .where(and(
        inArray(subjectParameters.id, paramIds),
        eq(subjectParameters.isActive, true)
      ));

    const paramMap = new Map(params.map(p => [p.id, p]));
    const tpMap = new Map(tps.map(tp => [tp.parameterId, tp]));

    const result: SubjectParameter[] = [];
    for (const tp of tps) {
      const param = paramMap.get(tp.parameterId);
      if (!param) continue;

      if (contractDate) {
        const validFrom = tp.validFrom ? new Date(tp.validFrom) : null;
        const validTo = tp.validTo ? new Date(tp.validTo) : null;
        if (validFrom && contractDate < validFrom) continue;
        if (validTo && contractDate > validTo) continue;
      }

      if (tp.isRequired !== null && tp.isRequired !== undefined) {
        result.push({ ...param, isRequired: tp.isRequired });
      } else {
        result.push(param);
      }
    }

    return result;
  }

  async getParameterSynonyms(parameterId: number): Promise<ParameterSynonym[]> {
    return db.select().from(parameterSynonyms).where(eq(parameterSynonyms.parameterId, parameterId)).orderBy(asc(parameterSynonyms.synonym));
  }

  async getAllParameterSynonyms(): Promise<ParameterSynonym[]> {
    return db.select().from(parameterSynonyms).orderBy(asc(parameterSynonyms.synonym));
  }

  async createParameterSynonym(data: InsertParameterSynonym): Promise<ParameterSynonym> {
    const [syn] = await db.insert(parameterSynonyms).values(data).returning();
    return syn;
  }

  async deleteParameterSynonym(id: number): Promise<void> {
    await db.delete(parameterSynonyms).where(eq(parameterSynonyms.id, id));
  }

  async matchParameterBySynonym(text: string): Promise<{ parameterId: number; synonym: string; confidence: number }[]> {
    const normalizedText = text.toLowerCase().trim();
    const allSynonyms = await this.getAllParameterSynonyms();
    const matches: { parameterId: number; synonym: string; confidence: number }[] = [];
    for (const syn of allSynonyms) {
      const normalizedSyn = syn.synonym.toLowerCase().trim();
      if (normalizedText.includes(normalizedSyn) || normalizedSyn.includes(normalizedText)) {
        matches.push({
          parameterId: syn.parameterId,
          synonym: syn.synonym,
          confidence: syn.confidence ?? 100,
        });
      }
    }
    matches.sort((a, b) => b.confidence - a.confidence);
    return matches;
  }

  async getParameterUsageCount(parameterId: number): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(subjectFieldHistory)
      .where(eq(subjectFieldHistory.fieldKey, sql`(SELECT field_key FROM subject_parameters WHERE id = ${parameterId})`));
    return Number(result[0]?.count ?? 0);
  }

  async getUnknownExtractedFields(status?: string): Promise<UnknownExtractedField[]> {
    if (status) {
      return db.select().from(unknownExtractedFields).where(eq(unknownExtractedFields.status, status)).orderBy(desc(unknownExtractedFields.createdAt));
    }
    return db.select().from(unknownExtractedFields).orderBy(desc(unknownExtractedFields.createdAt));
  }

  async createUnknownExtractedField(data: InsertUnknownExtractedField): Promise<UnknownExtractedField> {
    const [field] = await db.insert(unknownExtractedFields).values(data).returning();
    return field;
  }

  async updateUnknownExtractedField(id: number, data: Partial<InsertUnknownExtractedField>): Promise<UnknownExtractedField> {
    const [field] = await db.update(unknownExtractedFields).set(data).where(eq(unknownExtractedFields.id, id)).returning();
    return field;
  }

  async deleteUnknownExtractedField(id: number): Promise<void> {
    await db.delete(unknownExtractedFields).where(eq(unknownExtractedFields.id, id));
  }
}

export const storage = new DatabaseStorage();
