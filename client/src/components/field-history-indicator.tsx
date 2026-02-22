import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateTimeSlovak } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Clock, RotateCcw, ArrowRight, User, Loader2, Info } from "lucide-react";
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

interface FieldHistoryIndicatorProps {
  subjectId: number;
  fieldKey: string;
  fieldLabel: string;
}

export function FieldHistoryIndicator({ subjectId, fieldKey, fieldLabel }: FieldHistoryIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmRestoreId, setConfirmRestoreId] = useState<number | null>(null);
  const { toast } = useToast();

  const { data: historyKeys = [] } = useQuery<string[]>({
    queryKey: ["/api/subjects", subjectId, "field-history", "keys"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/field-history/keys`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const hasHistory = historyKeys.includes(fieldKey);

  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/subjects", subjectId, "field-history", fieldKey],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/field-history?fieldKey=${encodeURIComponent(fieldKey)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isOpen && hasHistory,
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

  if (!hasHistory) return null;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-muted transition-colors text-amber-500"
              data-testid={`btn-field-history-${fieldKey}`}
            >
              <Clock className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p>Toto pole má historické záznamy. Kliknutím zobrazíte časovú os zmien.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Clock className="w-4 h-4 text-amber-500" />
              Časová os zmien: {fieldLabel}
            </DialogTitle>
            <DialogDescription>
              Kompletná história zmien pre pole "{fieldLabel}"
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

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "relative pb-4",
                    )}
                    data-testid={`timeline-entry-${entry.id}`}
                  >
                    <div className={cn(
                      "absolute left-[-18px] top-1.5 w-3 h-3 rounded-full border-2",
                      isLatest
                        ? "bg-amber-500 border-amber-600"
                        : isRestoreEntry
                          ? "bg-blue-500 border-blue-600"
                          : "bg-muted border-muted-foreground/30"
                    )} />

                    <div className={cn(
                      "p-3 rounded-md border text-xs space-y-2",
                      isRestoreEntry
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
                            isRestoreEntry && "bg-blue-600",
                            isLatest && !isRestoreEntry && "bg-amber-600 text-white"
                          )}
                        >
                          {isRestoreEntry ? "Obnova" : isLatest ? "Aktuálna zmena" : "Zmena"}
                        </Badge>
                        <span className="text-muted-foreground">{changedDate}</span>
                        {entry.changeContext && (
                          <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-600">
                            {entry.changeContext}
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
                          <span>{entry.changedByName || 'Systém'}</span>
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

                      {entry.changeReason && (
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

interface FieldHistoryCountBadgeProps {
  subjectId: number;
  fieldKey: string;
}

export function FieldHistoryCountBadge({ subjectId, fieldKey }: FieldHistoryCountBadgeProps) {
  const { data: historyKeys = [] } = useQuery<string[]>({
    queryKey: ["/api/subjects", subjectId, "field-history", "keys"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/field-history/keys`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (!historyKeys.includes(fieldKey)) return null;

  return (
    <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/40 text-amber-600" data-testid={`badge-has-history-${fieldKey}`}>
      <Clock className="w-2.5 h-2.5 mr-0.5" />
      Verzované
    </Badge>
  );
}
