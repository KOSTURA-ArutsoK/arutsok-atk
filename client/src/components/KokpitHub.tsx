import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAppUser } from "@/hooks/use-app-user";
import { formatUid } from "@/lib/utils";
import { Target, Layers, FileInput, Calculator, Shield, User } from "lucide-react";

export type KokpitFunctionId = "roztriedenie-stavov" | "zadavanie-provizii" | "vypocet-odmien";

interface KokpitHubProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectFunction: (fn: KokpitFunctionId) => void;
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

const HUB_FUNCTIONS: Array<{
  id: KokpitFunctionId;
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  borderColor: string;
  hoverBorderColor: string;
  iconColor: string;
}> = [
  {
    id: "roztriedenie-stavov",
    Icon: Layers,
    title: "Roztriedenie stavov",
    description: "Správa a roztriedenie zmlúv podľa fázy spracovania. Príchod, kontrola, skeny.",
    gradientFrom: "from-blue-800/50",
    gradientTo: "to-blue-900/70",
    borderColor: "border-blue-500/30",
    hoverBorderColor: "hover:border-blue-400/60",
    iconColor: "text-blue-400",
  },
  {
    id: "zadavanie-provizii",
    Icon: FileInput,
    title: "Zadávanie provízií",
    subtitle: "Ručný vstup · Import",
    description: "Evidencia provízií prijatých od poisťovní. Ručný zápis alebo hromadný import.",
    gradientFrom: "from-emerald-800/50",
    gradientTo: "to-emerald-900/70",
    borderColor: "border-emerald-500/30",
    hoverBorderColor: "hover:border-emerald-400/60",
    iconColor: "text-emerald-400",
  },
  {
    id: "vypocet-odmien",
    Icon: Calculator,
    title: "Výpočet odmien",
    description: "Výpočet odmien v rámci spoločnosti alebo divízie. Spoločnosti sa nemiešajú.",
    gradientFrom: "from-violet-800/50",
    gradientTo: "to-violet-900/70",
    borderColor: "border-violet-500/30",
    hoverBorderColor: "hover:border-violet-400/60",
    iconColor: "text-violet-400",
  },
];

export function KokpitHub({ open, onOpenChange, onSelectFunction }: KokpitHubProps) {
  const { data: appUser } = useAppUser();
  const [isLeaving, setIsLeaving] = useState(false);

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

  function handleSelectFunction(id: KokpitFunctionId) {
    setIsLeaving(true);
    setTimeout(() => {
      setIsLeaving(false);
      onSelectFunction(id);
    }, 280);
  }

  function handleClose() {
    setIsLeaving(true);
    setTimeout(() => {
      setIsLeaving(false);
      onOpenChange(false);
    }, 280);
  }

  const CARD_W = "91vw";
  const CARD_H = "87vh";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        noInnerScroll
        className="p-0 bg-transparent shadow-none border-0 overflow-visible"
        style={{ maxWidth: "97vw", width: "97vw", height: "94vh", maxHeight: "94vh" }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleClose();
        }}
      >
        <DialogTitle className="sr-only">Kokpit Hub</DialogTitle>
        <DialogDescription className="sr-only">Rozcestník pre funkcie Kokpitu</DialogDescription>

        {/* ── Stack container ─────────────────────────────────────────────── */}
        <div className="relative w-full h-full">

          {/* Card 3 — backmost (smallest visible, bottom-right offset) */}
          <div
            className="absolute rounded-xl border border-amber-500/10"
            style={{
              width: CARD_W,
              height: CARD_H,
              top: "14px",
              left: "14px",
              background: "linear-gradient(160deg, #081527 0%, #040c17 100%)",
              opacity: 0.45,
            }}
          />

          {/* Card 2 — middle */}
          <div
            className="absolute rounded-xl border border-amber-500/15"
            style={{
              width: CARD_W,
              height: CARD_H,
              top: "7px",
              left: "7px",
              background: "linear-gradient(160deg, #0a1a2e 0%, #060f1c 100%)",
              opacity: 0.7,
            }}
          />

          {/* Card 1 — front (main content), animates out on select */}
          <div
            className="absolute flex flex-col overflow-hidden rounded-xl shadow-2xl border border-amber-500/20"
            style={{
              width: CARD_W,
              height: CARD_H,
              top: 0,
              left: 0,
              background: "linear-gradient(160deg, #0c1e3a 0%, #07111f 100%)",
              transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease",
              transform: isLeaving ? "translateX(-40px) translateY(-16px) scale(0.96)" : "translateX(0) translateY(0) scale(1)",
              opacity: isLeaving ? 0 : 1,
            }}
          >
            {/* ── Header ──────────────────────────────────────────────────── */}
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

              {/* Close button — text "Zavrieť" */}
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 rounded-lg text-blue-300/60 hover:text-blue-100 hover:bg-white/10 transition-colors text-xs font-semibold tracking-wide border border-blue-500/20 hover:border-blue-400/40 shrink-0"
                data-testid="button-hub-close"
              >
                Zavrieť
              </button>
            </div>

            {/* ── Body ──────────────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto p-8">
              <p className="text-[11px] font-semibold text-blue-300/40 uppercase tracking-widest mb-6">
                Vyberte funkciu
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                {HUB_FUNCTIONS.map(({ id, Icon, title, subtitle, description, gradientFrom, gradientTo, borderColor, hoverBorderColor, iconColor }) => (
                  <button
                    key={id}
                    type="button"
                    data-testid={`button-hub-${id}`}
                    onClick={() => handleSelectFunction(id)}
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
                      {subtitle && (
                        <div className="text-[10px] font-semibold text-amber-400/60 mt-0.5 tracking-wide uppercase">
                          {subtitle}
                        </div>
                      )}
                      <div className="text-xs text-blue-300/50 mt-1.5 leading-relaxed">
                        {description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
