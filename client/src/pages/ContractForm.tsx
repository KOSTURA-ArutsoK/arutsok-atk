import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateTimeSlovak, formatDateSlovak } from "@/lib/utils";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import type { Contract, ContractStatus, ContractStatusChangeLog, ContractTemplate, ContractInventory, Subject, Partner, Product, MyCompany, Sector, Section, SectorProduct, ContractPassword, ContractParameterValue, ContractFieldSetting, ClientType, ContractAcquirer, AppUser, ContractRewardDistribution } from "@shared/schema";
import { getFieldsForClientTypeId, type StaticField } from "@/lib/staticFieldDefs";
import { ArrowLeft, Save, Loader2, LayoutGrid, KeyRound, Plus, Trash2, FileText, Users, ClipboardList, FolderOpen, FolderClosed, DollarSign, BarChart3, ListChecks, PieChart, ChevronLeft, ChevronRight, MessageSquare, Paperclip, Upload, X, Eye, Settings2, Calendar, UserCheck, Check, Link2, CreditCard, Flag } from "lucide-react";
import { getSectionsForClientTypeId } from "@/lib/staticFieldDefs";
import type { DocumentEntry } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  { key: "udaje-klient", label: "Udaje o klientovi", icon: Users },
  { key: "udaje-zmluva", label: "Udaje o zmluve", icon: ClipboardList },
  { key: "dokumenty", label: "Dokumenty", icon: FolderOpen },
  { key: "ziskatelia", label: "Ziskatelia", icon: UserCheck },
  { key: "stavy", label: "Stavy zmluv", icon: BarChart3 },
  { key: "zhrnutie", label: "Zhrnutie", icon: ListChecks },
  { key: "odmeny", label: "Odmeny", icon: DollarSign },
  { key: "provizne", label: "Provizne zostavy", icon: PieChart },
] as const;

type TabKey = typeof TABS[number]["key"];

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
  contractSectorId: string;
  contractSectionId: string;
  sectorProductId: string;
  statusChangeLogs: ContractStatusChangeLog[] | undefined;
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
    contractId, contractSectorId, contractSectionId, sectorProductId,
    statusChangeLogs,
  } = props;

  const statusHistoryColumnVisibility = useColumnVisibility("contract-form-status-history", STATUS_HISTORY_COLUMNS);

  const enrichedLogs = (statusChangeLogs || []).map(log => {
    const logStatus = statuses?.find(s => s.id === log.newStatusId);
    return { ...log, status: logStatus?.name || `Stav #${log.newStatusId}` };
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
            <span className="text-sm text-muted-foreground">Aktualny stav:</span>
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
            <span className="text-sm text-muted-foreground">Aktualny stav:</span>
            <span className="text-sm font-semibold" data-testid="text-current-status">Nahratá do systému</span>
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
                    const statusName = logStatus?.name || `Stav #${log.newStatusId}`;
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
                              <Flag className="w-3.5 h-3.5 text-destructive shrink-0" title="Tento stav ukoncil zmluvu" data-testid={`icon-defines-end-${log.id}`} />
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

  const { data: clientTypes } = useQuery<ClientType[]>({
    queryKey: ["/api/client-types"],
  });

  const selectedSubject = subjects?.find(s => s.id === (subjectId ? parseInt(subjectId) : -1));
  const subjectTypeToClientCode: Record<string, string> = { person: "FO", company: "PO", szco: "SZCO" };
  const matchedClientTypeCode = selectedSubject?.type ? subjectTypeToClientCode[selectedSubject.type] || null : null;
  const matchedClientType = matchedClientTypeCode ? clientTypes?.find(ct => ct.code === matchedClientTypeCode) : null;

  const clientTypeFields = matchedClientType?.id ? getFieldsForClientTypeId(matchedClientType.id) : [];

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

  function handleSubmit() {
    const rewardTotal = getRewardTotalPercentage();
    if (rewardTotal > 100) {
      toast({ title: "Chyba", description: `Celkovy sucet odmien je ${rewardTotal}%, nesmie presiahnuť 100 %`, variant: "destructive" });
      return;
    }
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const payload = {
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
            {appUser.uid ? `${appUser.uid} - ` : ""}{[appUser.firstName, appUser.lastName].filter(Boolean).join(" ") || appUser.username}
          </span>
        )}
        <div data-testid="badge-uid-container">
          <span style={{ display: existingContract?.uid ? 'inline' : 'none' }}>
            <Badge variant="outline" data-testid="badge-contract-uid">{existingContract?.uid}</Badge>
          </span>
        </div>
      </div>

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
                    value={inventoryId ? (inventories?.find(i => i.id.toString() === inventoryId)?.name || "") : ""}
                    readOnly
                    className="bg-muted/50 cursor-default"
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
                      {statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1)) ? (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.color }} />
                          <span className="text-sm">{statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">Bez stavu</span>
                      )}
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

              <div className="grid grid-cols-3 gap-[clamp(0.5rem,1vw,1rem)]">
                <CompactField label="Datum podpisu *">
                  <Input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)} data-testid="input-signed-date" />
                </CompactField>
                <CompactField label="Ucinnost od *">
                  <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} data-testid="input-effective-date" />
                </CompactField>
                <CompactField label="Koniec zmluvy">
                  <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} data-testid="input-expiry-date" />
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
                        <SelectItem key={s.id} value={s.id.toString()} data-testid={`select-item-subject-${s.id}`}>
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
                <SubjectIslandView subject={subjects?.find(s => s.id === (subjectId ? parseInt(subjectId) : -1)) || null} allSubjects={subjects || []} mode="contract" />
              </div>

              <div style={{ display: subjectId && matchedClientType && clientTypeFields && clientTypeFields.length > 0 ? 'block' : 'none' }}>
                <Card className="mt-3">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold" data-testid="text-client-type-rules-title">
                        Dynamicke polia ({matchedClientType?.name || ""})
                      </h3>
                      <Badge variant="outline" className="text-xs" data-testid="badge-client-type">{matchedClientType?.code}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(clientTypeFields || []).map(field => (
                        <div key={field.id} className="space-y-0.5 flex-1 min-w-[calc(50%-0.25rem)]" data-testid={`client-type-field-${field.id}`}>
                          <label className="text-xs font-medium">
                            {field.label}
                            <span style={{ display: field.isRequired ? 'inline' : 'none' }}><span className="text-destructive ml-1">*</span></span>
                          </label>
                          <div style={{ display: field.fieldType === "textarea" ? 'block' : 'none' }}>
                            <Textarea
                              value={clientTypeFieldValues[field.fieldKey] || field.defaultValue || ""}
                              onChange={e => setClientTypeFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
                              rows={2}
                              data-testid={`input-ct-field-${field.fieldKey}`}
                            />
                          </div>
                          <div style={{ display: field.fieldType === "boolean" ? 'block' : 'none' }}>
                            <Select
                              value={clientTypeFieldValues[field.fieldKey] || field.defaultValue || ""}
                              onValueChange={val => setClientTypeFieldValues(prev => ({ ...prev, [field.fieldKey]: val }))}
                            >
                              <SelectTrigger data-testid={`select-ct-field-${field.fieldKey}`}>
                                <SelectValue placeholder="Vyberte" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ano">Ano</SelectItem>
                                <SelectItem value="nie">Nie</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div style={{ display: (field.fieldType === "combobox" || field.fieldType === "jedna_moznost") && (field.options as string[] || []).length > 0 ? 'block' : 'none' }}>
                            <Select
                              value={clientTypeFieldValues[field.fieldKey] || field.defaultValue || ""}
                              onValueChange={val => setClientTypeFieldValues(prev => ({ ...prev, [field.fieldKey]: val }))}
                            >
                              <SelectTrigger data-testid={`select-ct-field-${field.fieldKey}`}>
                                <SelectValue placeholder="Vyberte" />
                              </SelectTrigger>
                              <SelectContent>
                                {((field.options as string[]) || []).map(opt => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div style={{ display: field.fieldType === "decimal" ? 'block' : 'none' }}>
                            <DecimalInput
                              value={clientTypeFieldValues[field.fieldKey] || field.defaultValue || ""}
                              onChange={val => setClientTypeFieldValues(prev => ({ ...prev, [field.fieldKey]: val }))}
                              unit={(field as any).unit}
                              decimalPlaces={(field as any).decimalPlaces}
                              testId={`input-ct-field-${field.fieldKey}`}
                            />
                          </div>
                          <div style={{ display: field.fieldType !== "textarea" && field.fieldType !== "boolean" && field.fieldType !== "decimal" && !((field.fieldType === "combobox" || field.fieldType === "jedna_moznost") && (field.options as string[] || []).length > 0) ? 'block' : 'none' }}>
                            <Input
                              type={field.fieldType === "number" || field.fieldType === "currency" || field.fieldType === "percent" ? "number" : field.fieldType === "date" ? "date" : field.fieldType === "email" ? "email" : "text"}
                              value={clientTypeFieldValues[field.fieldKey] || field.defaultValue || ""}
                              onChange={e => setClientTypeFieldValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
                              data-testid={`input-ct-field-${field.fieldKey}`}
                            />
                          </div>
                        </div>
                      ))}
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
                      <div className="flex flex-wrap gap-2">
                        {panel.parameters.map(param => (
                          <div key={param.id} className="space-y-0.5 flex-1 min-w-[calc(50%-0.25rem)]">
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

          <div style={{ display: activeTab === "ziskatelia" && (existingContract as any)?.accessRole !== 'klient' ? 'block' : 'none' }}>
            <div className="space-y-3" data-testid="section-ziskatelia">
              <h2 className="text-base font-semibold">Ziskatelia</h2>
              {isEditing ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Rozdelenie odmien</h3>
                    <div className={`rounded-md p-2 mb-3 ${Math.round(getRewardTotalPercentage() * 100) === 10000 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                      <p className={`text-sm font-medium ${Math.round(getRewardTotalPercentage() * 100) === 10000 ? 'text-emerald-600' : 'text-destructive'}`} data-testid="text-reward-status-zisk">
                        {Math.round(getRewardTotalPercentage() * 100) === 10000
                          ? `Celkový súčet odmien je 100,00 % - Uloženie je povolené.`
                          : `Celkový súčet odmien nie je 100,00 % (${formatSkPercent(getRewardTotalPercentage())} %) - Uloženie je zablokované.`
                        }
                      </p>
                    </div>
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
                  <h3 className="text-sm font-semibold mb-2">Zmluva</h3>
                  <div className="flex flex-wrap gap-2">
                    <SummaryField label="Cislo zmluvy" value={contractNumber || "-"} testId="summary-contract-number" />
                    <SummaryField label="Cislo navrhu" value={proposalNumber || "-"} testId="summary-proposal" />
                    <SummaryField label="Cislo kontraktu" value={existingContract?.globalNumber?.toString() || "Pridelene pri ulozeni"} testId="summary-global-number" />
                    <SummaryField label="Typ zmluvy" value={contractType || "-"} testId="summary-type" />
                    <SummaryField label="Miesto podpisu" value={signingPlace || "-"} testId="summary-signing-place" />
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
                    {(existingContract as any)?.accessRole !== 'klient' && <SummaryField label="Suma provizie" value={commissionAmount ? `${commissionAmount} ${currency}` : "-"} testId="summary-commission" mono />}
                    <SummaryField label="Datum podpisu" value={signedDate || "-"} testId="summary-signed" />
                    <SummaryField label="Ucinnost od" value={effectiveDate || "-"} testId="summary-effective" />
                    <SummaryField label="Koniec zmluvy" value={expiryDate || "-"} testId="summary-expiry" />
                    <SummaryField label="Spolocnost" value={currentCompany?.name || "-"} testId="summary-company" />
                    <SummaryField label="Stat" value={allStates?.find(s => s.id === (stateId ? parseInt(stateId) : -1))?.name || "-"} testId="summary-state" />
                  </div>
                </CardContent>
              </Card>

              <div style={{ display: subjectId && subjects?.find(s => s.id === parseInt(subjectId)) ? 'block' : 'none' }}>
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <h3 className="text-sm font-semibold mb-2">Klient</h3>
                    <SubjectIslandView subject={subjects?.find(s => s.id === (subjectId ? parseInt(subjectId) : -1)) || null} allSubjects={subjects || []} mode="summary" />
                  </CardContent>
                </Card>
              </div>
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
              if (activeTab === "ziskatelia" && hasAnyRewardData() && Math.round(getRewardTotalPercentage() * 100) !== 10000) {
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
    <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30" data-testid={testId}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}:</span>
      <span className={`text-sm font-medium truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function IslandField({ label, value, testId, mono }: { label: string; value: string; testId?: string; mono?: boolean }) {
  return (
    <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30" data-testid={testId}>
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}:</span>
      <span className={`text-sm font-medium truncate ${mono ? "font-mono" : ""}`}>{value || "-"}</span>
    </div>
  );
}

function SubjectIslandView({ subject, allSubjects, mode }: { subject: any | null; allSubjects: any[]; mode: "contract" | "summary" }) {
  if (!subject) return null;

  const isPerson = subject.type === 'person';
  const isSzco = subject.type === 'szco';
  const isPo = subject.type === 'company';

  const details = (subject.details || {}) as Record<string, any>;
  const dynamicFields = details.dynamicFields || details;

  function getVal(key: string): string {
    if (dynamicFields[key] !== undefined) return String(dynamicFields[key] || "");
    if (details[key] !== undefined) return String(details[key] || "");
    return "";
  }

  const clientTypeId = isSzco ? 3 : isPerson ? 1 : 4;
  const typeFields = getFieldsForClientTypeId(clientTypeId);
  const typeSections = getSectionsForClientTypeId(clientTypeId);

  const docs: DocumentEntry[] = dynamicFields.documents || [];

  const linkedFo = isSzco && subject.linkedFoId
    ? allSubjects.find((s: any) => s.id === subject.linkedFoId)
    : null;

  return (
    <div className="space-y-3">
      <Card>
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold">{mode === "summary" ? "Klient" : "Detail klienta"}</h3>
            <Badge variant="outline" className="text-xs">{isPerson ? "FO" : isSzco ? "SZCO" : "PO"}</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <IslandField label="UID" value={subject.uid || "-"} testId="island-uid" mono />
            {(isPerson || isSzco) && (
              <>
                <IslandField label="Meno" value={subject.firstName || "-"} testId="island-meno" />
                <IslandField label="Priezvisko" value={subject.lastName || "-"} testId="island-priezvisko" />
              </>
            )}
            {isPo && <IslandField label="Nazov" value={subject.companyName || "-"} testId="island-company" />}
            <span style={{ display: subject.email ? 'inline-flex' : 'none' }}>
              <IslandField label="Email" value={subject.email || ""} testId="island-email" />
            </span>
            <span style={{ display: subject.phone ? 'inline-flex' : 'none' }}>
              <IslandField label="Telefon" value={subject.phone || ""} testId="island-phone" />
            </span>
          </div>
        </CardContent>
      </Card>

      {typeSections.length > 0 && typeFields.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-3">
            {typeSections
              .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
              .map(section => {
                const sectionFields = typeFields
                  .filter(f => (f.sectionId || 0) === section.id)
                  .filter(f => f.fieldKey !== "telefon" && f.fieldKey !== "email")
                  .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                const filledFields = sectionFields.filter(f => getVal(f.fieldKey));
                if (filledFields.length === 0) return null;
                return (
                  <div key={section.id} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{section.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {filledFields.map(field => (
                        <IslandField
                          key={field.id}
                          label={field.shortLabel || field.label}
                          value={field.fieldType === "date" ? formatDateSlovak(getVal(field.fieldKey)) : getVal(field.fieldKey)}
                          testId={`island-${field.fieldKey}`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {docs.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold">Doklady totožnosti</p>
              <Badge variant="secondary" className="text-[10px]">{docs.length}</Badge>
            </div>
            {docs.map((doc: DocumentEntry, idx: number) => (
              <div key={doc.id || idx} className="flex flex-wrap gap-2" data-testid={`island-doc-${idx}`}>
                <IslandField label="Typ" value={doc.documentType || "-"} />
                {doc.documentType === "Iný" && doc.customDocType && <IslandField label="Špecifikácia" value={doc.customDocType} />}
                <IslandField label="Číslo" value={doc.documentNumber || "-"} mono />
                {doc.validUntil && <IslandField label="Platnosť do" value={formatDateSlovak(doc.validUntil)} />}
                {doc.issuedBy && <IslandField label="Vydal" value={doc.issuedBy} />}
                {doc.issuingAuthorityCode && <IslandField label="Kód orgánu" value={doc.issuingAuthorityCode} />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isSzco && linkedFo && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-400" />
              <p className="text-sm font-semibold">Prepojená FO (Majiteľ)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <IslandField label="UID" value={linkedFo.uid || "-"} testId="island-linked-fo-uid" mono />
              <IslandField label="Meno" value={linkedFo.firstName || "-"} testId="island-linked-fo-meno" />
              <IslandField label="Priezvisko" value={linkedFo.lastName || "-"} testId="island-linked-fo-priezvisko" />
              <span style={{ display: linkedFo.email ? 'inline-flex' : 'none' }}>
                <IslandField label="Email" value={linkedFo.email || ""} testId="island-linked-fo-email" />
              </span>
              <span style={{ display: linkedFo.phone ? 'inline-flex' : 'none' }}>
                <IslandField label="Telefon" value={linkedFo.phone || ""} testId="island-linked-fo-phone" />
              </span>
              {(() => {
                const foDetails = (linkedFo.details || {}) as Record<string, any>;
                const foDyn = foDetails.dynamicFields || foDetails;
                const foFields = getFieldsForClientTypeId(1);
                const filledFoFields = foFields
                  .filter(f => f.fieldKey !== "telefon" && f.fieldKey !== "email")
                  .filter(f => {
                    const v = foDyn[f.fieldKey] !== undefined ? String(foDyn[f.fieldKey] || "") : (foDetails[f.fieldKey] !== undefined ? String(foDetails[f.fieldKey] || "") : "");
                    return !!v;
                  })
                  .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                return filledFoFields.map(field => {
                  const v = foDyn[field.fieldKey] !== undefined ? String(foDyn[field.fieldKey] || "") : String(foDetails[field.fieldKey] || "");
                  return (
                    <IslandField
                      key={field.id}
                      label={field.shortLabel || field.label}
                      value={field.fieldType === "date" ? formatDateSlovak(v) : v}
                      testId={`island-linked-fo-${field.fieldKey}`}
                    />
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
