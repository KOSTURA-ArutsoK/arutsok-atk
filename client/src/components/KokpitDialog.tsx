import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { TripleRingStatus } from "@/components/TripleRingStatus";
import { StatusChangeModal } from "@/components/status-change-modal";
import { formatRemainingHHMM, isOverdue, isAdminAlert } from "@/lib/workingHours";
import { FileText, CheckCircle2, AlertCircle, Loader2, X, Archive, Search } from "lucide-react";
import type { KokpitItem, ContractStatus } from "@shared/schema";
import type { ScanFile } from "@/pages/PridatStavZmluvy";

type KokpitItemExt = KokpitItem & { contractUid?: string | null; statusName?: string | null };

type TrezorContract = {
  id: number;
  uid: string | null;
  supiskaCode: string | null;
  subjectId: number | null;
  partnerId: number | null;
  productId: number | null;
};

type Subject = { id: number; firstName?: string | null; lastName?: string | null; companyName?: string | null };
type Partner = { id: number; name?: string | null; code?: string | null };
type Product = { id: number; name?: string | null };

function subjectDisplay(s: Subject | undefined): string {
  if (!s) return "—";
  const full = [s.firstName, s.lastName].filter(Boolean).join(" ");
  return full || s.companyName || "—";
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── AgingBadge ────────────────────────────────────────────────────────────────

function AgingBadge({ dayCreated }: { dayCreated: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const diff = Math.floor((new Date(today).getTime() - new Date(dayCreated).getTime()) / 86400000);
  if (diff <= 0) return null;
  return (
    <span
      data-testid="badge-aging"
      style={{
        display: "inline-flex", alignItems: "center",
        background: diff >= 3 ? "#ea580c" : "#f59e0b",
        color: "white", borderRadius: 8, padding: "1px 6px", fontSize: 11, fontWeight: 700,
      }}
    >
      +{diff}d
    </span>
  );
}

// ── SlaTimer ─────────────────────────────────────────────────────────────────

function SlaTimer({ createdAt, resolvedAt }: { createdAt: string; resolvedAt: string | null }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (resolvedAt) return;
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, [resolvedAt]);

  if (resolvedAt) return <span style={{ color: "#059669", fontSize: 12 }}>Vybavené</span>;
  const created = new Date(createdAt);
  const label = formatRemainingHHMM(created, now);
  const overdue = isOverdue(created, now);
  return (
    <span
      data-testid="text-sla-timer"
      style={{
        fontSize: 12, fontWeight: 700,
        color: overdue ? "#dc2626" : "#f59e0b",
        background: overdue ? "rgba(220,38,38,0.08)" : "transparent",
        borderRadius: 4, padding: overdue ? "1px 4px" : 0,
      }}
    >
      {label}
    </span>
  );
}

// ── KROK 1: Inbox + Trezor ────────────────────────────────────────────────────

interface Step1PanelProps {
  scanFiles: ScanFile[];
  onRemoveScanFile: (id: string) => void;
}

function Step1Panel({ scanFiles, onRemoveScanFile }: Step1PanelProps) {
  const { toast } = useToast();
  const [selectedScanIds, setSelectedScanIds] = useState<Set<string>>(new Set());
  const [searchUid, setSearchUid] = useState("");
  const [searchCode, setSearchCode] = useState("");
  const [searchSubject, setSearchSubject] = useState("");
  const [searchPartner, setSearchPartner] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [pairedMap, setPairedMap] = useState<Record<string, { contractId: number; contractUid: string }>>({});

  const { data: contractsRaw = [] } = useQuery<TrezorContract[]>({
    queryKey: ["/api/contracts", "trezor-list"],
    queryFn: async () => {
      const res = await fetch("/api/contracts?limit=500", { credentials: "include" });
      const data = await res.json();
      return data.contracts ?? data ?? [];
    },
  });

  const { data: subjects = [] } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: partners = [] } = useQuery<Partner[]>({ queryKey: ["/api/partners"] });
  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const filteredContracts = contractsRaw.filter(c => {
    if (searchUid.trim()) {
      const q = searchUid.replace(/\s/g, "").toLowerCase();
      if (!(c.uid ?? "").replace(/\s/g, "").toLowerCase().includes(q)) return false;
    }
    if (searchCode.trim()) {
      const q = searchCode.toLowerCase();
      if (!(c.supiskaCode ?? "").toLowerCase().includes(q)) return false;
    }
    if (searchSubject.trim()) {
      const q = searchSubject.toLowerCase();
      const sub = subjects.find(s => s.id === c.subjectId);
      const name = subjectDisplay(sub).toLowerCase();
      if (!name.includes(q)) return false;
    }
    if (searchPartner.trim()) {
      const q = searchPartner.toLowerCase();
      const p = partners.find(p => p.id === c.partnerId);
      const name = (p?.name ?? p?.code ?? "").toLowerCase();
      if (!name.includes(q)) return false;
    }
    if (searchProduct.trim()) {
      const q = searchProduct.toLowerCase();
      const p = products.find(p => p.id === c.productId);
      const name = (p?.name ?? "").toLowerCase();
      if (!name.includes(q)) return false;
    }
    return true;
  }).slice(0, 100);

  const hasAnySearch = searchUid || searchCode || searchSubject || searchPartner || searchProduct;

  function toggleScan(id: string) {
    setSelectedScanIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleAssign(contract: TrezorContract) {
    if (selectedScanIds.size === 0) {
      toast({ title: "Vyberte skeny", description: "Najprv vyberte jeden alebo viac skenov v ľavom paneli.", variant: "destructive" });
      return;
    }
    const contractUid = contract.uid ?? String(contract.id);
    setPairedMap(prev => {
      const next = { ...prev };
      selectedScanIds.forEach(id => {
        next[id] = { contractId: contract.id, contractUid };
      });
      return next;
    });
    setSelectedScanIds(new Set());
    toast({ title: "Pridelené", description: `${selectedScanIds.size} sken(ov) priradených ku zmluve ${contractUid}` });
  }

  return (
    <div className="flex flex-1 min-h-0 divide-x">
      {/* LEFT: Inbox */}
      <div className="flex flex-col w-[45%] min-h-0">
        <div className="px-4 py-2.5 border-b shrink-0 flex items-center gap-2 bg-muted/20">
          <FileText className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Inbox skenov</span>
          <Badge variant="outline" className="text-[10px] ml-auto">{scanFiles.length} súborov</Badge>
        </div>
        <div className="flex-1 overflow-y-auto">
          {scanFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-6">
              <FileText size={32} className="opacity-20" />
              <p className="text-sm text-center">
                Žiadne skeny.<br />
                <span className="text-xs">Presuňte súbory do plochy na stránke.</span>
              </p>
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20 sticky top-0">
                  <th className="py-1.5 px-3 w-6"></th>
                  <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">Súbor</th>
                  <th className="py-1.5 px-2 text-right font-medium text-muted-foreground">Veľkosť</th>
                  <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">Stav</th>
                  <th className="py-1.5 px-2 w-6"></th>
                </tr>
              </thead>
              <tbody>
                {scanFiles.map(file => {
                  const isSelected = selectedScanIds.has(file.id);
                  const paired = pairedMap[file.id];
                  return (
                    <tr
                      key={file.id}
                      data-testid={`row-inbox-${file.id}`}
                      className="border-b border-border/30 cursor-pointer transition-colors"
                      style={{ background: isSelected ? "rgba(30,64,175,0.07)" : paired ? "rgba(5,150,105,0.05)" : undefined }}
                      onClick={() => { if (file.done && !file.error) toggleScan(file.id); }}
                    >
                      <td className="py-1.5 px-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="cursor-pointer"
                          data-testid={`checkbox-scan-${file.id}`}
                          onClick={e => { e.stopPropagation(); if (file.done && !file.error) toggleScan(file.id); }}
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <div className="flex items-center gap-1">
                          <FileText size={11} className="text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[130px]" title={file.name}>{file.name}</span>
                        </div>
                        {paired && (
                          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                            → {paired.contractUid}
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right text-muted-foreground">{fmtSize(file.size)}</td>
                      <td className="py-1.5 px-2">
                        {file.error ? (
                          <span className="flex items-center gap-1 text-red-600">
                            <AlertCircle size={10} />chyba
                          </span>
                        ) : file.done ? (
                          <span className="flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 size={10} />OK
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-blue-600">
                            <Loader2 size={10} className="animate-spin" />{file.progress}%
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        <button
                          data-testid={`button-inbox-remove-${file.id}`}
                          onClick={e => { e.stopPropagation(); onRemoveScanFile(file.id); }}
                          className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        >
                          <X size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {selectedScanIds.size > 0 && (
          <div className="px-3 py-2 border-t text-xs text-muted-foreground bg-blue-500/5 shrink-0">
            {selectedScanIds.size} sken{selectedScanIds.size === 1 ? "" : "ov"} vybraných — vyberte zmluvu v Trezore
          </div>
        )}
      </div>

      {/* RIGHT: Trezor */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-4 py-2.5 border-b shrink-0 flex items-center gap-2 bg-muted/20">
          <Archive className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Trezor zmlúv</span>
          <Badge variant="outline" className="text-[10px] ml-auto">{contractsRaw.length} zmlúv</Badge>
        </div>

        {/* Search inputs */}
        <div className="px-3 py-2 border-b shrink-0 grid grid-cols-5 gap-1.5">
          <div className="relative">
            <Search size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="input-trezor-uid"
              placeholder="UID"
              value={searchUid}
              onChange={e => setSearchUid(e.target.value)}
              className="h-6 text-[11px] pl-5 pr-1"
            />
          </div>
          <div className="relative">
            <Search size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="input-trezor-code"
              placeholder="Číslo zmluvy"
              value={searchCode}
              onChange={e => setSearchCode(e.target.value)}
              className="h-6 text-[11px] pl-5 pr-1"
            />
          </div>
          <div className="relative">
            <Search size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="input-trezor-subject"
              placeholder="Subjekt"
              value={searchSubject}
              onChange={e => setSearchSubject(e.target.value)}
              className="h-6 text-[11px] pl-5 pr-1"
            />
          </div>
          <div className="relative">
            <Search size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="input-trezor-partner"
              placeholder="Partner"
              value={searchPartner}
              onChange={e => setSearchPartner(e.target.value)}
              className="h-6 text-[11px] pl-5 pr-1"
            />
          </div>
          <div className="relative">
            <Search size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="input-trezor-product"
              placeholder="Produkt"
              value={searchProduct}
              onChange={e => setSearchProduct(e.target.value)}
              className="h-6 text-[11px] pl-5 pr-1"
            />
          </div>
        </div>

        {/* Contract table */}
        <div className="flex-1 overflow-y-auto">
          {!hasAnySearch ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground p-6">
              <Search size={28} className="opacity-20" />
              <p className="text-sm text-center">Zadajte kritériá vyhľadávania</p>
            </div>
          ) : filteredContracts.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">Žiadne zmluvy</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20 sticky top-0">
                  <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">UID</th>
                  <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">Číslo</th>
                  <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">Subjekt</th>
                  <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">Partner</th>
                  <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">Produkt</th>
                  <th className="py-1.5 px-2 w-16"></th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map(c => {
                  const sub = subjects.find(s => s.id === c.subjectId);
                  const partner = partners.find(p => p.id === c.partnerId);
                  const product = products.find(p => p.id === c.productId);
                  return (
                    <tr
                      key={c.id}
                      data-testid={`row-trezor-${c.id}`}
                      className="border-b border-border/30 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-1.5 px-2 font-mono text-[10px] text-blue-700 dark:text-blue-400">
                        {c.uid ?? "—"}
                      </td>
                      <td className="py-1.5 px-2 text-muted-foreground">{c.supiskaCode ?? "—"}</td>
                      <td className="py-1.5 px-2 truncate max-w-[100px]">{subjectDisplay(sub)}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{partner?.code ?? partner?.name ?? "—"}</td>
                      <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[80px]">{product?.name ?? "—"}</td>
                      <td className="py-1.5 px-2">
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid={`button-assign-contract-${c.id}`}
                          className="h-5 px-2 text-[10px]"
                          onClick={() => handleAssign(c)}
                        >
                          Priradiť
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

interface KokpitDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialItemId?: number | null;
  scanFiles: ScanFile[];
  onRemoveScanFile: (id: string) => void;
}

export function KokpitDialog({ open, onOpenChange, initialItemId, scanFiles, onRemoveScanFile }: KokpitDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("prichod");
  const [uidSearch, setUidSearch] = useState("");
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [selectedContractUid, setSelectedContractUid] = useState<string | null>(null);
  const [selectedStatusId, setSelectedStatusId] = useState<string>("");
  const [workingItem, setWorkingItem] = useState<KokpitItemExt | null>(null);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [resolveItem, setResolveItem] = useState<KokpitItemExt | null>(null);

  const { data: items = [], isLoading } = useQuery<KokpitItemExt[]>({
    queryKey: ["/api/kokpit/items"],
    enabled: open,
  });

  const { data: statuses = [] } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
    enabled: open,
  });

  useEffect(() => {
    if (initialItemId && items.length > 0) {
      const item = items.find(i => i.id === initialItemId);
      if (item) {
        setWorkingItem(item);
        if (item.phase === 1) setActiveTab("prichod");
        else if (item.phase === 2) setActiveTab("rozdelenie");
        else setActiveTab("riesenie");
      }
    }
  }, [initialItemId, items]);

  const phase2Items = items.filter(i => i.phase === 2);
  const phase3Items = items.filter(i => i.phase === 3);

  const moveMutation = useMutation({
    mutationFn: async ({ id, phase, contractId, statusId }: { id: number; phase: number; contractId?: number | null; statusId?: number | null }) =>
      (await apiRequest("PATCH", `/api/kokpit/items/${id}`, { phase, contractId, statusId })).json(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/kokpit/items"] }),
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/kokpit/items/${id}/resolve`, {})).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kokpit/items"] });
      queryClient.invalidateQueries({ queryKey: ["/api/kokpit/calendar"] });
      toast({ title: "Položka vybavená a zapísaná do zmluvy" });
    },
  });

  type ContractSearchRow = { id: number; uid: string | null; statusId: number | null };

  const contractSearch = useQuery<{ id: number; uid: string; statusId: number | null }[]>({
    queryKey: ["/api/contracts", "search-uid", uidSearch],
    queryFn: async () => {
      if (!uidSearch.trim()) return [];
      const res = await fetch(`/api/contracts?limit=500`, { credentials: "include" });
      const data = await res.json();
      const all: ContractSearchRow[] = data.contracts ?? data ?? [];
      const q = uidSearch.replace(/\s/g, "").toLowerCase();
      return all
        .filter(c => (c.uid ?? "").replace(/\s/g, "").toLowerCase().includes(q))
        .slice(0, 8)
        .map(c => ({ id: c.id, uid: c.uid ?? "", statusId: c.statusId ?? null }));
    },
    enabled: uidSearch.length >= 3,
  });

  function handleAssign(item: KokpitItemExt) {
    setWorkingItem(item);
    setSelectedContractId(item.contractId ?? null);
    setSelectedContractUid(item.contractUid ?? null);
    setSelectedStatusId(item.statusId ? String(item.statusId) : "");
    setActiveTab("rozdelenie");
  }

  async function handleSaveRozdelenie() {
    if (!workingItem) return;
    await moveMutation.mutateAsync({
      id: workingItem.id,
      phase: 2,
      contractId: selectedContractId,
      statusId: selectedStatusId ? parseInt(selectedStatusId) : null,
    });
    setActiveTab("riesenie");
  }

  function handleOpenResolve(item: KokpitItemExt) {
    setResolveItem(item);
    setStatusModalOpen(true);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 gap-0 flex flex-col"
          style={{ maxWidth: "92vw", width: "92vw", height: "90vh", maxHeight: "90vh" }}
        >
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="text-lg font-bold">Kokpit — Spracovanie stavov</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-6 mt-3 shrink-0 justify-start">
              <TabsTrigger value="prichod" data-testid="tab-prichod">
                PRÍCHOD / SKENY
                {scanFiles.filter(f => f.done && !f.error).length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{scanFiles.filter(f => f.done && !f.error).length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rozdelenie" data-testid="tab-rozdelenie">
                ROZDELENIE
                {phase2Items.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{phase2Items.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="riesenie" data-testid="tab-riesenie">
                RIEŠENIE
                {phase3Items.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{phase3Items.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* PRÍCHOD — Krok 1: Inbox + Trezor */}
            <TabsContent value="prichod" className="flex-1 min-h-0 m-0" style={{ display: 'flex' }}>
              <Step1Panel scanFiles={scanFiles} onRemoveScanFile={onRemoveScanFile} />
            </TabsContent>

            {/* ROZDELENIE — Krok 2 */}
            <TabsContent value="rozdelenie" className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {workingItem ? (
                <div className="max-w-lg space-y-4">
                  <div className="flex items-center gap-3 border rounded-lg p-3">
                    <TripleRingStatus phase={2} size={22} />
                    <div>
                      <p className="text-sm font-medium">{workingItem.title}</p>
                      <p className="text-xs text-muted-foreground">{workingItem.source}</p>
                    </div>
                    <AgingBadge dayCreated={workingItem.dayCreated} />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zmluva (UID)</label>
                    <Input
                      data-testid="input-uid-search"
                      placeholder="Hľadaj UID zmluvy..."
                      value={uidSearch}
                      onChange={e => setUidSearch(e.target.value)}
                    />
                    {selectedContractUid && (
                      <p className="text-xs text-green-600 font-medium">Priradené: {selectedContractUid}</p>
                    )}
                    {contractSearch.data && contractSearch.data.length > 0 && (
                      <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                        {contractSearch.data.map(c => (
                          <button
                            key={c.id}
                            data-testid={`option-contract-${c.id}`}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                            onClick={() => {
                              setSelectedContractId(c.id);
                              setSelectedContractUid(c.uid);
                              setUidSearch(c.uid);
                            }}
                          >
                            {c.uid}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Kategória stavu</label>
                    <Select value={selectedStatusId} onValueChange={setSelectedStatusId}>
                      <SelectTrigger data-testid="select-status-category">
                        <SelectValue placeholder="Vyber kategóriu..." />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    data-testid="button-save-rozdelenie"
                    onClick={handleSaveRozdelenie}
                    disabled={moveMutation.isPending}
                    className="w-full"
                  >
                    {moveMutation.isPending ? "Ukladám..." : "Uložiť a presunúť do Riešenia"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {phase2Items.length === 0 && (
                    <p className="text-sm text-muted-foreground">Žiadne položky v Rozdelení.</p>
                  )}
                  {phase2Items.map(item => {
                    const created = new Date(item.createdAt!);
                    const pulse = isAdminAlert(created);
                    return (
                      <div
                        key={item.id}
                        data-testid={`row-kokpit-r2-${item.id}`}
                        className="flex items-center gap-3 border rounded-lg px-3 py-2"
                        style={{ background: isOverdue(created) ? "rgba(234,88,12,0.06)" : undefined }}
                      >
                        <TripleRingStatus phase={2} size={22} pulsing={pulse} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.contractUid || "—"} · {item.statusName || "—"}</p>
                        </div>
                        <AgingBadge dayCreated={item.dayCreated} />
                        <SlaTimer createdAt={item.createdAt!} resolvedAt={item.resolvedAt ? String(item.resolvedAt) : null} />
                        <Button size="sm" variant="outline" onClick={() => handleAssign(item)}>Upraviť</Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* RIEŠENIE — Krok 3 */}
            <TabsContent value="riesenie" className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {phase3Items.length === 0 && phase2Items.length === 0 && (
                <p className="text-sm text-muted-foreground">Žiadne položky na riešenie.</p>
              )}
              {[...phase2Items, ...phase3Items].map(item => {
                const created = new Date(item.createdAt!);
                const pulse = isAdminAlert(created);
                const done = item.phase === 3;
                return (
                  <div
                    key={item.id}
                    data-testid={`row-kokpit-r3-${item.id}`}
                    className="flex items-center gap-3 border rounded-lg px-3 py-2"
                    style={{ opacity: done ? 0.6 : 1, background: !done && isOverdue(created) ? "rgba(234,88,12,0.06)" : undefined }}
                  >
                    <TripleRingStatus phase={item.phase as 1 | 2 | 3} size={22} pulsing={!done && pulse} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.contractUid || "—"} · {item.statusName || "—"}</p>
                    </div>
                    <AgingBadge dayCreated={item.dayCreated} />
                    {!done && (
                      <SlaTimer createdAt={item.createdAt!} resolvedAt={null} />
                    )}
                    {done ? (
                      <span className="text-xs text-green-600 font-semibold">✓ Vybavené</span>
                    ) : (
                      <Button
                        size="sm"
                        data-testid={`button-resolve-${item.id}`}
                        onClick={() => handleOpenResolve(item)}
                        disabled={!item.contractId}
                      >
                        Zapísať do zmluvy
                      </Button>
                    )}
                  </div>
                );
              })}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {resolveItem && resolveItem.contractId && (
        <StatusChangeModal
          open={statusModalOpen}
          onOpenChange={v => {
            setStatusModalOpen(v);
            if (!v) setResolveItem(null);
          }}
          contractId={resolveItem.contractId}
          currentStatusId={null}
          statuses={statuses}
          onSuccess={async () => {
            await resolveMutation.mutateAsync(resolveItem.id);
            setStatusModalOpen(false);
            setResolveItem(null);
          }}
        />
      )}
    </>
  );
}
