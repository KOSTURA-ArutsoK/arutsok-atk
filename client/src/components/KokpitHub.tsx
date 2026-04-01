import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppUser } from "@/hooks/use-app-user";
import { formatUid } from "@/lib/utils";
import { KokpitDialogBody } from "@/components/KokpitDialog";
import { KokpitAktivityPanel } from "@/components/KokpitAktivityPanel";
import type { ScanFile } from "@/pages/PridatStavZmluvy";
import {
  Target, Layers, FileInput, Calculator, Shield, User,
  Inbox, FileText, Clock, ChevronLeft, FileDown, Zap, Mail, Upload,
} from "lucide-react";

export type KokpitFunctionId = "roztriedenie-stavov" | "zadavanie-provizii" | "vypocet-odmien" | "roztriedenie-mailov" | "dokumenty-na-stiahnutie" | "hromadny-import-stavov";

interface KokpitHubProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelectFunction: (fn: KokpitFunctionId) => void;
  scanFiles?: ScanFile[];
  onRemoveScanFile?: (id: string, reason?: string) => void;
  onAddFiles?: (files: File[]) => void;
  viewMode: 'day' | 'week' | 'month';
  setViewMode: (m: 'day' | 'week' | 'month') => void;
  viewDate: string;
  setViewDate: (d: string) => void;
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

const PANEL_BG = "#07111f";

const DROP_SHADOW_LIGHT = "drop-shadow(0 8px 32px rgba(0,0,0,0.22)) drop-shadow(0 2px 8px rgba(0,0,0,0.15))";

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

export function KokpitHub({ open, onOpenChange, onSelectFunction, scanFiles = [], onRemoveScanFile, onAddFiles, viewMode, setViewMode, viewDate, setViewDate }: KokpitHubProps) {
  const { data: appUser } = useAppUser();
  const [activeLayer, setActiveLayer] = useState<"hub" | "second" | "third" | "mails">("hub");
  const [selectedFunction, setSelectedFunction] = useState<KokpitFunctionId | null>(null);
  const [hubExiting, setHubExiting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [pinTargetId, setPinTargetId] = useState<KokpitFunctionId | null>(null);
  const [layer2DragOver, setLayer2DragOver] = useState(false);
  const layer2FileInputRef = useRef<HTMLInputElement>(null);

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

  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  );
  useEffect(() => {
    if (typeof MutationObserver === 'undefined') return;
    const obs = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const shadowRoyalBlue = isDark
    ? "0 0 0 1px rgba(27,38,59,0.60), 0 0 24px 6px rgba(27,38,59,0.40), 0 0 56px 14px rgba(27,38,59,0.25)"
    : undefined;
  const panelFilter = isDark ? undefined : DROP_SHADOW_LIGHT;

  const closingRef = useRef(false);
  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsClosing(true);
    setTimeout(() => {
      closingRef.current = false;
      setIsClosing(false);
      setActiveLayer("hub");
      setSelectedFunction(null);
      setPinTargetId(null);
      onOpenChange(false);
    }, 280);
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  function doSelectFunction(id: KokpitFunctionId) {
    onSelectFunction(id);
    setHubExiting(true);
    setTimeout(() => {
      setHubExiting(false);
      setSelectedFunction(id);
      if (id === "roztriedenie-stavov") {
        setActiveLayer("second");
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
    setSelectedFunction(null);
  }

  const hubIsInactive = activeLayer !== "hub";

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Backdrop */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(2,6,15,0.78)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
        onClick={handleClose}
      />

      {/* Root container — all layers live inside; clicking outside panels closes */}
      <div
        style={{
          position: "relative",
          width: "97vw",
          height: "97vh",
          overflow: "hidden",
          borderRadius: 16,
          background: "#040c17",
        }}
        onClick={handleClose}
      >

        {/* Vrstva 1 — spodná/zadná (95vw × 95vh): skeletal alebo skutočný KokpitDialog obsah */}
        <div
          style={{
            position: "absolute",
            width: "95vw",
            height: "95vh",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: PANEL_BG,
            zIndex: activeLayer === "third" ? 3 : 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 12,
            border: "2px solid #1B263B",
            boxShadow: shadowRoyalBlue,
            filter: panelFilter,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {activeLayer === "third" && (
            <KokpitDialogBody
              scanFiles={scanFiles}
              onRemoveScanFile={onRemoveScanFile ?? (() => {})}
              onAddFiles={onAddFiles ?? (() => {})}
              onClose={handleBackToHub}
              onBack={handleBackToHub}
              enabled={activeLayer === "third"}
            />
          )}
        </div>

        {/* Vrstva 2 — stredná (90vw × 90vh): Aktivity panel alebo skeletal */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            width: "90vw",
            height: "90vh",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: PANEL_BG,
            zIndex: activeLayer === "second" ? 3 : 2,
            overflow: "hidden",
            borderRadius: 12,
            border: "2px solid #1B263B",
            boxShadow: shadowRoyalBlue,
            filter: panelFilter,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {activeLayer === "second" && selectedFunction === "roztriedenie-stavov" && (
            <>
              {/* ── Layer 2 header ─────────────────────────────────────────── */}
              <div
                className="flex items-center gap-2 px-5 py-3 shrink-0"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "#0c1e3a" }}
              >
                <button
                  type="button"
                  onClick={handleBackToHub}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-blue-300/70 hover:text-blue-100 hover:bg-white/10 transition-colors text-xs font-semibold border border-blue-500/20 hover:border-blue-400/40 shrink-0"
                  data-testid="button-layer2-back"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Späť
                </button>
                <div className="h-3 w-px bg-amber-500/25 mx-1 shrink-0" />
                <Target className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-sm font-extrabold tracking-[0.25em] text-amber-300 shrink-0">KOKPIT</span>
                <div className="h-3 w-px bg-amber-500/25 mx-1 shrink-0" />
                <User className="w-3.5 h-3.5 text-blue-400/70 shrink-0" />
                <span className="text-sm font-semibold text-blue-100 truncate min-w-0" data-testid="layer2-user-name">{userName}</span>
                <span className="text-[11px] font-mono text-blue-300/50 whitespace-nowrap shrink-0" data-testid="layer2-user-uid">{userUid ?? "—"}</span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-3 py-1.5 rounded-lg text-blue-300/60 hover:text-blue-100 hover:bg-white/10 transition-colors text-xs font-semibold tracking-wide border border-blue-500/20 hover:border-blue-400/40 shrink-0"
                  data-testid="button-layer2-close"
                >
                  Ukončiť
                </button>
              </div>

              {/* ── Body: activity panel + right drop-zone sidebar (15vw) ── */}
              <div className="flex flex-1 overflow-hidden min-h-0">

                {/* Activity panel — takes remaining width */}
                <div className="flex flex-col flex-1 overflow-hidden min-h-0 px-5 py-3">
                  <KokpitAktivityPanel
                    scanFiles={scanFiles}
                    onRemoveScanFile={onRemoveScanFile ?? (() => {})}
                    onAddFiles={onAddFiles ?? (() => {})}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    viewDate={viewDate}
                    setViewDate={setViewDate}
                  />
                </div>

                {/* Drop zone sidebar — 15vw, full height */}
                <div
                  style={{
                    width: "15vw",
                    minWidth: 148,
                    borderLeft: "1px solid rgba(255,255,255,0.07)",
                    display: "flex",
                    flexDirection: "column",
                    background: layer2DragOver ? "rgba(14,165,233,0.08)" : "#050f1e",
                    transition: "background 0.15s ease",
                  }}
                >
                  {/* Sidebar title */}
                  <div
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      padding: "8px 12px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.14em",
                      color: "rgba(125,211,252,0.55)",
                      textTransform: "uppercase",
                    }}
                  >
                    Nahrávanie skenov
                  </div>

                  {/* Drop zone — flex-1, full height */}
                  <div
                    data-testid="drop-zone-scans"
                    onDragOver={e => { e.preventDefault(); setLayer2DragOver(true); }}
                    onDragLeave={() => setLayer2DragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setLayer2DragOver(false);
                      const files = Array.from(e.dataTransfer.files).filter(f => f.size > 0);
                      if (onAddFiles) onAddFiles(files);
                    }}
                    onClick={() => layer2FileInputRef.current?.click()}
                    className="flex-1 flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all"
                    style={{
                      margin: "10px 10px 0 10px",
                      borderRadius: 10,
                      border: layer2DragOver
                        ? "2px solid rgba(56,189,248,0.7)"
                        : "2px dashed rgba(56,189,248,0.28)",
                      background: layer2DragOver
                        ? "rgba(14,165,233,0.12)"
                        : "rgba(14,165,233,0.04)",
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: layer2DragOver ? "rgba(56,189,248,0.2)" : "rgba(56,189,248,0.09)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "background 0.15s ease",
                      }}
                    >
                      <Upload size={18} style={{ color: layer2DragOver ? "rgba(56,189,248,0.9)" : "rgba(56,189,248,0.55)" }} />
                    </div>
                    <p style={{ fontSize: 10, color: "rgba(148,163,184,0.55)", textAlign: "justify", lineHeight: 1.5, padding: "0 8px" }}>
                      Pretiahnite<br />skeny sem<br />
                      <span style={{ color: "rgba(56,189,248,0.4)", fontSize: 9 }}>alebo kliknite</span>
                    </p>
                    {scanFiles.length > 0 && (
                      <div
                        style={{
                          padding: "3px 10px",
                          borderRadius: 20,
                          background: "rgba(251,191,36,0.15)",
                          border: "1px solid rgba(251,191,36,0.3)",
                          fontSize: 10,
                          color: "rgba(251,191,36,0.85)",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Upload size={9} />
                        {scanFiles.length} súbor{scanFiles.length === 1 ? "" : scanFiles.length < 5 ? "y" : "ov"}
                      </div>
                    )}
                  </div>

                  {/* Pokračovať button — prominent, at bottom */}
                  <div style={{ padding: "10px 10px 12px 10px" }}>
                    <button
                      type="button"
                      data-testid="button-layer2-pokracovat"
                      onClick={() => setActiveLayer("third")}
                      className="w-full flex items-center justify-center gap-2 rounded-lg font-bold transition-all"
                      style={{
                        padding: "10px 0",
                        fontSize: 12,
                        letterSpacing: "0.06em",
                        background: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)",
                        color: "#fff",
                        border: "1px solid rgba(56,189,248,0.5)",
                        boxShadow: "0 0 16px rgba(14,165,233,0.25), 0 2px 8px rgba(0,0,0,0.4)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 0 24px rgba(14,165,233,0.45), 0 2px 8px rgba(0,0,0,0.4)")}
                      onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 0 16px rgba(14,165,233,0.25), 0 2px 8px rgba(0,0,0,0.4)")}
                    >
                      Pokračovať
                      <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
                    </button>
                  </div>

                  <input
                    ref={layer2FileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    data-testid="input-file-scans-layer2"
                    onChange={e => {
                      const files = Array.from(e.target.files ?? []).filter(f => f.size > 0);
                      if (onAddFiles) onAddFiles(files);
                      if (layer2FileInputRef.current) layer2FileInputRef.current.value = "";
                    }}
                  />
                </div>
              </div>
            </>
          )}
          {activeLayer === "second" && selectedFunction !== "roztriedenie-stavov" && (
            /* ── Skeleton (pre ostatné funkcie v Layer 2) ── */
            <>
              <div
                className="flex items-center gap-2 px-5 py-3 shrink-0"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "#0c1e3a" }}
              >
                <button
                  type="button"
                  onClick={handleBackToHub}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-blue-300/70 hover:text-blue-100 hover:bg-white/10 transition-colors text-xs font-semibold border border-blue-500/20 hover:border-blue-400/40 shrink-0"
                  data-testid="button-layer2-back-skeleton"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  Späť
                </button>
                <div className="h-3 w-px bg-amber-500/25 mx-1 shrink-0" />
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded shrink-0"
                  style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.25)" }}
                >
                  <Target className="w-3 h-3 text-amber-400" />
                  <span className="text-[10px] font-bold tracking-widest text-amber-300">KOKPIT</span>
                </div>
                <div className="h-3 w-px bg-amber-500/25 mx-1 shrink-0" />
                <User className="w-3.5 h-3.5 text-blue-400/70 shrink-0" />
                <span className="text-sm font-semibold text-blue-100 truncate min-w-0" data-testid="layer2-skeleton-user-name">{userName}</span>
                <span className="text-[11px] font-mono text-blue-300/50 whitespace-nowrap shrink-0" data-testid="layer2-skeleton-user-uid">{userUid ?? "—"}</span>
                <div className="flex-1" />
                <span className="text-xs font-semibold text-blue-200/50 shrink-0">
                  {new Date().toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
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
            </>
          )}
        </div>

        {/* Vrstva Maily — Roztriedenie mailov placeholder */}
        {activeLayer === "mails" && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            width: "90vw",
            height: "90vh",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: PANEL_BG,
            zIndex: 4,
            overflow: "hidden",
            borderRadius: 12,
            border: "2px solid #1B263B",
            boxShadow: shadowRoyalBlue,
            filter: panelFilter,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="flex items-center gap-3 px-5 py-3 shrink-0"
            style={{ borderBottom: "1px solid rgba(20,184,166,0.15)", background: "#0a1e1c" }}
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
              <p className="text-teal-300/60 text-lg font-semibold" style={{ textAlign: "justify" }}>Roztriedenie mailov – pripravuje sa</p>
              <p className="text-teal-300/30 text-sm" style={{ textAlign: "justify" }}>Táto funkcia bude dostupná v budúcej verzii.</p>
            </div>
          </div>
        </div>
        )}

        {/* Vrstva 3 — vrchná/predná (85vw × 85vh): Hub s bublinami */}
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            width: "85vw",
            height: "85vh",
            top: "50%",
            left: "50%",
            background: PANEL_BG,
            zIndex: hubIsInactive ? 0 : 3,
            pointerEvents: hubIsInactive ? "none" : "auto",
            transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.28s ease",
            transform: (hubExiting || isClosing || hubIsInactive)
              ? "translate(-50%, -50%) translateX(-60px) translateY(-20px) scale(0.94)"
              : "translate(-50%, -50%)",
            opacity: (hubExiting || isClosing || hubIsInactive) ? 0 : 1,
            overflow: "hidden",
            borderRadius: 12,
            border: "2px solid #1B263B",
            boxShadow: shadowRoyalBlue,
            filter: panelFilter,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-6 py-4 shrink-0"
            style={{ borderBottom: "1px solid rgba(245,158,11,0.2)", background: "#0c1e3a" }}
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
              <span
                className="text-[11px] font-mono text-blue-300/50 whitespace-nowrap"
                data-testid="hub-user-uid"
              >
                {userUid ?? "—"}
              </span>
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
    </div>
  );
}
