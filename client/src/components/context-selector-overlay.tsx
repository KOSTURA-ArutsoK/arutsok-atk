import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Building2, Layers, X, ChevronRight, AlertTriangle } from "lucide-react";
import type { MyCompany, LogoEntry } from "@shared/schema";
import { Button } from "@/components/ui/button";

type StateItem = { id: number; name: string; code: string; flagUrl: string | null; continentId: number; isActive?: boolean };
type DivisionLink = { divisionId: number; division?: { id: number; name: string; code: string | null; emoji?: string | null; isActive?: boolean } };

function StateFlagImage({ src, alt, code, className }: { src: string | null | undefined; alt: string; code?: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center rounded-sm bg-muted/60 border border-border/40 ${className || "w-6 h-4"}`} title={alt} data-testid={`flag-fallback-${code || "unknown"}`}>
        <span className="text-[9px] font-bold text-muted-foreground uppercase leading-none">{code?.slice(0, 2) || "?"}</span>
      </div>
    );
  }
  return <img src={src} alt={alt} className={className || "w-6 h-4 object-cover rounded-sm"} onError={() => setFailed(true)} />;
}

function getPrimaryLogo(logos: LogoEntry[] | null | undefined): string | null {
  if (!logos || logos.length === 0) return null;
  const primary = logos.find(l => l.isPrimary && !l.isArchived);
  if (primary) return primary.url;
  return logos.find(l => !l.isArchived)?.url || null;
}

type TreeDivision = { companyDivisionId: number; divisionId: number; name: string; emoji: string | null; isActive: boolean };
type TreeCompany = { id: number; name: string; logoUrl: string | null; stateId: number; divisions: TreeDivision[] };
type TreeState = { id: number; name: string; code: string; flagUrl: string | null; companies: TreeCompany[] };

type ConfirmTarget = { stateId: number; companyId: number; divisionId: number; stateName: string; companyName: string; divisionName: string };

interface ContextSelectorOverlayProps {
  open: boolean;
  step: "state" | "company" | "division";
  states: StateItem[];
  companies: MyCompany[];
  companyDivisions: DivisionLink[];
  currentStateId: number | null;
  currentCompanyId: number | null;
  onSelectState: (stateId: number) => void;
  onSelectCompany: (companyId: number) => void;
  onSelectDivision: (divisionId: number | null) => void;
  onBack: () => void;
  onClose: () => void;
  currentContext?: { stateName?: string; companyName?: string; divisionName?: string };
  onSelectFull?: (stateId: number, companyId: number, divisionId: number) => void;
}

export function ContextSelectorOverlay({
  open,
  states,
  companies,
  onClose,
  currentStateId,
  currentCompanyId,
  onSelectState,
  onSelectCompany,
  onSelectDivision,
  currentContext,
  onSelectFull,
}: ContextSelectorOverlayProps) {
  const [divisionsByCompany, setDivisionsByCompany] = useState<Record<number, TreeDivision[]>>({});
  const [loadingDivisions, setLoadingDivisions] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [confirming, setConfirming] = useState(false);

  const loadAllDivisions = useCallback(async () => {
    if (!companies || companies.length === 0) return;
    setLoadingDivisions(true);
    try {
      const results = await Promise.all(
        companies.filter(c => !c.isDeleted).map(async c => {
          try {
            const res = await fetch(`/api/companies/${c.id}/divisions`, { credentials: "include" });
            if (!res.ok) return { companyId: c.id, divisions: [] };
            const data = await res.json();
            const divs: TreeDivision[] = data.map((d: any) => ({
              companyDivisionId: d.id,
              divisionId: d.divisionId || d.division?.id,
              name: d.division?.name || d.name || "Divízia",
              emoji: d.division?.emoji || d.emoji || null,
              isActive: d.division?.isActive !== false,
            })).filter((d: TreeDivision) => d.divisionId);
            return { companyId: c.id, divisions: divs };
          } catch {
            return { companyId: c.id, divisions: [] };
          }
        })
      );
      const map: Record<number, TreeDivision[]> = {};
      results.forEach(r => { map[r.companyId] = r.divisions; });
      setDivisionsByCompany(map);
    } finally {
      setLoadingDivisions(false);
    }
  }, [companies]);

  useEffect(() => {
    if (open) {
      loadAllDivisions();
    } else {
      setConfirmTarget(null);
      setConfirming(false);
    }
  }, [open, loadAllDivisions]);

  if (!open) return null;

  const tree: TreeState[] = [...states]
    .sort((a, b) => a.name.localeCompare(b.name, "sk"))
    .map(s => {
      const stateCompanies = companies
        .filter(c => !c.isDeleted && c.stateId === s.id)
        .sort((a, b) => a.name.localeCompare(b.name, "sk"))
        .map(c => ({
          id: c.id,
          name: c.name,
          logoUrl: getPrimaryLogo(c.logos as LogoEntry[] | null),
          stateId: s.id,
          divisions: divisionsByCompany[c.id] || [],
        }));
      return { id: s.id, name: s.name, code: s.code, flagUrl: s.flagUrl, companies: stateCompanies };
    });

  function handleDivisionClick(state: TreeState, company: TreeCompany, division: TreeDivision) {
    setConfirmTarget({
      stateId: state.id,
      companyId: company.id,
      divisionId: division.divisionId,
      stateName: state.name,
      companyName: company.name,
      divisionName: division.name,
    });
  }

  async function handleConfirm() {
    if (!confirmTarget) return;
    setConfirming(true);
    try {
      if (onSelectFull) {
        onSelectFull(confirmTarget.stateId, confirmTarget.companyId, confirmTarget.divisionId);
      } else {
        if (confirmTarget.stateId !== currentStateId) {
          await new Promise<void>(resolve => {
            onSelectState(confirmTarget.stateId);
            setTimeout(resolve, 300);
          });
        }
        if (confirmTarget.companyId !== currentCompanyId) {
          await new Promise<void>(resolve => {
            onSelectCompany(confirmTarget.companyId);
            setTimeout(resolve, 300);
          });
        }
        onSelectDivision(confirmTarget.divisionId);
      }
      onClose();
    } finally {
      setConfirming(false);
      setConfirmTarget(null);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-end" data-testid="context-selector-overlay">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} data-testid="context-overlay-backdrop" />

      <div className="relative z-10 flex flex-col h-full w-full max-w-sm bg-background border-l border-border shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold tracking-wide uppercase text-foreground">Zmena kontextu</span>
            {currentContext?.divisionName && (
              <span className="text-xs text-muted-foreground truncate max-w-[220px]">
                Aktívne: {currentContext.stateName} / {currentContext.companyName} / {currentContext.divisionName}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-colors" data-testid="button-context-close">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {confirmTarget ? (
          <div className="flex flex-col gap-4 p-5 flex-1">
            <div className="flex items-start gap-3 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-foreground">
                <span className="font-semibold">Potvrdenie zmeny kontextu</span>
                <p className="text-muted-foreground mt-1 text-xs">
                  Táto zmena ovplyvní zobrazované dáta v celej aplikácii a bude zaznamenaná v auditnom logu.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Nový kontext</span>
                <div className="p-3 rounded-md border border-border bg-muted/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-sm bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    </div>
                    <span className="text-sm font-bold text-foreground">{confirmTarget.stateName}</span>
                  </div>
                  <div className="flex items-center gap-2 pl-3">
                    <Building2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm text-muted-foreground">{confirmTarget.companyName}</span>
                  </div>
                  <div className="flex items-center gap-2 pl-6">
                    <Layers className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium text-foreground">{confirmTarget.divisionName}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-auto">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setConfirmTarget(null)} disabled={confirming} data-testid="button-context-confirm-cancel">
                Zrušiť
              </Button>
              <Button type="button" className="flex-1" onClick={handleConfirm} disabled={confirming} data-testid="button-context-confirm-ok">
                {confirming ? "Mením..." : "Potvrdiť"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {loadingDivisions && (
              <div className="flex items-center justify-center py-4">
                <span className="text-xs text-muted-foreground animate-pulse">Načítavam štruktúru...</span>
              </div>
            )}

            {tree.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-10 px-4 text-center">
                <Layers className="w-7 h-7 text-muted-foreground/50" />
                <span className="text-sm text-muted-foreground">Žiadne štáty k dispozícii</span>
              </div>
            )}

            {tree.map((state, si) => (
              <div key={state.id} className={si > 0 ? "border-t border-border/60" : ""}>
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/30 sticky top-0 z-10" data-testid={`context-state-${state.id}`}>
                  <StateFlagImage src={state.flagUrl} alt={state.name} code={state.code} className="w-7 h-[18px] object-cover rounded-sm border border-border/40 flex-shrink-0" />
                  <span className="text-sm font-bold tracking-wide text-foreground uppercase">{state.name}</span>
                </div>

                {state.companies.length === 0 && (
                  <div className="flex items-center gap-2 pl-8 pr-4 py-2 text-xs text-muted-foreground/60 italic">
                    Žiadne spoločnosti
                  </div>
                )}

                {state.companies.map((company, ci) => (
                  <div key={company.id}>
                    <div className="relative flex items-center gap-2 pl-4 pr-4 py-2 bg-background/60">
                      <div className="absolute left-4 top-0 bottom-0 flex flex-col items-center pointer-events-none select-none" aria-hidden>
                        <div className="w-px flex-1 bg-border/40" style={{ marginTop: 0, marginBottom: ci === state.companies.length - 1 ? "50%" : 0 }} />
                      </div>
                      <div className="relative ml-3 flex items-center gap-0 flex-shrink-0 self-center" style={{ marginTop: "-2px" }}>
                        <div className="w-3 h-px bg-border/40" />
                        <div className="w-6 h-6 rounded-sm bg-muted/60 border border-border/30 flex items-center justify-center overflow-hidden flex-shrink-0" data-testid={`context-company-${company.id}`}>
                          {company.logoUrl
                            ? <img src={company.logoUrl} alt={company.name} className="w-full h-full object-contain p-0.5" />
                            : <Building2 className="w-3 h-3 text-muted-foreground/60" />
                          }
                        </div>
                      </div>
                      <span className="text-[13px] font-semibold text-muted-foreground leading-tight">{company.name}</span>
                    </div>

                    {company.divisions.length === 0 && !loadingDivisions && (
                      <div className="flex items-center gap-2 pl-12 pr-4 py-1.5 text-xs text-muted-foreground/50 italic">
                        Žiadne divízie
                      </div>
                    )}

                    {company.divisions.map((div, di) => {
                      const isLast = di === company.divisions.length - 1;
                      const isInactive = !div.isActive;
                      return (
                        <button
                          key={div.divisionId}
                          type="button"
                          onClick={() => !isInactive && handleDivisionClick(state, company, div)}
                          disabled={isInactive}
                          className={`relative w-full flex items-center gap-2 pl-4 pr-4 py-2 text-left transition-colors border-b border-border/20 last:border-b-0
                            ${isInactive ? "opacity-40 cursor-not-allowed" : "hover:bg-blue-500/8 dark:hover:bg-blue-400/8 cursor-pointer group"}`}
                          data-testid={`context-division-${div.divisionId}`}
                        >
                          <div className="absolute left-4 top-0 flex flex-col items-center pointer-events-none select-none" aria-hidden style={{ height: "50%" }}>
                            <div className="w-px h-full bg-border/40" />
                          </div>
                          <div className="relative ml-7 flex items-center gap-0 flex-shrink-0 self-center" style={{ marginTop: "-2px" }}>
                            <div className="w-3 h-px bg-border/40" />
                            <div className={`w-5 h-5 rounded-sm flex items-center justify-center flex-shrink-0 bg-muted/40 border border-border/20 ${!isInactive ? "group-hover:border-blue-400/50 group-hover:bg-blue-400/10 transition-colors" : ""}`}>
                              {div.emoji
                                ? <span className="text-[11px] leading-none">{div.emoji}</span>
                                : <Layers className="w-2.5 h-2.5 text-muted-foreground/50" />
                              }
                            </div>
                          </div>
                          <span className={`text-[12px] leading-tight flex-1 ${!isInactive ? "text-muted-foreground group-hover:text-foreground transition-colors" : "text-muted-foreground/50"}`}>
                            {div.name}
                          </span>
                          {!isInactive && (
                            <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
