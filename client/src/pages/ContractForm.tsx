import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import type { Contract, ContractStatus, ContractStatusChangeLog, ContractTemplate, ContractInventory, Subject, Partner, MyCompany, Sector, Section, SectorProduct, ContractPassword, ContractParameterValue, ContractFieldSetting } from "@shared/schema";
import { ArrowLeft, Save, Loader2, LayoutGrid, KeyRound, Plus, Trash2, FileText, Users, ClipboardList, FolderOpen, FolderClosed, DollarSign, BarChart3, ListChecks, PieChart, ChevronLeft, ChevronRight, MessageSquare, Paperclip, Upload, X, Eye, Settings2, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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

type PanelWithParams = {
  id: number;
  name: string;
  description: string;
  parameters: Array<{
    id: number;
    name: string;
    paramType: string;
    helpText: string;
    options: string[];
    isRequired: boolean;
    defaultValue: string;
  }>;
};

type FolderWithPanels = {
  id: number;
  name: string;
  sortOrder: number;
  panels: Array<{
    id: number;
    folderId: number;
    panelId: number;
    gridColumns: number;
    sortOrder: number;
    panelName: string;
    panelDescription: string;
  }>;
};

const TABS = [
  { key: "vseobecne", label: "Vseobecne", icon: FileText },
  { key: "udaje-klient", label: "Udaje o klientovi", icon: Users },
  { key: "udaje-zmluva", label: "Udaje o zmluve", icon: ClipboardList },
  { key: "dokumenty", label: "Dokumenty", icon: FolderOpen },
  { key: "odmeny", label: "Odmeny", icon: DollarSign },
  { key: "stavy", label: "Stavy zmluv", icon: BarChart3 },
  { key: "zhrnutie", label: "Zhrnutie", icon: ListChecks },
  { key: "provizne", label: "Provizne zostavy", icon: PieChart },
] as const;

type TabKey = typeof TABS[number]["key"];

const PAYMENT_FREQUENCIES = [
  { value: "mesacne", label: "Mesacne" },
  { value: "stvrtrocne", label: "Stvrtrocne" },
  { value: "polrocne", label: "Polrocne" },
  { value: "rocne", label: "Rocne" },
  { value: "dvojrocne", label: "Dvojrocne" },
  { value: "trojrocne", label: "Trojrocne" },
  { value: "jednorazove", label: "Jednorazove" },
  { value: "bez-platobneho-obdobia", label: "Bez platobneho obdobia" },
];

const CONTRACT_TYPES = [
  { value: "Nova", label: "Nova" },
  { value: "Prestupova", label: "Prestupova" },
  { value: "Zmenova", label: "Zmenova" },
];

function PasswordsModal({
  open,
  onOpenChange,
  contractId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: number | null;
}) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [newNote, setNewNote] = useState("");

  const { data: passwords, isLoading } = useQuery<ContractPassword[]>({
    queryKey: ["/api/contracts", contractId, "passwords"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/passwords`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!contractId && open,
  });

  const createMutation = useMutation({
    mutationFn: (data: { password: string; note: string }) =>
      apiRequest("POST", `/api/contracts/${contractId}/passwords`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "passwords"] });
      setNewPassword("");
      setNewNote("");
      toast({ title: "Uspech", description: "Heslo pridane" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa pridat heslo", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/contract-passwords/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "passwords"] });
      toast({ title: "Uspech", description: "Heslo vymazane" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat heslo", variant: "destructive" }),
  });

  function handleAdd() {
    if (!newPassword.trim()) {
      toast({ title: "Chyba", description: "Heslo je povinne", variant: "destructive" });
      return;
    }
    createMutation.mutate({ password: newPassword, note: newNote });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle data-testid="text-passwords-title">
            <span className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Hesla k zmluve
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Heslo *</label>
              <Input
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Zadajte heslo"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Poznamka k heslu</label>
              <div className="flex items-center gap-2">
                <Input
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Poznamka"
                  data-testid="input-new-password-note"
                />
                <Button
                  size="icon"
                  onClick={handleAdd}
                  disabled={createMutation.isPending}
                  data-testid="button-add-password"
                >
                  <span style={{ display: createMutation.isPending ? 'inline' : 'none' }}><Loader2 className="w-4 h-4 animate-spin" /></span>
                  <span style={{ display: createMutation.isPending ? 'none' : 'inline' }}><Plus className="w-4 h-4" /></span>
                </Button>
              </div>
            </div>
          </div>

          <div style={{ display: isLoading ? 'block' : 'none' }}>
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
          <div style={{ display: !isLoading && passwords && passwords.length > 0 ? 'block' : 'none' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Heslo</TableHead>
                  <TableHead>Poznamka</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(passwords || []).map(pw => (
                  <TableRow key={pw.id} data-testid={`row-password-${pw.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-password-${pw.id}`}>{pw.password}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{pw.note || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(pw.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-password-${pw.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div style={{ display: !isLoading && (!passwords || passwords.length === 0) ? 'block' : 'none' }}>
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-passwords">
              Ziadne hesla k zmluve
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type StatusTabContentProps = {
  statuses: ContractStatus[] | undefined;
  statusId: string;
  filteredStatuses: ContractStatus[];
  statusFormStatusId: string;
  setStatusFormStatusId: (v: string) => void;
  statusFormParams: any;
  statusFormParamsLoading: boolean;
  statusFormParamValues: Record<string, string>;
  setStatusFormParamValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  statusFormChangedAt: string;
  setStatusFormChangedAt: (v: string) => void;
  statusFormVisibleToClient: boolean;
  setStatusFormVisibleToClient: (v: boolean) => void;
  statusFormNote: string;
  setStatusFormNote: (v: string) => void;
  statusFormFiles: File[];
  setStatusFormFiles: React.Dispatch<React.SetStateAction<File[]>>;
  statusFormFileRef: React.RefObject<HTMLInputElement>;
  statusFormSubmit: any;
  contractId: number | null;
  contractSectorId: string;
  contractSectionId: string;
  sectorProductId: string;
  statusChangeLogs: ContractStatusChangeLog[] | undefined;
};

function StatusTabContent(props: StatusTabContentProps) {
  const {
    statuses, statusId, filteredStatuses,
    statusFormStatusId, setStatusFormStatusId,
    statusFormParams, statusFormParamsLoading,
    statusFormParamValues, setStatusFormParamValues,
    statusFormChangedAt, setStatusFormChangedAt,
    statusFormVisibleToClient, setStatusFormVisibleToClient,
    statusFormNote, setStatusFormNote,
    statusFormFiles, setStatusFormFiles,
    statusFormFileRef, statusFormSubmit,
    contractId, contractSectorId, contractSectionId, sectorProductId,
    statusChangeLogs,
  } = props;

  const currentStatus = statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1));
  const newStatus = filteredStatuses.find(s => s.id === parseInt(statusFormStatusId));
  const requiredParams = (statusFormParams || []).filter((p: any) => p.isRequired);
  const hasRequiredMissing = requiredParams.some((p: any) => !statusFormParamValues[p.id.toString()]?.trim());
  const filledParamCount = Object.keys(statusFormParamValues).filter(k => statusFormParamValues[k]?.trim()).length;
  const totalParamCount = statusFormParams?.length || 0;
  const canSubmit = !!statusFormStatusId && !hasRequiredMissing && !statusFormSubmit.isPending && !!contractId;
  const availableStatuses = filteredStatuses.filter(s => s.id !== (statusId ? parseInt(statusId) : -1));

  return (
    <div id="status-tab-root" className="space-y-4" data-testid="section-stavy">
      <div id="status-current-display" data-testid="current-status-display">
        <div id="status-current-inner" className="flex items-center gap-2 flex-wrap">
          <div style={{ display: currentStatus ? 'contents' : 'none' }}>
            <span className="text-sm text-muted-foreground">Aktualny stav:</span>
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: currentStatus?.color }} />
            <span className="text-sm font-semibold" data-testid="text-current-status">{currentStatus?.name}</span>
            <span id="status-badge-commissionable" style={{ display: currentStatus?.isCommissionable ? 'inline' : 'none' }}><Badge variant="outline" className="text-xs">Provizna</Badge></span>
            <span id="status-badge-final" style={{ display: currentStatus?.isFinal ? 'inline' : 'none' }}><Badge variant="outline" className="text-xs">Finalna</Badge></span>
          </div>
          <div style={{ display: !currentStatus && !contractId && !statuses ? 'contents' : 'none' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Nacitavam stavy...</span>
          </div>
          <div style={{ display: !currentStatus && (!!contractId || !!statuses) ? 'contents' : 'none' }}>
            <span className="text-sm text-muted-foreground">Aktualny stav:</span>
            <span className="text-sm font-semibold" data-testid="text-current-status">Nahratá do systému</span>
          </div>
        </div>
      </div>

      <div id="status-change-form-wrapper" data-testid="status-change-form-container">
        <div style={{ display: contractId ? 'block' : 'none' }}>
          <Card>
            <CardContent className="p-4 space-y-0">
              <div id="status-form-general" className="space-y-4" data-testid="section-status-vseobecne">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5" /> Vseobecne udaje
                </h3>
                <div id="status-select-wrapper" className="space-y-1.5">
                  <Label htmlFor="sf-new-status" data-testid="label-new-status">Novy stav zmluvy *</Label>
                  <div id="status-select-content">
                    <div style={{ display: availableStatuses.length === 0 ? 'block' : 'none' }}>
                      <div className="p-3 border rounded-md text-center" data-testid="text-no-statuses">
                        <p className="text-sm text-muted-foreground">Ziadne stavy nie su k dispozicii.</p>
                        <div id="status-hint-hierarchy" data-testid="hint-set-hierarchy">
                          <div style={{ display: !contractSectorId && !contractSectionId && !sectorProductId ? 'block' : 'none' }}>
                            <p className="text-xs text-muted-foreground mt-1">Nastavte sektor, sekciu a produkt v karte "Udaje o zmluve".</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: availableStatuses.length > 0 ? 'block' : 'none' }}>
                      <Select value={statusFormStatusId} onValueChange={setStatusFormStatusId}>
                        <SelectTrigger id="sf-new-status" data-testid="select-new-status">
                          <SelectValue placeholder="Vyberte novy stav" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableStatuses.map(s => (
                            <SelectItem key={s.id} value={s.id.toString()} data-testid={`option-status-${s.id}`}>
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <div id="status-new-badges" className="flex items-center gap-2 flex-wrap min-h-0" data-testid="new-status-badges">
                  <div id="status-new-badges-inner" className="flex items-center gap-2 flex-wrap" style={{ display: newStatus ? 'flex' : 'none' }}>
                    <span id="badge-new-commissionable" style={{ display: newStatus?.isCommissionable ? 'inline' : 'none' }}><Badge variant="outline" className="text-xs">Provizna</Badge></span>
                    <span id="badge-new-final" style={{ display: newStatus?.isFinal ? 'inline' : 'none' }}><Badge variant="outline" className="text-xs">Finalna</Badge></span>
                    <span id="badge-new-assigns" style={{ display: newStatus?.assignsNumber ? 'inline' : 'none' }}><Badge variant="outline" className="text-xs">Prideluje cislo</Badge></span>
                    <span id="badge-new-end" style={{ display: newStatus?.definesContractEnd ? 'inline' : 'none' }}><Badge variant="outline" className="text-xs">Ukoncenie zmluvy</Badge></span>
                  </div>
                  <span className="invisible text-xs" style={{ display: newStatus ? 'none' : 'inline' }}>-</span>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sf-changed-at" data-testid="label-changed-at">
                    <Calendar className="w-3.5 h-3.5 inline mr-1" />
                    Datum a cas zmeny
                  </Label>
                  <Input
                    id="sf-changed-at"
                    type="datetime-local"
                    value={statusFormChangedAt}
                    onChange={e => setStatusFormChangedAt(e.target.value)}
                    data-testid="input-changed-at"
                  />
                </div>
              </div>

              <hr className="my-4 border-border/50" />

              <div id="status-form-permissions" className="space-y-4" data-testid="section-status-povolenia">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" /> Povolenia a poznamka
                </h3>
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label data-testid="label-visible-client">Viditelne pre klienta</Label>
                    <p className="text-xs text-muted-foreground">Ak je zapnute, klient uvidi tuto zmenu stavu</p>
                  </div>
                  <Switch
                    checked={statusFormVisibleToClient}
                    onCheckedChange={setStatusFormVisibleToClient}
                    data-testid="switch-visible-client"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sf-note" data-testid="label-status-note">
                    <MessageSquare className="w-3.5 h-3.5 inline mr-1" />
                    Poznamka k zmene stavu
                  </Label>
                  <Textarea
                    id="sf-note"
                    value={statusFormNote}
                    onChange={e => setStatusFormNote(e.target.value)}
                    placeholder="Napisat poznamku k tejto zmene stavu..."
                    className="resize-none min-h-[100px]"
                    data-testid="textarea-status-note"
                  />
                </div>
              </div>

              <hr className="my-4 border-border/50" />

              <div id="status-form-params" className="space-y-4" data-testid="section-status-parametre">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Doplnkove parametre
                  <span id="param-count-display" style={{ display: totalParamCount > 0 ? 'inline' : 'none' }}><span className="text-[10px] tabular-nums font-normal">({filledParamCount}/{totalParamCount})</span></span>
                </h3>
                <div id="status-params-content">
                  <div style={{ display: !statusFormStatusId ? 'block' : 'none' }}>
                    <p className="text-sm text-muted-foreground py-2">Najprv vyberte novy stav vyssie</p>
                  </div>
                  <div style={{ display: !!statusFormStatusId && statusFormParamsLoading ? 'block' : 'none' }}>
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin" />
                    </div>
                  </div>
                  <div style={{ display: !!statusFormStatusId && !statusFormParamsLoading && (!statusFormParams || statusFormParams.length === 0) ? 'block' : 'none' }}>
                    <p className="text-sm text-muted-foreground py-2">Tento stav nema ziadne doplnkove parametre</p>
                  </div>
                  <div style={{ display: !!statusFormStatusId && !statusFormParamsLoading && statusFormParams && statusFormParams.length > 0 ? 'block' : 'none' }}>
                    <div id="status-params-list" className="space-y-4">
                      {(statusFormParams || [])
                        .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
                        .map((param: any) => (
                          <div key={`param-${param.id}`} className="space-y-1.5">
                            <Label data-testid={`label-param-${param.id}`}>
                              {param.name}
                              <span style={{ display: param.isRequired ? 'inline' : 'none' }}><span className="text-destructive ml-1">*</span></span>
                            </Label>
                            <div id={`param-help-${param.id}`}>
                              <div style={{ display: param.helpText ? 'block' : 'none' }}><p className="text-xs text-muted-foreground">{param.helpText}</p></div>
                            </div>
                            <div style={{ display: param.paramType === "textarea" ? 'block' : 'none' }}>
                              <Textarea
                                value={statusFormParamValues[param.id.toString()] || param.defaultValue || ""}
                                onChange={e => setStatusFormParamValues(prev => ({ ...prev, [param.id.toString()]: e.target.value }))}
                                className="resize-none min-h-[80px]"
                                data-testid={`param-input-${param.id}`}
                              />
                            </div>
                            <div style={{ display: param.paramType === "number" ? 'block' : 'none' }}>
                              <Input
                                type="number"
                                value={statusFormParamValues[param.id.toString()] || param.defaultValue || ""}
                                onChange={e => setStatusFormParamValues(prev => ({ ...prev, [param.id.toString()]: e.target.value }))}
                                data-testid={`param-input-${param.id}`}
                              />
                            </div>
                            <div style={{ display: param.paramType === "date" ? 'block' : 'none' }}>
                              <Input
                                type="date"
                                value={statusFormParamValues[param.id.toString()] || param.defaultValue || ""}
                                onChange={e => setStatusFormParamValues(prev => ({ ...prev, [param.id.toString()]: e.target.value }))}
                                data-testid={`param-input-${param.id}`}
                              />
                            </div>
                            <div style={{ display: param.paramType === "boolean" ? 'block' : 'none' }}>
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={(statusFormParamValues[param.id.toString()] || param.defaultValue || "") === "true"}
                                  onCheckedChange={v => setStatusFormParamValues(prev => ({ ...prev, [param.id.toString()]: v ? "true" : "false" }))}
                                  data-testid={`param-input-${param.id}`}
                                />
                                <span className="text-sm text-muted-foreground">
                                  {(statusFormParamValues[param.id.toString()] || param.defaultValue || "") === "true" ? "Ano" : "Nie"}
                                </span>
                              </div>
                            </div>
                            <div style={{ display: param.paramType === "select" ? 'block' : 'none' }}>
                              <Select
                                value={statusFormParamValues[param.id.toString()] || param.defaultValue || ""}
                                onValueChange={v => setStatusFormParamValues(prev => ({ ...prev, [param.id.toString()]: v }))}
                              >
                                <SelectTrigger data-testid={`param-input-${param.id}`}>
                                  <SelectValue placeholder="Vyberte..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {(param.options || []).map((opt: string) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div style={{ display: param.paramType !== "textarea" && param.paramType !== "number" && param.paramType !== "date" && param.paramType !== "boolean" && param.paramType !== "select" ? 'block' : 'none' }}>
                              <Input
                                value={statusFormParamValues[param.id.toString()] || param.defaultValue || ""}
                                onChange={e => setStatusFormParamValues(prev => ({ ...prev, [param.id.toString()]: e.target.value }))}
                                data-testid={`param-input-${param.id}`}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>

              <hr className="my-4 border-border/50" />

              <div id="status-form-docs" className="space-y-4" data-testid="section-status-dokumenty">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" /> Dokumenty ku stavu
                    <span id="docs-count-display" style={{ display: statusFormFiles.length > 0 ? 'inline' : 'none' }}><span className="text-[10px] tabular-nums font-normal">({statusFormFiles.length})</span></span>
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => statusFormFileRef.current?.click()}
                    data-testid="button-add-document"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1" /> Pridat subor
                  </Button>
                  <input
                    ref={statusFormFileRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={e => {
                      if (e.target.files) setStatusFormFiles(prev => [...prev, ...Array.from(e.target.files!)]);
                      if (statusFormFileRef.current) statusFormFileRef.current.value = "";
                    }}
                    accept="*/*"
                  />
                </div>
                <div id="status-files-content">
                  <div style={{ display: statusFormFiles.length === 0 ? 'block' : 'none' }}>
                    <p className="text-sm text-muted-foreground py-2">Ziadne dokumenty neboli pridane</p>
                  </div>
                  <div style={{ display: statusFormFiles.length > 0 ? 'block' : 'none' }}>
                    <div id="status-files-list" className="space-y-2">
                      {statusFormFiles.map((file, idx) => (
                        <div key={`sf-${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-2 p-2 border rounded-md" data-testid={`file-item-${idx}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                            <span className="text-sm truncate">{file.name}</span>
                            <span className="text-xs text-muted-foreground shrink-0">({(file.size / 1024).toFixed(1)} KB)</span>
                          </div>
                          <Button variant="ghost" size="icon" onClick={() => setStatusFormFiles(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-remove-file-${idx}`}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div id="status-submit-wrapper" className="flex items-center justify-end gap-2 pt-4 mt-4 border-t">
                <Button
                  disabled={!canSubmit}
                  onClick={() => statusFormSubmit.mutate()}
                  data-testid="button-save-status-change"
                >
                  <span id="status-submit-spinner" style={{ display: statusFormSubmit.isPending ? 'inline' : 'none' }}><Loader2 className="w-4 h-4 mr-1 animate-spin" /></span>
                  <Save className="w-4 h-4 mr-1" />
                  Ulozit zmenu stavu
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        <div style={{ display: !contractId ? 'block' : 'none' }}>
          <p className="text-sm text-muted-foreground py-2" data-testid="text-save-first">Najprv ulozte zmluvu pre zmenu stavu.</p>
        </div>
      </div>

      <div id="status-history-wrapper" data-testid="status-history-container">
        <div style={{ display: contractId && statusChangeLogs && statusChangeLogs.length > 0 ? 'block' : 'none' }}>
          <Card>
            <CardContent className="p-3 space-y-2">
              <h3 className="text-sm font-semibold">Historia zmien stavov ({(statusChangeLogs || []).length})</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stav</TableHead>
                    <TableHead>Datum zmeny</TableHead>
                    <TableHead>Detaily</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(statusChangeLogs || []).map(log => {
                    const logStatus = statuses?.find(s => s.id === log.newStatusId);
                    const statusName = logStatus?.name || `Stav #${log.newStatusId}`;
                    const iteration = log.statusIteration || 1;
                    const paramCount = log.parameterValues ? Object.keys(log.parameterValues).filter(k => (log.parameterValues as Record<string, string>)[k]?.trim()).length : 0;
                    const docCount = Array.isArray(log.statusChangeDocuments) ? (log.statusChangeDocuments as any[]).length : 0;
                    return (
                      <TableRow key={`log-${log.id}`} data-testid={`row-status-log-${log.id}`}>
                        <TableCell data-testid={`text-status-name-${log.id}`}>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: logStatus?.color || "transparent" }} />
                            <span className="text-sm font-medium">{statusName} {iteration}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground" data-testid={`text-changed-at-${log.id}`}>
                          {log.changedAt ? new Date(log.changedAt).toLocaleString("sk-SK") : "-"}
                        </TableCell>
                        <TableCell>
                          <div id={`log-details-${log.id}`} className="flex items-center gap-1.5">
                            <span id={`log-params-${log.id}`} style={{ display: paramCount > 0 ? 'inline' : 'none' }}><Badge variant="outline" className="text-xs">{paramCount} param.</Badge></span>
                            <span id={`log-note-${log.id}`} style={{ display: log.statusNote ? 'inline' : 'none' }}><MessageSquare className="w-3.5 h-3.5 text-blue-400" data-testid={`icon-log-note-${log.id}`} /></span>
                            <span id={`log-docs-${log.id}`} style={{ display: docCount > 0 ? 'inline' : 'none' }}>
                              <span className="inline-flex items-center gap-0.5">
                                <Paperclip className="w-3.5 h-3.5 text-amber-400" data-testid={`icon-log-docs-${log.id}`} />
                                <span className="text-xs text-muted-foreground">{docCount}</span>
                              </span>
                            </span>
                            <span id={`log-visible-${log.id}`} style={{ display: log.visibleToClient ? 'inline' : 'none' }}><Badge variant="outline" className="text-xs text-green-500 border-green-500/30" data-testid={`badge-visible-${log.id}`}>K</Badge></span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <div id="status-history-empty" style={{ display: !(contractId && statusChangeLogs && statusChangeLogs.length > 0) ? 'block' : 'none' }} />
      </div>
    </div>
  );
}

export default function ContractForm() {
  const { data: appUser } = useAppUser();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const contractId = params?.id ? parseInt(params.id) : null;
  const isEditing = !!contractId;

  const [activeTab, setActiveTab] = useState<TabKey>("vseobecne");
  const [passwordsOpen, setPasswordsOpen] = useState(false);
  const timerRef = useRef<number>(0);

  const [contractNumber, setContractNumber] = useState("");
  const [proposalNumber, setProposalNumber] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [partnerId, setPartnerId] = useState<string>("");
  const [statusId, setStatusId] = useState<string>("");
  const [statusFormStatusId, setStatusFormStatusId] = useState<string>("");
  const [statusFormChangedAt, setStatusFormChangedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [statusFormVisibleToClient, setStatusFormVisibleToClient] = useState(false);
  const [statusFormNote, setStatusFormNote] = useState("");
  const [statusFormParamValues, setStatusFormParamValues] = useState<Record<string, string>>({});
  const [statusFormFiles, setStatusFormFiles] = useState<File[]>([]);
  const statusFormFileRef = useRef<HTMLInputElement>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [inventoryId, setInventoryId] = useState<string>("");
  const [stateId, setStateId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [signingPlace, setSigningPlace] = useState("");
  const [contractType, setContractType] = useState("Nova");
  const [paymentFrequency, setPaymentFrequency] = useState<string>("");
  const [signedDate, setSignedDate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [annualPremium, setAnnualPremium] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [notes, setNotes] = useState("");
  const [contractPassword, setContractPassword] = useState("");

  const [contractSectorId, setContractSectorId] = useState<string>("");
  const [contractSectionId, setContractSectionId] = useState<string>("");
  const [sectorProductId, setSectorProductIdRaw] = useState<string>("");
  const [panelValues, setPanelValues] = useState<Record<string, string>>({});

  const setSectorProductId = useCallback((val: string) => {
    setSectorProductIdRaw(val);
    setPanelValues({});
  }, []);

  const setContractSectorIdCascade = useCallback((val: string) => {
    setContractSectorId(val);
    setContractSectionId("");
    setSectorProductId("");
  }, [setSectorProductId]);

  const setContractSectionIdCascade = useCallback((val: string) => {
    setContractSectionId(val);
    setSectorProductId("");
  }, [setSectorProductId]);

  const { data: existingContract, isLoading: contractLoading } = useQuery<Contract>({
    queryKey: ["/api/contracts", contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isEditing,
  });

  const { data: savedParamValues } = useQuery<ContractParameterValue[]>({
    queryKey: ["/api/contracts", contractId, "parameter-values"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/parameter-values`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isEditing,
  });

  const { data: existingPasswords } = useQuery<ContractPassword[]>({
    queryKey: ["/api/contracts", contractId, "passwords"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/passwords`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isEditing,
  });

  const { data: allStates } = useStates();
  const { data: subjects } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: partners } = useQuery<Partner[]>({ queryKey: ["/api/partners"] });
  const { data: companies } = useQuery<MyCompany[]>({ queryKey: ["/api/my-companies"] });
  const { data: statuses } = useQuery<ContractStatus[]>({ queryKey: ["/api/contract-statuses"] });
  const { data: statusVisibilityMap } = useQuery<Record<number, { companies: number[]; visibility: { entityType: string; entityId: number }[] }>>({
    queryKey: ["/api/contract-statuses/all-visibility"],
  });
  const { data: statusChangeLogs } = useQuery<ContractStatusChangeLog[]>({
    queryKey: ["/api/contracts", contractId, "status-change-logs"],
    enabled: !!contractId,
  });
  const { data: statusFormParams, isLoading: statusFormParamsLoading } = useQuery<any[]>({
    queryKey: ["/api/contract-statuses", statusFormStatusId, "parameters"],
    enabled: !!statusFormStatusId,
  });
  const statusFormSubmit = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("newStatusId", statusFormStatusId);
      formData.append("changedAt", statusFormChangedAt);
      formData.append("visibleToClient", statusFormVisibleToClient.toString());
      if (statusFormNote.trim()) formData.append("statusNote", statusFormNote);
      formData.append("parameterValues", JSON.stringify(statusFormParamValues));
      for (const file of statusFormFiles) {
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
      const newId = parseInt(statusFormStatusId);
      toast({ title: "Stav zmluvy bol uspesne zmeneny" });
      setStatusId(newId.toString());
      setStatusFormStatusId("");
      setStatusFormChangedAt(new Date().toISOString().slice(0, 16));
      setStatusFormVisibleToClient(false);
      setStatusFormNote("");
      setStatusFormParamValues({});
      setStatusFormFiles([]);
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "status-change-logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/status-change-meta"] });
    },
    onError: (err: Error) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });
  const { data: templates } = useQuery<ContractTemplate[]>({ queryKey: ["/api/contract-templates"] });
  const { data: inventories } = useQuery<ContractInventory[]>({ queryKey: ["/api/contract-inventories"] });
  const { data: contractSectors } = useQuery<Sector[]>({ queryKey: ["/api/sectors"] });

  const { data: allSPForEdit } = useQuery<SectorProduct[]>({ queryKey: ["/api/sector-products"] });
  const { data: allSectionsForEdit } = useQuery<Section[]>({
    queryKey: ["/api/sections"],
    queryFn: async () => {
      const res = await fetch("/api/sections", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: contractSections } = useQuery<Section[]>({
    queryKey: ["/api/sections", { sectorId: contractSectorId }],
    queryFn: async () => {
      const res = await fetch(`/api/sections?sectorId=${contractSectorId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!contractSectorId,
  });

  const { data: contractSectorProducts } = useQuery<SectorProduct[]>({
    queryKey: ["/api/sector-products", { sectionId: contractSectionId }],
    queryFn: async () => {
      const res = await fetch(`/api/sector-products?sectionId=${contractSectionId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!contractSectionId,
  });

  const { data: productPanels, isLoading: panelsLoading } = useQuery<PanelWithParams[]>({
    queryKey: ["/api/sector-products", sectorProductId, "panels-with-parameters"],
    queryFn: async () => {
      const res = await fetch(`/api/sector-products/${sectorProductId}/panels-with-parameters`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!sectorProductId,
  });

  const { data: contractFolders } = useQuery<FolderWithPanels[]>({
    queryKey: ["/api/contract-folders-with-panels"],
  });

  const { data: productFolderAssignments } = useQuery<{ id: number; productId: number; folderId: number; sortOrder: number }[]>({
    queryKey: ["/api/sector-products", sectorProductId, "folders"],
    queryFn: async () => {
      const res = await fetch(`/api/sector-products/${sectorProductId}/folders`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!sectorProductId,
  });

  const { data: fieldSettings } = useQuery<ContractFieldSetting[]>({
    queryKey: ["/api/contract-field-settings"],
  });

  useEffect(() => {
    timerRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (!isEditing && statuses && statuses.length > 0 && !statusId) {
      const defaultStatus = statuses.find(s => s.name === "Nahrata do systemu" && s.isSystem);
      if (defaultStatus) {
        setStatusId(defaultStatus.id.toString());
      }
    }
  }, [isEditing, statuses, statusId]);

  useEffect(() => {
    if (existingContract && allSPForEdit && allSectionsForEdit) {
      setContractNumber(existingContract.contractNumber || "");
      setProposalNumber(existingContract.proposalNumber || "");
      setSubjectId(existingContract.subjectId?.toString() || "");
      setPartnerId(existingContract.partnerId?.toString() || "");
      setSectorProductIdRaw(existingContract.sectorProductId?.toString() || "");
      setStatusId(existingContract.statusId?.toString() || "");
      setTemplateId(existingContract.templateId?.toString() || "");
      setInventoryId(existingContract.inventoryId?.toString() || "");
      setStateId(existingContract.stateId?.toString() || "");
      setCompanyId(existingContract.companyId?.toString() || "");
      setSigningPlace(existingContract.signingPlace || "");
      setContractType(existingContract.contractType || "Nova");
      setPaymentFrequency(existingContract.paymentFrequency || "");
      setSignedDate(existingContract.signedDate ? new Date(existingContract.signedDate).toISOString().split("T")[0] : "");
      setEffectiveDate(existingContract.effectiveDate ? new Date(existingContract.effectiveDate).toISOString().split("T")[0] : "");
      setExpiryDate(existingContract.expiryDate ? new Date(existingContract.expiryDate).toISOString().split("T")[0] : "");
      setPremiumAmount(existingContract.premiumAmount?.toString() || "");
      setAnnualPremium(existingContract.annualPremium?.toString() || "");
      setCommissionAmount(existingContract.commissionAmount?.toString() || "");
      setCurrency(existingContract.currency || "EUR");
      setNotes(existingContract.notes || "");

      const spId = existingContract.sectorProductId;
      if (spId) {
        const sp = allSPForEdit.find(p => p.id === spId);
        if (sp) {
          const sec = allSectionsForEdit.find(s => s.id === sp.sectionId);
          if (sec) {
            setContractSectorId(sec.sectorId.toString());
            setContractSectionId(sec.id.toString());
          }
        }
      }
    }
  }, [existingContract, allSPForEdit, allSectionsForEdit]);

  useEffect(() => {
    if (savedParamValues && savedParamValues.length > 0 && productPanels) {
      const restored: Record<string, string> = {};
      for (const pv of savedParamValues) {
        for (const panel of productPanels) {
          const param = panel.parameters.find(p => p.id === pv.parameterId);
          if (param) {
            restored[`${panel.id}_${param.id}`] = pv.value || "";
            break;
          }
        }
      }
      if (Object.keys(restored).length > 0) {
        setPanelValues(prev => {
          if (Object.keys(prev).length === 0) return restored;
          return prev;
        });
      }
    }
  }, [savedParamValues, productPanels]);

  useEffect(() => {
    if (!isEditing && appUser) {
      setStateId(appUser.activeStateId?.toString() || "");
      setCompanyId(appUser.activeCompanyId?.toString() || "");
    }
  }, [isEditing, appUser]);

  useEffect(() => {
    if (existingPasswords && existingPasswords.length > 0 && !contractPassword) {
      setContractPassword(existingPasswords[0].password || "");
    }
  }, [existingPasswords]);

  const saveParamValuesMutation = useMutation({
    mutationFn: (data: { contractId: number; values: { parameterId: number; value: string; snapshotLabel?: string; snapshotType?: string; snapshotOptions?: string[]; snapshotHelpText?: string }[] }) =>
      apiRequest("POST", `/api/contracts/${data.contractId}/parameter-values`, { values: data.values }),
  });

  function invalidateAllContractQueries() {
    queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/dispatched"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/accepted"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/rejected"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/archived"] });
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contracts", data),
    onSuccess: async (res: any) => {
      const created = await res.json();
      if (created?.id) {
        const paramEntries = buildParamEntries();
        await saveParamValuesMutation.mutateAsync({ contractId: created.id, values: paramEntries });
        if (contractPassword.trim()) {
          await apiRequest("POST", `/api/contracts/${created.id}/passwords`, { password: contractPassword.trim(), note: "" });
        }
      }
      invalidateAllContractQueries();
      toast({ title: "Uspech", description: "Zmluva uspesne zaevidovana" });
      navigate("/evidencia-zmluv");
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit zmluvu", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contracts/${contractId}`, data),
    onSuccess: async () => {
      if (contractId) {
        const paramEntries = buildParamEntries();
        await saveParamValuesMutation.mutateAsync({ contractId, values: paramEntries });
      }
      invalidateAllContractQueries();
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "parameter-values"] });
      toast({ title: "Uspech", description: "Zmluva uspesne aktualizovana" });
      navigate("/evidencia-zmluv");
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat zmluvu", variant: "destructive" }),
  });

  function buildParamEntries(): { parameterId: number; value: string; snapshotLabel?: string; snapshotType?: string; snapshotOptions?: string[]; snapshotHelpText?: string }[] {
    const entries: { parameterId: number; value: string; snapshotLabel?: string; snapshotType?: string; snapshotOptions?: string[]; snapshotHelpText?: string }[] = [];
    for (const [key, value] of Object.entries(panelValues)) {
      const parts = key.split("_");
      if (parts.length === 2) {
        const parameterId = parseInt(parts[1]);
        if (!isNaN(parameterId) && value !== "") {
          let snapshot: { snapshotLabel?: string; snapshotType?: string; snapshotOptions?: string[]; snapshotHelpText?: string } = {};
          if (productPanels) {
            for (const panel of productPanels) {
              const param = panel.parameters.find(p => p.id === parameterId);
              if (param) {
                snapshot = {
                  snapshotLabel: param.name,
                  snapshotType: param.paramType,
                  snapshotOptions: param.options || [],
                  snapshotHelpText: param.helpText || "",
                };
                break;
              }
            }
          }
          entries.push({ parameterId, value, ...snapshot });
        }
      }
    }
    return entries;
  }

  function handleSubmit() {
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const payload = {
      contractNumber: contractNumber || null,
      proposalNumber: proposalNumber || null,
      subjectId: subjectId ? parseInt(subjectId) : null,
      partnerId: partnerId ? parseInt(partnerId) : null,
      productId: null,
      sectorProductId: sectorProductId ? parseInt(sectorProductId) : null,
      statusId: statusId ? parseInt(statusId) : null,
      templateId: templateId ? parseInt(templateId) : null,
      inventoryId: inventoryId ? parseInt(inventoryId) : null,
      stateId: stateId ? parseInt(stateId) : null,
      companyId: companyId ? parseInt(companyId) : null,
      signingPlace: signingPlace || null,
      contractType: contractType || "Nova",
      paymentFrequency: paymentFrequency || null,
      signedDate: signedDate ? new Date(signedDate).toISOString() : null,
      effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : null,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
      premiumAmount: premiumAmount ? parseInt(premiumAmount) : null,
      annualPremium: annualPremium ? parseInt(annualPremium) : null,
      commissionAmount: commissionAmount ? parseInt(commissionAmount) : null,
      currency,
      notes: notes || null,
      processingTimeSec,
      dynamicPanelValues: Object.keys(panelValues).length > 0 ? panelValues : undefined,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && contractLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  function isFieldRequired(fieldKey: string): boolean {
    return fieldSettings?.find(s => s.fieldKey === fieldKey)?.requiredForPfa ?? false;
  }

  const currentCompany = companies?.find(c => c.id === (companyId ? parseInt(companyId) : appUser?.activeCompanyId));

  const filteredStatuses = (() => {
    if (!statuses) return [];
    if (!statusVisibilityMap) return [];
    const cId = companyId ? parseInt(companyId) : null;
    const spId = sectorProductId ? parseInt(sectorProductId) : null;
    const secId = contractSectionId ? parseInt(contractSectionId) : null;
    const sId = contractSectorId ? parseInt(contractSectorId) : null;
    const activeStateId = stateId ? parseInt(stateId) : (appUser?.activeStateId || null);

    console.log("[ArutsoK Status Filter] Input:", { cId, sId, secId, spId, activeStateId, totalStatuses: statuses.length });

    return statuses.filter(s => {
      if (s.stateId && activeStateId && s.stateId !== activeStateId) {
        console.log(`[ArutsoK Status Filter] '${s.name}' (id=${s.id}) hidden: State mismatch (status.stateId=${s.stateId} vs active=${activeStateId})`);
        return false;
      }

      const meta = statusVisibilityMap[s.id];
      if (!meta) {
        console.log(`[ArutsoK Status Filter] '${s.name}' (id=${s.id}) shown: No visibility meta`);
        return true;
      }

      if (meta.companies.length > 0 && cId) {
        if (!meta.companies.includes(cId)) {
          console.log(`[ArutsoK Status Filter] '${s.name}' (id=${s.id}) hidden: Company mismatch (contract company=${cId}, allowed=${meta.companies.join(",")})`);
          return false;
        }
      }

      if (meta.visibility.length > 0) {
        const matchesSector = sId && meta.visibility.some(v => v.entityType === "sector" && v.entityId === sId);
        const matchesSection = secId && meta.visibility.some(v => v.entityType === "section" && v.entityId === secId);
        const matchesProduct = spId && meta.visibility.some(v => v.entityType === "product" && v.entityId === spId);
        if (!matchesSector && !matchesSection && !matchesProduct) {
          console.log(`[ArutsoK Status Filter] '${s.name}' (id=${s.id}) hidden: Sector/Section/Product mismatch (contract: s=${sId},sec=${secId},sp=${spId}; rules=${JSON.stringify(meta.visibility)})`);
          return false;
        }
      }

      console.log(`[ArutsoK Status Filter] '${s.name}' (id=${s.id}) shown: Passed all checks`);
      return true;
    });
  })();

  return (
    <div className="flex flex-col" data-testid="contract-form-root">
      <div className="flex-none flex items-center gap-3 px-3 py-2 border-b border-border flex-wrap">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/evidencia-zmluv")}
          data-testid="button-back-to-list"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Spat na evidenciu
        </Button>
        <h1 className="text-lg font-bold" data-testid="text-form-title">
          {isEditing ? "Upravit zmluvu" : "Nova zmluva"}
        </h1>
        <div data-testid="badge-uid-container">
          <span style={{ display: existingContract?.uid ? 'inline' : 'none' }}>
            <Badge variant="outline" data-testid="badge-contract-uid">{existingContract?.uid}</Badge>
          </span>
        </div>
      </div>

      <div className="flex-none border-b border-border bg-card/50">
        <div className="flex items-center gap-0.5 px-2 flex-wrap">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap flex-1 min-w-[130px] ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`tab-${tab.key}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1">
        <div className="p-3">
          <div style={{ display: activeTab === "vseobecne" ? 'block' : 'none' }}>
            <div className="space-y-[clamp(0.35rem,0.8vh,0.75rem)]" data-testid="section-vseobecne">

              <div className="grid grid-cols-2 gap-[clamp(0.5rem,1vw,1rem)]">
                <CompactField label="Spolocnost">
                  <Input
                    value={currentCompany?.name || ""}
                    disabled
                    className="bg-muted"
                    data-testid="input-company-context"
                  />
                </CompactField>
                <CompactField label="Supiska">
                  <Select value={inventoryId} onValueChange={setInventoryId}>
                    <SelectTrigger data-testid="select-contract-inventory">
                      <SelectValue placeholder="Vyberte supisku" />
                    </SelectTrigger>
                    <SelectContent>
                      {inventories?.filter(i => !i.isClosed).map(i => (
                        <SelectItem key={i.id} value={i.id.toString()}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CompactField>
              </div>

              <div className="grid grid-cols-2 gap-[clamp(0.5rem,1vw,1rem)]">
                <CompactField label="Kalkulacka">
                  <Select value="" onValueChange={() => {}}>
                    <SelectTrigger data-testid="select-contract-calculator">
                      <SelectValue placeholder="Vyberte kalkulacku" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ziadna</SelectItem>
                    </SelectContent>
                  </Select>
                </CompactField>
                <CompactField label="Sablona zmluvy">
                  <Select value={templateId} onValueChange={setTemplateId}>
                    <SelectTrigger data-testid="select-contract-template">
                      <SelectValue placeholder="Vyberte sablonu" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates?.filter(t => t.isActive).map(t => (
                        <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CompactField>
              </div>

              <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                <CompactField label="Cislo kontraktu">
                  <Input value={existingContract?.globalNumber?.toString() || "Pridelene pri ulozeni"} readOnly className="bg-muted/50 cursor-default" data-testid="input-contract-global-number" />
                </CompactField>
                <CompactField label={`Cislo navrhu${isFieldRequired("proposalNumber") ? " *" : ""}`}>
                  <Input value={proposalNumber} onChange={e => setProposalNumber(e.target.value)} data-testid="input-contract-proposal" />
                </CompactField>
                <CompactField label="Cislo zmluvy">
                  <Input value={contractNumber} onChange={e => setContractNumber(e.target.value)} data-testid="input-contract-number" />
                </CompactField>
              </div>

              <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                <CompactField label={`Miesto podpisu${isFieldRequired("signingPlace") ? " *" : ""}`}>
                  <Input value={signingPlace} onChange={e => setSigningPlace(e.target.value)} data-testid="input-signing-place" />
                </CompactField>
                <CompactField label={`Typ zmluvy${isFieldRequired("contractType") ? " *" : ""}`}>
                  <Select value={contractType} onValueChange={setContractType}>
                    <SelectTrigger data-testid="select-contract-type">
                      <SelectValue placeholder="Vyberte typ" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTRACT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CompactField>
                <CompactField label="Stav zmluvy">
                  <div style={{ display: isEditing ? 'block' : 'none' }}>
                    <div id="contract-status-display" className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/30" data-testid="display-contract-status">
                      <div style={{ display: statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1)) ? 'contents' : 'none' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.color }} />
                          <span className="text-sm">{statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.name}</span>
                        </div>
                      </div>
                      <div style={{ display: !statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1)) ? 'contents' : 'none' }}>
                        <span className="text-sm text-muted-foreground">Bez stavu</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: !isEditing ? 'block' : 'none' }}>
                    <Select value={statusId} onValueChange={setStatusId}>
                      <SelectTrigger data-testid="select-contract-status">
                        <SelectValue placeholder="Vyberte stav" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredStatuses.map(s => (
                          <SelectItem key={s.id} value={s.id.toString()}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                              {s.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CompactField>
              </div>

              <div className="grid grid-cols-4 gap-[clamp(0.5rem,1vw,1rem)]">
                <CompactField label="Datum podpisu *">
                  <Input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)} data-testid="input-signed-date" />
                </CompactField>
                <CompactField label="Ucinnost od *">
                  <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} data-testid="input-effective-date" />
                </CompactField>
                <CompactField label="Koniec zmluvy">
                  <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} data-testid="input-expiry-date" />
                </CompactField>
                <CompactField label="Lehotne poistne *">
                  <Input type="number" value={premiumAmount} onChange={e => setPremiumAmount(e.target.value)} className="font-mono" data-testid="input-premium-amount" />
                </CompactField>
              </div>

              <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                <CompactField label={`Frekvencia platenia${isFieldRequired("paymentFrequency") ? " *" : ""}`}>
                  <Select value={paymentFrequency} onValueChange={setPaymentFrequency}>
                    <SelectTrigger data-testid="select-payment-frequency">
                      <SelectValue placeholder="Vyberte frekvenciu" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_FREQUENCIES.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CompactField>
                <CompactField label={`Rocne poistne${isFieldRequired("annualPremium") ? " *" : ""}`}>
                  <Input type="number" value={annualPremium} onChange={e => setAnnualPremium(e.target.value)} className="font-mono" data-testid="input-annual-premium" />
                </CompactField>
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      if (isEditing) {
                        setPasswordsOpen(true);
                      } else {
                        toast({ title: "Info", description: "Najprv ulozte zmluvu, potom mozete spravovat hesla" });
                      }
                    }}
                    data-testid="button-contract-passwords"
                  >
                    Hesla k zmluvam
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: activeTab === "udaje-klient" ? 'block' : 'none' }}>
            <div className="space-y-3" data-testid="section-udaje-klient">
              <h2 className="text-base font-semibold">Udaje o klientovi</h2>
              <div className="grid grid-cols-2 gap-3">
                <CompactField label="Klient">
                  <Select value={subjectId} onValueChange={setSubjectId}>
                    <SelectTrigger data-testid="select-contract-subject">
                      <SelectValue placeholder="Vyberte klienta" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects?.filter(s => s.isActive).map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.type === "person" ? `${s.firstName} ${s.lastName}` : s.companyName} ({s.uid})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CompactField>
                <CompactField label="Partner">
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger data-testid="select-contract-partner">
                      <SelectValue placeholder="Vyberte partnera" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners?.filter(p => !p.isDeleted).map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CompactField>
              </div>

              <div style={{ display: subjectId && subjects?.find(s => s.id === parseInt(subjectId)) ? 'block' : 'none' }}>
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <h3 className="text-sm font-semibold">Detail klienta</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Meno: </span>
                        <span data-testid="text-subject-name">
                          {(() => {
                            const selectedSubject = subjects?.find(s => s.id === (subjectId ? parseInt(subjectId) : -1));
                            if (!selectedSubject) return "";
                            return selectedSubject.type === "person"
                              ? `${selectedSubject.firstName} ${selectedSubject.lastName}`
                              : selectedSubject.companyName;
                          })()}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">UID: </span>
                        <span className="font-mono" data-testid="text-subject-uid">{subjects?.find(s => s.id === (subjectId ? parseInt(subjectId) : -1))?.uid}</span>
                      </div>
                      <div id="subject-email-wrapper" style={{ display: subjects?.find(s => s.id === (subjectId ? parseInt(subjectId) : -1))?.email ? 'block' : 'none' }}>
                        <div>
                          <span className="text-muted-foreground">Email: </span>
                          <span>{subjects?.find(s => s.id === (subjectId ? parseInt(subjectId) : -1))?.email}</span>
                        </div>
                      </div>
                      <div id="subject-phone-wrapper" style={{ display: subjects?.find(s => s.id === (subjectId ? parseInt(subjectId) : -1))?.phone ? 'block' : 'none' }}>
                        <div>
                          <span className="text-muted-foreground">Telefon: </span>
                          <span>{subjects?.find(s => s.id === (subjectId ? parseInt(subjectId) : -1))?.phone}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>

          <div style={{ display: activeTab === "udaje-zmluva" ? 'block' : 'none' }}>
            <div className="space-y-3" data-testid="section-udaje-zmluva">
              <h2 className="text-base font-semibold">Udaje o zmluve - Produkt a parametre</h2>

              <div className="grid grid-cols-3 gap-3">
                <CompactField label="Sektor">
                  <Select value={contractSectorId} onValueChange={setContractSectorIdCascade}>
                    <SelectTrigger data-testid="select-contract-sector">
                      <SelectValue placeholder="Vyberte sektor" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractSectors?.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CompactField>
                <CompactField label="Sekcia">
                  <Select value={contractSectionId} onValueChange={setContractSectionIdCascade} disabled={!contractSectorId}>
                    <SelectTrigger data-testid="select-contract-section">
                      <SelectValue placeholder="Vyberte sekciu" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractSections?.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CompactField>
                <CompactField label="Produkt">
                  <Select value={sectorProductId} onValueChange={setSectorProductId} disabled={!contractSectionId}>
                    <SelectTrigger data-testid="select-contract-product">
                      <SelectValue placeholder="Vyberte produkt" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractSectorProducts?.map(p => (
                        <SelectItem key={p.id} value={p.id.toString()}>{p.name} {p.abbreviation ? `(${p.abbreviation})` : ''}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CompactField>
              </div>

              <div data-testid="panels-loading-container">
                <div style={{ display: sectorProductId && panelsLoading ? 'block' : 'none' }}>
                  <div className="flex items-center gap-2 p-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Nacitavam panely...
                  </div>
                </div>
              </div>

              <div id="panels-content-wrapper" style={{ display: sectorProductId && productPanels && productPanels.length > 0 ? 'block' : 'none' }}>{(() => {
                const safePanels = productPanels || [];
                const productPanelIds = new Set(safePanels.map(p => p.id));
                const assignedPanelIds = new Set<number>();
                const assignedFolderIds = productFolderAssignments
                  ? [...productFolderAssignments].sort((a, b) => a.sortOrder - b.sortOrder).map(pfa => pfa.folderId)
                  : [];
                const orderedFolders = assignedFolderIds.length > 0
                  ? assignedFolderIds
                    .map(fid => (contractFolders || []).find(f => f.id === fid))
                    .filter(Boolean) as FolderWithPanels[]
                  : (contractFolders || []);
                const foldersWithMatchingPanels = orderedFolders
                  .map(folder => {
                    const matchingPanels = folder.panels
                      .filter(fp => productPanelIds.has(fp.panelId))
                      .map(fp => {
                        assignedPanelIds.add(fp.panelId);
                        return { ...fp, panelData: safePanels.find(p => p.id === fp.panelId)! };
                      })
                      .filter(fp => fp.panelData);
                    return { ...folder, matchingPanels };
                  })
                  .filter(f => f.matchingPanels.length > 0);
                const ungroupedPanels = safePanels.filter(p => !assignedPanelIds.has(p.id));

                const renderPanelCard = (panel: PanelWithParams) => (
                  <Card key={panel.id} className="p-2" data-testid={`panel-section-${panel.id}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold">{panel.name}</span>
                      <span style={{ display: panel.description ? 'inline' : 'none' }}><span className="text-xs text-muted-foreground">({panel.description})</span></span>
                    </div>
                    <div style={{ display: panel.parameters.length > 0 ? 'block' : 'none' }}>
                      <div className="grid grid-cols-2 gap-2">
                        {panel.parameters.map(param => (
                          <div key={param.id} className="space-y-0.5">
                            <label className="text-xs font-medium">
                              {param.name}
                              <span style={{ display: param.isRequired ? 'inline' : 'none' }}><span className="text-destructive ml-1">*</span></span>
                            </label>
                            <div style={{ display: param.paramType === "textarea" ? 'block' : 'none' }}>
                              <Textarea
                                value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                                onChange={e => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: e.target.value }))}
                                rows={2}
                                data-testid={`input-panel-param-${panel.id}-${param.id}`}
                              />
                            </div>
                            <div style={{ display: param.paramType === "boolean" ? 'block' : 'none' }}>
                              <Select
                                value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                                onValueChange={val => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: val }))}
                              >
                                <SelectTrigger data-testid={`select-panel-param-${panel.id}-${param.id}`}>
                                  <SelectValue placeholder="Vyberte" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="ano">Ano</SelectItem>
                                  <SelectItem value="nie">Nie</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div style={{ display: param.paramType === "combobox" && param.options?.length > 0 ? 'block' : 'none' }}>
                              <Select
                                value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                                onValueChange={val => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: val }))}
                              >
                                <SelectTrigger data-testid={`select-panel-param-${panel.id}-${param.id}`}>
                                  <SelectValue placeholder="Vyberte" />
                                </SelectTrigger>
                                <SelectContent>
                                  {(param.options || []).map(opt => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div style={{ display: param.paramType !== "textarea" && param.paramType !== "boolean" && !(param.paramType === "combobox" && param.options?.length > 0) ? 'block' : 'none' }}>
                              <Input
                                type={param.paramType === "number" || param.paramType === "currency" || param.paramType === "percent" ? "number" : param.paramType === "date" ? "date" : param.paramType === "datetime" ? "datetime-local" : param.paramType === "email" ? "email" : param.paramType === "url" ? "url" : "text"}
                                value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                                onChange={e => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: e.target.value }))}
                                data-testid={`input-panel-param-${panel.id}-${param.id}`}
                              />
                            </div>
                            <div style={{ display: param.helpText ? 'block' : 'none' }}><p className="text-xs text-muted-foreground">{param.helpText}</p></div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: panel.parameters.length === 0 ? 'block' : 'none' }}>
                      <p className="text-xs text-muted-foreground">Ziadne parametre</p>
                    </div>
                  </Card>
                );

                return (
                  <div className="space-y-3" data-testid="section-contract-panels">
                    <div className="flex items-center gap-2 mb-1">
                      <LayoutGrid className="w-4 h-4 text-primary" />
                      <span className="text-sm font-semibold">Parametre produktu</span>
                    </div>
                    {foldersWithMatchingPanels.map(folder => (
                      <Card key={`folder-${folder.id}`} className="p-3" data-testid={`folder-section-${folder.id}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <FolderClosed className="w-4 h-4 text-primary" />
                          <span className="text-sm font-bold">{folder.name}</span>
                        </div>
                        <div className="grid grid-cols-12 gap-2">
                          {folder.matchingPanels.map(fp => {
                            const spanCols = fp.gridColumns === 4 ? 3 : fp.gridColumns === 3 ? 4 : fp.gridColumns === 2 ? 6 : 12;
                            const spanClass = spanCols === 3 ? "col-span-3" : spanCols === 4 ? "col-span-4" : spanCols === 6 ? "col-span-6" : "col-span-12";
                            return (
                              <div key={fp.panelId} className={spanClass} data-testid={`folder-panel-${folder.id}-${fp.panelId}`}>
                                {renderPanelCard(fp.panelData)}
                              </div>
                            );
                          })}
                        </div>
                      </Card>
                    ))}
                    <div id="ungrouped-panels-wrapper" style={{ display: ungroupedPanels.length > 0 ? 'block' : 'none' }}>
                      <div className="space-y-2">
                        {ungroupedPanels.map(panel => renderPanelCard(panel))}
                      </div>
                    </div>
                  </div>
                );
              })()}</div>

              <div data-testid="no-panels-container">
                <div style={{ display: sectorProductId && productPanels && productPanels.length === 0 ? 'block' : 'none' }}>
                  <p className="text-sm text-muted-foreground" data-testid="text-no-panels">
                    Vybrany produkt nema priradene panely s parametrami.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: activeTab === "dokumenty" ? 'block' : 'none' }}>
            <div className="space-y-3" data-testid="section-dokumenty">
              <h2 className="text-base font-semibold">Dokumenty</h2>
              <Card>
                <CardContent className="p-4 text-center">
                  <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground" data-testid="text-dokumenty-placeholder">
                    Modul dokumentov bude dostupny v dalsej verzii.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div style={{ display: activeTab === "odmeny" ? 'block' : 'none' }}>
            <div className="space-y-3" data-testid="section-odmeny">
              <h2 className="text-base font-semibold">Odmeny</h2>
              <div className="grid grid-cols-3 gap-3">
                <CompactField label="Suma provizie">
                  <Input type="number" value={commissionAmount} onChange={e => setCommissionAmount(e.target.value)} className="font-mono" data-testid="input-commission-amount" />
                </CompactField>
                <CompactField label="Mena">
                  <Input value={currency} onChange={e => setCurrency(e.target.value)} data-testid="input-currency" />
                </CompactField>
              </div>
              <CompactField label="Poznamky">
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} data-testid="input-notes" />
              </CompactField>
            </div>
          </div>

          <div style={{ display: activeTab === "stavy" ? 'block' : 'none' }}>
            <StatusTabContent
              statuses={statuses}
              statusId={statusId}
              filteredStatuses={filteredStatuses}
              statusFormStatusId={statusFormStatusId}
              setStatusFormStatusId={setStatusFormStatusId}
              statusFormParams={statusFormParams}
              statusFormParamsLoading={statusFormParamsLoading}
              statusFormParamValues={statusFormParamValues}
              setStatusFormParamValues={setStatusFormParamValues}
              statusFormChangedAt={statusFormChangedAt}
              setStatusFormChangedAt={setStatusFormChangedAt}
              statusFormVisibleToClient={statusFormVisibleToClient}
              setStatusFormVisibleToClient={setStatusFormVisibleToClient}
              statusFormNote={statusFormNote}
              setStatusFormNote={setStatusFormNote}
              statusFormFiles={statusFormFiles}
              setStatusFormFiles={setStatusFormFiles}
              statusFormFileRef={statusFormFileRef}
              statusFormSubmit={statusFormSubmit}
              contractId={contractId}
              contractSectorId={contractSectorId}
              contractSectionId={contractSectionId}
              sectorProductId={sectorProductId}
              statusChangeLogs={statusChangeLogs}
            />
          </div>

          <div style={{ display: activeTab === "zhrnutie" ? 'block' : 'none' }}>
            <div className="space-y-3" data-testid="section-zhrnutie">
              <h2 className="text-base font-semibold">Zhrnutie zmluvy</h2>
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <SummaryField label="Cislo zmluvy" value={contractNumber || "-"} testId="summary-contract-number" />
                    <SummaryField label="Cislo navrhu" value={proposalNumber || "-"} testId="summary-proposal" />
                    <SummaryField label="Cislo kontraktu" value={existingContract?.globalNumber?.toString() || "Pridelene pri ulozeni"} testId="summary-global-number" />
                    <SummaryField label="Typ zmluvy" value={contractType || "-"} testId="summary-type" />
                    <SummaryField label="Miesto podpisu" value={signingPlace || "-"} testId="summary-signing-place" />
                    <SummaryField label="Klient" value={(() => {
                      const s = subjects?.find(sub => sub.id === (subjectId ? parseInt(subjectId) : -1));
                      if (!s) return "-";
                      return s.type === "person" ? `${s.firstName} ${s.lastName}` : (s.companyName || "-");
                    })()} testId="summary-subject" />
                    <SummaryField label="Partner" value={partners?.find(p => p.id === (partnerId ? parseInt(partnerId) : -1))?.name || "-"} testId="summary-partner" />
                    <SummaryField label="Produkt" value={(() => {
                      const sp = allSPForEdit?.find(p => p.id === (sectorProductId ? parseInt(sectorProductId) : -1));
                      return sp ? `${sp.name}${sp.abbreviation ? ` (${sp.abbreviation})` : ''}` : "-";
                    })()} testId="summary-product" />
                    <SummaryField label="Stav" value={statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.name || "-"} testId="summary-status" />
                    <SummaryField label="Sablona" value={templates?.find(t => t.id === (templateId ? parseInt(templateId) : -1))?.name || "-"} testId="summary-template" />
                    <SummaryField label="Frekvencia platenia" value={PAYMENT_FREQUENCIES.find(f => f.value === paymentFrequency)?.label || "-"} testId="summary-frequency" />
                    <SummaryField label="Lehotne poistne" value={premiumAmount ? `${premiumAmount} ${currency}` : "-"} testId="summary-premium" mono />
                    <SummaryField label="Rocne poistne" value={annualPremium ? `${annualPremium} ${currency}` : "-"} testId="summary-annual" mono />
                    <SummaryField label="Suma provizie" value={commissionAmount ? `${commissionAmount} ${currency}` : "-"} testId="summary-commission" mono />
                    <SummaryField label="Datum podpisu" value={signedDate || "-"} testId="summary-signed" />
                    <SummaryField label="Ucinnost od" value={effectiveDate || "-"} testId="summary-effective" />
                    <SummaryField label="Koniec zmluvy" value={expiryDate || "-"} testId="summary-expiry" />
                    <SummaryField label="Spolocnost" value={currentCompany?.name || "-"} testId="summary-company" />
                    <SummaryField label="Stat" value={allStates?.find(s => s.id === (stateId ? parseInt(stateId) : -1))?.name || "-"} testId="summary-state" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div style={{ display: activeTab === "provizne" ? 'block' : 'none' }}>
            <div className="space-y-3" data-testid="section-provizne">
              <h2 className="text-base font-semibold">Provizne zostavy</h2>
              <Card>
                <CardContent className="p-4 text-center">
                  <PieChart className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground" data-testid="text-provizne-placeholder">
                    Provizne zostavy budu dostupne v dalsej verzii.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-none z-50 bg-background border-t border-border px-3 py-2 flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="default"
          onClick={handleSubmit}
          disabled={isPending}
          tabIndex={1}
          data-testid="button-save-contract"
        >
          <span style={{ display: isPending ? 'inline' : 'none' }}>
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            Ukladam...
          </span>
          <span style={{ display: !isPending ? 'inline' : 'none' }}>
            <Save className="w-4 h-4 mr-1" />
            Ulozit zmluvu
          </span>
        </Button>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const idx = TABS.findIndex(t => t.key === activeTab);
            if (idx > 0) setActiveTab(TABS[idx - 1].key);
          }}
          disabled={activeTab === TABS[0].key}
          tabIndex={2}
          data-testid="button-prev-step"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Predchadzajuci krok
        </Button>

        <span id="next-step-wrapper" style={{ display: activeTab !== TABS[TABS.length - 1].key ? 'inline' : 'none' }}>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => {
              const idx = TABS.findIndex(t => t.key === activeTab);
              if (idx < TABS.length - 1) setActiveTab(TABS[idx + 1].key);
            }}
            tabIndex={2}
            data-testid="button-next-step"
          >
            Pokracovat
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </span>
      </div>

      <div id="passwords-modal-wrapper" style={{ display: isEditing ? 'block' : 'none' }}>
        <div style={{ display: isEditing ? 'block' : 'none' }}>
          <PasswordsModal
            open={passwordsOpen}
            onOpenChange={setPasswordsOpen}
            contractId={contractId}
          />
        </div>
      </div>
    </div>
  );
}

function CompactField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SummaryField({ label, value, testId, mono }: { label: string; value: string; testId: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`text-sm ${mono ? "font-mono" : ""}`} data-testid={testId}>{value}</p>
    </div>
  );
}
