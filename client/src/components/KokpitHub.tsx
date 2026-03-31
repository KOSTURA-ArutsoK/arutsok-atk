import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAppUser } from "@/hooks/use-app-user";
import { formatUid } from "@/lib/utils";
import { Target, Layers, X, Shield, User } from "lucide-react";

interface KokpitHubProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectFunction: (fn: "roztriedenie-stavov") => void;
}

type KokpitAccessData = {
  hasAccess: boolean;
  permissions: Array<{
    stateId: number | null;
    companyId: number | null;
    companyName: string | null;
    companyCode: string | null;
    divisionIds: number[];
  }>;
};

function computeKokpitLabel(permissions: KokpitAccessData["permissions"]): string {
  if (permissions.length === 0) return "Global";
  const hasCompany = permissions.some(p => p.companyId !== null);
  if (!hasCompany) return "Holding";
  const names = [
    ...new Set(
      permissions
        .filter(p => p.companyCode || p.companyName)
        .map(p => p.companyCode ?? p.companyName!)
    ),
  ];
  return names.length > 0 ? names.join(" | ") : "Holding";
}

const HUB_FUNCTIONS = [
  {
    id: "roztriedenie-stavov" as const,
    Icon: Layers,
    title: "Roztriedenie stavov",
    description: "Správa a roztriedenie zmlúv podľa fázy spracovania. Príchod, kontrola, skeny.",
    gradientFrom: "from-blue-800/50",
    gradientTo: "to-blue-900/70",
    borderColor: "border-blue-500/30",
    hoverBorderColor: "hover:border-blue-400/60",
    iconColor: "text-blue-400",
  },
] as const;

export function KokpitHub({ open, onOpenChange, onSelectFunction }: KokpitHubProps) {
  const { data: appUser } = useAppUser();

  const { data: kokpitAccess } = useQuery<KokpitAccessData>({
    queryKey: ["/api/kokpit/access"],
  });

  const perms = kokpitAccess?.permissions ?? [];
  const kokpitLabel = computeKokpitLabel(perms);

  const userName =
    [appUser?.firstName, appUser?.lastName].filter(Boolean).join(" ") ||
    appUser?.username ||
    "—";
  const userUid = appUser?.uid ? formatUid(appUser.uid) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        noInnerScroll
        className="flex items-center justify-center p-0 bg-slate-900/75 shadow-none border-0 rounded-2xl"
        style={{ maxWidth: "95vw", width: "95vw", height: "92vh", maxHeight: "92vh" }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          onOpenChange(false);
        }}
      >
        <DialogTitle className="sr-only">Kokpit Hub</DialogTitle>
        <DialogDescription className="sr-only">Rozcestník pre funkcie Kokpitu</DialogDescription>

        <div
          className="flex flex-col overflow-hidden rounded-xl shadow-2xl border border-amber-500/20"
          style={{
            width: "90vw",
            height: "86vh",
            background: "linear-gradient(160deg, #0c1e3a 0%, #07111f 100%)",
          }}
        >
          {/* ── Header ──────────────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-amber-500/20 bg-[#0c1e3a]/60 shrink-0">
            {/* Title */}
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400 shrink-0" />
              <span
                className="text-base font-extrabold tracking-[0.25em] text-amber-300"
                style={{ textShadow: "0 0 12px rgba(251,191,36,0.45)" }}
              >
                KOKPIT
              </span>
            </div>

            <div className="h-4 w-px bg-amber-500/25 shrink-0" />

            {/* User info */}
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-3.5 h-3.5 text-blue-400/70 shrink-0" />
              <span className="text-sm font-semibold text-blue-100 truncate" data-testid="hub-user-name">
                {userName}
              </span>
              {userUid && (
                <span
                  className="text-[11px] font-mono text-blue-300/50 whitespace-nowrap"
                  data-testid="hub-user-uid"
                >
                  {userUid}
                </span>
              )}
            </div>

            <div className="h-4 w-px bg-amber-500/25 shrink-0" />

            {/* Permissions label */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Shield className="w-3.5 h-3.5 text-amber-400/60" />
              <span
                className="text-xs font-semibold text-amber-400/80 tracking-wide"
                data-testid="hub-permission-label"
              >
                {kokpitLabel}
              </span>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Close button */}
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg text-blue-300/50 hover:text-blue-100 hover:bg-white/10 transition-colors shrink-0"
              data-testid="button-hub-close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Body ────────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-8">
            <p className="text-[11px] font-semibold text-blue-300/40 uppercase tracking-widest mb-6">
              Vyberte funkciu
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {HUB_FUNCTIONS.map(({ id, Icon, title, description, gradientFrom, gradientTo, borderColor, hoverBorderColor, iconColor }) => (
                <button
                  key={id}
                  type="button"
                  data-testid={`button-hub-${id}`}
                  onClick={() => onSelectFunction(id)}
                  className={`
                    flex flex-col items-start gap-4 p-5 rounded-xl border
                    bg-gradient-to-br ${gradientFrom} ${gradientTo}
                    ${borderColor} ${hoverBorderColor}
                    hover:scale-[1.03] hover:shadow-lg hover:shadow-blue-900/40
                    active:scale-[0.98]
                    transition-all duration-200 text-left cursor-pointer group
                  `}
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-white/5 border border-white/10 group-hover:border-amber-500/30 transition-colors">
                    <Icon className={`w-6 h-6 ${iconColor} group-hover:text-amber-400 transition-colors`} />
                  </div>
                  <div>
                    <div className="font-bold text-blue-100 text-sm leading-snug group-hover:text-white transition-colors">
                      {title}
                    </div>
                    <div className="text-xs text-blue-300/50 mt-1.5 leading-relaxed">
                      {description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
