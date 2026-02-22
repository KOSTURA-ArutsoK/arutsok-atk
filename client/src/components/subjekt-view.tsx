import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMyCompanies } from "@/hooks/use-companies";
import { useAppUser } from "@/hooks/use-app-user";
import type { Subject, ClientDataTab, ClientDataCategory, ClientMarketingConsent, ClientType, SubjectCollaborator, SubjectFieldHistory, SubjectAddress } from "@shared/schema";
import { getFieldsForClientTypeId, getSectionsForClientTypeId, type StaticField } from "@/lib/staticFieldDefs";
import { getDocumentValidityStatus, isValidityField, isNumberFieldWithExpiredPair } from "@/lib/document-validity";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, UserCheck, Scale, Users, Wallet, BarChart3, Wifi, Archive, FileText, Eye, EyeOff, ChevronRight, Check, X, Plus, AlertTriangle, ShieldAlert, Ban, Link2, Building2, User, ArrowLeftRight, History, UserPlus, ShieldCheck, Clock, Pencil, Save, MessageSquare, FileDown, MapPin, Mail, Trash2, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDateSlovak } from "@/lib/utils";
import { SubjectProfilePhoto } from "@/components/subject-profile-photo";

const TAB_ICONS: Record<string, typeof UserCheck> = {
  UserCheck, Scale, Users, Wallet, BarChart3, Wifi, Archive,
  FileText, Shield: Scale, Heart: Users, Building2,
};

function getTabIcon(iconName: string) {
  return TAB_ICONS[iconName] || FileText;
}

const FIELD_HINTS: Record<string, string> = {
  pep: "Politicky exponovaná osoba podľa AML zákona 297/2008 Z.z.",
  pep_funkcia: "Konkrétna verejná funkcia, ktorú osoba zastáva alebo zastávala",
  pep_vztah: "Vzťah k PEP osobe (rodinný príslušník, blízky spolupracovník)",
  kuv_meno_1: "Konečný užívateľ výhod – osoba s podielom ≥25% alebo kontrolou nad subjektom",
  kuv_rc_1: "Rodné číslo KUV pre jednoznačnú identifikáciu",
  kuv_podiel_1: "Percentuálny podiel KUV na základnom imaní alebo hlasovacích právach",
  kuv_meno_2: "Druhý konečný užívateľ výhod",
  kuv_rc_2: "Rodné číslo druhého KUV",
  kuv_podiel_2: "Podiel druhého KUV",
  kuv_meno_3: "Tretí konečný užívateľ výhod",
  kuv_rc_3: "Rodné číslo tretieho KUV",
  kuv_podiel_3: "Podiel tretieho KUV",
  cgn_rating: "Interný kreditný rating klienta (A=najlepší, E=najhorší)",
  marketing_email: "Súhlas so zasielaním marketingových emailov podľa GDPR",
  marketing_sms: "Súhlas so zasielaním SMS správ s ponukami",
  marketing_phone: "Súhlas s telefonickým oslovením s ponukami",
  data_processing: "Súhlas so spracovaním osobných údajov nad rámec zmluvy",
  third_party: "Súhlas s poskytnutím údajov partnerským spoločnostiam",
  profiling: "Súhlas s automatizovaným profilovaním na základe správania",
};

const HINTED_CATEGORIES = new Set(["aml", "marketingove", "bonita", "behavioralne"]);

const CATEGORY_HINTS: Record<string, string> = {
  aml: "Údaje vyžadované zákonom o AML (297/2008 Z.z.) – identifikácia konečných užívateľov výhod a politicky exponovaných osôb",
  marketingove: "Marketingové súhlasy a preferencie klienta podľa GDPR nariadenia",
  bonita: "Bodový systém hodnotenia klienta – automatický výpočet na základe histórie zmlúv",
  behavioralne: "Sledovanie správania klienta v digitálnom prostredí pre personalizáciu služieb",
  nezatriedene: "Údaje zo zmlúv, ktoré nie sú priradené do žiadnej štandardnej kategórie. Ak sa typ údaja vyskytne u viac ako 20 klientov, je označený ako nový trend.",
};

const FIELD_TO_CATEGORY: Record<string, string> = {
  titul_pred: "povinne", meno: "povinne", priezvisko: "povinne", titul_za: "povinne",
  rodne_cislo: "povinne", datum_narodenia: "povinne", vek: "povinne", pohlavie: "povinne",
  miesto_narodenia: "povinne", statna_prislusnost: "povinne", rodne_priezvisko: "dobrovolne",
  typ_dokladu: "dokumentacne", typ_dokladu_iny: "dokumentacne", cislo_dokladu: "dokumentacne",
  platnost_dokladu: "dokumentacne", vydal_organ: "dokumentacne", kod_vydavajuceho_organu: "dokumentacne",
  telefon: "komunikacne", email: "komunikacne",
  tp_ulica: "povinne", tp_supisne: "povinne", tp_orientacne: "povinne",
  tp_mesto: "povinne", tp_psc: "povinne", tp_stat: "povinne",
  korespond_rovnaka: "povinne", ka_ulica: "povinne", ka_supisne: "povinne",
  ka_orientacne: "povinne", ka_mesto: "povinne", ka_psc: "povinne", ka_stat: "povinne",
  kontaktna_rovnaka: "povinne", koa_ulica: "povinne", koa_supisne: "povinne",
  koa_orientacne: "povinne", koa_mesto: "povinne", koa_psc: "povinne", koa_stat: "povinne",
  nazov_organizacie: "povinne", ico: "povinne", sk_nace: "firemny_profil",
  sidlo_ulica: "povinne", sidlo_supisne: "povinne", sidlo_orientacne: "povinne",
  sidlo_mesto: "povinne", sidlo_psc: "povinne", sidlo_stat: "povinne",
  vykon_rovnaky: "povinne", vykon_ulica: "povinne", vykon_supisne: "povinne",
  vykon_orientacne: "povinne", vykon_mesto: "povinne", vykon_psc: "povinne", vykon_stat: "povinne",
  dic: "zakonne", ic_dph: "zakonne",
  pep: "aml", pep_funkcia: "aml", pep_vztah: "aml",
  kuv_meno_1: "aml", kuv_rc_1: "aml", kuv_podiel_1: "aml",
  kuv_meno_2: "aml", kuv_rc_2: "aml", kuv_podiel_2: "aml",
  kuv_meno_3: "aml", kuv_rc_3: "aml", kuv_podiel_3: "aml",
  obrat: "firemny_profil", pocet_zamestnancov: "firemny_profil",
  iban: "zmluvne", bic: "zmluvne", cislo_uctu: "zmluvne",
  rodinny_kontakt_meno: "komunikacne", rodinny_kontakt_telefon: "komunikacne",
  rodinny_kontakt_vztah: "komunikacne", zastihnutie: "komunikacne",
  doruc_ulica: "geolokacne", doruc_mesto: "geolokacne", doruc_psc: "geolokacne",
  doruc_stat: "geolokacne", doruc_rovnaka: "geolokacne",
  spz: "majetkove", vin: "majetkove",
  statutar_meno_1: "pravne", statutar_rc_1: "pravne", statutar_funkcia_1: "pravne",
  statutar_meno_2: "pravne", statutar_rc_2: "pravne", statutar_funkcia_2: "pravne",
  cgn_rating: "bonita",
};

const CONSENT_TYPES = [
  { code: "marketing_email", label: "Email marketing" },
  { code: "marketing_sms", label: "SMS marketing" },
  { code: "marketing_phone", label: "Telefonický marketing" },
  { code: "data_processing", label: "Spracovanie osobných údajov" },
  { code: "third_party", label: "Poskytnutie údajov tretím stranám" },
  { code: "profiling", label: "Profilovanie" },
];

function UnclassifiedTrendsNotice() {
  const { data: trendsData } = useQuery<{ trends: Array<{ fieldKey: string; count: number }> }>({
    queryKey: ["/api/data-trends/unclassified"],
  });

  if (!trendsData?.trends || trendsData.trends.length === 0) return null;

  return (
    <div className="mt-2 rounded border border-amber-700/50 bg-amber-950/30 p-3" data-testid="unclassified-trends-notice">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-xs font-semibold text-amber-300">Nový trend - nezatriedené údaje</span>
      </div>
      <div className="space-y-1">
        {trendsData.trends.map(t => (
          <div key={t.fieldKey} className="flex items-center justify-between text-[11px]">
            <span className="text-amber-200/80 font-mono">{t.fieldKey}</span>
            <Badge variant="outline" className="text-[9px] border-amber-600 text-amber-300">
              {t.count} klientov
            </Badge>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        Tieto údaje sa vyskytujú u viac ako 20 klientov a mali by byť zatriedené do príslušnej kategórie.
      </p>
    </div>
  );
}

function SubjectViewField({
  field, value, isSummary, hasNote, noteText, pdfSidebarOpen, toggleSummaryField, onInlineSave, allFieldValues,
}: {
  field: StaticField; value: string; isSummary: boolean; hasNote: boolean; noteText?: string;
  pdfSidebarOpen: boolean; toggleSummaryField: (key: string) => void;
  onInlineSave?: (fieldKey: string, newValue: string) => void;
  allFieldValues?: Record<string, string>;
}) {
  const [verified, setVerified] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setEditVal(value); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const isValField = isValidityField(field.fieldKey);
  const validity = isValField && value ? getDocumentValidityStatus(value) : null;
  const numValidity = allFieldValues ? isNumberFieldWithExpiredPair(field.fieldKey, allFieldValues) : null;
  const isExpiredNumber = numValidity?.status === "expired";

  const displayValue = field.fieldType === "switch"
    ? value === "true" ? "Áno" : value === "false" ? "Nie" : "-"
    : field.fieldType === "date" && value
      ? formatDateSlovak(value)
      : value || "-";

  const commitEdit = () => {
    setEditing(false);
    if (onInlineSave && editVal !== value) onInlineSave(field.fieldKey, editVal);
  };

  const handleClick = () => {
    if (editing) return;
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => { clickTimer.current = null; setVerified(v => !v); }, 250);
  };

  const handleDoubleClick = () => {
    if (clickTimer.current) { clearTimeout(clickTimer.current); clickTimer.current = null; }
    if (!onInlineSave || field.fieldType === "switch" || field.fieldType === "select") return;
    setEditing(true);
    setEditVal(value === "-" ? "" : value);
  };

  if (editing) {
    return (
      <div className="h-10 flex items-center gap-2 px-3 rounded-md border-2 border-blue-500 bg-white dark:bg-slate-900 shadow-sm" data-testid={`field-${field.fieldKey}`}>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{field.shortLabel || field.label}:</span>
        <input
          ref={inputRef}
          type={field.fieldType === "date" ? "date" : "text"}
          className="flex-1 bg-transparent outline-none text-sm font-medium"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") { setEditing(false); setEditVal(value); } }}
          onBlur={commitEdit}
          data-testid={`field-${field.fieldKey}-input`}
        />
      </div>
    );
  }

  const borderCls = verified
    ? "border-blue-400/60 bg-blue-500/10 dark:bg-blue-500/15"
    : isExpiredNumber
      ? "border-red-500/60 bg-red-500/10"
      : validity && validity.status !== "unknown"
        ? `${validity.borderClass} ${validity.bgClass}`
        : isSummary ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30";

  return (
    <div
      className={`h-10 flex items-center gap-2 px-3 rounded-md border transition-colors duration-150 select-none cursor-pointer ${borderCls}`}
      title={hasNote ? `Poznámka: ${noteText}` : validity ? validity.label : undefined}
      data-testid={`field-${field.fieldKey}`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <span className="text-xs text-muted-foreground whitespace-nowrap">{field.shortLabel || field.label}:</span>
      <span className={`text-sm font-medium truncate max-w-[200px] ${validity?.textClass || ""} ${isExpiredNumber ? "text-red-500" : ""}`}>{displayValue}</span>
      {validity && validity.status !== "unknown" && value && (
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${validity.dotClass}`} data-testid={`validity-dot-${field.fieldKey}`} />
      )}
      {verified && <Check className="w-3 h-3 text-blue-500 flex-none" />}
      {hasNote && !verified && <MessageSquare className="w-3 h-3 text-amber-400 shrink-0" />}
      {pdfSidebarOpen && (
        <button
          onClick={e => { e.stopPropagation(); toggleSummaryField(field.fieldKey); }}
          className="ml-1 opacity-60 hover:opacity-100"
          data-testid={`toggle-summary-${field.fieldKey}`}
        >
          {isSummary ? <Eye className="w-3 h-3 text-primary" /> : <EyeOff className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}

interface CategoriesAccordionProps {
  tabCode: string;
  tabCats: ClientDataCategory[];
  fieldsByCategory: Record<string, StaticField[]>;
  isEditing: boolean;
  getFieldValue: (key: string) => string;
  getEditableValue: (key: string) => string;
  editValues: Record<string, string>;
  setEditFieldValue: (key: string, value: string) => void;
  summaryFields: Record<string, boolean>;
  pdfSidebarOpen: boolean;
  toggleSummaryField: (key: string) => void;
  isSuperAdmin?: boolean;
  fieldNotes?: Record<string, string>;
  onFieldNoteChange?: (key: string, note: string) => void;
  onInlineSave?: (fieldKey: string, newValue: string) => void;
}

function CategoriesAccordion({
  tabCode, tabCats, fieldsByCategory, isEditing,
  getFieldValue, getEditableValue, editValues, setEditFieldValue,
  summaryFields, pdfSidebarOpen, toggleSummaryField,
  isSuperAdmin, fieldNotes, onFieldNoteChange, onInlineSave,
}: CategoriesAccordionProps) {
  const visibleCats = useMemo(() => {
    if (isEditing) return tabCats;
    return tabCats.filter(cat => {
      const catFields = fieldsByCategory[cat.code] || [];
      if (catFields.length === 0) return false;
      return catFields.some(f => !!getFieldValue(f.fieldKey));
    });
  }, [isEditing, tabCats, fieldsByCategory, getFieldValue]);

  if (visibleCats.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground" data-testid={`empty-tab-${tabCode}`}>
        {isEditing ? "Žiadne kategórie v tejto záložke" : "Žiadne vyplnené údaje v tejto záložke"}
      </div>
    );
  }

  const defaultOpen = visibleCats
    .filter(c => (fieldsByCategory[c.code]?.length || 0) > 0)
    .map(c => c.code);

  return (
    <Accordion
      key={isEditing ? "edit" : "view"}
      type="multiple"
      defaultValue={defaultOpen}
      className="space-y-2"
    >
      {visibleCats.map(cat => {
        const catFields = fieldsByCategory[cat.code] || [];
        const filledCount = catFields.filter(f => !!getFieldValue(f.fieldKey)).length;
        return (
          <AccordionItem key={cat.code} value={cat.code} className="border rounded-md px-3" data-testid={`category-${cat.code}`}>
            <AccordionTrigger className="py-2.5 hover:no-underline">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color || "#6b7280" }} />
                <span className="text-sm font-medium">{cat.name}</span>
                {catFields.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {filledCount}/{catFields.length}
                  </Badge>
                )}
                {isEditing && <Badge variant="outline" className="text-[9px] border-primary/40 text-primary">editácia</Badge>}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              {(cat.description || CATEGORY_HINTS[cat.code]) && (
                <p className="text-[11px] text-muted-foreground mb-2 leading-relaxed">{CATEGORY_HINTS[cat.code] || cat.description}</p>
              )}
              {catFields.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Žiadne polia v tejto kategórii
                </p>
              ) : isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catFields.map(field => {
                    const currentVal = getEditableValue(field.fieldKey);
                    const isModified = editValues[field.fieldKey] !== undefined && editValues[field.fieldKey] !== getFieldValue(field.fieldKey);
                    const fieldHint = HINTED_CATEGORIES.has(cat.code) ? FIELD_HINTS[field.fieldKey] : undefined;
                    const existingNote = fieldNotes?.[field.fieldKey] || "";
                    return (
                      <div key={field.fieldKey} className="space-y-1" data-testid={`edit-field-${field.fieldKey}`}>
                        <div className="flex items-center gap-1">
                          <Label className={`text-xs ${isModified ? "text-primary font-semibold" : "text-muted-foreground"}`}>
                            {field.shortLabel || field.label}
                            {field.isRequired && <span className="text-red-400 ml-0.5">*</span>}
                            {isModified && <span className="ml-1 text-[9px]">(zmenené)</span>}
                          </Label>
                          {isSuperAdmin && (
                            <button
                              type="button"
                              className={`ml-auto p-0.5 rounded hover:bg-muted ${existingNote ? "text-amber-400" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                              title={existingNote || "Pridať internú poznámku"}
                              onClick={() => {
                                const note = prompt("Interná poznámka (viditeľná len SuperAdmin):", existingNote);
                                if (note !== null && onFieldNoteChange) onFieldNoteChange(field.fieldKey, note);
                              }}
                              data-testid={`note-btn-${field.fieldKey}`}
                            >
                              <MessageSquare className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {isSuperAdmin && existingNote && (
                          <p className="text-[10px] text-amber-400/80 leading-tight -mt-0.5 italic" data-testid={`note-text-${field.fieldKey}`}>
                            {existingNote}
                          </p>
                        )}
                        {fieldHint && <p className="text-[10px] text-muted-foreground/70 leading-tight -mt-0.5">{fieldHint}</p>}
                        {field.fieldType === "switch" ? (
                          <div className="flex items-center gap-2 h-9">
                            <Switch
                              checked={currentVal === "true"}
                              onCheckedChange={checked => setEditFieldValue(field.fieldKey, checked ? "true" : "false")}
                              data-testid={`switch-edit-${field.fieldKey}`}
                            />
                            <span className="text-xs text-muted-foreground">{currentVal === "true" ? "Áno" : "Nie"}</span>
                          </div>
                        ) : field.fieldType === "select" && field.options.length > 0 ? (
                          <Select value={currentVal} onValueChange={v => setEditFieldValue(field.fieldKey, v)}>
                            <SelectTrigger className="h-9 text-xs" data-testid={`select-edit-${field.fieldKey}`}>
                              <SelectValue placeholder="Vyberte..." />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options.map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : field.fieldType === "textarea" ? (
                          <Textarea
                            value={currentVal}
                            onChange={e => setEditFieldValue(field.fieldKey, e.target.value)}
                            rows={2}
                            className="text-xs"
                            data-testid={`textarea-edit-${field.fieldKey}`}
                          />
                        ) : (
                          <Input
                            type={field.fieldType === "date" ? "date" : "text"}
                            value={currentVal}
                            onChange={e => setEditFieldValue(field.fieldKey, e.target.value)}
                            className={`h-9 text-xs ${isModified ? "border-primary/60" : ""}`}
                            placeholder={field.label}
                            data-testid={`input-edit-${field.fieldKey}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {catFields.map(field => {
                    const value = getFieldValue(field.fieldKey);
                    if (!value) return null;
                    const allVals: Record<string, string> = {};
                    Object.values(fieldsByCategory).flat().forEach(f => { const v = getFieldValue(f.fieldKey); if (v) allVals[f.fieldKey] = v; });
                    return (
                      <SubjectViewField
                        key={field.fieldKey}
                        field={field}
                        value={value}
                        isSummary={!!summaryFields[field.fieldKey]}
                        hasNote={!!(isSuperAdmin && fieldNotes?.[field.fieldKey])}
                        noteText={fieldNotes?.[field.fieldKey]}
                        pdfSidebarOpen={pdfSidebarOpen}
                        toggleSummaryField={toggleSummaryField}
                        onInlineSave={onInlineSave}
                        allFieldValues={allVals}
                      />
                    );
                  })}
                </div>
              )}
              {cat.code === "nezatriedene" && <UnclassifiedTrendsNotice />}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

interface SubjektViewProps {
  subject: Subject;
  showPdfSidebar?: boolean;
  isClientView?: boolean;
}

export function SubjektView({ subject, showPdfSidebar = false, isClientView = false }: SubjektViewProps) {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();
  const [pdfSidebarOpen, setPdfSidebarOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [editReason, setEditReason] = useState("");
  const [fieldNotes, setFieldNotes] = useState<Record<string, string>>(() => {
    const prefs = (subject as any).uiPreferences;
    return prefs?.field_notes || {};
  });
  const [summaryFields, setSummaryFields] = useState<Record<string, boolean>>(() => {
    const prefs = (subject as any).uiPreferences;
    return prefs?.summary_fields || {};
  });

  const isSuperAdmin = useMemo(() => {
    const name = (appUser as any)?.permissionGroup?.name?.toLowerCase() || "";
    return name.includes("superadmin") || name.includes("prezident");
  }, [appUser]);

  const { data: tabs, isLoading: tabsLoading } = useQuery<ClientDataTab[]>({
    queryKey: ["/api/client-data-tabs"],
  });

  const { data: categories, isLoading: catsLoading } = useQuery<ClientDataCategory[]>({
    queryKey: ["/api/client-data-categories"],
  });

  const { data: consents } = useQuery<ClientMarketingConsent[]>({
    queryKey: ["/api/subjects", subject.id, "marketing-consents"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/marketing-consents`).then(r => r.json()),
  });

  const { data: clientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });

  const { data: riskData } = useQuery<{
    riskLinks: Array<{ subjectId: number; name: string; uid: string; listStatus: string; matchType: string; matchValue: string }>;
    foPoRisks: Array<{ subjectId: number; name: string; uid: string; listStatus: string; relationship: string }>;
  }>({
    queryKey: ["/api/subjects", subject.id, "risk-links"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/risk-links`).then(r => r.json()),
  });

  const linkedFoId = (subject as any).linkedFoId as number | null;
  const { data: linkedFo } = useQuery<Subject>({
    queryKey: ["/api/subjects", linkedFoId],
    queryFn: () => apiRequest("GET", `/api/subjects/${linkedFoId}`).then(r => r.json()),
    enabled: !!linkedFoId && subject.type === "company",
  });

  const { data: linkedPos } = useQuery<Subject[]>({
    queryKey: ["/api/subjects", subject.id, "linked-companies"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/linked-companies`).then(r => r.json()),
    enabled: subject.type === "person" || subject.type === "szco",
  });

  const { data: collaborators } = useQuery<SubjectCollaborator[]>({
    queryKey: ["/api/subjects", subject.id, "collaborators"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/collaborators`).then(r => r.json()),
  });

  const { data: fieldHistory } = useQuery<SubjectFieldHistory[]>({
    queryKey: ["/api/subjects", subject.id, "field-history"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subject.id}/field-history`).then(r => r.json()),
  });

  const upsertConsent = useMutation({
    mutationFn: async (data: { consentType: string; isGranted: boolean; companyId: number }) => {
      return apiRequest("POST", `/api/subjects/${subject.id}/marketing-consents`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "marketing-consents"] });
      toast({ title: "Súhlas aktualizovaný" });
    },
  });

  const updateUiPrefs = useMutation({
    mutationFn: async (prefs: Record<string, any>) => {
      return apiRequest("PATCH", `/api/subjects/${subject.id}/ui-preferences`, prefs);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
    },
  });

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
      payload.changeReason = editReason || "Manuálna editácia cez profil subjektu";

      return apiRequest("PATCH", `/api/subjects/${subject.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "field-history"] });
      toast({ title: "Zmeny uložené" });
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
      const payload: Record<string, any> = { changeReason: "Rýchla úprava z profilu" };
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
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "field-history"] });
      toast({ title: "Uložené" });
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    }
  }, [subject, toast]);

  const startEditing = useCallback(() => {
    setEditValues({});
    setEditReason("");
    setIsEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditValues({});
    setEditReason("");
  }, []);

  useEffect(() => {
    if (subject?.id) {
      apiRequest("POST", `/api/subjects/${subject.id}/log-view`).catch(() => {});
    }
  }, [subject?.id]);

  const isPep = useMemo(() => {
    const det = (subject as any).details || {};
    const dynFields = det.dynamicFields || {};
    const pepVal = (dynFields.pep || "").toLowerCase();
    return pepVal === "true" || pepVal === "áno" || pepVal === "ano";
  }, [subject]);

  const isPerson = subject.type === "person";
  const isSzco = subject.type === "szco";
  const clientTypeId = isSzco ? 3 : isPerson ? 1 : 4;
  const typeFields = getFieldsForClientTypeId(clientTypeId) || [];

  const details = (subject.details || {}) as Record<string, any>;
  const dynamicFields = details.dynamicFields || details;

  const FIELD_TO_SUBJECT_COLUMN: Record<string, string> = {
    meno: "firstName",
    priezvisko: "lastName",
    nazov_organizacie: "companyName",
    email: "email",
    telefon: "phone",
    rodne_cislo: "birthNumber",
    cislo_dokladu: "idCardNumber",
    iban: "iban",
    bic: "swift",
    firstName: "firstName",
    lastName: "lastName",
    companyName: "companyName",
    phone: "phone",
    birthNumber: "birthNumber",
    idCardNumber: "idCardNumber",
    swift: "swift",
    continentId: "continentId",
    stateId: "stateId",
    myCompanyId: "myCompanyId",
  };

  const INT_COLUMNS = new Set(["continentId", "stateId", "myCompanyId"]);

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

  const fieldsByCategory = useMemo(() => {
    const map: Record<string, StaticField[]> = {};
    for (const field of typeFields) {
      const catCode = field.categoryCode || FIELD_TO_CATEGORY[field.fieldKey] || "doplnkove";
      if (!map[catCode]) map[catCode] = [];
      map[catCode].push(field);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }
    return map;
  }, [typeFields]);

  const categoriesByTab = useMemo(() => {
    if (!categories || !tabs) return {};
    const map: Record<number, ClientDataCategory[]> = {};
    for (const tab of tabs) {
      map[tab.id] = categories
        .filter(c => c.tabId === tab.id && c.isActive)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    }
    return map;
  }, [categories, tabs]);

  function toggleSummaryField(fieldKey: string) {
    const next = { ...summaryFields, [fieldKey]: !summaryFields[fieldKey] };
    setSummaryFields(next);
    updateUiPrefs.mutate({ summary_fields: next });
  }

  function handleFieldNoteChange(fieldKey: string, note: string) {
    const next = { ...fieldNotes, [fieldKey]: note };
    if (!note) delete next[fieldKey];
    setFieldNotes(next);
    updateUiPrefs.mutate({ field_notes: next });
  }

  if (tabsLoading || catsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const HIDDEN_CLIENT_TABS = new Set(['bonita_scoring']);
  const HIDDEN_CLIENT_CATEGORIES = new Set(['bonita', 'behavioralne', 'nezatriedene']);
  const sortedTabs = [...(tabs || [])].filter(t => t.isActive).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const displayTabs = isClientView ? sortedTabs.filter(t => !HIDDEN_CLIENT_TABS.has(t.code)) : sortedTabs;
  const activeCompanyId = appUser?.activeCompanyId;

  const listStatus = (subject as any).listStatus as string | null;

  return (
    <div className="flex gap-4">
      <div className={pdfSidebarOpen ? "flex-1 min-w-0" : "w-full"}>
        {!isClientView && listStatus === "cierny" && (
          <div className="mb-3 flex items-center gap-3 rounded border border-red-900 bg-red-950/80 px-4 py-3 text-red-200" data-testid="banner-cierny-zoznam">
            <Ban className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <span className="font-bold text-red-300 uppercase tracking-wide">ČIERNY ZOZNAM</span>
              <span className="ml-2 text-sm">Subjekt je na čiernom zozname. Zmluvná činnosť je zakázaná.</span>
            </div>
          </div>
        )}
        {!isClientView && listStatus === "cerveny" && (
          <div className="mb-3 flex items-center gap-3 rounded border border-orange-700 bg-orange-950/80 px-4 py-3 text-orange-200" data-testid="banner-cerveny-zoznam">
            <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0" />
            <div>
              <span className="font-bold text-orange-300 uppercase tracking-wide">ČERVENÝ ZOZNAM</span>
              <span className="ml-2 text-sm">Subjekt dosiahol -5 bodov za posledných 10 rokov. Zvýšená opatrnosť.</span>
            </div>
          </div>
        )}
        {!isClientView && riskData?.foPoRisks && riskData.foPoRisks.length > 0 && (
          <div className="mb-3 space-y-1" data-testid="banner-fo-po-risks">
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
        {isPep && !isClientView && (
          <div className="mb-3 flex items-center gap-3 rounded border border-purple-700 bg-purple-950/60 px-4 py-3" data-testid="banner-pep">
            <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0" />
            <div>
              <span className="font-bold text-purple-300 uppercase tracking-wide">POLITICKY EXPONOVAN\u00c1 OSOBA</span>
              <span className="ml-2 text-sm text-purple-200/80">Tento subjekt je ozna\u010den\u00fd ako PEP - zv\u00fd\u0161en\u00e1 obozretnos\u0165</span>
            </div>
          </div>
        )}
        {!isClientView && riskData?.riskLinks && riskData.riskLinks.length > 0 && (
          <div className="mb-3 space-y-1" data-testid="banner-risk-links">
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <SubjectProfilePhoto
              subjectId={subject.id}
              size="lg"
              editable={!isClientView && isEditing}
              showHistory={!isClientView}
            />
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {isPerson ? "FO" : isSzco ? "SZČO" : "PO"}
                </Badge>
                <span className="text-xs text-muted-foreground font-mono">{subject.uid}</span>
                {(subject as any).supplementaryIndex && (
                  <Badge variant="outline" className="text-[10px] border-blue-600 text-blue-300" data-testid="badge-supplementary-index">
                    Index: {(subject as any).supplementaryIndex}
                  </Badge>
                )}
                {isSuperAdmin && !isClientView && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px]"
                    onClick={() => {
                      const current = (subject as any).supplementaryIndex || "";
                      const val = prompt("Dodatkový index (napr. 1057/B alebo 1057.1):", current);
                      if (val !== null) {
                        apiRequest("PATCH", `/api/subjects/${subject.id}/supplementary-index`, { supplementaryIndex: val || null })
                          .then(() => {
                            queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
                            toast({ title: "Dodatkový index uložený" });
                          })
                          .catch(() => toast({ title: "Chyba", variant: "destructive" }));
                      }
                    }}
                    data-testid="btn-set-supplementary-index"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                )}
                {listStatus && (
                  <Badge variant={listStatus === "cierny" ? "destructive" : "secondary"} className={listStatus === "cierny" ? "bg-red-900 text-red-200" : "bg-orange-900 text-orange-200"}>
                    {listStatus === "cierny" ? "Čierny zoznam" : "Červený zoznam"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isClientView && (isEditing ? (
              <>
                <div className="flex items-center gap-2 mr-2">
                  <Input
                    placeholder="Dôvod zmeny..."
                    value={editReason}
                    onChange={e => setEditReason(e.target.value)}
                    className="h-8 text-xs w-48"
                    data-testid="input-edit-reason"
                  />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelEditing}
                  disabled={saveEdit.isPending}
                  data-testid="button-cancel-edit"
                >
                  <X className="w-4 h-4 mr-1" />
                  Zrušiť
                </Button>
                <Button
                  size="sm"
                  onClick={() => saveEdit.mutate()}
                  disabled={saveEdit.isPending || Object.keys(editValues).length === 0}
                  data-testid="button-save-edit"
                >
                  {saveEdit.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                  Uložiť ({Object.keys(editValues).length})
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={startEditing}
                data-testid="button-start-edit"
              >
                <Pencil className="w-4 h-4 mr-1" />
                Editácia
              </Button>
            ))}
            {showPdfSidebar && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPdfSidebarOpen(!pdfSidebarOpen)}
                data-testid="button-toggle-pdf-sidebar"
              >
                {pdfSidebarOpen ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
                PDF export
              </Button>
            )}
            {!isClientView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/api/subjects/${subject.id}/gdpr-export`, '_blank');
                }}
                data-testid="btn-gdpr-export"
                className="text-xs"
              >
                <FileDown className="w-3.5 h-3.5 mr-1" />
                GDPR Export
              </Button>
            )}
            {isClientView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`/api/subjects/${subject.id}/gdpr-export`, '_blank');
                }}
                data-testid="btn-client-gdpr-export"
                className="text-xs"
              >
                <FileDown className="w-3.5 h-3.5 mr-1" />
                Stiahnuť moje údaje
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mb-1">
          <div className="text-[10px] text-muted-foreground" data-testid="debug-category-count">
            Počet nájdených kategórií pre tento subjekt: {categories?.length ?? 0} | Záložky: {sortedTabs.length} | Polia: {typeFields.length}
          </div>
        </div>

        <Tabs defaultValue={displayTabs[0]?.code || "identita"} data-testid="tabs-subjekt-view">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1 bg-muted/50 border border-border" data-testid="tablist-subjekt-view">
            {displayTabs.map(tab => {
              const Icon = getTabIcon(tab.icon || "FileText");
              const tabCats = categoriesByTab[tab.id] || [];
              const totalFields = tabCats.reduce((sum, cat) => sum + (fieldsByCategory[cat.code]?.length || 0), 0);
              const catCount = tabCats.length;
              return (
                <TabsTrigger
                  key={tab.code}
                  value={tab.code}
                  className="text-xs px-3 py-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all"
                  data-testid={`tab-${tab.code}`}
                >
                  <Icon className="w-3.5 h-3.5 mr-1.5" />
                  {tab.name}
                  <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 h-4">
                    {catCount}
                  </Badge>
                  {totalFields > 0 && (
                    <Badge variant="secondary" className="ml-0.5 text-[9px] px-1 py-0 h-4">{totalFields}</Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {displayTabs.map(tab => {
            const rawTabCats = categoriesByTab[tab.id] || [];
            const tabCats = isClientView ? rawTabCats.filter(c => !HIDDEN_CLIENT_CATEGORIES.has(c.code)) : rawTabCats;
            return (
              <TabsContent key={tab.code} value={tab.code} className="mt-3" data-testid={`tabcontent-${tab.code}`}>
                {!isClientView && tab.code === "rodina" && (subject.type === "company" || subject.type === "person" || subject.type === "szco") && (
                  <>
                    <RelationshipSection
                      subject={subject}
                      linkedFo={linkedFo || null}
                      linkedPos={linkedPos || []}
                      foPoRisks={riskData?.foPoRisks || []}
                    />
                    <CollaboratorsSection subjectId={subject.id} collaborators={collaborators || []} />
                  </>
                )}

                {tab.code === "identita" && (
                  <AddressCollectionBlock subjectId={subject.id} isClientView={isClientView} />
                )}

                {tab.code === "servis" && (
                  <FieldHistorySection subjectId={subject.id} history={fieldHistory || []} />
                )}

                {tab.code === "profil" && (
                  <MarketingConsentsSection
                    subjectId={subject.id}
                    consents={consents || []}
                    companies={companies || []}
                    activeCompanyId={activeCompanyId ?? undefined}
                    onToggle={(consentType, isGranted, companyId) => {
                      upsertConsent.mutate({ consentType, isGranted, companyId });
                    }}
                    isPending={upsertConsent.isPending}
                  />
                )}

                <CategoriesAccordion
                  tabCode={tab.code}
                  tabCats={tabCats}
                  fieldsByCategory={fieldsByCategory}
                  isEditing={isEditing}
                  getFieldValue={getFieldValue}
                  getEditableValue={getEditableValue}
                  editValues={editValues}
                  setEditFieldValue={setEditFieldValue}
                  summaryFields={summaryFields}
                  pdfSidebarOpen={pdfSidebarOpen}
                  toggleSummaryField={toggleSummaryField}
                  isSuperAdmin={isSuperAdmin}
                  fieldNotes={fieldNotes}
                  onFieldNoteChange={handleFieldNoteChange}
                  onInlineSave={handleInlineSave}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {pdfSidebarOpen && (
        <div className="w-64 border-l border-border pl-4 space-y-3" data-testid="pdf-summary-sidebar">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">PDF Export polia</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Polia označené ikonou oka sa exportujú do &quot;Záznam zo sprostredkovania&quot;
          </p>
          <Separator />
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {typeFields
              .filter(f => summaryFields[f.fieldKey])
              .map(f => (
                <div key={f.id} className="flex items-center justify-between py-1 px-2 rounded bg-primary/5 border border-primary/20">
                  <span className="text-xs truncate">{f.shortLabel || f.label}</span>
                  <button onClick={() => toggleSummaryField(f.fieldKey)} className="text-destructive hover:opacity-80">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            {Object.values(summaryFields).filter(Boolean).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Žiadne polia vybrané pre export
              </p>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            Celkom: {Object.values(summaryFields).filter(Boolean).length} polí
          </div>
        </div>
      )}
    </div>
  );
}

function RelationshipSection({
  subject,
  linkedFo,
  linkedPos,
  foPoRisks,
}: {
  subject: Subject;
  linkedFo: Subject | null;
  linkedPos: Subject[];
  foPoRisks: Array<{ subjectId: number; name: string; uid: string; listStatus: string; relationship: string }>;
}) {
  const isCompany = subject.type === "company";
  const isPerson = subject.type === "person" || subject.type === "szco";

  const hasRelationships = (isCompany && linkedFo) || (isPerson && linkedPos.length > 0);

  function getListBadge(listStatus: string | null) {
    if (!listStatus) return null;
    if (listStatus === "cierny") {
      return <Badge variant="destructive" className="bg-red-900 text-red-200 text-[10px]">Čierny zoznam</Badge>;
    }
    if (listStatus === "cerveny") {
      return <Badge variant="secondary" className="bg-orange-900 text-orange-200 text-[10px]">Červený zoznam</Badge>;
    }
    return null;
  }

  function SubjectCard({ s, role }: { s: Subject; role: string }) {
    const name = s.companyName || [s.firstName, s.lastName].filter(Boolean).join(" ") || "Bez mena";
    const isOnList = !!(s as any).listStatus;
    const listStatus = (s as any).listStatus as string | null;
    return (
      <div
        className={`flex items-center gap-3 rounded-md border px-4 py-3 ${
          isOnList
            ? listStatus === "cierny"
              ? "border-red-700 bg-red-950/60"
              : "border-orange-700 bg-orange-950/60"
            : "border-border bg-muted/30"
        }`}
        data-testid={`relationship-card-${s.id}`}
      >
        <div className={`flex items-center justify-center w-10 h-10 rounded-md ${
          s.type === "company" ? "bg-blue-900/50" : "bg-emerald-900/50"
        }`}>
          {s.type === "company" ? (
            <Building2 className="w-5 h-5 text-blue-400" />
          ) : (
            <User className="w-5 h-5 text-emerald-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{name}</span>
            {getListBadge(listStatus)}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-[9px] px-1 py-0">
              {s.type === "company" ? "PO" : s.type === "szco" ? "SZČO" : "FO"}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono">{s.uid}</span>
          </div>
          <span className="text-[10px] text-muted-foreground mt-0.5 block">{role}</span>
        </div>
        {isOnList && (
          <AlertTriangle className={`w-5 h-5 shrink-0 ${listStatus === "cierny" ? "text-red-400" : "text-orange-400"}`} />
        )}
      </div>
    );
  }

  return (
    <Card className="mb-4" data-testid="relationship-section">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Vzťahy – Konateľ ↔ Firma</span>
        </div>

        {!hasRelationships ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Žiadne prepojenia Konateľ ↔ Firma
          </div>
        ) : (
          <div className="space-y-3">
            {isCompany && linkedFo && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Konateľ tejto firmy</span>
                </div>
                <SubjectCard s={linkedFo} role="Konateľ" />
                {foPoRisks.some(r => r.relationship === "konateľ" && r.subjectId === linkedFo.id) && (
                  <div className="flex items-center gap-2 rounded border border-yellow-700 bg-yellow-950/80 px-3 py-2 text-yellow-200 text-xs">
                    <ShieldAlert className="w-4 h-4 text-yellow-400 shrink-0" />
                    <span>
                      Konateľ je na {(linkedFo as any).listStatus === "cierny" ? "Čiernom" : "Červenom"} zozname – riziko sa prenáša na túto firmu!
                    </span>
                  </div>
                )}
              </div>
            )}

            {isPerson && linkedPos.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Firmy kde je konateľom</span>
                </div>
                {linkedPos.map(po => (
                  <div key={po.id} className="space-y-1">
                    <SubjectCard s={po} role="Firma" />
                    {foPoRisks.some(r => r.relationship === "firma" && r.subjectId === po.id) && (
                      <div className="flex items-center gap-2 rounded border border-yellow-700 bg-yellow-950/80 px-3 py-2 text-yellow-200 text-xs">
                        <ShieldAlert className="w-4 h-4 text-yellow-400 shrink-0" />
                        <span>
                          Firma je na {(po as any).listStatus === "cierny" ? "Čiernom" : "Červenom"} zozname – riziko sa prenáša na konateľa!
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(subject as any).listStatus && (
              <div className="flex items-center gap-2 rounded border border-red-700 bg-red-950/80 px-3 py-2 text-red-200 text-xs mt-2">
                <Ban className="w-4 h-4 text-red-400 shrink-0" />
                <span>
                  Tento subjekt je na {(subject as any).listStatus === "cierny" ? "Čiernom" : "Červenom"} zozname – riziko sa prenáša na prepojené subjekty!
                </span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ROLE_LABELS: Record<string, string> = {
  tiper: "Tipér",
  specialist: "Špecialista",
  spravca: "Správca",
};

const ROLE_COLORS: Record<string, string> = {
  tiper: "bg-purple-900/50 text-purple-300",
  specialist: "bg-cyan-900/50 text-cyan-300",
  spravca: "bg-green-900/50 text-green-300",
};

function CollaboratorsSection({ subjectId, collaborators }: { subjectId: number; collaborators: SubjectCollaborator[] }) {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [newRole, setNewRole] = useState("tiper");
  const [newName, setNewName] = useState("");
  const [newNote, setNewNote] = useState("");

  const addCollab = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/subjects/${subjectId}/collaborators`, {
        role: newRole,
        collaboratorName: newName,
        note: newNote,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "collaborators"] });
      toast({ title: "Spolupracovník pridaný" });
      setAddOpen(false);
      setNewName("");
      setNewNote("");
    },
  });

  const deactivate = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/subjects/collaborators/${id}/deactivate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "collaborators"] });
      toast({ title: "Spolupracovník deaktivovaný" });
    },
  });

  const active = collaborators.filter(c => c.isActive);
  const history = collaborators.filter(c => !c.isActive);

  return (
    <Card className="mb-4" data-testid="collaborators-section">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Spolupracovníci</span>
            <Badge variant="outline" className="text-[10px]">{active.length} aktívnych</Badge>
          </div>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-add-collaborator">
                <Plus className="w-3.5 h-3.5 mr-1" /> Pridať
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Pridať spolupracovníka</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs">Rola</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger data-testid="select-collaborator-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tiper">Tipér</SelectItem>
                      <SelectItem value="specialist">Špecialista</SelectItem>
                      <SelectItem value="spravca">Správca</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Meno</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Meno spolupracovníka" data-testid="input-collaborator-name" />
                </div>
                <div>
                  <Label className="text-xs">Poznámka</Label>
                  <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} rows={2} data-testid="input-collaborator-note" />
                </div>
                <Button onClick={() => addCollab.mutate()} disabled={!newName.trim() || addCollab.isPending} className="w-full" data-testid="button-save-collaborator">
                  {addCollab.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  Uložiť
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {active.length === 0 && history.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">Žiadni spolupracovníci</p>
        )}

        {active.map(c => (
          <div key={c.id} className="flex items-center justify-between border rounded-md px-3 py-2" data-testid={`collaborator-${c.id}`}>
            <div className="flex items-center gap-2">
              <Badge className={`text-[10px] ${ROLE_COLORS[c.role] || "bg-muted"}`}>
                {ROLE_LABELS[c.role] || c.role}
              </Badge>
              <span className="text-sm">{c.collaboratorName || "Neznámy"}</span>
              {c.note && <span className="text-xs text-muted-foreground">({c.note})</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground">{c.validFrom ? formatDateSlovak(String(c.validFrom)) : ""}</span>
              <Button variant="ghost" size="sm" onClick={() => deactivate.mutate(c.id)} data-testid={`button-deactivate-${c.id}`}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}

        {history.length > 0 && (
          <div className="space-y-1 pt-2 border-t border-border">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>História ({history.length})</span>
            </div>
            {history.map(c => (
              <div key={c.id} className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground opacity-60" data-testid={`collaborator-history-${c.id}`}>
                <Badge variant="outline" className="text-[9px]">{ROLE_LABELS[c.role] || c.role}</Badge>
                <span>{c.collaboratorName || "Neznámy"}</span>
                <span>{c.validFrom ? formatDateSlovak(String(c.validFrom)) : ""} – {c.validTo ? formatDateSlovak(String(c.validTo)) : "dnes"}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ADDRESS_TYPE_LABELS: Record<string, string> = {
  trvaly: "Trvalý pobyt",
  prechodny: "Prechodný pobyt",
  korespondencna: "Korešpondenčná adresa",
};

const ADDRESS_FIELD_LABELS: Record<string, string> = {
  ulica: "Ulica",
  supisneCislo: "Súpisné číslo",
  orientacneCislo: "Orientačné číslo",
  obecMesto: "Obec/Mesto",
  psc: "PSČ",
  stat: "Štát",
};

function AddressCollectionBlock({ subjectId, isClientView }: { subjectId: number; isClientView?: boolean }) {
  const { toast } = useToast();
  const [addingType, setAddingType] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState<number | null>(null);

  const { data: addresses, isLoading } = useQuery<SubjectAddress[]>({
    queryKey: ["/api/subjects", subjectId, "addresses"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subjectId}/addresses`).then(r => r.json()),
  });

  const { data: fieldHistory } = useQuery<SubjectFieldHistory[]>({
    queryKey: ["/api/subjects", subjectId, "field-history"],
    queryFn: () => apiRequest("GET", `/api/subjects/${subjectId}/field-history`).then(r => r.json()),
  });

  const createAddress = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return apiRequest("POST", `/api/subjects/${subjectId}/addresses`, data).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "field-history"] });
      toast({ title: "Adresa vytvorená" });
      setAddingType(null);
      setFormData({});
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const updateAddress = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, any> }) => {
      return apiRequest("PATCH", `/api/subjects/${subjectId}/addresses/${id}`, data).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "field-history"] });
      toast({ title: "Adresa aktualizovaná" });
      setEditingId(null);
      setFormData({});
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const deleteAddress = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/subjects/${subjectId}/addresses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "addresses"] });
      toast({ title: "Adresa odstránená" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const setHlavna = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/subjects/${subjectId}/addresses/${id}/set-hlavna`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subjectId, "field-history"] });
      toast({ title: "Hlavná adresa nastavená" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const startAdd = (type: string) => {
    setAddingType(type);
    setEditingId(null);
    setFormData({ stat: "Slovensko" });
  };

  const startEdit = (addr: SubjectAddress) => {
    setEditingId(addr.id);
    setAddingType(null);
    setFormData({
      ulica: addr.ulica || "",
      supisneCislo: addr.supisneCislo || "",
      orientacneCislo: addr.orientacneCislo || "",
      obecMesto: addr.obecMesto || "",
      psc: addr.psc || "",
      stat: addr.stat || "Slovensko",
    });
  };

  const cancelForm = () => {
    setAddingType(null);
    setEditingId(null);
    setFormData({});
  };

  const submitAdd = () => {
    if (!addingType) return;
    createAddress.mutate({ addressType: addingType, ...formData });
  };

  const submitEdit = () => {
    if (!editingId) return;
    updateAddress.mutate({ id: editingId, data: formData });
  };

  const getHistoryForAddress = (addressType: string) => {
    if (!fieldHistory) return [];
    const prefix = `addr_${addressType}_`;
    return fieldHistory.filter(h => h.fieldKey.startsWith(prefix) || (h.fieldKey === "addr_hlavna"));
  };

  const existingTypes = useMemo(() => new Set((addresses || []).map(a => a.addressType)), [addresses]);

  const addrFields = ["ulica", "supisneCislo", "orientacneCislo", "obecMesto", "psc", "stat"] as const;

  const renderForm = () => (
    <div className="grid grid-cols-3 gap-2 mt-2" data-testid="address-form">
      <div className="col-span-2">
        <Label className="text-[10px] text-muted-foreground">Ulica</Label>
        <Input className="h-8 text-xs" value={formData.ulica || ""} onChange={e => setFormData(p => ({ ...p, ulica: e.target.value }))} data-testid="input-addr-ulica" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Súpisné č.</Label>
        <Input className="h-8 text-xs" value={formData.supisneCislo || ""} onChange={e => setFormData(p => ({ ...p, supisneCislo: e.target.value }))} data-testid="input-addr-supisne" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Orientačné č.</Label>
        <Input className="h-8 text-xs" value={formData.orientacneCislo || ""} onChange={e => setFormData(p => ({ ...p, orientacneCislo: e.target.value }))} data-testid="input-addr-orientacne" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">Obec/Mesto</Label>
        <Input className="h-8 text-xs" value={formData.obecMesto || ""} onChange={e => setFormData(p => ({ ...p, obecMesto: e.target.value }))} data-testid="input-addr-obec" />
      </div>
      <div>
        <Label className="text-[10px] text-muted-foreground">PSČ</Label>
        <Input className="h-8 text-xs" value={formData.psc || ""} onChange={e => setFormData(p => ({ ...p, psc: e.target.value }))} data-testid="input-addr-psc" />
      </div>
      <div className="col-span-3">
        <Label className="text-[10px] text-muted-foreground">Štát</Label>
        <Input className="h-8 text-xs" value={formData.stat || "Slovensko"} onChange={e => setFormData(p => ({ ...p, stat: e.target.value }))} data-testid="input-addr-stat" />
      </div>
      <div className="col-span-3 flex items-center gap-2 mt-1">
        <Button size="sm" onClick={addingType ? submitAdd : submitEdit} disabled={createAddress.isPending || updateAddress.isPending} data-testid="button-save-address">
          {(createAddress.isPending || updateAddress.isPending) ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
          Uložiť
        </Button>
        <Button size="sm" variant="ghost" onClick={cancelForm} data-testid="button-cancel-address">
          <X className="w-3 h-3 mr-1" /> Zrušiť
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <Card className="mb-4" data-testid="address-collection-block">
        <CardContent className="p-4 flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4" data-testid="address-collection-block">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Adresy</span>
            <Badge variant="outline" className="text-[10px]">{(addresses || []).length} adries</Badge>
          </div>
          {!isClientView && (
            <div className="flex items-center gap-1">
              {!existingTypes.has("trvaly") && (
                <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => startAdd("trvaly")} data-testid="button-add-trvaly">
                  <Plus className="w-3 h-3 mr-1" /> Trvalý pobyt
                </Button>
              )}
              {!existingTypes.has("prechodny") && (
                <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => startAdd("prechodny")} data-testid="button-add-prechodny">
                  <Plus className="w-3 h-3 mr-1" /> Prechodný pobyt
                </Button>
              )}
              {!existingTypes.has("korespondencna") && (
                <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => startAdd("korespondencna")} data-testid="button-add-korespondencna">
                  <Plus className="w-3 h-3 mr-1" /> Korešpondenčná
                </Button>
              )}
            </div>
          )}
        </div>

        {addingType && (
          <div className="rounded-md border border-blue-500/50 bg-blue-500/5 p-3" data-testid="address-add-form">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-blue-300">{ADDRESS_TYPE_LABELS[addingType]}</span>
              <Badge variant="outline" className="text-[9px] border-blue-500/50">Nová</Badge>
            </div>
            {renderForm()}
          </div>
        )}

        {(!addresses || addresses.length === 0) && !addingType && (
          <p className="text-xs text-muted-foreground text-center py-3">Žiadne adresy. Pridajte adresu pomocou tlačidiel vyššie.</p>
        )}

        {(addresses || []).map(addr => {
          const isEditing = editingId === addr.id;
          const addrHistory = getHistoryForAddress(addr.addressType);
          const isHistoryOpen = historyOpen === addr.id;
          return (
            <div
              key={addr.id}
              className={`rounded-md border p-3 ${addr.isHlavna ? "border-amber-500/60 bg-amber-500/5" : "border-border bg-muted/20"}`}
              data-testid={`address-card-${addr.id}`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className={`w-3.5 h-3.5 ${addr.isHlavna ? "text-amber-400" : "text-muted-foreground"}`} />
                  <span className="text-xs font-semibold">{ADDRESS_TYPE_LABELS[addr.addressType] || addr.addressType}</span>
                  {addr.isHlavna && (
                    <Badge className="text-[9px] bg-amber-600/80 text-white" data-testid={`badge-hlavna-${addr.id}`}>
                      <Mail className="w-2.5 h-2.5 mr-0.5" /> Hlavná
                    </Badge>
                  )}
                </div>
                {!isClientView && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setHistoryOpen(isHistoryOpen ? null : addr.id)}
                      title="História zmien"
                      data-testid={`button-history-${addr.id}`}
                    >
                      <Clock className={`w-3.5 h-3.5 ${isHistoryOpen ? "text-blue-400" : "text-muted-foreground"}`} />
                    </Button>
                    {!addr.isHlavna && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setHlavna.mutate(addr.id)}
                        disabled={setHlavna.isPending}
                        title="Nastaviť ako hlavnú"
                        data-testid={`button-set-hlavna-${addr.id}`}
                      >
                        <Star className="w-3.5 h-3.5 text-muted-foreground hover:text-amber-400" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => isEditing ? cancelForm() : startEdit(addr)}
                      data-testid={`button-edit-${addr.id}`}
                    >
                      <Pencil className={`w-3.5 h-3.5 ${isEditing ? "text-blue-400" : "text-muted-foreground"}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                      onClick={() => { if (confirm("Naozaj odstrániť túto adresu?")) deleteAddress.mutate(addr.id); }}
                      disabled={deleteAddress.isPending}
                      data-testid={`button-delete-${addr.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {isEditing ? (
                renderForm()
              ) : (
                <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                  {addrFields.map(f => {
                    const val = (addr as any)[f];
                    if (!val && f !== "stat") return null;
                    return (
                      <div key={f} className={f === "ulica" ? "col-span-2" : ""}>
                        <span className="text-[10px] text-muted-foreground">{ADDRESS_FIELD_LABELS[f]}: </span>
                        <span className="text-xs font-medium">{val || "-"}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {addr.updatedByName && (
                <div className="mt-1.5 text-[10px] text-muted-foreground">
                  Posledná zmena: {addr.updatedByName} {addr.updatedAt ? `• ${formatDateSlovak(String(addr.updatedAt))}` : ""}
                </div>
              )}

              {isHistoryOpen && addrHistory.length > 0 && (
                <div className="mt-2 border-t border-border pt-2 space-y-1" data-testid={`address-history-${addr.id}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <History className="w-3 h-3 text-blue-400" />
                    <span className="text-[10px] font-semibold text-blue-300">História zmien ({addrHistory.length})</span>
                  </div>
                  {addrHistory.slice(0, 10).map(h => {
                    const fieldSuffix = h.fieldKey.replace(`addr_${addr.addressType}_`, "");
                    const label = ADDRESS_FIELD_LABELS[fieldSuffix] || h.fieldKey;
                    return (
                      <div key={h.id} className="flex items-start gap-2 text-[10px] py-0.5" data-testid={`addr-history-entry-${h.id}`}>
                        <span className="text-muted-foreground whitespace-nowrap">{h.changedAt ? formatDateSlovak(String(h.changedAt)) : ""}</span>
                        <span className="font-medium">{label}:</span>
                        <span className="text-red-400">{h.oldValue || "–"}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-green-400">{h.newValue || "–"}</span>
                        {h.changedByName && <span className="text-muted-foreground ml-auto">({h.changedByName})</span>}
                      </div>
                    );
                  })}
                  {addrHistory.length > 10 && (
                    <p className="text-[10px] text-muted-foreground">...a {addrHistory.length - 10} ďalších záznamov</p>
                  )}
                </div>
              )}
              {isHistoryOpen && addrHistory.length === 0 && (
                <div className="mt-2 border-t border-border pt-2" data-testid={`address-history-${addr.id}`}>
                  <p className="text-[10px] text-muted-foreground">Žiadna história zmien pre túto adresu.</p>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FieldHistorySection({ subjectId, history }: { subjectId: number; history: SubjectFieldHistory[] }) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? history : history.slice(0, 20);

  return (
    <Card className="mb-4" data-testid="field-history-section">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">História zmien polí</span>
          <Badge variant="outline" className="text-[10px]">{history.length} záznamov</Badge>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-3">Žiadne zaznamenané zmeny</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Pole</TableHead>
                <TableHead className="text-xs">Stará hodnota</TableHead>
                <TableHead className="text-xs">Nová hodnota</TableHead>
                <TableHead className="text-xs">Dátum</TableHead>
                <TableHead className="text-xs">Dôvod</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map(h => (
                <TableRow key={h.id} data-testid={`history-row-${h.id}`}>
                  <TableCell className="text-xs py-1.5">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{h.fieldKey}</span>
                      {h.fieldSource === "dynamic" && <Badge variant="outline" className="text-[8px]">dyn</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs py-1.5 text-red-400 max-w-[150px] truncate">{h.oldValue || "-"}</TableCell>
                  <TableCell className="text-xs py-1.5 text-green-400 max-w-[150px] truncate">{h.newValue || "-"}</TableCell>
                  <TableCell className="text-xs py-1.5 text-muted-foreground">{h.changedAt ? formatDateSlovak(String(h.changedAt)) : "-"}</TableCell>
                  <TableCell className="text-xs py-1.5 text-muted-foreground">{h.changeReason || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {history.length > 20 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)} data-testid="button-show-all-history">
            {showAll ? "Zobraziť menej" : `Zobraziť všetky (${history.length})`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function MarketingConsentsSection({
  subjectId,
  consents,
  companies,
  activeCompanyId,
  onToggle,
  isPending,
}: {
  subjectId: number;
  consents: ClientMarketingConsent[];
  companies: any[];
  activeCompanyId?: number;
  onToggle: (consentType: string, isGranted: boolean, companyId: number) => void;
  isPending: boolean;
}) {
  const currentCompany = companies?.find((c: any) => c.id === activeCompanyId);

  if (!activeCompanyId || !currentCompany) {
    return (
      <Card className="mb-4" data-testid="marketing-consents-no-company">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BarChart3 className="w-4 h-4" />
            <span className="text-sm">Marketingové súhlasy - vyberte aktívnu firmu pre zobrazenie</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-4" data-testid="marketing-consents-section">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Marketingové súhlasy</span>
          <Badge variant="outline" className="text-[10px]">{currentCompany.name}</Badge>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Typ súhlasu</TableHead>
              <TableHead className="text-xs w-20 text-center">Stav</TableHead>
              <TableHead className="text-xs w-28">Dátum</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CONSENT_TYPES.map(ct => {
              const consent = consents.find(
                c => c.consentType === ct.code && c.companyId === activeCompanyId
              );
              const isGranted = consent?.isGranted ?? false;
              return (
                <TableRow key={ct.code} data-testid={`consent-row-${ct.code}`}>
                  <TableCell className="text-xs py-2">{ct.label}</TableCell>
                  <TableCell className="text-center py-2">
                    <Switch
                      checked={isGranted}
                      disabled={isPending}
                      onCheckedChange={(checked) => onToggle(ct.code, checked, activeCompanyId)}
                      data-testid={`consent-switch-${ct.code}`}
                    />
                  </TableCell>
                  <TableCell className="text-xs py-2 text-muted-foreground">
                    {consent?.grantedAt
                      ? formatDateSlovak(String(consent.grantedAt))
                      : consent?.revokedAt
                        ? formatDateSlovak(String(consent.revokedAt))
                        : "-"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
