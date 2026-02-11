import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type MyCompanyInput } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useMyCompanies() {
  return useQuery({
    queryKey: [api.myCompanies.list.path],
    queryFn: async () => {
      const res = await fetch(api.myCompanies.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch companies");
      return api.myCompanies.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateMyCompany() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: MyCompanyInput) => {
      const res = await fetch(api.myCompanies.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create company");
      return api.myCompanies.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.myCompanies.list.path] });
      toast({ title: "Success", description: "Company registered successfully" });
    },
  });
}
