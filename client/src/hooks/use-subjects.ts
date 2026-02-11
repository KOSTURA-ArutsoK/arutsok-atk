import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type SubjectInput } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useSubjects(filters?: { search?: string; type?: 'person' | 'company' }) {
  // Construct URL with query params
  const url = new URL(api.subjects.list.path, window.location.origin);
  if (filters?.search) url.searchParams.append("search", filters.search);
  if (filters?.type) url.searchParams.append("type", filters.type);

  return useQuery({
    queryKey: [api.subjects.list.path, filters],
    queryFn: async () => {
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return api.subjects.list.responses[200].parse(await res.json());
    },
  });
}

export function useSubject(id: number) {
  return useQuery({
    queryKey: [api.subjects.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.subjects.get.path, { id });
      const res = await fetch(url, { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch subject");
      return api.subjects.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

export function useCreateSubject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: SubjectInput) => {
      const res = await fetch(api.subjects.create.path, {
        method: api.subjects.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create subject");
      }
      return api.subjects.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] });
      toast({ title: "Success", description: "Subject created successfully" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
}

export function useUpdateSubject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<SubjectInput> & { changeReason?: string }) => {
      const url = buildUrl(api.subjects.update.path, { id });
      const res = await fetch(url, {
        method: api.subjects.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update subject");
      return api.subjects.update.responses[200].parse(await res.json());
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [api.subjects.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.subjects.get.path, id] });
      toast({ 
        title: "Subject Updated", 
        description: "Original record has been archived for integrity." 
      });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });
}
