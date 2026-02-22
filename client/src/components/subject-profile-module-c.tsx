import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Subject, DocumentEntry, ContactEntry } from "@shared/schema";
import { getFieldsForClientTypeId, getSectionsForClientTypeId, type StaticField, type StaticSection } from "@/lib/staticFieldDefs";
import { getDocumentValidityStatus, isValidityField, isNumberFieldWithExpiredPair } from "@/lib/document-validity";
import { FieldHistoryIndicator } from "@/components/field-history-indicator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";
import { cn } from "@/lib/utils";
import { formatDateSlovak } from "@/lib/utils";
import { PRIORITY_COUNTRY_NAMES, ALL_COUNTRY_NAMES } from "@/lib/countries";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, Plus, Trash2, Users, CreditCard, CheckCircle2 } from "lucide-react";
import {
  Loader2, Pencil, Save, X, AlertTriangle, Shield,
  ShieldCheck, ListPlus, Eye,
} from "lucide-react";

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

const FIELD_TO_SUBJECT_COLUMN: Record<string, string> = {
  meno: "firstName",
  priezvisko: "lastName",
  email: "email",
  telefon: "phone",
  rodne_cislo: "birthNumber",
  cislo_dokladu: "idCardNumber",
  op_cislo: "idCardNumber",
  iban: "iban",
  bic: "swift",
};

const INT_COLUMNS = new Set(["continentId", "stateId", "myCompanyId"]);

const CLIENT_TYPE_OPTIONS = [
  { value: "person", label: "Fyzická osoba", short: "FO" },
  { value: "szco", label: "SZČO", short: "SZČO" },
  { value: "po", label: "Právnická osoba", short: "PO" },
];

const FO_TO_PO_LABEL_OVERRIDES: Record<string, string> = {
  meno: "Obchodné meno",
  rodne_cislo: "IČO",
  tp_ulica: "Ulica (sídlo)",
  tp_supisne: "Súpisné číslo (sídlo)",
  tp_orientacne: "Orientačné číslo (sídlo)",
  tp_psc: "PSČ (sídlo)",
  tp_mesto: "Mesto (sídlo)",
  tp_stat: "Štát (sídlo)",
};

const FO_TO_SZCO_LABEL_OVERRIDES: Record<string, string> = {
  meno: "Meno (konateľ)",
  priezvisko: "Priezvisko (konateľ)",
  rodne_cislo: "IČO",
};

const PO_HIDDEN_FIELDS = new Set([
  "priezvisko", "titul_pred", "titul_za", "rodne_priezvisko",
  "datum_narodenia", "vek", "pohlavie", "miesto_narodenia", "statna_prislusnost",
]);

const SZCO_HIDDEN_FIELDS = new Set<string>([]);

const FO_POVINNE_ROWS: { keys: string[] }[] = [
  { keys: ["titul_pred", "meno", "priezvisko", "titul_za"] },
  { keys: ["rodne_priezvisko", "datum_narodenia", "vek", "pohlavie"] },
  { keys: ["miesto_narodenia", "statna_prislusnost"] },
];

const DOCUMENT_TYPES = ["Občiansky preukaz", "Cestovný pas", "Vodičský preukaz", "Povolenie na pobyt", "Preukaz diplomata", "Iný"];

const ADDRESS_PANEL_FIELDS = {
  tp: { label: "Adresa trvalého pobytu", keys: ["tp_ulica", "tp_supisne", "tp_orientacne", "tp_psc", "tp_mesto", "tp_stat"], requiredKeys: ["tp_ulica", "tp_orientacne", "tp_psc", "tp_mesto"] },
  ka: { label: "Adresa prechodného pobytu", keys: ["ka_ulica", "ka_supisne", "ka_orientacne", "ka_psc", "ka_mesto", "ka_stat"], requiredKeys: [] },
  koa: { label: "Kontaktná adresa", keys: ["koa_ulica", "koa_supisne", "koa_orientacne", "koa_psc", "koa_mesto", "koa_stat"], requiredKeys: [] },
};

const DOC_FIELD_KEYS = ["typ_dokladu", "typ_dokladu_iny", "cislo_dokladu", "platnost_dokladu", "vydal_organ", "kod_vydavajuceho_organu"];
const CONTACT_FIELD_KEYS = ["telefon", "email", "rodne_cislo"];
const ADDRESS_SWITCH_KEYS = ["korespond_rovnaka", "kontaktna_rovnaka"];

interface ModuleCProps {
  subject: Subject;
}

function getFieldWidthClass(fieldKey: string): string {
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
}

function parseRodneCislo(rc: string): { pohlavie?: string; datumNarodenia?: string } {
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
}

function DynamicFieldInput({ field, dynamicValues, setDynamicValues, hasError, disabled, subjectId, labelOverride, shortLabelOverride, synonymCount }: {
  field: StaticField;
  dynamicValues: Record<string, string>;
  setDynamicValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hasError?: boolean;
  disabled?: boolean;
  subjectId?: number;
  labelOverride?: string;
  shortLabelOverride?: string | null;
  synonymCount?: number;
}) {
  const numberFieldValidity = useMemo(() => {
    return isNumberFieldWithExpiredPair(field.fieldKey, dynamicValues);
  }, [field.fieldKey, dynamicValues]);
  const isExpiredNumber = numberFieldValidity?.status === "expired";
  const errorBorder = hasError ? "border-red-500 ring-1 ring-red-500" : isExpiredNumber ? "border-red-500/60 bg-red-500/10 ring-1 ring-red-500/30" : "";
  const displayLabel = labelOverride || field.label || field.fieldKey;
  const displayShortLabel = shortLabelOverride === null ? undefined : (shortLabelOverride || field.shortLabel);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label className={`text-xs truncate block ${hasError ? "text-red-500" : isExpiredNumber ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
          {displayShortLabel ? (
            <>
              <span className="hidden lg:inline">{displayLabel}</span>
              <span className="inline lg:hidden">{displayShortLabel}</span>
            </>
          ) : (
            <span>{displayLabel}</span>
          )}
          {field.isRequired ? " *" : ""}
          {isExpiredNumber && <span className="ml-1 text-red-500 text-[9px]">(neplatný doklad)</span>}
        </Label>
        {subjectId && (
          <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} />
        )}
        {synonymCount !== undefined && synonymCount > 0 && (
          <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 font-mono text-blue-400 border-blue-400/30" title={`${synonymCount} AI synoným`} data-testid={`synonym-count-${field.fieldKey}`}>
            AI:{synonymCount}
          </Badge>
        )}
      </div>
      {field.fieldType === "long_text" ? (
        <Textarea
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          rows={2}
          className={errorBorder}
          disabled={disabled}
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
            disabled={disabled}
            data-testid={`switch-dynamic-${field.fieldKey}`}
          />
          <span className="text-xs text-muted-foreground">{dynamicValues[field.fieldKey] === "true" ? "Ano" : "Nie"}</span>
        </div>
      ) : field.fieldType === "checkbox" ? (
        <div className="flex items-center gap-2 pt-1">
          <Checkbox
            checked={dynamicValues[field.fieldKey] === "true"}
            onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: String(!!checked) }))}
            disabled={disabled}
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
          disabled={disabled}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "email" ? (
        <Input
          type="email"
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          disabled={disabled}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "phone" ? (
        <Input
          type="tel"
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          disabled={disabled}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : field.fieldType === "iban" ? (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value.toUpperCase() }))}
          placeholder="SK00 0000 0000 0000 0000 0000"
          className={`font-mono ${errorBorder}`}
          disabled={disabled}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      ) : (
        <Input
          value={dynamicValues[field.fieldKey] || ""}
          onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
          className={errorBorder}
          disabled={disabled}
          data-testid={`input-dynamic-${field.fieldKey}`}
        />
      )}
    </div>
  );
}

export function SubjectProfileModuleC({ subject }: ModuleCProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editReason, setEditReason] = useState("");

  const clientTypeId = useMemo(() => {
    const ctId = (subject as any).clientTypeId;
    if (ctId) return Number(ctId);
    if (subject.type === "person") return 1;
    if (subject.type === "szco") return 3;
    return 4;
  }, [subject]);

  const [activeClientType, setActiveClientType] = useState<string>(subject.type);

  useEffect(() => {
    setActiveClientType(subject.type);
  }, [subject.type]);

  const labelOverrides = useMemo(() => {
    if (activeClientType === "po") return FO_TO_PO_LABEL_OVERRIDES;
    if (activeClientType === "szco") return FO_TO_SZCO_LABEL_OVERRIDES;
    return {};
  }, [activeClientType]);

  const hiddenFieldKeys = useMemo(() => {
    if (activeClientType === "po") return PO_HIDDEN_FIELDS;
    if (activeClientType === "szco") return SZCO_HIDDEN_FIELDS;
    return new Set<string>();
  }, [activeClientType]);

  function getOverriddenLabel(field: StaticField): string {
    return labelOverrides[field.fieldKey] || field.label || field.fieldKey;
  }

  function getOverriddenShortLabel(field: StaticField): string | undefined {
    if (labelOverrides[field.fieldKey]) return undefined;
    return field.shortLabel;
  }

  function isFieldHiddenByType(fieldKey: string): boolean {
    return hiddenFieldKeys.has(fieldKey);
  }

  const { data: synonymCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/parameter-synonyms/field-counts"],
    enabled: subject.id > 0,
  });

  const isPerson = subject.type === "person";
  const typeFields = getFieldsForClientTypeId(clientTypeId);
  const typeSections = getSectionsForClientTypeId(clientTypeId);

  const details = useMemo(() => {
    return (subject.details || {}) as Record<string, any>;
  }, [subject.details]);

  const existingDynamic = useMemo(() => {
    return (details.dynamicFields || {}) as Record<string, string>;
  }, [details]);

  const existingDocuments = useMemo((): DocumentEntry[] => {
    const dynFields = details.dynamicFields || {};
    if (Array.isArray(dynFields.documents)) return dynFields.documents;
    return [];
  }, [details]);

  const existingContacts = useMemo((): ContactEntry[] => {
    const dynFields = details.dynamicFields || {};
    if (Array.isArray(dynFields.contacts)) return dynFields.contacts;
    const result: ContactEntry[] = [];
    if (subject.phone) result.push({ id: crypto.randomUUID(), type: "phone", value: subject.phone, label: "Primárny", isPrimary: true });
    if (subject.email) result.push({ id: crypto.randomUUID(), type: "email", value: subject.email, label: "Primárny", isPrimary: true });
    return result;
  }, [details, subject.phone, subject.email]);

  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    if (existingDynamic && typeof existingDynamic === 'object') {
      Object.entries(existingDynamic).forEach(([key, val]) => {
        if (key === "documents" || key === "contacts") return;
        initial[key] = String(val || "");
      });
    }
    if (subject.firstName && !initial["meno"]) initial["meno"] = subject.firstName;
    if (subject.lastName && !initial["priezvisko"]) initial["priezvisko"] = subject.lastName;
    if (subject.birthNumber && !initial["rodne_cislo"]) initial["rodne_cislo"] = subject.birthNumber;
    if (subject.email && !initial["email"]) initial["email"] = subject.email;
    if (subject.phone && !initial["telefon"]) initial["telefon"] = subject.phone;
    if (subject.idCardNumber && !initial["cislo_dokladu"]) initial["cislo_dokladu"] = subject.idCardNumber;
    if (!initial["korespond_rovnaka"]) initial["korespond_rovnaka"] = "true";
    if (!initial["kontaktna_rovnaka"]) initial["kontaktna_rovnaka"] = "true";
    return initial;
  });

  const [documents, setDocuments] = useState<DocumentEntry[]>(existingDocuments);
  const [contacts, setContacts] = useState<ContactEntry[]>(() => {
    if (existingContacts.length > 0) return existingContacts;
    return [{ id: crypto.randomUUID(), type: "phone", value: subject.phone || "", label: "Primárny", isPrimary: true }];
  });

  useEffect(() => {
    if (!isPerson) return;
    const rc = dynamicValues["rodne_cislo"]?.trim() || subject.birthNumber?.trim();
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
  }, [isPerson, dynamicValues["rodne_cislo"], subject.birthNumber]);

  function isFieldVisible(field: StaticField): boolean {
    if (!field.visibilityRule) return true;
    const rule = field.visibilityRule as { dependsOn: string; value: string };
    if (!rule.dependsOn || !rule.value) return true;
    const depField = typeFields?.find(f => f.fieldKey === rule.dependsOn);
    if (!depField) return true;
    const depValue = dynamicValues[depField.fieldKey] || "";
    return depValue === rule.value;
  }

  const allAddressKeys = new Set([
    ...Object.values(ADDRESS_PANEL_FIELDS).flatMap(p => p.keys),
    ...ADDRESS_SWITCH_KEYS,
  ]);
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (subject.id === 0) {
        throw new Error("Nie je možné uložiť prázdny profil. Najprv vyberte alebo vytvorte subjekt.");
      }
      const payload: Record<string, any> = {};
      const cleanDynamic = { ...dynamicValues };

      Object.entries(FIELD_TO_SUBJECT_COLUMN).forEach(([fieldKey, colName]) => {
        if (cleanDynamic[fieldKey] !== undefined) {
          if (INT_COLUMNS.has(colName)) {
            payload[colName] = cleanDynamic[fieldKey] ? parseInt(cleanDynamic[fieldKey]) : null;
          } else {
            payload[colName] = cleanDynamic[fieldKey] || null;
          }
          delete cleanDynamic[fieldKey];
        }
      });

      const primaryPhone = contacts.find(c => c.type === "phone" && c.isPrimary)?.value || contacts.find(c => c.type === "phone")?.value || "";
      const primaryEmail = contacts.find(c => c.type === "email" && c.isPrimary)?.value || contacts.find(c => c.type === "email")?.value || "";
      if (primaryPhone) payload.phone = primaryPhone;
      if (primaryEmail) payload.email = primaryEmail;

      if (dynamicValues.meno) payload.firstName = dynamicValues.meno;
      if (dynamicValues.priezvisko) payload.lastName = dynamicValues.priezvisko;

      const existingDetails = (subject.details || {}) as Record<string, any>;
      const dynWithDocs = { ...cleanDynamic, documents, contacts, telefon: primaryPhone };
      payload.details = {
        ...existingDetails,
        dynamicFields: dynWithDocs,
      };

      payload.changeReason = editReason || "Úprava cez Profil subjektu";
      return apiRequest("PATCH", `/api/subjects/${subject.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "field-history"] });
      toast({ title: "Zmeny uložené", description: "Všetky zmeny boli úspešne zapísané do profilu." });
      setIsEditing(false);
      setEditReason("");
    },
    onError: (err: any) => {
      toast({ title: "Chyba pri ukladaní", description: err.message, variant: "destructive" });
    },
  });

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

  const worstDocStatus = useMemo(() => {
    const allDates = documents.map(d => d.validUntil).filter(Boolean);
    const dynValidity = dynamicValues["platnost_dokladu"];
    if (dynValidity) allDates.push(dynValidity);
    if (allDates.length === 0) return "unknown";
    const statuses = allDates.map(d => getDocumentValidityStatus(d));
    if (statuses.some(s => s.status === "expired")) return "expired";
    if (statuses.some(s => s.status === "expiring")) return "expiring";
    return "valid";
  }, [documents, dynamicValues]);

  const renderFieldRow = (rowKeys: string[], rowIdx: number) => {
    const rowEntries = rowKeys
      .map(k => ({ key: k, field: povinneFields.find(f => f.fieldKey === k) }));
    const hasAny = rowEntries.some(e => e.field) || rowEntries.some(e => e.key === "statna_prislusnost");
    if (!hasAny || rowEntries.length === 0) return null;

    return (
      <div key={rowIdx} className="flex flex-wrap gap-4 items-end" data-testid={`row-povinne-${rowIdx}`}>
        {rowEntries.map(({ key, field }) => {
          const widthClass = getFieldWidthClass(key);

          if (isFieldHiddenByType(key)) {
            return <div key={key} className={cn("space-y-1 min-w-0", widthClass)} style={{ display: "none" }} />;
          }

          if (key === "statna_prislusnost") {
            const label = field?.label || "Štátna príslušnosť";
            const prioritySet = new Set(PRIORITY_COUNTRY_NAMES);
            const restCountries = ALL_COUNTRY_NAMES.filter(c => !prioritySet.has(c));
            return (
              <div key={key} className={cn("space-y-1 min-w-0", widthClass)}>
                <Label className="text-xs block text-muted-foreground">
                  {label}
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !dynamicValues[key] && "text-muted-foreground")} disabled={!isEditing} data-testid="select-statna-prislusnost">
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
                            <CommandItem key={c} value={c} onSelect={() => setDynamicValues(prev => ({ ...prev, [key]: c }))}>
                              <Check className={cn("mr-2 h-4 w-4", dynamicValues[key] === c ? "opacity-100" : "opacity-0")} />
                              {c}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        <CommandGroup heading="Všetky krajiny">
                          {restCountries.map(c => (
                            <CommandItem key={c} value={c} onSelect={() => setDynamicValues(prev => ({ ...prev, [key]: c }))}>
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

          const rcSource = dynamicValues["rodne_cislo"]?.trim() || subject.birthNumber?.trim() || "";
          const rcParsedResult = rcSource ? parseRodneCislo(rcSource) : {};
          const isRcAuto = (key === "pohlavie" && !!rcParsedResult.pohlavie) || (key === "datum_narodenia" && !!rcParsedResult.datumNarodenia) || (key === "vek" && !!rcParsedResult.datumNarodenia);
          const rawFieldDef = (typeFields || []).find(f => f.fieldKey === key);
          const hasVisibilityRule = rawFieldDef?.visibilityRule;
          const isVisibleByRule = hasVisibilityRule ? isFieldVisible(rawFieldDef!) : true;
          const resolvedField = field || (hasVisibilityRule ? rawFieldDef : null);

          if (resolvedField) {
            const overriddenLabel = getOverriddenLabel(resolvedField);
            const overriddenShortLabel = getOverriddenShortLabel(resolvedField);
            return (
              <div key={key} className={cn("space-y-1 min-w-0", widthClass)} style={!isVisibleByRule ? { display: "none" } : undefined}>
                <div className="flex items-center gap-1">
                  <Label className="text-xs block text-muted-foreground">
                    {overriddenShortLabel ? (
                      <>
                        <span className="hidden lg:inline">{overriddenLabel}</span>
                        <span className="inline lg:hidden">{overriddenShortLabel}</span>
                      </>
                    ) : (
                      <span>{overriddenLabel}</span>
                    )}
                    {resolvedField.isRequired ? " *" : ""}
                  </Label>
                  <FieldHistoryIndicator subjectId={subject.id} fieldKey={key} fieldLabel={overriddenLabel} />
                  {synonymCounts && synonymCounts[key] > 0 && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 font-mono text-blue-400 border-blue-400/30" title={`${synonymCounts[key]} AI synoným`} data-testid={`synonym-count-${key}`}>
                      AI:{synonymCounts[key]}
                    </Badge>
                  )}
                </div>
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
                      <Select value={dynamicValues[resolvedField.fieldKey] || ""} onValueChange={val => setDynamicValues(prev => ({ ...prev, [resolvedField.fieldKey]: val }))} disabled={!isEditing}>
                        <SelectTrigger data-testid={`select-dynamic-${resolvedField.fieldKey}`}>
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
                  <Select value={dynamicValues[resolvedField.fieldKey] || ""} onValueChange={val => setDynamicValues(prev => ({ ...prev, [resolvedField.fieldKey]: val }))} disabled={!isEditing}>
                    <SelectTrigger data-testid={`select-dynamic-${resolvedField.fieldKey}`}>
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
                          onChange={e => { if (!isEditing && isRcAuto) return; setDynamicValues(prev => ({ ...prev, [resolvedField.fieldKey]: e.target.value })); }}
                          readOnly={!isEditing && isRcAuto}
                          tabIndex={!isEditing && isRcAuto ? -1 : undefined}
                          disabled={!isEditing}
                          className={cn(validityClass, (!isEditing || isRcAuto) && "bg-muted/50 cursor-default", validityLabel && "pr-[5.5rem]")}
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
                ) : (
                  <Input
                    placeholder=""
                    value={dynamicValues[key] || ""}
                    onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))}
                    disabled={!isEditing}
                    data-testid={`input-dynamic-${key}`}
                  />
                )}
              </div>
            );
          }
          return null;
        })}
      </div>
    );
  };

  const renderAddressPanel = (prefix: "tp" | "ka" | "koa", panelDef: typeof ADDRESS_PANEL_FIELDS["tp"], disabled: boolean) => {
    const findField = (key: string) => povinneFields.find(f => f.fieldKey === key);
    const fieldKeys = [`${prefix}_ulica`, `${prefix}_supisne`, `${prefix}_orientacne`, `${prefix}_psc`, `${prefix}_mesto`, `${prefix}_stat`];
    const fields = fieldKeys.map(k => ({ key: k, field: findField(k), suffix: k.split("_").slice(1).join("_"), hidden: false }));
    const visibleFields = fields.filter(f => !f.hidden);
    const isRequired = (key: string) => panelDef.requiredKeys.includes(key);

    if (visibleFields.length === 0) return null;

    const ADDR_SHORT_LABELS: Record<string, string> = {
      ulica: "Ulica", supisne: "Súpisné č.", orientacne: "Orient. č.",
      psc: "PSČ", mesto: "Obec / Mesto", stat: "Štát",
    };

    const renderAddrField = (key: string, _field: StaticField | undefined, suffix: string, widthPct?: number) => {
      const label = ADDR_SHORT_LABELS[suffix] || suffix;
      const req = isRequired(key);
      const wrapStyle = widthPct ? { flex: `0 1 ${widthPct}%`, minWidth: 0 } : {};
      return (
        <div key={key} style={{ ...wrapStyle, pointerEvents: disabled ? "none" : "auto" }}>
          <div className="space-y-1">
            <Label className="text-xs truncate block text-muted-foreground">{label}{req ? " *" : ""}</Label>
            <Input
              disabled={disabled || !isEditing}
              value={dynamicValues[key] || ""}
              onChange={e => setDynamicValues(prev => ({ ...prev, [key]: e.target.value }))}
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
          <p className="text-sm font-semibold truncate" title={activeClientType === "po" && prefix === "tp" ? "Sídlo spoločnosti" : panelDef.label}>{activeClientType === "po" && prefix === "tp" ? "Sídlo spoločnosti" : panelDef.label}</p>
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
          {fStat && (() => {
            const statKey = fStat.key;
            const statLabel = ADDR_SHORT_LABELS["stat"] || "Štát";
            const prioritySet = new Set(PRIORITY_COUNTRY_NAMES);
            const restCountries = ALL_COUNTRY_NAMES.filter(c => !prioritySet.has(c));
            return (
              <div data-testid={`addr-row-stat-${prefix}`} style={{ pointerEvents: disabled ? "none" : "auto" }}>
                <div className="space-y-1">
                  <Label className="text-xs truncate block text-muted-foreground">{statLabel}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", !dynamicValues[statKey] && "text-muted-foreground")} disabled={!isEditing} data-testid={`select-addr-stat-${prefix}`}>
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
                            {restCountries.map(c => (
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
          })()}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4" data-testid="module-c-profile">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Profil subjektu</h2>
          <Select value={activeClientType} onValueChange={setActiveClientType}>
            <SelectTrigger className="h-7 w-[160px] text-xs" data-testid="select-client-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CLIENT_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Input
                value={editReason}
                onChange={e => setEditReason(e.target.value)}
                placeholder="Dôvod zmeny..."
                className="h-8 text-xs w-48"
                data-testid="edit-reason-input"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setIsEditing(false); setEditReason(""); }}
                data-testid="btn-cancel-edit"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Zrušiť
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || subject.id === 0}
                data-testid="btn-save-edit"
              >
                {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Uložiť
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
              disabled={subject.id === 0}
              title={subject.id === 0 ? "Najprv vyberte subjekt" : "Upraviť profil"}
              data-testid="btn-start-edit"
            >
              <Pencil className="w-3.5 h-3.5 mr-1" />
              Upraviť
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {isPerson ? (
        <Accordion type="multiple" defaultValue={["povinne", "doplnkove", "volitelne"]} className="space-y-2">
          <AccordionItem value="povinne" className="border rounded-md px-3" data-testid="editor-accordion-povinne">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold">{FOLDER_CATEGORY_LABELS["povinne"]}</span>
                <Badge variant="secondary" className="text-[10px]">{povinneFields.length + 3}</Badge>
                {worstDocStatus !== "unknown" && (
                  <span className={cn("w-2.5 h-2.5 rounded-full", worstDocStatus === "expired" ? "bg-red-500" : worstDocStatus === "expiring" ? "bg-orange-500" : "bg-emerald-500")} data-testid="semaphore-povinne" title={worstDocStatus === "expired" ? "Neplatný doklad" : worstDocStatus === "expiring" ? "Doklad expiruje do 90 dní" : "Všetky doklady platné"} />
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-2">
              <div className="flex flex-wrap gap-4 items-end" data-testid="row-system-fields">
                <div className="space-y-1 w-[200px] min-w-[160px] shrink-0">
                  <Label className="text-xs">Kód klienta</Label>
                  <Input value={subject.uid || ""} disabled className="font-mono text-xs" data-testid="input-kod-klienta" />
                </div>
                <div className="space-y-1 w-[200px] min-w-[160px] shrink-0">
                  <Label className="text-xs">Typ klienta</Label>
                  <Input value={CLIENT_TYPE_OPTIONS.find(o => o.value === activeClientType)?.label || "Fyzická osoba"} disabled data-testid="input-typ-klienta" />
                </div>
                <div className="space-y-1 flex-1 min-w-[180px]">
                  <Label className="text-xs">Identifikátor ({activeClientType === "po" ? "IČO" : activeClientType === "szco" ? "IČO" : "Rodné číslo"})</Label>
                  <Input value={subject.birthNumber || ""} disabled className="font-mono" data-testid="input-identifikator" />
                </div>
              </div>

              <Card data-testid="panel-osobne-udaje">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm font-semibold">Osobné údaje</p>
                  {FO_POVINNE_ROWS.map((row, rowIdx) => renderFieldRow(row.keys, rowIdx))}
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
                    {isEditing && (
                      <Button type="button" variant="outline" size="sm" onClick={addNewDocument} data-testid="button-add-document">
                        <Plus className="w-3 h-3 mr-1" />
                        Pridať doklad
                      </Button>
                    )}
                  </div>

                  {documents.length === 0 && (
                    <div className="text-center py-6 text-muted-foreground" data-testid="text-no-documents">
                      <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Žiadne doklady totožnosti</p>
                      {isEditing && <p className="text-xs">Kliknite "Pridať doklad" pre pridanie dokladu</p>}
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
                                {expired && <Badge variant="destructive" className="text-[10px]"><span className={cn("w-2 h-2 rounded-full inline-block mr-1", "bg-red-500")} />Expirovaný</Badge>}
                                {expiringSoon && !expired && <Badge className="text-[10px] bg-orange-500/20 text-orange-400 border-orange-500/30"><span className={cn("w-2 h-2 rounded-full inline-block mr-1", "bg-orange-500")} />Expiruje čoskoro</Badge>}
                                {!expired && !expiringSoon && doc.validUntil && <Badge variant="secondary" className="text-[10px]"><span className={cn("w-2 h-2 rounded-full inline-block mr-1", "bg-emerald-500")} />Platný</Badge>}
                              </div>
                              {isEditing && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeDocument(doc.id)} data-testid={`button-remove-document-${docIdx}`}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-3 items-end">
                              <div className="space-y-1 flex-1 min-w-[140px]">
                                <Label className="text-xs text-muted-foreground">Typ dokladu *</Label>
                                <Select value={doc.documentType || ""} onValueChange={val => updateDocument(doc.id, "documentType", val)} disabled={!isEditing}>
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
                                    disabled={!isEditing}
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
                                  disabled={!isEditing}
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
                                  disabled={!isEditing}
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
                                  disabled={!isEditing}
                                  data-testid={`input-doc-issued-${docIdx}`}
                                />
                              </div>
                              <div className="space-y-1 flex-1 min-w-[120px]">
                                <Label className="text-xs text-muted-foreground">Kód orgánu</Label>
                                <Input
                                  value={doc.issuingAuthorityCode || ""}
                                  onChange={e => updateDocument(doc.id, "issuingAuthorityCode", e.target.value)}
                                  disabled={!isEditing}
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
                const showKa = !korRespondRovnaka;
                const showKoa = !kontaktnaRovnaka;
                const panelCount = 1 + (showKa ? 1 : 0) + (showKoa ? 1 : 0);

                return (
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-1" data-testid="row-address-switches">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={korRespondRovnaka}
                          onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, korespond_rovnaka: String(checked) }))}
                          disabled={!isEditing}
                          data-testid="switch-korespond-rovnaka"
                        />
                        <Label className="text-xs cursor-pointer">
                          Adresa prechodného pobytu je totožná z adresou trvalého pobytu
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={kontaktnaRovnaka}
                          onCheckedChange={checked => setDynamicValues(prev => ({ ...prev, kontaktna_rovnaka: String(checked) }))}
                          disabled={!isEditing}
                          data-testid="switch-kontaktna-rovnaka"
                        />
                        <Label className="text-xs cursor-pointer">
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
                    {isEditing && (
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
                    )}
                  </div>

                  <div className="space-y-2">
                    {contacts.map((contact, cIdx) => (
                      <div key={contact.id} className="flex flex-wrap gap-3 items-end p-2 rounded-md border border-border bg-muted/20" data-testid={`contact-row-${cIdx}`}>
                        <div className="space-y-1 w-[100px] min-w-[80px] shrink-0">
                          <Label className="text-xs text-muted-foreground">Typ</Label>
                          <Select value={contact.type} onValueChange={val => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, type: val as "phone" | "email" } : c))} disabled={!isEditing}>
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
                          <Input
                            type={contact.type === "phone" ? "tel" : "email"}
                            value={contact.value}
                            onChange={e => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, value: e.target.value } : c))}
                            placeholder={contact.type === "phone" ? "+421..." : "meno@priklad.sk"}
                            disabled={!isEditing}
                            data-testid={`input-contact-value-${cIdx}`}
                          />
                        </div>
                        <div className="space-y-1 w-[120px] min-w-[100px] shrink-0">
                          <Label className="text-xs text-muted-foreground">Označenie</Label>
                          <Input
                            value={contact.label || ""}
                            onChange={e => setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, label: e.target.value } : c))}
                            placeholder="napr. Osobný"
                            disabled={!isEditing}
                            data-testid={`input-contact-label-${cIdx}`}
                          />
                        </div>
                        <div className="flex items-center gap-1 pb-0.5">
                          {!contact.isPrimary && isEditing && (
                            <Button type="button" variant="ghost" size="icon" onClick={() => setContacts(prev => prev.map(c => c.type === contact.type ? { ...c, isPrimary: c.id === contact.id } : c))} title="Nastaviť ako primárny" data-testid={`button-set-primary-${cIdx}`}>
                              <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          )}
                          {contact.isPrimary && (
                            <Badge variant="secondary" className="text-[10px]">Primárny</Badge>
                          )}
                          {contacts.length > 1 && isEditing && (
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
                        <div key={field.id} className="min-w-0 flex-1 min-w-[140px]">
                          <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} disabled={!isEditing} subjectId={subject.id} />
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
                              <div key={field.id} className={cn("min-w-0", wCls)}>
                                <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} disabled={!isEditing} subjectId={subject.id} />
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
      ) : (
        <Accordion type="multiple" defaultValue={["povinne", "doplnkove"]} className="space-y-2">
          {FOLDER_CATEGORY_ORDER.map(category => {
            const Icon = FOLDER_CATEGORY_ICONS[category];
            const editorFieldGroups: { section: any; fields: StaticField[] }[] = [];
            const catSections = [...(typeSections || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            for (const section of catSections) {
              const cat = (section as any).folderCategory || "volitelne";
              if (cat !== category) continue;
              const sectionFields = (typeFields || [])
                .filter(f => (f.sectionId || 0) === section.id)
                .filter(f => isFieldVisible(f))
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
              if (sectionFields.length > 0) {
                editorFieldGroups.push({ section, fields: sectionFields });
              }
            }
            const totalFields = editorFieldGroups.reduce((acc, g) => acc + g.fields.length, 0);
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
                  <div className="space-y-2">
                    {editorFieldGroups.map(({ section, fields }) => (
                      <div key={section.id} className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1" style={{ display: editorFieldGroups.length > 1 ? 'block' : 'none' }}>{section.name}</p>
                        <div className="flex flex-wrap gap-4 items-end">
                          {fields.map((field: StaticField) => {
                            const fk = field.fieldKey;
                            let wCls = "flex-1 min-w-[140px]";
                            if (fk === "titul_pred" || fk === "titul_za") wCls = "w-[100px] min-w-[80px] shrink-0";
                            else if (fk === "vek") wCls = "w-[80px] min-w-[60px] shrink-0";
                            else if (fk === "pohlavie") wCls = "w-[130px] min-w-[100px] shrink-0";
                            return (
                              <div key={field.id} className={cn("min-w-0", wCls)}>
                                <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} disabled={!isEditing} subjectId={subject.id} />
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
      )}
    </div>
  );
}
