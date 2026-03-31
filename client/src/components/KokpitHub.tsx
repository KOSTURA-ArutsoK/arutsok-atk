import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAppUser } from "@/hooks/use-app-user";
import { formatUid } from "@/lib/utils";
import { KokpitDialogBody } from "@/components/KokpitDialog";
import type { ScanFile } from "@/pages/PridatStavZmluvy";
import {
  Target, Layers, FileInput, Calculator, Shield, User,
  Inbox, FileText, Clock, ChevronLeft, FileDown, Zap, Mail,
} from "lucide-react";

export type KokpitFunctionId = "roztriedenie-stavov" | "zadavanie-provizii" | "vypocet-odmien" | "roztriedenie-mailov" | "dokumenty-na-stiahnutie" | "hromadny-import-stavov";

interface KokpitHubProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectFunction: (fn: KokpitFunctionId) => void;
  scanFiles?: ScanFile[];
  onRemoveScanFile?: (id: string, reason?: string) => void;
  onAddFiles?: (files: File[]) => void;
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

const PIN_PROTECTED: KokpitFunctionId[] = ["zadavanie-provizii", "vypocet-odmien", "roztriedenie-mailov"];

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
  pinProtected?: boolean;
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
    pinProtected: true,
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
    pinProtected: true,
  },
  {
    id: "roztriedenie-mailov",
    Icon: Mail,
    title: "Roztriedenie mailov",
    description: "Triedenie a spracovanie prichádzajúcej elektronickej pošty podľa kategórie.",
    gradientFrom: "from-teal-800/50",
    gradientTo: "to-teal-900/70",
    borderColor: "border-teal-500/30",
    hoverBorderColor: "hover:border-teal-400/60",
    iconColor: "text-teal-400",
    pinProtected: true,
  },
  {
    id: "dokumenty-na-stiahnutie",
    Icon: FileDown,
    title: "Dokumenty na stiahnutie",
    subtitle: "Upload · Správa",
    description: "Nahrávanie a správa dokumentov dostupných na stiahnutie v sekcii Informácie.",
    gradientFrom: "from-teal-800/50",
    gradientTo: "to-teal-900/70",
    borderColor: "border-teal-500/30",
    hoverBorderColor: "hover:border-teal-400/60",
    iconColor: "text-teal-400",
  },
  {
    id: "hromadny-import-stavov",
    Icon: Zap,
    title: "Hromadný import stavov",
    subtitle: "CSV · Excel",
    description: "Hromadná aktualizácia stavov zmlúv z CSV alebo Excel súboru podľa identifikátora.",
    gradientFrom: "from-amber-800/50",
    gradientTo: "to-amber-900/70",
    borderColor: "border-amber-500/30",
    hoverBorderColor: "hover:border-amber-400/60",
    iconColor: "text-amber-400",
  },
];

function SkeletonRow({ w = "100%", h = 28, opacity = 1 }: { w?: string; h?: number; opacity?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 5,
        background: "rgba(255,255,255,0.07)",
        opacity,
        flexShrink: 0,
      }}
    />
  );
}

const DARK_BG = "linear-gradient(160deg, #0c1e3a 0%, #07111f 100%)";

function PinInput({
  onSuccess,
  onCancel,
  correctPin,
}: {
  onSuccess: () => void;
  onCancel: () => void;
  correctPin: string | null | undefined;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([null, null, null, null]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  function handleKey(e: React.KeyboardEvent, idx: number) {
    if (e.key === "Escape") { onCancel(); return; }
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[idx] !== "") {
        const next = [...digits];
        next[idx] = "";
        setDigits(next);
      } else if (idx > 0) {
        const next = [...digits];
        next[idx - 1] = "";
        setDigits(next);
        inputRefs.current[idx - 1]?.focus();
      }
      return;
    }
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      const next = [...digits];
      next[idx] = e.key;
      setDigits(next);
      if (idx < 3) {
        inputRefs.current[idx + 1]?.focus();
      } else {
        const pin = [...next].join("");
        if (!correctPin || pin === correctPin) {
          onSuccess();
        } else {
          setError(true);
          setTimeout(() => {
            setError(false);
            setDigits(["", "", "", ""]);
            inputRefs.current[0]?.focus();
          }, 900);
        }
      }
    }
  }

  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { inputRefs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={d}
          readOnly
          onKeyDown={(e) => handleKey(e, i)}
          onClick={(e) => { e.stopPropagation(); inputRefs.current[i]?.focus(); }}
          data-testid={`input-pin-digit-${i}`}
          className={`
            w-8 h-10 text-center text-sm font-bold rounded
            border-b-2 border outline-none bg-black/30 text-white caret-transparent
            transition-colors duration-150
            ${error
              ? "border-red-400 border-b-red-400 text-red-400 animate-[shake_0.3s_ease-in-out]"
              : "border-amber-400/60 border-b-amber-400 focus:border-amber-300 focus:border-b-amber-300"
            }
          `}
          style={{ WebkitTextSecurity: "disc" } as any}
        />
      ))}
    </div>
  );
}

export function KokpitHub({ open, onOpenChange, onSelectFunction, scanFiles = [], onRemoveScanFile, onAddFiles }: KokpitHubProps) {
  const { data: appUser } = useAppUser();
  const [activeLayer, setActiveLayer] = useState<"hub" | "second" | "third" | "mails">("hub");
  const [hubExiting, setHubExiting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [pinTargetId, setPinTargetId] = useState<KokpitFunctionId | null>(null);

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
  const userKokpitPin = (appUser as any)?.kokpitPin as string | null | undefined;

  function doSelectFunction(id: KokpitFunctionId) {
    onSelectFunction(id);
    setHubExiting(true);
    setTimeout(() => {
      setHubExiting(false);
      if (id === "roztriedenie-stavov") {
        setActiveLayer("third");
      } else if (id === "roztriedenie-mailov") {
        setActiveLayer("mails");
      } else {
        setActiveLayer("second");
      }
    }, 280);
  }

  function handleTileClick(id: KokpitFunctionId) {
    if (PIN_PROTECTED.includes(id)) {
      setPinTargetId(id);
    } else {
      doSelectFunction(id);
    }
  }

  function handlePinSuccess() {
    if (!pinTargetId) return;
    const id = pinTargetId;
    setPinTargetId(null);
    doSelectFunction(id);
  }

  function handlePinCancel() {
    setPinTargetId(null);
  }

  function handleBackToHub() {
    setActiveLayer("hub");
  }

  function handleClose() {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      setActiveLayer("hub");
      setPinTargetId(null);
      onOpenChange(false);
    }, 280);
  }

  const hubIsInactive = activeLayer !== "hub";

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        noInnerScroll
        className="p-0 bg-transparent shadow-none border-0 overflow-visible"
        style={{ maxWidth: "97vw", width: "97vw", height: "97vh", maxHeight: "97vh" }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
          handleClose();
        }}
      >
        <DialogTitle className="sr-only">Kokpit Hub</DialogTitle>
        <DialogDescription className="sr-only">Rozcestník pre funkcie Kokpitu</DialogDescription>

        <div className="relative w-full h-full overflow-hidden rounded-xl" style={{ background: "#040c17" }}>

          {/* Vrstva 1 — spodná/zadná (95vw × 95vh): skeletal alebo skutočný KokpitDialog obsah */}
          <div
            className="absolute overflow-hidden rounded-xl border border-amber-500/10"
            style={{
              width: "95vw",
              height: "95vh",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: activeLayer === "third" ? "transparent" : DARK_BG,
              opacity: activeLayer === "third" ? 1 : 0.55,
              zIndex: activeLayer === "third" ? 3 : 1,
              transition: "opacity 0.2s ease",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {activeLayer === "third" ? (
              /* Skutočný KokpitDialog obsah — hlavička je vnútri KokpitDialogBody (onBack prop) */
              <KokpitDialogBody
                scanFiles={scanFiles}
                onRemoveScanFile={onRemoveScanFile ?? (() => {})}
                onAddFiles={onAddFiles ?? (() => {})}
                onClose={handleBackToHub}
                onBack={handleBackToHub}
                enabled={activeLayer === "third"}
              />
            ) : (
              <>
                <div
                  className="flex items-center gap-3 px-5 py-3 shrink-0"
                  style={{ borderBottom: "1px solid rgba(245,158,11,0.15)", background: "rgba(12,30,58,0.7)" }}
                >
                  <Target className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-extrabold tracking-[0.25em] text-amber-300">KOKPIT</span>
                  <div className="h-3 w-px bg-amber-500/25 mx-1" />
                  <span className="text-[11px] text-blue-300/50 font-mono">{userUid ?? "—"}</span>
                </div>
                <div
                  className="flex items-center gap-1 px-4 py-2 shrink-0"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {["ROZDELENIE SKENOV", "RIEŠENIE", "VYHODNOTENIE"].map((tab, i) => (
                    <div
                      key={tab}
                      className="px-4 py-1.5 rounded-t text-[11px] font-semibold tracking-wide"
                      style={{
                        background: i === 0 ? "rgba(59,130,246,0.2)" : "transparent",
                        color: i === 0 ? "rgba(147,197,253,0.9)" : "rgba(147,197,253,0.35)",
                        border: i === 0 ? "1px solid rgba(59,130,246,0.25)" : "1px solid transparent",
                      }}
                    >
                      {tab}
                    </div>
                  ))}
                </div>
                <div className="flex-1 px-5 pt-3 pb-4 flex flex-col justify-between overflow-hidden">
                  <div className="flex gap-2 pb-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                    <SkeletonRow w="7%" h={18} opacity={0.7} />
                    <SkeletonRow w="16%" h={18} opacity={0.7} />
                    <SkeletonRow w="13%" h={18} opacity={0.7} />
                    <SkeletonRow w="20%" h={18} opacity={0.7} />
                    <SkeletonRow w="11%" h={18} opacity={0.7} />
                    <SkeletonRow w="15%" h={18} opacity={0.7} />
                  </div>
                  {[
                    [7,16,13,20,11,15],
                    [7,14,10,22,9,13],
                    [7,18,15,17,12,16],
                    [7,12,11,24,10,14],
                    [7,15,14,19,13,12],
                    [7,17,12,21,8,15],
                    [7,13,16,18,11,13],
                    [7,16,11,20,12,14],
                    [7,14,13,23,9,12],
                    [7,15,10,19,13,16],
                    [7,18,14,17,11,13],
                    [7,12,15,22,10,15],
                  ].map((cols, i) => (
                    <div key={i} className="flex gap-2">
                      {cols.map((w, j) => (
                        <SkeletonRow key={j} w={`${w}%`} h={24} opacity={0.38 + (i % 3) * 0.06} />
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Vrstva 2 — stredná (90vw × 90vh): PridatStavZmluvy skeletal */}
          <div
            className="absolute flex flex-col overflow-hidden rounded-xl border border-blue-500/15"
            style={{
              width: "90vw",
              height: "90vh",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "linear-gradient(180deg, #0f172a 0%, #0c1930 100%)",
              opacity: activeLayer === "second" ? 1 : 0.78,
              zIndex: activeLayer === "second" ? 3 : 2,
              padding: "2.5vh 2.5vw",
              transition: "opacity 0.2s ease",
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center gap-3">
                {activeLayer === "second" && (
                  <button
                    type="button"
                    onClick={handleBackToHub}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-blue-300/70 hover:text-blue-100 hover:bg-white/10 transition-colors text-xs font-semibold border border-blue-500/20 hover:border-blue-400/40"
                    data-testid="button-layer2-back"
                  >
                    ← Späť
                  </button>
                )}
                <span className="text-xs font-semibold text-blue-200/50">
                  {new Date().toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
                <div style={{ width: 56, height: 16, borderRadius: 4, background: "rgba(255,255,255,0.07)" }} />
              </div>
              <div
                className="flex items-center gap-1.5 px-3 py-1 rounded"
                style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)" }}
              >
                <Target className="w-3 h-3 text-amber-400" />
                <span className="text-[10px] font-bold tracking-widest text-amber-300">KOKPIT</span>
              </div>
            </div>

            <div className="flex flex-1 gap-4 p-4 overflow-hidden">
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Inbox className="w-3.5 h-3.5 text-blue-400/60" />
                  <span className="text-[10px] font-semibold text-blue-300/50 uppercase tracking-wider">Nahraté skeny</span>
                </div>
                {[90, 75, 82, 68].map((w, i) => (
                  <div key={i} className="flex gap-2">
                    <SkeletonRow w="22%" h={28} opacity={0.45} />
                    <SkeletonRow w={`${w * 0.6}%`} h={28} opacity={0.45} />
                    <SkeletonRow w="16%" h={28} opacity={0.45} />
                  </div>
                ))}
              </div>

              <div style={{ width: 1, background: "rgba(255,255,255,0.06)", flexShrink: 0 }} />

              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-400/60" />
                  <span className="text-[10px] font-semibold text-blue-300/50 uppercase tracking-wider">Dnešné aktivity</span>
                </div>
                {[80, 65, 72].map((w, i) => (
                  <div key={i} className="flex gap-2">
                    <SkeletonRow w="14%" h={28} opacity={0.45} />
                    <SkeletonRow w={`${w * 0.7}%`} h={28} opacity={0.45} />
                  </div>
                ))}
                <div className="mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="w-3.5 h-3.5 text-amber-400/60" />
                    <span className="text-[10px] font-semibold text-blue-300/40 uppercase tracking-wider">Prenesené nevyriešené</span>
                  </div>
                  {[55, 70].map((w, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <SkeletonRow w="14%" h={26} opacity={0.35} />
                      <SkeletonRow w={`${w * 0.65}%`} h={26} opacity={0.35} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Vrstva Maily — Roztriedenie mailov placeholder */}
          <div
            className="absolute flex flex-col overflow-hidden rounded-xl border border-teal-500/15"
            style={{
              width: "90vw",
              height: "90vh",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "linear-gradient(180deg, #0f1f1e 0%, #0b1918 100%)",
              opacity: activeLayer === "mails" ? 1 : 0,
              zIndex: activeLayer === "mails" ? 4 : 0,
              transition: "opacity 0.2s ease",
              pointerEvents: activeLayer === "mails" ? "auto" : "none",
            }}
          >
            <div
              className="flex items-center gap-3 px-5 py-3 shrink-0"
              style={{ borderBottom: "1px solid rgba(20,184,166,0.15)", background: "rgba(10,30,28,0.7)" }}
            >
              <button
                type="button"
                onClick={handleBackToHub}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-teal-300/70 hover:text-teal-100 hover:bg-white/10 transition-colors text-xs font-semibold border border-teal-500/20 hover:border-teal-400/40"
                data-testid="button-mails-back"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Späť
              </button>
              <div className="h-3 w-px bg-teal-500/25 mx-1" />
              <Mail className="w-4 h-4 text-teal-400" />
              <span className="text-sm font-extrabold tracking-[0.2em] text-teal-300">ROZTRIEDENIE MAILOV</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <Mail className="w-16 h-16 text-teal-400/30 mx-auto" />
                <p className="text-teal-300/60 text-lg font-semibold">Roztriedenie mailov – pripravuje sa</p>
                <p className="text-teal-300/30 text-sm">Táto funkcia bude dostupná v budúcej verzii.</p>
              </div>
            </div>
          </div>

          {/* Vrstva 3 — vrchná/predná (85vw × 85vh): Hub s bublinami */}
          <div
            className="absolute flex flex-col overflow-hidden rounded-xl shadow-2xl border border-amber-500/20"
            style={{
              width: "85vw",
              height: "85vh",
              top: "50%",
              left: "50%",
              background: DARK_BG,
              zIndex: hubIsInactive ? 0 : 3,
              pointerEvents: hubIsInactive ? "none" : "auto",
              transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease",
              transform: (hubExiting || isClosing || hubIsInactive)
                ? "translate(-50%, -50%) translateX(-60px) translateY(-20px) scale(0.94)"
                : "translate(-50%, -50%)",
              opacity: (hubExiting || isClosing || hubIsInactive) ? 0 : 1,
            }}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-6 py-4 shrink-0"
              style={{ borderBottom: "1px solid rgba(245,158,11,0.2)", background: "rgba(12,30,58,0.6)" }}
            >
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

              <div className="flex items-center gap-1.5 shrink-0">
                <Shield className="w-3.5 h-3.5 text-amber-400/60" />
                <span
                  className="text-xs font-semibold text-amber-400/80 tracking-wide"
                  data-testid="hub-permission-label"
                >
                  {kokpitLabel}
                </span>
              </div>

              <div className="flex-1" />

              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 rounded-lg text-blue-300/60 hover:text-blue-100 hover:bg-white/10 transition-colors text-xs font-semibold tracking-wide border border-blue-500/20 hover:border-blue-400/40 shrink-0"
                data-testid="button-hub-close"
              >
                Zavrieť
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-8">
              <p className="text-[11px] font-semibold text-blue-300/40 uppercase tracking-widest mb-6">
                Vyberte funkciu
              </p>

              {/* ── Skupina: Spracovanie zmlúv ── */}
              <div className="mb-6">
                <p className="text-[10px] font-bold text-blue-400/35 uppercase tracking-widest mb-2.5">
                  Spracovanie zmlúv
                </p>
                <div className="grid grid-cols-2 gap-5 rounded-2xl border border-blue-500/15 bg-blue-950/20 p-4">
                  {HUB_FUNCTIONS.filter(f => f.id === "roztriedenie-stavov" || f.id === "hromadny-import-stavov")
                    .map(({ id, Icon, title, subtitle, description, gradientFrom, gradientTo, borderColor, hoverBorderColor, iconColor }) => {
                      const isPinActive = pinTargetId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          data-testid={`button-hub-${id}`}
                          onClick={() => !isPinActive && handleTileClick(id)}
                          className={`
                            flex flex-col items-start gap-4 p-5 rounded-xl border
                            bg-gradient-to-br ${gradientFrom} ${gradientTo}
                            ${borderColor} ${hoverBorderColor}
                            ${isPinActive ? "ring-2 ring-amber-400/50 scale-[1.02]" : "hover:scale-[1.03] hover:shadow-lg hover:shadow-blue-900/40 active:scale-[0.98]"}
                            transition-all duration-200 text-left cursor-pointer group
                          `}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-white/5 border border-white/10 group-hover:border-amber-500/30 transition-colors">
                              <Icon className={`w-6 h-6 ${iconColor} group-hover:text-amber-400 transition-colors`} />
                            </div>
                            {isPinActive && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <PinInput correctPin={userKokpitPin} onSuccess={handlePinSuccess} onCancel={handlePinCancel} />
                              </div>
                            )}
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
                      );
                    })}
                </div>
              </div>

              {/* ── Ostatné funkcie ── */}
              <div>
                <p className="text-[10px] font-bold text-blue-400/35 uppercase tracking-widest mb-2.5">
                  Ostatné
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                  {HUB_FUNCTIONS.filter(f => f.id !== "roztriedenie-stavov" && f.id !== "hromadny-import-stavov")
                    .map(({ id, Icon, title, subtitle, description, gradientFrom, gradientTo, borderColor, hoverBorderColor, iconColor }) => {
                      const isPinActive = pinTargetId === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          data-testid={`button-hub-${id}`}
                          onClick={() => !isPinActive && handleTileClick(id)}
                          className={`
                            flex flex-col items-start gap-4 p-5 rounded-xl border
                            bg-gradient-to-br ${gradientFrom} ${gradientTo}
                            ${borderColor} ${hoverBorderColor}
                            ${isPinActive ? "ring-2 ring-amber-400/50 scale-[1.02]" : "hover:scale-[1.03] hover:shadow-lg hover:shadow-blue-900/40 active:scale-[0.98]"}
                            transition-all duration-200 text-left cursor-pointer group
                          `}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-white/5 border border-white/10 group-hover:border-amber-500/30 transition-colors">
                              <Icon className={`w-6 h-6 ${iconColor} group-hover:text-amber-400 transition-colors`} />
                            </div>
                            {isPinActive && (
                              <div onClick={(e) => e.stopPropagation()}>
                                <PinInput correctPin={userKokpitPin} onSuccess={handlePinSuccess} onCancel={handlePinCancel} />
                              </div>
                            )}
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
                      );
                    })}
                </div>
              </div>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
