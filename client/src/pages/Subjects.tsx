import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSubjects, useCreateSubject, useSubjectCareerHistory } from "@/hooks/use-subjects";
import { useStates } from "@/hooks/use-hierarchy";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAppUser } from "@/hooks/use-app-user";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateSlovak, formatDateTimeSlovak, formatPhone, formatUid, canCreateSubjects, canEditRecords, normalizePhone, smartPadUid, isArchitekt } from "@/lib/utils";
import { validateSlovakRC } from "@shared/rc-validator";
import { validateSlovakICO } from "@shared/ico-validator";
import { getDocumentValidityStatus, isValidityField, isNumberFieldWithExpiredPair, type ValidityResult } from "@/lib/document-validity";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, User, Building2, AlertTriangle, Eye, Calendar, Briefcase, ArrowRight, ArrowLeft, ExternalLink, History, Clock, Wallet, Loader2, CheckCircle2, Pencil, Lock, Users, X, Info, Link2, Unlink, Trash2, CreditCard, Archive, Ban, Boxes, Car, Home, Landmark, ChevronRight, ChevronDown, FolderOpen, Tag, Hash, Package, FileText as FileTextIcon, SquareIcon, TrendingDown, Shield, Save, Database, RefreshCw, Network } from "lucide-react";
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
import { InitialRegistrationModal } from "@/components/initial-registration-modal";
import { DynamicFieldInput } from "@/components/dynamic-field-input";
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

  const isNs = subject.type === 'organization';
  const isVs = subject.type === 'state';
  const osClientTypeId = clientTypes?.find(ct => ct.code === 'OS')?.id;
  const isOs = !!(osClientTypeId && (subject as any).clientTypeId === osClientTypeId);

  const clientType = clientTypes?.find(ct => {
    if (isSystem) return false;
    if (isSzco && ct.code === 'SZCO') return true;
    if (isOs && ct.code === 'OS') return true;
    if (subject.type === 'company' && ct.code === 'PO') return true;
    if (isPerson && ct.code === 'FO') return true;
    if (isNs && ct.code === 'NS') return true;
    if (isVs && ct.code === 'VS') return true;
    return false;
  });

  const clientTypeId = isSystem ? 4 : isSzco ? 3 : isPerson ? 1 : isNs ? 5 : isVs ? 6 : 4;
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
          <span className="text-sm font-medium">{isSystem ? 'Systém' : isPerson ? 'FO' : isSzco ? 'SZCO' : isNs ? 'NS' : isVs ? 'VS' : isOs ? 'OS' : 'PO'} - {isSystem ? 'Koreňový subjekt' : clientType?.name || subject.type}</span>
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

function SubjectHierarchyTab({ subject, appUser }: { subject: any; appUser: any }) {
  const { toast } = useToast();
  const canManipulate = isArchitekt(appUser);
  const [changeParentOpen, setChangeParentOpen] = useState(false);
  const [parentSearch, setParentSearch] = useState("");
  const [detachConfirm, setDetachConfirm] = useState(false);

  const { data: parent } = useQuery<any>({
    queryKey: ["/api/subjects", subject.parentSubjectId],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subject.parentSubjectId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!subject.parentSubjectId,
  });

  const { data: childrenData } = useQuery<any>({
    queryKey: ["/api/subjects", subject.id, "hierarchy-children"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subject.id}/hierarchy`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: searchResults = [] } = useQuery<any[]>({
    queryKey: ["/api/subjects", "parent-search", parentSearch],
    queryFn: async () => {
      if (!parentSearch || parentSearch.length < 2) return [];
      const res = await fetch(`/api/subjects?limit=500`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      const all: any[] = data.subjects || data || [];
      const q = parentSearch.toLowerCase();
      return all.filter((s: any) => {
        const name = [s.firstName, s.lastName, s.companyName].filter(Boolean).join(" ").toLowerCase();
        const uid = (s.uid || "").toLowerCase();
        return (name.includes(q) || uid.includes(q)) && s.id !== subject.id;
      });
    },
    enabled: changeParentOpen && parentSearch.length >= 2,
  });

  const setParentMutation = useMutation({
    mutationFn: async (parentId: number | null) => {
      const res = await apiRequest("PATCH", `/api/subjects/${subject.id}`, { parentSubjectId: parentId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: parentSearch ? "Rodič nastavený" : "Rodič odpojený" });
      setChangeParentOpen(false);
      setDetachConfirm(false);
      setParentSearch("");
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.parentSubjectId] });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err?.message || "Nepodarilo sa zmeniť rodiča.", variant: "destructive" });
    },
  });

  const getSubjectDisplayName = (s: any) => {
    if (s.companyName) return s.companyName;
    return [s.firstName, s.lastName].filter(Boolean).join(" ") || `#${s.id}`;
  };

  const children: any[] = childrenData?.children || [];

  return (
    <div className="space-y-5" data-testid="tab-hierarchia-content">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Network className="w-4 h-4" /> Hierarchická pozícia
        </h4>
        <p className="text-xs text-muted-foreground">
          Subjekt môže byť zaradený do stromovej štruktúry organizácie (Majetkový dáždnik ATK).
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-md border border-border p-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Rodičovský subjekt</p>
              {subject.parentSubjectId && parent ? (
                <div className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                  <a
                    href={`/subjects?openId=${parent.id}`}
                    className="text-sm font-medium hover:underline text-primary"
                    data-testid="text-parent-name"
                  >{getSubjectDisplayName(parent)}</a>
                  {parent.uid && <span className="text-[10px] text-muted-foreground font-mono">{formatUid(parent.uid)}</span>}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground italic" data-testid="text-no-parent">
                  {subject.parentSubjectId ? "Načítavam..." : "(žiadny – koreňový uzol)"}
                </span>
              )}
            </div>
            {canManipulate && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => { setChangeParentOpen(true); setParentSearch(""); }}
                  data-testid="btn-change-parent"
                >
                  <Pencil className="w-3 h-3 mr-1" />
                  Zmeniť rodiča
                </Button>
                {subject.parentSubjectId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-red-500 hover:text-red-400"
                    onClick={() => setDetachConfirm(true)}
                    data-testid="btn-detach-parent"
                  >
                    <Unlink className="w-3 h-3 mr-1" />
                    Odpojiť
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground mb-2">Priami potomkovia ({children.length})</p>
          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground italic" data-testid="text-no-children">Žiadni priami potomkovia</p>
          ) : (
            <div className="space-y-1">
              {children.map((c: any) => (
                <div key={c.id} className="flex items-center gap-2 py-1 px-1" data-testid={`child-subject-${c.id}`}>
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  <a
                    href={`/subjects?openId=${c.id}`}
                    className="text-sm hover:underline text-primary"
                  >{getSubjectDisplayName(c)}</a>
                  {c.uid && <span className="text-[10px] text-muted-foreground font-mono">{formatUid(c.uid)}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {changeParentOpen && (
        <Dialog open onOpenChange={() => setChangeParentOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Zmeniť rodiča subjektu</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  value={parentSearch}
                  onChange={(e) => setParentSearch(e.target.value)}
                  placeholder="Hľadať nového rodiča (min. 2 znaky)..."
                  className="pl-8"
                  autoFocus
                  data-testid="input-parent-search"
                />
              </div>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {parentSearch.length >= 2 && searchResults.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">Žiadne výsledky</p>
                )}
                {searchResults.map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:bg-muted/50 cursor-pointer"
                    onClick={() => !setParentMutation.isPending && setParentMutation.mutate(s.id)}
                    data-testid={`parent-option-${s.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{getSubjectDisplayName(s)}</p>
                      {s.uid && <p className="text-[10px] text-muted-foreground font-mono">{formatUid(s.uid)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setChangeParentOpen(false)} data-testid="btn-cancel-change-parent">
                Zrušiť
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {detachConfirm && (
        <AlertDialog open onOpenChange={() => setDetachConfirm(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Odpojiť od rodiča?</AlertDialogTitle>
              <AlertDialogDescription>
                Subjekt bude odpojený zo stromovej hierarchie. Táto zmena sa zaznamená do histórie.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="btn-cancel-detach-parent">Zrušiť</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => setParentMutation.mutate(null)}
                disabled={setParentMutation.isPending}
                data-testid="btn-confirm-detach-parent"
                className="bg-destructive hover:bg-destructive/90"
              >
                {setParentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Odpojiť
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
              <Button
                variant={activeTab === "hierarchia" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setActiveTab("hierarchia")}
                data-testid="tab-subject-hierarchia"
              >
                <Network className="w-3.5 h-3.5 mr-1" />
                Hierarchia
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

        {activeTab === "hierarchia" && (
          <SubjectHierarchyTab subject={displaySubject} appUser={appUser} />
        )}

        {activeTab === "registre" && (
          <RegistrySnapshotsTab subject={subject} />
        )}
      </div>
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

  const isNsType = subject.type === 'organization';
  const isVsType = subject.type === 'state';
  const osClientTypeIdEdit = clientTypes?.find(ct => ct.code === 'OS')?.id;
  const isOsType = !!(osClientTypeIdEdit && (subject as any).clientTypeId === osClientTypeIdEdit);

  const clientType = clientTypes?.find(ct => {
    if (isSystemType) return false;
    if (isSzco && ct.code === 'SZCO') return true;
    if (isOsType && ct.code === 'OS') return true;
    if (subject.type === 'company' && ct.code === 'PO') return true;
    if (isPerson && ct.code === 'FO') return true;
    if (isNsType && ct.code === 'NS') return true;
    if (isVsType && ct.code === 'VS') return true;
    return false;
  });

  const modalClientTypeId = isSystemType ? 4 : isSzco ? 3 : subject.type === 'company' ? 4 : isNsType ? 5 : isVsType ? 6 : 1;
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
  { key: "titulMeno", label: "Titul / Meno / Priezvisko" },
  { key: "firstName", label: "Celé meno / Názov" },
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
  const [isInitModalOpen, setIsInitModalOpen] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("addNew") === "true") {
      window.history.replaceState({}, "", window.location.pathname);
      return true;
    }
    return false;
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
            <Button onClick={() => { window.location.href = '/novy-subjekt'; }} data-testid="button-add-subject">
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
              <div className="overflow-x-auto">
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
                    {columnVisibility.isVisible("titulMeno") && <TableHead>Titul / Meno / Priezvisko</TableHead>}
                    {columnVisibility.isVisible("firstName") && <TableHead>Celé meno / Názov</TableHead>}
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
                    const ulicaVal = (() => {
                      if (subject.type === 'person' || subject.type === 'szco') {
                        return dynFields.tp_ulica || details.tp_ulica || '';
                      }
                      return dynFields.sidlo_ulica || details.sidlo_ulica || '';
                    })() || '-';
                    const osCtId = clientTypes?.find(ct => ct.code === 'OS')?.id;
                    const isOsSubject = !!(osCtId && (subject as any).clientTypeId === osCtId);
                    const subjectTypeCode = (() => {
                      if (subject.type === 'system') return 'SYS';
                      if (subject.type === 'person') return 'FO';
                      if (subject.type === 'szco') return 'SZCO';
                      if (isOsSubject) return 'OS';
                      if (subject.type === 'company') return 'PO';
                      return subject.type;
                    })();
                    const clientTypeMatch = clientTypes?.find(ct => ct.code === subjectTypeCode);
                    const isPerson = subject.type === 'person';
                    const fullName = (() => {
                      if (subject.type === 'system') return subject.companyName || 'ArutsoK - ATK';
                      if (isPerson) {
                        return [subject.firstName, subject.lastName].filter(Boolean).join(' ') || '-';
                      }
                      return subject.companyName || '-';
                    })();
                    const secondaryFoName = (() => {
                      if (isPerson || subject.type === 'system') return null;
                      const parts = [subject.firstName, subject.lastName].filter(Boolean);
                      return parts.length > 0 ? parts.join(' ') : null;
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
                        {columnVisibility.isVisible("titulMeno") && <TableCell className="text-sm align-middle" data-testid={`text-titul-meno-${subject.id}`}>
                          {[titulPred, subject.firstName, subject.lastName, titulZa].filter(Boolean).join(' ') || '-'}
                        </TableCell>}
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
                            {secondaryFoName && <span className="text-xs text-muted-foreground" data-testid={`text-fo-name-${subject.id}`}>{secondaryFoName}</span>}
                            {(() => {
                              const isPersonType = subject.type === 'person' || subject.type === 'szco';
                              const bn = subject.birthNumber;
                              const icoVal = dynFields.ico || details.ico || "";
                              if (isPersonType && bn) {
                                return <span className="text-xs text-muted-foreground font-mono" data-testid={`text-rc-${subject.id}`}>RČ: {bn}</span>;
                              }
                              if (!isPersonType && icoVal) {
                                const prefix = isOsSubject ? "ID" : "IČO";
                                return <span className="text-xs text-muted-foreground font-mono" data-testid={`text-ico-${subject.id}`}>{prefix}: {icoVal}</span>;
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
          try { sessionStorage.setItem('pridat_subjekt_data', JSON.stringify(data)); } catch {}
          window.location.href = '/pridat-subjekt';
        }}
        onViewSubject={(id) => {
          const found = subjects?.find(s => s.id === id);
          if (found) {
            setViewTarget(found);
          } else {
            window.location.href = `/subjects?openId=${id}`;
          }
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
