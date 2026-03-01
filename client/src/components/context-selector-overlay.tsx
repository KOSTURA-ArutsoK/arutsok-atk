import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Building2, ArrowLeft, Layers } from "lucide-react";
import type { MyCompany, LogoEntry } from "@shared/schema";

type StateItem = { id: number; name: string; code: string; flagUrl: string | null; continentId: number };
type DivisionItem = { id: number; name: string; code: string | null; emoji?: string | null; divisionId: number; division?: { id: number; name: string; code: string | null; emoji?: string | null } };

function StateFlagImage({ src, alt, code, className }: { src: string | null | undefined; alt: string; code?: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
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
      src={src}
      alt={alt}
      className={className || "w-20 h-20 object-cover rounded-full"}
      onError={() => setFailed(true)}
    />
  );
}

interface ContextSelectorOverlayProps {
  open: boolean;
  step: "state" | "company" | "division";
  states: StateItem[];
  companies: MyCompany[];
  companyDivisions: DivisionItem[];
  currentStateId: number | null;
  currentCompanyId: number | null;
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

export function ContextSelectorOverlay({
  open,
  step,
  states,
  companies,
  companyDivisions,
  currentStateId,
  currentCompanyId,
  onSelectState,
  onSelectCompany,
  onSelectDivision,
  onBack,
  onClose,
}: ContextSelectorOverlayProps) {
  const [animating, setAnimating] = useState(false);

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

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${animating ? "opacity-0" : "opacity-100"}`}
      data-testid="context-selector-overlay"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} data-testid="context-overlay-backdrop" />

      {step === "state" && (
        <div className="relative z-10 flex flex-col items-center gap-6">
          <h2 className="text-2xl font-bold text-white tracking-tight text-center" data-testid="text-context-title">
            Vyberte štát
          </h2>
          <div className="flex flex-nowrap items-start justify-center gap-10">
            {[...states].sort((a, b) => a.name.localeCompare(b.name, "sk")).map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectState(s.id)}
                className="flex flex-col items-center gap-3 group cursor-pointer"
                data-testid={`context-state-${s.id}`}
              >
                <div className="rounded-full p-1.5 border-2 border-sky-400/40 transition-all duration-200 group-hover:border-sky-400 group-hover:shadow-lg group-hover:shadow-sky-400/30 group-hover:scale-105">
                  <StateFlagImage
                    src={s.flagUrl}
                    alt={s.name}
                    code={s.code}
                    className="w-20 h-20 object-cover rounded-full"
                  />
                </div>
                <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors text-center whitespace-nowrap">
                  {s.name}
                </span>
              </button>
            ))}
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

          <div className="overflow-y-auto w-full max-w-3xl" style={{ maxHeight: "calc(90vh - 200px)" }}>
            {filteredCompanies.length > 0 ? (
              <div className="flex flex-wrap items-start justify-center gap-6">
                {[...filteredCompanies].sort((a, b) => a.name.localeCompare(b.name, "sk")).map(c => {
                  const logoUrl = getPrimaryLogo(c.logos as LogoEntry[] | null);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectCompany(c.id)}
                      className="flex flex-col items-center gap-3 group cursor-pointer w-28"
                      data-testid={`context-company-${c.id}`}
                    >
                      <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:border-sky-400 group-hover:shadow-lg group-hover:shadow-sky-400/30 group-hover:scale-105">
                        {logoUrl ? (
                          <img src={logoUrl} alt={c.name} className="w-full h-full object-contain p-1.5" />
                        ) : (
                          <Building2 className="w-7 h-7 text-white/50" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors text-center leading-tight">
                        {c.name}
                      </span>
                      {c.specialization && (
                        <span className="text-[10px] text-white/40 text-center">{c.specialization}</span>
                      )}
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

          <div className="overflow-y-auto w-full max-w-3xl" style={{ maxHeight: "calc(90vh - 140px)" }}>
            <div className="flex flex-wrap items-start justify-center gap-6">
              {companyDivisions.map(cd => {
                const divId = cd.divisionId || cd.division?.id;
                const divName = cd.division?.name || cd.name || "Divízia";
                const divEmoji = cd.division?.emoji || cd.emoji;
                return (
                  <button
                    key={divId}
                    type="button"
                    onClick={() => onSelectDivision(divId)}
                    className="flex flex-col items-center gap-3 group cursor-pointer w-28"
                    data-testid={`context-division-${divId}`}
                  >
                    <div className="w-16 h-16 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:border-sky-400 group-hover:shadow-lg group-hover:shadow-sky-400/30 group-hover:scale-105">
                      {divEmoji ? (
                        <span className="text-2xl">{divEmoji}</span>
                      ) : (
                        <Layers className="w-7 h-7 text-white/50" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-white/80 group-hover:text-white transition-colors text-center leading-tight">
                      {divName}
                    </span>
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
