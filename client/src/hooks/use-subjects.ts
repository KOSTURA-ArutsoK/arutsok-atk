import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Subject, InsertSubject } from "@shared/schema";

export function useSubjects(filters?: { search?: string; type?: 'person' | 'company' }) {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.type) params.append("type", filters.type);
  const qs = params.toString();

  return useQuery<Subject[]>({
    queryKey: ["/api/subjects", filters],
    queryFn: async () => {
      const res = await fetch(`/api/subjects${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
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
