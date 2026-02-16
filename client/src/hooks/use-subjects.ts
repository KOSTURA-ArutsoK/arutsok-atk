import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Subject, InsertSubject } from "@shared/schema";

export type CareerHistoryEntry = {
  type: 'internal' | 'external';
  entityName: string;
  role: string;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
};

export function useSubjects(filters?: { search?: string; type?: 'person' | 'company'; statusFilters?: string[]; activeCompanyId?: number }) {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.type) params.append("type", filters.type);
  if (filters?.statusFilters && filters.statusFilters.length > 0) {
    params.append("statusFilters", filters.statusFilters.join(","));
  }
  if (filters?.activeCompanyId) params.append("activeCompanyId", String(filters.activeCompanyId));
  const qs = params.toString();

  return useQuery<(Subject & { contractCount: number })[]>({
    queryKey: ["/api/subjects", filters],
    queryFn: async () => {
      const res = await fetch(`/api/subjects${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
  });
}

export function useSubjectCareerHistory(subjectId: number | null) {
  return useQuery<CareerHistoryEntry[]>({
    queryKey: ["/api/subjects", subjectId, "career-history"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/career-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch career history");
      return res.json();
    },
    enabled: !!subjectId,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertSubject) => {
      const res = await apiRequest("POST", "/api/subjects", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      toast({ title: "Subjekt vytvoreny", description: "Novy subjekt bol zaregistrovany." });
    },
    onError: (error: Error) => {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    },
  });
}
