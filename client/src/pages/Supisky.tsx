import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateSlovak } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import type { Supiska } from "@shared/schema";
import { Plus, Printer, Loader2, Send, Undo2, FileSpreadsheet, FileDown, Lock, X, ChevronDown, Search, Hash } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProcessingSaveButton } from "@/components/processing-save-button";

const SUPISKY_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "supId", label: "SUP ID", type: "text" },
  { key: "name", label: "Nazov", type: "text" },
  { key: "status", label: "Stav", type: "text" },
  { key: "createdAt", label: "Vytvorene", type: "date" },
  { key: "createdBy", label: "Vytvoril", type: "text" },
];

const SUPISKY_COLUMNS: ColumnDef[] = [
  { key: "supId", label: "SUP ID" },
  { key: "name", label: "Nazov" },
  { key: "status", label: "Stav" },
  { key: "createdAt", label: "Vytvorene" },
  { key: "createdBy", label: "Vytvoril" },
];

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "Nova": return "border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "Pripravena": return "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "Odoslana": return "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    default: return "border-muted-foreground bg-muted text-muted-foreground";
  }
}

function SupiskaFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Supiska | null;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [productId, setProductId] = useState("");
  const [formStartTime] = useState(() => Date.now());

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/supisky", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky"] });
      toast({ title: "Uspech", description: "Supiska vytvorena" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit supisku", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/supisky/${editing?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky"] });
      toast({ title: "Uspech", description: "Supiska aktualizovana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat supisku", variant: "destructive" }),
  });

  const { data: partners = [] } = useQuery<any[]>({ queryKey: ["/api/partners"], enabled: open });
  const { data: products = [] } = useQuery<any[]>({ queryKey: ["/api/products"], enabled: open });

  const filteredProducts = partnerId
    ? products.filter((p: any) => String(p.partnerId) === partnerId)
    : products;

  useEffect(() => {
    if (open) {
      if (editing) {
        setName(editing.name || "");
        setNotes(editing.notes || "");
        setPartnerId((editing as any).partnerId ? String((editing as any).partnerId) : "");
        setProductId((editing as any).productId ? String((editing as any).productId) : "");
      } else {
        setName("");
        setNotes("");
        setPartnerId("");
        setProductId("");
      }
    }
  }, [open, editing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const processingTimeSec = Math.round((Date.now() - formStartTime) / 1000);
    const payload = {
      name,
      notes,
      processingTimeSec,
      partnerId: partnerId ? Number(partnerId) : null,
      productId: productId ? Number(productId) : null,
    };
    if (editing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{editing ? "Upraviť súpisku" : "Nová súpiska"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 p-2">
          <div>
            <label className="text-sm font-medium text-muted-foreground">Názov</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              data-testid="input-supiska-name"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Partner <span className="text-muted-foreground/50">(pre kód súpisky)</span></label>
            <Select value={partnerId} onValueChange={v => { setPartnerId(v); setProductId(""); }}>
              <SelectTrigger data-testid="select-supiska-partner">
                <SelectValue placeholder="— bez partnera —" />
              </SelectTrigger>
              <SelectContent>
                {partners.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.code ? ` (${p.code})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Produkt <span className="text-muted-foreground/50">(pre kód súpisky)</span></label>
            <Select value={productId} onValueChange={setProductId} disabled={!partnerId}>
              <SelectTrigger data-testid="select-supiska-product">
                <SelectValue placeholder={partnerId ? "— vyberte produkt —" : "— najprv vyberte partnera —"} />
              </SelectTrigger>
              <SelectContent>
                {filteredProducts.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.displayName || p.name}{p.code ? ` (${p.code})` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">Poznámky</label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              data-testid="input-supiska-notes"
              rows={3}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Zrušiť</Button>
            <ProcessingSaveButton
              isPending={createMutation.isPending || updateMutation.isPending}
              type="submit"
            />
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}


function AddContractsDialog({
  open,
  onOpenChange,
  supiskaId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supiskaId: number;
}) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const { data: eligibleContracts = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/supisky", supiskaId, "eligible-contracts"],
    enabled: open,
  });

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ["/api/subjects"],
    enabled: open,
  });

  const { data: partners = [] } = useQuery<any[]>({
    queryKey: ["/api/partners"],
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: (contractIds: number[]) =>
      apiRequest("POST", `/api/supisky/${supiskaId}/contracts`, { contractIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky", supiskaId, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky", supiskaId, "eligible-contracts"] });
      toast({ title: "Uspech", description: "Zmluvy pridane do supisky" });
      setSelectedIds([]);
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa pridat zmluvy", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) setSelectedIds([]);
  }, [open]);

  const toggleId = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === eligibleContracts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(eligibleContracts.map((c: any) => c.id));
    }
  };

  const { sortedData: sortedEligible, sortKey: sortKeyEligible, sortDirection: sortDirEligible, requestSort: requestSortEligible } = useTableSort(eligibleContracts);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Pridat zmluvy do supisky</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 p-2">
          <p className="text-sm text-muted-foreground">
            Zobrazene su iba podpisane a nezamknute zmluvy.
          </p>
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.length === eligibleContracts.length && eligibleContracts.length > 0}
                      onCheckedChange={toggleAll}
                      data-testid="checkbox-select-all"
                    />
                  </TableHead>
                  <TableHead sortKey="globalNumber" sortDirection={sortKeyEligible === "globalNumber" ? sortDirEligible : null} onSort={requestSortEligible}>Cislo kontraktu</TableHead>
                  <TableHead sortKey="subjectId" sortDirection={sortKeyEligible === "subjectId" ? sortDirEligible : null} onSort={requestSortEligible}>Klient</TableHead>
                  <TableHead sortKey="partnerId" sortDirection={sortKeyEligible === "partnerId" ? sortDirEligible : null} onSort={requestSortEligible}>Partner</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Loader2 className="w-4 h-4 animate-spin inline" />
                    </TableCell>
                  </TableRow>
                ) : eligibleContracts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Ziadne dostupne zmluvy
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedEligible.map((c: any) => {
                    const subject = subjects.find((s: any) => s.id === c.subjectId);
                    const partner = partners.find((p: any) => p.id === c.partnerId);
                    return (
                      <TableRow key={c.id} data-testid={`row-eligible-${c.id}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(c.id)}
                            onCheckedChange={() => toggleId(c.id)}
                            data-testid={`checkbox-contract-${c.id}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-sm">{c.globalNumber || c.id}</TableCell>
                        <TableCell>
                          {subject ? `${subject.firstName || ""} ${subject.lastName || ""}`.trim() : ""}
                        </TableCell>
                        <TableCell>{partner?.name || ""}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedIds.length} vybratych
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Zrusit</Button>
              <Button
                onClick={() => addMutation.mutate(selectedIds)}
                disabled={selectedIds.length === 0 || addMutation.isPending}
                data-testid="button-confirm-add-contracts"
              >
                {addMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
                Pridat ({selectedIds.length})
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InlineSupiskaDetail({ supiska }: { supiska: Supiska }) {
  const { toast } = useToast();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  const { data: linkedContracts = [], isLoading: contractsLoading } = useQuery<any[]>({
    queryKey: ["/api/supisky", supiska.id, "contracts"],
    enabled: true,
  });

  const { data: subjects = [] } = useQuery<any[]>({
    queryKey: ["/api/subjects"],
  });

  const { data: partners = [] } = useQuery<any[]>({
    queryKey: ["/api/partners"],
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const removeContractMutation = useMutation({
    mutationFn: (contractId: number) =>
      apiRequest("DELETE", `/api/supisky/${supiska.id}/contracts/${contractId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky", supiska.id, "contracts"] });
      toast({ title: "Úspech", description: "Zmluva odobratá zo súpisky" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message || "Nepodarilo sa odobrať zmluvu", variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      apiRequest("PUT", `/api/supisky/${supiska.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supisky"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky", supiska.id, "contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Úspech", description: "Stav súpisky aktualizovaný" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa zmeniť stav", variant: "destructive" }),
  });

  const isSent = supiska.status === "Odoslana";

  const getSubjectName = (subjectId: number | null) => {
    if (!subjectId) return "";
    const s = subjects.find((s: any) => s.id === subjectId);
    return s ? `${s.firstName || ""} ${s.lastName || ""}`.trim() : "";
  };

  const getPartnerName = (partnerId: number | null) => {
    if (!partnerId) return "";
    const p = partners.find((p: any) => p.id === partnerId);
    return p?.name || "";
  };

  const getProductName = (productId: number | null) => {
    if (!productId) return "";
    const p = products.find((p: any) => p.id === productId);
    return p?.name || "";
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {!isSent && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              data-testid="button-add-contracts"
            >
              <Plus className="w-4 h-4 mr-1" />
              Pridať zmluvy
            </Button>
            {supiska.status === "Nova" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => statusMutation.mutate("Pripravena")}
                disabled={statusMutation.isPending}
                data-testid="button-status-pripravena"
              >
                Pripravená
              </Button>
            )}
            {(supiska.status === "Nova" || supiska.status === "Pripravena") && linkedContracts.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => statusMutation.mutate("Odoslana")}
                disabled={statusMutation.isPending}
                data-testid="button-status-odoslana"
              >
                <Send className="w-4 h-4 mr-1" />
                Odoslať
              </Button>
            )}
          </>
        )}
        {isSent && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => statusMutation.mutate("Pripravena")}
            disabled={statusMutation.isPending}
            data-testid="button-status-unlock"
          >
            <Undo2 className="w-4 h-4 mr-1" />
            Vrátiť na Pripravená
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/supisky/${supiska.id}/export/excel`, "_blank")}
            data-testid="button-export-excel"
          >
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/api/supisky/${supiska.id}/export/csv`, "_blank")}
            data-testid="button-export-csv"
          >
            <FileDown className="w-4 h-4 mr-1" />
            CSV
          </Button>
        </div>
      </div>

      {supiska.notes && (
        <p className="text-sm text-muted-foreground">{supiska.notes}</p>
      )}

      {isSent && supiska.sentAt && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="w-4 h-4" />
          <span>Odoslaná {formatDateSlovak(supiska.sentAt)} užívateľom {supiska.sentBy}</span>
        </div>
      )}

      {contractsLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span className="text-xs text-muted-foreground">Načítavam zmluvy...</span>
        </div>
      ) : linkedContracts.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4" data-testid="text-no-supiska-contracts">
          Žiadne zmluvy v tejto súpiske
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] py-1">Číslo kontraktu</TableHead>
              <TableHead className="text-[10px] py-1">Klient</TableHead>
              <TableHead className="text-[10px] py-1">Partner</TableHead>
              <TableHead className="text-[10px] py-1">Produkt</TableHead>
              <TableHead className="text-[10px] py-1">Stav</TableHead>
              {!isSent && <TableHead className="w-12 text-[10px] py-1"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {linkedContracts.map((c: any) => (
              <TableRow key={c.id} className="hover:bg-muted/30" data-testid={`row-contract-${c.id}`}>
                <TableCell className="font-mono text-[11px] py-1">{c.globalNumber || c.id}</TableCell>
                <TableCell className="text-[11px] py-1">{getSubjectName(c.subjectId)}</TableCell>
                <TableCell className="text-[11px] py-1">{getPartnerName(c.partnerId)}</TableCell>
                <TableCell className="text-[11px] py-1">{getProductName(c.productId)}</TableCell>
                <TableCell className="py-1">
                  {c.isLocked ? (
                    <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0">
                      <Lock className="w-3 h-3" />
                      Zamknutá
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Otvorená</Badge>
                  )}
                </TableCell>
                {!isSent && (
                  <TableCell className="py-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeContractMutation.mutate(c.id)}
                      disabled={removeContractMutation.isPending}
                      data-testid={`button-remove-contract-${c.id}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="text-xs text-muted-foreground">
        Počet zmlúv: {linkedContracts.length}
      </div>

      <AddContractsDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        supiskaId={supiska.id}
      />
    </div>
  );
}

export default function SupiskyPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Supiska | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const columnVisibility = useColumnVisibility("supisky", SUPISKY_COLUMNS);

  const { data: supisky = [], isLoading } = useQuery<Supiska[]>({
    queryKey: ["/api/supisky"],
  });

  const searchFiltered = searchQuery.trim()
    ? supisky.filter(s => {
        const q = searchQuery.trim().toLowerCase();
        return (s.name || "").toLowerCase().includes(q)
          || (s.supId || "").toLowerCase().includes(q)
          || (s.status || "").toLowerCase().includes(q);
      })
    : supisky;

  const tableFilter = useSmartFilter(searchFiltered, SUPISKY_FILTER_COLUMNS, "supisky");

  const sorted = [...tableFilter.filteredData].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Súpisky</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnManager columnVisibility={columnVisibility} />
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Vyhľadať súpisku podľa názvu, ID alebo stavu..."
          className="pl-9 h-9"
          data-testid="input-search-supisky"
        />
      </div>

      <SmartFilterBar filter={tableFilter} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-supisky">
          Žiadne súpisky
        </p>
      ) : (
        <div className="space-y-4">
          {sorted.map((s: Supiska) => {
            const isExpanded = expandedIds.has(s.id);
            return (
              <div
                key={s.id}
                className={`rounded-lg border transition-all duration-200 ${
                  isExpanded
                    ? "border-border shadow-md bg-muted/20 dark:bg-muted/10 ring-1 ring-black/5 dark:ring-white/5"
                    : "border-border/50 bg-card hover:border-border hover:shadow-sm"
                }`}
                data-testid={`row-supiska-${s.id}`}
              >
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
                  onClick={() => toggleExpand(s.id)}
                >
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`text-sm ${isExpanded ? "font-bold" : "font-semibold"}`} data-testid={`text-supiska-name-${s.id}`}>
                        {s.name}
                      </span>
                      {columnVisibility.isVisible("supId") && (
                        <span className="font-mono text-xs text-muted-foreground" data-testid={`text-supiska-supid-${s.id}`}>
                          {s.supId}
                        </span>
                      )}
                      {(s as any).supiskaCode && (
                        <span className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-500/10 text-blue-400 whitespace-nowrap" data-testid={`text-supiska-code-${s.id}`}>
                          <Hash className="w-2.5 h-2.5" />
                          {(s as any).supiskaCode}
                        </span>
                      )}
                      {columnVisibility.isVisible("createdAt") && s.createdAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDateSlovak(s.createdAt)}
                        </span>
                      )}
                      {columnVisibility.isVisible("createdBy") && s.createdBy && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {s.createdBy}
                        </span>
                      )}
                    </div>
                  </div>
                  {columnVisibility.isVisible("status") && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[10px] font-medium shrink-0 ${statusBadgeClasses(s.status)}`} data-testid={`badge-supiska-status-${s.id}`}>
                      {s.status}
                    </span>
                  )}
                  {(s as any).supiskaType === "processing" && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-cyan-500 text-cyan-500 shrink-0">Spracovanie</Badge>
                  )}
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => window.print()}
                          data-testid={`button-print-${s.id}`}
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Vytlačiť súpisku</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-border/60 px-5 py-4 bg-muted/10 dark:bg-muted/5 rounded-b-lg">
                    <InlineSupiskaDetail supiska={s} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SupiskaFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />
    </div>
  );
}