import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Partner, InsertPartner, UpdatePartnerRequest, PartnerContact, PartnerProduct, CommunicationMatrixEntry } from "@shared/schema";
import { useAppUser } from "@/hooks/use-app-user";

export function usePartners() {
  const { data: appUser } = useAppUser();
  const companyId = appUser?.activeCompanyId ?? null;
  const stateId = appUser?.activeStateId ?? null;
  return useQuery<Partner[]>({
    queryKey: ["/api/partners", { companyId, stateId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", String(companyId));
      if (stateId) params.set("stateId", String(stateId));
      const url = `/api/partners${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch partners");
      return res.json();
    },
  });
}

export function usePartner(id: number | null) {
  return useQuery<Partner>({
    queryKey: ["/api/partners", id],
    queryFn: async () => {
      const res = await fetch(`/api/partners/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCreatePartner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertPartner): Promise<Partner & { matchedSubject: { id: number; uid: string; displayName: string } | null }> => {
      const res = await apiRequest("POST", "/api/partners", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      if (data.matchedSubject) {
        toast({ title: "Partner vytvorený – existujúci subjekt", description: `Tento subjekt už v systéme existuje (${data.matchedSubject.displayName}). UID bolo recyklované.`, duration: 7000 });
      } else {
        toast({ title: "Partner vytvoreny", description: "Partner bol uspesne pridany." });
      }
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvorit partnera.", variant: "destructive" });
    },
  });
}

export function useUpdatePartner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: UpdatePartnerRequest }) => {
      const res = await apiRequest("PUT", `/api/partners/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Partner aktualizovany", description: "Zmeny boli ulozene." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat partnera.", variant: "destructive" });
    },
  });
}

export function useDeletePartner() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/partners/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Partner vymazany", description: "Zaznam bol presunuty do archivu." });
    },
  });
}

export function usePartnerContacts(partnerId: number | null, includeInactive: boolean = true) {
  return useQuery<PartnerContact[]>({
    queryKey: ["/api/partners", partnerId, "contacts", includeInactive],
    queryFn: async () => {
      const url = includeInactive 
        ? `/api/partners/${partnerId}/contacts?includeInactive=true`
        : `/api/partners/${partnerId}/contacts`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!partnerId,
  });
}

export function useCreatePartnerContact() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ partnerId, data }: { partnerId: number; data: any }) => {
      const res = await apiRequest("POST", `/api/partners/${partnerId}/contacts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Kontakt pridany" });
    },
  });
}

export function usePartnerProducts(partnerId: number | null) {
  return useQuery<PartnerProduct[]>({
    queryKey: ["/api/partners", partnerId, "products"],
    queryFn: async () => {
      const res = await fetch(`/api/partners/${partnerId}/products`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!partnerId,
  });
}

export function useCreatePartnerProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ partnerId, data }: { partnerId: number; data: any }) => {
      const res = await apiRequest("POST", `/api/partners/${partnerId}/products`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      toast({ title: "Produkt pridany" });
    },
  });
}

export function useUpdatePartnerLifecycleStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { status: string; startDate?: string; endDate?: string } }) => {
      const res = await apiRequest("PATCH", `/api/partners/${id}/lifecycle-status`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products"] });
      toast({ title: "Status aktualizovany", description: "Lifecycle status partnera bol zmeneny." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa zmenit lifecycle status.", variant: "destructive" });
    },
  });
}

export function useCommunicationMatrix(partnerId: number | null) {
  return useQuery<CommunicationMatrixEntry[]>({
    queryKey: ["/api/partners", partnerId, "matrix"],
    queryFn: async () => {
      const res = await fetch(`/api/partners/${partnerId}/matrix`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!partnerId,
  });
}
