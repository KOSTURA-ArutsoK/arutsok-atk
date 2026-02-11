import { z } from 'zod';
import { 
  insertSubjectSchema, 
  insertMyCompanySchema, 
  insertPartnerSchema, 
  insertContactSchema, 
  insertProductSchema, 
  insertCommissionSchemeSchema,
  insertCompanyOfficerSchema,
  insertPartnerContactSchema,
  insertPartnerProductSchema,
  insertPartnerContractSchema,
  insertCommunicationMatrixSchema,
  insertContractAmendmentSchema,
  insertPermissionGroupSchema,
  insertPermissionSchema,
  insertAppUserSchema,
  subjects, myCompanies, partners, contacts, products, commissionSchemes, appUsers,
  partnerContacts, partnerProducts, partnerContracts, communicationMatrix, companyOfficers,
  contractAmendments, userProfiles, permissionGroups, permissions, auditLogs,
} from './schema';

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  subjects: {
    list: {
      method: 'GET' as const,
      path: '/api/subjects' as const,
      input: z.object({
        search: z.string().optional(),
        type: z.enum(['person', 'company']).optional(),
        isActive: z.boolean().optional(),
      }).optional(),
      responses: { 200: z.array(z.custom<typeof subjects.$inferSelect>()) },
    },
    get: {
      method: 'GET' as const,
      path: '/api/subjects/:id' as const,
      responses: { 200: z.custom<typeof subjects.$inferSelect>(), 404: errorSchemas.notFound },
    },
    create: {
      method: 'POST' as const,
      path: '/api/subjects' as const,
      input: insertSubjectSchema,
      responses: { 201: z.custom<typeof subjects.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/subjects/:id' as const,
      input: insertSubjectSchema.partial().extend({ changeReason: z.string().optional() }),
      responses: { 200: z.custom<typeof subjects.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    archive: {
      method: 'POST' as const,
      path: '/api/subjects/:id/archive' as const,
      input: z.object({ reason: z.string() }),
      responses: { 200: z.object({ success: z.boolean() }), 404: errorSchemas.notFound },
    },
  },
  
  myCompanies: {
    list: {
      method: 'GET' as const,
      path: '/api/my-companies' as const,
      responses: { 200: z.array(z.custom<typeof myCompanies.$inferSelect>()) },
    },
    get: {
      method: 'GET' as const,
      path: '/api/my-companies/:id' as const,
      responses: { 200: z.custom<typeof myCompanies.$inferSelect>(), 404: errorSchemas.notFound },
    },
    create: {
      method: 'POST' as const,
      path: '/api/my-companies' as const,
      input: insertMyCompanySchema,
      responses: { 201: z.custom<typeof myCompanies.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/my-companies/:id' as const,
      input: insertMyCompanySchema.partial().extend({ changeReason: z.string().optional() }),
      responses: { 200: z.custom<typeof myCompanies.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/my-companies/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }), 404: errorSchemas.notFound },
    },
  },

  companyOfficers: {
    list: {
      method: 'GET' as const,
      path: '/api/my-companies/:companyId/officers' as const,
      responses: { 200: z.array(z.custom<typeof companyOfficers.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/my-companies/:companyId/officers' as const,
      input: insertCompanyOfficerSchema,
      responses: { 201: z.custom<typeof companyOfficers.$inferSelect>(), 400: errorSchemas.validation },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/company-officers/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }) },
    },
  },

  partners: {
    list: {
      method: 'GET' as const,
      path: '/api/partners' as const,
      responses: { 200: z.array(z.custom<typeof partners.$inferSelect>()) },
    },
    get: {
      method: 'GET' as const,
      path: '/api/partners/:id' as const,
      responses: { 200: z.custom<typeof partners.$inferSelect>(), 404: errorSchemas.notFound },
    },
    create: {
      method: 'POST' as const,
      path: '/api/partners' as const,
      input: insertPartnerSchema,
      responses: { 201: z.custom<typeof partners.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/partners/:id' as const,
      input: insertPartnerSchema.partial().extend({ changeReason: z.string().optional() }),
      responses: { 200: z.custom<typeof partners.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/partners/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }), 404: errorSchemas.notFound },
    },
  },

  partnerContracts: {
    list: {
      method: 'GET' as const,
      path: '/api/partners/:partnerId/contracts' as const,
      responses: { 200: z.array(z.custom<typeof partnerContracts.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/partners/:partnerId/contracts' as const,
      input: insertPartnerContractSchema,
      responses: { 201: z.custom<typeof partnerContracts.$inferSelect>(), 400: errorSchemas.validation },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/partner-contracts/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }) },
    },
  },

  contractAmendments: {
    list: {
      method: 'GET' as const,
      path: '/api/partner-contracts/:contractId/amendments' as const,
      responses: { 200: z.array(z.custom<typeof contractAmendments.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/partner-contracts/:contractId/amendments' as const,
      input: insertContractAmendmentSchema,
      responses: { 201: z.custom<typeof contractAmendments.$inferSelect>(), 400: errorSchemas.validation },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/contract-amendments/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }) },
    },
  },

  userProfiles: {
    me: {
      method: 'GET' as const,
      path: '/api/user-profile/me' as const,
      responses: { 200: z.custom<typeof userProfiles.$inferSelect>(), 404: errorSchemas.notFound },
    },
    upload: {
      method: 'POST' as const,
      path: '/api/user-profile/photo' as const,
      responses: { 200: z.custom<typeof userProfiles.$inferSelect>() },
    },
  },

  partnerContacts: {
    list: {
      method: 'GET' as const,
      path: '/api/partners/:partnerId/contacts' as const,
      responses: { 200: z.array(z.custom<typeof partnerContacts.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/partners/:partnerId/contacts' as const,
      input: insertPartnerContactSchema,
      responses: { 201: z.custom<typeof partnerContacts.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/partner-contacts/:id' as const,
      input: insertPartnerContactSchema.partial(),
      responses: { 200: z.custom<typeof partnerContacts.$inferSelect>(), 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/partner-contacts/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }) },
    },
  },

  partnerProducts: {
    list: {
      method: 'GET' as const,
      path: '/api/partners/:partnerId/products' as const,
      responses: { 200: z.array(z.custom<typeof partnerProducts.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/partners/:partnerId/products' as const,
      input: insertPartnerProductSchema,
      responses: { 201: z.custom<typeof partnerProducts.$inferSelect>(), 400: errorSchemas.validation },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/partner-products/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }) },
    },
  },

  contactProductAssignments: {
    list: {
      method: 'GET' as const,
      path: '/api/partner-contacts/:contactId/products' as const,
      responses: { 200: z.array(z.object({ id: z.number(), contactId: z.number(), productId: z.number() })) },
    },
    set: {
      method: 'PUT' as const,
      path: '/api/partner-contacts/:contactId/products' as const,
      input: z.object({ productIds: z.array(z.number()) }),
      responses: { 200: z.object({ success: z.boolean() }) },
    },
  },

  communicationMatrix: {
    list: {
      method: 'GET' as const,
      path: '/api/partners/:partnerId/matrix' as const,
      responses: { 200: z.array(z.custom<typeof communicationMatrix.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/partners/:partnerId/matrix' as const,
      input: insertCommunicationMatrixSchema,
      responses: { 201: z.custom<typeof communicationMatrix.$inferSelect>(), 400: errorSchemas.validation },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/communication-matrix/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }) },
    },
  },

  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products' as const,
      responses: { 200: z.array(z.custom<typeof products.$inferSelect>()) },
    },
    get: {
      method: 'GET' as const,
      path: '/api/products/:id' as const,
      responses: { 200: z.custom<typeof products.$inferSelect>(), 404: errorSchemas.notFound },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products' as const,
      input: insertProductSchema,
      responses: { 201: z.custom<typeof products.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/products/:id' as const,
      input: insertProductSchema.partial(),
      responses: { 200: z.custom<typeof products.$inferSelect>(), 400: errorSchemas.validation, 404: errorSchemas.notFound },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/products/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }), 404: errorSchemas.notFound },
    },
    byPartner: {
      method: 'GET' as const,
      path: '/api/partners/:partnerId/catalog-products' as const,
      responses: { 200: z.array(z.custom<typeof products.$inferSelect>()) },
    },
  },

  commissions: {
    list: {
      method: 'GET' as const,
      path: '/api/commissions' as const,
      input: z.object({ productId: z.number().optional() }).optional(),
      responses: { 200: z.array(z.custom<typeof commissionSchemes.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/commissions' as const,
      input: insertCommissionSchemeSchema,
      responses: { 201: z.custom<typeof commissionSchemes.$inferSelect>(), 400: errorSchemas.validation },
    },
  },

  permissionGroups: {
    list: {
      method: 'GET' as const,
      path: '/api/permission-groups' as const,
      responses: { 200: z.array(z.custom<typeof permissionGroups.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/permission-groups' as const,
      input: insertPermissionGroupSchema,
      responses: { 201: z.custom<typeof permissionGroups.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/permission-groups/:id' as const,
      input: insertPermissionGroupSchema.partial(),
      responses: { 200: z.custom<typeof permissionGroups.$inferSelect>() },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/permission-groups/:id' as const,
      responses: { 200: z.object({ success: z.boolean() }) },
    },
  },

  permissionsMatrix: {
    list: {
      method: 'GET' as const,
      path: '/api/permissions' as const,
      responses: { 200: z.array(z.custom<typeof permissions.$inferSelect>()) },
    },
    byGroup: {
      method: 'GET' as const,
      path: '/api/permission-groups/:groupId/permissions' as const,
      responses: { 200: z.array(z.custom<typeof permissions.$inferSelect>()) },
    },
    set: {
      method: 'PUT' as const,
      path: '/api/permissions' as const,
      input: insertPermissionSchema,
      responses: { 200: z.custom<typeof permissions.$inferSelect>() },
    },
    sync: {
      method: 'POST' as const,
      path: '/api/permissions/sync' as const,
      responses: { 200: z.object({ success: z.boolean() }) },
    },
  },

  appUserAdmin: {
    list: {
      method: 'GET' as const,
      path: '/api/app-users' as const,
      responses: { 200: z.array(z.custom<typeof appUsers.$inferSelect>()) },
    },
    create: {
      method: 'POST' as const,
      path: '/api/app-users' as const,
      input: insertAppUserSchema,
      responses: { 201: z.custom<typeof appUsers.$inferSelect>(), 400: errorSchemas.validation },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/app-users/:id' as const,
      input: insertAppUserSchema.partial(),
      responses: { 200: z.custom<typeof appUsers.$inferSelect>() },
    },
  },
  
  hierarchy: {
    continents: {
      method: 'GET' as const,
      path: '/api/hierarchy/continents' as const,
      responses: { 200: z.array(z.object({ id: z.number(), name: z.string(), code: z.string() })) },
    },
    states: {
      method: 'GET' as const,
      path: '/api/hierarchy/states' as const,
      input: z.object({ continentId: z.string().optional() }).optional(),
      responses: { 200: z.array(z.object({ id: z.number(), name: z.string(), code: z.string(), flagUrl: z.string().nullable(), continentId: z.number() })) },
    },
    createState: {
      method: 'POST' as const,
      path: '/api/hierarchy/states' as const,
      input: z.object({ continentId: z.number(), name: z.string(), code: z.string(), flagUrl: z.string().optional() }),
      responses: { 201: z.object({ id: z.number(), name: z.string(), code: z.string(), flagUrl: z.string().nullable(), continentId: z.number() }) },
    },
  },

  auditLogs: {
    list: {
      method: 'GET' as const,
      path: '/api/audit-logs' as const,
      responses: { 200: z.object({ logs: z.array(z.custom<typeof auditLogs.$inferSelect>()), total: z.number() }) },
    },
  },

  appUser: {
    me: {
      method: 'GET' as const,
      path: '/api/app-user/me' as const,
      responses: { 200: z.custom<typeof appUsers.$inferSelect>(), 404: errorSchemas.notFound },
    },
    setActive: {
      method: 'PUT' as const,
      path: '/api/app-user/active' as const,
      input: z.object({ activeCompanyId: z.number().optional(), activeStateId: z.number().optional() }),
      responses: { 200: z.custom<typeof appUsers.$inferSelect>() },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

export type SubjectInput = z.infer<typeof api.subjects.create.input>;
export type SubjectResponse = z.infer<typeof api.subjects.create.responses[201]>;
export type MyCompanyInput = z.infer<typeof api.myCompanies.create.input>;
export type MyCompanyUpdateInput = z.infer<typeof api.myCompanies.update.input>;
