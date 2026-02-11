import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";

export function useContinents() {
  return useQuery({
    queryKey: [api.hierarchy.continents.path],
    queryFn: async () => {
      const res = await fetch(api.hierarchy.continents.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch continents");
      return api.hierarchy.continents.responses[200].parse(await res.json());
    },
  });
}

export function useStates(continentId?: number) {
  const url = new URL(api.hierarchy.states.path, window.location.origin);
  if (continentId) url.searchParams.append("continentId", continentId.toString());

  return useQuery({
    queryKey: [api.hierarchy.states.path, continentId],
    queryFn: async () => {
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch states");
      return api.hierarchy.states.responses[200].parse(await res.json());
    },
  });
}
