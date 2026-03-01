import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { AppUserWithCareerLevel } from "@shared/schema";

export function useAppUser() {
  return useQuery<AppUserWithCareerLevel | null>({
    queryKey: ["/api/app-user/me"],
    queryFn: async () => {
      const res = await fetch("/api/app-user/me", { credentials: "include" });
      if (res.status === 401 || res.status === 404) return null;
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSetActiveContext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { activeCompanyId?: number | null; activeStateId?: number; activeDivisionId?: number | null }) => {
      const res = await apiRequest("PUT", "/api/app-user/active", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-user/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/rejected"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/dispatched"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/accepted"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/archived"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky"] });
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sectors"] });
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === "string" && key.includes("/api/companies/") && key.includes("/divisions");
        },
      });
    },
  });
}
