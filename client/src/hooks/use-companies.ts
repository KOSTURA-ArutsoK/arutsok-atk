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

async function fetchWithMessage(method: string, url: string, data?: unknown) {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });
  if (!res.ok) {
    let message = "Neznáma chyba";
    try { message = (await res.json()).message ?? message; } catch {}
    throw new Error(message);
  }
  return res.json();
}

export function useCreateMyCompany() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertMyCompany) => fetchWithMessage("POST", "/api/my-companies", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-companies"] });
      toast({ title: "Firma vytvorená", description: "Spoločnosť bola úspešne pridaná." });
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa vytvoriť firmu.", variant: "destructive" });
    },
  });
}

export function useUpdateMyCompany() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdateMyCompanyRequest }) =>
      fetchWithMessage("PUT", buildUrl("/api/my-companies/:id", { id }), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-companies"] });
      toast({ title: "Firma aktualizovaná", description: "Zmeny boli uložené a pôvodný záznam archivovaný." });
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa aktualizovať firmu.", variant: "destructive" });
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
      toast({ title: "Firma vymazaná", description: "Záznam bol presunutý do archívu." });
    },
  });
}
