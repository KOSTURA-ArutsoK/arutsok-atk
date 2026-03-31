import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { TripleRingStatus } from "@/components/TripleRingStatus";
import {
  FileText, Loader2, X, Archive, Search, Inbox, Upload,
  Image as ImageIcon, File, FileCheck, Eye, CheckCircle2, Clock, Pin,
} from "lucide-react";
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
  lifecyclePhase?: number | null;
  statusId?: number | null;
};

type Subject = { id: number; firstName?: string | null; lastName?: string | null; companyName?: string | null };
type Partner = { id: number; name?: string | null; code?: string | null };
type Product = { id: number; name?: string | null };

type CompletedItem = {
  id: string;
  contract: TrezorContract;
  contractLabel: string;
  subjectLabel: string;
  partnerLabel: string;
  productLabel: string;
  scans: ScanFile[];
  completedAt: number;
};

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

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function getFileTypeIcon(name: string, className = "w-3.5 h-3.5 shrink-0") {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return <FileText className={`${className} text-red-500`} />;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return <ImageIcon className={`${className} text-amber-500`} />;
  if (['doc', 'docx'].includes(ext)) return <FileCheck className={`${className} text-blue-500`} />;
  return <File className={`${className} text-muted-foreground`} />;
}

function getFileTypeBadge(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return <span className="text-[9px] font-bold uppercase tracking-wide text-red-500 bg-red-500/10 rounded px-1">PDF</span>;
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-500/10 rounded px-1">{ext.toUpperCase()}</span>;
  if (ext === 'docx' || ext === 'doc') return <span className="text-[9px] font-bold uppercase tracking-wide text-blue-600 bg-blue-500/10 rounded px-1">W</span>;
  return null;
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'];
function isImageFile(name: string) { return IMAGE_EXTS.includes(name.split('.').pop()?.toLowerCase() ?? ''); }
function isPdfFile(name: string) { return name.split('.').pop()?.toLowerCase() === 'pdf'; }

// ── Step1Panel ────────────────────────────────────────────────────────────────

interface Step1PanelProps {
  scanFiles: ScanFile[];
  onRemoveScanFile: (id: string, reason?: string) => void;
  onAddFiles: (files: File[]) => void;
  onComplete: (item: CompletedItem) => void;
  onSwitchTab: (tab: string) => void;
}

function Step1Panel({ scanFiles, onRemoveScanFile, onAddFiles, onComplete, onSwitchTab }: Step1PanelProps) {
  const { toast } = useToast();
  const [selectedScanIds, setSelectedScanIds] = useState<Set<string>>(new Set());
  const [inboxDragOver, setInboxDragOver] = useState(false);
  const inboxFileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pairedMap, setPairedMap] = useState<Record<string, { contractId: number; contractUid: string }>>({});
  const [zoomLevel, setZoomLevel] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const isImagePreviewRef = useRef(false);
  const [pinnedContractIds, setPinnedContractIds] = useState<Set<number>>(new Set());
  const [scanPendingDelete, setScanPendingDelete] = useState<string | null>(null);

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

  // Iba zmluvy fázy 10 (Prijaté obch. partnerom) sú dostupné v Kokpite
  const phase10Contracts = contractsRaw.filter(c => c.lifecyclePhase === 10);

  const filteredContracts = !searchQuery.trim() ? [] : phase10Contracts.filter(c => {
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
      selectedScanIds.forEach(id => { next[id] = { contractId: contract.id, contractUid }; });
      return next;
    });
    setSelectedScanIds(new Set());
    toast({ title: "Pridelené", description: `${selectedScanIds.size} sken(ov) priradených ku zmluve ${contractUid}` });
  }

  function handleComplete(contract: TrezorContract) {
    const sub = subjects.find(s => s.id === contract.subjectId);
    const partner = partners.find(p => p.id === contract.partnerId);
    const product = products.find(p => p.id === contract.productId);
    const contractLabel = contract.uid ?? contract.supiskaCode ?? String(contract.id);

    const pairedScanIds = Object.entries(pairedMap)
      .filter(([, v]) => v.contractId === contract.id)
      .map(([id]) => id);
    const pairedScans = scanFiles.filter(f => pairedScanIds.includes(f.id));

    const item: CompletedItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      contract,
      contractLabel,
      subjectLabel: subjectDisplay(sub),
      partnerLabel: partner?.code ?? partner?.name ?? "—",
      productLabel: product?.name ?? "—",
      scans: pairedScans,
      completedAt: Date.now(),
    };

    setPairedMap(prev => {
      const next = { ...prev };
      pairedScanIds.forEach(id => delete next[id]);
      return next;
    });
    pairedScanIds.forEach(id => onRemoveScanFile(id, 'assigned'));
    setPinnedContractIds(prev => { const next = new Set(prev); next.delete(contract.id); return next; });

    onComplete(item);
    onSwitchTab("rozdelenie");
    toast({ title: "Presunté do Riešenia", description: `Zmluva ${contractLabel} s ${pairedScans.length} sken(mi) presunutá.` });
  }

  function handlePinContract(contractId: number) {
    setPinnedContractIds(prev => {
      const next = new Set(prev);
      if (next.has(contractId)) next.delete(contractId); else next.add(contractId);
      return next;
    });
  }

  const selectedIdArr = [...selectedScanIds];
  const previewFile = selectedIdArr.length === 1 ? scanFiles.find(f => f.id === selectedIdArr[0]) : null;

  // Reset zoom when selected file changes; track whether current preview is an image
  useEffect(() => {
    isImagePreviewRef.current = !!(previewFile?.url && isImageFile(previewFile.name));
    setZoomLevel(1);
  }, [previewFile?.id]);

  // Non-passive wheel listener for pinch-to-zoom (ctrlKey = pinch on trackpad)
  // Only active when the current preview is an image; PDF uses native browser zoom
  useEffect(() => {
    const el = previewContainerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (!e.ctrlKey || !isImagePreviewRef.current) return;
      e.preventDefault();
      const delta = e.deltaY * -0.005;
      setZoomLevel(prev => Math.min(4, Math.max(0.25, prev + delta)));
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  return (
    <div className="flex flex-row flex-1 min-h-0 w-full">

      {/* ─── LEFT: Náhľad skenu (flex-4) ──────────────────────────────────── */}
      <div className="flex flex-col border-r min-w-0" style={{ flex: 4 }}>
        <div className="px-3 py-2 border-b shrink-0 flex items-center gap-2 bg-muted/20">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">Náhľad skenu</span>
        </div>
        <div
          ref={previewContainerRef}
          className="flex-1 min-h-0 flex flex-col items-center justify-center p-3 overflow-hidden relative"
        >
          {/* Zoom badge — klik resetuje na 100 % */}
          {zoomLevel !== 1 && previewFile?.url && isImageFile(previewFile.name) && (
            <button
              data-testid="button-zoom-reset"
              onClick={() => setZoomLevel(1)}
              title="Kliknite pre reset na 100 %"
              className="absolute top-2 right-2 z-10 text-[10px] font-medium bg-black/60 text-white rounded px-1.5 py-0.5 hover:bg-black/80 transition-colors"
            >
              {Math.round(zoomLevel * 100)} %
            </button>
          )}

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
            <div
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: "center center",
                transition: "transform 0.08s ease-out",
                maxWidth: "100%",
                maxHeight: "100%",
              }}
            >
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-w-full max-h-full object-contain rounded shadow-sm"
                style={{ display: "block" }}
                data-testid="preview-image"
              />
            </div>
          ) : previewFile?.url && isPdfFile(previewFile.name) ? (
            <div className="flex flex-col w-full flex-1 gap-1.5 min-h-0">
              <iframe src={previewFile.url} className="w-full flex-1 rounded border-0" style={{ minHeight: 200 }} data-testid="preview-pdf" title={previewFile.name} />
            </div>
          ) : previewFile ? (
            <div className="text-center text-muted-foreground space-y-2">
              {getFileTypeIcon(previewFile.name, "w-10 h-10 mx-auto")}
              <p className="text-xs truncate max-w-[130px]">{previewFile.name}</p>
              <p className="text-[10px]">Náhľad nedostupný</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* ─── MIDDLE: Inbox (flex-2) ───────────────────────────────────────── */}
      <div className="flex flex-col border-r min-w-0" style={{ flex: 2 }}>
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
          <Badge variant="outline" className="text-xs ml-auto">{scanFiles.length}</Badge>
        </div>

        <div
          className={`mx-2 mt-2 mb-1.5 rounded-lg border-2 border-dashed flex flex-col items-center justify-center py-2.5 px-2 transition-colors cursor-pointer shrink-0 ${
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
          <Upload className="w-4 h-4 text-blue-500 mb-0.5" />
          <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">Pretiahnite skeny</p>
          <p className="text-[9px] text-muted-foreground">alebo kliknite</p>
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

        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-1">
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
                className={`rounded-md border px-1.5 py-1 transition-colors ${
                  isSelected ? "bg-orange-500/10 border-orange-500 ring-1 ring-orange-500/40 cursor-pointer"
                  : paired ? "bg-emerald-500/10 border-emerald-500/30 cursor-pointer"
                  : isUploadDone ? "hover:bg-muted/40 border-border cursor-pointer"
                  : "border-border"
                } ${!file.done && !file.error ? "opacity-70" : ""}`}
                onClick={() => { if (isUploadDone) toggleScan(file.id); }}
              >
                <div className="flex items-center gap-1 min-w-0">
                  {isUploadDone ? (
                    <input type="checkbox" className="h-3 w-3 shrink-0 accent-orange-500" checked={isSelected}
                      onChange={(e) => { e.stopPropagation(); toggleScan(file.id); }}
                      onClick={(e) => e.stopPropagation()}
                      data-testid={`checkbox-scan-${file.id}`}
                    />
                  ) : <span className="w-3 h-3 shrink-0" />}
                  {isSelected ? getFileTypeIcon(file.name, "w-3 h-3 shrink-0 text-orange-500")
                    : paired ? getFileTypeIcon(file.name, "w-3 h-3 shrink-0 text-emerald-500")
                    : getFileTypeIcon(file.name, "w-3 h-3 shrink-0")}
                  <span className="text-[10px] font-mono truncate flex-1">{file.name}</span>
                  {getFileTypeBadge(file.name)}
                  <button
                    data-testid={`button-inbox-remove-${file.id}`}
                    onClick={(e) => { e.stopPropagation(); setScanPendingDelete(file.id); }}
                    className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <X size={10} />
                  </button>
                </div>
                {file.error ? (
                  <p className="text-[9px] text-red-500 mt-0.5">{file.error}</p>
                ) : !file.done ? (
                  <div className="mt-0.5 h-0.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-blue-500 transition-all" style={{ width: `${file.progress}%` }} />
                  </div>
                ) : paired ? (
                  <p className="text-[9px] text-emerald-600 dark:text-emerald-400 mt-0.5 truncate">→ {paired.contractUid}</p>
                ) : null}
              </div>
            );
          })}
        </div>

        {selectedScanIds.size > 0 && (
          <div className="px-2 py-1.5 border-t text-[10px] text-muted-foreground bg-blue-500/5 shrink-0">
            {selectedScanIds.size} sken{selectedScanIds.size === 1 ? "" : "ov"} vybraných — vyberte zmluvu vpravo
          </div>
        )}
      </div>

      {/* ─── RIGHT: Vyhľadávanie zmluvy (flex-3) ─────────────────────────── */}
      {(() => {
        const pinnedContracts = phase10Contracts.filter(c => pinnedContractIds.has(c.id));
        const extraFiltered = filteredContracts.filter(c => !pinnedContractIds.has(c.id));
        const displayedContracts = [...pinnedContracts, ...extraFiltered];

        return (
          <div className="flex flex-col min-w-0" style={{ flex: 3 }}>
            <div className="px-3 py-2 border-b shrink-0 flex items-center gap-2 bg-muted/20">
              <Archive className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Vyhľadávanie zmluvy</span>
              {pinnedContractIds.size > 0 && (
                <Badge className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-400/50">
                  <Pin className="w-2.5 h-2.5 mr-0.5" />{pinnedContractIds.size}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] ml-auto">{phase10Contracts.length} zmlúv</Badge>
            </div>

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

            <div className="flex-1 overflow-y-auto">
              {displayedContracts.length === 0 ? (
                !searchQuery.trim() ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground py-8">
                    <Search className="w-8 h-8 opacity-20" />
                    <p className="text-xs text-center">Zadajte hľadaný výraz</p>
                    <p className="text-[10px] text-center opacity-70">UID, číslo zmluvy, subjekt, partner alebo produkt</p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-8">Žiadne zmluvy</p>
                )
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/20 sticky top-0">
                      <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">UID</th>
                      <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">Číslo</th>
                      <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">Subjekt</th>
                      <th className="py-1.5 px-2 w-28"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedContracts.map(c => {
                      const isPinned = pinnedContractIds.has(c.id);
                      const sub = subjects.find(s => s.id === c.subjectId);
                      const pairedCount = Object.values(pairedMap).filter(v => v.contractId === c.id).length;
                      return (
                        <tr
                          key={c.id}
                          data-testid={`row-trezor-${c.id}`}
                          className={`border-b transition-colors cursor-pointer ${
                            isPinned
                              ? "bg-blue-500/[0.08] border-blue-400/30 hover:bg-blue-500/[0.14]"
                              : "border-border/30 hover:bg-muted/30"
                          }`}
                          onClick={() => handlePinContract(c.id)}
                        >
                          <td className="py-1.5 px-2 font-mono text-[10px] text-blue-700 dark:text-blue-400">
                            <span className="flex items-center gap-1">
                              {isPinned && <Pin className="w-2.5 h-2.5 shrink-0 text-blue-500" />}
                              {c.uid ?? "—"}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-muted-foreground text-[10px]">{c.supiskaCode ?? "—"}</td>
                          <td className="py-1.5 px-2 truncate max-w-[80px]">
                            {subjectDisplay(sub)}
                            {pairedCount > 0 && (
                              <span className="ml-1 text-[9px] text-emerald-600 bg-emerald-500/10 rounded px-1">{pairedCount} sk.</span>
                            )}
                          </td>
                          <td className="py-1.5 px-1.5" onClick={e => e.stopPropagation()}>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" data-testid={`button-assign-contract-${c.id}`} className="h-5 px-1.5 text-[10px]" onClick={() => handleAssign(c)}>
                                Priradiť
                              </Button>
                              <Button size="sm" variant="outline" data-testid={`button-complete-contract-${c.id}`} className="h-5 px-1.5 text-[10px] border-emerald-500/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10" onClick={() => handleComplete(c)}>
                                Dokončiť
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        );
      })()}

      {/* Potvrdenie vymazania skenu */}
      {scanPendingDelete !== null && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.5)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-background border rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 flex flex-col gap-4">
            <p className="text-sm font-semibold text-foreground">Presunúť sken do koša?</p>
            <p className="text-xs text-muted-foreground">Súbor bude presunutý do koša. Môžete ho obnoviť v sekcii Archív → Skeny.</p>
            <div className="flex gap-2 justify-end">
              <Button
                size="sm"
                variant="outline"
                data-testid="button-confirm-delete-cancel"
                onClick={() => setScanPendingDelete(null)}
              >
                Zrušiť
              </Button>
              <Button
                size="sm"
                variant="destructive"
                data-testid="button-confirm-delete-ok"
                onClick={() => {
                  onRemoveScanFile(scanPendingDelete);
                  setScanPendingDelete(null);
                }}
              >
                Presunúť do koša
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RieseniePanel ─────────────────────────────────────────────────────────────

type ContractStatusInfo = { id: number; name: string; color: string };

type ScanInfo = { name: string; url: string; size: number };

type RiesenieDisplayItem = {
  id: string;
  contractLabel: string;
  subjectLabel: string;
  statusId: number | null;
  scans: ScanInfo[];
  completedAt: number;
};

function ScanPreview({ scan, idx }: { scan: ScanInfo; idx: number }) {
  const ext = scan.name.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
  const isPdf = ext === 'pdf';

  return (
    <div className="space-y-1" data-testid={`scan-preview-block-${idx}`}>
      <div className="flex items-center gap-1.5 px-0.5">
        {getFileTypeIcon(scan.name, "w-3 h-3 shrink-0")}
        <span className="text-[10px] font-mono text-muted-foreground truncate flex-1">{scan.name}</span>
        {getFileTypeBadge(scan.name)}
        <span className="text-[9px] text-muted-foreground shrink-0">{fmtSize(scan.size)}</span>
      </div>
      {isImage ? (
        <img
          src={scan.url}
          alt={scan.name}
          className="w-full rounded border object-contain"
          data-testid={`preview-riesenie-img-${idx}`}
        />
      ) : isPdf ? (
        <iframe
          src={scan.url}
          title={scan.name}
          className="w-full rounded border-0"
          style={{ height: 420 }}
          data-testid={`preview-riesenie-pdf-${idx}`}
        />
      ) : (
        <iframe
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(scan.url)}&embedded=true`}
          title={scan.name}
          className="w-full rounded border-0"
          style={{ height: 420 }}
          data-testid={`preview-riesenie-doc-${idx}`}
        />
      )}
    </div>
  );
}

function RieseniePanel({ items }: { items: RiesenieDisplayItem[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: contractStatuses = [] } = useQuery<ContractStatusInfo[]>({
    queryKey: ["/api/contract-statuses"],
  });

  useEffect(() => {
    if (items.length > 0 && !selectedId) {
      setSelectedId(items[0].id);
    }
  }, [items, selectedId]);

  const selectedItem = items.find(i => i.id === selectedId) ?? null;
  const scansToShow = selectedItem?.scans ?? [];

  const selectedStatus = contractStatuses.find(s => s.id === selectedItem?.statusId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' }}>

      {/* ─── HORE: Prijaté zmluvy — cez celú šírku, vypĺňa dostupný priestor ─ */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 0', minHeight: 0, borderBottom: '1px solid var(--border)' }}>
        <div className="px-3 py-1.5 border-b shrink-0 flex items-center gap-2 bg-muted/20">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-semibold">Prijaté zmluvy</span>
          <Badge className="text-xs bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400/50 ml-auto">{items.length}</Badge>
        </div>
        <div className="overflow-y-auto" style={{ flex: '1 1 0', minHeight: 0 }}>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="py-1.5 px-2 text-left font-semibold text-muted-foreground border-b bg-muted/30 sticky top-0 z-10">Zmluva</th>
                <th className="py-1.5 px-2 text-left font-semibold text-muted-foreground border-b bg-muted/30 sticky top-0 z-10">Subjekt</th>
                <th className="py-1.5 px-2 text-center font-semibold text-muted-foreground border-b bg-muted/30 sticky top-0 z-10 w-10">Sk.</th>
                <th className="py-1.5 px-2 text-left font-semibold text-muted-foreground border-b bg-muted/30 sticky top-0 z-10">Stav</th>
                <th className="py-1.5 px-2 text-right font-semibold text-muted-foreground border-b bg-muted/30 sticky top-0 z-10 w-14">Čas</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-muted-foreground">
                    Zatiaľ žiadne záznamy — po stlačení „Dokončiť" v ROZDELENÍ SKENOV sa zmluva objaví tu.
                  </td>
                </tr>
              )}
              {items.map(item => {
                const status = contractStatuses.find(s => s.id === item.statusId);
                const isSelected = item.id === selectedId;
                return (
                  <tr
                    key={item.id}
                    data-testid={`row-riesenie-${item.id}`}
                    onClick={() => setSelectedId(item.id)}
                    className={`border-b border-border/30 last:border-0 cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-blue-50 dark:bg-blue-950/40 border-l-2 border-l-blue-500"
                        : "hover:bg-muted/20"
                    }`}
                  >
                    <td className="py-1 px-2 font-mono text-[10px] text-blue-700 dark:text-blue-400 whitespace-nowrap">{item.contractLabel}</td>
                    <td className="py-1 px-2 text-[10px] truncate max-w-[140px]">{item.subjectLabel}</td>
                    <td className="py-1 px-2 text-center">
                      <Badge variant="outline" className="text-[9px] px-1 h-4">{item.scans.length}</Badge>
                    </td>
                    <td className="py-1 px-2">
                      {status ? (
                        <div className="flex items-center gap-1 min-w-0">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                          <span className="text-[10px] truncate">{status.name}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-1 px-2 text-right text-muted-foreground text-[10px] whitespace-nowrap">{fmtTime(item.completedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── DOLE: dva panely vedľa seba — pevná výška ───────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'row', flexShrink: 0, height: 200 }}>

        {/* DOLE ĽAVÝ: Náhľad skenov */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0 border-r">
          <div className="px-3 py-1.5 border-b shrink-0 flex items-center gap-2 bg-muted/20">
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Náhľad skenov</span>
            <Badge variant="outline" className="text-xs ml-auto">{scansToShow.length}</Badge>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-3 pt-2 space-y-4">
            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
                <TripleRingStatus phase={2} size={26} />
                <p className="text-xs font-semibold mt-1">Žiadne záznamy</p>
              </div>
            )}
            {items.length > 0 && !selectedItem && (
              <p className="text-xs text-muted-foreground text-center pt-6">Vyberte záznam vyššie.</p>
            )}
            {selectedItem && scansToShow.length === 0 && (
              <p className="text-xs text-muted-foreground text-center pt-6" data-testid="no-scans-placeholder">
                Žiadne skeny k tejto zmluve.
              </p>
            )}
            {scansToShow.map((scan, idx) => (
              <ScanPreview key={`${selectedItem?.id}-${idx}`} scan={scan} idx={idx} />
            ))}
          </div>
        </div>

        {/* DOLE PRAVÝ: Detail záznamu */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">
          <div className="px-3 py-1.5 border-b shrink-0 flex items-center gap-2 bg-muted/20">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Detail záznamu</span>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3">
            {!selectedItem ? (
              <p className="text-xs text-muted-foreground text-center pt-6">Vyberte záznam vyššie.</p>
            ) : (
              <div className="flex flex-col gap-2.5 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Zmluva</span>
                  <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">{selectedItem.contractLabel}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Subjekt</span>
                  <span className="font-medium">{selectedItem.subjectLabel}</span>
                </div>
                {selectedStatus && (
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Stav</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selectedStatus.color }} />
                      <span className="font-medium">{selectedStatus.name}</span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Skeny</span>
                  <span>{selectedItem.scans.length} súbor{selectedItem.scans.length === 1 ? "" : selectedItem.scans.length < 5 ? "y" : "ov"}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Čas dokončenia</span>
                  <span className="text-muted-foreground">{new Date(selectedItem.completedAt).toLocaleString("sk-SK")}</span>
                </div>
                {selectedItem.scans.length > 0 && (
                  <div className="flex flex-col gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Priložené súbory</span>
                    {selectedItem.scans.map((scan, i) => (
                      <div key={i} className="flex items-center gap-1.5 py-0.5 border-b border-border/30 last:border-0">
                        <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="text-[10px] truncate">{scan.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
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
  onRemoveScanFile: (id: string, reason?: string) => void;
  onAddFiles: (files: File[]) => void;
}

type RiesenieRecord = {
  id: number;
  contractId: number | null;
  statusId: number | null;
  contractLabel: string | null;
  subjectLabel: string | null;
  scansJson: ScanInfo[] | null;
  completedAt: string;
};

export function KokpitDialog({ open, onOpenChange, scanFiles, onRemoveScanFile, onAddFiles }: KokpitDialogProps) {
  const [activeTab, setActiveTab] = useState("prichod");
  const [completedItems, setCompletedItems] = useState<CompletedItem[]>([]);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const dialogOpenedAt = useRef<number>(Date.now());
  const { toast } = useToast();

  useEffect(() => {
    if (open) dialogOpenedAt.current = Date.now();
  }, [open]);

  const { data: items = [] } = useQuery<KokpitItemExt[]>({
    queryKey: ["/api/kokpit/items"],
    enabled: open,
  });

  const { data: dbRecords = [] } = useQuery<RiesenieRecord[]>({
    queryKey: ["/api/kokpit/riesenie-records"],
    enabled: open,
  });

  const phase3Items = items.filter(i => i.phase === 3);

  function handleComplete(item: CompletedItem) {
    setCompletedItems(prev => [item, ...prev]);
    apiRequest("POST", "/api/kokpit/riesenie-records", {
      contractId: item.contract.id,
      statusId: item.contract.statusId ?? null,
      contractLabel: item.contractLabel,
      subjectLabel: item.subjectLabel,
      scansJson: item.scans.filter(s => s.url && s.done).map(s => ({ name: s.name, url: s.url!, size: s.size })),
    }).catch(() => {
      toast({ title: "Chyba ukladania", description: "Záznam sa nepodarilo uložiť do databázy.", variant: "destructive" });
    });
  }

  const sessionDisplayItems: RiesenieDisplayItem[] = completedItems.map(item => ({
    id: item.id,
    contractLabel: item.contractLabel,
    subjectLabel: item.subjectLabel,
    statusId: item.contract.statusId ?? null,
    scans: item.scans.filter(s => s.url && s.done).map(s => ({ name: s.name, url: s.url!, size: s.size })),
    completedAt: item.completedAt,
  }));

  const dbDisplayItems: RiesenieDisplayItem[] = dbRecords
    .filter(r => new Date(r.completedAt).getTime() < dialogOpenedAt.current)
    .map(r => ({
      id: `db-${r.id}`,
      contractLabel: r.contractLabel ?? "—",
      subjectLabel: r.subjectLabel ?? "—",
      statusId: r.statusId,
      scans: r.scansJson ?? [],
      completedAt: new Date(r.completedAt).getTime(),
    }));

  const allRiesenieItems: RiesenieDisplayItem[] = [
    ...sessionDisplayItems,
    ...dbDisplayItems,
  ].sort((a, b) => b.completedAt - a.completedAt);

  return (
    <>
      {/* Potvrdzovacie okno — Ukončiť */}
      <Dialog open={showConfirmClose} onOpenChange={setShowConfirmClose}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-base font-semibold">Ukončiť spracovanie?</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground mt-1">
            Záložka <strong>Riešenie</strong> ostáva zachovaná. Stratia sa len ukotvené zmluvy z Vyhľadávania a neukončené priradenia skenov.
          </DialogDescription>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              size="sm"
              data-testid="button-confirm-cancel"
              onClick={() => setShowConfirmClose(false)}
            >
              Pokračovať v práci
            </Button>
            <Button
              variant="destructive"
              size="sm"
              data-testid="button-confirm-ukoncit"
              onClick={() => { setShowConfirmClose(false); onOpenChange(false); }}
            >
              Ukončiť
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={onOpenChange}>
        {/* OUTER VRSTVA — 95 vw × 95 vh */}
        <DialogContent
          noInnerScroll
          className="flex items-center justify-center p-0 bg-slate-200/60 dark:bg-slate-900/70 shadow-none border-0 rounded-2xl"
          style={{ maxWidth: "95vw", width: "95vw", height: "95vh", maxHeight: "95vh" }}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* INNER VRSTVA — 90 vw × 90 vh */}
          <div
            className="flex flex-col bg-background rounded-xl shadow-2xl border overflow-hidden"
            style={{ width: "90vw", height: "90vh" }}
          >
            {/* Hlavička */}
            <div className="px-6 pt-4 pb-3 border-b shrink-0 flex items-center justify-between gap-4">
              <DialogTitle className="text-lg font-bold">KOKPIT</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-kokpit-ukoncit"
                className="shrink-0 h-7 px-3 text-xs hover:bg-red-600 hover:text-white hover:border-red-600 dark:hover:bg-red-700 dark:hover:border-red-700"
                onClick={() => setShowConfirmClose(true)}
              >
                Ukončiť
              </Button>
            </div>

            {/* ── Tab lišta ── */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mx-6 mt-3 shrink-0 grid grid-cols-3 bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 p-1 gap-1">
                <TabsTrigger value="prichod" data-testid="tab-prichod" className="w-full text-center font-semibold data-[state=active]:bg-blue-700 data-[state=active]:text-white data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300">
                  ROZDELENIE SKENOV
                  {scanFiles.filter(f => f.done && !f.error).length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-xs">{scanFiles.filter(f => f.done && !f.error).length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="rozdelenie" data-testid="tab-rozdelenie" className="w-full text-center font-semibold data-[state=active]:bg-blue-700 data-[state=active]:text-white data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300">
                  RIEŠENIE
                  {allRiesenieItems.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-xs">{allRiesenieItems.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="riesenie" data-testid="tab-riesenie" className="w-full text-center font-semibold data-[state=active]:bg-blue-700 data-[state=active]:text-white data-[state=inactive]:text-slate-600 dark:data-[state=inactive]:text-slate-300">
                  VYHODNOTENIE
                  {phase3Items.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-xs">{phase3Items.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* ── Obsah záložiek — vypĺňa celý zvyšný priestor ── */}
            <div style={{ flex: '1 1 0', minHeight: 0, overflow: 'hidden', position: 'relative' }}>

              {/* ROZDELENIE SKENOV */}
              <div style={{ display: activeTab === 'prichod' ? 'flex' : 'none', position: 'absolute', inset: 0 }}>
                <Step1Panel
                  scanFiles={scanFiles}
                  onRemoveScanFile={onRemoveScanFile}
                  onAddFiles={onAddFiles}
                  onComplete={handleComplete}
                  onSwitchTab={setActiveTab}
                />
              </div>

              {/* RIEŠENIE */}
              <div style={{ display: activeTab === 'rozdelenie' ? 'flex' : 'none', position: 'absolute', inset: 0, flexDirection: 'column' }}>
                <RieseniePanel items={allRiesenieItems} />
              </div>

              {/* VYHODNOTENIE */}
              <div style={{ display: activeTab === 'riesenie' ? 'flex' : 'none', position: 'absolute', inset: 0, overflowY: 'auto', padding: '1.5rem', flexDirection: 'column' }}>
                <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground py-16" data-testid="placeholder-riesenie">
                  <TripleRingStatus phase={3} size={40} />
                  <p className="text-sm font-semibold">Vyhodnotenie — pripravuje sa</p>
                  <p className="text-xs text-center max-w-xs">
                    Fáza Vyhodnotenia bude implementovaná v ďalšej verzii Kokpitu.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
