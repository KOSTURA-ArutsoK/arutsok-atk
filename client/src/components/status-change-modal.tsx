import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContractStatus, ContractStatusParameter } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, X, FileText, MessageSquare, Settings2, Eye, Calendar } from "lucide-react";

interface StatusChangeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: number;
  currentStatusId: number | null;
  statuses: ContractStatus[];
  onSuccess?: (newStatusId: number) => void;
}

export function StatusChangeModal({ open, onOpenChange, contractId, currentStatusId, statuses, onSuccess }: StatusChangeModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("vseobecne");
  const [selectedStatusId, setSelectedStatusId] = useState<string>("");
  const [changedAt, setChangedAt] = useState(() => {
    const now = new Date();
    return now.toISOString().slice(0, 16);
  });
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: statusParams, isLoading: paramsLoading } = useQuery<ContractStatusParameter[]>({
    queryKey: ["/api/contract-statuses", selectedStatusId, "parameters"],
    enabled: !!selectedStatusId,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("newStatusId", selectedStatusId);
      formData.append("changedAt", changedAt);
      formData.append("visibleToClient", visibleToClient.toString());
      if (statusNote.trim()) formData.append("statusNote", statusNote);
      formData.append("parameterValues", JSON.stringify(paramValues));
      for (const file of files) {
        formData.append("documents", file);
      }
      const res = await fetch(`/api/contracts/${contractId}/status-change`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Chyba pri zmene stavu");
      }
      return res.json();
    },
    onSuccess: () => {
      const newId = parseInt(selectedStatusId);
      toast({ title: "Stav zmluvy bol uspesne zmeneny" });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "status-change-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/status-change-meta"] });
      resetForm();
      onOpenChange(false);
      onSuccess?.(newId);
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const resetForm = useCallback(() => {
    setSelectedStatusId("");
    setChangedAt(new Date().toISOString().slice(0, 16));
    setVisibleToClient(false);
    setStatusNote("");
    setParamValues({});
    setFiles([]);
    setActiveTab("vseobecne");
  }, []);

  const handleFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleParamChange = (paramId: string, value: string) => {
    setParamValues(prev => ({ ...prev, [paramId]: value }));
  };

  const currentStatus = statuses.find(s => s.id === currentStatusId);
  const newStatus = statuses.find(s => s.id === parseInt(selectedStatusId));
  const requiredParams = (statusParams || []).filter(p => p.isRequired);
  const hasRequiredMissing = requiredParams.some(p => !paramValues[p.id.toString()]?.trim());
  const filledParamCount = Object.keys(paramValues).filter(k => paramValues[k]?.trim()).length;
  const totalParamCount = statusParams?.length || 0;
  const canSubmit = !!selectedStatusId && !hasRequiredMissing && !submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" data-testid="dialog-status-change">
        <DialogHeader>
          <DialogTitle data-testid="title-status-change">Zmena stavu zmluvy</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full" data-testid="tabs-status-change">
            <TabsTrigger value="vseobecne" className="flex-1 gap-1" data-testid="tab-vseobecne">
              <Settings2 className="w-3.5 h-3.5" /> Vseobecne
              {selectedStatusId && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
            </TabsTrigger>
            <TabsTrigger value="povolenia" className="flex-1 gap-1" data-testid="tab-povolenia">
              <Eye className="w-3.5 h-3.5" /> Povolenia
              {(visibleToClient || statusNote.trim()) && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
            </TabsTrigger>
            <TabsTrigger value="parametre" className="flex-1 gap-1" data-testid="tab-parametre">
              <FileText className="w-3.5 h-3.5" /> Parametre
              {totalParamCount > 0 && (
                <span className="text-[10px] tabular-nums ml-0.5" data-testid="badge-param-count">
                  {filledParamCount}/{totalParamCount}
                </span>
              )}
              {hasRequiredMissing && <div className="w-1.5 h-1.5 rounded-full bg-destructive" />}
            </TabsTrigger>
            <TabsTrigger value="dokumenty" className="flex-1 gap-1" data-testid="tab-dokumenty">
              <Upload className="w-3.5 h-3.5" /> Dokumenty
              {files.length > 0 && (
                <span className="text-[10px] tabular-nums ml-0.5" data-testid="badge-doc-count">
                  {files.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vseobecne" className="space-y-4 mt-4" data-testid="content-vseobecne">
            <Card>
              <CardContent className="p-4 space-y-4">
                {currentStatus && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Aktualny stav:</span>
                    <Badge variant="outline" style={{ borderColor: currentStatus.color, color: currentStatus.color }}>
                      <div className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: currentStatus.color }} />
                      {currentStatus.name}
                    </Badge>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="new-status" data-testid="label-new-status">Nazov stavu zmluvy *</Label>
                  {statuses.filter(s => s.id !== currentStatusId).length === 0 ? (
                    <div className="p-3 border rounded-md bg-muted/30 text-center" data-testid="text-no-statuses">
                      <p className="text-sm text-muted-foreground">Ziadne stavy nie su k dispozicii</p>
                      <p className="text-xs text-muted-foreground mt-1">Stavy su filtrovane podla sektora, sekcie a produktu zmluvy zo Spravy sablon.</p>
                    </div>
                  ) : (
                    <Select value={selectedStatusId} onValueChange={setSelectedStatusId}>
                      <SelectTrigger id="new-status" data-testid="select-new-status">
                        <SelectValue placeholder="Vyberte novy stav" />
                      </SelectTrigger>
                      <SelectContent>
                        {statuses.filter(s => s.id !== currentStatusId).map(s => (
                          <SelectItem key={s.id} value={s.id.toString()} data-testid={`option-status-${s.id}`}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground" data-testid="text-filter-hint">
                    Zobrazuju sa iba stavy priradene k sektoru, sekcii alebo produktu tejto zmluvy zo Spravy sablon.
                  </p>
                </div>

                {newStatus && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {newStatus.isCommissionable && <Badge variant="outline" className="text-xs">Provizna</Badge>}
                    {newStatus.isFinal && <Badge variant="outline" className="text-xs">Finalna</Badge>}
                    {newStatus.assignsNumber && <Badge variant="outline" className="text-xs">Prideluje cislo</Badge>}
                    {newStatus.definesContractEnd && <Badge variant="outline" className="text-xs">Ukoncenie zmluvy</Badge>}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="changed-at" data-testid="label-changed-at">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />
                    Datum a cas zmeny
                  </Label>
                  <Input
                    id="changed-at"
                    type="datetime-local"
                    value={changedAt}
                    onChange={e => setChangedAt(e.target.value)}
                    data-testid="input-changed-at"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="povolenia" className="space-y-4 mt-4" data-testid="content-povolenia">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label data-testid="label-visible-client">Viditelne pre klienta</Label>
                    <p className="text-xs text-muted-foreground">Ak je zapnute, klient uvidi tuto zmenu stavu v jeho prehlade</p>
                  </div>
                  <Switch
                    checked={visibleToClient}
                    onCheckedChange={setVisibleToClient}
                    data-testid="switch-visible-client"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="status-note" data-testid="label-status-note">
                    <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                    Poznamka k zmene stavu
                  </Label>
                  <Textarea
                    id="status-note"
                    value={statusNote}
                    onChange={e => setStatusNote(e.target.value)}
                    placeholder="Napisat poznamku k tejto zmene stavu..."
                    className="resize-none min-h-[100px]"
                    data-testid="textarea-status-note"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parametre" className="space-y-4 mt-4" data-testid="content-parametre">
            <Card>
              <CardContent className="p-4 space-y-4">
                {!selectedStatusId ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Najprv vyberte novy stav na karte "Vseobecne"
                  </p>
                ) : paramsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : !statusParams || statusParams.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Tento stav nema ziadne parametre
                  </p>
                ) : (
                  statusParams
                    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                    .map(param => (
                      <div key={param.id} className="space-y-1.5">
                        <Label data-testid={`label-param-${param.id}`}>
                          {param.name}
                          {param.isRequired && <span className="text-destructive ml-1">*</span>}
                        </Label>
                        {param.helpText && (
                          <p className="text-xs text-muted-foreground">{param.helpText}</p>
                        )}
                        {renderParamInput(param, paramValues[param.id.toString()] || param.defaultValue || "", (val) => handleParamChange(param.id.toString(), val))}
                      </div>
                    ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dokumenty" className="space-y-4 mt-4" data-testid="content-dokumenty">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label data-testid="label-documents">Dokumenty k zmene stavu</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-add-document"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" /> Pridat subor
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileAdd}
                    accept="*/*"
                  />
                </div>

                {files.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Ziadne dokumenty neboli pridane
                  </p>
                ) : (
                  <div className="space-y-2">
                    {files.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 p-2 border rounded-md" data-testid={`file-item-${idx}`}>
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(idx)}
                          data-testid={`button-remove-file-${idx}`}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between gap-2 pt-2 border-t flex-wrap">
          <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            {statusNote.trim() && <Badge variant="outline" className="text-xs"><MessageSquare className="w-3 h-3 mr-1" /> Poznamka</Badge>}
            {files.length > 0 && <Badge variant="outline" className="text-xs"><FileText className="w-3 h-3 mr-1" /> {files.length} dok.</Badge>}
            {Object.keys(paramValues).filter(k => paramValues[k]?.trim()).length > 0 && (
              <Badge variant="outline" className="text-xs"><Settings2 className="w-3 h-3 mr-1" /> Parametre</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }} data-testid="button-cancel-status">
              Zrusit
            </Button>
            <Button
              disabled={!canSubmit}
              onClick={() => submitMutation.mutate()}
              data-testid="button-save-status-change"
            >
              {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Ulozit zmenu stavu
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function renderParamInput(
  param: ContractStatusParameter,
  value: string,
  onChange: (val: string) => void
) {
  const testId = `param-input-${param.id}`;
  switch (param.paramType) {
    case "textarea":
      return (
        <Textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          className="resize-none min-h-[80px]"
          data-testid={testId}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          data-testid={testId}
        />
      );
    case "decimal": {
      const dp = (param as any).decimalPlaces ?? 2;
      const decRegex = dp > 0 ? new RegExp(`^\\d*\\.?\\d{0,${dp}}$`) : /^\d*$/;
      return (
        <div className="flex items-center gap-1.5">
          <Input
            type="text"
            inputMode="decimal"
            value={value}
            onChange={e => {
              const raw = e.target.value.replace(/,/g, ".");
              if (raw === "" || raw === "." || decRegex.test(raw)) {
                onChange(raw);
              }
            }}
            data-testid={testId}
            className="flex-1"
          />
          <span style={{ display: (param as any).unit ? 'inline' : 'none' }} className="text-sm text-muted-foreground font-medium whitespace-nowrap">{(param as any).unit}</span>
        </div>
      );
    }
    case "date":
      return (
        <Input
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          data-testid={testId}
        />
      );
    case "boolean":
      return (
        <div className="flex items-center gap-2">
          <Switch
            checked={value === "true"}
            onCheckedChange={v => onChange(v ? "true" : "false")}
            data-testid={testId}
          />
          <span className="text-sm text-muted-foreground">{value === "true" ? "Ano" : "Nie"}</span>
        </div>
      );
    case "select":
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger data-testid={testId}>
            <SelectValue placeholder="Vyberte..." />
          </SelectTrigger>
          <SelectContent>
            {(param.options || []).map(opt => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multiselect": {
      const selected = value ? value.split(",").filter(Boolean) : [];
      return (
        <div className="flex items-center gap-1.5 flex-wrap" data-testid={testId}>
          {(param.options || []).map(opt => (
            <Badge
              key={opt}
              variant={selected.includes(opt) ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => {
                const newSelected = selected.includes(opt)
                  ? selected.filter(s => s !== opt)
                  : [...selected, opt];
                onChange(newSelected.join(","));
              }}
            >
              {opt}
            </Badge>
          ))}
        </div>
      );
    }
    default:
      return (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          data-testid={testId}
        />
      );
  }
}
