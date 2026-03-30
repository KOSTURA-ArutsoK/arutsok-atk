import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { TripleRingStatus } from "@/components/TripleRingStatus";
import { FileText, Loader2, X, Archive, Search, Inbox, Upload, Image as ImageIcon, File, FileCheck, Eye } from "lucide-react";
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

function getFileTypeIcon(name: string, className = "w-3.5 h-3.5 shrink-0") {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return <FileText className={`${className} text-red-500`} />;
  if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) return <ImageIcon className={`${className} text-amber-500`} />;
  if (['doc','docx'].includes(ext)) return <FileCheck className={`${className} text-blue-500`} />;
  return <File className={`${className} text-muted-foreground`} />;
}

function getFileTypeBadge(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return <span className="text-[9px] font-bold uppercase tracking-wide text-red-500 bg-red-500/10 rounded px-1">PDF</span>;
  if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) return <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-500/10 rounded px-1">{ext.toUpperCase()}</span>;
  if (ext === 'docx' || ext === 'doc') return <span className="text-[9px] font-bold uppercase tracking-wide text-blue-600 bg-blue-500/10 rounded px-1">W</span>;
  return null;
}

const IMAGE_EXTS = ['jpg','jpeg','png','gif','webp','bmp'];
function isImageFile(name: string) { return IMAGE_EXTS.includes(name.split('.').pop()?.toLowerCase() ?? ''); }
function isPdfFile(name: string) { return name.split('.').pop()?.toLowerCase() === 'pdf'; }

// ── KROK 1: 3-stĺpcový layout (Previewer | Inbox | Trezor) ────────────────────

interface Step1PanelProps {
  scanFiles: ScanFile[];
  onRemoveScanFile: (id: string) => void;
  onAddFiles: (files: File[]) => void;
}

function Step1Panel({ scanFiles, onRemoveScanFile, onAddFiles }: Step1PanelProps) {
  const { toast } = useToast();
  const [selectedScanIds, setSelectedScanIds] = useState<Set<string>>(new Set());
  const [inboxDragOver, setInboxDragOver] = useState(false);
  const inboxFileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
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
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const qNoSpace = q.replace(/\s/g, "");
    const uid = (c.uid ?? "").replace(/\s/g, "").toLowerCase();
    const code = (c.supiskaCode ?? "").toLowerCase();
    const sub = subjects.find(s => s.id === c.subjectId);
    const subName = subjectDisplay(sub).toLowerCase();
    const partner = partners.find(p => p.id === c.partnerId);
    const partnerName = (partner?.name ?? partner?.code ?? "").toLowerCase();
    const product = products.find(p => p.id === c.productId);
    const productName = (product?.name ?? "").toLowerCase();
    return uid.includes(qNoSpace) || code.includes(q) || subName.includes(q) || partnerName.includes(q) || productName.includes(q);
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
      toast({ title: "Vyberte skeny", description: "Najprv vyberte jeden alebo viac skenov v strednom paneli.", variant: "destructive" });
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

  const selectedIdArr = [...selectedScanIds];
  const previewFile = selectedIdArr.length === 1 ? scanFiles.find(f => f.id === selectedIdArr[0]) : null;

  return (
    <div className="flex flex-row flex-1 min-h-0 w-full">

      {/* ─── LEFT: Scan previewer (~25%) ──────────────────────────────────── */}
      <div className="flex flex-col border-r shrink-0" style={{ width: "25%", minWidth: 160 }}>
        <div className="px-3 py-2 border-b shrink-0 flex items-center gap-2 bg-muted/20">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Náhľad skenu</span>
        </div>
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-3 overflow-hidden">
          {selectedScanIds.size === 0 ? (
            <div className="text-center text-muted-foreground space-y-2">
              <ImageIcon className="w-10 h-10 mx-auto opacity-20" />
              <p className="text-xs">Vyberte sken</p>
              <p className="text-[10px] opacity-60">Zaškrtnite sken v strednom stĺpci</p>
            </div>
          ) : selectedScanIds.size > 1 ? (
            <div className="text-center text-muted-foreground space-y-1">
              <p className="text-xs font-medium">Vyberte 1 sken pre náhľad</p>
              <p className="text-[10px]">{selectedScanIds.size} skenov vybraných</p>
            </div>
          ) : previewFile && !previewFile.done && !previewFile.error ? (
            <div className="text-center text-muted-foreground space-y-2">
              <Loader2 className="w-6 h-6 mx-auto animate-spin" />
              <p className="text-xs">Nahráva sa… {previewFile.progress}%</p>
            </div>
          ) : previewFile?.url && isImageFile(previewFile.name) ? (
            <img
              src={previewFile.url}
              alt={previewFile.name}
              className="max-w-full max-h-full object-contain rounded shadow-sm"
              data-testid="preview-image"
            />
          ) : previewFile?.url && isPdfFile(previewFile.name) ? (
            <iframe
              src={previewFile.url}
              title={previewFile.name}
              className="w-full flex-1 border-0 rounded"
              style={{ minHeight: 200 }}
              data-testid="preview-pdf"
            />
          ) : previewFile ? (
            <div className="text-center text-muted-foreground space-y-2">
              {getFileTypeIcon(previewFile.name, "w-10 h-10 mx-auto")}
              <p className="text-xs truncate max-w-[130px]">{previewFile.name}</p>
              <p className="text-[10px]">Náhľad nedostupný</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── MIDDLE: Inbox / Nahrávanie (~40%) ───────────────────────────── */}
      <div className="flex flex-col border-r shrink-0" style={{ width: "40%", minWidth: 220 }}>
        {/* Header */}
        <div className="px-3 py-2 border-b shrink-0 flex items-center gap-2 bg-muted/20">
          <Inbox className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Inbox</span>
          {(() => {
            const selectable = scanFiles.filter(f => f.done && !f.error).length;
            const sel = selectedScanIds.size;
            return (
              <Badge className={`text-xs ${sel > 0 ? "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-400/50" : "bg-muted/50 text-muted-foreground border-border"}`}>
                {sel} / {selectable}
              </Badge>
            );
          })()}
          <Badge variant="outline" className="text-xs ml-auto">{scanFiles.length} súborov</Badge>
        </div>

        {/* Drop zone */}
        <div
          className={`mx-3 mt-3 mb-2 rounded-lg border-2 border-dashed flex flex-col items-center justify-center py-3 px-3 transition-colors cursor-pointer shrink-0 ${
            inboxDragOver ? "border-blue-500 bg-blue-500/10" : "border-blue-400/50 hover:border-blue-500 hover:bg-blue-500/5"
          }`}
          onDragOver={(e) => { e.preventDefault(); setInboxDragOver(true); }}
          onDragLeave={() => setInboxDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setInboxDragOver(false);
            const files = Array.from(e.dataTransfer.files).filter(f => f.size > 0);
            if (files.length > 0) onAddFiles(files);
          }}
          onClick={() => inboxFileInputRef.current?.click()}
          data-testid="dropzone-kokpit-inbox"
        >
          <Upload className="w-5 h-5 text-blue-500 mb-1" />
          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Pretiahnite skeny sem</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">PDF, obrázky — kliknite pre výber</p>
          <input
            ref={inboxFileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,.doc,.docx"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []).filter(f => f.size > 0);
              if (files.length > 0) onAddFiles(files);
              e.target.value = "";
            }}
          />
        </div>

        {/* File list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3 space-y-1">
          {scanFiles.length === 0 && (
            <p className="text-xs text-muted-foreground text-center pt-4">Žiadne súbory</p>
          )}
          {scanFiles.map((file) => {
            const isSelected = selectedScanIds.has(file.id);
            const paired = pairedMap[file.id];
            const isUploadDone = file.done && !file.error;
            return (
              <div
                key={file.id}
                data-testid={`file-inbox-${file.id}`}
                className={`rounded-md border px-2 py-1.5 transition-colors ${
                  isSelected
                    ? "bg-orange-500/10 border-orange-500 ring-1 ring-orange-500/40 cursor-pointer"
                    : paired
                    ? "bg-emerald-500/10 border-emerald-500/30 cursor-pointer"
                    : isUploadDone
                    ? "hover:bg-muted/40 border-border cursor-pointer"
                    : "border-border"
                } ${!file.done && !file.error ? "opacity-70" : ""}`}
                onClick={() => { if (isUploadDone) toggleScan(file.id); }}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isUploadDone ? (
                    <input
                      type="checkbox"
                      className="h-3 w-3 shrink-0 accent-orange-500"
                      checked={isSelected}
                      onChange={(e) => { e.stopPropagation(); toggleScan(file.id); }}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-scan-${file.id}`}
                    />
                  ) : (
                    <span className="w-3 h-3 shrink-0" />
                  )}
                  {isSelected
                    ? getFileTypeIcon(file.name, "w-3.5 h-3.5 shrink-0 text-orange-500")
                    : paired
                    ? getFileTypeIcon(file.name, "w-3.5 h-3.5 shrink-0 text-emerald-500")
                    : getFileTypeIcon(file.name)}
                  <span className="text-xs font-mono truncate flex-1">{file.name}</span>
                  {getFileTypeBadge(file.name)}
                  <span className="text-[10px] text-muted-foreground shrink-0">{fmtSize(file.size)}</span>
                  <button
                    data-testid={`button-inbox-remove-${file.id}`}
                    onClick={(e) => { e.stopPropagation(); onRemoveScanFile(file.id); }}
                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0 ml-1"
                  >
                    <X size={11} />
                  </button>
                </div>
                {file.error ? (
                  <p className="text-[10px] text-red-500 mt-0.5">{file.error}</p>
                ) : !file.done ? (
                  <div className="mt-1 h-1 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${file.progress}%` }} />
                  </div>
                ) : paired ? (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">→ {paired.contractUid}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {selectedScanIds.size > 0 && (
          <div className="px-3 py-2 border-t text-xs text-muted-foreground bg-blue-500/5 shrink-0">
            {selectedScanIds.size} sken{selectedScanIds.size === 1 ? "" : "ov"} vybraných — vyberte zmluvu vpravo
          </div>
        )}
      </div>

      {/* ─── RIGHT: Vyhľadávanie zmluvy (flex-1) ─────────────────────────── */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0">
        <div className="px-3 py-2 border-b shrink-0 flex items-center gap-2 bg-muted/20">
          <Archive className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Vyhľadávanie zmluvy</span>
          <Badge variant="outline" className="text-[10px] ml-auto">{contractsRaw.length} zmlúv</Badge>
        </div>

        {/* Unified search input */}
        <div className="px-3 py-2 border-b shrink-0">
          <div className="relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              data-testid="input-trezor-search"
              placeholder="Hľadať zmluvu… (UID, číslo, subjekt, partner, produkt)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-7 text-xs pl-7 pr-2"
            />
          </div>
        </div>

        {/* Contract list */}
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
                      <td className="py-1.5 px-2 truncate max-w-[80px]">{subjectDisplay(sub)}</td>
                      <td className="py-1.5 px-2 text-muted-foreground">{partner?.code ?? partner?.name ?? "—"}</td>
                      <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[70px]">{product?.name ?? "—"}</td>
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
  onAddFiles: (files: File[]) => void;
}

export function KokpitDialog({ open, onOpenChange, scanFiles, onRemoveScanFile, onAddFiles }: KokpitDialogProps) {
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

            {/* PRÍCHOD — Krok 1: 3-stĺpcový layout */}
            <TabsContent value="prichod" className="flex-1 min-h-0 m-0" style={{ display: 'flex' }}>
              <Step1Panel scanFiles={scanFiles} onRemoveScanFile={onRemoveScanFile} onAddFiles={onAddFiles} />
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
