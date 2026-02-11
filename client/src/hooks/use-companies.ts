import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { buildUrl } from "@shared/routes";
import type { MyCompany, InsertMyCompany, UpdateMyCompanyRequest } from "@shared/schema";

export function useMyCompanies() {
  return useQuery<MyCompany[]>({
    queryKey: ["/api/my-companies"],
    queryFn: async () => {
      const res = await fetch("/api/my-companies", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch companies");
      return res.json();
    },
  });
}

export function useMyCompany(id: number | null) {
  return useQuery<MyCompany>({
    queryKey: ["/api/my-companies", id],
    queryFn: async () => {
      const res = await fetch(buildUrl("/api/my-companies/:id", { id: id! }), { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreateMyCompany() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertMyCompany) => {
      const res = await apiRequest("POST", "/api/my-companies", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-companies"] });
      toast({ title: "Firma vytvoren\u00e1", description: "Spolo\u010dnos\u0165 bola \u00faspe\u0161ne pridan\u00e1." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvori\u0165 firmu.", variant: "destructive" });
    },
  });
}

export function useUpdateMyCompany() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateMyCompanyRequest }) => {
      const res = await apiRequest("PUT", buildUrl("/api/my-companies/:id", { id }), data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-companies"] });
      toast({ title: "Firma aktualizovan\u00e1", description: "Zmeny boli ulo\u017een\u00e9 a p\u00f4vodn\u00fd z\u00e1znam archivovan\u00fd." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa aktualizova\u0165 firmu.", variant: "destructive" });
    },
  });
}

export function useDeleteMyCompany() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", buildUrl("/api/my-companies/:id", { id }));
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-companies"] });
      toast({ title: "Firma vymazan\u00e1", description: "Z\u00e1znam bol presunut\u00fd do arch\u00edvu." });
    },
  });
}
