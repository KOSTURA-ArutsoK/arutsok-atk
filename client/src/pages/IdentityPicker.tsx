import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Shield, User, Building2, Landmark, Heart, Globe, Loader2, ChevronRight, LogOut } from "lucide-react";
import { useSetActiveContext } from "@/hooks/use-app-user";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

type ContextEntry = {
  contextType: string;
  userId: number;
  companyId?: number | null;
  subjectId?: number | null;
  linkId?: number;
  label: string;
  subLabel: string;
  type: string;
  uid: string | null;
  ico: string | null;
  isCurrent: boolean;
  isSubjectLink?: boolean;
};

function subjectTypeColor(type: string): { bg: string; border: string; icon: string; text: string } {
  switch (type) {
    case "person":
    case "szco":
      return { bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: "text-emerald-500", text: "text-emerald-600 dark:text-emerald-400" };
    case "company":
      return { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: "text-blue-500", text: "text-blue-600 dark:text-blue-400" };
    case "state":
      return { bg: "bg-indigo-500/10", border: "border-indigo-500/30", icon: "text-indigo-500", text: "text-indigo-600 dark:text-indigo-400" };
    case "organization":
    case "os":
      return { bg: "bg-orange-500/10", border: "border-orange-500/30", icon: "text-orange-500", text: "text-orange-600 dark:text-orange-400" };
    case "mycompany":
      return { bg: "bg-violet-500/10", border: "border-violet-500/30", icon: "text-violet-500", text: "text-violet-600 dark:text-violet-400" };
    default:
      return { bg: "bg-primary/10", border: "border-primary/30", icon: "text-primary", text: "text-primary" };
  }
}

function ContextIcon({ type, className }: { type: string; className?: string }) {
  switch (type) {
    case "person":
    case "szco":
      return <User className={className} />;
    case "company":
    case "mycompany":
      return <Building2 className={className} />;
    case "state":
      return <Landmark className={className} />;
    case "organization":
    case "os":
      return <Heart className={className} />;
    default:
      return <Globe className={className} />;
  }
}

function contextTypeLabel(contextType: string): string {
  switch (contextType) {
    case "fo": return "Fyzická osoba";
    case "po": return "Právnická osoba";
    case "szco": return "SZČO";
    case "vs": return "Verejný sektor";
    case "os": return "Obč. združenie";
    case "ts": return "Tretí sektor";
    case "linked_account": return "Prepojený účet";
    case "guardian": return "Spravovaný účet";
    case "officer_company": return "Vlastná firma";
    default: return "";
  }
}

export default function IdentityPickerPage() {
  const [, navigate] = useLocation();
  const { logout } = useAuth();
  const setActive = useSetActiveContext();
  const { toast } = useToast();

  const { data: contexts, isLoading } = useQuery<ContextEntry[]>({
    queryKey: ["/api/user/contexts"],
    staleTime: 0,
  });

  async function handleSelect(ctx: ContextEntry) {
    if (ctx.contextType === "fo" && !ctx.subjectId) {
      setActive.mutate({ activeSubjectId: null, activeCompanyId: null }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/user/contexts"] });
          navigate("/");
        },
        onError: () => toast({ title: "Chyba pri prepnutí identity", variant: "destructive" }),
      });
      return;
    }

    if (ctx.contextType === "linked_account" || ctx.contextType === "guardian") {
      try {
        await apiRequest("POST", "/api/account-link/switch", { targetUserId: ctx.userId });
        queryClient.invalidateQueries({ queryKey: ["/api/user/contexts"] });
        queryClient.invalidateQueries({ queryKey: ["/api/app-user/me"] });
        navigate("/");
      } catch {
        toast({ title: "Chyba pri prepnutí identity", variant: "destructive" });
      }
      return;
    }

    if (ctx.contextType === "officer_company" && ctx.companyId) {
      setActive.mutate({ activeSubjectId: null, activeCompanyId: ctx.companyId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["/api/user/contexts"] });
          navigate("/");
        },
        onError: () => toast({ title: "Chyba pri prepnutí kontextu", variant: "destructive" }),
      });
      return;
    }

    if (ctx.subjectId) {
      if (ctx.isSubjectLink && ctx.linkId) {
        try {
          await apiRequest("POST", "/api/account-link/switch", { subjectLinkId: ctx.linkId });
          queryClient.invalidateQueries({ queryKey: ["/api/user/contexts"] });
          queryClient.invalidateQueries({ queryKey: ["/api/app-user/me"] });
          navigate("/");
        } catch {
          toast({ title: "Chyba pri prepnutí identity", variant: "destructive" });
        }
      } else {
        setActive.mutate({ activeSubjectId: ctx.subjectId }, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/user/contexts"] });
            navigate("/");
          },
          onError: () => toast({ title: "Chyba pri prepnutí identity", variant: "destructive" }),
        });
      }
      return;
    }

    navigate("/");
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const allContexts = contexts ?? [];

  const hasFo = allContexts.some(c => c.contextType === "fo");
  const nonFoContexts = allContexts.filter(c => c.contextType !== "fo");

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm">ArutsoK</span>
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest">ATK</span>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="text-muted-foreground" data-testid="button-identity-picker-logout">
          <LogOut className="w-4 h-4 mr-1.5" />
          Odhlásiť
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold mb-2" data-testid="heading-identity-picker">Výber identity</h1>
            <p className="text-sm text-muted-foreground">
              Zvoľte, v akej úlohe chcete vstúpiť do systému
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="identity-picker-grid">
            {allContexts.map((ctx, idx) => {
              const colors = subjectTypeColor(ctx.type);
              const ctxLabel = contextTypeLabel(ctx.contextType);
              return (
                <button
                  key={`${ctx.contextType}-${ctx.userId}-${ctx.companyId ?? ctx.subjectId ?? idx}`}
                  onClick={() => handleSelect(ctx)}
                  disabled={setActive.isPending}
                  data-testid={`card-identity-${idx}`}
                  className={`group relative flex items-center gap-4 p-4 rounded-lg border ${colors.border} ${colors.bg} text-left transition-all hover:scale-[1.02] hover:shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${colors.bg} border ${colors.border}`}>
                    <ContextIcon type={ctx.type} className={`w-5 h-5 ${colors.icon}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate" data-testid={`text-identity-label-${idx}`}>{ctx.label}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5" data-testid={`text-identity-sublabel-${idx}`}>{ctx.subLabel}</p>
                    {ctxLabel && (
                      <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-1 ${colors.bg} ${colors.text} border ${colors.border}`}>
                        {ctxLabel}
                      </span>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  {ctx.isCurrent && (
                    <span className="absolute top-2 right-2 text-[9px] font-semibold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                      Aktívna
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {allContexts.length <= 1 && (
            <div className="text-center mt-6">
              <Button onClick={() => navigate("/")} data-testid="button-enter-directly">
                Vstúpiť do systému
              </Button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-8">
            Kontext môžete kedykoľvek zmeniť v hornej lište po prihlásení
          </p>
        </div>
      </main>
    </div>
  );
}
