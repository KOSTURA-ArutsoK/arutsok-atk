import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import type { ContractInventory } from "@shared/schema";
import { Pencil, Loader2, Printer, Circle, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ProcessingSaveButton } from "@/components/processing-save-button";
import { SortableTableRow, SortableContext_Wrapper } from "@/components/sortable-list";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { Separator } from "@/components/ui/separator";

const INVENTORY_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "name", label: "Nazov", type: "text" },
  { key: "sequenceNumber", label: "Cislo", type: "number" },
  { key: "description", label: "Popis", type: "text" },
];

const INVENTORY_COLUMNS: ColumnDef[] = [
  { key: "sortOrder", label: "Poradie" },
  { key: "name", label: "Nazov" },
  { key: "sequenceNumber", label: "Cislo" },
  { key: "description", label: "Popis" },
  { key: "status", label: "Stav" },
];

const LIFECYCLE_PHASE_NAMES: Record<number, string> = {
  1: "Čakajúce",
  2: "Odoslané",
  3: "Výhrady",
  4: "Archív",
  5: "Prijaté CK",
  6: "V spracovaní",
  7: "Intervencia",
  8: "Pripravené",
  9: "Odoslané OP",
  10: "Prijaté OP",
};

function getContractSemaphore(contract: { lifecyclePhase: number | null; isDeleted: boolean }): { color: string; label: string; cssClass: string } {
  if (contract.isDeleted) {
    return { color: "#000000", label: "Vymazaná z archívu", cssClass: "text-black dark:text-gray-400" };
  }

  const phase = contract.lifecyclePhase || 0;

  if (phase === 2) {
    return { color: "#3b82f6", label: "Odoslané na sprievodke", cssClass: "text-blue-500" };
  }
  if (phase === 3) {
    return { color: "#ef4444", label: "Neprijaté – výhrady", cssClass: "text-red-500" };
  }
  if (phase === 4) {
    return { color: "#000000", label: "Archív s výhradami", cssClass: "text-black dark:text-gray-400" };
  }
  if (phase === 7) {
    return { color: "#f97316", label: "Interná intervencia", cssClass: "text-orange-500" };
  }
  if (phase >= 5) {
    return { color: "#22c55e", label: "Prijatá / Spracovaná", cssClass: "text-green-500" };
  }

  return { color: "#6b7280", label: "Čakajúce", cssClass: "text-gray-500" };
}

type InventoryContractRow = {
  id: number;
  contractNumber: string | null;
  proposalNumber: string | null;
  contractType: string | null;
  lifecyclePhase: number | null;
  statusId: number | null;
  sortOrderInInventory: number | null;
  isDeleted: boolean;
  subjectName: string;
  subjectUid: string | null;
};

function InlineInventoryDetail({ inventory }: { inventory: ContractInventory }) {
  const { data: contracts, isLoading } = useQuery<InventoryContractRow[]>({
    queryKey: ["/api/contract-inventories", inventory.id, "contracts"],
    queryFn: () => fetch(`/api/contract-inventories/${inventory.id}/contracts`, { credentials: "include" }).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-xs text-muted-foreground">Načítavam zmluvy...</span>
      </div>
    );
  }

  if (!contracts || contracts.length === 0) {
    return (
      <p className="text-xs text-muted-foreground text-center py-4" data-testid="text-no-inventory-contracts">
        Žiadne zmluvy v tejto sprievodke
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-8 text-[10px] py-1">#</TableHead>
            <TableHead className="w-6 text-[10px] py-1"></TableHead>
            <TableHead className="text-[10px] py-1">Číslo zmluvy</TableHead>
            <TableHead className="text-[10px] py-1">Klient</TableHead>
            <TableHead className="text-[10px] py-1">Typ</TableHead>
            <TableHead className="text-[10px] py-1">Stav</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((c, idx) => {
            const sem = getContractSemaphore(c);
            return (
              <TableRow key={c.id} className="hover:bg-muted/30" data-testid={`row-inventory-contract-${c.id}`}>
                <TableCell className="text-[10px] text-muted-foreground font-mono py-1">{idx + 1}</TableCell>
                <TableCell className="px-1 py-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Circle className={`w-2.5 h-2.5 fill-current ${sem.cssClass}`} data-testid={`semaphore-contract-${c.id}`} />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="text-xs">{sem.label}</TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="font-mono text-xs py-1" data-testid={`text-inv-contract-number-${c.id}`}>
                  {c.contractNumber || c.proposalNumber || "—"}
                </TableCell>
                <TableCell className="py-1" data-testid={`text-inv-contract-client-${c.id}`}>
                  <span className="text-xs">{c.subjectName}</span>
                  {c.subjectUid && (
                    <span className="text-[9px] text-muted-foreground ml-1 font-mono">{c.subjectUid}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs py-1" data-testid={`text-inv-contract-type-${c.id}`}>
                  {c.contractType || "—"}
                </TableCell>
                <TableCell className="py-1" data-testid={`text-inv-contract-phase-${c.id}`}>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${sem.cssClass} border-current`}>
                    {LIFECYCLE_PHASE_NAMES[c.lifecyclePhase as number] || `Fáza ${c.lifecyclePhase || 0}`}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground px-2 pb-1">
        <span className="flex items-center gap-1"><Circle className="w-2 h-2 fill-blue-500 text-blue-500" /> Odoslané</span>
        <span className="flex items-center gap-1"><Circle className="w-2 h-2 fill-red-500 text-red-500" /> Neprijaté</span>
        <span className="flex items-center gap-1"><Circle className="w-2 h-2 fill-orange-500 text-orange-500" /> Intervencia</span>
        <span className="flex items-center gap-1"><Circle className="w-2 h-2 fill-black dark:fill-gray-400 text-black dark:text-gray-400" /> Archív</span>
        <span className="flex items-center gap-1"><Circle className="w-2 h-2 fill-green-500 text-green-500" /> Prijatá</span>
        <span className="ml-auto">{contracts.length} zmlúv</span>
      </div>
    </div>
  );
}

function handlePrintInventory(inventory: ContractInventory, contracts: InventoryContractRow[]) {
  const printWindow = window.open("", "_blank", "width=800,height=600");
  if (!printWindow) return;

  const rows = contracts.map((c, i) => {
    const sem = getContractSemaphore(c);
    return `<tr>
      <td style="padding:6px 10px;border-bottom:1px solid #ddd;text-align:center;">${i + 1}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #ddd;">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${sem.color};margin-right:6px;vertical-align:middle;"></span>
        ${c.contractNumber || c.proposalNumber || "—"}
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${c.subjectName}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${c.contractType || "—"}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #ddd;">${sem.label}</td>
    </tr>`;
  }).join("");

  const today = new Date().toLocaleDateString("sk-SK");

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sprievodka č. ${inventory.sequenceNumber || inventory.id}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 30px; color: #222; }
    h1 { font-size: 18px; margin-bottom: 4px; }
    h2 { font-size: 14px; color: #666; font-weight: normal; margin-top: 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th { background: #f0f0f0; padding: 8px 10px; border-bottom: 2px solid #ccc; text-align: left; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .logo { font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #1a1a2e; }
    .meta { text-align: right; font-size: 12px; color: #666; }
    .footer { margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
    .legend { display: flex; gap: 16px; margin-top: 16px; font-size: 11px; }
    .legend-item { display: flex; align-items: center; gap: 4px; }
    .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
    @media print { body { margin: 15px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">ATK</div>
      <h1>${inventory.name}</h1>
      <h2>${inventory.description || ""}</h2>
    </div>
    <div class="meta">
      <div>Dátum tlače: ${today}</div>
      <div>Počet zmlúv: ${contracts.length}</div>
      ${inventory.sequenceNumber ? `<div>Číslo sprievodky: ${inventory.sequenceNumber}</div>` : ""}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">#</th>
        <th>Číslo zmluvy</th>
        <th>Klient</th>
        <th>Typ zmluvy</th>
        <th>Stav</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="legend">
    <div class="legend-item"><span class="dot" style="background:#3b82f6"></span> Odoslané</div>
    <div class="legend-item"><span class="dot" style="background:#ef4444"></span> Neprijaté</div>
    <div class="legend-item"><span class="dot" style="background:#f97316"></span> Intervencia</div>
    <div class="legend-item"><span class="dot" style="background:#000000"></span> Archív/Vymazaná</div>
    <div class="legend-item"><span class="dot" style="background:#22c55e"></span> Prijatá/Spracovaná</div>
  </div>
  <div class="footer">
    ArutsoK CRM &bull; Vygenerované ${today}
  </div>
</body>
</html>`);
  printWindow.document.close();
  setTimeout(() => printWindow.print(), 300);
}

function PrintButton({ inventory }: { inventory: ContractInventory }) {
  const { data: contracts } = useQuery<InventoryContractRow[]>({
    queryKey: ["/api/contract-inventories", inventory.id, "contracts"],
    queryFn: () => fetch(`/api/contract-inventories/${inventory.id}/contracts`, { credentials: "include" }).then(r => r.json()),
  });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={(e) => {
            e.stopPropagation();
            handlePrintInventory(inventory, contracts || []);
          }}
          data-testid={`button-print-inventory-${inventory.id}`}
        >
          <Printer className="w-3.5 h-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Tlačiť sprievodku</TooltipContent>
    </Tooltip>
  );
}

function InventoryFormDialog({
  open,
  onOpenChange,
  editingInventory,
  activeStateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingInventory: ContractInventory | null;
  activeStateId: number | null;
}) {
  const { toast } = useToast();
  const { data: allStates } = useStates();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [stateId, setStateId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isClosed, setIsClosed] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contract-inventories", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
      toast({ title: "Uspech", description: "Supiska vytvorena" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit supisku", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contract-inventories/${editingInventory?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
      toast({ title: "Uspech", description: "Supiska aktualizovana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat supisku", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      if (editingInventory) {
        setName(editingInventory.name || "");
        setDescription(editingInventory.description || "");
        setStateId(editingInventory.stateId?.toString() || "");
        setSortOrder(editingInventory.sortOrder?.toString() || "0");
        setIsClosed(editingInventory.isClosed ?? false);
      } else {
        setName("");
        setDescription("");
        setStateId(activeStateId?.toString() || "");
        setSortOrder("0");
        setIsClosed(false);
      }
    }
  }, [open, editingInventory, activeStateId]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!name) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    const payload = {
      name,
      description: description || null,
      stateId: stateId ? parseInt(stateId) : null,
      sortOrder: parseInt(sortOrder) || 0,
      isClosed,
    };

    if (editingInventory) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <DialogHeader>
          <DialogTitle data-testid="text-inventory-dialog-title">
            {editingInventory ? "Upravit supisku" : "Pridat supisku"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov *</label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nazov supisky"
              data-testid="input-inventory-name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Popis</label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Popis supisky"
              data-testid="input-inventory-description"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Stat</label>
            <Select value={stateId} onValueChange={setStateId}>
              <SelectTrigger data-testid="select-inventory-state">
                <SelectValue placeholder="Vyberte stat" />
              </SelectTrigger>
              <SelectContent>
                {allStates?.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Poradie</label>
            <Input
              type="number"
              value={sortOrder}
              onChange={e => setSortOrder(e.target.value)}
              placeholder="0"
              data-testid="input-inventory-sort-order"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="isClosed"
              checked={isClosed}
              onCheckedChange={(checked) => setIsClosed(checked === true)}
              data-testid="checkbox-inventory-is-closed"
            />
            <label htmlFor="isClosed" className="text-sm font-medium cursor-pointer">
              Uzavreta supiska
            </label>
          </div>

          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-inventory-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractInventories() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const activeStateId = appUser?.activeStateId ?? null;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<ContractInventory | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data: inventories, isLoading } = useQuery<ContractInventory[]>({
    queryKey: ["/api/contract-inventories"],
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("PUT", "/api/contract-inventories/reorder", { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa zmenit poradie", variant: "destructive" }),
  });

  const sorted = inventories
    ? [...inventories].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
    : [];
  const tableFilter = useSmartFilter(sorted, INVENTORY_FILTER_COLUMNS, "contract-inventories");
  const columnVisibility = useColumnVisibility("contract-inventories", INVENTORY_COLUMNS);

  const handleReorder = (items: { id: number | string; sortOrder: number }[]) => {
    reorderMutation.mutate(items.map(i => ({ id: Number(i.id), sortOrder: i.sortOrder })));
  };

  function openCreate() {
    setEditingInventory(null);
    setDialogOpen(true);
  }

  function openEdit(inventory: ContractInventory) {
    setEditingInventory(inventory);
    setDialogOpen(true);
  }

  function toggleExpand(inventory: ContractInventory) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(inventory.id)) {
        next.delete(inventory.id);
      } else {
        next.add(inventory.id);
      }
      return next;
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Zoznam sprievodiek</h1>
        <ColumnManager columnVisibility={columnVisibility} />
      </div>

      <SmartFilterBar filter={tableFilter} />

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : tableFilter.filteredData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-inventories">
              Ziadne supisky
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  {columnVisibility.isVisible("sortOrder") && <TableHead className="w-20">Poradie</TableHead>}
                  {columnVisibility.isVisible("name") && <TableHead>Nazov</TableHead>}
                  {columnVisibility.isVisible("sequenceNumber") && <TableHead>Cislo</TableHead>}
                  {columnVisibility.isVisible("description") && <TableHead>Popis</TableHead>}
                  {columnVisibility.isVisible("status") && <TableHead className="w-32">Stav</TableHead>}
                  <TableHead className="w-24 text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext_Wrapper items={tableFilter.filteredData} onReorder={handleReorder}>
                <TableBody>
                  {tableFilter.filteredData.map((inventory) => {
                    const isExpanded = expandedIds.has(inventory.id);
                    return (
                      <>
                        <SortableTableRow
                          key={inventory.id}
                          id={inventory.id}
                          onRowClick={() => toggleExpand(inventory)}
                          data-testid={`row-inventory-${inventory.id}`}
                        >
                          {columnVisibility.isVisible("sortOrder") && <TableCell className="font-mono text-sm" data-testid={`text-sort-order-${inventory.id}`}>
                            {inventory.sortOrder}
                          </TableCell>}
                          {columnVisibility.isVisible("name") && <TableCell data-testid={`text-inventory-name-${inventory.id}`}>
                            <div className="flex items-center gap-2">
                              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 shrink-0 ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                              <span>{inventory.name}</span>
                            </div>
                          </TableCell>}
                          {columnVisibility.isVisible("sequenceNumber") && <TableCell className="font-mono text-sm" data-testid={`text-inventory-seq-${inventory.id}`}>
                            {inventory.sequenceNumber ? `c. ${inventory.sequenceNumber}` : "-"}
                          </TableCell>}
                          {columnVisibility.isVisible("description") && <TableCell className="text-sm text-muted-foreground" data-testid={`text-inventory-description-${inventory.id}`}>
                            {inventory.description || "—"}
                          </TableCell>}
                          {columnVisibility.isVisible("status") && <TableCell data-testid={`badge-inventory-status-${inventory.id}`}>
                            <div className="flex items-center gap-1 flex-wrap">
                              {inventory.isClosed ? (
                                <Badge variant="destructive" className="text-xs">Uzavreta</Badge>
                              ) : (
                                <Badge className="bg-green-600 text-white text-xs">Otvorena</Badge>
                              )}
                              {inventory.isAccepted && (
                                <Badge variant="outline" className="text-xs border-blue-500 text-blue-500">Prijata</Badge>
                              )}
                              {inventory.isDispatched && !inventory.isAccepted && (
                                <Badge variant="outline" className="text-xs border-amber-500 text-amber-500">Odoslana</Badge>
                              )}
                            </div>
                          </TableCell>}
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <PrintButton inventory={inventory} />
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={(e) => { e.stopPropagation(); openEdit(inventory); }}
                                    data-testid={`button-edit-inventory-${inventory.id}`}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Upraviť sprievodku</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </SortableTableRow>
                        {isExpanded && (
                          <TableRow key={`detail-${inventory.id}`} className="hover:bg-transparent">
                            <TableCell colSpan={99} className="p-0">
                              <div className="bg-muted/30 border-t border-b border-border/50 px-4 py-2">
                                <InlineInventoryDetail inventory={inventory} />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </SortableContext_Wrapper>
            </Table>
          )}
        </CardContent>
      </Card>

      <InventoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingInventory={editingInventory}
        activeStateId={activeStateId}
      />
    </div>
  );
}
