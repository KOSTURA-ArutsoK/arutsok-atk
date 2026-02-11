import { useQuery } from "@tanstack/react-query";
import type { UserProfile } from "@shared/schema";

export function useUserProfile() {
  return useQuery<UserProfile | null>({
    queryKey: ["/api/user-profile/me"],
    queryFn: async () => {
      const res = await fetch("/api/user-profile/me", { credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch user profile");
      return res.json();
    },
  });
}
