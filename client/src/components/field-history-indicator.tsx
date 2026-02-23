import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateTimeSlovak } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { RotateCcw, ArrowRight, User, Loader2, Info, Camera, Ban, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const EVIDENCE_STATUS_VALUES = ["zaniknuta", "v_likvidacii", "Zaniknutá", "V likvidácii"];

interface FieldHistoryIndicatorProps {
  subjectId: number;
  fieldKey: string;
  fieldLabel: string;
  inline?: boolean;
}

export function FieldHistoryIndicator({ subjectId, fieldKey, fieldLabel, inline = false }: FieldHistoryIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<number | null>(null);
  const [evidenceViewId, setEvidenceViewId] = useState<number | null>(null);
  const { toast } = useToast();

  const isLifecycleField = fieldKey === "lifecycle_status";

  const { data: historyCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ["/api/subjects", subjectId, "field-history", "counts"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/field-history/counts`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const versionCount = historyCounts[fieldKey] || 0;
  const hasHistory = versionCount > 0;

  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/subjects", subjectId, "field-history", fieldKey],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/field-history?fieldKey=${encodeURIComponent(fieldKey)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isOpen && hasHistory,
  });

  const { data: statusEvidenceList = [] } = useQuery<any[]>({
    queryKey: ["/api/subjects", subjectId, "status-evidence"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/status-evidence`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen && isLifecycleField,
  });

  const { data: viewingEvidence } = useQuery<any>({
    queryKey: ["/api/status-evidence", evidenceViewId],
    queryFn: async () => {
      const res = await fetch(`/api/status-evidence/${evidenceViewId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: evidenceViewId !== null,
  });

  const restoreMutation = useMutation({
    mutationFn: async (historyEntryId: number) => {
      const res = await apiRequest("POST", `/api/subjects/${subjectId}/field-history/restore`, { historyEntryId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Hodnota obnovená", description: `Pole '${fieldLabel}' bolo obnovené na predchádzajúcu hodnotu` });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "field-history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      setConfirmRestoreId(null);
    },
    onError: () => {
      toast({ title: "Chyba pri obnove hodnoty", variant: "destructive" });
    },
  });

  const getEvidenceForEntry = (entry: any) => {
    if (!isLifecycleField) return null;
    return statusEvidenceList.find((ev: any) => ev.fieldHistoryId === entry.id) || null;
  };

  if (!hasHistory) return null;

  const triggerButton = inline ? (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(true); }}
      className="absolute right-2 top-1/2 -translate-y-1/2 z-10 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
      data-testid={`btn-field-history-${fieldKey}`}
    >
      <span className="text-xs">🕰️</span>
      <span>{versionCount}</span>
    </button>
  ) : (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
      className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium text-amber-500 hover:bg-amber-500/10 transition-colors cursor-pointer"
      data-testid={`btn-field-history-${fieldKey}`}
    >
      <span className="text-xs">🕰️</span>
      <span>{versionCount}</span>
    </button>
  );

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {triggerButton}
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p>{versionCount} {versionCount === 1 ? 'zmena' : versionCount < 5 ? 'zmeny' : 'zmien'} v histórii. Kliknutím zobrazíte časovú os.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <span>🕰️</span>
              Stroj času: {fieldLabel}
            </DialogTitle>
            <DialogDescription>
              {versionCount} {versionCount === 1 ? 'záznam' : versionCount < 5 ? 'záznamy' : 'záznamov'} v histórii zmien
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Žiadne záznamy</p>
          ) : (
            <div className="relative pl-6 space-y-0" data-testid="field-history-timeline">
              <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
              {history.map((entry: any, idx: number) => {
                const isRestoreEntry = entry.isRestore;
                const changedDate = entry.changedAt ? formatDateTimeSlovak(entry.changedAt) : '-';
                const isLatest = idx === 0;
                const sourceLabel = entry.changeContext === "AI" ? "AI" : entry.changeContext === "import" ? "Import" : "Manuálne";
                const evidence = getEvidenceForEntry(entry);
                const isEvidenceBacked = evidence !== null;
                const isArutsoKVerified = entry.changeReason?.includes("ArutsoK") || isEvidenceBacked;

                return (
                  <div
                    key={entry.id}
                    className="relative pb-4"
                    data-testid={`timeline-entry-${entry.id}`}
                  >
                    <div className={cn(
                      "absolute left-[-18px] top-1.5 w-3 h-3 rounded-full border-2",
                      isEvidenceBacked
                        ? "bg-red-500 border-red-600"
                        : isLatest
                          ? "bg-amber-500 border-amber-600"
                          : isRestoreEntry
                            ? "bg-blue-500 border-blue-600"
                            : "bg-muted border-muted-foreground/30"
                    )} />

                    <div className={cn(
                      "p-3 rounded-md border text-xs space-y-2",
                      isEvidenceBacked
                        ? "border-red-500/40 bg-red-500/5"
                        : isRestoreEntry
                          ? "border-blue-500/40 bg-blue-500/5"
                          : isLatest
                            ? "border-amber-500/40 bg-amber-500/5"
                            : "border-border bg-muted/20"
                    )}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant={isRestoreEntry ? "default" : "secondary"}
                          className={cn(
                            "text-[10px]",
                            isEvidenceBacked && "bg-red-600 text-white",
                            isRestoreEntry && !isEvidenceBacked && "bg-blue-600",
                            isLatest && !isRestoreEntry && !isEvidenceBacked && "bg-amber-600 text-white"
                          )}
                        >
                          {isEvidenceBacked ? (
                            <span className="flex items-center gap-1">
                              <Ban className="w-3 h-3" />
                              Zánik/Likvidácia
                            </span>
                          ) : isRestoreEntry ? "Obnova" : isLatest ? "Aktuálna zmena" : "Zmena"}
                        </Badge>
                        <span className="text-muted-foreground">{changedDate}</span>
                        <Badge variant="outline" className={cn(
                          "text-[10px]",
                          sourceLabel === "AI" ? "border-purple-500/40 text-purple-500" :
                          sourceLabel === "Import" ? "border-cyan-500/40 text-cyan-600" :
                          "border-muted-foreground/30 text-muted-foreground"
                        )}>
                          {sourceLabel}
                        </Badge>
                        {isEvidenceBacked && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-400 flex items-center gap-0.5" data-testid={`evidence-badge-${entry.id}`}>
                            <Camera className="w-3 h-3" />
                            Dôkaz
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground line-through">{entry.oldValue || '(prázdne)'}</span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-medium text-foreground">{entry.newValue || '(prázdne)'}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <User className="w-3 h-3" />
                          <span>{isArutsoKVerified ? "ArutsoK" : entry.changedByName || 'Systém'}</span>
                        </div>
                        {!isLatest && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] text-blue-600 hover:text-blue-700"
                            onClick={() => setConfirmRestoreId(entry.id)}
                            data-testid={`btn-restore-${entry.id}`}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Obnoviť túto hodnotu
                          </Button>
                        )}
                      </div>

                      {isArutsoKVerified && (
                        <div className="flex items-start gap-1.5 text-purple-400 pt-1 border-t border-purple-500/20" data-testid={`arutsok-author-${entry.id}`}>
                          <Info className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="italic text-[10px]">Zmenu statusu overil a zdokumentoval: <strong>ArutsoK</strong></span>
                        </div>
                      )}

                      {isEvidenceBacked && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] text-amber-400 border-amber-500/30 hover:bg-amber-500/10 w-full justify-center gap-1.5"
                          onClick={() => setEvidenceViewId(evidence.id)}
                          data-testid={`btn-view-evidence-${entry.id}`}
                        >
                          <Camera className="w-3 h-3" />
                          Zobraziť dôkaz z {evidence.registryType === "orsr" ? "ORSR" : "ŽRSR"}
                          <ExternalLink className="w-3 h-3 ml-1" />
                        </Button>
                      )}

                      {entry.changeReason && !isArutsoKVerified && (
                        <div className="flex items-start gap-1.5 text-muted-foreground pt-1 border-t border-border/50">
                          <Info className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="italic">{entry.changeReason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={evidenceViewId !== null} onOpenChange={(open) => { if (!open) setEvidenceViewId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="evidence-viewer-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="w-5 h-5 text-amber-400" />
              Dôkazný materiál – {viewingEvidence?.registryType === "orsr" ? "ORSR" : "ŽRSR"}
            </DialogTitle>
            <DialogDescription>
              Automatický záznam z overenia statusu subjektu
            </DialogDescription>
          </DialogHeader>
          {viewingEvidence ? (
            <div className="space-y-4">
              <div className="rounded-lg border-2 border-slate-700 bg-[#0a0e17] p-6 space-y-4" data-testid="evidence-document">
                <div className="flex justify-between items-center pb-4 border-b border-slate-700">
                  <div>
                    <h3 className="text-amber-400 font-semibold text-sm flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Dôkazný materiál – {viewingEvidence.registryType === "orsr" ? "Obchodný register SR (ORSR)" : "Živnostenský register SR (ŽRSR)"}
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1">Automatický záznam z overenia statusu</p>
                  </div>
                  <Badge className="bg-purple-600 text-white text-[10px]">ArutsoK v1.0</Badge>
                </div>
                {viewingEvidence.metadata && (
                  <div className="space-y-2 text-xs" data-testid="evidence-metadata">
                    <div className="flex gap-2"><span className="text-slate-400 w-32 shrink-0">Subjekt:</span><span className="font-semibold text-slate-200">{viewingEvidence.metadata.subjectName}</span></div>
                    <div className="flex gap-2"><span className="text-slate-400 w-32 shrink-0">IČO:</span><span className="text-slate-200">{viewingEvidence.metadata.ico || "–"}</span></div>
                    <div className="flex gap-2"><span className="text-slate-400 w-32 shrink-0">Register:</span><span className="text-slate-200">{viewingEvidence.registryType === "orsr" ? "Obchodný register SR (ORSR)" : "Živnostenský register SR (ŽRSR)"}</span></div>
                    <div className="flex gap-2"><span className="text-slate-400 w-32 shrink-0">URL registra:</span><span className="text-blue-400">{viewingEvidence.metadata.registryUrl || "–"}</span></div>
                    <div className={cn("flex gap-2 p-2 rounded", viewingEvidence.lifecycleStatus === "zaniknuta" ? "bg-red-500/10" : "bg-amber-500/10")}>
                      <span className="text-slate-400 w-32 shrink-0">Zistený status:</span>
                      <span className={cn("font-bold flex items-center gap-1", viewingEvidence.lifecycleStatus === "zaniknuta" ? "text-red-400" : "text-amber-400")}>
                        <Ban className="w-3 h-3" />
                        {viewingEvidence.metadata.statusFound}
                      </span>
                    </div>
                    <div className="flex gap-2"><span className="text-slate-400 w-32 shrink-0">Dátum overenia:</span><span className="text-slate-200">{viewingEvidence.capturedAt ? formatDateTimeSlovak(viewingEvidence.capturedAt) : "-"}</span></div>
                  </div>
                )}
                <div className="pt-4 border-t border-slate-700 flex justify-between items-center">
                  <p className="text-[10px] text-slate-500">Zmenu statusu overil a zdokumentoval: <strong className="text-purple-400">{viewingEvidence.verifiedByName}</strong></p>
                  <p className="text-[9px] text-slate-600">ID: {viewingEvidence.subjectId}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmRestoreId !== null} onOpenChange={(open) => { if (!open) setConfirmRestoreId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obnoviť hodnotu?</AlertDialogTitle>
            <AlertDialogDescription>
              Táto akcia obnoví hodnotu poľa "{fieldLabel}" na predchádzajúcu verziu. 
              Aktuálna hodnota bude zaznamenaná v histórii.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (confirmRestoreId) restoreMutation.mutate(confirmRestoreId); }}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Obnoviť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
