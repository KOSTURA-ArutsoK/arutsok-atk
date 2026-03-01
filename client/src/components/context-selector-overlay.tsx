import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Globe, Building2, ArrowLeft, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MyCompany, LogoEntry } from "@shared/schema";

type StateItem = { id: number; name: string; code: string; flagUrl: string | null; continentId: number };
type DivisionItem = { id: number; name: string; code: string | null; emoji?: string | null; divisionId: number; division?: { id: number; name: string; code: string | null; emoji?: string | null } };

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

function StepHeader({ icon, title, subtitle, onBack }: {
  icon: React.ReactNode;
  title: string;
  subtitle: React.ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm pb-4 pt-2 flex flex-col items-center gap-3 border-b border-border/50 mb-4">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            data-testid="button-context-back"
            className="shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        {icon}
      </div>
      <h2 className="text-2xl font-bold tracking-tight" data-testid="text-context-title">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
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

      <div className="relative z-10 flex flex-col w-full max-w-4xl mx-4 max-h-[85vh]">
        {step === "state" ? (
          <>
            <StepHeader
              icon={<Globe className="w-10 h-10 text-primary" />}
              title="Vyberte štát"
              subtitle="Zvoľte krajinu pre vašu pracovnú reláciu"
            />
            <div className="overflow-y-auto max-h-[60vh] px-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 justify-items-center">
                {[...states].sort((a, b) => a.name.localeCompare(b.name, "sk")).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onSelectState(s.id)}
                    className="flex flex-col items-center gap-3 p-4 rounded-md border border-border bg-card w-full transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] group"
                    data-testid={`context-state-${s.id}`}
                  >
                    <div className="w-20 h-20 rounded-full border-2 border-border bg-card flex items-center justify-center overflow-hidden transition-all duration-200 group-hover:border-primary">
                      <StateFlagImage src={s.flagUrl} alt={s.name} code={s.code} className="w-14 h-10 object-cover rounded-sm" />
                    </div>
                    <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors text-center">
                      {s.name}
                    </span>
                  </button>
                ))}
              </div>
              {states.length === 0 && (
                <p className="text-muted-foreground text-sm text-center py-8">Žiadne štáty k dispozícii</p>
              )}
            </div>
          </>
        ) : step === "company" ? (
          <>
            <StepHeader
              icon={<Building2 className="w-10 h-10 text-primary" />}
              title="Vyberte spoločnosť"
              subtitle={selectedState ? (
                <span className="flex items-center gap-1.5">
                  <StateFlagImage src={selectedState.flagUrl} alt="" code={selectedState.code} className="w-4 h-3 object-cover rounded-sm inline" />
                  {selectedState.name} — zvoľte spoločnosť
                </span>
              ) : "Zvoľte spoločnosť pre vašu pracovnú reláciu"}
              onBack={onBack}
            />
            <div className="overflow-y-auto max-h-[60vh] px-2">
              {filteredCompanies.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {[...filteredCompanies].sort((a, b) => a.name.localeCompare(b.name, "sk")).map(c => {
                    const logoUrl = getPrimaryLogo(c.logos as LogoEntry[] | null);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => onSelectCompany(c.id)}
                        className="flex flex-col items-center gap-3 p-4 rounded-md border border-border bg-card w-full transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] group"
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
                          <span className="text-xs text-muted-foreground text-center">{c.specialization}</span>
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
            </div>
          </>
        ) : (
          <>
            <StepHeader
              icon={<Layers className="w-10 h-10 text-primary" />}
              title="Vyberte divíziu"
              subtitle={selectedCompany ? (
                <span>{selectedCompany.name} — zvoľte divíziu</span>
              ) : "Zvoľte divíziu pre vašu pracovnú reláciu"}
              onBack={onBack}
            />
            <div className="overflow-y-auto max-h-[60vh] px-2">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                <button
                  type="button"
                  onClick={() => onSelectDivision(null)}
                  className="flex flex-col items-center gap-3 p-4 rounded-md border border-border bg-card w-full transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] group"
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
                  const divEmoji = cd.division?.emoji || cd.emoji;
                  return (
                    <button
                      key={divId}
                      type="button"
                      onClick={() => onSelectDivision(divId)}
                      className="flex flex-col items-center gap-3 p-4 rounded-md border border-border bg-card w-full transition-all duration-200 hover:border-primary hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] group"
                      data-testid={`context-division-${divId}`}
                    >
                      <div className="w-16 h-16 rounded-md bg-muted flex items-center justify-center overflow-hidden">
                        {divEmoji ? (
                          <span className="text-3xl">{divEmoji}</span>
                        ) : (
                          <Layers className="w-8 h-8 text-muted-foreground" />
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
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
