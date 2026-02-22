import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Subject } from "@shared/schema";
import { useSubjectSchema, type DynamicField, type DynamicSection, type DynamicPanel } from "@/hooks/use-subject-schema";
import { getDocumentValidityStatus, isValidityField } from "@/lib/document-validity";
import { FieldHistoryIndicator } from "@/components/field-history-indicator";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Loader2, Pencil, Save, X, AlertTriangle, Check, Clock,
  User, Phone, MapPin, FileText, Shield
} from "lucide-react";
import { formatDateSlovak } from "@/lib/utils";

const PRIECINOK_CONFIG = [
  {
    key: "IDENTITA",
    title: "IDENTITA",
    panelTitle: "Základné údaje",
    icon: User,
    panelCodes: ["fo_identita", "fo_osobne"],
    color: "#3b82f6",
    fieldKeys: [
      "titul_pred", "meno", "priezvisko", "titul_za",
      "rodne_priezvisko", "rodne_cislo", "datum_narodenia", "statna_prislusnost"
    ],
  },
  {
    key: "KONTAKTY",
    title: "KONTAKTY",
    panelTitle: "Telefonické a emailové spojenie",
    icon: Phone,
    panelCodes: ["fo_kontakt"],
    color: "#06b6d4",
    fieldKeys: [
      "kont_mobil", "telefon", "email", "kont_email_praca"
    ],
    fieldLabels: {
      kont_mobil: "Mobilný telefón 1",
      telefon: "Mobilný telefón 2",
      email: "E-mail (osobný)",
      kont_email_praca: "E-mail (pracovný)",
    },
  },
  {
    key: "ADRESY",
    title: "ADRESY",
    panelTitle: "Trvalý pobyt / Sídlo",
    icon: MapPin,
    panelCodes: ["fo_adresa"],
    color: "#10b981",
    fieldKeys: [
      "adr_tp_ulica", "adr_tp_cislo", "adr_tp_psc", "adr_tp_obec", "adr_tp_stat"
    ],
    fieldLabels: {
      adr_tp_ulica: "Ulica a číslo (Súpisné/Orientačné)",
      adr_tp_cislo: "Číslo domu",
      adr_tp_psc: "PSČ",
      adr_tp_obec: "Obec / Mesto",
      adr_tp_stat: "Štát",
    },
  },
  {
    key: "DOKLADY",
    title: "DOKLADY",
    panelTitle: "Doklad totožnosti",
    icon: FileText,
    panelCodes: ["fo_doklady_detail"],
    color: "#f59e0b",
    fieldKeys: [
      "dok_typ_dokladu", "op_cislo", "op_platnost", "op_vydal"
    ],
    fieldLabels: {
      dok_typ_dokladu: "Typ dokladu (OP / Pas / Iný)",
      op_cislo: "Séria a číslo dokladu",
      op_platnost: "Platnosť DO (Dátum)",
      op_vydal: "Vydal (Názov orgánu)",
    },
  },
];

const FIELD_TO_SUBJECT_COLUMN: Record<string, string> = {
  meno: "firstName",
  priezvisko: "lastName",
  email: "email",
  telefon: "phone",
  rodne_cislo: "birthNumber",
  op_cislo: "idCardNumber",
  cislo_dokladu: "idCardNumber",
  iban: "iban",
  bic: "swift",
};

const INT_COLUMNS = new Set(["continentId", "stateId", "myCompanyId"]);

interface ModuleCProps {
  subject: Subject;
}

export function SubjectProfileModuleC({ subject }: ModuleCProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editReason, setEditReason] = useState("");

  const clientTypeId = useMemo(() => {
    const ctId = (subject as any).clientTypeId;
    if (ctId) return Number(ctId);
    if (subject.type === "person") return 1;
    if (subject.type === "szco") return 3;
    return 4;
  }, [subject]);

  const { schema, isLoading: schemaLoading } = useSubjectSchema(clientTypeId);

  const details = useMemo(() => {
    const d = (subject.details || {}) as Record<string, any>;
    return d;
  }, [subject.details]);

  const dynamicFields = useMemo(() => {
    return (details.dynamicFields || {}) as Record<string, string>;
  }, [details]);

  function getFieldValue(fieldKey: string): string {
    const col = FIELD_TO_SUBJECT_COLUMN[fieldKey];
    if (col) {
      const v = (subject as any)[col];
      return v != null ? String(v) : "";
    }
    if (dynamicFields[fieldKey] !== undefined) return String(dynamicFields[fieldKey] || "");
    if (details[fieldKey] !== undefined) return String(details[fieldKey] || "");
    return "";
  }

  function getEditableValue(fieldKey: string): string {
    if (editValues[fieldKey] !== undefined) return editValues[fieldKey];
    return getFieldValue(fieldKey);
  }

  function setEditFieldValue(fieldKey: string, value: string) {
    setEditValues(prev => ({ ...prev, [fieldKey]: value }));
  }

  const allSchemaFields = useMemo(() => {
    if (!schema?.sections) return [];
    const fields: DynamicField[] = [];
    for (const sec of schema.sections) {
      for (const panel of sec.panels) {
        fields.push(...panel.fields);
      }
    }
    return fields;
  }, [schema]);

  const fieldsByKey = useMemo(() => {
    const map: Record<string, DynamicField> = {};
    for (const f of allSchemaFields) {
      map[f.fieldKey] = f;
    }
    return map;
  }, [allSchemaFields]);

  const saveEdit = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {};
      const dynUpdates: Record<string, any> = {};

      for (const [fieldKey, val] of Object.entries(editValues)) {
        const colName = FIELD_TO_SUBJECT_COLUMN[fieldKey];
        if (colName) {
          if (INT_COLUMNS.has(colName)) {
            payload[colName] = val ? parseInt(val) : null;
          } else {
            payload[colName] = val;
          }
        } else {
          dynUpdates[fieldKey] = val;
        }
      }

      if (Object.keys(dynUpdates).length > 0) {
        const existingDetails = (subject.details || {}) as Record<string, any>;
        const existingDynamic = existingDetails.dynamicFields || {};
        payload.details = {
          ...existingDetails,
          dynamicFields: { ...existingDynamic, ...dynUpdates },
        };
      }
      payload.changeReason = editReason || "Úprava cez Profil subjektu (Modul C)";

      return apiRequest("PATCH", `/api/subjects/${subject.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "field-history"] });
      toast({ title: "Zmeny uložené", description: "Všetky zmeny boli úspešne zapísané do profilu." });
      setIsEditing(false);
      setEditValues({});
      setEditReason("");
    },
    onError: (err: any) => {
      toast({ title: "Chyba pri ukladaní", description: err.message, variant: "destructive" });
    },
  });

  const handleInlineSave = useCallback(async (fieldKey: string, newValue: string) => {
    try {
      const colName = FIELD_TO_SUBJECT_COLUMN[fieldKey];
      const payload: Record<string, any> = { changeReason: "Rýchla úprava z Modulu C (Profil subjektu)" };
      if (colName) {
        if (INT_COLUMNS.has(colName)) {
          payload[colName] = parseInt(newValue) || null;
        } else {
          payload[colName] = newValue;
        }
      } else {
        const existingDetails = (subject.details || {}) as Record<string, any>;
        const existingDynamic = existingDetails.dynamicFields || {};
        payload.details = {
          ...existingDetails,
          dynamicFields: { ...existingDynamic, [fieldKey]: newValue },
        };
      }
      await apiRequest("PATCH", `/api/subjects/${subject.id}`, payload);
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "field-history"] });
      toast({ title: "Uložené" });
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    }
  }, [subject, toast]);

  const changedCount = Object.keys(editValues).filter(k => editValues[k] !== getFieldValue(k)).length;

  if (schemaLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="modulec-loading">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Načítavam profil subjektu...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="module-c-profile">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-base font-semibold">Modul C: Profil subjektu (Master Data)</h2>
          <Badge variant="outline" className="text-[10px]">
            {subject.type === "person" ? "FO" : subject.type === "szco" ? "SZČO" : "PO"}
          </Badge>
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
                onClick={() => { setIsEditing(false); setEditValues({}); setEditReason(""); }}
                data-testid="btn-cancel-edit"
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Zrušiť
              </Button>
              <Button
                size="sm"
                onClick={() => saveEdit.mutate()}
                disabled={changedCount === 0 || saveEdit.isPending}
                data-testid="btn-save-edit"
              >
                {saveEdit.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Uložiť ({changedCount})
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsEditing(true)}
              data-testid="btn-start-edit"
            >
              <Pencil className="w-3.5 h-3.5 mr-1" />
              Upraviť
            </Button>
          )}
        </div>
      </div>

      <Separator />

      <Accordion type="multiple" defaultValue={PRIECINOK_CONFIG.map(p => p.key)} className="space-y-3">
        {PRIECINOK_CONFIG.map(priecinok => {
          const Icon = priecinok.icon;
          const fields = priecinok.fieldKeys
            .map(fk => fieldsByKey[fk])
            .filter(Boolean) as DynamicField[];

          const filledCount = fields.filter(f => !!getFieldValue(f.fieldKey)).length;

          return (
            <AccordionItem
              key={priecinok.key}
              value={priecinok.key}
              className="border rounded-md"
              data-testid={`priecinok-${priecinok.key.toLowerCase()}`}
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: priecinok.color }} />
                  <Icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold tracking-wide">{priecinok.title}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {filledCount}/{fields.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="mb-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Panel: {priecinok.panelTitle}
                  </span>
                </div>

                {isEditing ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {fields.map(field => {
                      const fk = field.fieldKey;
                      const currentVal = getEditableValue(fk);
                      const origVal = getFieldValue(fk);
                      const isModified = editValues[fk] !== undefined && editValues[fk] !== origVal;
                      const labelOverride = (priecinok as any).fieldLabels?.[fk];
                      const label = labelOverride || field.shortLabel || field.label;

                      return (
                        <div key={fk} className="space-y-1" data-testid={`modulec-edit-${fk}`}>
                          <div className="flex items-center gap-1">
                            <Label className={`text-xs ${isModified ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                              {label}
                              {field.isRequired && <span className="text-red-400 ml-0.5">*</span>}
                              {isModified && <span className="ml-1 text-[9px]">(zmenené)</span>}
                            </Label>
                          </div>
                          {field.fieldType === "switch" ? (
                            <div className="flex items-center gap-2 h-9">
                              <Switch
                                checked={currentVal === "true"}
                                onCheckedChange={checked => setEditFieldValue(fk, checked ? "true" : "false")}
                                data-testid={`switch-${fk}`}
                              />
                              <span className="text-xs text-muted-foreground">{currentVal === "true" ? "Áno" : "Nie"}</span>
                            </div>
                          ) : (field.fieldType === "select" || field.fieldType === "jedna_moznost") && field.options.length > 0 ? (
                            <Select value={currentVal} onValueChange={v => setEditFieldValue(fk, v)}>
                              <SelectTrigger className="h-9 text-xs" data-testid={`select-${fk}`}>
                                <SelectValue placeholder="Vyberte..." />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : field.fieldType === "textarea" || field.fieldType === "long_text" ? (
                            <Textarea
                              value={currentVal}
                              onChange={e => setEditFieldValue(fk, e.target.value)}
                              rows={2}
                              className="text-xs"
                              data-testid={`textarea-${fk}`}
                            />
                          ) : (
                            <Input
                              type={field.fieldType === "date" ? "date" : field.fieldType === "number" || field.fieldType === "desatinne_cislo" ? "number" : field.fieldType === "phone" ? "tel" : "text"}
                              value={currentVal}
                              onChange={e => setEditFieldValue(fk, e.target.value)}
                              className={`h-9 text-xs ${isModified ? "border-primary/60" : ""}`}
                              placeholder={label}
                              step={field.fieldType === "desatinne_cislo" ? "0.01" : undefined}
                              data-testid={`input-${fk}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                    {fields.map(field => {
                      const fk = field.fieldKey;
                      const value = getFieldValue(fk);
                      const labelOverride = (priecinok as any).fieldLabels?.[fk];
                      const label = labelOverride || field.shortLabel || field.label;
                      const isDocExpiry = fk === "op_platnost" || fk === "pas_platnost" || fk.endsWith("_platnost");
                      const validity = isDocExpiry && value ? getDocumentValidityStatus(value) : null;

                      const displayValue = field.fieldType === "date" && value
                        ? formatDateSlovak(value)
                        : value || "—";

                      return (
                        <ModuleCField
                          key={fk}
                          fieldKey={fk}
                          label={label}
                          value={displayValue}
                          rawValue={value}
                          validity={validity}
                          subjectId={subject.id}
                          fieldLabel={field.label}
                          onInlineSave={handleInlineSave}
                          fieldType={field.fieldType}
                        />
                      );
                    })}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

function ModuleCField({
  fieldKey, label, value, rawValue, validity, subjectId, fieldLabel, onInlineSave, fieldType,
}: {
  fieldKey: string;
  label: string;
  value: string;
  rawValue: string;
  validity: ReturnType<typeof getDocumentValidityStatus> | null;
  subjectId: number;
  fieldLabel: string;
  onInlineSave: (fieldKey: string, newValue: string) => void;
  fieldType: string;
}) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(rawValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditVal(rawValue); }, [rawValue]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const commitEdit = () => {
    setEditing(false);
    if (editVal !== rawValue) onInlineSave(fieldKey, editVal);
  };

  const handleDoubleClick = () => {
    setEditing(true);
    setEditVal(rawValue || "");
  };

  const hasExpiry = validity && (validity.status === "expired" || validity.status === "expiring");
  const isExpiringSoon = validity && validity.status === "expiring" && validity.daysRemaining !== null && validity.daysRemaining <= 30;
  const isExpired = validity && validity.status === "expired";

  const borderClass = editing
    ? "border-2 border-blue-500 bg-white dark:bg-slate-900 shadow-sm"
    : isExpired
      ? "border-red-500/60 bg-red-500/10"
      : isExpiringSoon
        ? "border-orange-500/60 bg-orange-500/10"
        : hasExpiry
          ? `${validity!.borderClass} ${validity!.bgClass}`
          : "border-border bg-muted/30 hover:bg-muted/50";

  return (
    <div
      className={`rounded-md border p-2.5 transition-colors select-none ${editing ? "" : "cursor-pointer"} ${borderClass}`}
      onDoubleClick={editing ? undefined : handleDoubleClick}
      title={editing ? undefined : (validity?.label || `Dvojklik pre úpravu`)}
      data-testid={`modulec-field-${fieldKey}`}
    >
      {editing ? (
        <>
          <span className="text-[10px] text-muted-foreground block mb-1">{label}</span>
          <input
            ref={inputRef}
            type={fieldType === "date" ? "date" : fieldType === "phone" ? "tel" : "text"}
            className="w-full bg-transparent outline-none text-sm font-medium"
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") { setEditing(false); setEditVal(rawValue); } }}
            onBlur={commitEdit}
            data-testid={`modulec-field-input-${fieldKey}`}
          />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
            <div className="flex items-center gap-1">
              <FieldHistoryIndicator subjectId={subjectId} fieldKey={fieldKey} fieldLabel={fieldLabel} />
              {validity && validity.status !== "unknown" && rawValue && (
                <span className={`w-2 h-2 rounded-full shrink-0 ${validity.dotClass}`} data-testid={`validity-dot-${fieldKey}`} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-sm font-medium truncate ${validity?.textClass || ""}`}>
              {value || "—"}
            </span>
            {(isExpired || isExpiringSoon) && (
              <span className="flex items-center gap-0.5 shrink-0" data-testid={`expiry-warning-${fieldKey}`}>
                <AlertTriangle className={`w-3.5 h-3.5 ${isExpired ? "text-red-500" : "text-orange-500"}`} />
                <span className={`text-[10px] font-medium ${isExpired ? "text-red-500" : "text-orange-500"}`}>
                  {isExpired
                    ? "Neplatný!"
                    : `${validity!.daysRemaining}d`}
                </span>
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
