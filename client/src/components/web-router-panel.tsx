import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, Plus, Route, Loader2, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type WebRoutingRule = {
  id: number;
  subjectId: number;
  apiProductSlug: string;
  targetHoldingUid: string;
  statusSmerovania: string;
  sortOrder: number;
};

type SubjectResult = { id: number; uid: string; displayName: string };

const STATUS_OPTIONS = ["Aktívne", "Neaktívne", "Test"];

function handleApiError(status: number, toast: ReturnType<typeof useToast>["toast"]) {
  if (status === 409) {
    toast({ title: "Kód produktu je už použitý pre tento web.", variant: "destructive" });
  } else if (status === 422) {
    toast({ title: "Cieľový subjekt s týmto UID neexistuje.", variant: "destructive" });
  } else {
    toast({ title: "Chyba pri ukladaní pravidla", variant: "destructive" });
  }
}

function SubjectPickerCell({
  uid,
  onChange,
  disabled,
  rowId,
}: {
  uid: string;
  onChange: (newUid: string) => void;
  disabled?: boolean;
  rowId: number;
}) {
  const [editing, setEditing] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [results, setResults] = useState<SubjectResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: picked } = useQuery<{ displayName: string; uid: string }>({
    queryKey: ["/api/subjects/by-uid", uid],
    enabled: !!uid && !editing,
  });

  useEffect(() => {
    if (!editing || !searchText || searchText.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/subjects/search?q=${encodeURIComponent(searchText)}`);
        const data = await res.json();
        const mapped = (data as any[]).map(s => ({
          id: s.id,
          uid: s.uid || "",
          displayName: s.companyName || [s.firstName, s.lastName].filter(Boolean).join(" ") || s.uid || "—",
        }));
        setResults(mapped);
        setOpen(mapped.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchText, editing]);

  if (uid && !editing) {
    return (
      <div className="flex items-center gap-2 h-8 px-2 rounded border border-border bg-muted/30 text-sm min-w-0" data-testid={`wr-picker-display-${rowId}`}>
        <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
        <span className="flex-1 truncate text-foreground">{picked?.displayName || uid}</span>
        <span className="text-[10px] font-mono text-muted-foreground shrink-0 hidden sm:block">{uid}</span>
        {!disabled && (
          <button
            type="button"
            onClick={() => { setEditing(true); setSearchText(""); setResults([]); setOpen(false); }}
            className="text-xs text-primary hover:underline shrink-0"
            data-testid={`wr-picker-change-${rowId}`}
          >
            Zmeniť
          </button>
        )}
      </div>
    );
  }

  if (disabled) {
    return (
      <div className="flex items-center h-8 px-2 text-sm text-muted-foreground italic">—</div>
    );
  }

  return (
    <div ref={containerRef} className="relative" data-testid={`wr-picker-container-${rowId}`}>
      <div className="relative">
        <Input
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          onFocus={() => { if (searchText.length >= 2) setOpen(true); }}
          onBlur={() => { setTimeout(() => setOpen(false), 180); }}
          placeholder="Vyhľadajte subjekt..."
          className="h-8 text-sm pl-8"
          autoComplete="off"
          data-testid={`wr-picker-input-${rowId}`}
        />
        <Building2 className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-blue-600 pointer-events-none" />
        {loading && (
          <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
          {results.map(s => (
            <button
              key={s.id}
              type="button"
              onMouseDown={e => {
                e.preventDefault();
                onChange(s.uid);
                setEditing(false);
                setSearchText("");
                setResults([]);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
              data-testid={`wr-picker-option-${rowId}-${s.id}`}
            >
              <Building2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span className="flex-1 truncate">{s.displayName}</span>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0">{s.uid}</span>
            </button>
          ))}
        </div>
      )}
      {uid && (
        <button
          type="button"
          onClick={() => { setEditing(false); setSearchText(""); setResults([]); setOpen(false); }}
          className="mt-1 text-xs text-muted-foreground hover:underline"
          data-testid={`wr-picker-cancel-${rowId}`}
        >
          Zrušiť
        </button>
      )}
    </div>
  );
}

type RowState = {
  apiProductSlug: string;
  targetHoldingUid: string;
  statusSmerovania: string;
  dirty: boolean;
  saving: boolean;
};

function RuleRow({
  rule,
  onDelete,
  onPatch,
}: {
  rule: WebRoutingRule;
  onDelete: (id: number) => Promise<void>;
  onPatch: (id: number, updates: Partial<WebRoutingRule>) => Promise<{ ok: boolean; status: number }>;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<RowState>({
    apiProductSlug: rule.apiProductSlug,
    targetHoldingUid: rule.targetHoldingUid,
    statusSmerovania: rule.statusSmerovania,
    dirty: false,
    saving: false,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setState({
      apiProductSlug: rule.apiProductSlug,
      targetHoldingUid: rule.targetHoldingUid,
      statusSmerovania: rule.statusSmerovania,
      dirty: false,
      saving: false,
    });
  }, [rule.apiProductSlug, rule.targetHoldingUid, rule.statusSmerovania]);

  const saveIfDirty = async () => {
    if (!state.dirty) return;
    setState(s => ({ ...s, saving: true }));
    const result = await onPatch(rule.id, {
      apiProductSlug: state.apiProductSlug,
      targetHoldingUid: state.targetHoldingUid,
      statusSmerovania: state.statusSmerovania,
    });
    if (!result.ok) {
      handleApiError(result.status, toast);
      setState(s => ({ ...s, saving: false }));
    } else {
      setState(s => ({ ...s, saving: false, dirty: false }));
    }
  };

  const statusColor: Record<string, string> = {
    "Aktívne": "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
    "Neaktívne": "bg-muted text-muted-foreground border-border",
    "Test": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  };

  return (
    <>
      <div className="grid grid-cols-[30%_40%_20%_auto] gap-2 items-start py-2 px-3 border-b border-border/50 last:border-0 w-full" data-testid={`wr-row-${rule.id}`}>
        <div className="w-full">
          <Input
            value={state.apiProductSlug}
            onChange={e => setState(s => ({ ...s, apiProductSlug: e.target.value, dirty: true }))}
            onBlur={saveIfDirty}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveIfDirty(); } }}
            placeholder="napr. pzp_auto"
            className="h-8 text-sm font-mono w-full"
            data-testid={`wr-slug-${rule.id}`}
          />
        </div>
        <div className="w-full">
          <SubjectPickerCell
            uid={state.targetHoldingUid}
            onChange={async (newUid) => {
              setState(s => ({ ...s, targetHoldingUid: newUid, dirty: true, saving: true }));
              const result = await onPatch(rule.id, { targetHoldingUid: newUid });
              if (!result.ok) {
                handleApiError(result.status, toast);
                setState(s => ({ ...s, saving: false }));
              } else {
                setState(s => ({ ...s, saving: false, dirty: false }));
              }
            }}
            rowId={rule.id}
          />
        </div>
        <div className="w-full">
          <Select
            value={state.statusSmerovania}
            onValueChange={async (val) => {
              setState(s => ({ ...s, statusSmerovania: val, dirty: true }));
              const result = await onPatch(rule.id, { statusSmerovania: val });
              if (!result.ok) {
                handleApiError(result.status, toast);
              } else {
                setState(s => ({ ...s, dirty: false }));
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs w-full" data-testid={`wr-status-${rule.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(o => (
                <SelectItem key={o} value={o}>{o}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1 pt-0.5 justify-end">
          {state.saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            data-testid={`wr-delete-${rule.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Odstrániť smerovanie?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete odstrániť pravidlo <strong>{rule.apiProductSlug}</strong>? Akcia je nevratná.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`wr-delete-cancel-${rule.id}`}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setDeleteOpen(false);
                await onDelete(rule.id);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid={`wr-delete-confirm-${rule.id}`}
            >
              Odstrániť
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type NewRowState = {
  apiProductSlug: string;
  targetHoldingUid: string;
  statusSmerovania: string;
};

function NewRuleRow({
  subjectId,
  onCreated,
  onCancel,
}: {
  subjectId: number;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [state, setState] = useState<NewRowState>({
    apiProductSlug: "",
    targetHoldingUid: "",
    statusSmerovania: "Aktívne",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!state.apiProductSlug.trim()) {
      toast({ title: "API Product Slug je povinný", variant: "destructive" });
      return;
    }
    if (!state.targetHoldingUid) {
      toast({ title: "Cieľová spoločnosť je povinná", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("POST", `/api/subjects/${subjectId}/web-routing-rules`, {
        apiProductSlug: state.apiProductSlug.trim(),
        targetHoldingUid: state.targetHoldingUid,
        statusSmerovania: state.statusSmerovania,
        sortOrder: 0,
      });
      if (!res.ok) {
        handleApiError(res.status, toast);
        return;
      }
      onCreated();
    } catch {
      toast({ title: "Chyba pri ukladaní pravidla", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-[30%_40%_20%_auto] gap-2 items-start py-2 px-3 border-b border-border/50 bg-emerald-500/5 w-full" data-testid="wr-new-row">
      <div className="w-full">
        <Input
          value={state.apiProductSlug}
          onChange={e => setState(s => ({ ...s, apiProductSlug: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") onCancel(); }}
          placeholder="napr. pzp_auto"
          className="h-8 text-sm font-mono w-full"
          autoFocus
          data-testid="wr-new-slug"
        />
      </div>
      <div className="w-full">
        <SubjectPickerCell
          uid={state.targetHoldingUid}
          onChange={uid => setState(s => ({ ...s, targetHoldingUid: uid }))}
          rowId={-1}
        />
      </div>
      <div className="w-full">
        <Select
          value={state.statusSmerovania}
          onValueChange={val => setState(s => ({ ...s, statusSmerovania: val }))}
        >
          <SelectTrigger className="h-8 text-xs w-full" data-testid="wr-new-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1 pt-0.5 justify-end">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <button
              type="button"
              onClick={save}
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
              data-testid="wr-new-save"
            >
              Uložiť
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-muted-foreground hover:underline"
              data-testid="wr-new-cancel"
            >
              Zrušiť
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function WebRouterPanel({ subjectId }: { subjectId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: rules, isLoading } = useQuery<WebRoutingRule[]>({
    queryKey: ["/api/subjects", subjectId, "web-routing-rules"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/web-routing-rules`);
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "web-routing-rules"] });

  const handlePatch = async (id: number, updates: Partial<WebRoutingRule>): Promise<{ ok: boolean; status: number }> => {
    const res = await apiRequest("PATCH", `/api/web-routing-rules/${id}`, updates);
    if (res.ok) await invalidate();
    return { ok: res.ok, status: res.status };
  };

  const handleDelete = async (id: number) => {
    const res = await apiRequest("DELETE", `/api/web-routing-rules/${id}`, undefined);
    if (!res.ok) {
      toast({ title: "Chyba pri mazaní pravidla", variant: "destructive" });
      return;
    }
    await invalidate();
  };

  return (
    <div className="rounded-lg border-2 border-emerald-500/60 bg-slate-50 dark:bg-slate-900/30 overflow-hidden" data-testid="web-router-panel">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-emerald-500/30 bg-emerald-500/5">
        <Route className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Smerovník Biznisu</h3>
        <Badge variant="outline" className="ml-auto text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400">
          {isLoading ? "…" : (rules?.length ?? 0)} pravidiel
        </Badge>
      </div>

      {isLoading ? (
        <div className="p-3 space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (
        <>
          {(rules && rules.length > 0) || adding ? (
            <div className="grid grid-cols-[30%_40%_20%_auto] gap-2 px-3 py-1.5 bg-emerald-500/5 border-b border-emerald-500/20 text-[10px] font-semibold text-emerald-700 dark:text-emerald-500 uppercase tracking-wide w-full">
              <span>API Product Slug</span>
              <span>Cieľová spoločnosť</span>
              <span>Stav</span>
              <span></span>
            </div>
          ) : null}

          {rules && rules.length > 0 ? (
            rules.map(rule => (
              <RuleRow
                key={rule.id}
                rule={rule}
                onDelete={handleDelete}
                onPatch={handlePatch}
              />
            ))
          ) : !adding ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-muted-foreground gap-1" data-testid="wr-empty">
              <Route className="h-8 w-8 mb-1 opacity-20 text-emerald-600" />
              <span>Žiadne smerovanie</span>
              <span className="text-xs">Pridajte prvé pravidlo tlačidlom nižšie</span>
            </div>
          ) : null}

          {adding && (
            <NewRuleRow
              subjectId={subjectId}
              onCreated={() => { setAdding(false); invalidate(); }}
              onCancel={() => setAdding(false)}
            />
          )}

          <div className="px-3 py-2 border-t border-emerald-500/20">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => setAdding(true)}
              disabled={adding}
              data-testid="wr-add-button"
            >
              <Plus className="h-3.5 w-3.5" />
              Pridať pravidlo
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
