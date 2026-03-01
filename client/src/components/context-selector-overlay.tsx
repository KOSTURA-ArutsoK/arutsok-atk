import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Globe, Building2, ArrowLeft, Layers, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MyCompany, LogoEntry } from "@shared/schema";

type StateItem = { id: number; name: string; code: string; flagUrl: string | null; continentId: number };
type DivisionItem = { id: number; name: string; code: string | null; emoji?: string | null; divisionId: number; division?: { id: number; name: string; code: string | null; emoji?: string | null } };

function StateFlagImage({ src, alt, code, className }: { src: string | null | undefined; alt: string; code?: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded bg-muted border border-border ${className || "w-20 h-14"}`}
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
      className={className || "w-20 h-14 object-cover rounded shadow-sm"}
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

  const stepIcon = step === "state" ? <Globe className="w-6 h-6 text-primary" /> :
                   step === "company" ? <Building2 className="w-6 h-6 text-primary" /> :
                   <Layers className="w-6 h-6 text-primary" />;

  const stepTitle = step === "state" ? "Vyberte štát" :
                    step === "company" ? "Vyberte spoločnosť" :
                    "Vyberte divíziu";

  const stepSubtitle = step === "state" ? "Zvoľte krajinu pre vašu pracovnú reláciu" :
                       step === "company" && selectedState ? (
                         <span className="flex items-center gap-1.5 justify-center">
                           <StateFlagImage src={selectedState.flagUrl} alt="" code={selectedState.code} className="w-4 h-3 object-cover rounded-sm inline" />
                           {selectedState.name} — zvoľte spoločnosť
                         </span>
                       ) :
                       step === "division" && selectedCompany ? `${selectedCompany.name} — zvoľte divíziu` :
                       "Zvoľte položku";

  const showBack = step === "company" || step === "division";

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-300 ${animating ? "opacity-0" : "opacity-100"}`}
      data-testid="context-selector-overlay"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} data-testid="context-overlay-backdrop" />

      <div
        className="relative z-10 flex flex-col w-[92vw] max-w-4xl bg-card border border-border rounded-lg shadow-2xl"
        style={{ maxHeight: "80vh" }}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
          {showBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              data-testid="button-context-back"
              className="shrink-0 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          )}
          {stepIcon}
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold tracking-tight" data-testid="text-context-title">
              {stepTitle}
            </h2>
            <p className="text-xs text-muted-foreground truncate">{stepSubtitle}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            data-testid="button-context-close"
            className="shrink-0 h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="overflow-y-auto flex-1 p-6" style={{ maxHeight: "calc(80vh - 76px)" }}>

          {step === "state" && (
            <>
              <div className="flex flex-wrap items-start justify-center gap-8 py-4">
                {[...states].sort((a, b) => a.name.localeCompare(b.name, "sk")).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelectState(s.id)}
                    className="flex flex-col items-center gap-3 transition-all duration-200 hover:scale-105 group cursor-pointer"
                    data-testid={`context-state-${s.id}`}
                  >
                    <StateFlagImage
                      src={s.flagUrl}
                      alt={s.name}
                      code={s.code}
                      className="w-24 h-16 object-cover rounded-md shadow-md transition-shadow duration-200 group-hover:shadow-lg group-hover:shadow-primary/30"
                    />
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors text-center whitespace-nowrap">
                      {s.name}
                    </span>
                  </button>
                ))}
              </div>
              {states.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">Žiadne štáty k dispozícii</p>
              )}
            </>
          )}

          {step === "company" && (
            <>
              {filteredCompanies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {[...filteredCompanies].sort((a, b) => a.name.localeCompare(b.name, "sk")).map(c => {
                    const logoUrl = getPrimaryLogo(c.logos as LogoEntry[] | null);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectCompany(c.id)}
                        className="flex flex-col items-center gap-2.5 p-4 rounded-md border border-border bg-background transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] group"
                        data-testid={`context-company-${c.id}`}
                      >
                        <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                          {logoUrl ? (
                            <img src={logoUrl} alt={c.name} className="w-full h-full object-contain p-1" />
                          ) : (
                            <Building2 className="w-7 h-7 text-muted-foreground" />
                          )}
                        </div>
                        <span className="text-sm font-medium text-foreground text-center leading-tight group-hover:text-primary transition-colors">
                          {c.name}
                        </span>
                        {c.specialization && (
                          <span className="text-[10px] text-muted-foreground text-center">{c.specialization}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Žiadne spoločnosti pre tento štát</p>
                  <Button variant="outline" size="sm" onClick={onBack} data-testid="button-context-back-empty">
                    Zmeniť štát
                  </Button>
                </div>
              )}
            </>
          )}

          {step === "division" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                <button
                  type="button"
                  onClick={() => onSelectDivision(null)}
                  className="flex flex-col items-center gap-2.5 p-4 rounded-md border border-border bg-background transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] group"
                  data-testid="context-division-all"
                >
                  <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                    <Layers className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <span className="text-sm font-medium text-foreground text-center leading-tight group-hover:text-primary transition-colors">
                    Všetky divízie
                  </span>
                </button>
                {companyDivisions.map(cd => {
                  const divId = cd.divisionId || cd.division?.id;
                  const divName = cd.division?.name || cd.name || "Divízia";
                  const divEmoji = cd.division?.emoji || cd.emoji;
                  return (
                    <button
                      key={divId}
                      type="button"
                      onClick={() => onSelectDivision(divId)}
                      className="flex flex-col items-center gap-2.5 p-4 rounded-md border border-border bg-background transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] group"
                      data-testid={`context-division-${divId}`}
                    >
                      <div className="w-14 h-14 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {divEmoji ? (
                          <span className="text-2xl">{divEmoji}</span>
                        ) : (
                          <Layers className="w-7 h-7 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm font-medium text-foreground text-center leading-tight group-hover:text-primary transition-colors">
                        {divName}
                      </span>
                    </button>
                  );
                })}
              </div>
              {companyDivisions.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Layers className="w-8 h-8 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Žiadne divízie pre túto spoločnosť</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
