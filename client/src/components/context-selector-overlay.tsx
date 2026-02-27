import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Globe, Building2, ArrowLeft, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MyCompany, LogoEntry } from "@shared/schema";

type StateItem = { id: number; name: string; code: string; flagUrl: string | null; continentId: number };
type DivisionItem = { id: number; name: string; code: string | null; divisionId: number };

function StateFlagImage({ src, alt, code, className }: { src: string | null | undefined; alt: string; code?: string; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-full bg-muted border border-border ${className || "w-16 h-12"}`}
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
      className={className || "w-16 h-12 object-cover rounded-sm"}
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
      className={`fixed inset-0 z-[9998] flex items-center justify-center transition-opacity duration-300 ${animating ? "opacity-0" : "opacity-100"}`}
      data-testid="context-selector-overlay"
    >
      <div className="absolute inset-0 bg-background/70 backdrop-blur-xl" />

      <div className="relative z-10 flex flex-col items-center gap-6 max-w-3xl w-full px-6">
        {step === "state" ? (
          <>
            <Globe className="w-10 h-10 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight" data-testid="text-context-title">
              Vyberte stat
            </h2>
            <p className="text-sm text-muted-foreground">
              Zvolte krajinu pre vasu pracovnu relaciu
            </p>

            <div className="flex flex-wrap justify-center gap-6 mt-4">
              {[...states].sort((a, b) => a.name.localeCompare(b.name, "sk")).map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSelectState(s.id)}
                  className="flex flex-col items-center gap-3 group"
                  data-testid={`context-state-${s.id}`}
                >
                  <div className="w-24 h-24 rounded-full border-2 border-border bg-card flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:border-primary group-hover:shadow-lg group-hover:shadow-primary/20 group-hover:scale-105">
                    <StateFlagImage src={s.flagUrl} alt={s.name} code={s.code} className="w-16 h-12 object-cover rounded-sm" />
                  </div>
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                    {s.name}
                  </span>
                </button>
              ))}
              {states.length === 0 && (
                <p className="text-muted-foreground text-sm">Ziadne staty k dispozicii</p>
              )}
            </div>
          </>
        ) : step === "company" ? (
          <>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                data-testid="button-context-back"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Building2 className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight" data-testid="text-context-title">
              Vyberte spolocnost
            </h2>
            <p className="text-sm text-muted-foreground">
              {selectedState ? (
                <span className="flex items-center gap-1.5">
                  <StateFlagImage src={selectedState.flagUrl} alt="" code={selectedState.code} className="w-4 h-3 object-cover rounded-sm inline" />
                  {selectedState.name} &mdash; zvolte spolocnost
                </span>
              ) : "Zvolte spolocnost pre vasu pracovnu relaciu"}
            </p>

            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {[...filteredCompanies].sort((a, b) => a.name.localeCompare(b.name, "sk")).map(c => {
                const logoUrl = getPrimaryLogo(c.logos as LogoEntry[] | null);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelectCompany(c.id)}
                    className="flex flex-col items-center gap-3 p-5 rounded-md border border-border bg-card min-w-[160px] max-w-[200px] transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] group"
                    data-testid={`context-company-${c.id}`}
                  >
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                      {logoUrl ? (
                        <img src={logoUrl} alt={c.name} className="w-full h-full object-contain p-1" />
                      ) : (
                        <Building2 className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-sm font-medium text-foreground text-center leading-tight group-hover:text-primary transition-colors">
                      {c.name}
                    </span>
                    {c.specialization && (
                      <span className="text-xs text-muted-foreground">{c.specialization}</span>
                    )}
                  </button>
                );
              })}
              {filteredCompanies.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Ziadne spolocnosti pre tento stat</p>
                  <Button variant="outline" size="sm" onClick={onBack} data-testid="button-context-back-empty">
                    Zmenit stat
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onBack}
                data-testid="button-context-back-division"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <Layers className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight" data-testid="text-context-title">
              Vyberte divíziu
            </h2>
            <p className="text-sm text-muted-foreground">
              {selectedCompany ? (
                <span>{selectedCompany.name} &mdash; zvolte divíziu</span>
              ) : "Zvolte divíziu pre vasu pracovnu relaciu"}
            </p>

            <div className="flex flex-wrap justify-center gap-4 mt-4">
              <button
                type="button"
                onClick={() => onSelectDivision(null)}
                className="flex flex-col items-center gap-3 p-5 rounded-md border border-border bg-card min-w-[160px] max-w-[200px] transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] group"
                data-testid="context-division-all"
              >
                <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                  <Layers className="w-8 h-8 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium text-foreground text-center leading-tight group-hover:text-primary transition-colors">
                  Všetky divízie
                </span>
              </button>
              {companyDivisions.map(cd => {
                const divId = cd.divisionId || cd.division?.id;
                const divName = cd.division?.name || cd.name || "Divízia";
                return (
                  <button
                    key={divId}
                    type="button"
                    onClick={() => onSelectDivision(divId)}
                    className="flex flex-col items-center gap-3 p-5 rounded-md border border-border bg-card min-w-[160px] max-w-[200px] transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] group"
                    data-testid={`context-division-${divId}`}
                  >
                    <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                      <Layers className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium text-foreground text-center leading-tight group-hover:text-primary transition-colors">
                      {divName}
                    </span>
                  </button>
                );
              })}
              {companyDivisions.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8">
                  <Layers className="w-8 h-8 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">Ziadne divízie pre túto spolocnost</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
