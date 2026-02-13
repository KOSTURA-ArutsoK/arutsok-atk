import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { AppUser } from "@shared/schema";

export function useAppUser() {
  return useQuery<AppUser | null>({
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
    mutationFn: async (data: { activeCompanyId?: number | null; activeStateId?: number }) => {
      const res = await apiRequest("PUT", "/api/app-user/active", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/app-user/me"] });
    },
  });
}
