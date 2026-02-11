import { z } from 'zod';
import { 
  insertSubjectSchema, 
  insertMyCompanySchema, 
  insertPartnerSchema, 
  insertContactSchema, 
  insertProductSchema, 
  insertCommissionSchemeSchema,
  subjects, myCompanies, partners, contacts, products, commissionSchemes
} from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
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
      responses: {
        200: z.array(z.custom<typeof subjects.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/subjects/:id' as const,
      responses: {
        200: z.custom<typeof subjects.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/subjects' as const,
      input: insertSubjectSchema,
      responses: {
        201: z.custom<typeof subjects.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/subjects/:id' as const,
      input: insertSubjectSchema.partial().extend({ changeReason: z.string().optional() }),
      responses: {
        200: z.custom<typeof subjects.$inferSelect>(),
        400: errorSchemas.validation,
        404: errorSchemas.notFound,
      },
    },
    archive: { // Explicit archive action if needed, though update handles it
      method: 'POST' as const,
      path: '/api/subjects/:id/archive' as const,
      input: z.object({ reason: z.string() }),
      responses: {
        200: z.object({ success: z.boolean() }),
        404: errorSchemas.notFound,
      },
    },
  },
  
  myCompanies: {
    list: {
      method: 'GET' as const,
      path: '/api/my-companies' as const,
      responses: {
        200: z.array(z.custom<typeof myCompanies.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/my-companies' as const,
      input: insertMyCompanySchema,
      responses: {
        201: z.custom<typeof myCompanies.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  partners: {
    list: {
      method: 'GET' as const,
      path: '/api/partners' as const,
      responses: {
        200: z.array(z.custom<typeof partners.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/partners' as const,
      input: insertPartnerSchema,
      responses: {
        201: z.custom<typeof partners.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  products: {
    list: {
      method: 'GET' as const,
      path: '/api/products' as const,
      responses: {
        200: z.array(z.custom<typeof products.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/products' as const,
      input: insertProductSchema,
      responses: {
        201: z.custom<typeof products.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },

  commissions: {
    list: {
      method: 'GET' as const,
      path: '/api/commissions' as const,
      input: z.object({ productId: z.number().optional() }).optional(),
      responses: {
        200: z.array(z.custom<typeof commissionSchemes.$inferSelect>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/commissions' as const,
      input: insertCommissionSchemeSchema,
      responses: {
        201: z.custom<typeof commissionSchemes.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
  },
  
  hierarchy: {
    continents: {
      method: 'GET' as const,
      path: '/api/hierarchy/continents' as const,
      responses: {
        200: z.array(z.object({ id: z.number(), name: z.string(), code: z.string() })),
      },
    },
    states: {
      method: 'GET' as const,
      path: '/api/hierarchy/states' as const,
      input: z.object({ continentId: z.string().optional() }).optional(),
      responses: {
        200: z.array(z.object({ id: z.number(), name: z.string(), code: z.string(), flagUrl: z.string().nullable() })),
      },
    },
  }
};

// ============================================
// HELPER
// ============================================
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

// ============================================
// TYPES
// ============================================
export type SubjectInput = z.infer<typeof api.subjects.create.input>;
export type SubjectResponse = z.infer<typeof api.subjects.create.responses[201]>;
export type MyCompanyInput = z.infer<typeof api.myCompanies.create.input>;
