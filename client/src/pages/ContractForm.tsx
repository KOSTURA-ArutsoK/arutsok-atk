import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateTimeSlovak, formatDateSlovak, formatPhone, formatUid, getDateSemaphore, getDateSemaphoreClasses, NAVRH_LABEL_FULL, NAVRH_LABEL_SHORT } from "@/lib/utils";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import type { Contract, ContractStatus, ContractStatusChangeLog, ContractTemplate, ContractInventory, Subject, Partner, Product, MyCompany, Sector, Section, SectorProduct, ContractPassword, ContractParameterValue, ContractFieldSetting, ClientType, ContractAcquirer, AppUser, ContractRewardDistribution } from "@shared/schema";
import { getFieldsForClientTypeId, type StaticField } from "@/lib/staticFieldDefs";
import { ArrowLeft, Save, Loader2, LayoutGrid, KeyRound, Plus, Trash2, FileText, Users, ClipboardList, FolderOpen, FolderClosed, DollarSign, BarChart3, ListChecks, PieChart, ChevronLeft, ChevronRight, MessageSquare, Paperclip, Upload, X, Eye, Settings2, Calendar, UserCheck, Check, Link2, CreditCard, Flag, History, AlertTriangle, Shield, Lock, Ban } from "lucide-react";
import { getContractAnniversaryStatus, isContractAnniversaryParam, getGapInsuranceStatus, isGapParam, CONTRACT_END_PARAM_ID } from "@/lib/document-validity";
import { SubjektView } from "@/components/subjekt-view";
import { SubjectProfilePhoto } from "@/components/subject-profile-photo";
import type { DocumentEntry } from "@shared/schema";
import StatusDocUpload, { type StatusDocUploadHandle } from "@/components/StatusDocUpload";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateSegmentInput } from "@/components/DateSegmentInput";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";
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
import { UIDInput } from "@/components/uid-input";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";

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
    unit?: string | null;
    decimalPlaces?: number | null;
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
  { key: "udaje-klient", label: "Klientsky profil", icon: Users },
  { key: "udaje-zmluva", label: "Udaje o zmluve", icon: ClipboardList },
  { key: "dokumenty", label: "Dokumenty", icon: FolderOpen },
  { key: "ziskatelia", label: "Ziskatelia", icon: UserCheck },
  { key: "stavy", label: "Stavy zmluv", icon: BarChart3 },
  { key: "zhrnutie", label: "Zhrnutie", icon: ListChecks },
  { key: "odmeny", label: "Odmeny", icon: DollarSign },
  { key: "provizne", label: "Provizne zostavy", icon: PieChart },
] as const;

type TabKey = typeof TABS[number]["key"];

function ParamValueHistoryInline({ contractId, panelParams }: { contractId: number; panelParams: { id: number; name: string }[] }) {
  const paramIds = panelParams.map(p => p.id);
  const { data: history, isLoading } = useQuery<{ id: number; contractId: number; parameterId: number; oldValue: string | null; newValue: string | null; parameterName: string | null; changedByName: string | null; changedAt: string | null; changeReason: string | null }[]>({
    queryKey: ["/api/contracts", contractId, "parameter-value-history"],
    enabled: !!contractId,
  });

  const filtered = (history || []).filter(h => paramIds.includes(h.parameterId));

  if (isLoading) return <div className="text-xs text-muted-foreground py-1">Načítavam históriu...</div>;
  if (filtered.length === 0) return <div className="text-xs text-muted-foreground py-1 mb-2">Žiadne zmeny parametrov</div>;

  return (
    <div className="mb-2 max-h-40 overflow-y-auto border rounded p-1.5 bg-muted/20 space-y-1" data-testid="param-value-history">
      {filtered.slice(0, 20).map(h => {
        const paramName = h.parameterName || panelParams.find(p => p.id === h.parameterId)?.name || `Param ${h.parameterId}`;
        return (
          <div key={h.id} className="text-xs flex items-start gap-1.5 py-0.5 border-b border-border/40 last:border-0" data-testid={`history-row-${h.id}`}>
            <span className="text-muted-foreground whitespace-nowrap" data-testid={`history-date-${h.id}`}>{h.changedAt ? formatDateTimeSlovak(h.changedAt) : "-"}</span>
            <span className="font-medium" data-testid={`history-param-${h.id}`}>{paramName}:</span>
            <span className="text-red-400 line-through" data-testid={`history-old-${h.id}`}>{h.oldValue || "-"}</span>
            <span className="text-green-500" data-testid={`history-new-${h.id}`}>{h.newValue || "-"}</span>
            {h.changedByName && <span className="text-muted-foreground ml-auto" data-testid={`history-user-${h.id}`}>({h.changedByName})</span>}
          </div>
        );
      })}
    </div>
  );
}

function normalizeDecimalInput(value: string): string {
  return value.replace(/,/g, ".");
}

function DecimalInput({ value, onChange, unit, decimalPlaces, testId }: {
  value: string;
  onChange: (val: string) => void;
  unit?: string | null;
  decimalPlaces?: number | null;
  testId?: string;
}) {
  const dp = decimalPlaces ?? 2;
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const normalized = normalizeDecimalInput(raw);
    const regex = dp > 0 ? new RegExp(`^-?\\d*\\.?\\d{0,${dp}}$`) : /^-?\d*$/;
    if (normalized === "" || normalized === "-" || normalized === "." || regex.test(normalized)) {
      onChange(normalized);
    }
  };
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        placeholder={`0.${"0".repeat(dp)}`}
        data-testid={testId}
        className="flex-1"
      />
      <span style={{ display: unit ? 'inline' : 'none' }} className="text-sm text-muted-foreground font-medium whitespace-nowrap">{unit}</span>
    </div>
  );
}

const PAYMENT_FREQUENCIES = [
  { value: "mesacne", label: "Mesacne", multiplier: 12 },
  { value: "stvrtrocne", label: "Stvrtrocne", multiplier: 4 },
  { value: "polrocne", label: "Polrocne", multiplier: 2 },
  { value: "rocne", label: "Rocne", multiplier: 1 },
  { value: "dvojrocne", label: "Dvojrocne", multiplier: 0.5 },
  { value: "trojrocne", label: "Trojrocne", multiplier: 1 / 3 },
  { value: "jednorazove", label: "Jednorazove", multiplier: 1 },
  { value: "bez-platobneho-obdobia", label: "Bez platobneho obdobia", multiplier: 1 },
];

const CONTRACT_TYPES = [
  { value: "Nova", label: "🟢 Nová zmluva" },
  { value: "Prestupova", label: "🔵 Prestupová zmluva" },
  { value: "Zmenova", label: "🟡 Zmenová zmluva" },
  { value: "Dodatok", label: "🟠 Dodatok k zmluve" },
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
      <DialogContent size="sm">
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteMutation.mutate(pw.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-password-${pw.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                      </Tooltip>
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
  renamePrefix: string;
  setRenamePrefix: (v: string) => void;
  docUploadRef: React.RefObject<StatusDocUploadHandle>;
  contractSectorId: string;
  contractSectionId: string;
  sectorProductId: string;
  statusChangeLogs: ContractStatusChangeLog[] | undefined;
  lifecycleHistory: any[] | undefined;
};

const STATUS_HISTORY_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "status", label: "Stav", type: "text" },
  { key: "changedAt", label: "Datum zmeny", type: "date" },
];

const STATUS_HISTORY_COLUMNS: ColumnDef[] = [
  { key: "status", label: "Stav" },
  { key: "changedAt", label: "Datum zmeny" },
  { key: "details", label: "Detaily" },
];

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
    contractId, renamePrefix, setRenamePrefix, docUploadRef,
    contractSectorId, contractSectionId, sectorProductId,
    statusChangeLogs, lifecycleHistory,
  } = props;

  const statusHistoryColumnVisibility = useColumnVisibility("contract-form-status-history", STATUS_HISTORY_COLUMNS);

  const enrichedLogs = (statusChangeLogs || []).map(log => {
    const logStatus = statuses?.find(s => s.id === log.newStatusId);
    return { ...log, status: logStatus?.name || `Stav ${log.newStatusId}` };
  });
  const statusHistoryFilter = useSmartFilter(enrichedLogs, STATUS_HISTORY_FILTER_COLUMNS, "contract-form-status-history");

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
          {currentStatus && <>
            <span className="text-sm text-muted-foreground">Stav zmluvy:</span>
            <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: currentStatus?.color }} />
            <span className="text-sm font-semibold" data-testid="text-current-status">{currentStatus?.name}</span>
            <span id="status-badge-commissionable" style={{ display: currentStatus?.isCommissionable ? 'inline' : 'none' }}><Badge variant="outline" className="text-xs">Provizna</Badge></span>
            <span id="status-badge-final" style={{ display: currentStatus?.isFinal ? 'inline' : 'none' }}><Badge variant="outline" className="text-xs">Finalna</Badge></span>
          </>}
          {!currentStatus && !contractId && !statuses && <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Nacitavam stavy...</span>
          </>}
          {!currentStatus && (!!contractId || !!statuses) && <>
            <span className="text-sm text-muted-foreground">Stav zmluvy:</span>
            <span className="text-sm font-semibold" data-testid="text-current-status">Bez stavu</span>
          </>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
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
                            <p className="text-xs text-muted-foreground mt-1">Nastavte sektor, odvetvie a produkt v karte "Údaje o zmluve".</p>
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
                            <div style={{ display: param.paramType === "decimal" ? 'block' : 'none' }}>
                              <DecimalInput
                                value={statusFormParamValues[param.id.toString()] || param.defaultValue || ""}
                                onChange={val => setStatusFormParamValues(prev => ({ ...prev, [param.id.toString()]: val }))}
                                unit={(param as any).unit}
                                decimalPlaces={(param as any).decimalPlaces}
                                testId={`param-input-${param.id}`}
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
                            <div style={{ display: param.paramType === "select" || param.paramType === "jedna_moznost" ? 'block' : 'none' }}>
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
                            <div style={{ display: param.paramType === "viac_moznosti" ? 'block' : 'none' }}>
                              <MultiSelectCheckboxes
                                paramId={param.id}
                                options={param.options || []}
                                value={statusFormParamValues[param.id.toString()] || param.defaultValue || ""}
                                onChange={(val) => setStatusFormParamValues(prev => ({ ...prev, [param.id.toString()]: val }))}
                              />
                            </div>
                            <div style={{ display: param.paramType !== "textarea" && param.paramType !== "number" && param.paramType !== "decimal" && param.paramType !== "date" && param.paramType !== "boolean" && param.paramType !== "select" && param.paramType !== "jedna_moznost" && param.paramType !== "viac_moznosti" ? 'block' : 'none' }}>
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

              <div id="status-form-docs" className="space-y-3" data-testid="section-status-dokumenty">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" /> Dokumenty ku stavu
                  <span id="docs-count-display" style={{ display: statusFormFiles.length > 0 ? 'inline' : 'none' }}><span className="text-[10px] tabular-nums font-normal">({statusFormFiles.length})</span></span>
                </h3>
                <StatusDocUpload
                  ref={docUploadRef}
                  files={statusFormFiles}
                  onFilesChange={setStatusFormFiles}
                  contractId={contractId}
                  renamePrefix={renamePrefix}
                  onRenamePrefixChange={setRenamePrefix}
                />
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
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold">Historia zmien stavov ({(statusChangeLogs || []).length})</h3>
                <ColumnManager columnVisibility={statusHistoryColumnVisibility} />
              </div>
              <SmartFilterBar filter={statusHistoryFilter} />
              <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    {statusHistoryColumnVisibility.isVisible("status") && <TableHead>Stav</TableHead>}
                    {statusHistoryColumnVisibility.isVisible("changedAt") && <TableHead>Datum zmeny</TableHead>}
                    {statusHistoryColumnVisibility.isVisible("details") && <TableHead>Detaily</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusHistoryFilter.filteredData.map(log => {
                    const logStatus = statuses?.find(s => s.id === log.newStatusId);
                    const statusName = logStatus?.name || `Stav ${log.newStatusId}`;
                    const iteration = log.statusIteration || 1;
                    const paramCount = log.parameterValues ? Object.keys(log.parameterValues).filter(k => (log.parameterValues as Record<string, string>)[k]?.trim()).length : 0;
                    const docCount = Array.isArray(log.statusChangeDocuments) ? (log.statusChangeDocuments as any[]).length : 0;
                    return (
                      <TableRow key={`log-${log.id}`} data-testid={`row-status-log-${log.id}`}>
                        {statusHistoryColumnVisibility.isVisible("status") && <TableCell data-testid={`text-status-name-${log.id}`}>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: logStatus?.color || "transparent" }} />
                            <span className="text-sm font-medium">{statusName} {iteration}</span>
                            {logStatus?.definesContractEnd && (
                              <span title="Tento stav ukoncil zmluvu"><Flag className="w-3.5 h-3.5 text-destructive shrink-0" data-testid={`icon-defines-end-${log.id}`} /></span>
                            )}
                          </div>
                        </TableCell>}
                        {statusHistoryColumnVisibility.isVisible("changedAt") && <TableCell className="text-sm text-muted-foreground" data-testid={`text-changed-at-${log.id}`}>
                          {formatDateTimeSlovak(log.changedAt)}
                        </TableCell>}
                        {statusHistoryColumnVisibility.isVisible("details") && <TableCell>
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
                        </TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
        <div id="status-history-empty" style={{ display: !(contractId && statusChangeLogs && statusChangeLogs.length > 0) ? 'block' : 'none' }} />
      </div>

      <div id="lifecycle-history-wrapper" data-testid="lifecycle-history-container">
        <div style={{ display: contractId && lifecycleHistory && lifecycleHistory.length > 0 ? 'block' : 'none' }}>
          <Card>
            <CardContent className="p-3 space-y-2">
              <h3 className="text-sm font-semibold">Priebeh spracovania zmluvy ({(lifecycleHistory || []).length})</h3>
              <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    <TableHead>Fáza</TableHead>
                    <TableHead>Dátum</TableHead>
                    <TableHead>Poznámka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(lifecycleHistory || []).map((entry: any) => (
                    <TableRow key={`lh-${entry.id}`} data-testid={`row-lifecycle-${entry.id}`}>
                      <TableCell className="text-sm font-medium" data-testid={`text-lifecycle-phase-${entry.id}`}>{entry.phaseName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-lifecycle-date-${entry.id}`}>{formatDateTimeSlovak(entry.changedAt)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-lifecycle-note-${entry.id}`}>{entry.note || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>
    </div>
  );
}

function SnapshotSubjectView({ snapshot, snapshotAt, appUserRole, liveSubject }: { snapshot: Record<string, any>; snapshotAt: string | null; appUserRole?: string; liveSubject?: any | null }) {
  const details = (snapshot.details as any) || {};
  const dynFields: Record<string, string> = details.dynamicFields || details || {};
  const addresses: any[] = snapshot.addresses || [];
  const contacts: any[] = snapshot.contacts || [];
  const documents: any[] = snapshot.documents || [];

  const getVal = (key: string): string => {
    if (snapshot[key] !== undefined && snapshot[key] !== null) return String(snapshot[key]);
    if (dynFields[key] !== undefined && dynFields[key] !== null) return String(dynFields[key]);
    return "";
  };

  const isPersonType = ["person", "szco"].includes(snapshot.type || "");
  const isCompanyType = ["company", "organization"].includes(snapshot.type || "");

  const mainAddress = addresses.find((a: any) => a.isHlavna) || addresses[0] || null;
  const primaryContact = contacts.find((c: any) => c.isPrimary) || contacts[0] || null;
  const latestDoc = documents.length > 0 ? documents[documents.length - 1] : null;

  const formatAddr = (a: any) => {
    if (!a) return null;
    const street = [a.ulica, a.supisneCislo, a.orientacneCislo].filter(Boolean).join(" ");
    const parts = [street || null, a.obecMesto, a.psc, a.stat].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const snapshotDate = snapshotAt ? formatDateTimeSlovak(snapshotAt) : null;
  const capturedAt = snapshot.capturedAt ? formatDateTimeSlovak(snapshot.capturedAt) : snapshotDate;

  const isAdmin = appUserRole === "admin" || appUserRole === "superadmin";
  const [showDiff, setShowDiff] = useState(false);

  const diffItems: { key: string; label: string; snapVal: string; liveVal: string }[] = useMemo(() => {
    if (!liveSubject || !isAdmin) return [];
    const compareFields: Array<{ key: string; label: string; snapFn: () => string; liveFn: () => string }> = [
      { key: "firstName", label: "Meno", snapFn: () => snapshot.firstName || "", liveFn: () => liveSubject.firstName || "" },
      { key: "lastName", label: "Priezvisko", snapFn: () => snapshot.lastName || "", liveFn: () => liveSubject.lastName || "" },
      { key: "companyName", label: "Názov firmy", snapFn: () => snapshot.companyName || "", liveFn: () => liveSubject.companyName || "" },
      { key: "email", label: "Email", snapFn: () => snapshot.email || "", liveFn: () => liveSubject.email || "" },
      { key: "phone", label: "Telefón", snapFn: () => snapshot.phone || "", liveFn: () => liveSubject.phone || "" },
      { key: "type", label: "Typ subjektu", snapFn: () => snapshot.type || "", liveFn: () => liveSubject.type || "" },
    ];
    return compareFields
      .map(f => ({ key: f.key, label: f.label, snapVal: f.snapFn(), liveVal: f.liveFn() }))
      .filter(d => d.snapVal !== d.liveVal);
  }, [liveSubject, snapshot, isAdmin]);

  return (
    <div className="space-y-3" data-testid="snapshot-subject-view">
      <div className="rounded-md border border-amber-700/50 bg-amber-950/20 px-3 py-2 flex items-center gap-2 flex-wrap" data-testid="snapshot-banner">
        <History className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-xs font-semibold text-amber-300">Zmrazené dáta — snímka pri podpise zmluvy</span>
        {capturedAt && (
          <span className="text-[10px] text-amber-400/70" data-testid="snapshot-captured-at">Zachytené: {capturedAt}</span>
        )}
        {diffItems.length > 0 && (
          <Badge variant="outline" className="text-[9px] border-orange-500/40 text-orange-400 cursor-pointer ml-auto" onClick={() => setShowDiff(v => !v)} data-testid="badge-diff-changed">
            {diffItems.length} zmien od snímky
          </Badge>
        )}
      </div>

      {isAdmin && showDiff && diffItems.length > 0 && (
        <div className="rounded-md border border-orange-700/40 bg-orange-950/20 px-3 py-2 space-y-2" data-testid="snapshot-diff-panel">
          <span className="text-[10px] font-semibold text-orange-300 uppercase tracking-wider">Zmeny v profile klienta od zachytenia snímky</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {diffItems.map(d => (
              <div key={d.key} className="text-xs rounded border border-orange-700/30 bg-orange-950/30 px-2 py-1" data-testid={`diff-field-${d.key}`}>
                <span className="text-muted-foreground block">{d.label}</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="line-through text-red-400/80">{d.snapVal || "—"}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-green-400">{d.liveVal || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {isPersonType && (
          <>
            <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-name">
              <span className="text-[10px] text-muted-foreground">Meno a priezvisko</span>
              <span className="text-sm font-medium">
                {[snapshot.titleBefore, snapshot.firstName, snapshot.lastName, snapshot.titleAfter].filter(Boolean).join(" ") || "—"}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-type">
              <span className="text-[10px] text-muted-foreground">Typ</span>
              <span className="text-sm font-medium">{snapshot.type || "—"}</span>
            </div>
            <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-uid">
              <span className="text-[10px] text-muted-foreground">UID</span>
              <span className="text-sm font-mono">{snapshot.uid ? formatUid(snapshot.uid) : "—"}</span>
            </div>
            <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-rc">
              <span className="text-[10px] text-muted-foreground">Rodné číslo</span>
              <span className="text-sm font-medium">{"*".repeat(10)}</span>
            </div>
            <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-birth">
              <span className="text-[10px] text-muted-foreground">Dátum narodenia</span>
              <span className="text-sm font-medium">{getVal("datum_narodenia") ? formatDateSlovak(getVal("datum_narodenia")) : "—"}</span>
            </div>
          </>
        )}
        {isCompanyType && (
          <>
            <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20 col-span-2" data-testid="snap-field-company">
              <span className="text-[10px] text-muted-foreground">Názov spoločnosti</span>
              <span className="text-sm font-medium">{snapshot.companyName || "—"}</span>
            </div>
            <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-uid">
              <span className="text-[10px] text-muted-foreground">UID</span>
              <span className="text-sm font-mono">{snapshot.uid ? formatUid(snapshot.uid) : "—"}</span>
            </div>
            <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-ico">
              <span className="text-[10px] text-muted-foreground">IČO</span>
              <span className="text-sm font-medium">{getVal("ico") || "—"}</span>
            </div>
            <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-dic">
              <span className="text-[10px] text-muted-foreground">DIČ</span>
              <span className="text-sm font-medium">{getVal("dic") || "—"}</span>
            </div>
          </>
        )}
        {snapshot.email && (
          <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-email">
            <span className="text-[10px] text-muted-foreground">Email</span>
            <span className="text-sm font-medium truncate">{snapshot.email}</span>
          </div>
        )}
        {snapshot.phone && (
          <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-phone">
            <span className="text-[10px] text-muted-foreground">Telefón</span>
            <span className="text-sm font-medium">{formatPhone(snapshot.phone)}</span>
          </div>
        )}
        {primaryContact && (
          <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20" data-testid="snap-field-primary-contact">
            <span className="text-[10px] text-muted-foreground">Primárny kontakt</span>
            <span className="text-sm font-medium">{primaryContact.value || "—"}</span>
          </div>
        )}
        {mainAddress && (
          <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded border border-border/50 bg-muted/20 col-span-2" data-testid="snap-field-address">
            <span className="text-[10px] text-muted-foreground">Adresa</span>
            <span className="text-sm font-medium">{formatAddr(mainAddress) || "—"}</span>
          </div>
        )}
      </div>

      {contacts.length > 1 && (
        <div className="space-y-1" data-testid="snap-contacts">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Kontakty ({contacts.length})</span>
          <div className="flex flex-wrap gap-1.5">
            {contacts.slice(0, 6).map((c: any, i: number) => (
              <div key={i} className="text-xs px-2 py-0.5 rounded-full border border-border/40 bg-muted/20" data-testid={`snap-contact-${i}`}>
                {c.label && <span className="text-muted-foreground mr-1">{c.label}:</span>}
                {c.value}
              </div>
            ))}
            {contacts.length > 6 && <span className="text-[10px] text-muted-foreground self-center">+{contacts.length - 6} ďalších</span>}
          </div>
        </div>
      )}

      {addresses.length > 1 && (
        <div className="space-y-1" data-testid="snap-addresses">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Adresy ({addresses.length})</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {addresses.slice(0, 4).map((a: any, i: number) => (
              <div key={i} className="text-xs px-2 py-1 rounded border border-border/40 bg-muted/20" data-testid={`snap-address-${i}`}>
                {a.isHlavna && <span className="text-[9px] text-emerald-400 mr-1 font-semibold">TP</span>}
                {formatAddr(a) || "—"}
              </div>
            ))}
          </div>
        </div>
      )}

      {latestDoc && (
        <div className="space-y-1" data-testid="snap-documents">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Doklady ({documents.length})</span>
          <div className="flex flex-wrap gap-1.5">
            {documents.slice(0, 4).map((d: any, i: number) => (
              <div key={i} className="text-xs px-2 py-1 rounded border border-border/40 bg-muted/20" data-testid={`snap-doc-${i}`}>
                <span className="text-muted-foreground mr-1">{d.documentType || d.docType}:</span>
                {d.documentNumber || d.docNumber || "—"}
                {d.validUntil && <span className="text-muted-foreground ml-1">({formatDateSlovak(d.validUntil)})</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && Object.keys(dynFields).length > 0 && (
        <details className="text-[10px]" data-testid="snap-dynamic-fields-admin">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Dynamické polia — Admin pohľad ({Object.keys(dynFields).length})</summary>
          <div className="mt-1.5 grid grid-cols-2 md:grid-cols-3 gap-1 max-h-40 overflow-y-auto">
            {Object.entries(dynFields).slice(0, 30).map(([k, v]) => (
              <div key={k} className="flex flex-col px-1.5 py-1 rounded border border-border/30 bg-muted/10" data-testid={`snap-dyn-${k}`}>
                <span className="text-[9px] text-muted-foreground font-mono">{k}</span>
                <span className="text-xs font-medium truncate">{String(v) || "—"}</span>
              </div>
            ))}
          </div>
        </details>
      )}
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

  const initialTab = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get("tab");
    if (tab && ["vseobecne", "udaje-klient", "udaje-zmluva", "dokumenty", "ziskatelia", "stavy", "zhrnutie", "odmeny", "provizne"].includes(tab)) {
      return tab as TabKey;
    }
    return "vseobecne" as TabKey;
  })();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [passwordsOpen, setPasswordsOpen] = useState(false);
  const timerRef = useRef<number>(0);

  const [contractNumber, setContractNumber] = useState("");
  const [proposalNumber, setProposalNumber] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [subjectAccordionOpen, setSubjectAccordionOpen] = useState(false);
  const [vseobecneAccordionOpen, setVseobecneAccordionOpen] = useState(false);
  const [udajeAccordionOpen, setUdajeAccordionOpen] = useState(false);
  const [lifecycleAccordionOpen, setLifecycleAccordionOpen] = useState(true);
  const [partnerId, setPartnerId] = useState<string>("");
  const [statusId, setStatusId] = useState<string>("");
  const [statusFormStatusId, setStatusFormStatusId] = useState<string>("");
  const [statusFormChangedAt, setStatusFormChangedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [statusFormVisibleToClient, setStatusFormVisibleToClient] = useState(false);
  const [statusFormNote, setStatusFormNote] = useState("");
  const [statusFormParamValues, setStatusFormParamValues] = useState<Record<string, string>>({});
  const [statusFormFiles, setStatusFormFiles] = useState<File[]>([]);
  const [statusFormRenamePrefix, setStatusFormRenamePrefix] = useState("");
  const statusFormFileRef = useRef<HTMLInputElement>(null);
  const statusDocUploadRef = useRef<StatusDocUploadHandle>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [inventoryId, setInventoryId] = useState<string>("");
  const [stateId, setStateId] = useState<string>("");
  const [signingPlace, setSigningPlace] = useState("");
  const [contractType, setContractType] = useState("Nova");
  const [paymentFrequency, setPaymentFrequency] = useState<string>("");
  const [signedDate, setSignedDate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [annualPremium, setAnnualPremium] = useState("");
  const [annualPremiumUserEdited, setAnnualPremiumUserEdited] = useState(!contractId);
  const [commissionAmount, setCommissionAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [notes, setNotes] = useState("");
  const [contractPassword, setContractPassword] = useState("");

  const [rewardRecommenders, setRewardRecommenders] = useState<Array<{ id: string; uid: string; percentage: string }>>([]);
  const [rewardSpecialistUid, setRewardSpecialistUid] = useState("");
  const [rewardSpecialistPercentage, setRewardSpecialistPercentage] = useState("");

  const { data: uidPrefixData } = useQuery<{ prefix: string }>({
    queryKey: ["/api/uid-prefix"],
  });
  const uidPrefix = uidPrefixData?.prefix || "";

  const [subjectNames, setSubjectNames] = useState<Record<string, { name: string | null; loading: boolean }>>({});
  const subjectLookupTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const lookupSubjectByUid = useCallback((uid: string) => {
    const raw = uid.replace(/\s/g, "");
    if (raw.length !== 15) {
      setSubjectNames(prev => {
        const next = { ...prev };
        delete next[raw];
        return next;
      });
      return;
    }
    if (subjectLookupTimers.current[raw]) {
      clearTimeout(subjectLookupTimers.current[raw]);
    }
    setSubjectNames(prev => ({ ...prev, [raw]: { name: null, loading: true } }));
    subjectLookupTimers.current[raw] = setTimeout(async () => {
      try {
        const res = await fetch(`/api/subjects/by-uid/${raw}`, { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setSubjectNames(prev => ({ ...prev, [raw]: { name: data.displayName, loading: false } }));
        } else {
          setSubjectNames(prev => ({ ...prev, [raw]: { name: null, loading: false } }));
        }
      } catch {
        setSubjectNames(prev => ({ ...prev, [raw]: { name: null, loading: false } }));
      }
    }, 400);
  }, []);

  const [contractSectorId, setContractSectorId] = useState<string>("");
  const [contractSectionId, setContractSectionId] = useState<string>("");
  const [sectorProductId, setSectorProductIdRaw] = useState<string>("");
  const [panelValues, setPanelValues] = useState<Record<string, string>>({});
  const [clientTypeFieldValues, setClientTypeFieldValues] = useState<Record<string, string>>({});
  const [historyPanelId, setHistoryPanelId] = useState<number | null>(null);

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

  const { data: acquirers, isLoading: acquirersLoading } = useQuery<ContractAcquirer[]>({
    queryKey: ["/api/contracts", contractId, "acquirers"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/acquirers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isEditing,
  });

  const { data: savedRewardDistributions } = useQuery<ContractRewardDistribution[]>({
    queryKey: ["/api/contracts", contractId, "reward-distributions"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/reward-distributions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isEditing,
  });

  const { data: allAppUsers } = useQuery<AppUser[]>({
    queryKey: ["/api/app-users"],
    queryFn: async () => {
      const res = await fetch(`/api/app-users`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: allStates } = useStates();
  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });
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
  const { data: lifecycleHistory } = useQuery<any[]>({
    queryKey: ["/api/contracts", contractId, "lifecycle-history"],
    enabled: !!contractId,
  });
  const { data: statusFormParams, isLoading: statusFormParamsLoading } = useQuery<any[]>({
    queryKey: ["/api/contract-statuses", statusFormStatusId, "parameters"],
    enabled: !!statusFormStatusId,
  });

  const { data: fieldFreshness } = useQuery<Record<string, string>>({
    queryKey: ["/api/subjects", subjectId ? parseInt(subjectId) : 0, "field-history", "freshness"],
    queryFn: async () => {
      if (!subjectId) return {};
      const res = await fetch(`/api/subjects/${subjectId}/field-history/freshness`, { credentials: "include" });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!subjectId,
  });

  const { data: subjectRelations } = useQuery<{ categories: Record<string, { label: string; count: number; relations: Array<{ id: number; relationType: string; relatedSubjectName: string; relatedSubjectId: number; direction: string }> }> }>({
    queryKey: ["/api/subject-relations", subjectId ? parseInt(subjectId) : 0],
    queryFn: async () => {
      if (!subjectId) return { categories: {} };
      const res = await fetch(`/api/subject-relations/${subjectId}`, { credentials: "include" });
      if (!res.ok) return { categories: {} };
      return res.json();
    },
    enabled: !!subjectId,
  });

  const selectedSubject = useMemo(() => {
    return subjects?.find(s => s.id === (subjectId ? parseInt(subjectId) : -1)) || null;
  }, [subjects, subjectId]);

  const svatynaHeatmapClass = useMemo(() => {
    if (!fieldFreshness || Object.keys(fieldFreshness).length === 0) return "";
    const now = Date.now();
    const timestamps = Object.values(fieldFreshness).map(ts => new Date(ts).getTime()).filter(t => !isNaN(t));
    if (timestamps.length === 0) return "";
    const mostRecent = Math.max(...timestamps);
    const hoursAgo = (now - mostRecent) / (1000 * 60 * 60);
    if (hoursAgo <= 24) return "bg-blue-500/10 border-blue-500/20";
    if (hoursAgo <= 72) return "bg-blue-400/5 border-blue-400/10";
    if (hoursAgo <= 168) return "bg-blue-300/3";
    return "";
  }, [fieldFreshness]);

  const statusFormSubmit = useMutation({
    mutationFn: async () => {
      const uploadHashes = statusDocUploadRef.current?.getFileHashes() || {};
      const fileHashes: Record<string, string> = {};
      for (const file of statusFormFiles) {
        const key = `${file.name}::${file.size}::${file.lastModified}`;
        if (uploadHashes[key]) {
          fileHashes[file.name] = uploadHashes[key];
        }
      }

      const formData = new FormData();
      formData.append("newStatusId", statusFormStatusId);
      formData.append("changedAt", statusFormChangedAt);
      formData.append("visibleToClient", statusFormVisibleToClient.toString());
      if (statusFormNote.trim()) formData.append("statusNote", statusFormNote);
      formData.append("parameterValues", JSON.stringify(statusFormParamValues));
      formData.append("fileHashes", JSON.stringify(fileHashes));
      if (statusFormRenamePrefix.trim()) formData.append("renamePrefix", statusFormRenamePrefix.trim());
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
      setStatusFormRenamePrefix("");
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

  const lockedBySupiskaId = existingContract?.lockedBySupiskaId;
  const { data: linkedSupiska } = useQuery<any>({
    queryKey: ["/api/supisky", lockedBySupiskaId],
    queryFn: async () => {
      const res = await fetch(`/api/supisky/${lockedBySupiskaId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!lockedBySupiskaId,
  });
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
    queryKey: ["/api/sector-products", { sectionId: contractSectionId, forContractForm: true }],
    queryFn: async () => {
      const res = await fetch(`/api/sector-products?sectionId=${contractSectionId}&forContractForm=true`, { credentials: "include" });
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

  const { data: clientTypes } = useQuery<ClientType[]>({
    queryKey: ["/api/client-types"],
  });

  const subjectTypeToClientCode: Record<string, string> = { person: "FO", company: "PO", szco: "SZCO", organization: "NS", state: "VS", os: "OS" };
  const matchedClientTypeCode = selectedSubject?.type ? subjectTypeToClientCode[selectedSubject.type] || null : null;
  const matchedClientType = matchedClientTypeCode ? clientTypes?.find(ct => ct.code === matchedClientTypeCode) : null;

  const SUBJECT_FIELD_TO_COLUMN: Record<string, string> = {
    meno: "firstName", priezvisko: "lastName", nazov_organizacie: "companyName",
    email: "email", telefon: "phone", rodne_cislo: "birthNumber",
    cislo_dokladu: "idCardNumber", iban: "iban", bic: "swift",
    firstName: "firstName", lastName: "lastName", companyName: "companyName",
    phone: "phone", birthNumber: "birthNumber", idCardNumber: "idCardNumber",
    swift: "swift",
  };

  const subjectSummaryItems = useMemo(() => {
    if (!selectedSubject || !matchedClientType) return [];
    const prefs = (selectedSubject as any).uiPreferences as { summary_fields?: Record<string, boolean> } | null;
    const sf = prefs?.summary_fields;
    const pinned = (sf && typeof sf === "object" && !Array.isArray(sf)) ? sf : {};
    const pinnedKeys = Object.entries(pinned).filter(([, v]) => v).map(([k]) => k);
    if (pinnedKeys.length === 0) return [];

    const allFields = getFieldsForClientTypeId(matchedClientType.id);
    const dynamicFields = ((selectedSubject as any).details?.dynamicFields || {}) as Record<string, string>;
    const details = ((selectedSubject as any).details || {}) as Record<string, string>;

    return pinnedKeys.map(key => {
      const fieldDef = allFields.find(f => f.fieldKey === key);
      const label = fieldDef?.shortLabel || fieldDef?.label || key;
      const col = SUBJECT_FIELD_TO_COLUMN[key];
      let value = "";
      if (col) {
        const v = (selectedSubject as any)[col];
        value = v != null ? String(v) : "";
      } else if (dynamicFields[key] !== undefined) {
        value = String(dynamicFields[key] || "");
      } else if (details[key] !== undefined) {
        value = String(details[key] || "");
      }
      return { key, label, value };
    }).filter(item => item.value !== "" && item.value !== "undefined" && item.value !== "null");
  }, [selectedSubject, matchedClientType]);

  const PARAM_TO_SUBJECT_MAP: Record<string, { field: keyof Subject; label: string }> = {
    "Rodné číslo": { field: "birthNumber" as keyof Subject, label: "Rodné číslo" },
    "Meno": { field: "firstName" as keyof Subject, label: "Meno" },
    "Priezvisko": { field: "lastName" as keyof Subject, label: "Priezvisko" },
    "Dátum narodenia": { field: "dateOfBirth" as keyof Subject, label: "Dátum narodenia" },
    "Email": { field: "email" as keyof Subject, label: "Email" },
    "Telefón": { field: "phone" as keyof Subject, label: "Telefón" },
    "IČO": { field: "ico" as keyof Subject, label: "IČO" },
    "DIČ": { field: "dic" as keyof Subject, label: "DIČ" },
    "Titul": { field: "titleBefore" as keyof Subject, label: "Titul pred menom" },
    "Ulica": { field: "street" as keyof Subject, label: "Ulica" },
    "Mesto": { field: "city" as keyof Subject, label: "Mesto" },
    "PSČ": { field: "postalCode" as keyof Subject, label: "PSČ" },
    "IBAN": { field: "iban" as keyof Subject, label: "IBAN" },
    "Názov spoločnosti": { field: "companyName" as keyof Subject, label: "Názov spoločnosti" },
  };

  const getNezhoda = (paramName: string, contractValue: string): string | null => {
    if (!selectedSubject || !contractValue) return null;
    const mapping = PARAM_TO_SUBJECT_MAP[paramName];
    if (!mapping) return null;
    const masterValue = String((selectedSubject as any)[mapping.field] || "");
    if (!masterValue) return null;
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
    if (norm(contractValue) !== norm(masterValue)) {
      return masterValue;
    }
    return null;
  };

  const urlQueryParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const urlPartnerId = urlQueryParams.get("partnerId") || "";
  const urlProductId = urlQueryParams.get("productId") || "";
  const urlSubjectId = urlQueryParams.get("subjectId") || "";
  const [preSelectApplied, setPreSelectApplied] = useState(false);

  const { data: catalogProducts } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: !!urlProductId,
  });

  useEffect(() => {
    if (preSelectApplied || isEditing) return;
    if (!urlPartnerId && !urlProductId && !urlSubjectId) return;

    const needsSectorData = !!urlProductId;
    if (needsSectorData && (!allSPForEdit || !allSectionsForEdit)) return;
    if (urlProductId && !catalogProducts) return;

    if (urlPartnerId) {
      setPartnerId(urlPartnerId);
    }

    if (urlSubjectId) {
      setSubjectId(urlSubjectId);
    }

    if (urlProductId && catalogProducts && allSPForEdit && allSectionsForEdit) {
      const catProduct = catalogProducts.find(p => p.id === parseInt(urlProductId));
      if (catProduct) {
        const matchingSP = allSPForEdit.find(sp =>
          sp.partnerId === catProduct.partnerId && sp.name === catProduct.name
        ) || allSPForEdit.find(sp =>
          sp.partnerId === parseInt(urlPartnerId)
        );

        if (matchingSP) {
          const sec = allSectionsForEdit.find(s => s.id === matchingSP.sectionId);
          if (sec) {
            setContractSectorId(sec.sectorId.toString());
            setContractSectionId(sec.id.toString());
            setSectorProductIdRaw(matchingSP.id.toString());
          }
        }
      }
    }

    setPreSelectApplied(true);
    if (urlPartnerId || urlProductId || urlSubjectId) {
      setActiveTab("udaje-klient");
    }
  }, [isEditing, urlPartnerId, urlProductId, urlSubjectId, allSPForEdit, allSectionsForEdit, catalogProducts, preSelectApplied]);

  useEffect(() => {
    timerRef.current = performance.now();
  }, []);


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

    if (existingContract) {
      const existingDynamic = existingContract.dynamicPanelValues || {};
      const ctValues: Record<string, string> = {};
      for (const [key, value] of Object.entries(existingDynamic)) {
        if (key.startsWith("ct_")) {
          ctValues[key.slice(3)] = value;
        }
      }
      if (Object.keys(ctValues).length > 0) {
        setClientTypeFieldValues(ctValues);
      }
    }
  }, [existingContract, allSPForEdit, allSectionsForEdit]);

  useEffect(() => {
    if (!annualPremiumUserEdited) return;
    const premium = parseFloat(premiumAmount);
    if (!isNaN(premium) && premium > 0) {
      const freq = PAYMENT_FREQUENCIES.find(f => f.value === paymentFrequency);
      const multiplier = freq ? freq.multiplier : 1;
      const annual = Math.round(premium * multiplier * 100) / 100;
      setAnnualPremium(annual.toString());
    } else {
      setAnnualPremium("");
    }
  }, [premiumAmount, paymentFrequency, annualPremiumUserEdited]);

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
    }
  }, [isEditing, appUser]);

  useEffect(() => {
    if (existingPasswords && existingPasswords.length > 0 && !contractPassword) {
      setContractPassword(existingPasswords[0].password || "");
    }
  }, [existingPasswords]);

  useEffect(() => {
    if (savedRewardDistributions) {
      if (savedRewardDistributions.length > 0) {
        const recommenders = savedRewardDistributions
          .filter(d => d.type === "recommender")
          .map((d, i) => ({ id: `saved-${d.id || i}`, uid: (d.uid || "").replace(/\s/g, ""), percentage: d.percentage }));
        const specialist = savedRewardDistributions.find(d => d.type === "specialist");
        setRewardRecommenders(recommenders);
        const specUid = (specialist?.uid || "").replace(/\s/g, "");
        setRewardSpecialistUid(specUid);
        setRewardSpecialistPercentage(specialist?.percentage || "");
        if (specUid) lookupSubjectByUid(specUid);
        recommenders.forEach(r => { if (r.uid) lookupSubjectByUid(r.uid); });
      } else {
        setRewardRecommenders([]);
        setRewardSpecialistUid("");
        setRewardSpecialistPercentage("");
      }
    }
  }, [savedRewardDistributions, lookupSubjectByUid]);

  const saveParamValuesMutation = useMutation({
    mutationFn: (data: { contractId: number; values: { parameterId: number; value: string; snapshotLabel?: string; snapshotType?: string; snapshotOptions?: string[]; snapshotHelpText?: string }[] }) =>
      apiRequest("POST", `/api/contracts/${data.contractId}/parameter-values`, { values: data.values }),
  });

  const saveRewardDistributionsMutation = useMutation({
    mutationFn: (data: { contractId: number; distributions: Array<{ contractId: number; type: string; uid: string; percentage: string }> }) =>
      apiRequest("POST", `/api/contracts/${data.contractId}/reward-distributions`, { distributions: data.distributions }),
  });

  function buildRewardDistributions(cId: number): Array<{ contractId: number; type: string; uid: string; percentage: string }> {
    const distributions: Array<{ contractId: number; type: string; uid: string; percentage: string }> = [];
    const hasSpecialist = rewardSpecialistUid.trim() !== "";
    const hasRecommenders = rewardRecommenders.some(r => r.uid.trim() !== "");
    if (hasSpecialist) {
      distributions.push({ contractId: cId, type: "specialist", uid: rewardSpecialistUid.trim(), percentage: rewardSpecialistPercentage || "0" });
    }
    if (hasRecommenders) {
      for (const r of rewardRecommenders) {
        if (r.uid.trim()) {
          distributions.push({ contractId: cId, type: "recommender", uid: r.uid.trim(), percentage: r.percentage || "0" });
        }
      }
    } else if (hasSpecialist) {
      distributions.push({ contractId: cId, type: "recommender", uid: rewardSpecialistUid.trim(), percentage: "0" });
    }
    return distributions;
  }

  function getRewardTotalPercentage(): number {
    let total = parseFloat(rewardSpecialistPercentage) || 0;
    for (const r of rewardRecommenders) {
      total += parseFloat(r.percentage) || 0;
    }
    return total;
  }

  function formatSkPercent(value: number): string {
    return value.toFixed(2).replace(".", ",");
  }

  function hasAnyRewardData(): boolean {
    return rewardSpecialistUid.trim() !== "" || rewardRecommenders.some(r => r.uid.trim() !== "");
  }

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
        const rewardDists = buildRewardDistributions(created.id);
        if (rewardDists.length > 0) {
          await saveRewardDistributionsMutation.mutateAsync({ contractId: created.id, distributions: rewardDists });
        }
      }
      invalidateAllContractQueries();
      toast({ title: "Uspech", description: "Zmluva uspesne zaevidovana. Teraz priradite ziskatelov a hesla." });
      navigate(`/contracts/${created.id}/edit?tab=ziskatelia`);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit zmluvu", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contracts/${contractId}`, data),
    onSuccess: async () => {
      if (contractId) {
        const paramEntries = buildParamEntries();
        await saveParamValuesMutation.mutateAsync({ contractId, values: paramEntries });
        const rewardDists = buildRewardDistributions(contractId);
        await saveRewardDistributionsMutation.mutateAsync({ contractId, distributions: rewardDists });
      }
      invalidateAllContractQueries();
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "parameter-values"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "reward-distributions"] });
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

  const CRITICAL_PARAM_NAMES = ["Rodné číslo", "Meno", "Priezvisko"];
  const [justificationModalOpen, setJustificationModalOpen] = useState(false);
  const [justificationText, setJustificationText] = useState("");
  const [criticalChanges, setCriticalChanges] = useState<{ paramName: string; oldValue: string; newValue: string }[]>([]);
  const pendingPayloadRef = useRef<any>(null);

  function getCriticalFieldChanges(): { paramName: string; oldValue: string; newValue: string }[] {
    if (!selectedSubject || !productPanels) return [];
    const changes: { paramName: string; oldValue: string; newValue: string }[] = [];
    for (const panel of productPanels) {
      for (const param of panel.parameters) {
        if (CRITICAL_PARAM_NAMES.includes(param.name)) {
          const val = panelValues[`${panel.id}_${param.id}`] || "";
          const masterVal = getNezhoda(param.name, val);
          if (masterVal && val) {
            changes.push({ paramName: param.name, oldValue: masterVal, newValue: val });
          }
        }
      }
    }
    return changes;
  }

  function buildPayload() {
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    return {
      contractNumber: contractNumber || null,
      proposalNumber: proposalNumber || null,
      subjectId: subjectId ? parseInt(subjectId) : null,
      partnerId: partnerId ? parseInt(partnerId) : null,
      productId: urlProductId ? parseInt(urlProductId) : null,
      sectorProductId: sectorProductId ? parseInt(sectorProductId) : null,
      statusId: statusId ? parseInt(statusId) : null,
      templateId: templateId ? parseInt(templateId) : null,
      inventoryId: inventoryId ? parseInt(inventoryId) : null,
      stateId: stateId ? parseInt(stateId) : null,
      companyId: appUser?.activeCompanyId || null,
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
      dynamicPanelValues: Object.keys(panelValues).length > 0 || Object.keys(clientTypeFieldValues).length > 0
        ? { ...panelValues, ...Object.fromEntries(Object.entries(clientTypeFieldValues).map(([k, v]) => [`ct_${k}`, v])) }
        : undefined,
    };
  }

  function executeSubmit(payload: any, justification?: string) {
    if (justification) {
      payload.criticalFieldJustification = justification;
    }
    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  function handleSubmit() {
    if (proposalNumber && /^-/.test(proposalNumber.trim())) {
      toast({ title: "Chyba", description: `${NAVRH_LABEL_FULL} nesmie byť záporné`, variant: "destructive" });
      return;
    }
    if (contractNumber && /^-/.test(contractNumber.trim())) {
      toast({ title: "Chyba", description: "Cislo zmluvy nemoze byt zaporne", variant: "destructive" });
      return;
    }
    const rewardTotal = getRewardTotalPercentage();
    if (rewardTotal > 100) {
      toast({ title: "Chyba", description: `Celkovy sucet odmien je ${rewardTotal}%, nesmie presiahnuť 100 %`, variant: "destructive" });
      return;
    }
    const payload = buildPayload();
    const changes = getCriticalFieldChanges();
    if (changes.length > 0 && isEditing) {
      setCriticalChanges(changes);
      pendingPayloadRef.current = payload;
      setJustificationText("");
      setJustificationModalOpen(true);
      return;
    }
    executeSubmit(payload);
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

  const currentCompany = companies?.find(c => c.id === appUser?.activeCompanyId);

  const filteredStatuses = (() => {
    if (!statuses) return [];
    if (!statusVisibilityMap) return [];
    const cId = appUser?.activeCompanyId || null;
    const spId = sectorProductId ? parseInt(sectorProductId) : null;
    const secId = contractSectionId ? parseInt(contractSectionId) : null;
    const sId = contractSectorId ? parseInt(contractSectorId) : null;
    const activeStateId = stateId ? parseInt(stateId) : (appUser?.activeStateId || null);
    const hasFormContext = !!(sId || secId || spId);

    return statuses.filter(s => {
      if (s.stateId && activeStateId && s.stateId !== activeStateId) {
        return false;
      }

      const meta = statusVisibilityMap[s.id];
      if (!meta) {
        return true;
      }

      if (meta.companies.length > 0 && cId) {
        if (!meta.companies.includes(cId)) {
          return false;
        }
      }

      if (meta.visibility.length > 0 && hasFormContext) {
        const matchesSector = sId && meta.visibility.some(v => v.entityType === "sector" && v.entityId === sId);
        const matchesSection = secId && meta.visibility.some(v => v.entityType === "section" && v.entityId === secId);
        const matchesProduct = spId && meta.visibility.some(v => v.entityType === "product" && v.entityId === spId);
        if (!matchesSector && !matchesSection && !matchesProduct) {
          return false;
        }
      }

      if ((meta as any).contractTypes && (meta as any).contractTypes.length > 0 && contractType) {
        if (!(meta as any).contractTypes.includes(contractType)) {
          return false;
        }
      }

      return true;
    });
  })();

  return (
    <div className="flex flex-col min-h-full" data-testid="contract-form-root">
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
        {!isEditing && appUser && (
          <span className="text-xs text-muted-foreground ml-6" data-testid="text-form-user-name">
            {appUser.uid ? `${formatUid(appUser.uid)} - ` : ""}{[appUser.firstName, appUser.lastName].filter(Boolean).join(" ") || appUser.username}
          </span>
        )}
        {isEditing && existingContract && (
          <span className="text-2xl font-black tracking-tight tabular-nums ml-auto" data-testid="text-contract-number">
            {(existingContract as any).globalNumber || existingContract.contractNumber || `${existingContract.id}`}
          </span>
        )}
      </div>

      {isEditing && existingContract && (existingContract as any).isFirstContract && (
        <div className="flex-none px-3 py-2 bg-red-900/20 border-b border-red-500/50" data-testid="banner-first-contract">
          <div className="flex items-center gap-2 text-red-400 text-sm font-medium">
            <span className="text-base">🛑</span>
            <span>Provízny stop — Prvá zmluva v divízii. Beneficient: <strong>{(existingContract as any).commissionRedirectedToName || "Nadriadený neurčený"}</strong></span>
          </div>
        </div>
      )}

      <div className="flex-none border-b border-border bg-card/50">
        <div className="flex items-center gap-0.5 px-2 flex-wrap">
          {TABS.filter(tab => {
            const accessRole = (existingContract as any)?.accessRole;
            if (accessRole === 'klient' && (tab.key === 'odmeny' || tab.key === 'provizne' || tab.key === 'ziskatelia')) return false;
            return true;
          }).map(tab => {
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
                <CompactField label="Sprievodka - Preberací protokol">
                  <Input
                    value={inventoryId ? (inventories?.find(i => i.id.toString() === inventoryId)?.sequenceNumber?.toString() || "Pridelene pri ulozeni") : ""}
                    readOnly
                    className="bg-muted/50 cursor-default font-mono"
                    data-testid="input-inventory-number"
                  />
                </CompactField>
                <CompactField label="Súpiska - Odovzdávací protokol">
                  <Input
                    value={linkedSupiska?.supId || "Nepridelené systémom"}
                    readOnly
                    className="bg-muted/50 cursor-default font-mono"
                    data-testid="input-supiska-name"
                  />
                </CompactField>
              </div>

              <div className="grid grid-cols-2 gap-[clamp(0.5rem,1vw,1rem)]">
                <CompactField label="Pôvod zmluvy">
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
                <CompactField label={`${NAVRH_LABEL_SHORT}${isFieldRequired("proposalNumber") ? " *" : ""}`}>
                  <Input
                    value={proposalNumber}
                    onChange={e => setProposalNumber(e.target.value)}
                    className={proposalNumber && /^-/.test(proposalNumber.trim()) ? "border-red-500 ring-1 ring-red-500" : ""}
                    data-testid="input-contract-proposal"
                  />
                  {proposalNumber && /^-/.test(proposalNumber.trim()) && (
                    <p className="text-[10px] text-red-500 mt-0.5">{NAVRH_LABEL_FULL} nesmie byť záporné</p>
                  )}
                </CompactField>
                <CompactField label="Cislo zmluvy">
                  <Input
                    value={contractNumber}
                    onChange={e => setContractNumber(e.target.value)}
                    className={contractNumber && /^-/.test(contractNumber.trim()) ? "border-red-500 ring-1 ring-red-500" : ""}
                    data-testid="input-contract-number"
                  />
                  {contractNumber && /^-/.test(contractNumber.trim()) && (
                    <p className="text-[10px] text-red-500 mt-0.5">Cislo zmluvy nemoze byt zaporne</p>
                  )}
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
                {!isEditing && (
                  <CompactField label="Stav zmluvy">
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
                  </CompactField>
                )}
              </div>

              <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                <CompactField label="Dátum uzatvorenia *">
                  <DateSegmentInput value={signedDate} onChange={setSignedDate} data-testid="input-signed-date" />
                </CompactField>
                <CompactField label="Ucinnost od *">
                  <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} data-testid="input-effective-date" />
                </CompactField>
                <CompactField label="Koniec zmluvy">
                  <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={getDateSemaphoreClasses(getDateSemaphore(expiryDate))} data-testid="input-expiry-date" />
                </CompactField>
              </div>

              <div className="grid grid-cols-4 gap-[clamp(0.5rem,1vw,1rem)]">
                <CompactField label={`Frekvencia platenia${isFieldRequired("paymentFrequency") ? " *" : ""}`}>
                  <Select value={paymentFrequency} onValueChange={v => { setAnnualPremiumUserEdited(true); setPaymentFrequency(v); }}>
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
                <CompactField label="Lehotne poistne *">
                  <Input type="number" value={premiumAmount} onChange={e => { setAnnualPremiumUserEdited(true); setPremiumAmount(e.target.value); }} className="font-mono" data-testid="input-premium-amount" />
                </CompactField>
                <CompactField label={`Rocne poistne${isFieldRequired("annualPremium") ? " *" : ""}`}>
                  <Input type="number" value={annualPremium} readOnly className="font-mono bg-muted/50" data-testid="input-annual-premium" />
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
            <div className={`space-y-3 rounded-md border p-3 ${svatynaHeatmapClass}`} data-testid="section-udaje-klient">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Shield className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-semibold">Klientsky profil</h2>
                <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-500/30 text-amber-400">Statický priečinok</Badge>
                {selectedSubject && existingContract?.subjectSnapshot && (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 border-amber-500/30 text-amber-400" data-testid="badge-stroj-casu">
                    <History className="w-2.5 h-2.5 mr-0.5" /> Zmrazené dáta
                  </Badge>
                )}
                {selectedSubject && !existingContract?.subjectSnapshot && (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 border-cyan-500/30 text-cyan-400" data-testid="badge-stroj-casu-live">
                    <History className="w-2.5 h-2.5 mr-0.5" /> Stroj času aktívny
                  </Badge>
                )}
                {selectedSubject && selectedSubject.isDeceased && (
                  <Badge variant="outline" className="border-purple-500/40 text-purple-400 text-[9px] px-1.5 animate-pulse" data-testid="badge-in-memoriam">
                    <span className="mr-1">In Memoriam</span>
                  </Badge>
                )}
                {selectedSubject && (selectedSubject.lifecycleStatus === "zaniknuta" || selectedSubject.lifecycleStatus === "v_likvidacii") && (
                  <Badge variant="outline" className="border-red-500/40 text-red-400 text-[9px] px-1.5" data-testid="badge-lifecycle-status">
                    {selectedSubject.lifecycleStatus === "zaniknuta" ? "Zaniknutá" : "V likvidácii"}
                  </Badge>
                )}
                {selectedSubject && !selectedSubject.isDeceased && selectedSubject.lifecycleStatus !== "zaniknuta" && selectedSubject.lifecycleStatus !== "v_likvidacii" && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" data-testid="indicator-active" />
                )}
                <Lock className="w-3 h-3 text-slate-500 ml-auto" />
                <span className="text-[10px] text-slate-500">Len na čítanie — editácia cez Profil subjektu</span>
              </div>
              {selectedSubject && subjectRelations && (() => {
                const allRelations = Object.values(subjectRelations.categories || {}).flatMap(cat => cat.relations || []);
                if (allRelations.length === 0) return null;
                return (
                  <div className="rounded-md border border-border/50 bg-muted/20 p-2.5 space-y-1.5" data-testid="section-relacie">
                    <div className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Relácie</span>
                      <Badge variant="outline" className="text-[9px] px-1 py-0">{allRelations.length}</Badge>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                      {allRelations.slice(0, 8).map(rel => (
                        <div key={rel.id} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-muted/30" data-testid={`relation-${rel.id}`}>
                          <Users className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">{rel.relationType}:</span>
                          <span className="font-medium truncate">{rel.relatedSubjectName}</span>
                        </div>
                      ))}
                    </div>
                    {allRelations.length > 8 && (
                      <span className="text-[10px] text-muted-foreground">+{allRelations.length - 8} ďalších relácií</span>
                    )}
                  </div>
                );
              })()}

              {!selectedSubject && !existingContract?.subjectSnapshot && (
                <div className="text-center py-8 text-sm text-muted-foreground" data-testid="no-client-selected">
                  Vyberte klienta z rozbaľovacieho zoznamu vyššie
                </div>
              )}
              {existingContract?.subjectSnapshot && (
                <SnapshotSubjectView
                  snapshot={existingContract.subjectSnapshot as Record<string, any>}
                  snapshotAt={existingContract.subjectSnapshotAt ? String(existingContract.subjectSnapshotAt) : null}
                  appUserRole={appUser?.role}
                  liveSubject={selectedSubject ?? null}
                />
              )}
              {selectedSubject && !existingContract?.subjectSnapshot && (
                <>
                  <div className="rounded-md border border-yellow-700/40 bg-yellow-950/20 px-3 py-2 flex items-center gap-2" data-testid="no-snapshot-banner">
                    <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                    <span className="text-xs text-yellow-300">Živé dáta — snímka nebola zachytená pri vytváraní zmluvy</span>
                  </div>
                  <SubjektView subject={selectedSubject} />
                </>
              )}
            </div>
          </div>

          <div style={{ display: activeTab === "udaje-zmluva" ? 'block' : 'none' }}>
            <div className="space-y-3" data-testid="section-udaje-zmluva">
              <h2 className="text-base font-semibold">Údaje o zmluve</h2>

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
                <CompactField label="Odvetvie">
                  <Select value={contractSectionId} onValueChange={setContractSectionIdCascade} disabled={!contractSectorId}>
                    <SelectTrigger data-testid="select-contract-section">
                      <SelectValue placeholder="Vyberte odvetvie" />
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
                        <SelectItem key={p.id} value={p.id.toString()} data-testid={`option-contract-product-${p.id}`}>
                          <div className="flex items-center gap-2">
                            {(p as any).lifecycleStatus === "eject" && <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />}
                            <span>{p.name} {p.abbreviation ? `(${p.abbreviation})` : ''}</span>
                            {(p as any).lifecycleStatus === "eject" && <span className="text-xs text-orange-500">Dobiehanie</span>}
                          </div>
                        </SelectItem>
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
                      {contractId && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="ml-auto"
                          onClick={() => setHistoryPanelId(historyPanelId === panel.id ? null : panel.id)}
                          title="História zmien parametrov"
                          data-testid={`btn-param-history-${panel.id}`}
                        >
                          <History className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    {historyPanelId === panel.id && contractId && (
                      <ParamValueHistoryInline contractId={contractId} panelParams={panel.parameters} />
                    )}
                    <div style={{ display: panel.parameters.length > 0 ? 'block' : 'none' }}>
                      <div className="space-y-2">
                        {panel.parameters.map(param => {
                          const conditionalHidden =
                            ((param.id === 56 || param.id === 57) && panelValues[`${panel.id}_55`]?.toLowerCase() !== "ano") ||
                            (param.id === 70 && panelValues[`${panel.id}_69`]?.toLowerCase() !== "ano") ||
                            (param.id === 72 && panelValues[`${panel.id}_71`]?.toLowerCase() !== "ano");
                          return (
                          <div key={param.id} className="grid grid-cols-4 gap-2 items-start" style={{ display: conditionalHidden ? 'none' : undefined }}>
                            <div className="col-span-3">
                              <label className="text-xs font-medium">
                                {param.name}
                                <span style={{ display: param.isRequired ? 'inline' : 'none' }}><span className="text-destructive ml-1">*</span></span>
                              </label>
                              <div style={{ display: param.helpText ? 'block' : 'none' }}><p className="text-xs text-muted-foreground">{param.helpText}</p></div>
                            </div>
                            <div className="col-span-1">
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
                              <div style={{ display: (param.paramType === "combobox" || param.paramType === "jedna_moznost") && param.options?.length > 0 ? 'block' : 'none' }}>
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
                              <div style={{ display: param.paramType === "viac_moznosti" && param.options?.length > 0 ? 'block' : 'none' }}>
                                <MultiSelectCheckboxes
                                  paramId={`${panel.id}_${param.id}`}
                                  options={param.options || []}
                                  value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                                  onChange={(val) => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: val }))}
                                />
                              </div>
                              <div style={{ display: param.paramType === "decimal" ? 'block' : 'none' }}>
                                <DecimalInput
                                  value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                                  onChange={val => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: val }))}
                                  unit={param.unit}
                                  decimalPlaces={param.decimalPlaces}
                                  testId={`input-panel-param-${panel.id}-${param.id}`}
                                />
                              </div>
                              <div style={{ display: param.paramType !== "textarea" && param.paramType !== "boolean" && param.paramType !== "decimal" && !((param.paramType === "combobox" || param.paramType === "jedna_moznost") && param.options?.length > 0) && param.paramType !== "viac_moznosti" ? 'block' : 'none' }}>
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    type={param.paramType === "number" || param.paramType === "currency" || param.paramType === "percent" ? "number" : param.paramType === "date" ? "date" : param.paramType === "datetime" ? "datetime-local" : param.paramType === "email" ? "email" : param.paramType === "url" ? "url" : "text"}
                                    value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                                    onChange={e => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: e.target.value }))}
                                    data-testid={`input-panel-param-${panel.id}-${param.id}`}
                                  />
                                  {(() => {
                                    if (isContractAnniversaryParam(param.id)) {
                                      const s = getContractAnniversaryStatus(param.id, panelValues[`${panel.id}_${param.id}`]);
                                      return s ? <span className={`w-3 h-3 rounded-full shrink-0 ${s.dotClass}`} title={s.label} data-testid={`anniversary-dot-${param.id}`} /> : null;
                                    }
                                    if (isGapParam(param.id)) {
                                      const contractEndVal = Object.entries(panelValues).find(([k]) => k.endsWith(`_${CONTRACT_END_PARAM_ID}`))?.[1];
                                      const s = getGapInsuranceStatus(panelValues[`${panel.id}_${param.id}`], contractEndVal);
                                      return s ? <span className={`w-3 h-3 rounded-full shrink-0 ${s.dotClass}`} title={s.label} data-testid={`gap-dot-${param.id}`} /> : null;
                                    }
                                    return null;
                                  })()}
                                  {(() => {
                                    const val = panelValues[`${panel.id}_${param.id}`] || "";
                                    const masterVal = getNezhoda(param.name, val);
                                    if (!masterVal) return null;
                                    return (
                                      <span className="shrink-0" title={`Pozor: V Master Data je evidovaná iná hodnota: ${masterVal}`} data-testid={`nezhoda-${param.id}`}>
                                        <AlertTriangle className="w-4 h-4 text-orange-400" />
                                      </span>
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                          );
                        })}
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
                      <span className="text-sm font-semibold">Priečinky a panely produktu</span>
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
              {(() => {
                const allDocs = Array.isArray((existingContract as any)?.documents) ? (existingContract as any).documents as any[] : [];
                if (allDocs.length === 0) {
                  return (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <FolderOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground" data-testid="text-dokumenty-empty">
                          Žiadne dokumenty
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          Dokumenty pridané pri zmene stavu sa tu automaticky zobrazia
                        </p>
                      </CardContent>
                    </Card>
                  );
                }
                return (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-muted-foreground">{allDocs.length} {allDocs.length === 1 ? "dokument" : allDocs.length < 5 ? "dokumenty" : "dokumentov"}</span>
                      </div>
                      <div className="space-y-1.5">
                        {allDocs.map((doc: any, idx: number) => (
                          <a
                            key={doc.id || idx}
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group"
                            data-testid={`doc-item-${idx}`}
                          >
                            <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{doc.name || `Dokument ${idx + 1}`}</div>
                              <div className="flex gap-2 text-[10px] text-muted-foreground">
                                {doc.sourceStatusName && <span>Stav: {doc.sourceStatusName}</span>}
                                {doc.uploadedAt && <span>{formatDateSlovak(doc.uploadedAt)}</span>}
                                {doc.fileSize && <span>{(doc.fileSize / 1024).toFixed(0)} KB</span>}
                              </div>
                            </div>
                            <Eye className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </a>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
            </div>
          </div>

          <div style={{ display: activeTab === "ziskatelia" && (existingContract as any)?.accessRole !== 'klient' ? 'block' : 'none' }}>
            <div className="space-y-3" data-testid="section-ziskatelia">
              <h2 className="text-base font-semibold">Ziskatelia</h2>
              {isEditing ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Rozdelenie odmien</h3>
                    {rewardRecommenders.length > 2 ? (
                      <div className="rounded-md p-2 mb-3 bg-slate-500/10 border border-slate-500/30" data-testid="text-reward-status-zisk">
                        <p className="text-sm font-medium text-slate-400">Viac ako 2 odporúčatelia — kontrola 100 % sa nevykonáva</p>
                      </div>
                    ) : (
                      <div className={`rounded-md p-2 mb-3 ${Math.round(getRewardTotalPercentage() * 100) === 10000 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                        <p className={`text-sm font-medium ${Math.round(getRewardTotalPercentage() * 100) === 10000 ? 'text-emerald-600' : 'text-destructive'}`} data-testid="text-reward-status-zisk">
                          {Math.round(getRewardTotalPercentage() * 100) === 10000
                            ? `Celkový súčet odmien je 100,00 % - Uloženie je povolené.`
                            : `Celkový súčet odmien nie je 100,00 % (${formatSkPercent(getRewardTotalPercentage())} %) - Uloženie je zablokované.`
                          }
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <h4 className="text-sm font-semibold" data-testid="text-specialist-title-zisk">Odmena pre specialistu</h4>
                          <p className="text-xs text-muted-foreground">Osoba zodpovedna za spravnost zmluvy</p>
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <UIDInput
                                value={rewardSpecialistUid}
                                onChange={(val) => {
                                  setRewardSpecialistUid(val);
                                  lookupSubjectByUid(val);
                                }}
                                prefix={uidPrefix}
                                subjectName={subjectNames[rewardSpecialistUid]?.name ?? null}
                                isLoadingSubject={subjectNames[rewardSpecialistUid]?.loading ?? false}
                                placeholder="UID kód"
                                data-testid="input-specialist-uid-zisk"
                              />
                            </div>
                            <div className="w-28 pt-0">
                              <div className="flex items-center gap-1">
                                <Input
                                  placeholder="0"
                                  value={rewardSpecialistPercentage}
                                  onChange={e => {
                                    const val = e.target.value.replace(/,/g, ".");
                                    if (val === "" || /^-?\d*\.?\d{0,2}$/.test(val)) {
                                      setRewardSpecialistPercentage(val);
                                    }
                                  }}
                                  className="font-mono text-sm"
                                  data-testid="input-specialist-pct-zisk"
                                />
                                <span className="text-sm text-muted-foreground">%</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Ak nie su zadani odporucitelia, specialista bude automaticky pridany ako odporucitel s 0%.
                          </p>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4 space-y-3">
                          <h4 className="text-sm font-semibold" data-testid="text-recommenders-title-zisk">Odmeny pre odporucitelov</h4>
                          <div className="space-y-2">
                            {rewardRecommenders.map((rec, idx) => (
                              <div key={rec.id} className="flex items-start gap-2" data-testid={`row-recommender-zisk-${idx}`}>
                                <div className="flex-1">
                                  <UIDInput
                                    value={rec.uid}
                                    onChange={(val) => {
                                      const next = [...rewardRecommenders];
                                      next[idx] = { ...next[idx], uid: val };
                                      setRewardRecommenders(next);
                                      lookupSubjectByUid(val);
                                    }}
                                    prefix={uidPrefix}
                                    subjectName={subjectNames[rec.uid]?.name ?? null}
                                    isLoadingSubject={subjectNames[rec.uid]?.loading ?? false}
                                    placeholder="UID kód"
                                    data-testid={`input-recommender-uid-zisk-${idx}`}
                                  />
                                </div>
                                <div className="w-28 pt-0">
                                  <div className="flex items-center gap-1">
                                    <Input
                                      placeholder="0"
                                      value={rec.percentage}
                                      onChange={e => {
                                        const val = e.target.value.replace(/,/g, ".");
                                        if (val === "" || /^-?\d*\.?\d{0,2}$/.test(val)) {
                                          const next = [...rewardRecommenders];
                                          next[idx] = { ...next[idx], percentage: val };
                                          setRewardRecommenders(next);
                                        }
                                      }}
                                      className="font-mono text-sm"
                                      data-testid={`input-recommender-pct-zisk-${idx}`}
                                    />
                                    <span className="text-sm text-muted-foreground">%</span>
                                  </div>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    const next = rewardRecommenders.filter((_, i) => i !== idx);
                                    setRewardRecommenders(next);
                                  }}
                                  data-testid={`button-remove-recommender-zisk-${idx}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: rewardRecommenders.length === 0 ? 'block' : 'none' }}>
                            <p className="text-xs text-muted-foreground" data-testid="text-no-recommenders-zisk">Ziadni odporucitelia</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRewardRecommenders([...rewardRecommenders, { id: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, uid: "", percentage: "" }])}
                            data-testid="button-add-recommender-zisk"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Pridat odporucitela
                          </Button>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </>
              ) : (
                <Card>
                  <CardContent className="p-4 text-center">
                    <UserCheck className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground" data-testid="text-ziskatelia-save-first">
                      Najprv ulozte zmluvu, potom mozete priradit ziskatelov.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div style={{ display: activeTab === "odmeny" && (existingContract as any)?.accessRole !== 'klient' ? 'block' : 'none' }}>
            <div className="space-y-4" data-testid="section-odmeny">
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

              <div className="border-t border-border pt-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  Rozdelenie odmien pre specialistu a odporucitelov je dostupne v zalozke <span className="font-semibold text-foreground">Ziskatelia</span>.
                </p>
                <div className="mt-2">
                  <Badge variant="outline" data-testid="badge-reward-total">
                    Celkom: {formatSkPercent(getRewardTotalPercentage())} % / 100,00 %
                  </Badge>
                </div>
              </div>
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
              renamePrefix={statusFormRenamePrefix}
              setRenamePrefix={setStatusFormRenamePrefix}
              docUploadRef={statusDocUploadRef}
              contractSectorId={contractSectorId}
              contractSectionId={contractSectionId}
              sectorProductId={sectorProductId}
              statusChangeLogs={statusChangeLogs}
              lifecycleHistory={lifecycleHistory}
            />
          </div>

          <div style={{ display: activeTab === "zhrnutie" ? 'block' : 'none' }}>
            <div className="space-y-3" data-testid="section-zhrnutie">
              {selectedSubject && (
                <Card
                  className={`border-blue-500/30 bg-blue-500/5 cursor-pointer transition-all hover:shadow-md ${subjectAccordionOpen ? "ring-1 ring-blue-500/20" : ""}`}
                  onClick={() => setSubjectAccordionOpen(prev => !prev)}
                  data-testid="summary-subject-accordion"
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <SubjectProfilePhoto subjectId={selectedSubject.id} size="md" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap mb-1">
                          <span className="text-base font-bold flex items-center gap-1.5" data-testid="summary-subject-name">
                            {`${selectedSubject.firstName || ""} ${selectedSubject.lastName || ""}`.trim() || selectedSubject.companyName || "-"}
                            {(selectedSubject as any).effectiveListStatus === "cierny" && <Ban className="w-4 h-4 text-red-500 shrink-0" />}
                            {(selectedSubject as any).effectiveListStatus === "cerveny" && <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />}
                          </span>
                          {selectedSubject.uid && (
                            <span className="text-xs font-mono text-blue-400" data-testid="summary-subject-uid">{formatUid(selectedSubject.uid)}</span>
                          )}
                          {selectedSubject.type && (
                            <Badge variant="outline" className="text-[10px] h-4" data-testid="summary-subject-type">{selectedSubject.type}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                          {selectedSubject.email && (
                            <span data-testid="summary-subject-email">{selectedSubject.email}</span>
                          )}
                          {selectedSubject.phone && (
                            <span data-testid="summary-subject-phone">{formatPhone(selectedSubject.phone)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 mt-1">
                        {subjectSummaryItems.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-4">{subjectSummaryItems.length} {subjectSummaryItems.length === 1 ? "pole" : subjectSummaryItems.length < 5 ? "polia" : "polí"}</Badge>
                        )}
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${subjectAccordionOpen ? "rotate-90" : ""}`} />
                      </div>
                    </div>

                    {subjectAccordionOpen && (
                      <div className="mt-4 pt-3 border-t border-blue-500/20" onClick={e => e.stopPropagation()}>
                        {subjectSummaryItems.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {subjectSummaryItems.map(item => (
                              <div key={item.key} className="bg-background/60 rounded-lg px-3 py-2 border border-border/50" data-testid={`summary-pinned-${item.key}`}>
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{item.label}</div>
                                <div className="text-sm font-medium truncate">{item.value}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-3">
                            <Eye className="w-5 h-5 text-muted-foreground/30 mx-auto mb-1.5" />
                            <p className="text-xs text-muted-foreground">
                              Žiadne polia označené v profile
                            </p>
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                              Označte polia ikonou oka v záložke „Klientsky profil" a zobrazia sa tu
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${vseobecneAccordionOpen ? "ring-1 ring-border/40" : ""}`}
                onClick={() => setVseobecneAccordionOpen(prev => !prev)}
                data-testid="summary-vseobecne-accordion"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5" />
                      Všeobecné
                    </h3>
                    <div className="flex items-center gap-2">
                      {!vseobecneAccordionOpen && (() => {
                        const filled = [
                          inventoryId, partners?.find(p => p.id === (partnerId ? parseInt(partnerId) : -1))?.name,
                          currentCompany?.name, templateId, existingContract?.globalNumber, proposalNumber,
                          contractNumber, signingPlace, contractType, statusId, signedDate, effectiveDate,
                          expiryDate, paymentFrequency, premiumAmount, annualPremium, stateId
                        ].filter(Boolean).length;
                        return <Badge variant="secondary" className="text-[10px] h-4">{filled}/19</Badge>;
                      })()}
                      {!vseobecneAccordionOpen && (() => {
                        const s = statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1));
                        if (!s) return null;
                        const sc = getSmartStatusColor(s.color, expiryDate);
                        return (
                          <div className="flex items-center gap-1.5">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sc }} />
                            <span className="text-xs font-medium" style={{ color: sc }}>{s.name}</span>
                          </div>
                        );
                      })()}
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${vseobecneAccordionOpen ? "rotate-90" : ""}`} />
                    </div>
                  </div>

                  {vseobecneAccordionOpen && (
                    <div className="mt-3 pt-3 border-t border-border/50" onClick={e => e.stopPropagation()}>
                      <div className="space-y-[clamp(0.35rem,0.8vh,0.75rem)]">

                        <div className="grid grid-cols-2 gap-[clamp(0.5rem,1vw,1rem)]">
                          <CompactField label="Sprievodka - Preberací protokol">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default font-mono" data-testid="summary-sprievodka">
                              {inventoryId ? (inventories?.find(i => i.id.toString() === inventoryId)?.sequenceNumber?.toString() || "Pridelené pri uložení") : ""}
                            </div>
                          </CompactField>
                          <CompactField label="Súpiska - Odovzdávací protokol">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default font-mono" data-testid="summary-supiska">
                              {linkedSupiska?.supId || "Nepridelené systémom"}
                            </div>
                          </CompactField>
                        </div>

                        <div className="grid grid-cols-2 gap-[clamp(0.5rem,1vw,1rem)]">
                          <CompactField label="Pôvod zmluvy">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm text-muted-foreground cursor-default" data-testid="summary-origin">
                              Vyberte kalkulačku
                            </div>
                          </CompactField>
                          <CompactField label="Šablóna zmluvy">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="summary-template">
                              {templates?.find(t => t.id === (templateId ? parseInt(templateId) : -1))?.name || <span className="text-muted-foreground">Vyberte šablónu</span>}
                            </div>
                          </CompactField>
                        </div>

                        <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                          <CompactField label="Číslo kontraktu">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="summary-global-number">
                              {existingContract?.globalNumber?.toString() || "Pridelené pri uložení"}
                            </div>
                          </CompactField>
                          <CompactField label={`${NAVRH_LABEL_FULL}${isFieldRequired("proposalNumber") ? " *" : ""}`}>
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="summary-proposal">
                              {proposalNumber}
                            </div>
                          </CompactField>
                          <CompactField label="Číslo zmluvy">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="summary-contract-number">
                              {contractNumber}
                            </div>
                          </CompactField>
                        </div>

                        <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                          <CompactField label={`Miesto podpisu${isFieldRequired("signingPlace") ? " *" : ""}`}>
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="summary-signing-place">
                              {signingPlace}
                            </div>
                          </CompactField>
                          <CompactField label={`Typ zmluvy${isFieldRequired("contractType") ? " *" : ""}`}>
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="summary-type">
                              {contractType ? (CONTRACT_TYPES.find(t => t.value === contractType)?.label || contractType) : <span className="text-muted-foreground">Vyberte typ</span>}
                            </div>
                          </CompactField>
                          <CompactField label="Stav zmluvy">
                            <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/30 cursor-default" data-testid="summary-status">
                              {statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1)) ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getSmartStatusColor(statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.color, expiryDate) }} />
                                  <span className="text-sm" style={{ color: getSmartStatusColor(statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.color, expiryDate) }}>{statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.name}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Bez stavu</span>
                              )}
                            </div>
                          </CompactField>
                        </div>

                        <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                          <CompactField label="Dátum uzatvorenia *">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="summary-signed">
                              {signedDate}
                            </div>
                          </CompactField>
                          <CompactField label="Účinnosť od *">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="summary-effective">
                              {effectiveDate}
                            </div>
                          </CompactField>
                          <CompactField label="Koniec zmluvy">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="summary-expiry">
                              {expiryDate}
                            </div>
                          </CompactField>
                        </div>

                        <div className="grid grid-cols-4 gap-[clamp(0.5rem,1vw,1rem)]">
                          <CompactField label={`Frekvencia platenia${isFieldRequired("paymentFrequency") ? " *" : ""}`}>
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="summary-frequency">
                              {PAYMENT_FREQUENCIES.find(f => f.value === paymentFrequency)?.label || <span className="text-muted-foreground">Vyberte frekvenciu</span>}
                            </div>
                          </CompactField>
                          <CompactField label="Lehotné poistné *">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm font-mono cursor-default" data-testid="summary-premium">
                              {premiumAmount}
                            </div>
                          </CompactField>
                          <CompactField label={`Ročné poistné${isFieldRequired("annualPremium") ? " *" : ""}`}>
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm font-mono cursor-default" data-testid="summary-annual">
                              {annualPremium}
                            </div>
                          </CompactField>
                          <div className="flex items-end">
                            <div className="flex items-center justify-center h-9 px-3 border rounded-md bg-muted/30 text-sm text-muted-foreground cursor-default w-full" data-testid="summary-passwords-placeholder">
                              Heslá k zmluvám
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md ${udajeAccordionOpen ? "ring-1 ring-border/40" : ""}`}
                onClick={() => setUdajeAccordionOpen(prev => !prev)}
                data-testid="summary-udaje-accordion"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <ClipboardList className="w-3.5 h-3.5" />
                      Údaje o zmluve
                    </h3>
                    <div className="flex items-center gap-2">
                      {!udajeAccordionOpen && contractNumber && <span className="text-xs font-mono text-muted-foreground">{contractNumber}</span>}
                      {!udajeAccordionOpen && premiumAmount && <span className="text-xs font-mono text-muted-foreground">{premiumAmount} {currency}</span>}
                      {!udajeAccordionOpen && existingContract?.updatedAt && (() => {
                        const days = Math.floor((Date.now() - new Date(existingContract.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                        const color = days < 30 ? "#22c55e" : days < 60 ? "#f59e0b" : "#ef4444";
                        return <div className={`w-2.5 h-2.5 rounded-full shrink-0${days > 90 ? " animate-pulse" : ""}`} style={{ backgroundColor: color }} />;
                      })()}
                      <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${udajeAccordionOpen ? "rotate-90" : ""}`} />
                    </div>
                  </div>

                  {udajeAccordionOpen && (
                    <div className="mt-3 pt-3 border-t border-border/50 space-y-2" onClick={e => e.stopPropagation()}>
                      <div className="space-y-[clamp(0.35rem,0.8vh,0.75rem)]">

                        <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                          <CompactField label="Číslo kontraktu">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-global-number">
                              {existingContract?.globalNumber?.toString() || "Pridelené pri uložení"}
                            </div>
                          </CompactField>
                          <CompactField label={`${NAVRH_LABEL_FULL}${isFieldRequired("proposalNumber") ? " *" : ""}`}>
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-proposal">
                              {proposalNumber}
                            </div>
                          </CompactField>
                          <CompactField label="Číslo zmluvy">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-contract-number">
                              {contractNumber}
                            </div>
                          </CompactField>
                        </div>

                        <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                          <CompactField label={`Miesto podpisu${isFieldRequired("signingPlace") ? " *" : ""}`}>
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-signing-place">
                              {signingPlace}
                            </div>
                          </CompactField>
                          <CompactField label={`Typ zmluvy${isFieldRequired("contractType") ? " *" : ""}`}>
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-type">
                              {contractType ? (CONTRACT_TYPES.find(t => t.value === contractType)?.label || contractType) : <span className="text-muted-foreground">Vyberte typ</span>}
                            </div>
                          </CompactField>
                          <CompactField label="Stav zmluvy">
                            <div className="flex items-center gap-2 h-9 px-3 border rounded-md bg-muted/30 cursor-default" data-testid="udaje-status">
                              {statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1)) ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: getSmartStatusColor(statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.color, expiryDate) }} />
                                  <span className="text-sm" style={{ color: getSmartStatusColor(statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.color, expiryDate) }}>{statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.name}</span>
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Bez stavu</span>
                              )}
                            </div>
                          </CompactField>
                        </div>

                        <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                          <CompactField label="Dátum uzatvorenia *">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-signed">
                              {signedDate}
                            </div>
                          </CompactField>
                          <CompactField label="Účinnosť od *">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-effective">
                              {effectiveDate}
                            </div>
                          </CompactField>
                          <CompactField label="Koniec zmluvy">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-expiry">
                              {expiryDate}
                            </div>
                          </CompactField>
                        </div>

                        <div className="grid grid-cols-4 gap-[clamp(0.5rem,1vw,1rem)]">
                          <CompactField label={`Frekvencia platenia${isFieldRequired("paymentFrequency") ? " *" : ""}`}>
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-frequency">
                              {PAYMENT_FREQUENCIES.find(f => f.value === paymentFrequency)?.label || <span className="text-muted-foreground">Vyberte frekvenciu</span>}
                            </div>
                          </CompactField>
                          <CompactField label="Lehotné poistné *">
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm font-mono cursor-default" data-testid="udaje-premium">
                              {premiumAmount}
                            </div>
                          </CompactField>
                          <CompactField label={`Ročné poistné${isFieldRequired("annualPremium") ? " *" : ""}`}>
                            <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm font-mono cursor-default" data-testid="udaje-annual">
                              {annualPremium}
                            </div>
                          </CompactField>
                          {(existingContract as any)?.accessRole !== 'klient' && (
                            <CompactField label="Suma provízií">
                              <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm font-mono cursor-default" data-testid="udaje-commission">
                                {commissionAmount ? `${commissionAmount} ${currency}` : ""}
                              </div>
                            </CompactField>
                          )}
                        </div>

                        {existingContract?.isStamped && (
                          <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                            <CompactField label="Opečiatkované">
                              <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-stamped">
                                {existingContract?.stampedAt ? formatDateTimeSlovak(existingContract.stampedAt) : ""}
                              </div>
                            </CompactField>
                          </div>
                        )}

                        <CompactField label="Produkt">
                          <div className="flex items-center h-9 px-3 border rounded-md bg-muted/50 text-sm cursor-default" data-testid="udaje-product">
                            {(() => { const sp = allSPForEdit?.find(p => p.id === (sectorProductId ? parseInt(sectorProductId) : -1)); return sp ? `${sp.name}${sp.abbreviation ? ` (${sp.abbreviation})` : ''}` : ""; })()}
                          </div>
                        </CompactField>

                      </div>
                      {existingContract?.updatedAt && (() => {
                        const days = Math.floor((Date.now() - new Date(existingContract.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                        const sem = days < 30 ? { color: "#22c55e", label: "Čerstvé", desc: `${days} dní` }
                          : days < 60 ? { color: "#f59e0b", label: "Starnúce", desc: `${days} dní` }
                          : days <= 90 ? { color: "#ef4444", label: "Zastarané", desc: `${days} dní` }
                          : { color: "#ef4444", label: "Expirované", desc: `${days} dní`, blink: true };
                        return (
                          <div className="flex items-center gap-2 mt-2 px-1" data-testid="freshness-semaphore-detail">
                            <div className={`w-3 h-3 rounded-full shrink-0${(sem as any).blink ? " animate-pulse" : ""}`} style={{ backgroundColor: sem.color }} />
                            <span className="text-xs font-medium" style={{ color: sem.color }}>{sem.label}</span>
                            <span className="text-xs text-muted-foreground">({sem.desc} od poslednej aktualizácie)</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {lifecycleHistory && lifecycleHistory.length > 0 && (
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md border-emerald-500/30 bg-emerald-500/5 ${lifecycleAccordionOpen ? "ring-1 ring-emerald-500/20" : ""}`}
                  onClick={() => setLifecycleAccordionOpen(prev => !prev)}
                  data-testid="summary-lifecycle-accordion"
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold flex items-center gap-1.5">
                        <ListChecks className="w-4 h-4 text-emerald-500" />
                        Priebeh spracovania zmluvy
                      </h3>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] h-4">{lifecycleHistory.length} {lifecycleHistory.length === 1 ? "fáza" : lifecycleHistory.length < 5 ? "fázy" : "fáz"}</Badge>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${lifecycleAccordionOpen ? "rotate-90" : ""}`} />
                      </div>
                    </div>
                    {lifecycleAccordionOpen && (
                      <div className="mt-3 pt-3 border-t border-emerald-500/20" onClick={e => e.stopPropagation()}>
                        <div className="relative pl-6 space-y-3">
                          <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-emerald-500/30" />
                          {lifecycleHistory.map((entry: any, idx: number) => (
                            <div key={entry.id} className="relative" data-testid={`lifecycle-history-row-${entry.id}`}>
                              <div className="absolute -left-6 top-5 w-[22px] flex items-center justify-center">
                                <div className="w-3 h-3 rounded-full border-2 border-background bg-emerald-500 shrink-0" />
                              </div>
                              <Card className="shadow-sm border-l-[3px] border-l-emerald-500/40 min-h-[48px]">
                                <CardContent className="p-3">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="outline" className="text-xs font-mono h-5 w-5 p-0 flex items-center justify-center shrink-0">{idx + 1}</Badge>
                                    <span className="font-semibold text-sm text-emerald-400" data-testid={`lifecycle-phase-name-${entry.id}`}>{entry.phaseName}</span>
                                    <div className="ml-auto flex items-center gap-2">
                                      {entry.note && <MessageSquare className="w-3 h-3 text-blue-400" />}
                                      <span className="text-xs text-muted-foreground" data-testid={`lifecycle-date-${entry.id}`}>
                                        {entry.changedAt ? formatDateTimeSlovak(entry.changedAt) : "-"}
                                      </span>
                                    </div>
                                  </div>
                                  {entry.note && (
                                    <p className="text-xs text-muted-foreground mt-1.5 bg-muted/40 rounded px-2 py-1" data-testid={`lifecycle-note-${entry.id}`}>{entry.note}</p>
                                  )}
                                  {entry.changerName && entry.changerName !== "System" && (
                                    <p className="text-[10px] text-muted-foreground/70 mt-1">{entry.changerName}</p>
                                  )}
                                </CardContent>
                              </Card>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}


            </div>
          </div>

          <div style={{ display: activeTab === "provizne" && (existingContract as any)?.accessRole !== 'klient' ? 'block' : 'none' }}>
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

      <div className="flex-none z-50 bg-background border-t border-border px-3 py-2 flex items-center gap-2 flex-wrap mt-auto">
        <span style={{ display: activeTab !== "zhrnutie" ? 'inline' : 'none' }}>
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
              Ulozit zmluvu
            </span>
          </Button>
        </span>

        <div className="flex-1" />

        <span style={{ display: (activeTab !== "zhrnutie" && activeTab !== "provizne") ? 'inline' : 'none' }}>
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
        </span>

        <span id="next-step-wrapper" style={{ display: (activeTab !== TABS[TABS.length - 1].key && activeTab !== "zhrnutie") ? 'inline' : 'none' }}>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => {
              if (activeTab === "ziskatelia" && rewardRecommenders.length <= 2 && hasAnyRewardData() && Math.round(getRewardTotalPercentage() * 100) !== 10000) {
                toast({ title: "Upozornenie", description: "Provízia musí byť rozdelená na rovných 100 % medzi získateľov.", variant: "destructive" });
                return;
              }
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

        <span style={{ display: activeTab === "zhrnutie" ? 'inline' : 'none' }}>
          <Button
            size="sm"
            variant="default"
            onClick={handleSubmit}
            disabled={isPending}
            tabIndex={1}
            data-testid="button-save-contract-summary"
          >
            <span style={{ display: isPending ? 'inline' : 'none' }}>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Ukladam...
            </span>
            <span style={{ display: !isPending ? 'inline' : 'none' }}>
              Ulozit zmluvu
            </span>
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

      <Dialog open={justificationModalOpen} onOpenChange={setJustificationModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="w-5 h-5" />
              Zmena kritických údajov
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Zistili sme zmeny v kritických poliach klienta. Tieto zmeny sa líšia od Master Data a vyžadujú odôvodnenie.
            </p>
            <div className="space-y-2 border border-orange-500/20 rounded p-3 bg-orange-500/5">
              {criticalChanges.map((c, i) => (
                <div key={i} className="text-sm">
                  <span className="font-medium text-orange-300">{c.paramName}</span>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Master Data: <span className="font-mono">{c.oldValue}</span> → Zmluva: <span className="font-mono text-orange-300">{c.newValue}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Odôvodnenie zmeny *</label>
              <Textarea
                value={justificationText}
                onChange={e => setJustificationText(e.target.value)}
                placeholder="Uveďte dôvod zmeny kritických údajov..."
                rows={3}
                data-testid="input-justification"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setJustificationModalOpen(false); pendingPayloadRef.current = null; }} data-testid="button-cancel-justification">
                Zrušiť
              </Button>
              <Button
                size="sm"
                className="bg-orange-600 hover:bg-orange-700 text-white"
                disabled={justificationText.trim().length < 5}
                onClick={() => {
                  setJustificationModalOpen(false);
                  if (pendingPayloadRef.current) {
                    executeSubmit(pendingPayloadRef.current, justificationText.trim());
                    pendingPayloadRef.current = null;
                  }
                }}
                data-testid="button-confirm-justification"
              >
                Potvrdiť a uložiť
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getSmartStatusColor(statusColor: string | undefined, expiryDate: string | Date | null | undefined): string {
  if (!statusColor) return "#6b7280";
  if (!expiryDate) return statusColor;
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return statusColor;
  return "#ef4444";
}

function CompactField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function SummaryField({ label, value, testId, mono, onEdit }: { label: string; value: string; testId: string; mono?: boolean; onEdit?: (newValue: string) => void }) {
  const [verified, setVerified] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setEditValue(value); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (onEdit && editValue !== value) onEdit(editValue);
  };

  const handleClick = () => {
    if (editing) return;
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      setVerified(v => !v);
    }, 250);
  };

  const handleDoubleClick = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    if (!onEdit) return;
    setEditing(true);
    setEditValue(value === "-" ? "" : value);
  };

  if (editing) {
    return (
      <div className="h-10 flex items-center gap-2 px-3 rounded-md border-2 border-blue-500 bg-white dark:bg-slate-900 shadow-sm" data-testid={testId}>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{label}:</span>
        <input
          ref={inputRef}
          className={`flex-1 bg-transparent outline-none text-sm font-medium ${mono ? "font-mono" : ""}`}
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") { setEditing(false); setEditValue(value); } }}
          onBlur={commitEdit}
          data-testid={`${testId}-input`}
        />
      </div>
    );
  }

  return (
    <div
      className={`h-10 flex items-center gap-2 px-3 rounded-md border transition-colors duration-150 select-none ${
        verified
          ? "border-blue-400/60 bg-blue-500/10 dark:bg-blue-500/15"
          : "border-border bg-muted/30"
      } ${onEdit ? "cursor-pointer" : ""}`}
      data-testid={testId}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}:</span>
      <span className={`text-sm font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</span>
      {verified && <Check className="w-3 h-3 text-blue-500 flex-none" />}
    </div>
  );
}

