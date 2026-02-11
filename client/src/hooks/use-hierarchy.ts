import { useQuery } from "@tanstack/react-query";

export function useContinents() {
  return useQuery({
    queryKey: ["/api/hierarchy/continents"],
    queryFn: async () => {
      const res = await fetch("/api/hierarchy/continents", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ id: number; name: string; code: string }[]>;
    },
  });
}

export function useStates(continentId?: number) {
  return useQuery({
    queryKey: ["/api/hierarchy/states", continentId],
    queryFn: async () => {
      const url = continentId
        ? `/api/hierarchy/states?continentId=${continentId}`
        : "/api/hierarchy/states";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ id: number; name: string; code: string; flagUrl: string | null; continentId: number }[]>;
    },
  });
}
