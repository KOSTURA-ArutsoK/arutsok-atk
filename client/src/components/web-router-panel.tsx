import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Globe, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

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
          className="h-8 text-sm"
          autoComplete="off"
          data-testid={`wr-picker-input-${rowId}`}
        />
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">…</span>
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
  onDelete: (id: number) => void;
  onPatch: (id: number, updates: Partial<WebRoutingRule>) => Promise<void>;
}) {
  const [state, setState] = useState<RowState>({
    apiProductSlug: rule.apiProductSlug,
    targetHoldingUid: rule.targetHoldingUid,
    statusSmerovania: rule.statusSmerovania,
    dirty: false,
    saving: false,
  });

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
    try {
      await onPatch(rule.id, {
        apiProductSlug: state.apiProductSlug,
        targetHoldingUid: state.targetHoldingUid,
        statusSmerovania: state.statusSmerovania,
      });
    } finally {
      setState(s => ({ ...s, saving: false, dirty: false }));
    }
  };

  const statusColor: Record<string, string> = {
    "Aktívne": "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
    "Neaktívne": "bg-muted text-muted-foreground border-border",
    "Test": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  };

  return (
    <div className="grid grid-cols-[30%_40%_20%_auto] gap-2 items-start py-2 px-3 border-b border-border/50 last:border-0" data-testid={`wr-row-${rule.id}`}>
      <div>
        <Input
          value={state.apiProductSlug}
          onChange={e => setState(s => ({ ...s, apiProductSlug: e.target.value, dirty: true }))}
          onBlur={saveIfDirty}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveIfDirty(); } }}
          placeholder="napr. pzp_auto"
          className="h-8 text-sm font-mono"
          data-testid={`wr-slug-${rule.id}`}
        />
      </div>
      <div>
        <SubjectPickerCell
          uid={state.targetHoldingUid}
          onChange={async (newUid) => {
            setState(s => ({ ...s, targetHoldingUid: newUid, dirty: true }));
            setState(s => ({ ...s, saving: true }));
            try {
              await onPatch(rule.id, { targetHoldingUid: newUid });
            } finally {
              setState(s => ({ ...s, saving: false, dirty: false }));
            }
          }}
          rowId={rule.id}
        />
      </div>
      <div>
        <Select
          value={state.statusSmerovania}
          onValueChange={async (val) => {
            setState(s => ({ ...s, statusSmerovania: val, dirty: true }));
            await onPatch(rule.id, { statusSmerovania: val });
            setState(s => ({ ...s, dirty: false }));
          }}
        >
          <SelectTrigger className="h-8 text-xs" data-testid={`wr-status-${rule.id}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1 pt-0.5">
        {state.saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        <button
          type="button"
          onClick={() => onDelete(rule.id)}
          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          data-testid={`wr-delete-${rule.id}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
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
      if (!res.ok) throw new Error("Save failed");
      onCreated();
    } catch {
      toast({ title: "Chyba pri ukladaní pravidla", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-[30%_40%_20%_auto] gap-2 items-start py-2 px-3 border-b border-border/50 bg-primary/5" data-testid="wr-new-row">
      <div>
        <Input
          value={state.apiProductSlug}
          onChange={e => setState(s => ({ ...s, apiProductSlug: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") onCancel(); }}
          placeholder="napr. pzp_auto"
          className="h-8 text-sm font-mono"
          autoFocus
          data-testid="wr-new-slug"
        />
      </div>
      <div>
        <SubjectPickerCell
          uid={state.targetHoldingUid}
          onChange={uid => setState(s => ({ ...s, targetHoldingUid: uid }))}
          rowId={-1}
        />
      </div>
      <div>
        <Select
          value={state.statusSmerovania}
          onValueChange={val => setState(s => ({ ...s, statusSmerovania: val }))}
        >
          <SelectTrigger className="h-8 text-xs" data-testid="wr-new-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(o => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1 pt-0.5">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <>
            <button
              type="button"
              onClick={save}
              className="text-xs text-primary hover:underline font-medium"
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

  const handlePatch = async (id: number, updates: Partial<WebRoutingRule>) => {
    const res = await apiRequest("PATCH", `/api/web-routing-rules/${id}`, updates);
    if (!res.ok) {
      toast({ title: "Chyba pri ukladaní", variant: "destructive" });
    }
    await invalidate();
  };

  const handleDelete = async (id: number) => {
    const res = await apiRequest("DELETE", `/api/web-routing-rules/${id}`, undefined);
    if (!res.ok) {
      toast({ title: "Chyba pri mazaní", variant: "destructive" });
      return;
    }
    await invalidate();
  };

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden" data-testid="web-router-panel">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Smerovník Biznisu</h3>
        <Badge variant="outline" className="ml-auto text-xs">
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
            <div className="grid grid-cols-[30%_40%_20%_auto] gap-2 px-3 py-1.5 bg-muted/20 border-b border-border/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
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
              <Globe className="h-8 w-8 mb-1 opacity-20" />
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

          <div className="px-3 py-2 border-t border-border/50">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
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
