import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, User, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

type ContextEntry = {
  contextType: string;
  userId: number;
  linkId?: number;
  label: string;
  subLabel: string;
  type: string;
  uid: string | null;
  ico: string | null;
  isCurrent: boolean;
};

export default function IdentityPicker() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: contexts, isLoading } = useQuery<ContextEntry[]>({
    queryKey: ["/api/user/contexts"],
    staleTime: 0,
  });

  const linkedContexts = (contexts || []).filter(
    (c) => c.contextType === "linked_account" || c.contextType === "guardian"
  );

  useEffect(() => {
    if (!isLoading && contexts !== undefined && linkedContexts.length === 0) {
      navigate("/", { replace: true });
    }
  }, [isLoading, contexts, linkedContexts.length, navigate]);

  async function handleSelect(ctx: ContextEntry) {
    if (ctx.contextType === "linked_account" || ctx.contextType === "guardian") {
      try {
        await apiRequest("POST", "/api/account-link/switch", { targetUserId: ctx.userId });
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/app-user/me"] });
        localStorage.setItem("atk_pending_identity_setup", "1");
        window.location.href = "/";
      } catch {
        toast({ title: "Chyba pri prepnutí účtu", variant: "destructive" });
      }
      return;
    }
    navigate("/", { replace: true });
  }

  if (isLoading || contexts === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (linkedContexts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Výber účtu</h1>
        <p className="text-muted-foreground mt-2">Vyberte účet, pod ktorým chcete pokračovať</p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-md">
        {linkedContexts.map((ctx, idx) => (
          <button
            key={idx}
            type="button"
            data-testid={`button-identity-${idx}`}
            onClick={() => handleSelect(ctx)}
            className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-accent transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {ctx.contextType === "guardian" ? (
                <Shield className="w-5 h-5 text-primary" />
              ) : (
                <User className="w-5 h-5 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{ctx.label}</div>
              <div className="text-sm text-muted-foreground truncate">{ctx.subLabel}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
