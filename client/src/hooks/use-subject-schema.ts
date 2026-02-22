import { useQuery } from "@tanstack/react-query";
import type { StaticField, StaticSection, StaticPanel } from "@/lib/staticFieldDefs";

export interface DynamicField extends StaticField {
  extractionHints?: {
    synonyms?: string[];
    priority_document?: string;
    cross_reference?: { field: string; section: string; description: string };
    semaphore?: { type: string; days?: number; years?: number };
    business_rule?: string;
    regex?: string;
    format?: string;
    examples?: string[];
  } | null;
  code?: string;
}

export interface DynamicPanel {
  id: number;
  clientTypeId: number;
  sectionId: number;
  name: string;
  code: string;
  gridColumns: number;
  sortOrder: number;
  isCollection: boolean;
  fields: DynamicField[];
}

export interface DynamicSection {
  id: number;
  clientTypeId: number;
  name: string;
  code: string;
  folderCategory: string;
  sortOrder: number;
  isCollection: boolean;
  gridColumns: number;
  panels: DynamicPanel[];
}

export interface SubjectSchema {
  clientTypeId: number;
  sections: DynamicSection[];
}

export function useSubjectSchema(clientTypeId: number | undefined) {
  const query = useQuery<SubjectSchema>({
    queryKey: ["/api/subject-schema", clientTypeId],
    queryFn: async () => {
      if (!clientTypeId) throw new Error("No clientTypeId");
      const res = await fetch(`/api/subject-schema/${clientTypeId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch schema");
      return res.json();
    },
    enabled: !!clientTypeId,
    staleTime: 5 * 60 * 1000,
  });

  const allFields: DynamicField[] = [];
  const allSections: StaticSection[] = [];
  const allPanels: StaticPanel[] = [];

  if (query.data?.sections) {
    for (const section of query.data.sections) {
      allSections.push({
        id: section.id,
        clientTypeId: section.clientTypeId,
        name: section.name,
        folderCategory: section.folderCategory,
        sortOrder: section.sortOrder,
      });

      for (const panel of section.panels) {
        allPanels.push({
          id: panel.id,
          clientTypeId: panel.clientTypeId,
          sectionId: section.id,
          name: panel.name,
          gridColumns: panel.gridColumns,
          sortOrder: panel.sortOrder,
        });

        for (const field of panel.fields) {
          allFields.push(field);
        }
      }
    }
  }

  const fieldHints: Record<string, string> = {};
  const fieldToCategory: Record<string, string> = {};
  const collectionCategories: Record<string, { sectionCode: string; sectionName: string; fields: DynamicField[] }> = {};

  if (query.data?.sections) {
    for (const section of query.data.sections) {
      if (section.isCollection) {
        for (const panel of section.panels) {
          const catCode = panel.fields[0]?.categoryCode || section.folderCategory;
          if (catCode) {
            if (!collectionCategories[catCode]) {
              collectionCategories[catCode] = {
                sectionCode: section.code,
                sectionName: section.name,
                fields: [],
              };
            }
            collectionCategories[catCode].fields.push(...panel.fields);
          }
        }
      }
    }
  }

  for (const field of allFields) {
    if (field.categoryCode) {
      fieldToCategory[field.fieldKey] = field.categoryCode;
    } else {
      fieldToCategory[field.fieldKey] = field.fieldCategory;
    }
    if (field.extractionHints && typeof field.extractionHints === 'object') {
      const hints = field.extractionHints as any;
      if (hints.synonyms && Array.isArray(hints.synonyms) && hints.synonyms.length > 0) {
        fieldHints[field.fieldKey] = hints.synonyms.join(", ");
      }
      if (hints.business_rule) {
        fieldHints[field.fieldKey] = hints.business_rule;
      }
    }
  }

  return {
    schema: query.data || null,
    sections: allSections,
    panels: allPanels,
    fields: allFields,
    fieldHints,
    fieldToCategory,
    collectionCategories,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
