import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Subject } from "@shared/schema";
import { type StaticField } from "@/lib/staticFieldDefs";
import { getCategoriesForClientType } from "@/lib/staticFieldDefs";
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
import {
  Loader2, Pencil, Save, X, Shield,
  ShieldCheck, ListPlus, Eye, ArrowUp, ArrowDown, Settings2, MoreHorizontal,
  Check, User, Phone, Star, Brain, Zap, Link2, Archive, CreditCard, Users,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const FOLDER_CATEGORY_LABELS: Record<string, string> = {
  povinne: "POVINNÉ ÚDAJE",
  doplnkove: "DOPLNKOVÉ ÚDAJE",
  volitelne: "VOLITEĽNÉ / DOBROVOĽNÉ ÚDAJE",
  ine: "INÉ ÚDAJE",
  extrahovane: "EXTRAHOVANÉ ÚDAJE",
};

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

interface ModuleCProps {
  subject: Subject;
}

interface DbSection {
  id: number;
  name: string;
  folderCategory: string;
  sortOrder: number;
  clientTypeId: number;
}

interface DbParameter {
  id: number;
  clientTypeId: number;
  sectionId: number | null;
  fieldKey: string;
  label: string;
  shortLabel: string | null;
  fieldType: string;
  isRequired: boolean;
  isHidden: boolean;
  options: string[] | null;
  defaultValue: string | null;
  visibilityRule: any;
  unit: string | null;
  decimalPlaces: number;
  fieldCategory: string;
  categoryCode: string | null;
  sortOrder: number;
  rowNumber: number;
  widthPercent: number;
  isActive: boolean;
  code: string | null;
}

function dbParamToStaticField(p: DbParameter): StaticField {
  return {
    id: p.id,
    clientTypeId: p.clientTypeId,
    sectionId: p.sectionId,
    panelId: null,
    fieldKey: p.fieldKey,
    label: p.label,
    shortLabel: p.shortLabel || undefined,
    fieldType: p.fieldType,
    isRequired: p.isRequired,
    isHidden: p.isHidden,
    options: Array.isArray(p.options) ? p.options : [],
    defaultValue: p.defaultValue,
    visibilityRule: p.visibilityRule,
    unit: p.unit,
    decimalPlaces: p.decimalPlaces,
    fieldCategory: p.fieldCategory,
    categoryCode: p.categoryCode || undefined,
    sortOrder: p.sortOrder,
    rowNumber: p.rowNumber,
    widthPercent: p.widthPercent,
  };
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

  const { data: synonymCounts } = useQuery<Record<string, number>>({
    queryKey: ["/api/parameter-synonyms/field-counts"],
    enabled: subject.id > 0,
  });

  interface UnifiedCatalogData {
    categoryCounts: Record<string, { fields: number; dataPoints: number }>;
    activeSubjects: number;
    totalFields: number;
    totalDataPoints: number;
    totalDynamic: number;
    totalContract: number;
  }

  const { data: unifiedCatalog } = useQuery<UnifiedCatalogData>({
    queryKey: [`/api/unified-catalog/counts?clientTypeId=${clientTypeId}`],
    enabled: subject.id > 0,
  });

  const { data: dbSections } = useQuery<DbSection[]>({
    queryKey: ["/api/subject-param-sections", { clientTypeId }],
    queryFn: async () => {
      const res = await fetch(`/api/subject-param-sections?clientTypeId=${clientTypeId}`);
      if (!res.ok) throw new Error("Failed to fetch sections");
      return res.json();
    },
  });

  const { data: dbParameters } = useQuery<DbParameter[]>({
    queryKey: ["/api/subject-parameters", { clientTypeId }],
    queryFn: async () => {
      const res = await fetch(`/api/subject-parameters?clientTypeId=${clientTypeId}`);
      if (!res.ok) throw new Error("Failed to fetch parameters");
      return res.json();
    },
  });

  const dbGroupedByCategory = useMemo(() => {
    if (!dbSections || !dbParameters) return {};

    const activeParams = dbParameters.filter(p => p.isActive && !p.isHidden);
    const result: Record<string, { section: DbSection; fields: DbParameter[] }[]> = {};

    const sortedSections = [...dbSections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    for (const section of sortedSections) {
      const category = section.folderCategory || "doplnkove";
      const sectionFields = activeParams
        .filter(p => p.sectionId === section.id)
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      if (sectionFields.length === 0) continue;

      if (!result[category]) result[category] = [];
      result[category].push({ section, fields: sectionFields });
    }

    return result;
  }, [dbSections, dbParameters]);

  const [isArchitectMode, setIsArchitectMode] = useState(false);
  const [fieldLayouts, setFieldLayouts] = useState<Record<string, { sortOrder: number; widthClass: string; rowGroup: number }>>({});

  const { data: savedLayouts } = useQuery<any[]>({
    queryKey: ["/api/field-layout-configs"],
  });

  useEffect(() => {
    if (savedLayouts && savedLayouts.length > 0) {
      const map: Record<string, { sortOrder: number; widthClass: string; rowGroup: number }> = {};
      for (const cfg of savedLayouts) {
        map[`${cfg.clientType}::${cfg.sectionCategory}::${cfg.fieldKey}`] = {
          sortOrder: cfg.sortOrder,
          widthClass: cfg.widthClass,
          rowGroup: cfg.rowGroup,
        };
      }
      setFieldLayouts(map);
    }
  }, [savedLayouts]);

  const saveLayoutMutation = useMutation({
    mutationFn: async () => {
      const configs = Object.entries(fieldLayouts).map(([key, val]) => {
        const [clientType, sectionCategory, fieldKey] = key.split("::");
        return { clientType, sectionCategory, fieldKey, ...val };
      });
      return apiRequest("POST", "/api/field-layout-configs/save", { configs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/field-layout-configs"] });
      toast({ title: "Layout uložený", description: "Pozície a rozmery polí boli uložené." });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  const WIDTH_OPTIONS = [
    { label: "XS", value: "w-[80px] min-w-[60px] shrink-0" },
    { label: "S", value: "w-[120px] min-w-[100px] shrink-0" },
    { label: "M", value: "w-[180px] min-w-[140px] shrink-0" },
    { label: "L", value: "flex-1 min-w-[180px]" },
    { label: "XL", value: "flex-1 min-w-[250px]" },
    { label: "FULL", value: "w-full" },
  ];

  function getLayoutKey(fieldKey: string, sectionCategory: string = "povinne"): string {
    return `${activeClientType}::${sectionCategory}::${fieldKey}`;
  }

  function getFieldLayout(fieldKey: string, sectionCategory: string = "povinne") {
    return fieldLayouts[getLayoutKey(fieldKey, sectionCategory)];
  }

  function updateFieldLayout(fieldKey: string, sectionCategory: string, updates: Partial<{ sortOrder: number; widthClass: string; rowGroup: number }>) {
    const key = `${activeClientType}::${sectionCategory}::${fieldKey}`;
    setFieldLayouts(prev => ({
      ...prev,
      [key]: {
        sortOrder: prev[key]?.sortOrder ?? 0,
        widthClass: prev[key]?.widthClass ?? "flex-1 min-w-[140px]",
        rowGroup: prev[key]?.rowGroup ?? 0,
        ...updates,
      },
    }));
  }

  function moveField(fieldKey: string, sectionCategory: string, direction: "up" | "down") {
    const key = getLayoutKey(fieldKey, sectionCategory);
    const current = fieldLayouts[key]?.sortOrder ?? 0;
    updateFieldLayout(fieldKey, sectionCategory, { sortOrder: current + (direction === "up" ? -1 : 1) });
  }

  const details = useMemo(() => {
    return (subject.details || {}) as Record<string, any>;
  }, [subject.details]);

  const existingDynamic = useMemo(() => {
    return (details.dynamicFields || {}) as Record<string, string>;
  }, [details]);

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
    return initial;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
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

      if (dynamicValues.meno) payload.firstName = dynamicValues.meno;
      if (dynamicValues.priezvisko) payload.lastName = dynamicValues.priezvisko;
      if (dynamicValues.telefon) payload.phone = dynamicValues.telefon;
      if (dynamicValues.email) payload.email = dynamicValues.email;

      const existingDetails = (subject.details || {}) as Record<string, any>;
      payload.details = {
        ...existingDetails,
        dynamicFields: cleanDynamic,
      };

      if (subject.id === 0) {
        payload.type = activeClientType || "person";
        payload.changeReason = editReason || "Vytvorenie cez Profil subjektu";
        const res = await apiRequest("POST", "/api/subjects", payload);
        return res;
      }

      payload.changeReason = editReason || "Úprava cez Profil subjektu";
      return apiRequest("PATCH", `/api/subjects/${subject.id}`, payload);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      if (subject.id === 0 && data?.id) {
        toast({ title: "Subjekt vytvorený", description: "Nový subjekt bol úspešne vytvorený." });
        window.location.href = `/profil-subjektu?id=${data.id}`;
        return;
      }
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

  const ArchitectFieldOverlay = ({ fieldKey, sectionCategory }: { fieldKey: string; sectionCategory: string }) => {
    if (!isArchitectMode) return null;
    const layout = getFieldLayout(fieldKey, sectionCategory);
    const currentWidth = layout?.widthClass || "flex-1 min-w-[140px]";

    return (
      <div className="absolute -top-1 -right-1 z-10 flex items-center gap-0.5 bg-amber-500/90 rounded px-1 py-0.5 shadow-md" data-testid={`architect-controls-${fieldKey}`}>
        <button onClick={() => moveField(fieldKey, sectionCategory, "up")} className="text-black hover:text-white p-0.5" title="Posunúť hore"><ArrowUp className="w-3 h-3" /></button>
        <button onClick={() => moveField(fieldKey, sectionCategory, "down")} className="text-black hover:text-white p-0.5" title="Posunúť dole"><ArrowDown className="w-3 h-3" /></button>
        <select
          value={currentWidth}
          onChange={e => updateFieldLayout(fieldKey, sectionCategory, { widthClass: e.target.value })}
          className="h-4 text-[9px] bg-transparent text-black border-0 outline-none cursor-pointer"
          data-testid={`architect-width-${fieldKey}`}
        >
          {WIDTH_OPTIONS.map(w => (
            <option key={w.label} value={w.value}>{w.label}</option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="module-c-profile">
      <div className="space-y-3" data-testid="module-c-header">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Profil subjektu<sup className="text-[9px] text-primary/70 font-medium ml-0.5">(C)</sup></h2>
            <Button
              size="sm"
              variant={isArchitectMode ? "default" : "ghost"}
              onClick={() => setIsArchitectMode(!isArchitectMode)}
              data-testid="btn-architect-mode"
              title="Režim Architekt"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
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
                  disabled={saveMutation.isPending}
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
                title="Upraviť profil"
                data-testid="btn-start-edit"
              >
                <Pencil className="w-3.5 h-3.5 mr-1" />
                Upraviť
              </Button>
            )}
          </div>
        </div>
        <div className="flex justify-center">
          <div className="inline-flex rounded-lg border-2 border-primary/30 shadow-md p-1 bg-muted/30" data-testid="toggle-client-type-wrapper">
            <ToggleGroup type="single" value={activeClientType} onValueChange={(val) => { if (val) setActiveClientType(val); }} className="h-9" data-testid="toggle-client-type">
              {CLIENT_TYPE_OPTIONS.map(opt => (
                <ToggleGroupItem key={opt.value} value={opt.value} className="h-9 px-8 text-sm font-semibold data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-sm" data-testid={`toggle-type-${opt.value}`}>
                  {opt.short}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      </div>

      <Separator />

      {isArchitectMode && (
        <div className="flex items-center justify-between p-2 rounded-md bg-amber-500/10 border border-amber-500/30" data-testid="architect-bar">
          <div className="flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-amber-500">REŽIM ARCHITEKT</span>
            <span className="text-xs text-muted-foreground">Použite šípky a veľkosť pre zmenu rozloženia polí</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setIsArchitectMode(false)} className="h-7 text-xs" data-testid="btn-architect-cancel">
              Zrušiť
            </Button>
            <Button size="sm" onClick={() => { saveLayoutMutation.mutate(); setIsArchitectMode(false); }} disabled={saveLayoutMutation.isPending} className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-black" data-testid="btn-architect-accept">
              {saveLayoutMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
              Akceptovať zmeny
            </Button>
          </div>
        </div>
      )}

      <Accordion type="multiple" defaultValue={["povinne", "doplnkove", "volitelne", "ine", "extrahovane"]} className="space-y-2">
        <AccordionItem value="povinne" className="border rounded-md px-3" data-testid="editor-accordion-povinne">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-destructive" />
              <span className="text-sm font-semibold">POVINNÉ ÚDAJE</span>
              <Badge variant="secondary" className="text-[10px]">
                {3 + (dbGroupedByCategory["povinne"] || []).reduce((sum, g) => sum + g.fields.length, 0)}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="flex flex-wrap gap-4 items-end" data-testid="row-system-fields">
              <div className="space-y-1 flex-1 min-w-[160px]">
                <Label className="text-xs">Kód klienta</Label>
                <Input value={subject.uid || ""} disabled className="font-mono text-xs" data-testid="input-kod-klienta" />
              </div>
              <div className="space-y-1 flex-1 min-w-[160px]">
                <Label className="text-xs">Typ klienta</Label>
                <Input value={CLIENT_TYPE_OPTIONS.find(o => o.value === activeClientType)?.label || "Fyzická osoba"} disabled data-testid="input-typ-klienta" />
              </div>
              <div className="space-y-1 flex-1 min-w-[160px]">
                <Label className="text-xs">Identifikátor ({activeClientType === "po" ? "IČO" : activeClientType === "szco" ? "IČO" : "Rodné číslo"})</Label>
                <Input value={subject.birthNumber || ""} disabled className="font-mono" data-testid="input-identifikator" />
              </div>
            </div>

            {(dbGroupedByCategory["povinne"] || []).map(({ section, fields }) => (
              <div key={section.id} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1">{section.name}</p>
                <div className="flex flex-wrap gap-4 items-end">
                  {fields.map(param => {
                    const field = dbParamToStaticField(param);
                    return (
                      <div key={field.id} className={cn("min-w-0 relative", "flex-1 min-w-[140px]")}>
                        <ArchitectFieldOverlay fieldKey={field.fieldKey} sectionCategory="povinne" />
                        <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} disabled={!isEditing} subjectId={subject.id} synonymCount={synonymCounts?.[field.fieldKey]} />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="doplnkove" className="border rounded-md px-3" data-testid="editor-accordion-doplnkove">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <ListPlus className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">DOPLNKOVÉ ÚDAJE</span>
              <Badge variant="secondary" className="text-[10px]">
                {(dbGroupedByCategory["doplnkove"] || []).reduce((sum, g) => sum + g.fields.length, 0)}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            {(dbGroupedByCategory["doplnkove"] || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Žiadne doplnkové parametre v šablóne (B)</p>
            ) : (
              (dbGroupedByCategory["doplnkove"] || []).map(({ section, fields }) => (
                <div key={section.id} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1">{section.name}</p>
                  <div className="flex flex-wrap gap-4 items-end">
                    {fields.map(param => {
                      const field = dbParamToStaticField(param);
                      return (
                        <div key={field.id} className={cn("min-w-0 relative", "flex-1 min-w-[140px]")}>
                          <ArchitectFieldOverlay fieldKey={field.fieldKey} sectionCategory="doplnkove" />
                          <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} disabled={!isEditing} subjectId={subject.id} synonymCount={synonymCounts?.[field.fieldKey]} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="volitelne" className="border rounded-md px-3" data-testid="editor-accordion-volitelne">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">VOLITEĽNÉ / DOBROVOĽNÉ ÚDAJE</span>
              <Badge variant="secondary" className="text-[10px]">
                {(dbGroupedByCategory["volitelne"] || []).reduce((sum, g) => sum + g.fields.length, 0)}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            {(dbGroupedByCategory["volitelne"] || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Žiadne voliteľné parametre v šablóne (B)</p>
            ) : (
              (dbGroupedByCategory["volitelne"] || []).map(({ section, fields }) => (
                <div key={section.id} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1">{section.name}</p>
                  <div className="flex flex-wrap gap-4 items-end">
                    {fields.map(param => {
                      const field = dbParamToStaticField(param);
                      return (
                        <div key={field.id} className={cn("min-w-0 relative", "flex-1 min-w-[140px]")}>
                          <ArchitectFieldOverlay fieldKey={field.fieldKey} sectionCategory="volitelne" />
                          <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} disabled={!isEditing} subjectId={subject.id} synonymCount={synonymCounts?.[field.fieldKey]} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </AccordionContent>
        </AccordionItem>

        {(dbGroupedByCategory["ine"] || []).length > 0 && (
          <AccordionItem value="ine" className="border rounded-md px-3" data-testid="editor-accordion-ine">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-semibold">INÉ ÚDAJE</span>
                <Badge variant="secondary" className="text-[10px]">
                  {(dbGroupedByCategory["ine"] || []).reduce((sum, g) => sum + g.fields.length, 0)}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              {(dbGroupedByCategory["ine"] || []).map(({ section, fields }) => (
                <div key={section.id} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide border-b border-border pb-1">{section.name}</p>
                  <div className="flex flex-wrap gap-4 items-end">
                    {fields.map(param => {
                      const field = dbParamToStaticField(param);
                      return (
                        <div key={field.id} className={cn("min-w-0 relative", "flex-1 min-w-[140px]")}>
                          <ArchitectFieldOverlay fieldKey={field.fieldKey} sectionCategory="ine" />
                          <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} disabled={!isEditing} subjectId={subject.id} synonymCount={synonymCounts?.[field.fieldKey]} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="extrahovane" className="border rounded-md px-3" data-testid="editor-accordion-extrahovane">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-semibold">EXTRAHOVANÉ ÚDAJE</span>
              <Badge variant="outline" className="text-[10px] border-blue-400/40 text-blue-400">AI</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            {(() => {
              const categories = getCategoriesForClientType(clientTypeId);
              const cc = unifiedCatalog?.categoryCounts || {};
              const activeSubjects = unifiedCatalog?.activeSubjects || 0;

              const dataPoints: Record<string, number> = {};
              for (const cat of categories) {
                dataPoints[cat.key] = cc[cat.key]?.dataPoints || 0;
              }

              const totalDataPoints = unifiedCatalog?.totalDataPoints || 0;
              const totalFields = unifiedCatalog?.totalFields || 0;
              const filledCategories = categories.filter(c => dataPoints[c.key] > 0 || c.key === "relacie").length;

              const CATEGORY_ICONS: Record<string, typeof User> = {
                User, Shield, Users, CreditCard, Star, Phone, Archive, Link2,
              };
              const ICON_MAP: Record<string, string> = {
                identita: "User", legislativa: "Shield", rodina: "Users",
                financie: "CreditCard", profil: "Star", digitalna: "Phone",
                servis: "Archive", relacie: "Link2",
              };
              const COLOR_CLASSES: Record<string, { border: string; bg: string; text: string }> = {
                blue: { border: "border-blue-500/20", bg: "bg-blue-500/10", text: "text-blue-400" },
                red: { border: "border-red-500/20", bg: "bg-red-500/10", text: "text-red-400" },
                pink: { border: "border-pink-500/20", bg: "bg-pink-500/10", text: "text-pink-400" },
                emerald: { border: "border-emerald-500/20", bg: "bg-emerald-500/10", text: "text-emerald-400" },
                amber: { border: "border-amber-500/20", bg: "bg-amber-500/10", text: "text-amber-400" },
                cyan: { border: "border-cyan-500/20", bg: "bg-cyan-500/10", text: "text-cyan-400" },
                slate: { border: "border-slate-500/20", bg: "bg-slate-500/10", text: "text-slate-400" },
                violet: { border: "border-violet-500/20", bg: "bg-violet-500/10", text: "text-violet-400" },
              };

              return (
                <div className="space-y-3" data-testid="panel-extrahovane-stats">
                  <Card className="relative border-blue-500/20 bg-blue-500/5" data-testid="stat-ai-motor">
                    {isArchitectMode && <ArchitectFieldOverlay fieldKey="ai_motor" sectionCategory="extrahovane" />}
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 shrink-0">
                          <Zap className="w-5 h-5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">AI Motor</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-sm font-semibold text-foreground" data-testid="ai-motor-status">
                              {(synonymCounts && Object.keys(synonymCounts).some(k => synonymCounts[k] > 0)) ? "Aktívny" : "Čaká na dáta"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[9px] border-emerald-400/30 text-emerald-400">{filledCategories}/{categories.length} kat.</Badge>
                          <Badge variant="outline" className="text-[9px] border-blue-400/30 text-blue-400" data-testid="badge-total-datapoints">
                            {totalDataPoints.toLocaleString("sk-SK")} údajov
                          </Badge>
                          <Badge variant="outline" className="text-[9px] border-amber-400/30 text-amber-400" data-testid="badge-field-count">
                            {totalFields} polí
                          </Badge>
                          <Badge variant="outline" className="text-[9px] border-slate-400/30 text-slate-400" data-testid="badge-subject-count">
                            {activeSubjects} subjektov
                          </Badge>
                          <Badge variant="outline" className="text-[9px] border-blue-400/30 text-blue-400">v1.0</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="category-cards-grid">
                    {categories.map((cat) => {
                      const colors = COLOR_CLASSES[cat.color] || COLOR_CLASSES.slate;
                      const IconComp = CATEGORY_ICONS[ICON_MAP[cat.key] || "User"];
                      const count = dataPoints[cat.key] || 0;
                      const fieldCount = cc[cat.key]?.fields || 0;
                      const isRelacie = cat.key === "relacie";

                      return (
                        <Card
                          key={cat.key}
                          className={cn("relative", colors.border, count > 0 || isRelacie ? "" : "opacity-50")}
                          data-testid={`category-card-${cat.key}`}
                        >
                          {isArchitectMode && <ArchitectFieldOverlay fieldKey={`cat_${cat.key}`} sectionCategory="extrahovane" />}
                          <CardContent className="p-2.5">
                            <div className="flex items-center gap-2">
                              <div className={cn("flex items-center justify-center w-7 h-7 rounded-md shrink-0", colors.bg)}>
                                <IconComp className={cn("w-4 h-4", colors.text)} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] text-muted-foreground font-medium truncate">{cat.label}</p>
                                <p className="text-lg font-bold text-foreground leading-tight" data-testid={`category-count-${cat.key}`}>
                                  {isRelacie ? "—" : count.toLocaleString("sk-SK")}
                                </p>
                              </div>
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-1.5 leading-tight">
                              {isRelacie
                                ? "Prepojenia subjektov"
                                : `${fieldCount} polí × ${activeSubjects} subjektov`}
                            </p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
