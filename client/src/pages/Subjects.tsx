import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSubjects, useCreateSubject, useSubjectCareerHistory } from "@/hooks/use-subjects";
import { useStates } from "@/hooks/use-hierarchy";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAppUser } from "@/hooks/use-app-user";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateSlovak, formatDateTimeSlovak, formatPhone, formatUid, canCreateSubjects, canEditRecords, normalizePhone, smartPadUid } from "@/lib/utils";
import { validateSlovakRC } from "@shared/rc-validator";
import { validateSlovakICO } from "@shared/ico-validator";
import { getDocumentValidityStatus, isValidityField, isNumberFieldWithExpiredPair, type ValidityResult } from "@/lib/document-validity";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, User, Building2, AlertTriangle, Eye, Calendar, Briefcase, ArrowRight, ArrowLeft, ExternalLink, History, Clock, Wallet, Loader2, CheckCircle2, Pencil, Lock, Users, X, Info, Link2, Unlink, Trash2, CreditCard, Archive, Ban, Boxes, Car, Home, Landmark, ChevronRight, ChevronDown, FolderOpen, Tag, Hash, Package, FileText as FileTextIcon, SquareIcon, TrendingDown, Shield, Save, Database, RefreshCw } from "lucide-react";
import { SubjectPhotoThumbnail } from "@/components/subject-profile-photo";
import { SubjectTagBadges, CgnIndicator } from "@/components/subject-profile-module-c";
import { ActivityTimeline } from "@/components/activity-timeline";
import { FieldHistoryIndicator } from "@/components/field-history-indicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogScrollContent,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSubjectSchema } from "@shared/schema";
import type { Subject, ClientType, AuditLog, DocumentEntry, ContactEntry } from "@shared/schema";
import { getFieldsForClientTypeId, getSectionsForClientTypeId, getPanelsForClientTypeId, getFieldsForType, getSectionsForType, getPanelsForType, type StaticField, type StaticSection, type StaticPanel } from "@/lib/staticFieldDefs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { InternationalPhoneInput } from "@/components/ui/international-phone-input";
import { PhoneInput } from "@/components/phone-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { HelpCircle, FileText, ShieldCheck, ListPlus, FileQuestion, ShieldAlert } from "lucide-react";
import { HelpIcon } from "@/components/help-icon";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { PRIORITY_COUNTRY_NAMES, ALL_COUNTRY_NAMES, DEFAULT_COUNTRY, getDefaultCountryForState } from "@/lib/countries";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SubjectProfileModuleC } from "@/components/subject-profile-module-c";
import { z } from "zod";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

const createSchema = insertSubjectSchema.extend({
  stateId: z.coerce.number().min(1, "Povinne"),
  myCompanyId: z.coerce.number().min(1, "Povinne"),
});

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Vytvorenie",
  UPDATE: "Uprava",
  DELETE: "Vymazanie",
  ARCHIVE: "Archivacia",
  RESTORE: "Obnovenie",
  CLICK: "Kliknutie",
};

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  ARCHIVE: "outline",
  RESTORE: "default",
  CLICK: "outline",
};

function SubjectHistoryTab({ subjectId }: { subjectId: number }) {
  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/audit-logs", "entity", subjectId],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?entityId=${subjectId}&module=subjekty&limit=50`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const formatDate = formatDateTimeSlovak;

  function formatProcessingTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  const logs = data?.logs || [];

  if (isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-4">Nacitavam historiu...</p>;
  }

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-entity-history">Ziadne zaznamy pre tento subjekt</p>;
  }

  return (
    <div className="space-y-2">
      {logs.map(log => (
        <div key={log.id} className="flex items-start gap-3 py-2 px-3 rounded-md border border-border" data-testid={`entity-log-${log.id}`}>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={ACTION_VARIANTS[log.action] || "outline"} className="text-[10px]">
                {ACTION_LABELS[log.action] || log.action}
              </Badge>
              <span className="text-xs text-muted-foreground">{log.username || "-"}</span>
              <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                T_idle: {formatProcessingTime(log.processingTimeSec ?? 0)}
              </span>
              <span className="font-mono" style={{ display: log.ipAddress ? 'inline' : 'none' }}>{log.ipAddress}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const STATIC_FIELD_LABELS: Record<string, string> = {
  firstName: "Meno",
  lastName: "Priezvisko",
  companyName: "Názov firmy",
  email: "Email",
  phone: "Telefón",
  birthNumber: "Rodné číslo",
  idCardNumber: "Číslo OP",
  iban: "IBAN",
  swift: "SWIFT",
  kikId: "KIK ID",
  commissionLevel: "Úroveň provízií",
  listStatus: "Status zoznamu",
  cgnRating: "CGN Rating",
  isActive: "Aktívny",
  isDeceased: "Zosnulý",
  type: "Typ subjektu",
  linkedFoId: "Prepojená FO",
  addr_trvaly_ulica: "Trvalý pobyt – Ulica",
  addr_trvaly_supisneCislo: "Trvalý pobyt – Súpisné č.",
  addr_trvaly_orientacneCislo: "Trvalý pobyt – Orientačné č.",
  addr_trvaly_obecMesto: "Trvalý pobyt – Obec/Mesto",
  addr_trvaly_psc: "Trvalý pobyt – PSČ",
  addr_trvaly_stat: "Trvalý pobyt – Štát",
  addr_prechodny_ulica: "Prechodný pobyt – Ulica",
  addr_prechodny_supisneCislo: "Prechodný pobyt – Súpisné č.",
  addr_prechodny_orientacneCislo: "Prechodný pobyt – Orientačné č.",
  addr_prechodny_obecMesto: "Prechodný pobyt – Obec/Mesto",
  addr_prechodny_psc: "Prechodný pobyt – PSČ",
  addr_prechodny_stat: "Prechodný pobyt – Štát",
  addr_korespondencna_ulica: "Korešpondenčná – Ulica",
  addr_korespondencna_supisneCislo: "Korešpondenčná – Súpisné č.",
  addr_korespondencna_orientacneCislo: "Korešpondenčná – Orientačné č.",
  addr_korespondencna_obecMesto: "Korešpondenčná – Obec/Mesto",
  addr_korespondencna_psc: "Korešpondenčná – PSČ",
  addr_korespondencna_stat: "Korešpondenčná – Štát",
  addr_hlavna: "Hlavná adresa",
  ekon_pracovny_pomer: "Pracovný pomer",
  ekon_zamestnavatel: "Zamestnávateľ / Názov firmy",
  ekon_pozicia: "Pracovná pozícia",
  ekon_datum_nastupu: "Dátum nástupu",
  ekon_cisty_prijem: "Čistý mesačný príjem",
  ekon_zdroj_prijmu: "Zdroj príjmu",
  ekon_hlavny_iban: "Hlavný IBAN",
  ekon_banka: "Banka",
  ekon_peo: "PEO (Politicky exponovaná osoba)",
  ekon_peo_zdovodnenie: "PEO – Zdôvodnenie",
  ekon_kuv: "Konečný užívateľ výhod",
  voz_ecv: "EČV (Evidenčné číslo vozidla)",
  voz_vin: "VIN",
  voz_cislo_tp: "Číslo technického preukazu",
  voz_znacka: "Značka vozidla",
  voz_model: "Model vozidla",
  voz_vykon: "Výkon motora",
  voz_objem: "Objem motora",
  voz_hmotnost: "Celková hmotnosť",
  voz_palivo: "Druh paliva",
  voz_stk_platnost: "Platnosť STK do",
  voz_ek_platnost: "Platnosť emisnej kontroly do",
  voz_tachometer: "Stav tachometra",
  voz_zabezpecenie: "Zabezpečenie vozidla",
  real_typ_nehnutelnosti: "Typ nehnuteľnosti",
  real_supisne_cislo: "Súpisné číslo",
  real_parcelne_cislo: "Parcelné číslo",
  real_katastralne_uzemie: "Katastrálne územie",
  real_cislo_lv: "Číslo listu vlastníctva",
  real_rok_kolaudacie: "Rok kolaudácie",
  real_rekon_strecha: "Rekonštrukcia – strecha",
  real_rekon_rozvody: "Rekonštrukcia – rozvody",
  real_rekon_kurenie: "Rekonštrukcia – kúrenie",
  real_rozloha: "Rozloha obytnej plochy",
  real_pocet_podlazi: "Počet podlaží",
  real_typ_konstrukcie: "Typ konštrukcie",
  real_typ_dveri: "Typ dverí (bezp. trieda)",
  real_elektro_zabezpecenie: "Elektronické zabezpečenie",
  real_protipoz_ochrana: "Protipožiarna ochrana",
};

function getFieldLabel(fieldKey: string, allFields?: StaticField[]): string {
  if (STATIC_FIELD_LABELS[fieldKey]) return STATIC_FIELD_LABELS[fieldKey];
  if (allFields) {
    const found = allFields.find(f => f.fieldKey === fieldKey);
    if (found) return found.shortLabel || found.label;
  }
  return fieldKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const BOOLEAN_FIELD_KEYS = new Set(["isActive", "isDeceased", "isStamped", "cgnActive", "pepStatus", "isResident"]);

function formatHistoryValue(fieldKey: string, value: string | null | undefined): string {
  if (value == null || value === '') return '(prázdne)';
  if (BOOLEAN_FIELD_KEYS.has(fieldKey)) {
    if (value === "true") return "Áno";
    if (value === "false") return "Nie";
  }
  return value;
}

function SubjectFieldHistoryPanel({ subjectId, clientTypeId }: { subjectId: number; clientTypeId?: number }) {
  const [selectedField, setSelectedField] = useState<string>("__all__");
  const { toast } = useToast();

  const allFields = useMemo(() => {
    if (clientTypeId) return getFieldsForClientTypeId(clientTypeId);
    return getFieldsForClientTypeId(1);
  }, [clientTypeId]);

  const { data: historyKeys = [], isLoading: keysLoading } = useQuery<string[]>({
    queryKey: ["/api/subjects", subjectId, "field-history", "keys"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subjectId}/field-history/keys`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const fieldKeyParam = selectedField === "__all__" ? undefined : selectedField;
  const { data: history = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/subjects", subjectId, "field-history", fieldKeyParam || "all"],
    queryFn: async () => {
      const url = fieldKeyParam
        ? `/api/subjects/${subjectId}/field-history?fieldKey=${encodeURIComponent(fieldKeyParam)}`
        : `/api/subjects/${subjectId}/field-history`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async (historyEntryId: number) => {
      const res = await apiRequest("POST", `/api/subjects/${subjectId}/field-history/restore`, { historyEntryId });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.skipped) {
        toast({ title: "Hodnota je už aktuálna", description: "Pole už obsahuje túto hodnotu, obnova nie je potrebná" });
      } else {
        toast({ title: "Hodnota obnovená", description: `Pole '${getFieldLabel(data.fieldKey, allFields)}' bolo obnovené` });
        queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "field-history"] });
        queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      }
    },
    onError: () => {
      toast({ title: "Chyba pri obnove hodnoty", variant: "destructive" });
    },
  });

  const [confirmRestoreId, setConfirmRestoreId] = useState<number | null>(null);

  return (
    <div className="space-y-3" data-testid="field-history-panel">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">História zmien polí</span>
          <Badge variant="secondary" className="text-[10px]">{history.length}</Badge>
        </div>
        <Select value={selectedField} onValueChange={setSelectedField}>
          <SelectTrigger className="w-[240px] h-8 text-xs" data-testid="select-field-filter">
            <SelectValue placeholder="Filter podľa poľa" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" data-testid="filter-option-all">Celá história</SelectItem>
            {historyKeys.map(key => (
              <SelectItem key={key} value={key} data-testid={`filter-option-${key}`}>
                {getFieldLabel(key, allFields)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedField !== "__all__" && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedField("__all__")} data-testid="button-clear-filter">
            <X className="w-3 h-3 mr-1" /> Zrušiť filter
          </Button>
        )}
      </div>

      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 px-1">
        <Lock className="w-3 h-3" />
        <span>Append-only: Záznamy sú nemenné a nevymazateľné</span>
      </div>

      {(isLoading || keysLoading) ? (
        <div className="flex items-center gap-2 justify-center py-6">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs text-muted-foreground">Načítavam históriu...</span>
        </div>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-field-history">
          {selectedField === "__all__" ? "Žiadna história zmien" : `Žiadne zmeny pre pole '${getFieldLabel(selectedField, allFields)}'`}
        </p>
      ) : (
        <div className="space-y-1.5">
          {history.map((entry: any) => {
            const isRestoreEntry = entry.isRestore;
            const changedDate = entry.changedAt ? formatDateTimeSlovak(entry.changedAt) : '-';
            const label = getFieldLabel(entry.fieldKey, allFields);

            return (
              <div
                key={entry.id}
                className={cn(
                  "p-2.5 rounded-md border text-xs space-y-1.5",
                  isRestoreEntry
                    ? "border-blue-500/40 bg-blue-500/5"
                    : "border-border bg-muted/20"
                )}
                data-testid={`field-history-entry-${entry.id}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={isRestoreEntry ? "default" : "secondary"}
                    className={cn("text-[10px]", isRestoreEntry && "bg-blue-600")}
                  >
                    {isRestoreEntry ? "Obnova" : "Zmena"}
                  </Badge>
                  <span className="font-semibold text-foreground">{label}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{changedDate}</span>
                  {entry.changeContext && (
                    <Badge variant="outline" className="text-[10px] border-cyan-500/40 text-cyan-600" data-testid={`badge-context-${entry.id}`}>
                      {entry.changeContext}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <User className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">
                    {entry.changedByName || 'Systém'}
                  </span>
                </div>

                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-muted-foreground shrink-0">Pred:</span>
                    <span className={cn("font-mono break-all", entry.oldValue ? "text-red-400 line-through" : "text-muted-foreground italic")}>
                      {formatHistoryValue(entry.fieldKey, entry.oldValue)}
                    </span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-muted-foreground shrink-0">Po:</span>
                    <span className={cn("font-mono break-all", entry.newValue ? "text-emerald-400 font-semibold" : "text-muted-foreground italic")}>
                      {formatHistoryValue(entry.fieldKey, entry.newValue)}
                    </span>
                  </div>
                </div>

                {entry.changeReason && (
                  <div className="flex items-start gap-1.5 text-muted-foreground">
                    <Info className="w-3 h-3 shrink-0 mt-0.5" />
                    <span className="italic">{entry.changeReason}</span>
                  </div>
                )}

                {!isRestoreEntry && entry.newValue && (
                  <div className="flex justify-end pt-1">
                    {confirmRestoreId === entry.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">Naozaj obnoviť?</span>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          disabled={restoreMutation.isPending}
                          onClick={() => {
                            restoreMutation.mutate(entry.id);
                            setConfirmRestoreId(null);
                          }}
                          data-testid={`button-confirm-restore-${entry.id}`}
                        >
                          {restoreMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Áno, obnoviť"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => setConfirmRestoreId(null)}
                          data-testid={`button-cancel-restore-${entry.id}`}
                        >
                          Zrušiť
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 text-[10px] px-2"
                        onClick={() => setConfirmRestoreId(entry.id)}
                        data-testid={`button-restore-${entry.id}`}
                      >
                        <History className="w-3 h-3 mr-1" />
                        Obnoviť túto hodnotu
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubjectFinanceTab({ subject }: { subject: Subject }) {
  const { toast } = useToast();
  const [kikId, setKikId] = useState(subject.kikId || "");
  const [iban, setIban] = useState(subject.iban || "");
  const [swift, setSwift] = useState(subject.swift || "");
  const [commissionLevel, setCommissionLevel] = useState(subject.commissionLevel?.toString() || "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/subjects/${subject.id}/finance`, {
        kikId: kikId || null,
        iban: iban || null,
        swift: swift || null,
        commissionLevel: commissionLevel ? Number(commissionLevel) : null,
      });
    },
    onSuccess: () => {
      toast({ title: "Financne udaje ulozene" });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
    },
    onError: () => {
      toast({ title: "Chyba pri ukladani", variant: "destructive" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[140px]">
          <Label className="text-xs">KIK ID</Label>
          <Input value={kikId} onChange={(e) => setKikId(e.target.value)} placeholder="napr. KIK-001234" data-testid="input-kik-id" className="mt-1" />
        </div>
        <div className="w-[100px] min-w-[80px] shrink-0">
          <Label className="text-xs">Uroven provizii</Label>
          <Input type="number" value={commissionLevel} onChange={(e) => setCommissionLevel(e.target.value)} placeholder="1-10" data-testid="input-commission-level" className="mt-1" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs">IBAN</Label>
          <Input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="SK00 0000 0000 0000 0000 0000" data-testid="input-iban" className="mt-1" />
        </div>
        <div className="w-[160px] min-w-[120px] shrink-0">
          <Label className="text-xs">SWIFT/BIC</Label>
          <Input value={swift} onChange={(e) => setSwift(e.target.value)} placeholder="napr. TATRSKBX" data-testid="input-swift" className="mt-1" />
        </div>
      </div>
      <Separator />
      <div className="flex justify-end">
        <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} data-testid="button-save-finance">
          {updateMutation.isPending ? "Ukladam..." : "Ulozit financne udaje"}
        </Button>
      </div>
    </div>
  );
}

const FOLDER_CATEGORY_LABELS: Record<string, string> = {
  povinne: "POVINNE UDAJE",
  doplnkove: "DOPLNKOVE UDAJE",
  volitelne: "VOLITELNE / DOBROVOLNE UDAJE",
};

const FOLDER_CATEGORY_ICONS: Record<string, any> = {
  povinne: ShieldCheck,
  doplnkove: ListPlus,
  volitelne: Eye,
};

const FOLDER_CATEGORY_ORDER = ["povinne", "doplnkove", "volitelne"];

function SubjectDataTab({ subject }: { subject: Subject }) {
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const { data: companies } = useMyCompanies();
  const managingCompany = companies?.find(c => c.id === subject.myCompanyId);

  const isSystem = subject.type === 'system';
  const isPerson = subject.type === 'person';
  const isSzco = subject.type === 'szco';

  const clientType = clientTypes?.find(ct => {
    if (isSystem) return false;
    if (subject.type === 'szco' && ct.code === 'SZCO') return true;
    if (subject.type === 'company' && ct.code === 'PO') return true;
    if (isPerson && ct.code === 'FO') return true;
    return false;
  });

  const clientTypeId = isSystem ? 4 : isSzco ? 3 : isPerson ? 1 : 4;
  const typeFields = getFieldsForClientTypeId(clientTypeId);
  const foTypeFields = getFieldsForClientTypeId(1);
  const typeSections = getSectionsForClientTypeId(clientTypeId);

  const details = (subject.details || {}) as Record<string, any>;
  const dynamicFields = details.dynamicFields || details;

  function getFieldValue(fieldKey: string): string {
    if (dynamicFields[fieldKey] !== undefined) return String(dynamicFields[fieldKey] || "");
    if ((details as any)[fieldKey] !== undefined) return String((details as any)[fieldKey] || "");
    return "";
  }

  function groupFieldsByCategory() {
    const groups: Record<string, { section: any; fields: StaticField[] }[]> = {
      povinne: [],
      doplnkove: [],
      volitelne: [],
    };

    if (!typeSections || !typeFields) return groups;

    const sectionsSorted = [...typeSections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    for (const section of sectionsSorted) {
      const category = (section as any).folderCategory || "volitelne";
      const sectionFields = typeFields
        .filter(f => (f.sectionId || 0) === section.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      if (sectionFields.length > 0) {
        if (!groups[category]) groups[category] = [];
        groups[category].push({ section, fields: sectionFields });
      }
    }

    const unsectionedFields = typeFields.filter(f => (!f.sectionId || f.sectionId === 0));
    if (unsectionedFields.length > 0) {
      groups.volitelne.push({ section: { id: 0, name: "Ostatne" }, fields: unsectionedFields.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) });
    }

    return groups;
  }

  const fieldGroups = groupFieldsByCategory();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Typ:</span>
          <span className="text-sm font-medium">{isSystem ? 'Systém' : isPerson ? 'FO' : isSzco ? 'SZCO' : 'PO'} - {isSystem ? 'Koreňový subjekt' : clientType?.name || subject.type}</span>
        </div>
        <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Firma:</span>
          <span className="text-sm font-medium">{managingCompany?.name || '-'}</span>
        </div>
        {isPerson || isSzco ? (
          <>
            <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Meno:</span>
              <span className="text-sm font-medium">{subject.firstName || '-'}</span>
            </div>
            <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Priezvisko:</span>
              <span className="text-sm font-medium">{subject.lastName || '-'}</span>
            </div>
          </>
        ) : (
          <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Nazov:</span>
            <span className="text-sm font-medium">{subject.companyName || '-'}</span>
          </div>
        )}
        <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Email:</span>
          <span className="text-sm font-medium">{subject.email || '-'}</span>
        </div>
        <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Telefon:</span>
          <span className="text-sm font-medium">{formatPhone(subject.phone)}</span>
        </div>
      </div>

      {isSzco && (subject as any).linkedFo && (
        <Card data-testid="linked-fo-info">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-400" />
              <p className="text-sm font-semibold">Prepojená FO (Majiteľ)</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
                <span className="text-xs text-muted-foreground whitespace-nowrap">UID:</span>
                <span className="text-sm font-medium font-mono">{formatUid((subject as any).linkedFo.uid)}</span>
              </div>
              <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Meno:</span>
                <span className="text-sm font-medium">{(subject as any).linkedFo.firstName}</span>
              </div>
              <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Priezvisko:</span>
                <span className="text-sm font-medium">{(subject as any).linkedFo.lastName}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Accordion type="multiple" defaultValue={["povinne", "doplnkove"]} className="space-y-2">
        {FOLDER_CATEGORY_ORDER.map(category => {
          const Icon = FOLDER_CATEGORY_ICONS[category];
          const sectionGroups = fieldGroups[category] || [];
          return (
            <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`accordion-${category}`}>
              <AccordionTrigger className="py-3 hover:no-underline">
                <div className="flex items-center gap-2">
                  <Icon className={`w-4 h-4 ${category === 'povinne' ? 'text-destructive' : category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {sectionGroups.reduce((acc, g) => acc + g.fields.length, 0)}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {sectionGroups.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Ziadne polia v tejto sekcii</p>
                ) : (
                  <div className="space-y-4">
                    {sectionGroups.map(({ section, fields }) => (
                      <div key={section.id} className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1" style={{ display: sectionGroups.length > 1 ? 'block' : 'none' }}>{section.name}</p>
                        <div className="flex flex-wrap gap-2">
                          {fields.map(field => {
                            const value = getFieldValue(field.fieldKey);
                            const isValField = isValidityField(field.fieldKey);
                            const validity = isValField && value ? getDocumentValidityStatus(value) : null;
                            const numValidity = isNumberFieldWithExpiredPair(field.fieldKey, (() => {
                              const vals: Record<string, string> = {};
                              fields.forEach(f => { vals[f.fieldKey] = getFieldValue(f.fieldKey); });
                              return vals;
                            })());
                            const isExpNum = numValidity?.status === "expired";
                            const displayValue = field.fieldType === "date" && value ? formatDateSlovak(value) : value;
                            return (
                              <div key={field.id} className={cn(
                                "h-10 flex items-center gap-2 px-3 rounded-md border",
                                isExpNum ? "border-red-500/60 bg-red-500/10" : validity ? `${validity.borderClass} ${validity.bgClass}` : "border-border bg-muted/30"
                              )} data-testid={`field-display-${field.fieldKey}`}>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">{field.shortLabel || field.label}:</span>
                                <span className={cn("text-sm font-medium truncate", validity?.textClass, isExpNum && "text-red-500")}>{displayValue || "-"}</span>
                                {validity && validity.status !== "unknown" && value && (
                                  <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", validity.dotClass)} title={validity.label} data-testid={`validity-dot-${field.fieldKey}`} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {(subject.type === 'person' || subject.type === 'szco') && (() => {
        const docs: DocumentEntry[] = dynamicFields.documents || [];
        if (docs.length === 0) return null;
        return (
          <Card data-testid="panel-view-doklady">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                <p className="text-sm font-semibold">Doklady totožnosti</p>
                <Badge variant="secondary" className="text-[10px]">{docs.length}</Badge>
              </div>
              <div className="space-y-2">
                {docs.map((doc: DocumentEntry, idx: number) => {
                  const docValidity = getDocumentValidityStatus(doc.validUntil);
                  const expired = docValidity.status === "expired";
                  const expSoon = docValidity.status === "expiring";
                  return (
                    <div key={doc.id || idx} data-testid={`view-document-card-${idx}`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {expired && (
                          <Badge variant="destructive" className="text-[10px] flex items-center gap-1">
                            <span className={cn("w-2 h-2 rounded-full", docValidity.dotClass)} />
                            Neplatný
                          </Badge>
                        )}
                        {expSoon && (
                          <Badge className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/30 flex items-center gap-1">
                            <span className={cn("w-2 h-2 rounded-full", docValidity.dotClass)} />
                            {docValidity.label}
                          </Badge>
                        )}
                        {!expired && !expSoon && doc.validUntil && (
                          <Badge variant="secondary" className="text-[10px] flex items-center gap-1">
                            <span className={cn("w-2 h-2 rounded-full", docValidity.dotClass)} />
                            Platný
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Typ:</span>
                          <span className="text-sm font-medium">{doc.documentType || '-'}</span>
                        </div>
                        {doc.documentType === "Iný" && doc.customDocType && (
                          <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Špecifikácia:</span>
                            <span className="text-sm font-medium">{doc.customDocType}</span>
                          </div>
                        )}
                        <div className={cn("h-10 flex items-center gap-2 px-3 rounded-md border", expired ? "border-red-500/60 bg-red-500/10" : "border-border bg-muted/30")}>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Číslo:</span>
                          <span className={cn("text-sm font-medium font-mono", expired && "text-red-500")}>{doc.documentNumber || '-'}</span>
                        </div>
                        {doc.validUntil && (
                          <div className={cn("h-10 flex items-center gap-2 px-3 rounded-md border", docValidity.borderClass, docValidity.bgClass || "bg-muted/30")}>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Platnosť do:</span>
                            <span className={cn("text-sm font-medium", docValidity.textClass)}>{formatDateSlovak(doc.validUntil)}</span>
                            <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", docValidity.dotClass)} />
                          </div>
                        )}
                        {doc.issuedBy && (
                          <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Vydal:</span>
                            <span className="text-sm font-medium">{doc.issuedBy}</span>
                          </div>
                        )}
                        {doc.issuingAuthorityCode && (
                          <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-border bg-muted/30">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">Kód orgánu:</span>
                            <span className="text-sm font-medium">{doc.issuingAuthorityCode}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {(subject.type === 'person' || subject.type === 'szco') && (
        <DocumentHistorySection subjectId={subject.id} />
      )}
    </div>
  );
}

function DocumentHistorySection({ subjectId }: { subjectId: number }) {
  const [showHistory, setShowHistory] = useState(false);
  const { data: history, isLoading } = useQuery<any[]>({
    queryKey: [`/api/subjects/${subjectId}/document-history`],
    enabled: showHistory,
  });

  return (
    <div className="border rounded-md" data-testid="document-history-section">
      <button
        type="button"
        className="flex items-center gap-2 w-full p-3 text-left hover-elevate rounded-md"
        onClick={() => setShowHistory(v => !v)}
        data-testid="button-toggle-document-history"
      >
        <History className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-semibold flex-1">Historia dokladov</span>
        <Badge variant="secondary" className="text-[10px]">{showHistory && history ? history.length : '...'}</Badge>
      </button>

      {showHistory && (
        <div className="px-3 pb-3">
          {isLoading ? (
            <div className="flex items-center gap-2 justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs text-muted-foreground">Nacitavam...</span>
            </div>
          ) : !history || history.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4" data-testid="text-no-document-history">
              Ziadna historia zmien dokladov
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((entry: any, idx: number) => {
                const validUntil = entry.validUntil ? new Date(entry.validUntil) : null;
                const now = new Date();
                let validityStatus = "";
                let validityColor = "";
                if (validUntil) {
                  if (validUntil < now) {
                    validityStatus = "Neplatny";
                    validityColor = "text-red-500";
                  } else {
                    const threeMonths = new Date();
                    threeMonths.setMonth(threeMonths.getMonth() + 3);
                    if (validUntil < threeMonths) {
                      validityStatus = "Konciaci";
                      validityColor = "text-orange-500";
                    }
                  }
                }
                return (
                  <div key={entry.id} className="flex flex-wrap gap-x-4 gap-y-1 p-2 rounded-md bg-muted/30 border border-border text-xs" data-testid={`document-history-entry-${idx}`}>
                    <div>
                      <span className="text-muted-foreground">Typ: </span>
                      <span className="font-medium">{entry.documentType || '-'}</span>
                      {entry.customDocType && (
                        <span className="text-muted-foreground ml-1">({entry.customDocType})</span>
                      )}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cislo: </span>
                      <span className="font-medium">{entry.documentNumber || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Platnost do: </span>
                      <span className={cn("font-medium", validityColor)}>
                        {entry.validUntil ? formatDateSlovak(entry.validUntil) : '-'}
                      </span>
                      {validityStatus && (
                        <span className={cn("ml-1 text-[10px] font-semibold", validityColor)}>({validityStatus})</span>
                      )}
                    </div>
                    {entry.issuedBy && (
                      <div>
                        <span className="text-muted-foreground">Vydal: </span>
                        <span className="font-medium">{entry.issuedBy}</span>
                      </div>
                    )}
                    {entry.issuingAuthorityCode && (
                      <div>
                        <span className="text-muted-foreground">Kod organu: </span>
                        <span className="font-medium">{entry.issuingAuthorityCode}</span>
                      </div>
                    )}
                    <div className="w-full">
                      <span className="text-muted-foreground">Archivovane: </span>
                      <span>{entry.archivedAt ? formatDateTimeSlovak(entry.archivedAt) : '-'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type EnrichedEntityLink = {
  id: number;
  sourceId: number;
  targetId: number;
  dateFrom: string;
  dateTo: string | null;
  createdAt: string;
  source: { id: number; uid: string; type: string; firstName: string | null; lastName: string | null; companyName: string | null; email: string | null } | null;
  target: { id: number; uid: string; type: string; firstName: string | null; lastName: string | null; companyName: string | null; email: string | null } | null;
};

function getSubjectLabel(s: { type: string; firstName: string | null; lastName: string | null; companyName: string | null } | null) {
  if (!s) return "Neznamy subjekt";
  if (s.type === 'system') return s.companyName || 'ArutsoK - ATK';
  if (s.type === 'person' || s.type === 'szco') return `${s.lastName || ''}, ${s.firstName || ''}`.trim().replace(/^,\s*/, '').replace(/,\s*$/, '') || 'Bez mena';
  return s.companyName || 'Bez nazvu';
}

function TreeToggle({ isOpen, onToggle, children, level = 0, icon, label, badge, badgeColor, extra }: {
  isOpen: boolean; onToggle: () => void; children: React.ReactNode;
  level?: number; icon: React.ReactNode; label: string; badge?: string; badgeColor?: string; extra?: React.ReactNode;
}) {
  return (
    <div style={{ paddingLeft: `${level * 16}px` }}>
      <div
        className="flex items-center gap-1.5 py-1.5 px-2 rounded cursor-pointer hover:bg-slate-800/50 transition-colors group"
        onClick={onToggle}
        data-testid={`tree-node-${label.replace(/\s+/g, '-').toLowerCase()}`}
      >
        {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
        {icon}
        <span className="text-sm font-medium truncate">{label}</span>
        {badge && <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ml-1 ${badgeColor || "bg-slate-700 text-slate-300"}`}>{badge}</span>}
        {extra}
      </div>
      {isOpen && <div className="ml-2">{children}</div>}
    </div>
  );
}

function SubjectObjectsTab({ subjectId }: { subjectId: number }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data: hierarchy, isLoading } = useQuery<any>({
    queryKey: ["/api/subjects", subjectId, "object-hierarchy"],
    queryFn: () => fetch(`/api/subjects/${subjectId}/object-hierarchy`).then(r => r.json()),
  });

  const toggle = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const getObjectIcon = (type: string) => {
    switch (type) {
      case "VOZIDLO": return <Car className="w-4 h-4 text-blue-400" />;
      case "NEHNUTEĽNOSŤ": return <Home className="w-4 h-4 text-emerald-400" />;
      case "PARCELA": return <Landmark className="w-4 h-4 text-amber-400" />;
      default: return <Package className="w-4 h-4 text-slate-400" />;
    }
  };

  const getFreshness = (updatedAt: string | null) => {
    if (!updatedAt) return { color: "bg-slate-500", label: "?" };
    const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) return { color: "bg-green-500", label: `${days}d` };
    if (days <= 90) return { color: "bg-yellow-500", label: `${days}d` };
    return { color: "bg-red-500", label: `${days}d` };
  };

  const conflictMap = new Map<string, any[]>();
  if (hierarchy?.conflicts) {
    for (const c of hierarchy.conflicts) {
      conflictMap.set(`${c.objectId}-${c.paramName}`, c.values);
    }
  }

  if (isLoading) {
    return <div className="flex items-center justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  }

  const objects = hierarchy?.objects || [];
  const noObj = hierarchy?.noObjectProducts || [];
  const hasData = objects.length > 0 || noObj.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-12 text-slate-500">
        <Boxes className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Žiadne objekty</p>
        <p className="text-sm mt-1">Objekty sa vytvárajú automaticky zo zmlúv na základe kľúčových parametrov (EČV, VIN, LV číslo...)</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Boxes className="w-4 h-4" /> Majetok a Objekty
        </h3>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Lock className="w-3.5 h-3.5" /> <span>Len na čítanie</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> &lt;30d</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" /> 30-90d</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> &gt;90d</span>
        </div>
      </div>

      {hierarchy?.conflicts?.length > 0 && (
        <div className="border border-orange-500/30 bg-orange-500/5 rounded p-3 mb-3">
          <div className="flex items-center gap-2 text-orange-400 text-sm font-medium mb-1">
            <AlertTriangle className="w-4 h-4" /> Zistené nezhody ({hierarchy.conflicts.length})
          </div>
          <div className="space-y-1">
            {hierarchy.conflicts.map((c: any, i: number) => (
              <div key={i} className="text-xs text-slate-400">
                <span className="font-medium text-orange-300">{c.paramName}</span>: {c.values.map((v: any) => `${v.productName}="${v.value}"`).join(" vs ")}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border border-slate-700 rounded divide-y divide-slate-800">
        {objects.map((obj: any) => {
          const freshness = getFreshness(obj.updatedAt);
          const objKey = `obj-${obj.id}`;
          const keyDisplay = Object.entries((obj.keyValues || {}) as Record<string, string>).map(([k, v]) => `${k}: ${v}`).join(" · ");
          return (
            <TreeToggle
              key={obj.id}
              isOpen={expanded[objKey] ?? false}
              onToggle={() => toggle(objKey)}
              icon={getObjectIcon(obj.objectType)}
              label={obj.objectLabel}
              badge={obj.objectType}
              badgeColor="bg-blue-500/20 text-blue-300"
              extra={
                <div className="flex items-center gap-1.5 ml-auto">
                  <Lock className="w-3 h-3 text-slate-600" />
                  <span className={`w-2 h-2 rounded-full ${freshness.color}`} />
                  <span className="text-[10px] text-slate-500">{freshness.label}</span>
                  <span className="text-[10px] text-slate-600 font-mono">{formatUid(obj.uid)}</span>
                </div>
              }
            >
              {keyDisplay && (
                <div className="text-xs text-slate-500 font-mono px-2 py-1 bg-slate-800/30 rounded mx-2 mb-1">{keyDisplay}</div>
              )}
              {obj.sectors.map((sector: any) => {
                const secKey = `${objKey}-sec-${sector.id}`;
                return (
                  <TreeToggle key={sector.id} isOpen={expanded[secKey] ?? false} onToggle={() => toggle(secKey)}
                    level={1} icon={<FolderOpen className="w-4 h-4 text-purple-400" />} label={sector.name} badge="SEKTOR" badgeColor="bg-purple-500/20 text-purple-300">
                    {sector.sections.map((section: any) => {
                      const odvKey = `${secKey}-odv-${section.id}`;
                      return (
                        <TreeToggle key={section.id} isOpen={expanded[odvKey] ?? false} onToggle={() => toggle(odvKey)}
                          level={2} icon={<FileTextIcon className="w-4 h-4 text-cyan-400" />} label={section.name} badge="ODVETVIE" badgeColor="bg-cyan-500/20 text-cyan-300">
                          {section.products.map((product: any) => {
                            const prodKey = `${odvKey}-prod-${product.id}-${product.contractId}`;
                            return (
                              <TreeToggle key={prodKey} isOpen={expanded[prodKey] ?? false} onToggle={() => toggle(prodKey)}
                                level={3} icon={<Tag className="w-4 h-4 text-amber-400" />} label={product.name}
                                badge="PRODUKT" badgeColor="bg-amber-500/20 text-amber-300"
                                extra={<span className="text-[10px] text-slate-600 ml-auto">Zmluva {product.contractId}</span>}>
                                {product.folders.map((folder: any) => {
                                  const foldKey = `${prodKey}-fold-${folder.id}`;
                                  return (
                                    <TreeToggle key={foldKey} isOpen={expanded[foldKey] ?? false} onToggle={() => toggle(foldKey)}
                                      level={4} icon={<FolderOpen className="w-3.5 h-3.5 text-slate-400" />} label={folder.name}
                                      badge="PRIEČINOK" badgeColor="bg-slate-600 text-slate-300">
                                      {folder.panels.map((panel: any) => {
                                        const panKey = `${foldKey}-pan-${panel.id}`;
                                        return (
                                          <TreeToggle key={panKey} isOpen={expanded[panKey] ?? true} onToggle={() => toggle(panKey)}
                                            level={5} icon={<SquareIcon className="w-3.5 h-3.5 text-slate-500" />} label={panel.name}
                                            badge="PANEL" badgeColor="bg-slate-700 text-slate-400">
                                            <div className="ml-6 space-y-0.5 py-1">
                                              {panel.params.map((param: any) => {
                                                const conflictKey = `${obj.id}-${param.name}`;
                                                const conflicts = conflictMap.get(conflictKey);
                                                const hasConflict = !!conflicts;
                                                return (
                                                  <div key={`${param.id}-${param.contractId}`}
                                                    className={`flex items-center gap-2 py-0.5 px-2 rounded text-sm ${hasConflict ? "bg-orange-500/10 border border-orange-500/20" : ""}`}
                                                    data-testid={`param-${param.id}`}>
                                                    <Hash className="w-3 h-3 text-slate-600 shrink-0" />
                                                    <span className="text-slate-400 text-xs min-w-[120px]">{param.name}</span>
                                                    <span className="font-medium text-sm">{param.value}</span>
                                                    <span className="text-[10px] text-slate-600 ml-auto">zdroj: {param.productName}</span>
                                                    {hasConflict && (
                                                      <span className="text-orange-400 flex items-center gap-0.5" data-testid={`conflict-${param.name}`}>
                                                        <AlertTriangle className="w-3 h-3" />
                                                        <span className="text-[10px]">
                                                          {conflicts!.filter(v => v.value !== param.value).map(v => `${v.productName}: ${v.value}`).join(", ")}
                                                        </span>
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </TreeToggle>
                                        );
                                      })}
                                    </TreeToggle>
                                  );
                                })}
                              </TreeToggle>
                            );
                          })}
                        </TreeToggle>
                      );
                    })}
                  </TreeToggle>
                );
              })}
            </TreeToggle>
          );
        })}

        {noObj.length > 0 && (
          <TreeToggle
            isOpen={expanded["no-obj"] ?? false}
            onToggle={() => toggle("no-obj")}
            icon={<Briefcase className="w-4 h-4 text-slate-500" />}
            label="Ostatné služby (bez objektu)"
            badge={`${noObj.length}`}
            badgeColor="bg-slate-700 text-slate-400"
          >
            {noObj.map((item: any, idx: number) => {
              const noKey = `no-obj-${idx}`;
              return (
                <div key={idx} className="ml-4 py-1">
                  <div className="flex items-center gap-2 text-sm px-2 py-1">
                    <Tag className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-300">{item.sectorName} › {item.sectionName} › </span>
                    <span className="font-medium">{item.productName}</span>
                    <span className="text-[10px] text-slate-600 ml-auto">Zmluva {item.contractId}</span>
                  </div>
                  {item.folders.map((folder: any) => (
                    <TreeToggle key={`${noKey}-f-${folder.id}`} isOpen={expanded[`${noKey}-f-${folder.id}`] ?? false}
                      onToggle={() => toggle(`${noKey}-f-${folder.id}`)}
                      level={2} icon={<FolderOpen className="w-3.5 h-3.5 text-slate-400" />} label={folder.name}>
                      {folder.panels.map((panel: any) => (
                        <div key={panel.id} className="ml-6 space-y-0.5 py-1">
                          <div className="text-xs text-slate-500 font-medium px-2">{panel.name}</div>
                          {panel.params.map((param: any) => (
                            <div key={`${param.id}-${param.contractId}`} className="flex items-center gap-2 py-0.5 px-2 text-sm">
                              <Hash className="w-3 h-3 text-slate-600" />
                              <span className="text-slate-400 text-xs min-w-[120px]">{param.name}</span>
                              <span className="font-medium">{param.value}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </TreeToggle>
                  ))}
                </div>
              );
            })}
          </TreeToggle>
        )}
      </div>
    </div>
  );
}

function EntityLinksTab({ subject }: { subject: Subject }) {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const { data: links, isLoading } = useQuery<EnrichedEntityLink[]>({
    queryKey: ['/api/entity-links', subject.id],
  });

  const { data: officerCompanies = [] } = useQuery<any[]>({
    queryKey: ['/api/subjects', subject.id, 'officer-companies'],
    queryFn: async () => {
      const r = await fetch(`/api/subjects/${subject.id}/officer-companies`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const closeMutation = useMutation({
    mutationFn: async (linkId: number) => {
      await apiRequest("PATCH", `/api/entity-links/${linkId}/close`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entity-links', subject.id] });
      toast({ title: "Prepojenie ukoncene" });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa ukoncit prepojenie", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (targetId: number) => {
      await apiRequest("POST", "/api/entity-links", { sourceId: subject.id, targetId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/entity-links', subject.id] });
      setShowAddDialog(false);
      setSearchQuery("");
      setSearchResults([]);
      toast({ title: "Prepojenie vytvorene" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa vytvorit prepojenie", variant: "destructive" });
    },
  });

  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(`/api/subjects/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults((data || []).filter((s: any) => s.id !== subject.id));
    } catch { setSearchResults([]); }
    finally { setSearching(false); }
  }, [subject.id]);

  const activeLinks = (links || []).filter(l => !l.dateTo);
  const historicLinks = (links || []).filter(l => l.dateTo);

  const getOtherSubject = (link: EnrichedEntityLink) => {
    return link.sourceId === subject.id ? link.target : link.source;
  };

  const formatDate = (d: string | null) => d ? formatDateSlovak(d) : null;

  if (isLoading) return <p className="text-sm text-muted-foreground text-center py-6">Nacitavam prepojenia...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Vztahy a prepojenia</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowAddDialog(true)} data-testid="button-add-entity-link">
          <Plus className="w-3.5 h-3.5 mr-1" />
          Pridat prepojenie
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="default">Aktualne</Badge>
          <span className="text-xs text-muted-foreground">({activeLinks.length})</span>
        </div>
        {activeLinks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3 text-center" data-testid="text-no-active-links">Ziadne aktivne prepojenia</p>
        ) : (
          <div className="space-y-2">
            {activeLinks.map(link => {
              const other = getOtherSubject(link);
              return (
                <Card key={link.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        {other?.type === 'person' || other?.type === 'szco'
                          ? <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          : <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" data-testid={`text-link-name-${link.id}`}>{getSubjectLabel(other)}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{formatUid(other?.uid)}</span>
                            <span>od {formatDate(link.dateFrom)}</span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => closeMutation.mutate(link.id)}
                        disabled={closeMutation.isPending}
                        data-testid={`button-close-link-${link.id}`}
                      >
                        <Unlink className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {historicLinks.length > 0 && (
        <div>
          <Separator className="my-3" />
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="secondary">Historia</Badge>
            <span className="text-xs text-muted-foreground">({historicLinks.length})</span>
          </div>
          <div className="space-y-2">
            {historicLinks.map(link => {
              const other = getOtherSubject(link);
              return (
                <Card key={link.id}>
                  <CardContent className="p-3 opacity-60">
                    <div className="flex items-center gap-2 min-w-0">
                      {other?.type === 'person' || other?.type === 'szco'
                        ? <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        : <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-link-history-name-${link.id}`}>{getSubjectLabel(other)}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-mono">{formatUid(other?.uid)}</span>
                          <span>{formatDate(link.dateFrom)} - {formatDate(link.dateTo)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {officerCompanies.length > 0 && (
        <div>
          <Separator className="my-3" />
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-semibold">Štatutár v spoločnostiach</span>
            <span className="text-xs text-muted-foreground">({officerCompanies.length})</span>
          </div>
          <div className="space-y-2">
            {officerCompanies.map((oc: any) => (
              <div
                key={oc.officerId}
                className={`flex items-center justify-between gap-3 p-3 rounded-md border ${oc.isActive ? "border-border bg-background" : "border-border/50 bg-muted/20 opacity-60"}`}
                data-testid={`officer-company-${oc.companyId}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{oc.companyName}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      {oc.companyIco && <span>IČO: {oc.companyIco}</span>}
                      {oc.officerType && <Badge variant="outline" className="text-[10px] h-4">{oc.officerType}</Badge>}
                      {!oc.isActive && <Badge variant="outline" className="text-[10px] h-4 border-red-500/50 text-red-500">Neaktívny</Badge>}
                    </div>
                  </div>
                </div>
                {oc.companyUid && (
                  <span className="text-xs font-mono text-muted-foreground shrink-0 whitespace-nowrap">{formatUid(oc.companyUid)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Pridat prepojenie</DialogTitle>
            <DialogDescription>Vyhladajte subjekt pre vytvorenie prepojenia</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 p-4">
            <Input
              placeholder="Hladat podla mena, UID, emailu..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              data-testid="input-search-entity-link"
            />
            {searching && <p className="text-xs text-muted-foreground">Hladam...</p>}
            {searchResults.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {searchResults.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-md hover-elevate cursor-pointer"
                    onClick={() => createMutation.mutate(s.id)}
                    data-testid={`button-select-link-target-${s.id}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {s.type === 'person' || s.type === 'szco'
                        ? <User className="w-4 h-4 text-muted-foreground" />
                        : <Building2 className="w-4 h-4 text-muted-foreground" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {s.type === 'company' ? (s.companyName || 'Bez nazvu') : `${s.lastName || ''}, ${s.firstName || ''}`}
                        </p>
                        <span className="text-xs text-muted-foreground font-mono">{formatUid(s.uid)}</span>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-3">Ziadne vysledky</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RegistrySnapshotsTab({ subject }: { subject: Subject }) {
  const { toast } = useToast();
  const details = (subject as any).details || {};
  const dyn = details.dynamicFields || details;
  const ico = dyn.ico || dyn.p_ico || null;

  const { data: snapshots = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/subjects", subject.id, "registry-snapshots"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subject.id}/registry-snapshots`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/subjects/${subject.id}/registry-snapshots/refresh`);
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.success) {
        toast({ title: "Snapshot uložený", description: `Dáta z ${data.snapshot?.source || "registra"} boli uložené` });
        queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "registry-snapshots"] });
      } else {
        toast({ title: "Nepodarilo sa načítať", description: data?.message || "Register nedostupný", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Chyba pri načítavaní z registra", variant: "destructive" });
    },
  });

  const SOURCE_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
    ORSR: { label: "Obchodný register SR", color: "text-blue-400", border: "border-blue-500/40", bg: "bg-blue-500/10" },
    ZRSR: { label: "Živnostenský register SR", color: "text-emerald-400", border: "border-emerald-500/40", bg: "bg-emerald-500/10" },
    ARES: { label: "ARES (Český register)", color: "text-violet-400", border: "border-violet-500/40", bg: "bg-violet-500/10" },
  };

  if (!ico) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground" data-testid="registry-no-ico">
        <Database className="w-8 h-8 opacity-40" />
        <p className="text-sm">Tento subjekt nemá IČO — registrové záznamy nie sú dostupné</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="registry-snapshots-tab">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Registrové záznamy</span>
          <Badge variant="secondary" className="text-[10px]">{snapshots.length}</Badge>
          <span className="text-xs text-muted-foreground font-mono">IČO: {ico}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          data-testid="button-refresh-registry"
        >
          {refreshMutation.isPending ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3 mr-1" />
          )}
          Aktualizovať z registra
        </Button>
      </div>

      <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 px-1">
        <Shield className="w-3 h-3" />
        <span>Vzorová pravda: Každý záznam je nemenný snapshot pre AI audit a učenie synoným</span>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 justify-center py-8">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs text-muted-foreground">Načítavam registrové záznamy...</span>
        </div>
      ) : snapshots.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground" data-testid="registry-no-snapshots">
          <Database className="w-6 h-6 opacity-40" />
          <p className="text-sm">Žiadne registrové záznamy</p>
          <p className="text-xs">Kliknite „Aktualizovať z registra" pre načítanie dát</p>
        </div>
      ) : (
        <div className="space-y-3">
          {snapshots.map((snap: any) => {
            const cfg = SOURCE_CONFIG[snap.source] || SOURCE_CONFIG.ORSR;
            const parsed = snap.parsedFields || {};
            const fetchedDate = snap.fetchedAt ? formatDateTimeSlovak(snap.fetchedAt) : "-";

            return (
              <Card key={snap.id} className={`border ${cfg.border}`} data-testid={`registry-snapshot-${snap.id}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${cfg.color} ${cfg.border} ${cfg.bg}`}>
                        {snap.source}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{cfg.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{fetchedDate}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-2">
                    {parsed.name && (
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Obchodné meno</span>
                        <span className="text-xs font-medium" data-testid={`snap-name-${snap.id}`}>{parsed.name}</span>
                      </div>
                    )}
                    {parsed.legalForm && (
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Právna forma</span>
                        <span className="text-xs font-medium">{parsed.legalForm}</span>
                      </div>
                    )}
                    {parsed.dic && (
                      <div>
                        <span className="text-[10px] text-muted-foreground block">DIČ</span>
                        <span className="text-xs font-medium font-mono">{parsed.dic}</span>
                      </div>
                    )}
                    {(parsed.street || parsed.city) && (
                      <div>
                        <span className="text-[10px] text-muted-foreground block">Sídlo</span>
                        <span className="text-xs font-medium">
                          {[parsed.street, parsed.streetNumber].filter(Boolean).join(" ")}
                          {parsed.city ? `, ${parsed.zip ? parsed.zip + " " : ""}${parsed.city}` : ""}
                        </span>
                      </div>
                    )}
                    {parsed.directors && parsed.directors.length > 0 && (
                      <div className="sm:col-span-2">
                        <span className="text-[10px] text-muted-foreground block">Konatelia</span>
                        <span className="text-xs font-medium">{parsed.directors.map((d: any) => typeof d === "string" ? d : `${d.name} (${d.role})`).join(", ")}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Nemenný záznam • IČO: {snap.ico}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SubjectDetailPanel({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "objekty") return "objekty";
    if (t === "historia") return "historia";
    if (t === "vztahy") return "vztahy";
    if (t === "registre") return "registre";
    return "profil_subjektu";
  });
  const isSuperAdmin = useMemo(() => {
    const name = (appUser as any)?.permissionGroup?.name?.toLowerCase() || "";
    return name.includes("superadmin") || name.includes("prezident");
  }, [appUser]);

  const { data: freshSubject } = useQuery<Subject>({
    queryKey: ["/api/subjects", subject.id],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}`).then(r => r.json()),
  });
  const displaySubject = freshSubject || subject;
  const effectiveListStatus = (displaySubject as any).effectiveListStatus as string | null;

  const { data: riskData } = useQuery<{
    riskLinks: Array<{ subjectId: number; name: string; uid: string; listStatus: string; matchType: string; matchValue: string }>;
    foPoRisks: Array<{ subjectId: number; name: string; uid: string; listStatus: string; relationship: string }>;
  }>({
    queryKey: ["/api/subjects", subject.id, "risk-links"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/risk-links`).then(r => r.json()),
  });

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onClose} data-testid="button-back-to-list">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Späť na zoznam
        </Button>
        <Separator orientation="vertical" className="h-6" />
        <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
          {subject.type === 'person' ? <User className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-primary" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3 flex-wrap justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-baseline gap-1.5 flex-wrap min-w-0" data-testid="text-subject-detail-name">
                {(subject.type === 'person' || subject.type === 'szco') ? (
                  <>
                    {(subject as any).titleBefore && (
                      <span className="text-sm font-normal text-muted-foreground">{(subject as any).titleBefore}</span>
                    )}
                    <span className="text-lg font-bold text-foreground truncate">
                      {subject.firstName} {subject.lastName}
                    </span>
                    {(subject as any).titleAfter && (
                      <span className="text-sm font-normal text-muted-foreground">, {(subject as any).titleAfter}</span>
                    )}
                  </>
                ) : (
                  <span className="text-lg font-bold text-foreground truncate">{subject.companyName}</span>
                )}
              </div>
              <span className="text-xs font-mono text-muted-foreground shrink-0">{formatUid(subject.uid)}</span>
              {(() => {
                const rs = (displaySubject as any).registrationStatus || 'klient';
                const cfg: Record<string, { label: string; cls: string }> = {
                  potencialny: { label: "Potenciálny", cls: "text-[10px] border-gray-400/50 text-gray-400" },
                  tiper: { label: "Tipér", cls: "text-[10px] border-blue-500/50 text-blue-500" },
                  klient: { label: "Klient", cls: "text-[10px] border-green-500/50 text-green-500" },
                };
                const c = cfg[rs] || cfg.tiper;
                return <Badge variant="outline" className={c.cls} data-testid="badge-detail-registration-status">{c.label}</Badge>;
              })()}
              {(() => {
                const status = getSubjectStatus(subject);
                return (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium shrink-0 ${status.bgColor} ${status.borderColor} ${status.textColor}`}
                    data-testid={`status-dialog-subject-${subject.id}`}
                  >
                    {status.label}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {effectiveListStatus && (
                <Badge
                  variant={effectiveListStatus === "cierny" ? "destructive" : "secondary"}
                  className={effectiveListStatus === "cierny" ? "bg-red-900 text-red-200" : "bg-orange-900 text-orange-200"}
                  data-testid="badge-list-status"
                >
                  {effectiveListStatus === "cierny" ? <Ban className="w-3.5 h-3.5 mr-1" /> : <AlertTriangle className="w-3.5 h-3.5 mr-1" />}
                  {effectiveListStatus === "cierny" ? "Čierny zoznam" : "Červený zoznam"}
                </Badge>
              )}
              <Button
                variant={activeTab === "profil_subjektu" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab("profil_subjektu")}
                data-testid="tab-subject-profil"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                Profil<sup className="text-[7px] ml-0.5">(C)</sup>
              </Button>
              <Button
                variant={activeTab === "objekty" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab("objekty")}
                data-testid="tab-subject-objekty"
              >
                <Boxes className="w-3.5 h-3.5 mr-1" />
                Objekty<sup className="text-[7px] ml-0.5">(B)</sup>
              </Button>
              <Button
                variant={activeTab === "historia" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab("historia")}
                data-testid="tab-subject-historia"
              >
                <History className="w-3.5 h-3.5 mr-1" />
                História
              </Button>
              <Button
                variant={activeTab === "vztahy" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab("vztahy")}
                data-testid="tab-subject-vztahy"
              >
                <Link2 className="w-3.5 h-3.5 mr-1" />
                Vzťahy
              </Button>
              {(subject.type === "szco" || subject.type === "company" || subject.type === "po") && (
                <Button
                  variant={activeTab === "registre" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs px-2.5"
                  onClick={() => setActiveTab("registre")}
                  data-testid="tab-subject-registre"
                >
                  <Database className="w-3.5 h-3.5 mr-1" />
                  Registre
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {(() => {
        const lastLoginAt = (displaySubject as any).lastLoginAt ? new Date((displaySubject as any).lastLoginAt) : null;
        function fmtRelative(date: Date) {
          const diffMs = new Date().getTime() - date.getTime();
          const m = Math.floor(diffMs / 60000), h = Math.floor(diffMs / 3600000), d = Math.floor(diffMs / 86400000);
          if (d >= 1) return `pred ${d} dňami`;
          if (h >= 1) return `pred ${h} hodinami`;
          if (m >= 1) return `pred ${m} minútami`;
          return "pred menej ako minútou";
        }
        return (
          <div className="flex items-center gap-3 rounded border border-border/50 bg-muted/20 px-4 py-2.5" data-testid="banner-login-status">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Login Status</span>
              {lastLoginAt ? (
                <span className="text-sm text-foreground">
                  Naposledy prihlásený:{" "}
                  <span className="font-medium">
                    {lastLoginAt.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\s/g, "")}
                    {" "}{lastLoginAt.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="ml-1.5 text-xs text-muted-foreground">({fmtRelative(lastLoginAt)})</span>
                </span>
              ) : (
                <span className="text-sm text-muted-foreground italic">Subjekt sa do systému ArutsoK ešte nikdy neprihlásil.</span>
              )}
            </div>
          </div>
        );
      })()}

      {effectiveListStatus === "cierny" && (
        <div className="flex items-center gap-3 rounded border border-red-900 bg-red-950/80 px-4 py-3 text-red-200" data-testid="dialog-banner-cierny-zoznam">
          <Ban className="w-5 h-5 text-red-400 shrink-0" />
          <div>
            <span className="font-bold text-red-300 uppercase tracking-wide">ČIERNY ZOZNAM</span>
            <span className="ml-2 text-sm">Doživotné ukončenie spolupráce. Spravované cez Skupiny klientov.</span>
          </div>
        </div>
      )}
      {effectiveListStatus === "cerveny" && (
        <div className="flex items-center gap-3 rounded border border-orange-700 bg-orange-950/80 px-4 py-3 text-orange-200" data-testid="dialog-banner-cerveny-zoznam">
          <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
          <div>
            <span className="font-bold text-orange-300 uppercase tracking-wide">ČERVENÝ ZOZNAM</span>
            <span className="ml-2 text-sm">Automaticky zaradený (bonita ≤ -5 bodov). Potvrdené adminom.</span>
          </div>
        </div>
      )}
      {riskData?.foPoRisks && riskData.foPoRisks.length > 0 && (
        <div className="space-y-1" data-testid="dialog-banner-fo-po-risks">
          {riskData.foPoRisks.map((risk, i) => (
            <div key={`fopo-${i}`} className="flex items-center gap-3 rounded border border-yellow-700 bg-yellow-950/80 px-4 py-2.5 text-yellow-200">
              <Link2 className="w-5 h-5 text-yellow-400 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold text-yellow-300">
                  {risk.relationship === "konateľ" ? "Konateľ" : risk.relationship === "firma" ? "Firma" : "Prepojený subjekt"}
                </span>
                {" "}
                <span className="font-bold">{risk.name}</span>
                {" je na "}
                <span className={risk.listStatus === "cierny" ? "text-red-300 font-bold" : "text-orange-300 font-bold"}>
                  {risk.listStatus === "cierny" ? "Čiernom zozname" : "Červenom zozname"}
                </span>
                {"!"}
              </div>
            </div>
          ))}
        </div>
      )}
      {riskData?.riskLinks && riskData.riskLinks.length > 0 && (
        <div className="space-y-1" data-testid="dialog-banner-risk-links">
          {riskData.riskLinks.map((link, i) => (
            <div key={`risk-${i}`} className="flex items-center gap-3 rounded border border-amber-700 bg-amber-950/80 px-4 py-2.5 text-amber-200">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold">Kontakt je prepojený s rizikovou osobou:</span>
                {" "}
                <span className="font-bold text-amber-300">{link.name}</span>
                {" "}
                <span className="text-xs text-amber-400">
                  ({link.matchType}: {link.matchValue})
                </span>
                {" — "}
                <span className={link.listStatus === "cierny" ? "text-red-300 font-semibold" : "text-orange-300 font-semibold"}>
                  {link.listStatus === "cierny" ? "Čierny zoznam" : "Červený zoznam"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-3">
        {activeTab === "profil_subjektu" && (
          <SubjectProfileModuleC subject={subject} />
        )}

        {activeTab === "objekty" && (
          <SubjectObjectsTab subjectId={subject.id} />
        )}

        {activeTab === "historia" && (
          <div className="space-y-6">
            <div>
              <SubjectFieldHistoryPanel subjectId={subject.id} clientTypeId={(subject as any).clientTypeId ?? undefined} />
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" data-testid="text-activity-timeline-header">
                <Clock className="w-4 h-4" /> Časová os aktivít
              </h4>
              <ActivityTimeline subjectId={subject.id} />
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" data-testid="text-audit-log-header">
                <History className="w-4 h-4" /> Audit log
              </h4>
              <SubjectHistoryTab subjectId={subject.id} />
            </div>
          </div>
        )}

        {activeTab === "vztahy" && (
          <EntityLinksTab subject={subject} />
        )}

        {activeTab === "registre" && (
          <RegistrySnapshotsTab subject={subject} />
        )}
      </div>
    </div>
  );
}

function InitialRegistrationModal({
  open,
  onOpenChange,
  onProceed,
  onViewSubject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProceed: (data: { clientTypeCode: string; stateId: number; baseValue: string; aresData?: { name?: string; street?: string; streetNumber?: string; zip?: string; city?: string; legalForm?: string; dic?: string; source?: string; directors?: { name: string; role: string; titleBefore?: string; firstName?: string; lastName?: string; titleAfter?: string }[] } }) => void;
  onViewSubject: (id: number) => void;
}) {
  const { data: appUser } = useAppUser();
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });

  const [selectedType, setSelectedType] = useState("");
  const [baseValue, setBaseValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{ name: string; uid: string; id: number; matchedField?: string; managerName?: string | null; managerId?: number | null; isBlacklisted?: boolean; blacklistMessage?: string } | null>(null);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [rcError, setRcError] = useState<string | null>(null);
  const [icoError, setIcoError] = useState<string | null>(null);
  const [aresLookup, setAresLookup] = useState<{ name?: string; street?: string; streetNumber?: string; zip?: string; city?: string; legalForm?: string; dic?: string; source?: string; directors?: { name: string; role: string; titleBefore?: string; firstName?: string; lastName?: string; titleAfter?: string }[]; found: boolean; message?: string } | null>(null);
  const [aresLoading, setAresLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseInputRef = useRef<HTMLInputElement>(null);
  const proceedBtnRef = useRef<HTMLButtonElement>(null);

  const selectedClientType = clientTypes?.find(ct => ct.code === selectedType);
  const baseParamLabel = selectedClientType?.baseParameter === "ico" ? "ICO" : "Rodne cislo (RC)";

  const performDuplicateCheck = useCallback(async (value: string, _paramType: string | undefined) => {
    if (!value.trim()) {
      setDuplicateInfo(null);
      setDuplicateChecked(false);
      return;
    }
    setChecking(true);
    try {
      const trimmed = value.trim();
      const body = { birthNumber: trimmed, ico: trimmed };
      const res = await apiRequest("POST", "/api/subjects/check-duplicate", body);
      const data = await res.json();
      if (data.isDuplicate) {
        setDuplicateInfo({ name: data.subject.name, uid: data.subject.uid, id: data.subject.id, matchedField: data.subject.matchedField, managerName: data.managerName, managerId: data.managerId, isBlacklisted: data.isBlacklisted, blacklistMessage: data.message });
      } else {
        setDuplicateInfo(null);
      }
      setDuplicateChecked(true);
      if (!data.isDuplicate) {
        setTimeout(() => proceedBtnRef.current?.focus(), 50);
      }
    } catch {
      setDuplicateInfo(null);
      setDuplicateChecked(true);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (!baseValue.trim() || !selectedType) {
      setDuplicateInfo(null);
      setDuplicateChecked(false);
      setRcError(null);
      setIcoError(null);
      setAresLookup(null);
      return;
    }
    const isRc = selectedClientType?.baseParameter === "rc";
    const isIco = selectedClientType?.baseParameter === "ico";
    if (isRc) {
      setIcoError(null);
      setAresLookup(null);
      const digitsOnly = baseValue.replace(/[^0-9]/g, "");
      if (digitsOnly.length < 9) {
        setDuplicateChecked(false);
        setRcError(null);
        return;
      }
      const result = validateSlovakRC(baseValue);
      if (!result.valid) {
        setRcError(result.error || "Neplatné rodné číslo");
        setDuplicateChecked(false);
        return;
      }
      setRcError(null);
      performDuplicateCheck(baseValue, selectedClientType?.baseParameter);
    } else if (isIco) {
      setRcError(null);
      const digitsOnly = baseValue.replace(/[\s\/-]/g, "");
      if (digitsOnly.length < 1) {
        setDuplicateChecked(false);
        setIcoError(null);
        setAresLookup(null);
        return;
      }
      const icoResult = validateSlovakICO(baseValue);
      if (!icoResult.valid) {
        setIcoError(icoResult.error || "Neplatné IČO");
        setDuplicateChecked(false);
        setAresLookup(null);
        return;
      }
      setIcoError(null);
      performDuplicateCheck(baseValue, selectedClientType?.baseParameter);
      setAresLoading(true);
      const normalizedIco = icoResult.normalized || digitsOnly;
      const lookupType = selectedType.toLowerCase().includes("szco") ? "szco" : "company";
      fetch(`/api/lookup/ico/${encodeURIComponent(normalizedIco)}?type=${lookupType}`, { credentials: "include" })
        .then(r => r.json())
        .then(data => {
          if (data.found) {
            setAresLookup(data);
          } else {
            setAresLookup({ found: false, message: data.message || "Subjekt nenájdený v štátnych registroch" });
          }
        })
        .catch(() => {
          setAresLookup({ found: false, message: "Chyba pri vyhľadávaní v registroch" });
        })
        .finally(() => setAresLoading(false));
    } else {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setDuplicateChecked(false);
      debounceRef.current = setTimeout(() => {
        performDuplicateCheck(baseValue, selectedClientType?.baseParameter);
      }, 500);
      return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }
  }, [baseValue, selectedType, selectedClientType?.baseParameter, performDuplicateCheck]);

  function handleProceed() {
    if (duplicateInfo) return;
    onProceed({
      clientTypeCode: selectedType,
      stateId: appUser?.activeStateId || 0,
      baseValue: baseValue.trim(),
      aresData: aresLookup?.found ? { name: aresLookup.name, street: aresLookup.street, streetNumber: aresLookup.streetNumber, zip: aresLookup.zip, city: aresLookup.city, legalForm: aresLookup.legalForm, dic: aresLookup.dic, source: aresLookup.source, directors: aresLookup.directors } : undefined,
    });
    setSelectedType("");
    setBaseValue("");
    setDuplicateInfo(null);
    setDuplicateChecked(false);
    setAresLookup(null);
  }

  const canProceed = selectedType && appUser?.activeStateId && baseValue.trim() && duplicateChecked && !duplicateInfo && !rcError && !icoError;

  return (
    <Dialog open={open} onOpenChange={(o) => {
      if (!o) { setDuplicateInfo(null); setDuplicateChecked(false); setBaseValue(""); setSelectedType(""); setIcoError(null); setAresLookup(null); }
      onOpenChange(o);
    }}>
      <DialogContent size="sm" className="flex flex-col items-stretch justify-start">
        <DialogHeader>
          <DialogTitle>Registracia noveho klienta</DialogTitle>
          <DialogDescription>
            Vyberte typ klienta, stat a zadajte zakladny identifikator.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs">Typ klienta</Label>
            <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setDuplicateInfo(null); setTimeout(() => baseInputRef.current?.focus(), 50); }}>
              <SelectTrigger data-testid="select-client-type">
                <SelectValue placeholder="Vyberte typ" />
              </SelectTrigger>
              <SelectContent>
                {clientTypes?.filter(ct => ct.isActive).map(ct => (
                  <SelectItem key={ct.code} value={ct.code}>{ct.name} ({ct.code})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div style={{ display: selectedType ? 'block' : 'none' }}>
            <Label className="text-xs">{baseParamLabel}</Label>
            <div className="relative">
              <Input
                ref={baseInputRef}
                placeholder={selectedClientType?.baseParameter === "ico" ? "napr. 12345678" : "napr. 900101/1234"}
                value={baseValue}
                onChange={(e) => {
                  setBaseValue(e.target.value);
                }}
                onKeyDown={(e) => { if (e.key === "Enter" && canProceed && !checking) handleProceed(); }}
                className={(rcError || icoError) ? "border-red-500 focus-visible:ring-red-500" : ""}
                data-testid="input-base-parameter"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2" style={{ display: (checking || aresLoading) ? 'block' : 'none' }}>
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2" style={{ display: (!checking && !aresLoading && duplicateChecked && !duplicateInfo && baseValue.trim() && !rcError && !icoError) ? 'block' : 'none' }}>
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2" style={{ display: (rcError || icoError) ? 'block' : 'none' }}>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
            </div>
            {rcError && (
              <p className="text-xs text-red-500 mt-1" data-testid="text-rc-error">{rcError}</p>
            )}
            {icoError && (
              <p className="text-xs text-red-500 mt-1" data-testid="text-ico-error">{icoError}</p>
            )}
            {aresLoading && (
              <div className="flex items-center gap-2 mt-1" data-testid="text-registry-loading">
                <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                <span className="text-xs text-blue-400">Preberám údaje z registra...</span>
              </div>
            )}
            {aresLookup?.found && (
              <div className="mt-2 bg-blue-500/10 border border-blue-500/30 rounded-md p-3 space-y-1" data-testid="ares-lookup-result">
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-xs font-semibold text-blue-400">{aresLookup.source === "ORSR" ? "Obchodný register SR" : aresLookup.source === "ZRSR" ? "Živnostenský register SR" : "ARES Register"}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 border-blue-500/40 text-blue-400 hover:bg-blue-500/20"
                    onClick={handleProceed}
                    disabled={!canProceed || checking}
                    data-testid="button-use-ares-data"
                  >
                    Použiť údaje
                  </Button>
                </div>
                {aresLookup.name && <p className="text-sm font-medium">{aresLookup.name}</p>}
                {(aresLookup.street || aresLookup.city) && (
                  <p className="text-xs text-muted-foreground">
                    {[aresLookup.street, aresLookup.streetNumber].filter(Boolean).join(" ")}
                    {(aresLookup.street || aresLookup.streetNumber) && (aresLookup.zip || aresLookup.city) ? ", " : ""}
                    {[aresLookup.zip, aresLookup.city].filter(Boolean).join(" ")}
                  </p>
                )}
                {aresLookup.legalForm && <p className="text-[10px] text-muted-foreground">{aresLookup.legalForm}{aresLookup.dic ? ` | DIČ: ${aresLookup.dic}` : ""}</p>}
                {aresLookup.directors && aresLookup.directors.length > 0 && (
                  <div className="mt-1 pt-1 border-t border-blue-500/20">
                    <p className="text-[10px] font-semibold text-blue-400/80 mb-0.5">Štatutári / Konatelia:</p>
                    {aresLookup.directors.slice(0, 5).map((dir, i) => (
                      <p key={i} className="text-[10px] text-muted-foreground">
                        {[dir.titleBefore, dir.firstName, dir.lastName, dir.titleAfter].filter(Boolean).join(" ") || dir.name}
                        {dir.role ? <span className="text-[9px] text-blue-400/60 ml-1">({dir.role})</span> : null}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {aresLookup && !aresLookup.found && !icoError && (
              <p className="text-xs text-muted-foreground mt-1">{aresLookup.message}</p>
            )}
          </div>

          <div style={{ display: duplicateInfo ? 'block' : 'none' }}>
            <div className={`${duplicateInfo?.isBlacklisted ? 'bg-red-900/20 border-red-500/50' : 'bg-destructive/10 border-destructive/30'} border rounded-md p-3 space-y-2`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${duplicateInfo?.isBlacklisted ? 'text-red-500' : 'text-destructive'}`} />
                <span className={`text-sm font-semibold ${duplicateInfo?.isBlacklisted ? 'text-red-500' : 'text-destructive'}`}>
                  {duplicateInfo?.isBlacklisted ? 'Registráciu nie je možné dokončiť' : 'Klient uz existuje'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {duplicateInfo?.name} <span className="font-mono text-xs">[ {formatUid(duplicateInfo?.uid)} ]</span>
                <span style={{ display: duplicateInfo?.matchedField ? 'inline' : 'none' }} className="text-xs ml-1">(zhoda: {duplicateInfo?.matchedField})</span>
              </p>
              {duplicateInfo?.isBlacklisted && (
                <p className="text-xs text-red-400 font-medium" data-testid="text-blacklist-message">{duplicateInfo.blacklistMessage}</p>
              )}
              {duplicateInfo?.managerName && !duplicateInfo?.isBlacklisted && (
                <p className="text-xs text-muted-foreground" data-testid="text-duplicate-manager">Správca: <span className="font-semibold text-foreground">{duplicateInfo.managerName}</span></p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {!duplicateInfo?.isBlacklisted && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (duplicateInfo) {
                        onOpenChange(false);
                        onViewSubject(duplicateInfo.id);
                      }
                    }}
                    data-testid="button-go-to-client"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Prejst na kartu klienta
                  </Button>
                )}
                {duplicateInfo?.managerName && !duplicateInfo?.isBlacklisted && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      if (duplicateInfo) {
                        onOpenChange(false);
                        onViewSubject(duplicateInfo.id);
                      }
                    }}
                    data-testid="button-contact-manager"
                  >
                    Kontaktovať správcu {duplicateInfo.managerName} o zdieľanie klienta
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-init-reg">
              Zrusit
            </Button>
            <Button
              ref={proceedBtnRef}
              onClick={handleProceed}
              disabled={!canProceed || checking}
              data-testid="button-continue-reg"
            >
              {checking ? "Overujem..." : "Pokracovat"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const TITLE_NORMALIZE_MAP: Record<string, string> = {
  "bc": "Bc.", "bc.": "Bc.",
  "ing": "Ing.", "ing.": "Ing.",
  "ing. arch.": "Ing. arch.", "ing.arch.": "Ing. arch.", "ing. arch": "Ing. arch.", "ingarch": "Ing. arch.",
  "mgr": "Mgr.", "mgr.": "Mgr.",
  "mgr. art.": "Mgr. art.", "mgr.art.": "Mgr. art.", "mgr. art": "Mgr. art.",
  "mudr": "MUDr.", "mudr.": "MUDr.",
  "mvdr": "MVDr.", "mvdr.": "MVDr.",
  "mddr": "MDDr.", "mddr.": "MDDr.",
  "phdr": "PhDr.", "phdr.": "PhDr.",
  "rndr": "RNDr.", "rndr.": "RNDr.",
  "judr": "JUDr.", "judr.": "JUDr.",
  "paeddr": "PaedDr.", "paeddr.": "PaedDr.", "paed. dr.": "PaedDr.", "paed.dr.": "PaedDr.",
  "thdr": "ThDr.", "thdr.": "ThDr.",
  "thlic": "ThLic.", "thlic.": "ThLic.",
  "dr": "Dr.", "dr.": "Dr.",
  "phmr": "PhMr.", "phmr.": "PhMr.",
  "pharmdr": "PharmDr.", "pharmdr.": "PharmDr.",
  "doc": "Doc.", "doc.": "Doc.", "docent": "Doc.",
  "prof": "Prof.", "prof.": "Prof.", "profesor": "Prof.",
  "dipl": "Dipl.", "dipl.": "Dipl.",
  "phd": "PhD.", "phd.": "PhD.",
  "csc": "CSc.", "csc.": "CSc.",
  "drsc": "DrSc.", "drsc.": "DrSc.",
  "mba": "MBA",
  "mpa": "MPA",
  "msc": "MSc.", "msc.": "MSc.",
  "bsc": "BSc.", "bsc.": "BSc.",
  "dis": "DiS.", "dis.": "DiS.",
  "dis.art": "DiS.art.", "dis.art.": "DiS.art.",
  "mph": "MPH",
  "ll.m": "LL.M.", "ll.m.": "LL.M.", "llm": "LL.M.",
  "mha": "MHA",
  "artd": "ArtD.", "artd.": "ArtD.",
};

function normalizeTitle(raw: string): string | null {
  if (!raw || !raw.trim()) return "";
  const parts = raw.trim().split(/\s+/);
  const canonical: string[] = [];
  for (const part of parts) {
    const key = part.toLowerCase();
    if (TITLE_NORMALIZE_MAP[key]) {
      canonical.push(TITLE_NORMALIZE_MAP[key]);
    } else {
      const wholeKey = raw.trim().toLowerCase();
      if (TITLE_NORMALIZE_MAP[wholeKey]) return TITLE_NORMALIZE_MAP[wholeKey];
      return null;
    }
  }
  return canonical.join(" ");
}

function capitalizeFirst(val: string): string {
  if (!val) return val;
  return val.charAt(0).toUpperCase() + val.slice(1);
}

function DynamicFieldInput({ field, dynamicValues, setDynamicValues, hasError, disabled, subjectId }: {
  field: StaticField;
  dynamicValues: Record<string, string>;
  setDynamicValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hasError?: boolean;
  disabled?: boolean;
  subjectId?: number;
}) {
  const { data: allStates } = useStates();
  const { data: appUser } = useAppUser();
  const [nameWarning, setNameWarning] = useState<string | null>(null);
  const [titleWarning, setTitleWarning] = useState<string | null>(null);
  const [rcFieldError, setRcFieldError] = useState<string | null>(null);
  const [icoFieldError, setIcoFieldError] = useState<string | null>(null);

  const isNameField = field.fieldKey === "meno" || field.fieldKey === "priezvisko";
  const isTitleField = field.fieldKey === "titul_pred" || field.fieldKey === "titul_za";
  const isRcField = field.fieldKey === "rodne_cislo" || field.fieldKey === "zi_rodne_cislo";
  const isIcoField = field.fieldKey === "ico" || field.fieldKey === "zi_ico";

  const numberFieldValidity = useMemo(() => {
    return isNumberFieldWithExpiredPair(field.fieldKey, dynamicValues);
  }, [field.fieldKey, dynamicValues]);
  const isExpiredNumber = numberFieldValidity?.status === "expired";
  const errorBorder = hasError || rcFieldError || icoFieldError ? "border-red-500 ring-1 ring-red-500" : isExpiredNumber ? "border-red-500/60 bg-red-500/10 ring-1 ring-red-500/30" : titleWarning ? "border-amber-500 ring-1 ring-amber-500/60" : "";
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label className={`text-xs truncate block ${hasError ? "text-red-500" : isExpiredNumber ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
          {field.shortLabel ? (
            <>
              <span className="hidden lg:inline">{field.label || field.fieldKey}</span>
              <span className="inline lg:hidden">{field.shortLabel}</span>
            </>
          ) : (
            <span>{field.label || field.fieldKey}</span>
          )}
          {field.isRequired ? " *" : ""}
          {isExpiredNumber && <span className="ml-1 text-red-500 text-[9px]">(neplatný doklad)</span>}
        </Label>
        {subjectId && (
          <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={field.label || field.fieldKey} />
        )}
      </div>
      {field.fieldType === "long_text" ? (
        <Textarea
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          rows={2}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "combobox" || field.fieldType === "jedna_moznost" ? (
        <Select
          value={dynamicValues[field.fieldKey] || ""}
          onValueChange={val => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: val }))}
          disabled={disabled}
        >
          <SelectTrigger className={cn(errorBorder, disabled && "bg-muted/50 cursor-default opacity-100")} data-testid={`select-dynamic-${field.fieldKey}`}>
            <SelectValue placeholder="" />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt: string) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.fieldType === "viac_moznosti" ? (
        <MultiSelectCheckboxes
          paramId={field.fieldKey}
          options={field.options || []}
          value={dynamicValues[field.fieldKey] || ""}
          onChange={(val) => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: val }))}
        />
      ) : field.fieldType === "switch" ? (
        <div className="flex items-center gap-2 pt-1">
          <Switch
            checked={dynamicValues[field.fieldKey] === "true"}
            onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: String(checked) }))}
            data-testid={`switch-dynamic-${field.fieldKey}`}
          />
          <span className="text-xs text-muted-foreground">{dynamicValues[field.fieldKey] === "true" ? "Ano" : "Nie"}</span>
        </div>
      ) : field.fieldType === "checkbox" ? (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            checked={dynamicValues[field.fieldKey] === "true"}
            onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: String(!!checked) }))}
            data-testid={`checkbox-dynamic-${field.fieldKey}`}
          />
          <span className="text-xs text-muted-foreground">{dynamicValues[field.fieldKey] === "true" ? "Ano" : "Nie"}</span>
        </div>
      ) : field.fieldType === "date" ? (
        (() => {
          const dateVal = dynamicValues[field.fieldKey] || "";
          const isValidity = isValidityField(field.fieldKey);
          const validity = isValidity && dateVal ? getDocumentValidityStatus(dateVal) : null;
          const validityClass = validity ? `${validity.borderClass} ${validity.bgClass}` : "";
          const validityLabel = validity?.label || "";
          return (
            <div className="relative">
              <Input
                type="date"
                value={dateVal}
                onChange={e => { if (disabled) return; setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value })); }}
                readOnly={disabled}
                tabIndex={disabled ? -1 : undefined}
                className={cn(errorBorder || validityClass, disabled && "bg-muted/50 cursor-default", validityLabel && "pr-[5.5rem]")}
                data-testid={`input-dynamic-${field.fieldKey}`}
              />
              {validity && validity.status !== "unknown" && (
                <span className={cn(
                  "absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-semibold pointer-events-none select-none flex items-center gap-1",
                  validity.textClass
                )} data-testid={`validity-status-${field.fieldKey}`}>
                  <span className={cn("w-2 h-2 rounded-full shrink-0", validity.dotClass)} />
                  {validityLabel}
                </span>
              )}
            </div>
          );
        })()
      ) : field.fieldType === "number" && field.fieldKey === "vek" ? (
        <div
          className="h-9 w-full flex items-center px-3 rounded-md bg-muted/50 border border-border text-sm font-medium text-foreground cursor-default select-none whitespace-nowrap"
          data-testid={`input-dynamic-${field.fieldKey}`}
        >
          {dynamicValues[field.fieldKey] ? `${dynamicValues[field.fieldKey]} rokov` : ""}
        </div>
      ) : field.fieldType === "number" ? (
        <Input
          type="number"
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "email" ? (
        <Input
          type="email"
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "phone" ? (
        <PhoneInput
          value={dynamicValues[field.fieldKey] || ""}
          onChange={val => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: val }))}
          initialDialCode={allStates?.find(s => s.id === appUser?.activeStateId)?.code}
          error={!!errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "iban" ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value.toUpperCase() }))}
          placeholder="SK00 0000 0000 0000 0000 0000"
          className={`font-mono ${errorBorder}`}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : isTitleField ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => {
            setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
            if (!e.target.value.trim()) setTitleWarning(null);
          }}
          onBlur={() => {
            const raw = dynamicValues[field.fieldKey] || "";
            if (!raw.trim()) { setTitleWarning(null); return; }
            const result = normalizeTitle(raw);
            if (result === null) {
              setTitleWarning(`"${raw}" — titul sa nenachádza v zozname povolených titulov`);
            } else if (result !== raw) {
              setDynamicValues(prev => ({ ...prev, [field.fieldKey]: result }));
              setTitleWarning(null);
            } else {
              setTitleWarning(null);
            }
          }}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : isNameField ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => {
            const raw = e.target.value;
            if (raw.length > 0 && raw.charAt(0) !== raw.charAt(0).toUpperCase()) {
              const corrected = capitalizeFirst(raw);
              setDynamicValues(prev => ({ ...prev, [field.fieldKey]: corrected }));
              const fieldLabel = field.fieldKey === "meno" ? "Meno" : "Priezvisko";
              setNameWarning(`${fieldLabel} opravene: "${raw}" → "${corrected}"`);
            } else {
              setDynamicValues(prev => ({ ...prev, [field.fieldKey]: raw }));
              setNameWarning(null);
            }
          }}
          onBlur={() => {
            const val = dynamicValues[field.fieldKey] || "";
            if (val.length > 0 && val.charAt(0) !== val.charAt(0).toUpperCase()) {
              const corrected = capitalizeFirst(val);
              setDynamicValues(prev => ({ ...prev, [field.fieldKey]: corrected }));
              const fieldLabel = field.fieldKey === "meno" ? "Meno" : "Priezvisko";
              setNameWarning(`${fieldLabel} opravene: "${val}" → "${corrected}"`);
            }
          }}
          className={cn(errorBorder, nameWarning && "border-amber-500")}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : isRcField ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => {
            setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
            if (rcFieldError) {
              const result = validateSlovakRC(e.target.value);
              if (result.valid) setRcFieldError(null);
            }
          }}
          onBlur={() => {
            const val = (dynamicValues[field.fieldKey] || "").trim();
            if (!val || val.replace(/[\s\/-]/g, "").length < 6) { setRcFieldError(null); return; }
            const result = validateSlovakRC(val);
            if (!result.valid) {
              setRcFieldError(result.error || "Neplatné rodné číslo");
            } else {
              setRcFieldError(null);
            }
          }}
          className={`font-mono ${errorBorder}`}
          placeholder="XXXXXX/XXXX"
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : isIcoField ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => {
            setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }));
            if (icoFieldError) {
              const r = validateSlovakICO(e.target.value);
              if (r.valid) setIcoFieldError(null);
            }
          }}
          onBlur={() => {
            const val = (dynamicValues[field.fieldKey] || "").trim();
            if (!val) { setIcoFieldError(null); return; }
            const result = validateSlovakICO(val);
            if (!result.valid) {
              setIcoFieldError(result.error || "Neplatné IČO");
            } else {
              setIcoFieldError(null);
              if (result.normalized && result.normalized !== val) {
                setDynamicValues(prev => ({ ...prev, [field.fieldKey]: result.normalized! }));
              }
            }
          }}
          className={`font-mono ${errorBorder}`}
          placeholder="12345678"
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      )}
      {nameWarning && isNameField && (
        <p className="text-[10px] text-amber-500 leading-tight">{nameWarning}</p>
      )}
      {titleWarning && isTitleField && (
        <p className="text-[10px] text-amber-500 leading-tight">{titleWarning}</p>
      )}
      {rcFieldError && isRcField && (
        <p className="text-[10px] text-red-500 leading-tight" data-testid={`text-rc-error-${field.fieldKey}`}>{rcFieldError}</p>
      )}
      {icoFieldError && isIcoField && (
        <p className="text-[10px] text-red-500 leading-tight" data-testid={`text-ico-error-${field.fieldKey}`}>{icoFieldError}</p>
      )}
    </div>
  );
}

function FullPageEditor({
  initialData,
  onCancel,
}: {
  initialData: { clientTypeCode: string; stateId: number; baseValue: string; aresData?: { name?: string; street?: string; streetNumber?: string; zip?: string; city?: string; legalForm?: string; dic?: string; source?: string; directors?: { name: string; role: string; titleBefore?: string; firstName?: string; lastName?: string; titleAfter?: string }[] } };
  onCancel: () => void;
}) {
  const { mutate, isPending } = useCreateSubject();
  const { toast } = useToast();
  const { data: companies } = useMyCompanies();
  const { data: allStates, isLoading: statesLoading } = useStates();
  const { data: clientTypes, isLoading: typesLoading } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const { data: appUser } = useAppUser();
  const { data: uidPrefixData } = useQuery<{ prefix: string }>({ queryKey: ["/api/uid-prefix"] });
  const uidPrefix = uidPrefixData?.prefix || "421";
  const timerRef = useRef<number>(performance.now());

  const clientType = clientTypes?.find(ct => ct.code === initialData.clientTypeCode);
  const isPerson = clientType?.baseParameter === "rc";
  const state = allStates?.find(s => s.id === initialData.stateId);

  const isSzcoType = clientType?.code === 'SZCO';
  const [szcoData, setSzcoData] = useState({
    obchodne_meno: initialData.aresData?.name || "",
    ico: initialData.baseValue || "",
    dic: initialData.aresData?.dic || "",
    ic_dph: "",
    miesto_podnikania: initialData.aresData ? [initialData.aresData.street, initialData.aresData.streetNumber].filter(Boolean).join(" ") + (initialData.aresData.street || initialData.aresData.streetNumber ? ", " : "") + [initialData.aresData.zip, initialData.aresData.city].filter(Boolean).join(" ") : "",
    register: "",
    szco_uid: "",
  });
  const [szcoFoData, setSzcoFoData] = useState({ firstName: "", lastName: "", birthNumber: "", fo_uid: "" });
  const [szcoFoLinkedId, setSzcoFoLinkedId] = useState<number | null>(null);
  const [szcoFoLoading, setSzcoFoLoading] = useState(false);
  const [szcoFoRcError, setSzcoFoRcError] = useState<string | null>(null);
  const [szcoIcoError, setSzcoIcoError] = useState<string | null>(null);
  const [szcoAresLookup, setSzcoAresLookup] = useState<{ name?: string; street?: string; streetNumber?: string; zip?: string; city?: string; legalForm?: string; dic?: string; source?: string; directors?: { name: string; role: string }[]; found: boolean; message?: string } | null>(null);
  const [szcoAresLoading, setSzcoAresLoading] = useState(false);
  const [pendingRegistrySnapshot, setPendingRegistrySnapshot] = useState<{ name?: string; street?: string; streetNumber?: string; zip?: string; city?: string; legalForm?: string; dic?: string; source?: string } | null>(null);

  const [importedFieldKeys] = useState<Set<string>>(() => new Set<string>());
  const [flashingFields, setFlashingFields] = useState<Set<string>>(new Set());
  const [dynamicValues, setDynamicValuesRaw] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = { korespond_rovnaka: "true", kontaktna_rovnaka: "true", tp_stat: DEFAULT_COUNTRY, ka_stat: DEFAULT_COUNTRY, koa_stat: DEFAULT_COUNTRY, sidlo_stat: DEFAULT_COUNTRY, vykon_stat: DEFAULT_COUNTRY };
    if (initialData.clientTypeCode === 'NS') base.typ_organizacie = "Nezisková organizácia";
    if (initialData.clientTypeCode === 'VS') base.typ_organizacie = "Štátna inštitúcia";
    if (initialData.aresData && !isSzcoType) {
      if (initialData.aresData.name) { base.obchodne_meno = initialData.aresData.name; importedFieldKeys.add('obchodne_meno'); }
      if (initialData.aresData.dic) { base.dic = initialData.aresData.dic; importedFieldKeys.add('dic'); }
      if (initialData.aresData.street) { base.sidlo_ulica = initialData.aresData.street + (initialData.aresData.streetNumber ? " " + initialData.aresData.streetNumber : ""); importedFieldKeys.add('sidlo_ulica'); }
      if (initialData.aresData.zip) { base.sidlo_psc = initialData.aresData.zip; importedFieldKeys.add('sidlo_psc'); }
      if (initialData.aresData.city) { base.sidlo_mesto = initialData.aresData.city; importedFieldKeys.add('sidlo_mesto'); }
      if (initialData.aresData.directors?.length) {
        initialData.aresData.directors.slice(0, 5).forEach((dir, i) => {
          const slot = i + 1;
          const nameStr = [dir.titleBefore, dir.firstName, dir.lastName, dir.titleAfter].filter(Boolean).join(" ") || dir.name;
          const fieldKey = `po_statutar_${slot}_meno`;
          base[fieldKey] = nameStr + (dir.role ? ` (${dir.role})` : "");
          importedFieldKeys.add(fieldKey);
        });
      }
    }
    return base;
  });
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [contacts, setContacts] = useState<ContactEntry[]>([{ id: crypto.randomUUID(), type: "phone", value: "", label: "Primárny", isPrimary: true }]);
  const [validationErrors, setValidationErrors] = useState<Set<string>>(new Set());
  const [existingSubjectBanner, setExistingSubjectBanner] = useState<{ id: number; uid: string; name: string; matchedField: string } | null>(null);
  const [pendingSubmitData, setPendingSubmitData] = useState<any>(null);
  const setDynamicValues: typeof setDynamicValuesRaw = (updater) => {
    setDynamicValuesRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const changedKeys = Object.keys(next).filter(k => next[k] !== prev[k]);
      if (changedKeys.length > 0 && validationErrors.size > 0) {
        setValidationErrors(prev => {
          const updated = new Set(prev);
          changedKeys.forEach(k => updated.delete(k));
          return updated.size === prev.size ? prev : updated;
        });
      }
      return next;
    });
  };

  const parseRodneCislo = (rc: string): { pohlavie?: string; datumNarodenia?: string } => {
    const clean = rc.replace(/[\s\/]/g, "");
    if (clean.length < 6 || !/^\d+$/.test(clean)) return {};
    const yy = parseInt(clean.substring(0, 2), 10);
    let mm = parseInt(clean.substring(2, 4), 10);
    const dd = parseInt(clean.substring(4, 6), 10);
    const pohlavie = mm > 50 ? "žena" : "muž";
    if (mm > 50) mm -= 50;
    if (mm > 20) mm -= 20;
    const year = yy >= 0 && yy <= 30 ? 2000 + yy : 1900 + yy;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { pohlavie };
    const dateStr = `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return { pohlavie };
    return { pohlavie, datumNarodenia: dateStr };
  };

  useEffect(() => {
    if (importedFieldKeys.size > 0) {
      setFlashingFields(new Set(importedFieldKeys));
      const t = setTimeout(() => setFlashingFields(new Set()), 1800);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (isPerson && state?.name && !dynamicValues["statna_prislusnost"]) {
      const defaultCountry = getDefaultCountryForState(state.name);
      setDynamicValues(prev => prev["statna_prislusnost"] ? prev : { ...prev, statna_prislusnost: defaultCountry });
    }
  }, [isPerson, state?.name]);

  useEffect(() => {
    if (!isPerson) return;
    const rc = dynamicValues["rodne_cislo"]?.trim() || initialData.baseValue?.trim();
    if (!rc) return;
    const parsed = parseRodneCislo(rc);
    if (parsed.pohlavie || parsed.datumNarodenia) {
      setDynamicValues(prev => {
        const updates: Record<string, string> = {};
        if (parsed.pohlavie && prev["pohlavie"] !== parsed.pohlavie) updates["pohlavie"] = parsed.pohlavie;
        if (parsed.datumNarodenia && prev["datum_narodenia"] !== parsed.datumNarodenia) updates["datum_narodenia"] = parsed.datumNarodenia;
        if (parsed.datumNarodenia) {
          const birth = new Date(parsed.datumNarodenia);
          const today = new Date();
          let age = today.getFullYear() - birth.getFullYear();
          const mDiff = today.getMonth() - birth.getMonth();
          if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age--;
          const ageStr = String(age >= 0 ? age : 0);
          if (prev["vek"] !== ageStr) updates["vek"] = ageStr;
        }
        return Object.keys(updates).length > 0 ? { ...prev, ...updates } : prev;
      });
    }
  }, [isPerson, dynamicValues["rodne_cislo"], initialData.baseValue]);

  const editorClientTypeId = clientType?.code === 'SZCO' ? 3 : (clientType?.code === 'PO' || clientType?.code === 'NS' || clientType?.code === 'VS') ? 4 : 1;
  const typeFields = getFieldsForClientTypeId(editorClientTypeId);
  const typeSections = getSectionsForClientTypeId(editorClientTypeId);

  function isFieldVisible(field: StaticField): boolean {
    if (!field.visibilityRule) return true;
    const rule = field.visibilityRule as { dependsOn: string; value: string };
    if (!rule.dependsOn || !rule.value) return true;
    const depField = typeFields?.find(f => f.fieldKey === rule.dependsOn);
    if (!depField) return true;
    const depValue = dynamicValues[depField.fieldKey] || "";
    return depValue === rule.value;
  }

  const activeCompanyName = companies?.find(c => c.id === appUser?.activeCompanyId)?.name || "";

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      type: isPerson ? "person" : (clientType?.code === 'SZCO' ? "szco" : "company"),
      isActive: true,
      firstName: "",
      lastName: "",
      companyName: "",
      stateId: initialData.stateId,
      birthNumber: isPerson ? initialData.baseValue : undefined,
      details: !isPerson ? { ico: initialData.baseValue } : {},
      myCompanyId: appUser?.activeCompanyId || 0,
    },
  });

  const formResetDone = useRef(false);
  if (!formResetDone.current && clientType && state && appUser?.activeCompanyId) {
    formResetDone.current = true;
    form.reset({
      type: isPerson ? "person" : (clientType?.code === 'SZCO' ? "szco" : "company"),
      isActive: true,
      firstName: "",
      lastName: "",
      companyName: "",
      stateId: initialData.stateId,
      birthNumber: isPerson ? initialData.baseValue : undefined,
      details: !isPerson ? { ico: initialData.baseValue } : {},
      myCompanyId: appUser.activeCompanyId,
    });
  }

  if (statesLoading || typesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Nacitavam udaje...</p>
      </div>
    );
  }

  function onSubmit(data: z.infer<typeof createSchema>) {
    const DOC_KEYS = new Set(["typ_dokladu", "typ_dokladu_iny", "cislo_dokladu", "platnost_dokladu", "vydal_organ", "kod_vydavajuceho_organu"]);
    const CONTACT_KEYS = new Set(["telefon", "email", "rodne_cislo"]);
    const requiredFields = (typeFields || []).filter(f => f.isRequired && isFieldVisible(f));
    const missingFields = requiredFields.filter(f => !DOC_KEYS.has(f.fieldKey) && !CONTACT_KEYS.has(f.fieldKey) && !dynamicValues[f.fieldKey]?.trim());

    if (isPerson) {
      const addressRequired: { key: string; label: string }[] = [
        { key: "tp_ulica", label: "Ulica (trvalý pobyt)" },
        { key: "tp_orientacne", label: "Orientačné číslo (trvalý pobyt)" },
        { key: "tp_psc", label: "PSČ (trvalý pobyt)" },
        { key: "tp_mesto", label: "Mesto (trvalý pobyt)" },
      ];
      for (const ar of addressRequired) {
        if (!dynamicValues[ar.key]?.trim()) {
          missingFields.push({ fieldKey: ar.key, label: ar.label } as any);
        }
      }
      const hasValidDoc = documents.some(d => d.documentType?.trim() && d.documentNumber?.trim());
      if (!hasValidDoc) {
        missingFields.push({ fieldKey: "typ_dokladu", label: "Doklad totožnosti (typ a číslo)" } as any);
      }
      const rcValue = dynamicValues["rodne_cislo"]?.trim() || initialData.baseValue?.trim();
      if (!rcValue) {
        missingFields.push({ fieldKey: "rodne_cislo", label: "Rodné číslo" } as any);
      } else {
        const rcResult = validateSlovakRC(rcValue);
        if (!rcResult.valid) {
          missingFields.push({ fieldKey: "rodne_cislo", label: `Rodné číslo: ${rcResult.error}` } as any);
        }
      }
    }

    if (missingFields.length > 0) {
      setValidationErrors(new Set(missingFields.map(f => f.fieldKey)));
      toast({ title: "Chýbajúce povinné polia", description: missingFields.map(f => f.label || f.fieldKey).join(", "), variant: "destructive" });
      return;
    }
    setValidationErrors(new Set());

    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const existingDetails = (typeof data.details === "object" && data.details) ? data.details : {};
    const primaryPhone = contacts.find(c => c.type === "phone" && c.isPrimary)?.value || contacts.find(c => c.type === "phone")?.value || "";
    const primaryEmail = contacts.find(c => c.type === "email" && c.isPrimary)?.value || contacts.find(c => c.type === "email")?.value || "";
    const dynWithDocs = { ...dynamicValues, documents, contacts, telefon: primaryPhone };
    const mergedDetails = Object.keys(dynWithDocs).length > 0
      ? { ...(existingDetails as Record<string, any>), dynamicFields: dynWithDocs }
      : existingDetails;
    const submitData: any = { ...data, details: mergedDetails, processingTimeSec };
    if (primaryPhone) submitData.phone = primaryPhone;
    if (primaryEmail) submitData.email = primaryEmail;
    if (isPerson && dynamicValues.meno) submitData.firstName = dynamicValues.meno;
    if (isPerson && dynamicValues.priezvisko) submitData.lastName = dynamicValues.priezvisko;
    if (isSzcoType) {
      if (!szcoFoData.firstName || !szcoFoData.lastName) {
        toast({ title: "Chýbajúce osobné údaje", description: "Vyplňte meno a priezvisko majiteľa SZČO.", variant: "destructive" });
        return;
      }
      if (!szcoData.obchodne_meno) {
        toast({ title: "Chýbajúce obchodné údaje", description: "Vyplňte obchodné meno SZČO.", variant: "destructive" });
        return;
      }
      if (szcoData.ico) {
        const icoCheck = validateSlovakICO(szcoData.ico);
        if (!icoCheck.valid) {
          setSzcoIcoError(icoCheck.error || "Neplatné IČO");
          toast({ title: "Neplatné IČO", description: icoCheck.error || "Kontrolná číslica nesedí", variant: "destructive" });
          return;
        }
      }
      submitData.firstName = szcoFoData.firstName;
      submitData.lastName = szcoFoData.lastName;
      if (szcoFoData.birthNumber) submitData.birthNumber = szcoFoData.birthNumber;
      submitData.companyName = szcoData.obchodne_meno;
      submitData.type = "szco";
      if (szcoFoLinkedId) submitData.linkedFoId = szcoFoLinkedId;
      const existingDet = (typeof submitData.details === "object" && submitData.details) ? submitData.details as Record<string, any> : {};
      const dynFields = existingDet.dynamicFields || {};
      dynFields.ico = szcoData.ico;
      dynFields.dic = szcoData.dic;
      dynFields.ic_dph = szcoData.ic_dph;
      dynFields.miesto_podnikania = szcoData.miesto_podnikania;
      dynFields.register = szcoData.register;
      dynFields.szco_uid = szcoData.szco_uid;
      dynFields.fo_uid = szcoFoData.fo_uid;
      existingDet.dynamicFields = dynFields;
      existingDet.ico = szcoData.ico;
      submitData.details = existingDet;
    }
    mutate(submitData, {
      onSuccess: async (createdSubject: any) => {
        if (createdSubject?.existingSubject) {
          setExistingSubjectBanner(createdSubject.existingSubject);
          setPendingSubmitData(submitData);
          return;
        }
        if (createdSubject?.id && !isPerson) {
          const snapshotData = initialData.aresData || pendingRegistrySnapshot || (szcoAresLookup?.found ? szcoAresLookup : null);
          const snapshotSource = snapshotData?.source || "ORSR";
          if (snapshotData) {
            try {
              const icoVal = isSzcoType ? szcoData.ico : (dynamicValues.ico || initialData.baseValue);
              if (icoVal) {
                await apiRequest("POST", `/api/subjects/${createdSubject.id}/registry-snapshots`, {
                  source: snapshotSource,
                  ico: icoVal,
                  parsedFields: { name: snapshotData.name, street: snapshotData.street, streetNumber: snapshotData.streetNumber, zip: snapshotData.zip, city: snapshotData.city, legalForm: snapshotData.legalForm, dic: snapshotData.dic },
                  rawData: snapshotData,
                });
              }
            } catch {}
          }
        }
        onCancel();
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onCancel} data-testid="button-back-to-list">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Spat
        </Button>
        <div>
          <h2 className="text-xl font-bold">Novy klient - {clientType?.name || initialData.clientTypeCode}</h2>
          <p className="text-xs text-muted-foreground">
            {isPerson ? `RC: ${initialData.baseValue}` : `ICO: ${initialData.baseValue}`}
            {state ? ` | Stat: ${state.name}` : ""}
          </p>
        </div>
      </div>

      {existingSubjectBanner && (
        <div className="border border-yellow-500 bg-yellow-500/10 rounded p-3 flex items-start gap-3" data-testid="banner-existing-subject">
          <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-yellow-400">Subjekt už existuje v systéme</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Zhoda podľa: <span className="font-medium text-foreground">{existingSubjectBanner.matchedField}</span>
              {" — "}
              <span className="font-medium text-foreground">{existingSubjectBanner.name}</span>
              {existingSubjectBanner.uid && <span className="ml-1 text-xs text-muted-foreground font-mono">(UID: {formatUid(existingSubjectBanner.uid)})</span>}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Môžete otvoriť existujúci subjekt, registrovať aj tak, alebo upraviť zadané údaje.</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              <a href={`/subjects/${existingSubjectBanner.id}`} target="_blank" rel="noopener noreferrer">
                <Button type="button" variant="outline" size="sm" className="text-xs" data-testid="button-open-existing-subject">
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Otvoriť existujúci
                </Button>
              </a>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs border-yellow-500 text-yellow-400 hover:bg-yellow-500/20"
                data-testid="button-force-create-subject"
                disabled={isPending}
                onClick={() => {
                  if (!pendingSubmitData) return;
                  setExistingSubjectBanner(null);
                  mutate({ ...pendingSubmitData, _forceCreate: true }, {
                    onSuccess: async (result: any) => {
                      if (result?.id && !isPerson) {
                        const snapshotData = pendingRegistrySnapshot || (szcoAresLookup?.found ? szcoAresLookup : null);
                        if (snapshotData) {
                          try {
                            const icoVal = (pendingSubmitData.details as any)?.ico || (pendingSubmitData.details as any)?.dynamicFields?.ico;
                            if (icoVal) await apiRequest("POST", `/api/subjects/${result.id}/registry-snapshots`, { source: snapshotData.source || "ORSR", ico: icoVal, parsedFields: snapshotData, rawData: snapshotData });
                          } catch {}
                        }
                      }
                      onCancel();
                    },
                  });
                }}
              >
                Registrovať aj tak
              </Button>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setExistingSubjectBanner(null)} className="shrink-0 p-1 h-auto" data-testid="button-dismiss-existing-banner">
            <X className="w-4 h-4" />
          </Button>
        </div>
      )}

      {isSzcoType && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">SZČO - Obchodné údaje</span>
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">ID Subjektu (421...) *</Label>
                  <Input
                    value={szcoData.szco_uid}
                    onChange={e => setSzcoData(prev => ({ ...prev, szco_uid: e.target.value }))}
                    onBlur={async () => {
                      let val = szcoData.szco_uid.replace(/\s/g, '');
                      if (!val) return;
                      if (val.replace(/\D/g, '').length > 0 && val.replace(/\D/g, '').length < 15) {
                        val = smartPadUid(val, uidPrefix);
                        setSzcoData(prev => ({ ...prev, szco_uid: val }));
                      }
                      if (!val || val.length < 6) return;
                      try {
                        const resp = await fetch(`/api/subjects/by-uid/${encodeURIComponent(val)}`);
                        if (resp.ok) {
                          const existing = await resp.json();
                          if (existing && existing.type === "szco") {
                            const fullResp = await fetch(`/api/subjects/${existing.id}`);
                            if (fullResp.ok) {
                              const full = await fullResp.json();
                              const det = full.details || {};
                              setSzcoData(prev => ({
                                ...prev,
                                obchodne_meno: full.companyName || det.dynamicFields?.obchodne_meno || prev.obchodne_meno,
                                ico: det.ico || det.dynamicFields?.ico || prev.ico,
                                dic: det.dic || det.dynamicFields?.dic || prev.dic,
                                ic_dph: det.ic_dph || det.dynamicFields?.ic_dph || prev.ic_dph,
                                miesto_podnikania: det.miesto_podnikania || det.dynamicFields?.miesto_podnikania || prev.miesto_podnikania,
                                register: det.register || det.dynamicFields?.register || prev.register,
                              }));
                            }
                          }
                        }
                      } catch {}
                    }}
                    placeholder="421XXXXXXXXX"
                    className="font-mono"
                    data-testid="input-szco-uid"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Obchodné meno *</Label>
                  <Input
                    value={szcoData.obchodne_meno}
                    onChange={e => setSzcoData(prev => ({ ...prev, obchodne_meno: e.target.value }))}
                    data-testid="input-szco-obchodne-meno"
                  />
                </div>
                <div className="space-y-1 w-[160px] min-w-[120px]">
                  <Label className={`text-xs ${szcoIcoError ? "text-red-500" : "text-muted-foreground"}`}>IČO *</Label>
                  <Input
                    value={szcoData.ico}
                    onChange={e => {
                      setSzcoData(prev => ({ ...prev, ico: e.target.value }));
                      if (szcoIcoError) {
                        const r = validateSlovakICO(e.target.value);
                        if (r.valid) { setSzcoIcoError(null); }
                      }
                    }}
                    onBlur={() => {
                      const val = szcoData.ico.trim();
                      if (!val) { setSzcoIcoError(null); setSzcoAresLookup(null); return; }
                      const result = validateSlovakICO(val);
                      if (!result.valid) {
                        setSzcoIcoError(result.error || "Neplatné IČO");
                        setSzcoAresLookup(null);
                        return;
                      }
                      setSzcoIcoError(null);
                      if (result.normalized) setSzcoData(prev => ({ ...prev, ico: result.normalized! }));
                      setSzcoAresLoading(true);
                      fetch(`/api/lookup/ico/${encodeURIComponent(result.normalized || val)}?type=szco`, { credentials: "include" })
                        .then(r => r.json())
                        .then(data => {
                          if (data.found) {
                            setSzcoAresLookup(data);
                          } else {
                            setSzcoAresLookup({ found: false, message: data.message });
                          }
                        })
                        .catch(() => setSzcoAresLookup({ found: false, message: "Chyba registrov" }))
                        .finally(() => setSzcoAresLoading(false));
                    }}
                    className={szcoIcoError ? "border-red-500 focus-visible:ring-red-500 font-mono" : "font-mono"}
                    data-testid="input-szco-ico"
                  />
                  {szcoIcoError && <p className="text-[10px] text-red-500 leading-tight" data-testid="text-szco-ico-error">{szcoIcoError}</p>}
                  {szcoAresLoading && (
                    <div className="flex items-center gap-2 mt-1" data-testid="text-szco-registry-loading">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                      <span className="text-xs text-blue-400">Preberám údaje z registra...</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1 w-[160px] min-w-[120px]">
                  <Label className="text-xs text-muted-foreground">DIČ</Label>
                  <Input
                    value={szcoData.dic}
                    onChange={e => setSzcoData(prev => ({ ...prev, dic: e.target.value }))}
                    data-testid="input-szco-dic"
                  />
                </div>
                <div className="space-y-1 w-[160px] min-w-[120px]">
                  <Label className="text-xs text-muted-foreground">IČ DPH</Label>
                  <Input
                    value={szcoData.ic_dph}
                    onChange={e => setSzcoData(prev => ({ ...prev, ic_dph: e.target.value }))}
                    data-testid="input-szco-ic-dph"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Miesto podnikania</Label>
                  <Input
                    value={szcoData.miesto_podnikania}
                    onChange={e => setSzcoData(prev => ({ ...prev, miesto_podnikania: e.target.value }))}
                    data-testid="input-szco-miesto"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[200px]">
                  <Label className="text-xs text-muted-foreground">Register</Label>
                  <Input
                    value={szcoData.register}
                    onChange={e => setSzcoData(prev => ({ ...prev, register: e.target.value }))}
                    data-testid="input-szco-register"
                  />
                </div>
              </div>
              {szcoAresLookup?.found && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-md p-3 space-y-2" data-testid="szco-ares-lookup-result">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-xs font-semibold text-blue-400">{szcoAresLookup.source === "ORSR" ? "Obchodný register SR" : szcoAresLookup.source === "ZRSR" ? "Živnostenský register SR" : "ARES Register"}</span>
                  </div>
                  {szcoAresLookup.name && <p className="text-sm font-medium">{szcoAresLookup.name}</p>}
                  {(szcoAresLookup.street || szcoAresLookup.city) && (
                    <p className="text-xs text-muted-foreground">
                      {[szcoAresLookup.street, szcoAresLookup.streetNumber].filter(Boolean).join(" ")}
                      {(szcoAresLookup.street || szcoAresLookup.streetNumber) && (szcoAresLookup.zip || szcoAresLookup.city) ? ", " : ""}
                      {[szcoAresLookup.zip, szcoAresLookup.city].filter(Boolean).join(" ")}
                    </p>
                  )}
                  {szcoAresLookup.legalForm && <p className="text-[10px] text-muted-foreground">{szcoAresLookup.legalForm}{szcoAresLookup.dic ? ` | DIČ: ${szcoAresLookup.dic}` : ""}</p>}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setPendingRegistrySnapshot({
                        name: szcoAresLookup.name,
                        street: szcoAresLookup.street,
                        streetNumber: szcoAresLookup.streetNumber,
                        zip: szcoAresLookup.zip,
                        city: szcoAresLookup.city,
                        legalForm: szcoAresLookup.legalForm,
                        dic: szcoAresLookup.dic,
                        source: szcoAresLookup.source,
                      });
                      setSzcoData(prev => ({
                        ...prev,
                        obchodne_meno: szcoAresLookup.name || prev.obchodne_meno,
                        dic: szcoAresLookup.dic || prev.dic,
                        miesto_podnikania: [szcoAresLookup.street, szcoAresLookup.streetNumber, szcoAresLookup.zip, szcoAresLookup.city].filter(Boolean).join(", ") || prev.miesto_podnikania,
                      }));
                      setSzcoAresLookup(null);
                    }}
                    data-testid="button-szco-ares-use"
                  >
                    Použiť údaje z registra
                  </Button>
                </div>
              )}
              {szcoAresLookup && !szcoAresLookup.found && !szcoIcoError && (
                <p className="text-xs text-muted-foreground">{szcoAresLookup.message}</p>
              )}
            </CardContent>
          </Card>

          <Card className="mb-4">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Fyzická osoba (Majiteľ SZČO)</span>
                {szcoFoLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                {szcoFoLinkedId && (
                  <Badge variant="outline" className="text-xs ml-auto">
                    <Link2 className="w-3 h-3 mr-1" />
                    Prepojená FO #{szcoFoLinkedId}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <div className="space-y-1 w-[180px] min-w-[140px]">
                  <Label className="text-xs text-muted-foreground">ID Subjektu FO (421...)</Label>
                  <Input
                    value={szcoFoData.fo_uid}
                    onChange={e => setSzcoFoData(prev => ({ ...prev, fo_uid: e.target.value }))}
                    onBlur={async () => {
                      let val = szcoFoData.fo_uid.replace(/\s/g, '');
                      if (!val) return;
                      if (val.replace(/\D/g, '').length > 0 && val.replace(/\D/g, '').length < 15) {
                        val = smartPadUid(val, uidPrefix);
                        setSzcoFoData(prev => ({ ...prev, fo_uid: val }));
                      }
                      if (!val || val.length < 6) return;
                      setSzcoFoLoading(true);
                      try {
                        const resp = await fetch(`/api/subjects/search-fo?q=${encodeURIComponent(val)}`);
                        const data = await resp.json();
                        const match = data.find((fo: any) => fo.uid === val);
                        if (match) {
                          setSzcoFoData({ firstName: match.firstName || "", lastName: match.lastName || "", birthNumber: match.birthNumber || "", fo_uid: match.uid });
                          setSzcoFoLinkedId(match.id);
                        }
                      } catch {}
                      setSzcoFoLoading(false);
                    }}
                    placeholder="421XXXXXXXXX"
                    className="font-mono"
                    data-testid="input-szco-fo-uid"
                  />
                </div>
                <div className="space-y-1 flex-1 min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">Meno *</Label>
                  <Input
                    value={szcoFoData.firstName}
                    onChange={e => {
                      const raw = e.target.value;
                      setSzcoFoData(prev => ({ ...prev, firstName: capitalizeFirst(raw) }));
                    }}
                    data-testid="input-szco-firstname"
                  />
                  {szcoFoData.firstName && szcoFoData.firstName !== szcoFoData.firstName.charAt(0).toUpperCase() + szcoFoData.firstName.slice(1) && (
                    <p className="text-[10px] text-red-500">Meno opravene na velke zaciatocne pismeno</p>
                  )}
                </div>
                <div className="space-y-1 flex-1 min-w-[150px]">
                  <Label className="text-xs text-muted-foreground">Priezvisko *</Label>
                  <Input
                    value={szcoFoData.lastName}
                    onChange={e => {
                      const raw = e.target.value;
                      setSzcoFoData(prev => ({ ...prev, lastName: capitalizeFirst(raw) }));
                    }}
                    data-testid="input-szco-lastname"
                  />
                  {szcoFoData.lastName && szcoFoData.lastName !== szcoFoData.lastName.charAt(0).toUpperCase() + szcoFoData.lastName.slice(1) && (
                    <p className="text-[10px] text-red-500">Priezvisko opravene na velke zaciatocne pismeno</p>
                  )}
                </div>
                <div className="space-y-1 w-[180px] min-w-[140px]">
                  <Label className="text-xs text-muted-foreground">Rodné číslo</Label>
                  <Input
                    value={szcoFoData.birthNumber}
                    onChange={e => {
                      setSzcoFoData(prev => ({ ...prev, birthNumber: e.target.value }));
                      if (szcoFoRcError) {
                        const result = validateSlovakRC(e.target.value);
                        if (result.valid) setSzcoFoRcError(null);
                      }
                    }}
                    onBlur={async () => {
                      const val = szcoFoData.birthNumber.trim().replace(/[\s\/]/g, "");
                      if (!val || val.length < 6) { setSzcoFoRcError(null); return; }
                      const rcResult = validateSlovakRC(val);
                      if (!rcResult.valid) {
                        setSzcoFoRcError(rcResult.error || "Neplatné rodné číslo");
                        return;
                      }
                      setSzcoFoRcError(null);
                      setSzcoFoLoading(true);
                      try {
                        const resp = await fetch(`/api/subjects/search-fo?q=${encodeURIComponent(val)}`);
                        const data = await resp.json();
                        if (data.length === 1) {
                          const fo = data[0];
                          setSzcoFoData({ firstName: fo.firstName || "", lastName: fo.lastName || "", birthNumber: fo.birthNumber || "", fo_uid: fo.uid });
                          setSzcoFoLinkedId(fo.id);
                        }
                      } catch {}
                      setSzcoFoLoading(false);
                    }}
                    placeholder="XXXXXX/XXXX"
                    className={szcoFoRcError ? "border-red-500 focus-visible:ring-red-500" : ""}
                    data-testid="input-szco-rc"
                  />
                  {szcoFoRcError && (
                    <p className="text-[10px] text-red-500" data-testid="text-szco-rc-error">{szcoFoRcError}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

              {isPerson ? (() => {
                const FO_POVINNE_ROWS: { keys: string[] }[] = [
                  { keys: ["titul_pred", "meno", "priezvisko", "titul_za"] },
                  { keys: ["rodne_priezvisko", "datum_narodenia", "vek", "pohlavie"] },
                  { keys: ["miesto_narodenia", "statna_prislusnost"] },
                ];

                const DOCUMENT_TYPES = ["Občiansky preukaz", "Cestovný pas", "Vodičský preukaz", "Povolenie na pobyt", "Preukaz diplomata", "Iný"];

                const addNewDocument = () => {
                  const newDoc: DocumentEntry = {
                    id: crypto.randomUUID(),
                    documentType: "",
                    documentNumber: "",
                    validUntil: "",
                    issuedBy: "",
                    issuingAuthorityCode: "",
                  };
                  setDocuments(prev => [...prev, newDoc]);
                };

                const updateDocument = (docId: string, field: keyof DocumentEntry, value: string) => {
                  setDocuments(prev => prev.map(d => d.id === docId ? { ...d, [field]: value } : d));
                };

                const removeDocument = (docId: string) => {
                  setDocuments(prev => prev.filter(d => d.id !== docId));
                };

                const isDocExpired = (validUntil?: string) => getDocumentValidityStatus(validUntil).status === "expired";
                const isDocExpiringSoon = (validUntil?: string) => getDocumentValidityStatus(validUntil).status === "expiring";

                const getFieldWidthClass = (fieldKey: string): string => {
                  switch (fieldKey) {
                    case "titul_pred":
                    case "titul_za":
                      return "w-[100px] min-w-[80px] shrink-0";
                    case "vek":
                      return "w-[80px] min-w-[60px] shrink-0";
                    case "pohlavie":
                      return "w-[130px] min-w-[100px] shrink-0";
                    case "datum_narodenia":
                    case "platnost_dokladu":
                      return "w-[160px] min-w-[140px] shrink-0";
                    case "meno":
                    case "priezvisko":
                    case "rodne_priezvisko":
                      return "flex-1 min-w-[150px]";
                    default:
                      return "flex-1 min-w-[140px]";
                  }
                };

                const ADDRESS_PANEL_FIELDS = {
                  tp: { label: "Adresa trvalého pobytu", keys: ["tp_ulica", "tp_supisne", "tp_orientacne", "tp_psc", "tp_mesto", "tp_stat"], requiredKeys: ["tp_ulica", "tp_orientacne", "tp_psc", "tp_mesto"] },
                  ka: { label: "Adresa prechodného pobytu", keys: ["ka_ulica", "ka_supisne", "ka_orientacne", "ka_psc", "ka_mesto", "ka_stat"], requiredKeys: [] },
                  koa: { label: "Kontaktná adresa", keys: ["koa_ulica", "koa_supisne", "koa_orientacne", "koa_psc", "koa_mesto", "koa_stat"], requiredKeys: [] },
                };
                const ADDRESS_SWITCH_KEYS = ["korespond_rovnaka", "kontaktna_rovnaka"];
                const allAddressKeys = new Set([
                  ...Object.values(ADDRESS_PANEL_FIELDS).flatMap(p => p.keys),
                  ...ADDRESS_SWITCH_KEYS,
                ]);

                const DOC_FIELD_KEYS = ["typ_dokladu", "typ_dokladu_iny", "cislo_dokladu", "platnost_dokladu", "vydal_organ", "kod_vydavajuceho_organu"];
                const CONTACT_FIELD_KEYS = ["telefon", "email", "rodne_cislo"];
                const allRowKeys = new Set(FO_POVINNE_ROWS.flatMap(r => r.keys).concat(Array.from(allAddressKeys)).concat(CONTACT_FIELD_KEYS).concat(DOC_FIELD_KEYS));

                const povinneSection = typeSections?.find(s => (s as any).folderCategory === "povinne");
                const povinneFields = (typeFields || [])
                  .filter(f => povinneSection && (f.sectionId || 0) === povinneSection.id)
                  .filter(f => isFieldVisible(f));
                const povinneRemainder = povinneFields.filter(f => !allRowKeys.has(f.fieldKey)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

                const nonPovinneGroups: { section: any; fields: StaticField[] }[] = [];
                const sectionsSorted = [...(typeSections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                for (const section of sectionsSorted) {
                  const category = (section as any).folderCategory || "volitelne";
                  if (category === "povinne") continue;
                  const sectionFields = (typeFields || [])
                    .filter(f => (f.sectionId || 0) === section.id)
                    .filter(f => isFieldVisible(f))
                    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                  if (sectionFields.length > 0) {
                    nonPovinneGroups.push({ section, fields: sectionFields });
                  }
                }

                return (
                  <>
                    <Accordion type="multiple" defaultValue={["povinne", "doplnkove", "volitelne"]} className="space-y-2">
                      <AccordionItem value="povinne" className="border rounded-md px-3" data-testid="editor-accordion-povinne">
                        <AccordionTrigger className="py-3 hover:no-underline">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-destructive" />
                            <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS["povinne"]}</span>
                            <Badge variant="secondary" className="text-[10px]">{povinneFields.length + 3}</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-4 space-y-2">
                          <div className="flex flex-wrap gap-4 items-end" data-testid="row-system-fields">
                            <div className="space-y-1 w-[200px] min-w-[160px] shrink-0">
                              <Label className="text-xs">Kód klienta</Label>
                              <Input value="Automaticky generovaný" disabled className="font-mono text-xs" data-testid="input-kod-klienta" />
                            </div>
                            <div className="space-y-1 w-[200px] min-w-[160px] shrink-0">
                              <Label className="text-xs">Typ klienta</Label>
                              <Input value={clientType?.name || "Fyzická osoba"} disabled data-testid="input-typ-klienta" />
                            </div>
                            <div className="space-y-1 flex-1 min-w-[180px]">
                              <Label className="text-xs">Identifikátor (Rodné číslo)</Label>
                              <Input value={initialData.baseValue} disabled className="font-mono" data-testid="input-identifikator" />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-4 items-end" data-testid="row-ziskatel">
                            <div className="space-y-1 w-[250px] min-w-[200px]">
                              <Label className="text-xs">Získateľ</Label>
                              <Input
                                value={appUser ? `${appUser.firstName || ""} ${appUser.lastName || ""}`.trim() || appUser.username : ""}
                                disabled
                                data-testid="input-ziskatel"
                              />
                            </div>
                          </div>

                          <Card data-testid="panel-osobne-udaje">
                            <CardContent className="p-4 space-y-2">
                              <p className="text-sm font-semibold">Osobné údaje</p>
                              {FO_POVINNE_ROWS.map((row, rowIdx) => {
                                const rowEntries = row.keys
                                  .map(k => ({ key: k, field: povinneFields.find(f => f.fieldKey === k) }));
                                const hasAny = rowEntries.some(e => e.field) || rowEntries.some(e => e.key === "statna_prislusnost");
                                if (!hasAny || rowEntries.length === 0) return null;
                                return (
                                  <div key={rowIdx} className="flex flex-wrap gap-4 items-end" data-testid={`row-povinne-${rowIdx + 3}`}>
                                    {rowEntries.map(({ key, field }) => {
                                      const widthClass = getFieldWidthClass(key);
                                      if (key === "statna_prislusnost") {
                                        const label = field?.label || "Štátna príslušnosť";
                                        const shortLbl = field?.shortLabel;
                                        const isReq = field?.isRequired;
                                        const hasErr = validationErrors.has(key);
                                        const prioritySet = new Set(PRIORITY_COUNTRY_NAMES);
                                        const restCountries = ALL_COUNTRY_NAMES.filter(c => !prioritySet.has(c));
                                        return (
                                          <div key={key} className={cn("space-y-1 min-w-0", widthClass)}>
                                            <Label className={`text-xs block ${hasErr ? "text-red-500" : "text-muted-foreground"}`}>
                                              {shortLbl ? (
                                                <>
                                                  <span className="hidden lg:inline">{label}</span>
                                                  <span className="inline lg:hidden">{shortLbl}</span>
                                                </>
                                              ) : label}
                                              {isReq ? " *" : ""}
                                            </Label>
                                            <Popover>
                                              <PopoverTrigger asChild>
                                                <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", hasErr && "border-red-500 ring-1 ring-red-500", !dynamicValues[key] && "text-muted-foreground")} data-testid="select-statna-prislusnost">
                                                  <span className="truncate">{dynamicValues[key] || ""}</span>
                                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                              </PopoverTrigger>
                                              <PopoverContent className="w-[300px] p-0" align="start">
                                                <Command>
                                                  <CommandInput placeholder="Hľadať krajinu..." />
                                                  <CommandList>
                                                    <CommandEmpty>Krajina nenájdená.</CommandEmpty>
                                                    <CommandGroup heading="Prioritné">
                                                      {PRIORITY_COUNTRY_NAMES.map(c => (
                                                        <CommandItem key={c} value={c} onSelect={() => { setDynamicValues(prev => ({ ...prev, [key]: c })); if (hasErr) setValidationErrors(prev => { const n = new Set(prev); n.delete(key); return n; }); }}>
                                                          <Check className={cn("mr-2 h-4 w-4", dynamicValues[key] === c ? "opacity-100" : "opacity-0")} />
                                                          {c}
                                                        </CommandItem>
                                                      ))}
                                                    </CommandGroup>
                                                    <CommandGroup heading="Všetky krajiny">
                                                      {restCountries.map(c => (
                                                        <CommandItem key={c} value={c} onSelect={() => { setDynamicValues(prev => ({ ...prev, [key]: c })); if (hasErr) setValidationErrors(prev => { const n = new Set(prev); n.delete(key); return n; }); }}>
                                                          <Check className={cn("mr-2 h-4 w-4", dynamicValues[key] === c ? "opacity-100" : "opacity-0")} />
                                                          {c}
                                                        </CommandItem>
                                                      ))}
                                                    </CommandGroup>
                                                  </CommandList>
                                                </Command>
                                              </PopoverContent>
                                            </Popover>
                                          </div>
                                        );
                                      }
                                      const rcSource = dynamicValues["rodne_cislo"]?.trim() || initialData.baseValue?.trim() || "";
                                      const rcParsedResult = rcSource ? parseRodneCislo(rcSource) : {};
                                      const isRcAuto = (key === "pohlavie" && !!rcParsedResult.pohlavie) || (key === "datum_narodenia" && !!rcParsedResult.datumNarodenia) || (key === "vek" && !!rcParsedResult.datumNarodenia);
                                      const rawFieldDef = (typeFields || []).find(f => f.fieldKey === key);
                                      const hasVisibilityRule = rawFieldDef?.visibilityRule;
                                      const isVisibleByRule = hasVisibilityRule ? isFieldVisible(rawFieldDef!) : true;
                                      const resolvedField = field || (hasVisibilityRule ? rawFieldDef : null);
                                      if (resolvedField) {
                                        return (
                                          <div key={key} className={cn("space-y-1 min-w-0", widthClass)} style={!isVisibleByRule ? { display: "none" } : undefined}>
                                            <Label className={`text-xs block ${key === "typ_dokladu_iny" && !dynamicValues[key] ? "text-orange-500 font-semibold" : validationErrors.has(key) ? "text-red-500" : "text-muted-foreground"}`}>
                                              {key === "typ_dokladu_iny" ? (
                                                <span>Uveďte typ dokladu *</span>
                                              ) : resolvedField.shortLabel ? (
                                                <>
                                                  <span className="hidden lg:inline">{resolvedField.label || key}</span>
                                                  <span className="inline lg:hidden">{resolvedField.shortLabel}</span>
                                                </>
                                              ) : (
                                                <span>{resolvedField.label || key}</span>
                                              )}
                                              {key !== "typ_dokladu_iny" && resolvedField.isRequired ? " *" : ""}
                                            </Label>
                                            {resolvedField.fieldType === "number" && resolvedField.fieldKey === "vek" ? (
                                              <div className="h-9 w-full flex items-center px-3 rounded-md bg-muted/50 border border-border text-sm font-medium text-foreground cursor-default select-none whitespace-nowrap" data-testid={`input-dynamic-${resolvedField.fieldKey}`}>
                                                {dynamicValues[resolvedField.fieldKey] ? `${dynamicValues[resolvedField.fieldKey]} rokov` : ""}
                                              </div>
                                            ) : resolvedField.fieldType === "jedna_moznost" && resolvedField.fieldKey === "pohlavie" ? (
                                              <>
                                                <div style={{ display: isRcAuto ? undefined : "none" }} className="h-9 w-full flex items-center px-3 rounded-md bg-muted/50 border border-border text-sm font-medium text-foreground cursor-default select-none whitespace-nowrap" data-testid={`display-dynamic-${resolvedField.fieldKey}`}>
                                                  {dynamicValues[resolvedField.fieldKey] === "muž" ? "Muž" : dynamicValues[resolvedField.fieldKey] === "žena" ? "Žena" : dynamicValues[resolvedField.fieldKey] || ""}
                                                </div>
                                                <div style={{ display: isRcAuto ? "none" : undefined }}>
                                                  <Select value={dynamicValues[resolvedField.fieldKey] || ""} onValueChange={val => setDynamicValues(prev => ({ ...prev, [resolvedField.fieldKey]: val }))}>
                                                    <SelectTrigger className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""} data-testid={`select-dynamic-${resolvedField.fieldKey}`}>
                                                      <SelectValue placeholder="" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                      {(resolvedField.options || []).map((opt: string) => (
                                                        <SelectItem key={opt} value={opt}>{opt === "muž" ? "Muž" : opt === "žena" ? "Žena" : opt}</SelectItem>
                                                      ))}
                                                    </SelectContent>
                                                  </Select>
                                                </div>
                                              </>
                                            ) : resolvedField.fieldType === "jedna_moznost" ? (
                                              <Select value={dynamicValues[resolvedField.fieldKey] || ""} onValueChange={val => setDynamicValues(prev => ({ ...prev, [resolvedField.fieldKey]: val }))}>
                                                <SelectTrigger className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""} data-testid={`select-dynamic-${resolvedField.fieldKey}`}>
                                                  <SelectValue placeholder="" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {(resolvedField.options || []).map((opt: string) => (
                                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                            ) : resolvedField.fieldType === "date" ? (
                                              (() => {
                                                const dateVal = dynamicValues[resolvedField.fieldKey] || "";
                                                let validityClass = "";
                                                let validityLabel = "";
                                                if (resolvedField.fieldKey === "platnost_dokladu" && dateVal) {
                                                  const expiry = new Date(dateVal);
                                                  const now = new Date();
                                                  const threeMonths = new Date();
                                                  threeMonths.setMonth(threeMonths.getMonth() + 3);
                                                  if (expiry < now) {
                                                    validityClass = "border-red-500 bg-red-500/10 ring-1 ring-red-500";
                                                    validityLabel = "Neplatný";
                                                  } else if (expiry < threeMonths) {
                                                    validityClass = "border-orange-500 bg-orange-500/10 ring-1 ring-orange-500";
                                                    validityLabel = "Končiaci";
                                                  }
                                                }
                                                return (
                                                  <div className="relative">
                                                    <Input
                                                      type="date"
                                                      value={dateVal}
                                                      onChange={e => { if (isRcAuto) return; setDynamicValues(prev => ({ ...prev, [resolvedField.fieldKey]: e.target.value })); }}
                                                      readOnly={isRcAuto}
                                                      tabIndex={isRcAuto ? -1 : undefined}
                                                      className={cn(validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : validityClass, isRcAuto && "bg-muted/50 cursor-default", validityLabel && "pr-[5.5rem]")}
                                                      data-testid={`input-dynamic-${resolvedField.fieldKey}`}
                                                    />
                                                    {validityLabel && (
                                                      <span className={cn(
                                                        "absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-semibold pointer-events-none select-none",
                                                        validityLabel === "Neplatný" ? "text-red-500" : "text-orange-500"
                                                      )} data-testid={`validity-status-${resolvedField.fieldKey}`}>
                                                        {validityLabel}
                                                      </span>
                                                    )}
                                                  </div>
                                                );
                                              })()
                                            ) : key === "typ_dokladu_iny" ? (
                                              <Input
                                                placeholder="Napr. Preukaz diplomata"
                                                value={dynamicValues[key] || ""}
                                                onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                className={dynamicValues[key] ? "" : "border-orange-500 ring-1 ring-orange-500 bg-orange-500/5"}
                                                data-testid={`input-${key}`}
                                              />
                                            ) : (
                                              <Input
                                                placeholder=""
                                                value={dynamicValues[key] || ""}
                                                onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))}
                                                className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""}
                                                data-testid={`input-${key}`}
                                              />
                                            )}
                                          </div>
                                        );
                                      }
                                      return (
                                        <div key={key} className={cn("space-y-1 min-w-0", widthClass)}>
                                          <Label className={`text-xs block text-muted-foreground ${validationErrors.has(key) ? "text-red-500" : ""}`}>{key}</Label>
                                          <Input placeholder="" value={dynamicValues[key] || ""} onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))} className={validationErrors.has(key) ? "border-red-500 ring-1 ring-red-500" : ""} data-testid={`input-${key}`} />
                                        </div>
                                      );
                                    })}
                                  </div>
                                );
                              })}
                            </CardContent>
                          </Card>

                          <Card data-testid="panel-doklady-totoznosti">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <CreditCard className="w-4 h-4 text-primary" />
                                  <p className="text-sm font-semibold">Doklady totožnosti</p>
                                  <Badge variant="secondary" className="text-[10px]">{documents.length}</Badge>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addNewDocument} data-testid="button-add-document">
                                  <Plus className="w-3 h-3 mr-1" />
                                  Pridať doklad
                                </Button>
                              </div>

                              {documents.length === 0 && (
                                <div className="text-center py-6 text-muted-foreground" data-testid="text-no-documents">
                                  <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                  <p className="text-sm">Žiadne doklady totožnosti</p>
                                  <p className="text-xs">Kliknite "Pridať doklad" pre pridanie dokladu</p>
                                </div>
                              )}

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                                {documents.map((doc, docIdx) => {
                                  const expired = isDocExpired(doc.validUntil);
                                  const expiringSoon = isDocExpiringSoon(doc.validUntil);
                                  const borderColor = expired ? "border-red-500/50" : expiringSoon ? "border-orange-500/50" : "border-border";
                                  return (
                                    <Card key={doc.id} className={cn("relative", borderColor)} data-testid={`card-document-${docIdx}`}>
                                      <CardContent className="p-3 space-y-2">
                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                          <div className="flex items-center gap-1.5">
                                            {expired && <Badge variant="destructive" className="text-[10px]">Expirovaný</Badge>}
                                            {expiringSoon && !expired && <Badge className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/30">Expiruje čoskoro</Badge>}
                                            {!expired && !expiringSoon && doc.validUntil && <Badge variant="secondary" className="text-[10px]">Platný</Badge>}
                                          </div>
                                          <Button type="button" variant="ghost" size="icon" onClick={() => removeDocument(doc.id)} data-testid={`button-remove-document-${docIdx}`}>
                                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                          </Button>
                                        </div>

                                        <div className="flex flex-wrap gap-3 items-end">
                                          <div className="space-y-1 flex-1 min-w-[140px]">
                                            <Label className="text-xs text-muted-foreground">Typ dokladu *</Label>
                                            <Select value={doc.documentType || ""} onValueChange={val => updateDocument(doc.id, "documentType", val)}>
                                              <SelectTrigger data-testid={`select-doc-type-${docIdx}`}>
                                                <SelectValue placeholder="Vyberte typ" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {DOCUMENT_TYPES.map(t => (
                                                  <SelectItem key={t} value={t}>{t}</SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          {doc.documentType === "Iný" && (
                                            <div className="space-y-1 flex-1 min-w-[140px]">
                                              <Label className={cn("text-xs", !doc.customDocType ? "text-orange-500 font-semibold" : "text-muted-foreground")}>Špecifikácia dokladu *</Label>
                                              <Input
                                                value={doc.customDocType || ""}
                                                onChange={e => updateDocument(doc.id, "customDocType", e.target.value)}
                                                placeholder="Uveďte typ dokladu"
                                                className={!doc.customDocType ? "border-orange-500/50" : ""}
                                                data-testid={`input-doc-custom-type-${docIdx}`}
                                              />
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex flex-wrap gap-3 items-end">
                                          <div className="space-y-1 flex-1 min-w-[140px]">
                                            <Label className="text-xs text-muted-foreground">Číslo dokladu *</Label>
                                            <Input
                                              value={doc.documentNumber || ""}
                                              onChange={e => updateDocument(doc.id, "documentNumber", e.target.value)}
                                              data-testid={`input-doc-number-${docIdx}`}
                                            />
                                          </div>
                                          <div className="space-y-1 w-[160px] min-w-[140px] shrink-0">
                                            <Label className={cn("text-xs", expired ? "text-red-500 font-semibold" : expiringSoon ? "text-orange-500" : "text-muted-foreground")}>Platnosť do</Label>
                                            <Input
                                              type="date"
                                              value={doc.validUntil || ""}
                                              onChange={e => updateDocument(doc.id, "validUntil", e.target.value)}
                                              className={expired ? "border-red-500/50" : expiringSoon ? "border-orange-500/50" : ""}
                                              data-testid={`input-doc-valid-${docIdx}`}
                                            />
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap gap-3 items-end">
                                          <div className="space-y-1 flex-1 min-w-[140px]">
                                            <Label className="text-xs text-muted-foreground">Vydávajúci orgán</Label>
                                            <Input
                                              value={doc.issuedBy || ""}
                                              onChange={e => updateDocument(doc.id, "issuedBy", e.target.value)}
                                              data-testid={`input-doc-issued-${docIdx}`}
                                            />
                                          </div>
                                          <div className="space-y-1 flex-1 min-w-[120px]">
                                            <Label className="text-xs text-muted-foreground">Kód orgánu</Label>
                                            <Input
                                              value={doc.issuingAuthorityCode || ""}
                                              onChange={e => updateDocument(doc.id, "issuingAuthorityCode", e.target.value)}
                                              data-testid={`input-doc-authority-${docIdx}`}
                                            />
                                          </div>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              </div>
                            </CardContent>
                          </Card>

                          {(() => {
                            const korRespondRovnaka = dynamicValues["korespond_rovnaka"] === "true";
                            const kontaktnaRovnaka = dynamicValues["kontaktna_rovnaka"] === "true";

                            const ADDR_FALLBACK_LABELS: Record<string, string> = {
                              ulica: "Ulica", supisne: "Súpisné číslo", orientacne: "Orientačné číslo",
                              psc: "PSČ", mesto: "Mesto", stat: "Štát",
                            };

                            const isAddrFieldHidden = (_key: string) => false;

                            const renderAddressPanel = (prefix: "tp" | "ka" | "koa", panelDef: typeof ADDRESS_PANEL_FIELDS["tp"], disabled: boolean) => {
                              const findField = (key: string) => povinneFields.find(f => f.fieldKey === key);
                              const fieldKeys = [`${prefix}_ulica`, `${prefix}_supisne`, `${prefix}_orientacne`, `${prefix}_psc`, `${prefix}_mesto`, `${prefix}_stat`];
                              const fields = fieldKeys.map(k => ({ key: k, field: findField(k), suffix: k.split("_").slice(1).join("_"), hidden: isAddrFieldHidden(k) }));
                              const visibleFields = fields.filter(f => !f.hidden);
                              const isRequired = (key: string) => panelDef.requiredKeys.includes(key);

                              if (visibleFields.length === 0) return null;

                              const ADDR_SHORT_LABELS: Record<string, string> = {
                                ulica: "Ulica", supisne: "Súpisné č.", orientacne: "Orient. č.",
                                psc: "PSČ", mesto: "Obec / Mesto", stat: "Štát",
                              };

                              const renderAddrField = (key: string, field: StaticField | undefined, suffix: string, widthPct?: number) => {
                                const label = ADDR_SHORT_LABELS[suffix] || ADDR_FALLBACK_LABELS[suffix] || suffix;
                                const req = isRequired(key);
                                const hasErr = validationErrors.has(key);
                                const wrapStyle = widthPct ? { flex: `0 1 ${widthPct}%`, minWidth: 0 } : {};
                                return (
                                  <div key={key} style={{ ...wrapStyle, pointerEvents: disabled ? "none" : "auto" }}>
                                    <div className="space-y-1">
                                      <Label className={`text-xs truncate block ${hasErr ? "text-red-500" : "text-muted-foreground"}`}>{label}{req ? " *" : ""}</Label>
                                      <Input
                                        disabled={disabled}
                                        value={dynamicValues[key] || ""}
                                        onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))}
                                        className={hasErr ? "border-red-500 ring-1 ring-red-500" : ""}
                                        data-testid={`input-addr-${key}`}
                                      />
                                    </div>
                                  </div>
                                );
                              };

                              const getF = (suffix: string) => visibleFields.find(f => f.suffix === suffix);
                              const fUlica = getF("ulica");
                              const fSupisne = getF("supisne");
                              const fOrientacne = getF("orientacne");
                              const fPsc = getF("psc");
                              const fMesto = getF("mesto");
                              const fStat = getF("stat");

                              return (
                                <Card className={`${disabled ? "opacity-50 pointer-events-none" : ""}`} data-testid={`panel-address-${prefix}`}>
                                  <CardContent className="p-4 space-y-2">
                                    <p className="text-sm font-semibold truncate" title={panelDef.label}>{panelDef.label}</p>
                                    {fUlica && (
                                      <div data-testid={`addr-row-ulica-${prefix}`}>
                                        {renderAddrField(fUlica.key, fUlica.field, fUlica.suffix)}
                                      </div>
                                    )}
                                    {(fSupisne || fOrientacne) && (
                                      <div className="flex flex-nowrap items-end gap-2" data-testid={`addr-row-cisla-${prefix}`}>
                                        {fSupisne && renderAddrField(fSupisne.key, fSupisne.field, fSupisne.suffix, 50)}
                                        {fOrientacne && renderAddrField(fOrientacne.key, fOrientacne.field, fOrientacne.suffix, 50)}
                                      </div>
                                    )}
                                    {(fPsc || fMesto) && (
                                      <div className="flex flex-nowrap items-end gap-2" data-testid={`addr-row-psc-mesto-${prefix}`}>
                                        {fPsc && renderAddrField(fPsc.key, fPsc.field, fPsc.suffix, 30)}
                                        {fMesto && renderAddrField(fMesto.key, fMesto.field, fMesto.suffix, 70)}
                                      </div>
                                    )}
                                    {fStat && (
                                      <div data-testid={`addr-row-stat-${prefix}`}>
                                        {(() => {
                                          const statKey = fStat.key;
                                          const statLabel = ADDR_SHORT_LABELS["stat"] || "Štát";
                                          const statReq = isRequired(statKey);
                                          const statErr = validationErrors.has(statKey);
                                          const pSet = new Set(PRIORITY_COUNTRY_NAMES);
                                          const restC = ALL_COUNTRY_NAMES.filter(c => !pSet.has(c));
                                          return (
                                            <div style={{ pointerEvents: disabled ? "none" : "auto" }}>
                                              <div className="space-y-1">
                                                <Label className={`text-xs truncate block ${statErr ? "text-red-500" : "text-muted-foreground"}`}>{statLabel}{statReq ? " *" : ""}</Label>
                                                <Popover>
                                                  <PopoverTrigger asChild>
                                                    <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", statErr && "border-red-500 ring-1 ring-red-500", !dynamicValues[statKey] && "text-muted-foreground")} data-testid={`select-addr-stat-${prefix}`}>
                                                      <span className="truncate">{dynamicValues[statKey] || "Vyberte štát..."}</span>
                                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                    </Button>
                                                  </PopoverTrigger>
                                                  <PopoverContent className="w-[300px] p-0" align="start">
                                                    <Command>
                                                      <CommandInput placeholder="Hľadať štát..." />
                                                      <CommandList>
                                                        <CommandEmpty>Štát nenájdený.</CommandEmpty>
                                                        <CommandGroup heading="Prioritné">
                                                          {PRIORITY_COUNTRY_NAMES.map(c => (
                                                            <CommandItem key={c} value={c} onSelect={() => { setDynamicValues(prev => ({ ...prev, [statKey]: c })); if (statErr) setValidationErrors(prev => { const n = new Set(prev); n.delete(statKey); return n; }); }}>
                                                              <Check className={cn("mr-2 h-4 w-4", dynamicValues[statKey] === c ? "opacity-100" : "opacity-0")} />
                                                              {c}
                                                            </CommandItem>
                                                          ))}
                                                        </CommandGroup>
                                                        <CommandGroup heading="Všetky krajiny">
                                                          {restC.map(c => (
                                                            <CommandItem key={c} value={c} onSelect={() => { setDynamicValues(prev => ({ ...prev, [statKey]: c })); if (statErr) setValidationErrors(prev => { const n = new Set(prev); n.delete(statKey); return n; }); }}>
                                                              <Check className={cn("mr-2 h-4 w-4", dynamicValues[statKey] === c ? "opacity-100" : "opacity-0")} />
                                                              {c}
                                                            </CommandItem>
                                                          ))}
                                                        </CommandGroup>
                                                      </CommandList>
                                                    </Command>
                                                  </PopoverContent>
                                                </Popover>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              );
                            };

                            const showKa = !korRespondRovnaka;
                            const showKoa = !kontaktnaRovnaka;
                            const panelCount = 1 + (showKa ? 1 : 0) + (showKoa ? 1 : 0);
                            const gridClass = panelCount === 3
                              ? "grid-cols-1 md:grid-cols-3"
                              : panelCount === 2
                                ? "grid-cols-1 md:grid-cols-2"
                                : "grid-cols-1";

                            return (
                              <div className="space-y-2">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-1" data-testid="row-address-switches">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={korRespondRovnaka}
                                      onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(checked) }))}
                                      data-testid="switch-korespond-rovnaka"
                                    />
                                    <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(prev["korespond_rovnaka"] !== "true") }))}>
                                      Adresa prechodného pobytu je totožná z adresou trvalého pobytu
                                    </Label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={kontaktnaRovnaka}
                                      onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(checked) }))}
                                      data-testid="switch-kontaktna-rovnaka"
                                    />
                                    <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(prev["kontaktna_rovnaka"] !== "true") }))}>
                                      Kontaktná adresa je totožná z korešpondenčnou adresou
                                    </Label>
                                  </div>
                                </div>
                                <div className="flex flex-col md:flex-row gap-3 items-start" data-testid="row-address-panels">
                                  <div className="w-full" style={{ flex: `0 0 calc(${(100 / panelCount).toFixed(2)}% - ${((panelCount - 1) * 12 / panelCount).toFixed(2)}px)` }}>
                                    {renderAddressPanel("tp", ADDRESS_PANEL_FIELDS.tp, false)}
                                  </div>
                                  <div className="w-full" style={{ display: showKa ? undefined : "none", flex: `0 0 calc(${(100 / panelCount).toFixed(2)}% - ${((panelCount - 1) * 12 / panelCount).toFixed(2)}px)` }}>
                                    {renderAddressPanel("ka", ADDRESS_PANEL_FIELDS.ka, false)}
                                  </div>
                                  <div className="w-full" style={{ display: showKoa ? undefined : "none", flex: `0 0 calc(${(100 / panelCount).toFixed(2)}% - ${((panelCount - 1) * 12 / panelCount).toFixed(2)}px)` }}>
                                    {renderAddressPanel("koa", ADDRESS_PANEL_FIELDS.koa, false)}
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          <Card data-testid="panel-kontaktne-udaje">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                  <Users className="w-4 h-4 text-primary" />
                                  <p className="text-sm font-semibold">Kontaktné údaje</p>
                                  <Badge variant="secondary" className="text-[10px]">{contacts.length}</Badge>
                                </div>
                                <div className="flex items-center gap-1 flex-wrap">
                                  <Button type="button" variant="outline" size="sm" onClick={() => setContacts(prev => [...prev, { id: crypto.randomUUID(), type: "phone", value: "", label: "" }])} data-testid="button-add-phone">
                                    <Plus className="w-3 h-3 mr-1" />
                                    Telefón
                                  </Button>
                                  <Button type="button" variant="outline" size="sm" onClick={() => setContacts(prev => [...prev, { id: crypto.randomUUID(), type: "email", value: "", label: "" }])} data-testid="button-add-email">
                                    <Plus className="w-3 h-3 mr-1" />
                                    Email
                                  </Button>
                                </div>
                              </div>

                              <div className="space-y-2">
                                {contacts.map((contact, cIdx) => (
                                  <div key={contact.id} className="flex flex-wrap gap-3 items-end p-2 rounded-md border border-border bg-muted/20" data-testid={`contact-row-${cIdx}`}>
                                    <div className="space-y-1 w-[100px] min-w-[80px] shrink-0">
                                      <Label className="text-xs text-muted-foreground">Typ</Label>
                                      <Select value={contact.type} onValueChange={val => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, type: val as "phone" | "email" } : c))}>
                                        <SelectTrigger data-testid={`select-contact-type-${cIdx}`}>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="phone">Telefón</SelectItem>
                                          <SelectItem value="email">Email</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1 flex-1 min-w-[160px]">
                                      <Label className="text-xs text-muted-foreground">{contact.type === "phone" ? "Telefónne číslo" : "Emailová adresa"} {contact.isPrimary ? "*" : ""}</Label>
                                      {contact.type === "phone" ? (
                                        <PhoneInput
                                          value={contact.value}
                                          onChange={val => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, value: val } : c))}
                                          initialDialCode={allStates?.find(s => s.id === appUser?.activeStateId)?.code}
                                          data-testid={`input-contact-value-${cIdx}`}
                                        />
                                      ) : (
                                        <Input
                                          type="email"
                                          value={contact.value}
                                          onChange={e => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, value: e.target.value } : c))}
                                          placeholder="meno@priklad.sk"
                                          data-testid={`input-contact-value-${cIdx}`}
                                        />
                                      )}
                                    </div>
                                    <div className="space-y-1 w-[120px] min-w-[100px] shrink-0">
                                      <Label className="text-xs text-muted-foreground">Označenie</Label>
                                      <Input
                                        value={contact.label || ""}
                                        onChange={e => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, label: e.target.value } : c))}
                                        placeholder="napr. Osobný"
                                        data-testid={`input-contact-label-${cIdx}`}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1 pb-0.5">
                                      {!contact.isPrimary && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => setContacts(prev => prev.map(c => c.type === contact.type ? { ...c, isPrimary: c.id === contact.id } : c))} title="Nastaviť ako primárny" data-testid={`button-set-primary-${cIdx}`}>
                                          <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                                        </Button>
                                      )}
                                      {contact.isPrimary && (
                                        <Badge variant="secondary" className="text-[10px]">Primárny</Badge>
                                      )}
                                      {contacts.length > 1 && (
                                        <Button type="button" variant="ghost" size="icon" onClick={() => {
                                          setContacts(prev => {
                                            const remaining = prev.filter(c => c.id !== contact.id);
                                            if (contact.isPrimary) {
                                              const nextOfType = remaining.find(c => c.type === contact.type);
                                              if (nextOfType) nextOfType.isPrimary = true;
                                            }
                                            return [...remaining];
                                          });
                                        }} data-testid={`button-remove-contact-${cIdx}`}>
                                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {povinneRemainder.length > 0 && (
                                <div className="flex flex-wrap gap-4 items-end" data-testid="row-kontakt-fields-remainder">
                                  {povinneRemainder.map(field => (
                                    <div key={field.id} className={cn("min-w-0 flex-1 min-w-[140px]", flashingFields.has(field.fieldKey) && "field-imported-flash")}>
                                      <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} />
                                    </div>
                                  ))}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </AccordionContent>
                      </AccordionItem>

                      {(["doplnkove", "volitelne"] as const).map(category => {
                        const Icon = FOLDER_CATEGORY_ICONS[category];
                        const groups = nonPovinneGroups.filter(g => (g.section as any).folderCategory === category);
                        const totalFields = groups.reduce((acc, g) => acc + g.fields.length, 0);
                        if (totalFields === 0) return null;
                        return (
                          <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`editor-accordion-${category}`}>
                            <AccordionTrigger className="py-3 hover:no-underline">
                              <div className="flex items-center gap-2">
                                <Icon className={`w-4 h-4 ${category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                                <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                                <Badge variant="secondary" className="text-[10px]">{totalFields}</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-4">
                              <div className="space-y-2">
                                {groups.map(({ section, fields }) => (
                                  <div key={section.id} className="space-y-2">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1" style={{ display: groups.length > 1 ? 'block' : 'none' }}>{section.name}</p>
                                    <div className="flex flex-wrap gap-4 items-end">
                                      {fields.map((field: StaticField) => {
                                        const fk = field.fieldKey;
                                        let wCls = "flex-1 min-w-[140px]";
                                        if (fk === "titul_pred" || fk === "titul_za") wCls = "w-[100px] min-w-[80px] shrink-0";
                                        else if (fk === "vek") wCls = "w-[80px] min-w-[60px] shrink-0";
                                        else if (fk === "pohlavie") wCls = "w-[130px] min-w-[100px] shrink-0";
                                        else if (fk === "datum_narodenia" || fk === "platnost_dokladu") wCls = "w-[160px] min-w-[140px] shrink-0";
                                        else if (fk === "meno" || fk === "priezvisko" || fk === "rodne_priezvisko") wCls = "flex-1 min-w-[150px]";
                                        return (
                                          <div key={field.id} className={cn("min-w-0", wCls, flashingFields.has(field.fieldKey) && "field-imported-flash")}>
                                            <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>

                  </>
                );
              })() : (
                <>
                  <FormField control={form.control} name="companyName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Názov spoločnosti</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} data-testid="input-subject-companyname" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />

                  <div>
                    <Label className="text-xs text-muted-foreground">IČO</Label>
                    <Input value={initialData.baseValue} disabled className="mt-1" data-testid="input-ico-locked" />
                  </div>

                  <div className="flex flex-wrap gap-4 items-end">
                    <FormField control={form.control} name="email" render={({ field }) => (
                      <FormItem className="flex-1 min-w-[180px]">
                        <FormLabel>Email</FormLabel>
                        <FormControl><Input type="email" {...field} value={field.value || ""} data-testid="input-subject-email" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="phone" render={({ field }) => (
                      <FormItem className="w-[200px] min-w-[160px] shrink-0">
                        <FormLabel>Telefón</FormLabel>
                        <PhoneInput
                          value={field.value || ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          initialDialCode={allStates?.find(s => s.id === appUser?.activeStateId)?.code}
                          data-testid="input-subject-phone"
                        />
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>

                  {typeFields && typeFields.length > 0 && (() => {
                    const typePanels = getPanelsForClientTypeId(editorClientTypeId);
                    const editorFieldGroups: Record<string, { section: any; panelGroups: { panel: StaticPanel | null; fields: StaticField[] }[] }[]> = {
                      povinne: [], doplnkove: [], volitelne: [],
                    };
                    const sectionsSorted = [...(typeSections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                    for (const section of sectionsSorted) {
                      const category = (section as any).folderCategory || "volitelne";
                      const sectionFields = (typeFields || [])
                        .filter(f => (f.sectionId || 0) === section.id)
                        .filter(f => isFieldVisible(f));
                      if (sectionFields.length === 0) continue;
                      const sectionPanels = typePanels
                        .filter(p => p.sectionId === section.id)
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                      const panelGroups: { panel: StaticPanel | null; fields: StaticField[] }[] = [];
                      for (const panel of sectionPanels) {
                        const panelFields = sectionFields
                          .filter(f => f.panelId === panel.id)
                          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                        if (panelFields.length > 0) panelGroups.push({ panel, fields: panelFields });
                      }
                      const noPanelFields = sectionFields
                        .filter(f => !f.panelId || !sectionPanels.find(p => p.id === f.panelId))
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                      if (noPanelFields.length > 0) panelGroups.push({ panel: null, fields: noPanelFields });
                      if (panelGroups.length > 0) {
                        if (!editorFieldGroups[category]) editorFieldGroups[category] = [];
                        editorFieldGroups[category].push({ section, panelGroups });
                      }
                    }
                    return (
                      <div className="space-y-2 pt-2">
                        <Separator />
                        <Accordion type="multiple" defaultValue={["povinne", "doplnkove"]} className="space-y-2">
                          {FOLDER_CATEGORY_ORDER.map(category => {
                            const Icon = FOLDER_CATEGORY_ICONS[category];
                            const groups = editorFieldGroups[category] || [];
                            const totalFields = groups.reduce((acc, g) => acc + g.panelGroups.reduce((s, pg) => s + pg.fields.length, 0), 0);
                            if (totalFields === 0) return null;
                            return (
                              <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`editor-accordion-${category}`}>
                                <AccordionTrigger className="py-3 hover:no-underline">
                                  <div className="flex items-center gap-2">
                                    <Icon className={`w-4 h-4 ${category === 'povinne' ? 'text-destructive' : category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                                    <Badge variant="secondary" className="text-[10px]">{totalFields}</Badge>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pb-4">
                                  <div className="space-y-4">
                                    {groups.flatMap(({ panelGroups }) =>
                                      panelGroups.map(({ panel, fields }) => (
                                        <div key={panel ? panel.id : "no-panel"} className="space-y-2">
                                          {panel && (
                                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1">{panel.name}</p>
                                          )}
                                          <div className="flex flex-wrap gap-4 items-end">
                                            {fields.map((field: StaticField) => {
                                              const fk = field.fieldKey;
                                              let wCls = "flex-1 min-w-[140px]";
                                              if (fk === "titul_pred" || fk === "titul_za") wCls = "w-[100px] min-w-[80px] shrink-0";
                                              else if (fk === "vek") wCls = "w-[80px] min-w-[60px] shrink-0";
                                              else if (fk === "pohlavie") wCls = "w-[130px] min-w-[100px] shrink-0";
                                              else if (fk === "datum_narodenia" || fk === "platnost_dokladu") wCls = "w-[160px] min-w-[140px] shrink-0";
                                              else if (fk === "meno" || fk === "priezvisko" || fk === "rodne_priezvisko") wCls = "flex-1 min-w-[150px]";
                                              return (
                                                <div key={field.id} className={cn("min-w-0", wCls, flashingFields.has(field.fieldKey) && "field-imported-flash")}>
                                                  <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} hasError={validationErrors.has(field.fieldKey)} />
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            );
                          })}
                        </Accordion>
                      </div>
                    );
                  })()}
                </>
              )}

              <div className="bg-muted p-3 rounded-md text-xs text-muted-foreground flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <p>
                  <strong>Integritne upozornenie:</strong> Vytvorenie subjektu vygeneruje permanentny, nemenitelny
                  unikatny identifikator. Vsetky budu zmeny archivovane.
                </p>
              </div>

              <div className="flex justify-end gap-2 sticky bottom-0 bg-card pt-3 pb-1 border-t border-border">
                <Button type="button" variant="outline" onClick={onCancel} data-testid="button-cancel-subject">Zrusit</Button>
                <Button type="submit" disabled={isPending} data-testid="button-save-subject">
                  {isPending ? "Registrujem..." : "Registrovat subjekt"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}

type SubjectStatusCategory = "other_company" | "deceased" | "no_contract" | "active" | "inactive";

const STATUS_CONFIG: Record<SubjectStatusCategory, { color: string; bgColor: string; borderColor: string; shadowColor: string; textColor: string; label: string }> = {
  other_company: { color: "bg-gray-400", bgColor: "bg-gray-500/10", borderColor: "border-gray-400", shadowColor: "shadow-gray-400/40", textColor: "text-gray-600 dark:text-gray-300", label: "Ina spolocnost" },
  deceased: { color: "bg-black dark:bg-gray-200", bgColor: "bg-black/10 dark:bg-gray-200/10", borderColor: "border-black dark:border-gray-200", shadowColor: "shadow-black/40 dark:shadow-gray-200/40", textColor: "text-black dark:text-gray-200", label: "Zosnuly" },
  no_contract: { color: "bg-blue-500", bgColor: "bg-blue-500/10", borderColor: "border-blue-500", shadowColor: "shadow-blue-500/40", textColor: "text-blue-700 dark:text-blue-300", label: "Bez zmluvy" },
  active: { color: "bg-emerald-500", bgColor: "bg-emerald-500/10", borderColor: "border-emerald-500", shadowColor: "shadow-emerald-500/40", textColor: "text-emerald-700 dark:text-emerald-300", label: "Aktivny" },
  inactive: { color: "bg-red-500", bgColor: "bg-red-500/10", borderColor: "border-red-500", shadowColor: "shadow-red-500/40", textColor: "text-red-700 dark:text-red-300", label: "Neaktivny" },
};

function getSubjectStatusCategory(subject: any, activeCompanyId?: number): SubjectStatusCategory {
  if ((subject as any).isDeceased) return "deceased";
  if (!subject.isActive) return "inactive";
  if (activeCompanyId && subject.myCompanyId !== activeCompanyId && !(subject as any).isLinkedToActiveCompany) return "other_company";
  if ((subject.contractCount ?? 0) === 0) return "no_contract";
  return "active";
}

function getSubjectStatus(subject: any, activeCompanyId?: number): { color: string; bgColor: string; borderColor: string; textColor: string; label: string; category: SubjectStatusCategory } {
  const category = getSubjectStatusCategory(subject, activeCompanyId);
  const config = STATUS_CONFIG[category];
  return { color: config.color, bgColor: config.bgColor, borderColor: config.borderColor, textColor: config.textColor, label: config.label, category };
}

function SubjectEditModal({ subject, onClose }: { subject: Subject; onClose: () => void }) {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const { data: allStates } = useStates();
  const { data: companies } = useMyCompanies();
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const timerRef = useRef<number>(performance.now());

  const isSystemType = subject.type === 'system';
  const isPerson = subject.type === 'person';
  const isSzco = subject.type === 'szco';
  const linkedFo = (subject as any).linkedFo;
  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident';

  const details = (subject.details || {}) as Record<string, any>;
  const dynamicFields = details.dynamicFields || {};

  const clientType = clientTypes?.find(ct => {
    if (isSystemType) return false;
    if (isSzco && ct.code === 'SZCO') return true;
    if (subject.type === 'company' && ct.code === 'PO') return true;
    if (isPerson && ct.code === 'FO') return true;
    return false;
  });

  const modalClientTypeId = isSystemType ? 4 : isSzco ? 3 : subject.type === 'company' ? 4 : 1;
  const typeFields = getFieldsForClientTypeId(modalClientTypeId);
  const typeSections = getSectionsForClientTypeId(modalClientTypeId);

  const CORE_FIELD_MAP: Record<string, string> = {
    email: "email",
    telefon: "phone",
    cislo_dokladu: "idCardNumber",
    meno: "firstName",
    priezvisko: "lastName",
  };

  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (dynamicFields && typeof dynamicFields === 'object') {
      Object.entries(dynamicFields).forEach(([key, val]) => {
        initial[key] = String(val || "");
      });
    }
    const configuredKeys = new Set<string>();
    if (typeFields) typeFields.forEach(f => configuredKeys.add(f.fieldKey));
    Object.entries(CORE_FIELD_MAP).forEach(([fieldKey, subjectKey]) => {
      if (!initial[fieldKey]) {
        const val = (subject as any)[subjectKey];
        if (val) initial[fieldKey] = String(val);
      }
    });
    return initial;
  });

  function isFieldVisible(field: StaticField): boolean {
    if (!field.visibilityRule) return true;
    const rule = field.visibilityRule as { dependsOn: string; value: string };
    if (!rule.dependsOn || !rule.value) return true;
    const depField = typeFields?.find(f => f.fieldKey === rule.dependsOn);
    if (!depField) return true;
    const depValue = dynamicValues[depField.fieldKey] || "";
    return depValue === rule.value;
  }

  const [formData, setFormData] = useState({
    firstName: subject.firstName || "",
    lastName: subject.lastName || "",
    companyName: subject.companyName || "",
    email: subject.email || "",
    phone: subject.phone || "",
    idCardNumber: subject.idCardNumber || "",
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
      const existingDetails = { ...(subject.details as any || {}) };
      const cleanDynamic = { ...dynamicValues };
      const configuredFieldKeys = new Set((typeFields || []).map(f => f.fieldKey));
      const coreFieldValues: Record<string, string | null> = {};
      Object.entries(CORE_FIELD_MAP).forEach(([fieldKey, subjectKey]) => {
        if (configuredFieldKeys.has(fieldKey)) {
          coreFieldValues[subjectKey] = cleanDynamic[fieldKey] || null;
          delete cleanDynamic[fieldKey];
        }
      });
      existingDetails.dynamicFields = cleanDynamic;
      const payload: any = {
        firstName: coreFieldValues.firstName ?? formData.firstName ?? subject.firstName ?? null,
        lastName: coreFieldValues.lastName ?? formData.lastName ?? subject.lastName ?? null,
        companyName: formData.companyName || subject.companyName || null,
        email: coreFieldValues.email ?? subject.email ?? null,
        phone: coreFieldValues.phone ?? subject.phone ?? null,
        idCardNumber: coreFieldValues.idCardNumber ?? subject.idCardNumber ?? null,
        details: existingDetails,
        processingTimeSec,
        changeReason: "Manualna editacia cez Register subjektov",
      };
      await apiRequest("PUT", `/api/subjects/${subject.id}`, payload);
    },
    onSuccess: () => {
      toast({ title: "Udaje subjektu aktualizovane" });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      onClose();
    },
    onError: (error: Error) => {
      toast({ title: "Chyba pri ukladani", description: error.message, variant: "destructive" });
    },
  });

  function handleSaveClick() {
    setConfirmOpen(true);
  }

  function handleConfirmSave() {
    setConfirmOpen(false);
    updateMutation.mutate();
  }

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent size="xl" className="items-stretch justify-start">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-md bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <Pencil className="w-5 h-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <DialogTitle data-testid="text-edit-subject-title">
                  Editacia subjektu
                </DialogTitle>
                <DialogDescription>
                  <span className="font-mono text-xs">{formatUid(subject.uid)}</span>
                  <span className="mx-2">|</span>
                  {isPerson ? `${subject.lastName}, ${subject.firstName}` : subject.companyName}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <DialogScrollContent className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-md">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">NEEDITOVATELNE POLIA</span>
              </div>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="w-[200px] min-w-[160px] shrink-0">
                  <Label className="text-xs text-muted-foreground">UID</Label>
                  <Input value={formatUid(subject.uid)} disabled className="mt-1 font-mono text-xs" data-testid="input-edit-uid-locked" />
                </div>
                {isPerson ? (
                  <div className="w-[200px] min-w-[160px] shrink-0">
                    <Label className="text-xs text-muted-foreground">Rodne cislo (RC)</Label>
                    <Input value={subject.birthNumber || ""} disabled className="mt-1" data-testid="input-edit-rc-locked" />
                  </div>
                ) : (
                  <div className="w-[200px] min-w-[160px] shrink-0">
                    <Label className="text-xs text-muted-foreground">ICO</Label>
                    <Input value={details.ico || ""} disabled className="mt-1" data-testid="input-edit-ico-locked" />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {isAdmin ? "Identifikatory moze zmenit iba admin cez specialny postup." : "Identifikatory (RC/ICO) a UID su uzamknute. Kontaktujte admina pre zmenu."}
              </p>
            </div>

            {isSzco && linkedFo && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-blue-500/10 border border-blue-500/30">
                <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">Osobne udaje prevzate z FO</p>
                  <p className="text-xs text-muted-foreground">{linkedFo.firstName} {linkedFo.lastName} ({formatUid(linkedFo.uid)})</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Meno, priezvisko a rodne cislo su prevzate z prepojenej Fyzickej osoby a nie je mozne ich tu menit.</p>
                </div>
              </div>
            )}

            <Separator />

            <div style={{ display: !isPerson ? 'block' : 'none' }}>
              <Label className="text-xs">Nazov spolocnosti</Label>
              <Input
                value={formData.companyName}
                onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                className="mt-1"
                data-testid="input-edit-companyname"
              />
            </div>

            {typeFields && typeFields.length > 0 && (() => {
              const editTypePanels = getPanelsForClientTypeId(modalClientTypeId);
              const editFieldGroups: Record<string, { section: any; fields: StaticField[] }[]> = {
                povinne: [], doplnkove: [], volitelne: [],
              };
              const sectionsSorted = [...(typeSections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
              for (const section of sectionsSorted) {
                const category = (section as any).folderCategory || "volitelne";
                const sectionFields = typeFields
                  .filter(f => (f.sectionId || 0) === section.id)
                  .filter(f => isFieldVisible(f))
                  .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                if (sectionFields.length > 0) {
                  if (!editFieldGroups[category]) editFieldGroups[category] = [];
                  editFieldGroups[category].push({ section, fields: sectionFields });
                }
              }
              const unsectioned = typeFields.filter(f => !f.sectionId || f.sectionId === 0).filter(f => isFieldVisible(f));
              if (unsectioned.length > 0) {
                editFieldGroups.volitelne.push({ section: { id: 0, name: "Ostatne" }, fields: unsectioned.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) });
              }

              const EDIT_ADDRESS_PANEL_FIELDS = {
                tp: { label: "Adresa trvalého pobytu", keys: ["tp_ulica", "tp_supisne", "tp_orientacne", "tp_psc", "tp_mesto", "tp_stat"], requiredKeys: ["tp_ulica", "tp_orientacne", "tp_psc", "tp_mesto"] },
                ka: { label: "Adresa prechodného pobytu", keys: ["ka_ulica", "ka_supisne", "ka_orientacne", "ka_psc", "ka_mesto", "ka_stat"], requiredKeys: [] },
                koa: { label: "Kontaktná adresa", keys: ["koa_ulica", "koa_supisne", "koa_orientacne", "koa_psc", "koa_mesto", "koa_stat"], requiredKeys: [] },
              };
              const EDIT_ADDR_SWITCH_KEYS = ["korespond_rovnaka", "kontaktna_rovnaka"];
              const editAllAddressKeys = new Set(
                Object.values(EDIT_ADDRESS_PANEL_FIELDS).flatMap(p => p.keys).concat(EDIT_ADDR_SWITCH_KEYS)
              );

              const EDIT_ADDR_FALLBACK_LABELS: Record<string, string> = {
                ulica: "Ulica", supisne: "Súpisné číslo", orientacne: "Orientačné číslo",
                psc: "PSČ", mesto: "Mesto", stat: "Štát",
              };

              const editKorRespondRovnaka = dynamicValues["korespond_rovnaka"] === "true";
              const editKontaktnaRovnaka = dynamicValues["kontaktna_rovnaka"] === "true";

              const allPovinneFields = (editFieldGroups.povinne || []).flatMap(g => g.fields);

              const isEditAddrFieldHidden = (_key: string) => false;

              const renderEditAddressPanel = (prefix: "tp" | "ka" | "koa", panelDef: typeof EDIT_ADDRESS_PANEL_FIELDS["tp"], disabled: boolean) => {
                const findField = (key: string) => allPovinneFields.find(f => f.fieldKey === key);
                const fieldKeys = [`${prefix}_ulica`, `${prefix}_supisne`, `${prefix}_orientacne`, `${prefix}_psc`, `${prefix}_mesto`, `${prefix}_stat`];
                const fields = fieldKeys.map(k => ({ key: k, field: findField(k), suffix: k.split("_").slice(1).join("_"), hidden: isEditAddrFieldHidden(k) }));
                const visibleFields = fields.filter(f => !f.hidden);
                const isReq = (key: string) => panelDef.requiredKeys.includes(key);

                if (visibleFields.length === 0) return null;

                const renderAddrField = (key: string, field: StaticField | undefined, suffix: string) => {
                  if (field) {
                    const augField = isReq(key) && !field.isRequired ? { ...field, isRequired: true } as StaticField : field;
                    return (
                      <div key={key} style={{ pointerEvents: disabled ? "none" : "auto" }}>
                        <DynamicFieldInput field={augField} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} subjectId={subject.id} />
                      </div>
                    );
                  }
                  return (
                    <div className="space-y-1" key={key}>
                      <Label className="text-xs text-muted-foreground">{EDIT_ADDR_FALLBACK_LABELS[suffix] || suffix}{isReq(key) ? " *" : ""}</Label>
                      <Input disabled={disabled} value={dynamicValues[key] || ""} onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))} data-testid={`input-edit-addr-${key}`} />
                    </div>
                  );
                };

                const row1 = visibleFields.filter(f => f.suffix === "ulica");
                const row2 = visibleFields.filter(f => f.suffix === "supisne" || f.suffix === "orientacne");
                const row3 = visibleFields.filter(f => f.suffix === "psc" || f.suffix === "mesto");
                const row4 = visibleFields.filter(f => f.suffix === "stat");

                return (
                  <Card className={`${disabled ? "opacity-50 pointer-events-none" : ""}`} data-testid={`edit-panel-address-${prefix}`}>
                    <CardContent className="p-4 space-y-3">
                      <p className="text-sm font-semibold truncate" title={panelDef.label}>{panelDef.label}</p>
                      {row1.length > 0 && <div className="grid grid-cols-1 gap-2">{row1.map(f => renderAddrField(f.key, f.field, f.suffix))}</div>}
                      {row2.length > 0 && <div className={`grid grid-cols-1 ${row2.length > 1 ? "sm:grid-cols-2" : ""} gap-2`}>{row2.map(f => renderAddrField(f.key, f.field, f.suffix))}</div>}
                      {row3.length > 0 && <div className={`grid grid-cols-1 ${row3.length > 1 ? "sm:grid-cols-2" : ""} gap-2`}>{row3.map(f => renderAddrField(f.key, f.field, f.suffix))}</div>}
                      {row4.length > 0 && <div className="grid grid-cols-1 gap-2">{row4.map(f => {
                        const statKey = f.key;
                        const statLabel = EDIT_ADDR_FALLBACK_LABELS["stat"] || "Štát";
                        const statReq = isReq(statKey);
                        const pSet = new Set(PRIORITY_COUNTRY_NAMES);
                        const restC = ALL_COUNTRY_NAMES.filter(c => !pSet.has(c));
                        return (
                          <div key={statKey} style={{ pointerEvents: disabled ? "none" : "auto" }}>
                            <div className="space-y-1">
                              <Label className={`text-xs truncate block text-muted-foreground`}>{statLabel}{statReq ? " *" : ""}</Label>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !dynamicValues[statKey] && "text-muted-foreground")} data-testid={`select-edit-addr-stat-${prefix}`}>
                                    <span className="truncate">{dynamicValues[statKey] || "Vyberte štát..."}</span>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                  <Command>
                                    <CommandInput placeholder="Hľadať štát..." />
                                    <CommandList>
                                      <CommandEmpty>Štát nenájdený.</CommandEmpty>
                                      <CommandGroup heading="Prioritné">
                                        {PRIORITY_COUNTRY_NAMES.map(c => (
                                          <CommandItem key={c} value={c} onSelect={() => setDynamicValues(prev => ({ ...prev, [statKey]: c }))}>
                                            <Check className={cn("mr-2 h-4 w-4", dynamicValues[statKey] === c ? "opacity-100" : "opacity-0")} />
                                            {c}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                      <CommandGroup heading="Všetky krajiny">
                                        {restC.map(c => (
                                          <CommandItem key={c} value={c} onSelect={() => setDynamicValues(prev => ({ ...prev, [statKey]: c }))}>
                                            <Check className={cn("mr-2 h-4 w-4", dynamicValues[statKey] === c ? "opacity-100" : "opacity-0")} />
                                            {c}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>
                        );
                      })}</div>}
                    </CardContent>
                  </Card>
                );
              };

              return (
                <div className="space-y-2 pt-2">
                  <Separator />
                  <Accordion type="multiple" defaultValue={["povinne", "doplnkove"]} className="space-y-2">
                    {FOLDER_CATEGORY_ORDER.map(category => {
                      const Icon = FOLDER_CATEGORY_ICONS[category];
                      const groups = editFieldGroups[category] || [];
                      const totalFields = groups.reduce((acc, g) => acc + g.fields.length, 0);
                      const hasAddressPanels = isPerson && category === "povinne";
                      const visibleAddrFieldCount = hasAddressPanels
                        ? Object.values(EDIT_ADDRESS_PANEL_FIELDS).flatMap(p => p.keys).filter(k => !isEditAddrFieldHidden(k)).length
                        : 0;
                      if (totalFields === 0 && visibleAddrFieldCount === 0) return null;
                      return (
                        <AccordionItem key={category} value={category} className="border rounded-md px-3" data-testid={`edit-accordion-${category}`}>
                          <AccordionTrigger className="py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Icon className={`w-4 h-4 ${category === 'povinne' ? 'text-destructive' : category === 'doplnkove' ? 'text-primary' : 'text-muted-foreground'}`} />
                              <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS[category]}</span>
                              <Badge variant="secondary" className="text-[10px]">{totalFields + visibleAddrFieldCount}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-4">
                            <div className="space-y-4">
                              {groups.map(({ section, fields }) => {
                                const filteredFields = hasAddressPanels
                                  ? fields.filter(f => !editAllAddressKeys.has(f.fieldKey))
                                  : fields;
                                if (filteredFields.length === 0) return null;

                                const renderFieldRow = (rowFields: StaticField[], key: number | string) => (
                                  <div key={key} className="flex flex-wrap gap-4 items-end">
                                    {rowFields.map((field: StaticField) => {
                                      const fk = field.fieldKey;
                                      let wCls = "flex-1 min-w-[140px]";
                                      if (fk === "titul_pred" || fk === "titul_za") wCls = "w-[100px] min-w-[80px] shrink-0";
                                      else if (fk === "vek") wCls = "w-[80px] min-w-[60px] shrink-0";
                                      else if (fk === "pohlavie") wCls = "w-[130px] min-w-[100px] shrink-0";
                                      else if (fk === "datum_narodenia" || fk === "platnost_dokladu") wCls = "w-[160px] min-w-[140px] shrink-0";
                                      else if (fk === "meno" || fk === "priezvisko" || fk === "rodne_priezvisko") wCls = "flex-1 min-w-[150px]";
                                      return (
                                        <div key={field.id} className={cn("min-w-0", wCls)}>
                                          <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} subjectId={subject.id} />
                                        </div>
                                      );
                                    })}
                                  </div>
                                );

                                if (!isPerson) {
                                  const sectionPanels = editTypePanels
                                    .filter(p => p.sectionId === section.id)
                                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                                  const panelGroups: { panel: StaticPanel | null; fields: StaticField[] }[] = [];
                                  for (const panel of sectionPanels) {
                                    const pf = filteredFields.filter(f => f.panelId === panel.id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                                    if (pf.length > 0) panelGroups.push({ panel, fields: pf });
                                  }
                                  const noPanelF = filteredFields.filter(f => !f.panelId || !sectionPanels.find(p => p.id === f.panelId)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
                                  if (noPanelF.length > 0) panelGroups.push({ panel: null, fields: noPanelF });
                                  return (
                                    <div key={section.id} className="space-y-4">
                                      {panelGroups.map(({ panel, fields: pf }) => {
                                        const rows = new Map<number, StaticField[]>();
                                        pf.forEach((f: StaticField) => {
                                          const rn = (f as any).rowNumber ?? 0;
                                          if (!rows.has(rn)) rows.set(rn, []);
                                          rows.get(rn)!.push(f);
                                        });
                                        const sortedRowKeys = Array.from(rows.keys()).sort((a, b) => a - b);
                                        return (
                                          <div key={panel ? panel.id : "no-panel"} className="space-y-2">
                                            {panel && (
                                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1">{panel.name}</p>
                                            )}
                                            <div className="space-y-2">
                                              {sortedRowKeys.map(rowNum => renderFieldRow(rows.get(rowNum)!, rowNum))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                const rows = new Map<number, StaticField[]>();
                                filteredFields.forEach((f: StaticField) => {
                                  const rn = (f as any).rowNumber ?? 0;
                                  if (!rows.has(rn)) rows.set(rn, []);
                                  rows.get(rn)!.push(f);
                                });
                                const sortedRowKeys = Array.from(rows.keys()).sort((a, b) => a - b);

                                return (
                                  <div key={section.id} className="space-y-3">
                                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1" style={{ display: groups.length > 1 ? 'block' : 'none' }}>{section.name}</p>
                                    <div className="space-y-2">
                                      {sortedRowKeys.map(rowNum => renderFieldRow(rows.get(rowNum)!, rowNum))}
                                    </div>
                                  </div>
                                );
                              })}
                              {(() => {
                                if (!hasAddressPanels) return null;
                                const editShowKa = !editKorRespondRovnaka;
                                const editShowKoa = !editKontaktnaRovnaka;
                                const editPanelCount = 1 + (editShowKa ? 1 : 0) + (editShowKoa ? 1 : 0);
                                return (
                                  <div className="space-y-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-1" data-testid="edit-row-address-switches">
                                      <div className="flex items-center gap-2">
                                        <Switch checked={editKorRespondRovnaka} onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(checked) }))} data-testid="edit-switch-korespond-rovnaka" />
                                        <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(prev["korespond_rovnaka"] !== "true") }))}>Adresa prechodného pobytu je totožná z adresou trvalého pobytu</Label>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <Switch checked={editKontaktnaRovnaka} onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(checked) }))} data-testid="edit-switch-kontaktna-rovnaka" />
                                        <Label className="text-xs cursor-pointer" onClick={() => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(prev["kontaktna_rovnaka"] !== "true") }))}>Kontaktná adresa je totožná z korešpondenčnou adresou</Label>
                                      </div>
                                    </div>
                                    <div className="flex flex-col md:flex-row gap-3 items-start" data-testid="edit-row-address-panels">
                                      <div className="w-full" style={{ flex: `0 0 calc(${(100 / editPanelCount).toFixed(2)}% - ${((editPanelCount - 1) * 12 / editPanelCount).toFixed(2)}px)` }}>
                                        {renderEditAddressPanel("tp", EDIT_ADDRESS_PANEL_FIELDS.tp, false)}
                                      </div>
                                      <div className="w-full" style={{ display: editShowKa ? undefined : "none", flex: `0 0 calc(${(100 / editPanelCount).toFixed(2)}% - ${((editPanelCount - 1) * 12 / editPanelCount).toFixed(2)}px)` }}>
                                        {renderEditAddressPanel("ka", EDIT_ADDRESS_PANEL_FIELDS.ka, false)}
                                      </div>
                                      <div className="w-full" style={{ display: editShowKoa ? undefined : "none", flex: `0 0 calc(${(100 / editPanelCount).toFixed(2)}% - ${((editPanelCount - 1) * 12 / editPanelCount).toFixed(2)}px)` }}>
                                        {renderEditAddressPanel("koa", EDIT_ADDRESS_PANEL_FIELDS.koa, false)}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </div>
              );
            })()}

          </DialogScrollContent>
          <div className="flex justify-end gap-2 p-6 pt-3 border-t border-border">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-edit-subject">
              Zrusit
            </Button>
            <Button
              onClick={handleSaveClick}
              disabled={updateMutation.isPending}
              className="bg-amber-600 text-white border-amber-700"
              data-testid="button-save-edit-subject"
            >
              {updateMutation.isPending ? "Ukladam..." : "Ulozit zmeny"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Naozaj chcete prepisat udaje tohto subjektu?</AlertDialogTitle>
            <AlertDialogDescription>
              Zmeny budu zaznamenane v historii subjektu. Povodne udaje budu archivovane pre spatne dohladanie.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm-edit">Nie</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSave}
              className="bg-amber-600 text-white border-amber-700"
              data-testid="button-confirm-edit"
            >
              Ano, prepisat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BulkAssignDialog({ selectedIds, onClose, groups }: { selectedIds: Set<number>; onClose: () => void; groups: any[] }) {
  const [selectedGroup, setSelectedGroup] = useState("");
  const { toast } = useToast();
  
  const assignMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/client-groups/${selectedGroup}/bulk-assign`, {
        subjectIds: Array.from(selectedIds),
      });
    },
    onSuccess: () => {
      toast({ title: "Klienti priradeni do skupiny" });
      queryClient.invalidateQueries({ queryKey: ["/api/client-groups"] });
      onClose();
    },
    onError: () => {
      toast({ title: "Chyba pri priradovani", variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Priradit do skupiny</DialogTitle>
          <DialogDescription>
            Vyberte skupinu pre {selectedIds.size} vybranych klientov.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <Select value={selectedGroup} onValueChange={setSelectedGroup}>
            <SelectTrigger data-testid="select-bulk-group">
              <SelectValue placeholder="Vyberte skupinu" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((g: any) => (
                <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel-bulk">Zrusit</Button>
            <Button 
              onClick={() => assignMutation.mutate()} 
              disabled={!selectedGroup || assignMutation.isPending}
              data-testid="button-confirm-bulk"
            >
              {assignMutation.isPending ? "Priradujem..." : "Priradit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const FILTER_ORDER: SubjectStatusCategory[] = ["other_company", "deceased", "no_contract", "active", "inactive"];

const SUBJECTS_COLUMNS: ColumnDef[] = [
  { key: "uid", label: "UID" },
  { key: "registrationStatus", label: "Overenie" },
  { key: "status", label: "Status" },
  { key: "cgn", label: "CGN" },
  { key: "titul", label: "Titul" },
  { key: "firstName", label: "Cele meno / Nazov" },
  { key: "ulica", label: "Ulica" },
  { key: "type", label: "Typ subjektu" },
];

const REGISTRATION_STATUS_LABELS: Record<string, { label: string; variant: "secondary" | "default" | "outline"; className: string }> = {
  potencialny: { label: "Potenciálny", variant: "outline", className: "text-[10px] border-gray-400/50 text-gray-400" },
  tiper: { label: "Tipér", variant: "outline", className: "text-[10px] border-blue-500/50 text-blue-500" },
  klient: { label: "Klient", variant: "outline", className: "text-[10px] border-green-500/50 text-green-500" },
};

const SUBJECTS_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "uid", label: "UID", type: "text" },
  { key: "firstName", label: "Cele meno / Nazov", type: "text" },
  { key: "type", label: "Typ subjektu", type: "text" },
  { key: "registrationStatus", label: "Overenie", type: "text" },
];

export default function Subjects() {
  const [search, setSearch] = useState("");
  const [isInitModalOpen, setIsInitModalOpen] = useState(false);
  const [editData, setEditData] = useState<{ clientTypeCode: string; stateId: number; baseValue: string; aresData?: { name?: string; street?: string; streetNumber?: string; zip?: string; city?: string; legalForm?: string; dic?: string } } | null>(null);
  const [pendingAddNew] = useState<{ clientType: string; baseValue: string } | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("addNew") === "true") {
      const result = { clientType: params.get("clientType") || "", baseValue: params.get("baseValue") || "" };
      window.history.replaceState({}, "", window.location.pathname);
      return result;
    }
    return null;
  });
  const [pendingOpenId] = useState<number | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("openId");
    if (id) {
      window.history.replaceState({}, "", window.location.pathname);
      return parseInt(id, 10);
    }
    return null;
  });
  const [openIdHandled, setOpenIdHandled] = useState(false);
  const [addNewHandled, setAddNewHandled] = useState(false);
  const [viewTarget, setViewTarget] = useState<Subject | null>(null);
  const [editTarget, setEditTarget] = useState<Subject | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<SubjectStatusCategory>>(new Set());
  const [cgnFilterActive, setCgnFilterActive] = useState(false);
  const { data: appUser } = useAppUser();
  const activeCompanyId = appUser?.activeCompanyId ?? undefined;

  const { data: subjects, isLoading } = useSubjects({
    statusFilters: activeFilters.size > 0 ? Array.from(activeFilters) : undefined,
    activeCompanyId,
  });
  const searchFilteredSubjects = useMemo(() => {
    if (!subjects) return [];
    if (!search.trim()) return subjects;
    const q = search.toLowerCase().trim().replace(/[\s\-\/]/g, "");
    return subjects.filter((s: any) => {
      const fullName = `${s.firstName || ""} ${s.lastName || ""} ${s.companyName || ""}`.toLowerCase();
      const uid = (s.uid || "").replace(/\s/g, "");
      const bn = (s.birthNumber || "").replace(/[\s\-\/]/g, "");
      const det = (s.details || {}) as Record<string, any>;
      const dynF = det.dynamicFields || {};
      const ico = ((dynF.ico || det.ico || "").replace(/\s/g, "")).toLowerCase();
      return fullName.includes(search.toLowerCase().trim())
        || uid.includes(q)
        || bn.includes(q)
        || ico.includes(q)
        || (s.email || "").toLowerCase().includes(search.toLowerCase().trim())
        || (s.phone || "").replace(/\s/g, "").includes(q);
    });
  }, [subjects, search]);
  const tableFilter = useSmartFilter(searchFilteredSubjects, SUBJECTS_FILTER_COLUMNS, "subjects");
  const cgnFiltered = useMemo(() => {
    if (!cgnFilterActive) return tableFilter.filteredData;
    return tableFilter.filteredData.filter((s: any) => {
      const det = (s.details || {}) as Record<string, any>;
      return det.cgnActive === true;
    });
  }, [tableFilter.filteredData, cgnFilterActive]);
  const { sortedData, sortKey, sortDirection, requestSort } = useTableSort(cgnFiltered);
  const { data: companies } = useMyCompanies();
  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const { data: clientGroups } = useQuery<any[]>({ queryKey: ["/api/client-groups"] });
  const columnVisibility = useColumnVisibility("subjects", SUBJECTS_COLUMNS);

  const subjectIds = useMemo(() => (sortedData || []).map((s: any) => s.id), [sortedData]);
  const { data: batchPhotos } = useQuery<Record<number, { id: number; filePath: string }>>({
    queryKey: ["/api/subjects/batch-photos", subjectIds],
    queryFn: async () => {
      if (subjectIds.length === 0) return {};
      const res = await fetch("/api/subjects/batch-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjectIds }),
        credentials: "include",
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: subjectIds.length > 0,
  });

  useEffect(() => {
    if (addNewHandled || !pendingAddNew) return;
    if (pendingAddNew.clientType && pendingAddNew.baseValue) {
      if (!appUser?.activeStateId) return;
      setAddNewHandled(true);
      setEditData({ clientTypeCode: pendingAddNew.clientType, stateId: appUser.activeStateId, baseValue: pendingAddNew.baseValue });
    } else {
      setAddNewHandled(true);
      setIsInitModalOpen(true);
    }
  }, [addNewHandled, pendingAddNew, appUser?.activeStateId]);

  useEffect(() => {
    if (openIdHandled || !pendingOpenId || !subjects) return;
    const found = subjects.find((s: any) => s.id === pendingOpenId);
    if (found) {
      setOpenIdHandled(true);
      setViewTarget(found as Subject);
    }
  }, [openIdHandled, pendingOpenId, subjects]);

  function toggleFilter(category: SubjectStatusCategory) {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }

  if (editData) {
    return (
      <FullPageEditor
        initialData={editData}
        onCancel={() => setEditData(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h2 className="text-2xl font-bold" data-testid="text-subjects-title">Register subjektov</h2>
            <HelpIcon text="Zoznam vsetkych klientov a subjektov v systeme. Klientov mozete pridavat, upravovat a archivovat." side="right" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Sprava entit a integritnych zaznamov.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
          {canCreateSubjects(appUser) && (
            <Button onClick={() => setIsInitModalOpen(true)} data-testid="button-add-subject">
              <Plus className="w-4 h-4 mr-2" />
              Novy subjekt
            </Button>
          )}
        </div>
      </div>

      {viewTarget ? (
        <SubjectDetailPanel subject={viewTarget} onClose={() => setViewTarget(null)} />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0" data-testid="panel-status-filters">
              {FILTER_ORDER.map(category => {
                const config = STATUS_CONFIG[category];
                const isActive = activeFilters.has(category);
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => toggleFilter(category)}
                    aria-pressed={isActive}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-md border-2 text-xs font-medium transition-all duration-200 cursor-pointer select-none
                      ${isActive
                        ? `${config.borderColor} ${config.bgColor} ${config.shadowColor} shadow-md`
                        : "border-border/40 bg-muted/30 opacity-60 hover:opacity-80"
                      }
                    `}
                    data-testid={`button-filter-${category}`}
                    data-active={isActive}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${config.color}`} />
                    <span>{config.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCgnFilterActive(!cgnFilterActive)}
                aria-pressed={cgnFilterActive}
                className={`
                  flex items-center gap-2 px-3 py-1.5 rounded-md border-2 text-xs font-medium transition-all duration-200 cursor-pointer select-none
                  ${cgnFilterActive
                    ? "border-red-500/50 bg-red-500/10 shadow-[0_0_8px_rgba(239,68,68,0.2)] shadow-md"
                    : "border-border/40 bg-muted/30 opacity-60 hover:opacity-80"
                  }
                `}
                data-testid="button-filter-cgn"
              >
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                <span>CGN</span>
              </button>
            </div>
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Meno, UID, RČ, IČO, email..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-search-subjects"
              />
            </div>
          </div>

          <div style={{ display: selectedIds.size > 0 ? 'block' : 'none' }}>
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border border-primary/20 rounded-md">
              <span className="text-sm font-medium">{selectedIds.size} vybranych</span>
              <Button size="sm" onClick={() => setBulkAssignOpen(true)} data-testid="button-bulk-assign">
                Priradit do skupiny
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelectedIds(new Set())} data-testid="button-clear-selection">
                Zrusit vyber
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 280px)' }}>
              <Table stickyHeader>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input type="checkbox" 
                        checked={(subjects?.length ?? 0) > 0 && selectedIds.size === (subjects?.length ?? 0)}
                        onChange={(e) => {
                          if (e.target.checked && subjects) {
                            setSelectedIds(new Set(subjects.map(s => s.id)));
                          } else {
                            setSelectedIds(new Set());
                          }
                        }}
                        data-testid="checkbox-select-all"
                        className="accent-primary"
                      />
                    </TableHead>
                    {columnVisibility.isVisible("uid") && <TableHead sortKey="uid" sortDirection={sortKey === "uid" ? sortDirection : null} onSort={requestSort}>UID</TableHead>}
                    {columnVisibility.isVisible("registrationStatus") && <TableHead>Overenie</TableHead>}
                    {columnVisibility.isVisible("status") && <TableHead style={{ maxWidth: '150px' }}>Status</TableHead>}
                    {columnVisibility.isVisible("cgn") && <TableHead className="w-10 text-center">CGN</TableHead>}
                    {columnVisibility.isVisible("titul") && <TableHead>Titul</TableHead>}
                    {columnVisibility.isVisible("firstName") && <TableHead sortKey="firstName" sortDirection={sortKey === "firstName" ? sortDirection : null} onSort={requestSort}>Cele meno / Nazov</TableHead>}
                    {columnVisibility.isVisible("ulica") && <TableHead>Ulica</TableHead>}
                    {columnVisibility.isVisible("type") && <TableHead sortKey="type" sortDirection={sortKey === "type" ? sortDirection : null} onSort={requestSort}>Typ subjektu</TableHead>}
                    <TableHead className="w-[100px]">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow style={{ display: isLoading ? 'table-row' : 'none' }}><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell></TableRow>
                  <TableRow style={{ display: !isLoading && (!subjects || subjects.length === 0) ? 'table-row' : 'none' }}><TableCell colSpan={9} className="text-center py-12 text-muted-foreground" data-testid="text-empty-subjects">Ziadne subjekty nenajdene</TableCell></TableRow>
                  {sortedData.map((subject) => {
                    const details = (subject.details || {}) as Record<string, any>;
                    const dynFields = details.dynamicFields || {};
                    const titulPred = dynFields.titul_pred || details.titul_pred || details.titleBefore || '';
                    const titulZa = dynFields.titul_za || details.titul_za || details.titleAfter || '';
                    const titulCompact = [titulPred, titulZa].filter(Boolean).join(' / ') || '-';
                    const ulicaVal = (() => {
                      if (subject.type === 'person' || subject.type === 'szco') {
                        return dynFields.tp_ulica || details.tp_ulica || '';
                      }
                      return dynFields.sidlo_ulica || details.sidlo_ulica || '';
                    })() || '-';
                    const subjectTypeCode = (() => {
                      if (subject.type === 'system') return 'SYS';
                      if (subject.type === 'person') return 'FO';
                      if (subject.type === 'szco') return 'SZCO';
                      if (subject.type === 'company') return 'PO';
                      return subject.type;
                    })();
                    const clientTypeMatch = clientTypes?.find(ct => ct.code === subjectTypeCode);
                    const fullName = (() => {
                      if (subject.type === 'system') return subject.companyName || 'ArutsoK - ATK';
                      if (subject.type === 'person') {
                        const parts = [titulPred, subject.firstName, subject.lastName, titulZa].filter(Boolean);
                        return parts.join(' ') || '-';
                      }
                      if (subject.type === 'szco') {
                        return subject.companyName || [titulPred, subject.firstName, subject.lastName, titulZa].filter(Boolean).join(' ') || '-';
                      }
                      return subject.companyName || '-';
                    })();
                    return (
                      <TableRow key={subject.id} data-testid={`row-subject-${subject.id}`} className="align-middle" onRowClick={() => setViewTarget(subject)}>
                        <TableCell className="align-middle">
                          <input type="checkbox" 
                            checked={selectedIds.has(subject.id)}
                            onChange={(e) => {
                              const next = new Set(selectedIds);
                              if (e.target.checked) next.add(subject.id); else next.delete(subject.id);
                              setSelectedIds(next);
                            }}
                            data-testid={`checkbox-subject-${subject.id}`}
                            className="accent-primary"
                          />
                        </TableCell>
                        {columnVisibility.isVisible("uid") && <TableCell className="font-mono text-xs align-middle">
                          <div className="flex items-center gap-2">
                            <SubjectPhotoThumbnail subjectId={subject.id} photoPath={batchPhotos?.[subject.id]?.filePath} />
                            {formatUid(subject.uid)}
                          </div>
                        </TableCell>}
                        {columnVisibility.isVisible("registrationStatus") && <TableCell className="align-middle">
                          {(() => {
                            const rs = (subject as any).registrationStatus || 'klient';
                            const config = REGISTRATION_STATUS_LABELS[rs] || REGISTRATION_STATUS_LABELS.tiper;
                            return <Badge variant={config.variant} className={config.className} data-testid={`badge-registration-status-${subject.id}`}>{config.label}</Badge>;
                          })()}
                        </TableCell>}
                        {columnVisibility.isVisible("status") && <TableCell className="align-middle !overflow-visible" style={{ maxWidth: '150px', whiteSpace: 'normal', wordBreak: 'break-word', textOverflow: 'clip' }}>
                          {(() => {
                            const status = getSubjectStatus(subject, activeCompanyId);
                            return (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium leading-snug ${status.bgColor} ${status.borderColor} ${status.textColor}`}
                                style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}
                                data-testid={`status-subject-${subject.id}`}
                              >
                                {status.label}
                              </span>
                            );
                          })()}
                        </TableCell>}
                        {columnVisibility.isVisible("cgn") && <TableCell className="text-center align-middle" data-testid={`cgn-cell-${subject.id}`}>
                          <CgnIndicator isCgnActive={details.cgnActive === true} />
                        </TableCell>}
                        {columnVisibility.isVisible("titul") && <TableCell className="text-xs text-muted-foreground align-middle" data-testid={`text-titul-${subject.id}`}>{titulCompact}</TableCell>}
                        {columnVisibility.isVisible("firstName") && <TableCell className="font-medium align-middle" data-testid={`text-fullname-${subject.id}`}>
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-1.5">
                              {fullName}
                              {(subject as any).effectiveListStatus === "cierny" && <span title="Globálny čierny zoznam"><Ban className="w-3.5 h-3.5 text-red-500 shrink-0" /></span>}
                              {(subject as any).effectiveListStatus === "cerveny" && <span title="Lokálny červený zoznam"><AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" /></span>}
                              {(() => {
                                const df = dynFields;
                                const commType = df.typ_komunikacie || "";
                                const noteAccess = df.poznamka_pristup || "";
                                const isAgr = commType.toLowerCase().includes("agresívna");
                                if (isAgr || noteAccess.trim()) {
                                  const hoverText = [isAgr ? `Komunikácia: ${commType}` : "", noteAccess.trim() ? `Poznámka: ${noteAccess}` : ""].filter(Boolean).join("\n");
                                  return <span title={hoverText} data-testid={`alert-behavior-${subject.id}`}><AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0 animate-pulse" /></span>;
                                }
                                return null;
                              })()}
                            </span>
                            {(() => {
                              const isPersonType = subject.type === 'person' || subject.type === 'szco';
                              const bn = subject.birthNumber;
                              const icoVal = dynFields.ico || details.ico || "";
                              if (isPersonType && bn) {
                                return <span className="text-xs text-muted-foreground font-mono" data-testid={`text-rc-${subject.id}`}>RČ: {bn}</span>;
                              }
                              if (!isPersonType && icoVal) {
                                return <span className="text-xs text-muted-foreground font-mono" data-testid={`text-ico-${subject.id}`}>IČO: {icoVal}</span>;
                              }
                              return null;
                            })()}
                            {(() => {
                              const subTags = Array.isArray(details.tags) ? details.tags as string[] : [];
                              return subTags.length > 0 ? <SubjectTagBadges tags={subTags} /> : null;
                            })()}
                          </div>
                        </TableCell>}
                        {columnVisibility.isVisible("ulica") && <TableCell className="text-xs text-muted-foreground align-middle" data-testid={`text-ulica-${subject.id}`}>{ulicaVal}</TableCell>}
                        {columnVisibility.isVisible("type") && <TableCell className="align-middle">
                          <div className="flex items-center gap-2 text-muted-foreground text-xs">
                            {subject.type === 'person' ? <User className="w-3 h-3 flex-shrink-0" /> : <Building2 className="w-3 h-3 flex-shrink-0" />}
                            <span>{clientTypeMatch?.code || subjectTypeCode}</span>
                          </div>
                        </TableCell>}
                        <TableCell className="align-middle">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => setViewTarget(subject)} data-testid={`button-view-subject-${subject.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { window.location.href = `/profil-subjektu?id=${subject.id}`; }} title="Zobraziť profil" data-testid={`button-profil-subject-${subject.id}`}>
                              <ShieldCheck className="w-4 h-4" />
                            </Button>
                            {canEditRecords(appUser) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setEditTarget(subject as any)}
                                data-testid={`button-edit-subject-${subject.id}`}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <InitialRegistrationModal
        open={isInitModalOpen}
        onOpenChange={setIsInitModalOpen}
        onProceed={(data) => {
          setIsInitModalOpen(false);
          setTimeout(() => setEditData(data), 150);
        }}
        onViewSubject={(id) => {
          const found = subjects?.find(s => s.id === id);
          if (found) setViewTarget(found);
        }}
      />
      {bulkAssignOpen && <BulkAssignDialog 
        selectedIds={selectedIds}
        onClose={() => { setBulkAssignOpen(false); setSelectedIds(new Set()); }}
        groups={clientGroups || []}
      />}
      {editTarget && <SubjectEditModal subject={editTarget} onClose={() => setEditTarget(null)} />}
    </div>
  );
}
