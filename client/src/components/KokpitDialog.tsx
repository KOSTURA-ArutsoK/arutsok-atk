import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { TripleRingStatus } from "@/components/TripleRingStatus";
import { FileText, CheckCircle2, AlertCircle, Loader2, X, Archive, Search } from "lucide-react";
import type { KokpitItem } from "@shared/schema";
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
      return data.data ?? data.contracts ?? (Array.isArray(data) ? data : []);
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
    <div className="flex flex-col flex-1 min-h-0 divide-y">
      {/* TOP: Inbox */}
      <div className="flex flex-col shrink-0" style={{ height: "40%" }}>
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

      {/* BOTTOM: Trezor */}
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
          {filteredContracts.length === 0 ? (
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
  scanFiles: ScanFile[];
  onRemoveScanFile: (id: string) => void;
}

export function KokpitDialog({ open, onOpenChange, scanFiles, onRemoveScanFile }: KokpitDialogProps) {
  const [activeTab, setActiveTab] = useState("prichod");

  const { data: items = [] } = useQuery<KokpitItemExt[]>({
    queryKey: ["/api/kokpit/items"],
    enabled: open,
  });

  const phase2Items = items.filter(i => i.phase === 2);
  const phase3Items = items.filter(i => i.phase === 3);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="p-0 gap-0 flex flex-col"
          style={{ maxWidth: "90vw", width: "90vw", height: "85vh", maxHeight: "85vh" }}
        >
          <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
            <DialogTitle className="text-lg font-bold">Kokpit — Spracovanie stavov</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
            <TabsList className="mx-6 mt-3 shrink-0 justify-start bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 p-1 gap-1">
              <TabsTrigger value="prichod" data-testid="tab-prichod" className="font-semibold data-[state=active]:bg-blue-700 data-[state=active]:text-white data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300">
                PRÍCHOD / SKENY
                {scanFiles.filter(f => f.done && !f.error).length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{scanFiles.filter(f => f.done && !f.error).length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="rozdelenie" data-testid="tab-rozdelenie" className="font-semibold data-[state=active]:bg-blue-700 data-[state=active]:text-white data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300">
                ROZDELENIE
                {phase2Items.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{phase2Items.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="riesenie" data-testid="tab-riesenie" className="font-semibold data-[state=active]:bg-blue-700 data-[state=active]:text-white data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300">
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

            {/* ROZDELENIE — Krok 2 — placeholder */}
            <TabsContent value="rozdelenie" className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16" data-testid="placeholder-rozdelenie">
                <TripleRingStatus phase={2} size={40} />
                <p className="text-sm font-semibold">Rozdelenie — pripravuje sa</p>
                <p className="text-xs text-center max-w-xs">
                  Fáza Rozdelenia bude implementovaná v ďalšej verzii Kokpitu. Tu sa budú priraďovať skeny k zmluvám a spúšťať pracovné toky.
                </p>
              </div>
            </TabsContent>

            {/* RIEŠENIE — Krok 3 — placeholder */}
            <TabsContent value="riesenie" className="flex-1 overflow-y-auto px-6 py-4">
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16" data-testid="placeholder-riesenie">
                <TripleRingStatus phase={3} size={40} />
                <p className="text-sm font-semibold">Riešenie — pripravuje sa</p>
                <p className="text-xs text-center max-w-xs">
                  Fáza Riešenia bude implementovaná v ďalšej verzii Kokpitu. Tu sa budú záznamy zapisovať do zmlúv a uzatvárať.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
