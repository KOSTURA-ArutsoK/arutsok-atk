import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Building2, ArrowLeft, Layers, User, Briefcase } from "lucide-react";
import type { MyCompany, LogoEntry } from "@shared/schema";

type StateItem = { id: number; name: string; code: string; flagUrl: string | null; continentId: number };
type DivisionItem = { id: number; name: string; code: string | null; emoji?: string | null; divisionId: number; division?: { id: number; name: string; code: string | null; emoji?: string | null } };

export type IdentityOption = {
  type: "fo" | "szco" | "firma";
  label: string;
  subLabel: string;
  subjectId: number | null;
};

const LEGAL_FORMS = [
  "spol. s r. o.", "spol. s r.o.", "s. r. o.", "s.r.o.",
  "a. s.", "a.s.",
  "k. s.", "k.s.",
  "v. o. s.", "v.o.s.",
  "z. s.", "z.s.",
  "o. z.", "o.z.",
  "n. o.", "n.o.",
  "SE",
];

function formatCompanyName(name: string): { main: string; legal: string | null } {
  const trimmed = name.trim();
  for (const form of LEGAL_FORMS) {
    const sep = ", " + form;
    const idx = trimmed.toLowerCase().lastIndexOf(sep.toLowerCase());
    if (idx !== -1) {
      return { main: trimmed.substring(0, idx).trim(), legal: trimmed.substring(idx + 2).trim() };
    }
  }
  for (const form of LEGAL_FORMS) {
    const sep = " " + form;
    const idx = trimmed.toLowerCase().lastIndexOf(sep.toLowerCase());
    if (idx !== -1) {
      return { main: trimmed.substring(0, idx).trim(), legal: trimmed.substring(idx + 1).trim() };
    }
  }
  return { main: trimmed, legal: null };
}

function upgradeFlagUrl(src: string | null | undefined): string | null | undefined {
  if (!src) return src;
  return src.replace(/flagcdn\.com\/w\d+\//i, "flagcdn.com/w160/");
}

function StateFlagImage({ src, alt, code, className }: { src: string | null | undefined; alt: string; code?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = upgradeFlagUrl(src);

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-muted/50 ${className || "w-20 h-20"}`}
        title={alt}
        data-testid={`flag-fallback-${code || "unknown"}`}
      >
        <span className="text-xs font-bold text-muted-foreground uppercase">{code || "?"}</span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className={className || "w-20 h-20 object-cover rounded-full"}
      onError={() => setFailed(true)}
    />
  );
}

interface ContextSelectorOverlayProps {
  open: boolean;
  step: "identity" | "state" | "company" | "division";
  states: StateItem[];
  companies: MyCompany[];
  companyDivisions: DivisionItem[];
  currentStateId: number | null;
  currentCompanyId: number | null;
  activeStateId?: number | null;
  loginFlow?: boolean;
  identityContexts?: IdentityOption[];
  onSelectIdentity?: (ctx: IdentityOption) => void;
  onSelectState: (stateId: number) => void;
  onSelectCompany: (companyId: number) => void;
  onSelectDivision: (divisionId: number | null) => void;
  onBack: () => void;
  onClose: () => void;
}

function getPrimaryLogo(logos: LogoEntry[] | null | undefined): string | null {
  if (!logos || logos.length === 0) return null;
  const primary = logos.find(l => l.isPrimary && !l.isArchived);
  if (primary) return primary.url;
  const first = logos.find(l => !l.isArchived);
  return first?.url || null;
}

function IdentityIcon({ type, className }: { type: IdentityOption["type"]; className?: string }) {
  switch (type) {
    case "fo": return <User className={className} />;
    case "szco": return <Briefcase className={className} />;
    case "firma": return <Building2 className={className} />;
  }
}

function identityColors(type: IdentityOption["type"]): { ring: string; bg: string; icon: string } {
  switch (type) {
    case "fo": return { ring: "border-emerald-400/40 group-hover:border-emerald-400 group-hover:shadow-emerald-400/30", bg: "bg-emerald-500/20", icon: "text-emerald-400" };
    case "szco": return { ring: "border-sky-400/40 group-hover:border-sky-400 group-hover:shadow-sky-400/30", bg: "bg-sky-500/20", icon: "text-sky-400" };
    case "firma": return { ring: "border-violet-400/40 group-hover:border-violet-400 group-hover:shadow-violet-400/30", bg: "bg-violet-500/20", icon: "text-violet-400" };
  }
}

export function ContextSelectorOverlay({
  open,
  step,
  states,
  companies,
  companyDivisions,
  currentStateId,
  currentCompanyId,
  activeStateId,
  loginFlow,
  identityContexts,
  onSelectIdentity,
  onSelectState,
  onSelectCompany,
  onSelectDivision,
  onBack,
  onClose,
}: ContextSelectorOverlayProps) {
  const [animating, setAnimating] = useState(false);
  const [hoveredDivId, setHoveredDivId] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setAnimating(true);
      const t = setTimeout(() => setAnimating(false), 50);
      return () => clearTimeout(t);
    }
  }, [open, step]);

  if (!open) return null;

  const filteredCompanies = companies.filter(c => !c.isDeleted && c.stateId === currentStateId);
  const selectedState = states.find(s => s.id === currentStateId);
  const selectedCompany = companies.find(c => c.id === currentCompanyId);

  const handleBackdropClick = loginFlow ? undefined : onClose;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${animating ? "opacity-0" : "opacity-100"}`}
      data-testid="context-selector-overlay"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleBackdropClick} data-testid="context-overlay-backdrop" />

      {step === "identity" && (
        <div className="relative z-10 flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-2">
            <h2 className="text-2xl font-bold text-white tracking-tight text-center" data-testid="text-context-title">
              Ako sa prihlásiť?
            </h2>
            <p className="text-sm text-white/60 text-center">Zvoľte, v akej úlohe vstúpite do systému</p>
          </div>
          <div className="flex flex-wrap items-start justify-center gap-10 max-w-3xl px-6">
            {(identityContexts || []).map((ctx, idx) => {
              const colors = identityColors(ctx.type);
              return (
                <button
                  key={`${ctx.type}-${idx}`}
                  type="button"
                  onClick={() => onSelectIdentity?.(ctx)}
                  className={`flex flex-col items-center gap-3 group cursor-pointer`}
                  data-testid={`context-identity-${ctx.type}`}
                >
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${colors.ring} group-hover:shadow-lg group-hover:scale-105 ${colors.bg}`}>
                    <IdentityIcon type={ctx.type} className={`w-10 h-10 ${colors.icon}`} />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-sm font-semibold text-center whitespace-nowrap transition-colors text-white/90 group-hover:text-white">
                      {ctx.label}
                    </span>
                    <span className="text-xs text-white/50 group-hover:text-white/70 text-center max-w-[120px] leading-tight">
                      {ctx.subLabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {(!identityContexts || identityContexts.length === 0) && (
            <p className="text-white/60 text-sm text-center">Žiadne identity k dispozícii</p>
          )}
        </div>
      )}

      {step === "state" && (
        <div className="relative z-10 flex flex-col items-center gap-6">
          {loginFlow && (identityContexts?.length ?? 0) > 1 && (
            <button
              onClick={onBack}
              data-testid="button-context-back"
              className="fixed left-6 top-6 z-20 flex items-center gap-2 text-white/70 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Späť na výber identity</span>
            </button>
          )}
          <h2 className="text-2xl font-bold text-white tracking-tight text-center" data-testid="text-context-title">
            Vyberte štát
          </h2>
          <div className="flex flex-wrap items-start justify-center gap-10 max-w-3xl px-6">
            {(() => {
              const seen = new Map<string, StateItem>();
              for (const s of states) {
                const key = s.code + ":" + s.name.toLowerCase();
                if (!seen.has(key)) seen.set(key, s);
              }
              return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "sk"));
            })().map(s => {
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectState(s.id)}
                  className="flex flex-col items-center gap-3 group cursor-pointer"
                  data-testid={`context-state-${s.id}`}
                >
                  <div className="rounded-full p-1.5 border-2 transition-all duration-200 border-sky-400/40 group-hover:border-sky-400 group-hover:shadow-lg group-hover:shadow-sky-400/30 group-hover:scale-105">
                    <StateFlagImage
                      src={s.flagUrl}
                      alt={s.name}
                      code={s.code}
                      className="w-20 h-20 object-cover rounded-full"
                    />
                  </div>
                  <span className="text-sm font-medium text-center whitespace-nowrap transition-colors text-white/80 group-hover:text-white">
                    {s.name}
                  </span>
                </button>
              );
            })}
          </div>
          {states.length === 0 && (
            <p className="text-white/60 text-sm text-center">Žiadne štáty k dispozícii</p>
          )}
        </div>
      )}

      {step === "company" && (
        <div className="relative z-10 flex flex-col items-center gap-6 max-w-4xl w-full px-6" style={{ maxHeight: "90vh" }}>
          <button
            onClick={onBack}
            data-testid="button-context-back"
            className="fixed left-6 top-6 z-20 flex items-center gap-2 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Späť na výber štátu</span>
          </button>

          {selectedState && (
            <div className="rounded-full p-1.5 border-2 border-sky-400/30">
              <StateFlagImage
                src={selectedState.flagUrl}
                alt={selectedState.name}
                code={selectedState.code}
                className="w-16 h-16 object-cover rounded-full"
              />
            </div>
          )}
          <div className="flex flex-col items-center gap-1">
            <h2 className="text-xl font-bold text-white tracking-tight text-center" data-testid="text-context-title">
              {selectedState?.name || "Štát"}
            </h2>
            <p className="text-sm text-white/60 text-center">Zvoľte spoločnosť</p>
          </div>

          <div className="overflow-y-auto overflow-x-hidden w-full max-w-3xl py-2" style={{ maxHeight: "calc(90vh - 200px)" }}>
            {filteredCompanies.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-5 p-2">
                {[...filteredCompanies].sort((a, b) => a.name.localeCompare(b.name, "sk")).map(c => {
                  const logoUrl = getPrimaryLogo(c.logos as LogoEntry[] | null);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCompany(c.id)}
                      className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 transition-all duration-200 hover:border-sky-400 hover:bg-white/10 hover:shadow-lg hover:shadow-sky-400/20 group cursor-pointer w-32 h-36"
                      data-testid={`context-company-${c.id}`}
                    >
                      <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                        {logoUrl ? (
                          <img src={logoUrl} alt={c.name} className="w-full h-full object-contain p-1.5 grayscale opacity-70 transition-all duration-200 group-hover:grayscale-0 group-hover:opacity-100" />
                        ) : (
                          <Building2 className="w-7 h-7 text-white/40 transition-colors duration-200 group-hover:text-sky-400" />
                        )}
                      </div>
                      {(() => {
                        const { main, legal } = formatCompanyName(c.name);
                        return (
                          <div className="text-sm font-medium text-white/70 group-hover:text-sky-400 transition-colors text-center leading-tight line-clamp-3 break-words">
                            <span>{main}</span>
                            {legal && <><br /><span className="text-white/50 group-hover:text-sky-400/70">{legal}</span></>}
                          </div>
                        );
                      })()}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <Building2 className="w-8 h-8 text-white/40" />
                <p className="text-white/60 text-sm">Žiadne spoločnosti pre tento štát</p>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "division" && (
        <div className="relative z-10 flex flex-col items-center gap-6 max-w-4xl w-full px-6" style={{ maxHeight: "90vh" }}>
          <button
            onClick={onBack}
            data-testid="button-context-back"
            className="fixed left-6 top-6 z-20 flex items-center gap-2 text-white/70 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Späť na výber spoločnosti</span>
          </button>

          <div className="flex flex-col items-center gap-1">
            <h2 className="text-xl font-bold text-white tracking-tight text-center" data-testid="text-context-title">
              {selectedCompany?.name || "Spoločnosť"}
            </h2>
            <p className="text-sm text-white/60 text-center">Zvoľte divíziu</p>
          </div>

          <div className="overflow-y-auto overflow-x-hidden w-full max-w-3xl py-2" style={{ maxHeight: "calc(90vh - 140px)" }}>
            <div className="flex flex-wrap items-start justify-center gap-0 p-2">
              {companyDivisions.map(cd => {
                const divId = cd.divisionId || cd.division?.id;
                const divName = cd.division?.name || cd.name || "Divízia";
                const divEmoji = cd.division?.emoji || cd.emoji;
                const isDivisionInactive = cd.division?.isActive === false;
                const isHov = hoveredDivId === divId;
                const triPath = "M 92,28 L 141,112 Q 154,134 129,134 L 31,134 Q 6,134 19,112 L 68,28 Q 80,6 92,28 Z";
                return (
                  <button
                    key={divId}
                    type="button"
                    onClick={() => onSelectDivision(divId)}
                    data-testid={`context-division-${divId}`}
                    onMouseEnter={() => setHoveredDivId(divId ?? null)}
                    onMouseLeave={() => setHoveredDivId(null)}
                    style={{
                      position: "relative",
                      width: 180,
                      height: 200,
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      outline: "none",
                      userSelect: "none",
                      opacity: isDivisionInactive ? 0.5 : 1,
                      filter: isDivisionInactive ? "grayscale(1)" : undefined,
                      transition: "filter 0.2s ease",
                    }}
                  >
                    <svg
                      width="180"
                      height="200"
                      viewBox="0 0 160 140"
                      style={{ position: "absolute", top: 0, left: 0, display: "block" }}
                    >
                      <path
                        d={triPath}
                        fill={isHov ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)"}
                        stroke={isHov ? "rgba(56,189,248,0.8)" : "rgba(255,255,255,0.10)"}
                        strokeWidth="1.5"
                        style={{ transition: "fill 0.2s ease, stroke 0.2s ease" }}
                      />
                    </svg>
                    <span style={{
                      position: "absolute",
                      top: 72,
                      left: 0,
                      right: 0,
                      textAlign: "center",
                      fontSize: 30,
                      lineHeight: 1,
                      userSelect: "none",
                    }}>
                      {divEmoji || "🌲"}
                    </span>

                    <div style={{
                      position: "absolute",
                      top: 83,
                      left: 38,
                      right: 38,
                      bottom: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}>
                      <span style={{
                        fontFamily: "sans-serif",
                        fontSize: 11,
                        fontWeight: 600,
                        color: isHov ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.70)",
                        textAlign: "center",
                        lineHeight: 1.3,
                        wordBreak: "break-word",
                        maxHeight: `${3 * 11 * 1.3}px`,
                        overflow: "hidden",
                        transition: "color 0.2s ease",
                      }}>
                        {divName}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            {companyDivisions.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Layers className="w-8 h-8 text-white/40" />
                <p className="text-white/60 text-sm">Žiadne divízie pre túto spoločnosť</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
