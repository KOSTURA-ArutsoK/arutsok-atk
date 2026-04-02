import { useState, useCallback, useRef, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Loader2, Upload, FileSpreadsheet, Plus, Archive, ArchiveRestore, Trash2,
  CheckCircle2, XCircle, AlertTriangle, ChevronRight, ChevronDown, Eye,
  Pencil, Zap, RefreshCw, Settings, ArrowLeft, ArrowRight, Check,
  Search, Download
} from "lucide-react";
import { formatDateSlovak } from "@/lib/utils";

const IDENTIFIER_TYPES = [
  { value: "proposalNumber", label: "Číslo návrhu" },
  { value: "contractNumber", label: "Číslo zmluvy" },
  { value: "insuranceContractNumber", label: "Číslo poistnej zmluvy" },
];

type CreateStep = "info" | "upload" | "mapping" | "execute" | "results";

function statusColor(s: string) {
  if (s === "done") return "bg-green-500/10 text-green-400 border-green-500/30";
  if (s === "error") return "bg-red-500/10 text-red-400 border-red-500/30";
  if (s === "processing") return "bg-blue-500/10 text-blue-400 border-blue-500/30";
  return "bg-muted text-muted-foreground";
}

function statusLabel(s: string) {
  if (s === "done") return "Dokončené";
  if (s === "error") return "Chyba";
  if (s === "processing") return "Spracováva sa";
  if (s === "pending") return "Čakajúce";
  return s;
}

function rowResultIcon(r: string) {
  if (r === "success") return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (r === "error") return <XCircle className="w-4 h-4 text-red-500" />;
  if (r === "not_found") return <AlertTriangle className="w-4 h-4 text-amber-500" />;
  return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;
}

// ===================== TYPE MANAGER DIALOG =====================
function TypeManagerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", description: "", identifierType: "proposalNumber", sortOrder: 0 });
  const [showForm, setShowForm] = useState(false);

  const { data: types = [], isLoading } = useQuery<any[]>({ queryKey: ["/api/bulk-status-import-types"] });

  const createMut = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/bulk-status-import-types", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bulk-status-import-types"] }); setShowForm(false); setForm({ name: "", description: "", identifierType: "proposalNumber", sortOrder: 0 }); toast({ title: "Typ vytvorený" }); },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, ...d }: any) => apiRequest("PATCH", `/api/bulk-status-import-types/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bulk-status-import-types"] }); setEditingId(null); toast({ title: "Typ uložený" }); },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/bulk-status-import-types/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bulk-status-import-types"] }); toast({ title: "Typ vymazaný" }); },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const [editForm, setEditForm] = useState<any>({});

  function startEdit(t: any) { setEditingId(t.id); setEditForm({ name: t.name, description: t.description || "", identifierType: t.identifierType, sortOrder: t.sortOrder ?? 0 }); }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Settings className="w-4 h-4" />Správa typov importov</DialogTitle></DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
            <>
              {types.length === 0 && !showForm && <p className="text-sm text-muted-foreground text-center py-4">Žiadne typy. Pridajte prvý typ.</p>}
              {types.map(t => (
                <Card key={t.id} className="border rounded-sm">
                  <CardContent className="p-3">
                    {editingId === t.id ? (
                      <div className="space-y-2">
                        <Input value={editForm.name} onChange={e => setEditForm((p: any) => ({ ...p, name: e.target.value }))} placeholder="Názov" data-testid={`input-edit-type-name-${t.id}`} />
                        <Textarea value={editForm.description} onChange={e => setEditForm((p: any) => ({ ...p, description: e.target.value }))} placeholder="Popis (voliteľné)" rows={2} />
                        <Select value={editForm.identifierType} onValueChange={v => setEditForm((p: any) => ({ ...p, identifierType: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{IDENTIFIER_TYPES.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => updateMut.mutate({ id: t.id, ...editForm })} disabled={updateMut.isPending} data-testid={`button-save-type-${t.id}`}>{updateMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Uložiť</Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Zrušiť</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{t.name}</p>
                          {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                          <p className="text-xs text-muted-foreground mt-0.5">{IDENTIFIER_TYPES.find(i => i.value === t.identifierType)?.label}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => startEdit(t)} data-testid={`button-edit-type-${t.id}`}><Pencil className="w-3 h-3" /></Button>
                        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => deleteMut.mutate(t.id)} disabled={deleteMut.isPending} data-testid={`button-delete-type-${t.id}`}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {showForm && (
                <Card className="border border-dashed rounded-sm">
                  <CardContent className="p-3 space-y-2">
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Názov (napr. Koop DSS)" data-testid="input-new-type-name" />
                    <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Popis (voliteľné)" rows={2} />
                    <div className="space-y-1">
                      <Label className="text-xs">Typ identifikátora</Label>
                      <Select value={form.identifierType} onValueChange={v => setForm(p => ({ ...p, identifierType: v }))}>
                        <SelectTrigger data-testid="select-new-type-identifier"><SelectValue /></SelectTrigger>
                        <SelectContent>{IDENTIFIER_TYPES.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => createMut.mutate(form)} disabled={createMut.isPending || !form.name.trim()} data-testid="button-create-type"><Check className="w-3 h-3 mr-1" />Vytvoriť</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Zrušiť</Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!showForm && (
                <Button variant="outline" className="w-full" size="sm" onClick={() => setShowForm(true)} data-testid="button-add-type">
                  <Plus className="w-3 h-3 mr-1" />Pridať typ importu
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== SESSION DETAIL DIALOG =====================
function SessionDetailDialog({ sessionId, onClose }: { sessionId: number; onClose: () => void }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { data: session, isLoading } = useQuery<any>({
    queryKey: ["/api/bulk-status-import-sessions", sessionId],
    queryFn: () => fetch(`/api/bulk-status-import-sessions/${sessionId}`, { credentials: "include" }).then(r => r.json()),
  });

  const rows = session?.rows || [];
  const filtered = rows.filter((r: any) => {
    if (filter !== "all" && r.result !== filter) return false;
    if (search && !String(r.identifierValue || "").toLowerCase().includes(search.toLowerCase()) && !String(r.statusName || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <Dialog open onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            {session?.name || "Detail importu"}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div> : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Celkom", value: session?.totalRows ?? 0, cls: "text-foreground" },
                { label: "Úspešné", value: session?.successRows ?? 0, cls: "text-green-400" },
                { label: "Nenájdené", value: session?.notFoundRows ?? 0, cls: "text-amber-400" },
                { label: "Chyby", value: session?.errorRows ?? 0, cls: "text-red-400" },
              ].map(s => (
                <Card key={s.label} className="rounded-sm">
                  <CardContent className="p-3 text-center">
                    <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Hľadať..." value={search} onChange={e => setSearch(e.target.value)} className="pl-7 h-8 text-sm" data-testid="input-session-search" />
              </div>
              {["all", "success", "error", "not_found"].map(f => (
                <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} data-testid={`filter-${f}`}>
                  {f === "all" ? "Všetky" : f === "success" ? "Úspešné" : f === "not_found" ? "Nenájdené" : "Chyby"}
                </Button>
              ))}
            </div>

            <div className="overflow-x-auto rounded-sm border">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Identifikátor</TableHead>
                    <TableHead>Stav (vstup)</TableHead>
                    <TableHead>Pôvodný stav</TableHead>
                    <TableHead>Nový stav</TableHead>
                    <TableHead>Výsledok</TableHead>
                    <TableHead>Chyba</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Žiadne záznamy</TableCell></TableRow>
                  ) : filtered.map((r: any) => (
                    <TableRow key={r.id} data-testid={`row-session-detail-${r.id}`}>
                      <TableCell className="text-muted-foreground">{r.rowNumber}</TableCell>
                      <TableCell className="font-mono">{r.identifierValue || "—"}</TableCell>
                      <TableCell>{r.statusName || "—"}</TableCell>
                      <TableCell>{r.oldStatusName || "—"}</TableCell>
                      <TableCell>{r.resolvedStatusName || "—"}</TableCell>
                      <TableCell><div className="flex items-center gap-1">{rowResultIcon(r.result)}<span>{r.result === "success" ? "OK" : r.result === "not_found" ? "Nenájdené" : r.result === "error" ? "Chyba" : r.result}</span></div></TableCell>
                      <TableCell className="text-red-400 text-xs max-w-[200px] truncate" title={r.errorMessage || ""}>{r.errorMessage || ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===================== CREATE IMPORT DIALOG =====================
function CreateImportDialog({ open, onClose, onCreated, initialTypeId }: { open: boolean; onClose: () => void; onCreated: (id: number) => void; initialTypeId?: number }) {
  const { toast } = useToast();
  const [step, setStep] = useState<CreateStep>("info");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [infoForm, setInfoForm] = useState({ name: "", typeId: initialTypeId ? String(initialTypeId) : "" });
  const [parsedData, setParsedData] = useState<any>(null);
  const [identifierCol, setIdentifierCol] = useState("");
  const [statusCol, setStatusCol] = useState("");
  const [executeResult, setExecuteResult] = useState<any>(null);

  const { data: types = [] } = useQuery<any[]>({ queryKey: ["/api/bulk-status-import-types"] });

  const createSession = useMutation({
    mutationFn: (d: any) => apiRequest("POST", "/api/bulk-status-import-sessions", d),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setSessionId(data.id);
      setStep("upload");
      toast({ title: "Import vytvorený", description: `ID: ${data.id}` });
    },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: "Neplatný formát", description: "Nahrajte .xlsx alebo .xls súbor", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/bulk-status-import/parse", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) throw new Error((await res.json()).message || "Chyba");
      const data = await res.json();
      setParsedData(data);
      setIdentifierCol("");
      setStatusCol("");
      setStep("mapping");
      toast({ title: "Súbor načítaný", description: `${data.totalRows} riadkov` });
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleExecute = async () => {
    if (!sessionId || !parsedData || !identifierCol || !statusCol) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bulk-status-import-sessions/${sessionId}/execute`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: parsedData.allRows, identifierCol, statusCol,
          fileName: parsedData.fileName,
          columnMapping: { identifier: identifierCol, status: statusCol },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Chyba");
      const result = await res.json();
      setExecuteResult(result);
      setStep("results");
      queryClient.invalidateQueries({ queryKey: ["/api/bulk-status-import-sessions"] });
      toast({ title: "Import dokončený", description: `${result.successRows} úspešných z ${result.totalRows}` });
    } catch (err: any) {
      toast({ title: "Chyba pri importe", description: err.message, variant: "destructive" });
    } finally { setIsLoading(false); }
  };

  const reset = () => {
    setStep("info"); setSessionId(null); setInfoForm({ name: "", typeId: "" });
    setParsedData(null); setIdentifierCol(""); setStatusCol(""); setExecuteResult(null);
  };

  const STEPS: Record<CreateStep, string> = { info: "1. Základné info", upload: "2. Nahranie súboru", mapping: "3. Mapovanie stĺpcov", execute: "4. Spustenie", results: "5. Výsledky" };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); onClose(); } }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4" />Vytvoriť hromadný import stavov</DialogTitle>
          <div className="flex gap-1 flex-wrap mt-2">
            {(Object.keys(STEPS) as CreateStep[]).map(s => (
              <Badge key={s} variant={step === s ? "default" : "outline"} className="text-xs">{STEPS[s]}</Badge>
            ))}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* STEP 1: INFO */}
          {step === "info" && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Názov importu <span className="text-red-400">*</span></Label>
                <Input value={infoForm.name} onChange={e => setInfoForm(p => ({ ...p, name: e.target.value }))} placeholder="napr. Koop DSS – február 2026" data-testid="input-import-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Typ importu</Label>
                <Select value={infoForm.typeId} onValueChange={v => setInfoForm(p => ({ ...p, typeId: v }))}>
                  <SelectTrigger data-testid="select-import-type"><SelectValue placeholder="Vyberte typ (voliteľné)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Bez typu —</SelectItem>
                    {types.map((t: any) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => createSession.mutate({ name: infoForm.name, typeId: infoForm.typeId && infoForm.typeId !== "none" ? parseInt(infoForm.typeId) : null })}
                disabled={!infoForm.name.trim() || createSession.isPending} data-testid="button-next-to-upload">
                {createSession.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Ďalej <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}

          {/* STEP 2: UPLOAD */}
          {step === "upload" && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Nahrajte Excel súbor (.xlsx / .xls) s riadkami na import stavov.</p>
              <div
                className={`border-2 border-dashed rounded-sm p-12 text-center cursor-pointer transition-colors ${isDragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                data-testid="dropzone-upload"
              >
                {isLoading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /> : (
                  <><Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" /><p className="text-sm font-medium">Presuňte súbor sem alebo kliknite</p><p className="text-xs text-muted-foreground mt-1">.xlsx, .xls</p></>
                )}
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} data-testid="file-input-upload" />
              </div>
            </div>
          )}

          {/* STEP 3: MAPPING */}
          {step === "mapping" && parsedData && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-sm text-green-400"><CheckCircle2 className="w-4 h-4" /><span>{parsedData.fileName} — {parsedData.totalRows} riadkov, {parsedData.headers.length} stĺpcov</span></div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Stĺpec s identifikátorom <span className="text-red-400">*</span></Label>
                  <Select value={identifierCol} onValueChange={setIdentifierCol}>
                    <SelectTrigger data-testid="select-identifier-col"><SelectValue placeholder="Vyberte stĺpec..." /></SelectTrigger>
                    <SelectContent>{parsedData.headers.map((h: string) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Číslo návrhu / zmluvy podľa typu importu</p>
                </div>
                <div className="space-y-1.5">
                  <Label>Stĺpec so stavom <span className="text-red-400">*</span></Label>
                  <Select value={statusCol} onValueChange={setStatusCol}>
                    <SelectTrigger data-testid="select-status-col"><SelectValue placeholder="Vyberte stĺpec..." /></SelectTrigger>
                    <SelectContent>{parsedData.headers.map((h: string) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Hodnota musí zodpovedať názvu stavu v systéme</p>
                </div>
              </div>

              <div className="rounded-sm border overflow-x-auto">
                <p className="text-xs text-muted-foreground px-3 py-2 border-b">Ukážka prvých riadkov:</p>
                <Table className="text-xs">
                  <TableHeader>
                    <TableRow>{parsedData.headers.map((h: string) => <TableHead key={h} className={h === identifierCol ? "bg-blue-950/30 text-blue-300" : h === statusCol ? "bg-green-950/30 text-green-300" : ""}>{h}</TableHead>)}</TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.sampleRows.slice(0, 5).map((row: any, i: number) => (
                      <TableRow key={i}>{parsedData.headers.map((h: string) => <TableCell key={h} className={h === identifierCol ? "bg-blue-950/10" : h === statusCol ? "bg-green-950/10" : ""}>{String(row[h] ?? "")}</TableCell>)}</TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("upload")} data-testid="button-back-to-upload"><ArrowLeft className="w-3 h-3 mr-1" />Späť</Button>
                <Button onClick={() => setStep("execute")} disabled={!identifierCol || !statusCol} data-testid="button-next-to-execute">Ďalej <ArrowRight className="w-3 h-3 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* STEP 4: EXECUTE */}
          {step === "execute" && parsedData && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/30 border rounded-sm p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Súbor:</span><span className="font-medium">{parsedData.fileName}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Celkovo riadkov:</span><span className="font-bold">{parsedData.totalRows}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Identifikátor:</span><span className="font-mono text-blue-300">{identifierCol}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Stav:</span><span className="font-mono text-green-300">{statusCol}</span></div>
              </div>
              <div className="bg-amber-950/20 border border-amber-500/30 rounded-sm p-3 text-sm text-amber-300">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                Import zmení stavy zmlúv podľa importovaných dát. Akcia je nevratná.
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("mapping")} data-testid="button-back-to-mapping"><ArrowLeft className="w-3 h-3 mr-1" />Späť</Button>
                <Button onClick={handleExecute} disabled={isLoading} className="bg-green-700 hover:bg-green-600 text-white" data-testid="button-execute-import">
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
                  Spustiť import
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: RESULTS */}
          {step === "results" && executeResult && (
            <div className="space-y-4 py-2">
              <div className="flex items-center gap-2 text-green-400 text-sm font-medium"><CheckCircle2 className="w-5 h-5" />Import bol úspešne dokončený</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Celkom", value: executeResult.totalRows, cls: "text-foreground" },
                  { label: "Úspešné", value: executeResult.successRows, cls: "text-green-400" },
                  { label: "Nenájdené", value: executeResult.notFoundRows, cls: "text-amber-400" },
                  { label: "Chyby", value: executeResult.errorRows, cls: "text-red-400" },
                ].map(s => (
                  <Card key={s.label} className="rounded-sm">
                    <CardContent className="p-3 text-center">
                      <p className={`text-2xl font-bold ${s.cls}`}>{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { reset(); onClose(); onCreated(sessionId!); }} data-testid="button-view-detail">
                  <Eye className="w-3 h-3 mr-1" />Zobraziť detail
                </Button>
                <Button onClick={() => { reset(); onClose(); }} data-testid="button-finish-import">Zatvoriť</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ===================== SESSION LIST =====================
function SessionList({ archived, onViewDetail }: { archived: boolean; onViewDetail: (id: number) => void }) {
  const { toast } = useToast();
  const { data: sessions = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/bulk-status-import-sessions", archived ? "archived" : "active"],
    queryFn: () => fetch(`/api/bulk-status-import-sessions?archived=${archived}`, { credentials: "include" }).then(r => r.json()),
  });

  const archiveMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/bulk-status-import-sessions/${id}/archive`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bulk-status-import-sessions"] }); toast({ title: "Archivované" }); },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const unarchiveMut = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/bulk-status-import-sessions/${id}/unarchive`, {}),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bulk-status-import-sessions"] }); toast({ title: "Obnovené z archívu" }); },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/bulk-status-import-sessions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/bulk-status-import-sessions"] }); toast({ title: "Import vymazaný" }); },
    onError: (e: any) => toast({ title: "Chyba", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (sessions.length === 0) return <p className="text-sm text-muted-foreground text-center py-12">{archived ? "Archív je prázdny" : "Žiadne importy. Vytvorte prvý import."}</p>;

  return (
    <div className="space-y-2">
      {sessions.map((s: any) => (
        <Card key={s.id} className="rounded-sm hover-elevate cursor-pointer" onClick={() => onViewDetail(s.id)} data-testid={`card-session-${s.id}`}>
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <FileSpreadsheet className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm truncate" data-testid={`text-session-name-${s.id}`}>{s.name}</span>
                {s.typeName && <Badge variant="outline" className="text-xs">{s.typeName}</Badge>}
                <Badge className={`text-xs border ${statusColor(s.status)}`}>{statusLabel(s.status)}</Badge>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 flex gap-3 flex-wrap">
                <span>Vytvorené: {formatDateSlovak(s.createdAt)}</span>
                {s.status === "done" && <>
                  <span className="text-green-400">{s.successRows} OK</span>
                  {s.notFoundRows > 0 && <span className="text-amber-400">{s.notFoundRows} nenájdených</span>}
                  {s.errorRows > 0 && <span className="text-red-400">{s.errorRows} chýb</span>}
                  <span className="text-muted-foreground">celkom {s.totalRows}</span>
                </>}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
              <Button size="sm" variant="ghost" onClick={() => onViewDetail(s.id)} data-testid={`button-view-session-${s.id}`}><Eye className="w-3.5 h-3.5" /></Button>
              {archived
                ? <Button size="sm" variant="ghost" onClick={() => unarchiveMut.mutate(s.id)} disabled={unarchiveMut.isPending} data-testid={`button-unarchive-session-${s.id}`}><ArchiveRestore className="w-3.5 h-3.5" /></Button>
                : <Button size="sm" variant="ghost" onClick={() => archiveMut.mutate(s.id)} disabled={archiveMut.isPending} data-testid={`button-archive-session-${s.id}`}><Archive className="w-3.5 h-3.5" /></Button>
              }
              <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => { if (confirm("Vymazať import?")) deleteMut.mutate(s.id); }} disabled={deleteMut.isPending} data-testid={`button-delete-session-${s.id}`}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ===================== MAIN PAGE =====================
export default function HromadneStavy() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const urlTypeId = params.get("typeId") ? parseInt(params.get("typeId")!) : undefined;

  const [tab, setTab] = useState("import");
  const [showCreate, setShowCreate] = useState(false);
  const [launchTypeId, setLaunchTypeId] = useState<number | undefined>(undefined);
  const [showTypeManager, setShowTypeManager] = useState(false);
  const [viewDetailId, setViewDetailId] = useState<number | null>(null);

  useEffect(() => {
    if (urlTypeId) {
      setLaunchTypeId(urlTypeId);
      setShowCreate(true);
    }
  }, [urlTypeId]);

  const { data: types = [] } = useQuery<any[]>({ queryKey: ["/api/bulk-status-import-types"] });

  return (
    <div className="flex flex-col gap-4 p-4 min-h-full">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-lg font-bold tracking-tight" data-testid="title-hromadne-stavy">Hromadný import stavov</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Hromadná aktualizácia stavov zmlúv z Excel súborov</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowTypeManager(true)} data-testid="button-manage-types">
            <Settings className="w-3.5 h-3.5 mr-1" />Typy importov
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-import">
            <Plus className="w-3.5 h-3.5 mr-1" />Vytvoriť hromadný import
          </Button>
        </div>
      </div>

      {types.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {types.map((t: any) => (
            <Badge key={t.id} variant="outline" className="text-xs cursor-default" data-testid={`badge-type-${t.id}`}>
              <FileSpreadsheet className="w-3 h-3 mr-1" />{t.name}
            </Badge>
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="flex-1">
        <TabsList className="flex flex-wrap h-auto gap-1 justify-between w-full">
          <TabsTrigger value="import" data-testid="tab-hromadny-import">Hromadný import</TabsTrigger>
          <TabsTrigger value="archive" data-testid="tab-archiv-importov">Archív importov</TabsTrigger>
          <TabsTrigger value="actions" data-testid="tab-hromadne-akcie">Hromadné akcie</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-4">
          <SessionList archived={false} onViewDetail={setViewDetailId} />
        </TabsContent>

        <TabsContent value="archive" className="mt-4">
          <SessionList archived={true} onViewDetail={setViewDetailId} />
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          <Card className="rounded-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4" />Hromadné akcie</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Hromadné akcie pre zmluvy (hromadné notifikácie, batch jobs) nájdete na stránke <a href="/bulk-actions" className="text-primary underline">Hromadné akcie</a>.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showCreate && (
        <CreateImportDialog
          open={showCreate}
          onClose={() => { setShowCreate(false); setLaunchTypeId(undefined); }}
          onCreated={id => { setShowCreate(false); setLaunchTypeId(undefined); setViewDetailId(id); }}
          initialTypeId={launchTypeId}
        />
      )}

      {showTypeManager && (
        <TypeManagerDialog open={showTypeManager} onClose={() => setShowTypeManager(false)} />
      )}

      {viewDetailId !== null && (
        <SessionDetailDialog sessionId={viewDetailId} onClose={() => setViewDetailId(null)} />
      )}
    </div>
  );
}
