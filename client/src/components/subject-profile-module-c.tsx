import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Subject, SubjectContact } from "@shared/schema";
import { type StaticField, PHOTO_REQUIRED_FIELD_KEYS } from "@/lib/staticFieldDefs";
import { getCategoriesForClientType } from "@/lib/staticFieldDefs";
import { getDocumentValidityStatus, isValidityField, isNumberFieldWithExpiredPair } from "@/lib/document-validity";
import { FieldHistoryIndicator } from "@/components/field-history-indicator";
import { SubjectProfilePhoto } from "@/components/subject-profile-photo";
import { SubjectContactsPanel } from "@/components/subject-contacts-panel";
import { ExpiryBadge } from "@/components/expiry-badge";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";
import { cn, formatUid } from "@/lib/utils";
import {
  Loader2, Pencil, Save, X, Shield,
  ShieldCheck, ListPlus, Eye, ArrowUp, ArrowDown, Settings2, MoreHorizontal,
  Check, User, Phone, Star, Brain, Zap, Link2, Archive, CreditCard, Users,
  ChevronDown, ChevronRight, GripVertical, FolderOpen, ArrowRight, ArrowRightLeft,
  AlertTriangle, Plus, Tag, TrendingUp, TrendingDown, Camera, Ban,
  Home, Briefcase, FileText, ThumbsUp, ThumbsDown, ExternalLink,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, DragOverlay, useDroppable,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const FOLDER_CATEGORY_LABELS: Record<string, string> = {
  povinne: "POVINNÉ ÚDAJE",
  osobne: "OSOBNÉ ÚDAJE",
  doplnkove: "DOPLNKOVÉ ÚDAJE",
  volitelne: "VOLITEĽNÉ / DOBROVOĽNÉ ÚDAJE",
  ine: "INÉ ÚDAJE",
  extrahovane: "EXTRAHOVANÉ ÚDAJE",
};

const PRESET_TAGS: { label: string; color: string; bg: string; border: string }[] = [
  { label: "VIP", color: "text-amber-400", bg: "bg-amber-500/15", border: "border-amber-500/30" },
  { label: "Vozičkár", color: "text-blue-400", bg: "bg-blue-500/15", border: "border-blue-500/30" },
  { label: "Pozor", color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" },
  { label: "Problémový", color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30" },
  { label: "Neaktívny", color: "text-slate-400", bg: "bg-slate-500/15", border: "border-slate-500/30" },
  { label: "Prioritný", color: "text-emerald-400", bg: "bg-emerald-500/15", border: "border-emerald-500/30" },
];

function getTagStyle(tagLabel: string) {
  const preset = PRESET_TAGS.find(t => t.label === tagLabel);
  if (preset) return preset;
  return { label: tagLabel, color: "text-violet-400", bg: "bg-violet-500/15", border: "border-violet-500/30" };
}

export function SubjectTagBadges({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {tags.map(tag => {
        const style = getTagStyle(tag);
        return (
          <span key={tag} className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-semibold", style.color, style.bg, style.border)} data-testid={`tag-badge-${tag}`}>
            <Tag className="w-2.5 h-2.5" />
            {tag}
          </span>
        );
      })}
    </span>
  );
}

export function CgnIndicator({ isCgnActive, size = "sm" }: { isCgnActive: boolean; size?: "sm" | "md" }) {
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  if (isCgnActive) {
    return (
      <span
        className="inline-flex items-center gap-0.5 cursor-help"
        title="Vyžaduje zvýšenú ostražitosť (CGN)"
        data-testid="cgn-indicator-active"
      >
        <TrendingDown className={cn(iconSize, "text-red-500 animate-pulse drop-shadow-[0_0_4px_rgba(239,68,68,0.6)]")} />
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 cursor-help"
      title="Stabilný profil"
      data-testid="cgn-indicator-stable"
    >
      <TrendingUp className={cn(iconSize, "text-emerald-500")} />
    </span>
  );
}

function hasBehaviorAlert(dynamicValues: Record<string, string>): { hasAlert: boolean; alertText: string; hasLegalIncapacity: boolean; legalAlertText: string } {
  const commType = dynamicValues["typ_komunikacie"] || "";
  const note = dynamicValues["poznamka_pristup"] || "";
  const isAggressive = commType.toLowerCase().includes("agresívna");
  const hasNote = note.trim().length > 0;
  const legalCapacity = dynamicValues["sposobilost_pravne_ukony"] || "";
  const hasLegalIncapacity = legalCapacity === "false";
  const legalAlertText = hasLegalIncapacity ? "POZOR: Subjekt nie je spôsobilý na právne úkony! Vyžaduje sa zákonný zástupca." : "";
  const hasAlert = isAggressive || hasNote;
  const parts: string[] = [];
  if (isAggressive) parts.push(`Typ komunikácie: ${commType}`);
  if (hasNote) parts.push(`Poznámka: ${note}`);
  return { hasAlert, alertText: parts.join("\n"), hasLegalIncapacity, legalAlertText };
}

function computeAgeCategory(dynamicValues: Record<string, string>): "Dieťa" | "Dospelý" | "Dôchodca" | null {
  const dob = dynamicValues["datum_narodenia"];
  if (!dob) return null;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  if (age < 18) return "Dieťa";
  if (age >= 65) return "Dôchodca";
  return "Dospelý";
}

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
  lifecycle_status: "lifecycleStatus",
  death_date: "deathDate",
  death_certificate_number: "deathCertificateNumber",
};

const LIFECYCLE_STATUS_OPTIONS = [
  { value: "active", label: "Aktívny", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30", forTypes: ["person", "szco", "company", "po"] },
  { value: "inactive", label: "Neaktívny", color: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30", forTypes: ["person", "szco", "company", "po"] },
  { value: "in_memoriam", label: "In Memoriam (Nebohý)", color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/30", forTypes: ["person"] },
  { value: "zaniknuta", label: "Zaniknutá", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", forTypes: ["szco", "company", "po"] },
  { value: "v_likvidacii", label: "V likvidácii", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30", forTypes: ["szco", "company", "po"] },
];

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
  isPanel: boolean;
  parentSectionId: number | null;
  code: string | null;
  gridColumns?: number;
}

interface DbParameter {
  id: number;
  clientTypeId: number;
  sectionId: number | null;
  panelId: number | null;
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

interface HierarchyNode {
  section: DbSection;
  panels: { panel: DbSection; parameters: DbParameter[] }[];
}

function stripAiPrefix(label: string): string {
  return label.replace(/\s*AI:\d+/g, "").trim();
}

const SEMAPHORE_KEYWORDS = /platnost|platnosť|koniec|_do$|_do_|op_|pas_|stk|preukaz.*platnosť|platnosť.*do/i;
const SEMAPHORE_LABEL_KEYWORDS = /platnosť|koniec|do\b|OP|Pas|STK|preukaz/i;

function isSemaphoreDate(fieldKey: string, label: string): boolean {
  return SEMAPHORE_KEYWORDS.test(fieldKey) || SEMAPHORE_LABEL_KEYWORDS.test(label);
}

function dbParamToStaticField(p: DbParameter): StaticField {
  return {
    id: p.id,
    clientTypeId: p.clientTypeId,
    sectionId: p.sectionId,
    panelId: p.panelId ?? null,
    fieldKey: p.fieldKey,
    label: stripAiPrefix(p.label),
    shortLabel: p.shortLabel ? stripAiPrefix(p.shortLabel) : undefined,
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

function DynamicFieldInput({ field, dynamicValues, setDynamicValues, hasError, disabled, subjectId, labelOverride, shortLabelOverride }: {
  field: StaticField;
  dynamicValues: Record<string, string>;
  setDynamicValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hasError?: boolean;
  disabled?: boolean;
  subjectId?: number;
  labelOverride?: string;
  shortLabelOverride?: string | null;
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
        {PHOTO_REQUIRED_FIELD_KEYS.has(field.fieldKey) && dynamicValues[field.fieldKey] && !disabled && (
          <span title="📸 Vizuálna evidencia – odporúčame priložiť fotografiu" className="text-amber-500" data-testid={`photo-required-${field.fieldKey}`}>
            <Camera className="w-3.5 h-3.5" />
          </span>
        )}
      </div>
      {field.fieldType === "long_text" ? (
        <div className="relative">
          <Textarea
            value={dynamicValues[field.fieldKey] || ""}
            onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
            rows={2}
            className={cn(errorBorder, "pr-12")}
            disabled={disabled}
            data-testid={`input-dynamic-${field.fieldKey}`}
          />
          {subjectId && <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} inline />}
        </div>
      ) : field.fieldKey === "parameter_cgn" ? (
        <div className={cn(
          "rounded-md transition-colors",
          dynamicValues[field.fieldKey] === "CGN / Negarantované" && "bg-red-500/10 ring-1 ring-red-500/30 p-1"
        )}>
          <Select
            value={dynamicValues[field.fieldKey] || "Garantované / Overené"}
            onValueChange={val => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: val }))}
            disabled={disabled}
          >
            <SelectTrigger className={cn(
              dynamicValues[field.fieldKey] === "CGN / Negarantované"
                ? "border-red-500/50 text-red-400"
                : "border-emerald-500/40 text-emerald-400"
            )} data-testid={`select-dynamic-${field.fieldKey}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Garantované / Overené">
                <span className="inline-flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-400 font-medium">Garantované / Overené</span>
                </span>
              </SelectItem>
              <SelectItem value="CGN / Negarantované">
                <span className="inline-flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-red-400 font-medium">CGN / Negarantované</span>
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : field.fieldKey === "vekova_kategoria" ? (
        <div
          className="h-9 w-full flex items-center px-3 rounded-md bg-muted/50 border border-border text-sm font-medium text-foreground cursor-default select-none"
          data-testid={`input-dynamic-${field.fieldKey}`}
        >
          {dynamicValues[field.fieldKey] || "—"}
          {dynamicValues[field.fieldKey] && (
            <span className="ml-2 text-[9px] text-muted-foreground/70">(automaticky z dátumu narodenia)</span>
          )}
        </div>
      ) : field.fieldType === "combobox" || field.fieldType === "jedna_moznost" ? (
        <div className="relative">
          <Select
            value={dynamicValues[field.fieldKey] || ""}
            onValueChange={val => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: val }))}
            disabled={disabled}
          >
            <SelectTrigger className={cn(errorBorder, disabled && "bg-muted/50 cursor-default opacity-100", "pr-12")} data-testid={`select-dynamic-${field.fieldKey}`}>
              <SelectValue placeholder="" />
            </SelectTrigger>
            <SelectContent>
              {(field.options || []).map((opt: string) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {subjectId && <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} inline />}
        </div>
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
          {subjectId && <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} />}
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
          {subjectId && <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} />}
        </div>
      ) : field.fieldType === "date" ? (
        (() => {
          const dateVal = dynamicValues[field.fieldKey] || "";
          const isValidity = isValidityField(field.fieldKey) || isSemaphoreDate(field.fieldKey, displayLabel);
          const validity = isValidity && dateVal ? getDocumentValidityStatus(dateVal) : null;
          const validityClass = validity ? `${validity.borderClass} ${validity.bgClass}` : "";
          const validityLabel = validity?.label || "";
          return (
            <div className="relative">
              <Input
                type="date"
                value={dateVal}
                onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
                disabled={disabled}
                className={cn(errorBorder || validityClass, validityLabel && "pr-[5.5rem]")}
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
              {subjectId && !validity && <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} inline />}
            </div>
          );
        })()
      ) : field.fieldType === "number" && field.fieldKey === "vek" ? (
        disabled ? (
          <div
            className="h-9 w-full flex items-center px-3 rounded-md bg-muted/50 border border-border text-sm font-medium text-foreground cursor-default select-none whitespace-nowrap"
            data-testid={`input-dynamic-${field.fieldKey}`}
          >
            {dynamicValues[field.fieldKey] ? `${dynamicValues[field.fieldKey]} rokov` : ""}
          </div>
        ) : (
          <Input
            type="number"
            value={dynamicValues[field.fieldKey] || ""}
            onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
            className={errorBorder}
            data-testid={`input-dynamic-${field.fieldKey}`}
          />
        )
      ) : field.fieldType === "number" ? (
        <div className="relative">
          <Input
            type="number"
            value={dynamicValues[field.fieldKey] || ""}
            onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
            className={cn(errorBorder, "pr-12")}
            disabled={disabled}
            data-testid={`input-dynamic-${field.fieldKey}`}
          />
          {subjectId && <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} inline />}
        </div>
      ) : field.fieldType === "email" ? (
        <div className="relative">
          <Input
            type="email"
            value={dynamicValues[field.fieldKey] || ""}
            onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
            className={cn(errorBorder, "pr-12")}
            disabled={disabled}
            data-testid={`input-dynamic-${field.fieldKey}`}
          />
          {subjectId && <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} inline />}
        </div>
      ) : field.fieldType === "phone" ? (
        <div className="relative">
          <Input
            type="tel"
            value={dynamicValues[field.fieldKey] || ""}
            onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
            className={cn(errorBorder, "pr-12")}
            disabled={disabled}
            data-testid={`input-dynamic-${field.fieldKey}`}
          />
          {subjectId && <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} inline />}
        </div>
      ) : field.fieldType === "iban" ? (
        <div className="relative">
          <Input
            value={dynamicValues[field.fieldKey] || ""}
            onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value.toUpperCase() }))}
            placeholder="SK00 0000 0000 0000 0000 0000"
            className={cn(`font-mono ${errorBorder}`, "pr-12")}
            disabled={disabled}
            data-testid={`input-dynamic-${field.fieldKey}`}
          />
          {subjectId && <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} inline />}
        </div>
      ) : (
        <div className="relative">
          <Input
            value={dynamicValues[field.fieldKey] || ""}
            onChange={e => setDynamicValues(prev => ({ ...prev, [field.fieldKey]: e.target.value }))}
            className={cn(errorBorder, "pr-12")}
            disabled={disabled}
            data-testid={`input-dynamic-${field.fieldKey}`}
          />
          {subjectId && <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} inline />}
        </div>
      )}
    </div>
  );
}

function SortableFieldItem({ id, children, isArchitectMode }: { id: string; children: React.ReactNode; isArchitectMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !isArchitectMode,
    data: { type: "field" },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: "relative" as const,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} className="min-w-0 relative">
      {isArchitectMode && (
        <div {...listeners} className="absolute -left-1 top-1/2 -translate-y-1/2 z-20 cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-amber-500/20" data-testid={`drag-handle-${id}`}>
          <GripVertical className="w-3 h-3 text-amber-500/70" />
        </div>
      )}
      {children}
    </div>
  );
}

function DroppablePanelZone({ panelId, children, isOver }: { panelId: number; children: React.ReactNode; isOver?: boolean }) {
  const { setNodeRef, isOver: dropIsOver } = useDroppable({ id: `panel-drop-${panelId}`, data: { type: "panel", panelId } });
  const highlight = isOver || dropIsOver;
  return (
    <div ref={setNodeRef} className={cn("transition-colors rounded-md", highlight && "ring-2 ring-amber-500/50 bg-amber-500/5")} data-testid={`droppable-panel-${panelId}`}>
      {children}
    </div>
  );
}

function getPanelHeatmapClass(parameters: { fieldKey: string }[], fieldFreshness: Record<string, string>): string {
  let latestDate: Date | null = null;
  for (const p of parameters) {
    const dateStr = fieldFreshness[p.fieldKey];
    if (dateStr) {
      const d = new Date(dateStr);
      if (!latestDate || d > latestDate) latestDate = d;
    }
  }
  if (!latestDate) return "";
  const now = new Date();
  const diffHours = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60);
  if (diffHours <= 24) return "border-blue-500/50 bg-blue-500/15 shadow-blue-500/10 shadow-sm";
  if (diffHours <= 72) return "border-blue-400/30 bg-blue-400/8";
  if (diffHours <= 168) return "border-blue-300/20 bg-blue-300/5";
  return "";
}

function getHeatmapLabel(parameters: { fieldKey: string }[], fieldFreshness: Record<string, string>): string | null {
  let latestDate: Date | null = null;
  for (const p of parameters) {
    const dateStr = fieldFreshness[p.fieldKey];
    if (dateStr) {
      const d = new Date(dateStr);
      if (!latestDate || d > latestDate) latestDate = d;
    }
  }
  if (!latestDate) return null;
  const now = new Date();
  const diffHours = (now.getTime() - latestDate.getTime()) / (1000 * 60 * 60);
  if (diffHours <= 24) return "Zmena < 24h";
  if (diffHours <= 72) return "Zmena < 3 dni";
  if (diffHours <= 168) return "Zmena < 7 dní";
  return null;
}

interface StatutarChange {
  fieldKey: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export function SubjectProfileModuleC({ subject }: ModuleCProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [transferParam, setTransferParam] = useState<{ paramId: number; paramLabel: string; currentPanelId: number } | null>(null);
  const [statutarConfirm, setStatutarConfirm] = useState<{ changes: StatutarChange[] } | null>(null);
  const editOriginalValues = useRef<Record<string, string>>({});
  const archiveNotifyRef = useRef(false);

  const ARCHIVE_TRIGGER_KEYS = useMemo(() => new Set([
    "priezvisko",
    "meno_organizacie",
    "adresa",
    "addr_trvaly_ulica", "addr_trvaly_supisneCislo", "addr_trvaly_orientacneCislo",
    "addr_trvaly_obecMesto", "addr_trvaly_psc", "addr_trvaly_stat",
    "addr_prechodny_ulica", "addr_prechodny_supisneCislo", "addr_prechodny_orientacneCislo",
    "addr_prechodny_obecMesto", "addr_prechodny_psc", "addr_prechodny_stat",
    "addr_korespondencna_ulica", "addr_korespondencna_supisneCislo", "addr_korespondencna_orientacneCislo",
    "addr_korespondencna_obecMesto", "addr_korespondencna_psc", "addr_korespondencna_stat",
    "addr_hlavna",
    "tp_ulica", "tp_supisne", "tp_orientacne", "tp_psc", "tp_mesto", "tp_stat",
    "ka_ulica", "ka_supisne", "ka_orientacne", "ka_psc", "ka_mesto", "ka_stat",
    "koa_ulica", "koa_supisne", "koa_orientacne", "koa_psc", "koa_mesto", "koa_stat",
    "sidlo_ulica", "sidlo_supisne", "sidlo_orientacne", "sidlo_psc", "sidlo_mesto", "sidlo_stat",
  ]), []);

  function checkArchiveTrigger(current: Record<string, string>, original: Record<string, string>): boolean {
    for (const key of ARCHIVE_TRIGGER_KEYS) {
      if ((current[key] || "") !== (original[key] || "")) return true;
    }
    return false;
  }

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
    staleTime: Infinity,
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

  const { data: fieldFreshness = {} } = useQuery<Record<string, string>>({
    queryKey: ["/api/subjects", subject.id, "field-history", "freshness"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subject.id}/field-history/freshness`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: subject.id > 0,
  });

  const { data: familyCluster } = useQuery<{
    members: Array<{ id: number; uid: string; firstName: string; lastName: string; type: string; email?: string; phone?: string; contractCount: number; annualPremium: number; lifecycleStatus?: string }>;
    currentSubject: { contractCount: number; annualPremium: number };
    totalFamilyWealth: number;
    totalContracts: number;
  }>({
    queryKey: ["/api/subjects", subject.id, "family-cluster"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subject.id}/family-cluster`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: subject.id > 0,
  });

  const { data: subjectPortfolio } = useQuery<{
    contracts: Array<{ id: number; uid?: string; contractNumber?: string; contractType?: string; premiumAmount?: number; annualPremium?: number; currency?: string; statusName?: string; statusColor?: string; partnerName?: string; productName?: string; sectorName?: string; signedDate?: string; expiryDate?: string }>;
    totalContracts: number;
    totalAnnualPremium: number;
  }>({
    queryKey: ["/api/subjects", subject.id, "portfolio"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subject.id}/portfolio`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: subject.id > 0,
  });

  const { data: suggestedRelationsData } = useQuery<Array<{
    suggestion: { id: number; detectedName: string; detectedRole?: string; status: string; confirmCount: number; matchedSubjectId?: number };
    matchedSubject?: { id: number; firstName?: string; lastName?: string; companyName?: string; type: string };
  }>>({
    queryKey: ["/api/subjects", subject.id, "suggested-relations"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subject.id}/suggested-relations`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: subject.id > 0,
  });

  const confirmSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: number) => {
      const res = await apiRequest("POST", `/api/suggested-relations/${suggestionId}/confirm`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "suggested-relations"] });
      if (data.autoPromoted) {
        queryClient.invalidateQueries({ queryKey: ["/api/subject-relations"] });
        toast({ title: "Relácia automaticky vytvorená", description: "Potvrdenie dosiahlo 5x - relácia bola automaticky vytvorená." });
      } else {
        toast({ title: "Potvrdené", description: `Potvrdenie ${data.suggestion.confirmCount}/5` });
      }
    },
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: async (suggestionId: number) => {
      const res = await apiRequest("POST", `/api/suggested-relations/${suggestionId}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id, "suggested-relations"] });
      toast({ title: "Zamietnuté" });
    },
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

  const hierarchyByCategory = useMemo(() => {
    if (!dbSections || !dbParameters) return {} as Record<string, HierarchyNode[]>;

    const activeParams = dbParameters.filter(p => p.isActive && !p.isHidden);
    const allSections = [...dbSections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const sections = allSections.filter(s => !s.isPanel);
    const panels = allSections.filter(s => s.isPanel);

    const result: Record<string, HierarchyNode[]> = {};
    const assignedParamIds = new Set<number>();

    for (const section of sections) {
      const category = section.folderCategory || "doplnkove";
      const childPanels = panels
        .filter(p => p.parentSectionId === section.id)
        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      const panelNodes = childPanels.map(panel => {
        const panelParams = activeParams
          .filter(p => p.panelId === panel.id)
          .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
        panelParams.forEach(p => assignedParamIds.add(p.id));
        return { panel, parameters: panelParams };
      }).filter(pn => pn.parameters.length > 0);

      const sectionLevelParams = activeParams
        .filter(p => p.sectionId === section.id && !p.panelId && !assignedParamIds.has(p.id))
        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

      if (sectionLevelParams.length > 0) {
        const virtualPanel: DbSection = {
          id: -section.id,
          name: section.name,
          folderCategory: section.folderCategory,
          sortOrder: -999,
          clientTypeId: section.clientTypeId,
          isPanel: true,
          parentSectionId: section.id,
          code: null,
          gridColumns: section.gridColumns,
        };
        panelNodes.unshift({ panel: virtualPanel, parameters: sectionLevelParams });
        sectionLevelParams.forEach(p => assignedParamIds.add(p.id));
      }

      if (panelNodes.length === 0) continue;

      if (!result[category]) result[category] = [];
      result[category].push({ section, panels: panelNodes });
    }

    const orphanParams = activeParams.filter(p => !assignedParamIds.has(p.id));
    if (orphanParams.length > 0) {
      const orphanSection: DbSection = { id: -9999, name: "Nezaradené parametre", folderCategory: "ine", sortOrder: 9999, clientTypeId: 0, isPanel: false, parentSectionId: null, code: null };
      const orphanPanel: DbSection = { id: -9998, name: "Nezaradené", folderCategory: "ine", sortOrder: 0, clientTypeId: 0, isPanel: true, parentSectionId: -9999, code: null };
      if (!result["ine"]) result["ine"] = [];
      result["ine"].push({ section: orphanSection, panels: [{ panel: orphanPanel, parameters: orphanParams }] });
    }

    return result;
  }, [dbSections, dbParameters]);

  const [isArchitectMode, setIsArchitectMode] = useState(false);
  const [fieldLayouts, setFieldLayouts] = useState<Record<string, { sortOrder: number; widthClass: string; rowGroup: number }>>({});
  const [expandedSections, setExpandedSections] = useState<string[]>([]);
  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(new Set());
  const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const togglePanel = useCallback((key: string) => {
    setExpandedPanels(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const scrollToPanel = useCallback((panelId: number | string) => {
    const key = `panel-${panelId}`;
    setExpandedPanels(prev => { const next = new Set(prev); next.add(key); return next; });
    setTimeout(() => {
      panelRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }, []);

  const toggleSection = useCallback((key: string, panelIds?: number[]) => {
    setExpandedSections(prev => {
      const isOpening = !prev.includes(key);
      if (isOpening && panelIds && panelIds.length > 0) {
        setExpandedPanels(pp => {
          const next = new Set(pp);
          panelIds.slice(0, 2).forEach(id => next.add(`panel-${id}`));
          return next;
        });
      }
      return isOpening ? [...prev, key] : prev.filter(k => k !== key);
    });
  }, []);
  const [renamingSection, setRenamingSection] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const renameSectionMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return apiRequest("PATCH", `/api/subject-param-sections/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-param-sections"] });
      setRenamingSection(null);
      setRenameValue("");
      toast({ title: "Sekcia premenovaná", description: "Zmena sa prejavila aj v šablóne (B)." });
    },
  });

  const moveSectionCategoryMutation = useMutation({
    mutationFn: async ({ id, folderCategory }: { id: number; folderCategory: string }) => {
      return apiRequest("PATCH", `/api/subject-param-sections/${id}`, { folderCategory });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-param-sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters"] });
      toast({ title: "Accordion zmenený", description: "Sekcia presunutá, zmena zapísaná do šablóny (B)." });
    },
  });

  const batchReorderMutation = useMutation({
    mutationFn: async (items: { id: number; sortOrder: number; panelId?: number }[]) => {
      return apiRequest("POST", "/api/subject-parameters/batch-reorder", { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters"] });
      toast({ title: "Poradie uložené", description: "Zmena zapísaná do šablóny (B)." });
    },
  });

  const transferParamMutation = useMutation({
    mutationFn: async ({ paramId, targetPanelId }: { paramId: number; targetPanelId: number }) => {
      return apiRequest("PATCH", `/api/subject-parameters/${paramId}`, { panelId: targetPanelId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subject-parameters"] });
      setTransferParam(null);
      toast({ title: "Parameter presunutý", description: "Presun do nového panelu zapísaný v šablóne (B)." });
    },
  });

  const subjectTags = useMemo(() => {
    const det = (subject.details || {}) as Record<string, any>;
    return Array.isArray(det.tags) ? det.tags as string[] : [];
  }, [subject.details]);

  const [showTagPicker, setShowTagPicker] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");

  const tagsMutation = useMutation({
    mutationFn: async (newTags: string[]) => {
      const existingDetails = (subject.details || {}) as Record<string, any>;
      return apiRequest("PATCH", `/api/subjects/${subject.id}`, {
        details: { ...existingDetails, tags: newTags },
        changeReason: "Zmena tagov",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id] });
      toast({ title: "Tagy aktualizované" });
    },
  });

  const addTag = (tag: string) => {
    const normalized = tag.trim().replace(/\s+/g, " ");
    if (!normalized) return;
    const exists = subjectTags.some(t => t.toLowerCase() === normalized.toLowerCase());
    if (!exists) {
      tagsMutation.mutate([...subjectTags, normalized]);
    }
  };

  const removeTag = (tag: string) => {
    tagsMutation.mutate(subjectTags.filter(t => t !== tag));
  };

  const isCgnActive = useMemo(() => {
    const det = (subject.details || {}) as Record<string, any>;
    return det.cgnActive === true;
  }, [subject.details]);

  const [showCgnAlert, setShowCgnAlert] = useState(false);

  useEffect(() => {
    if (!isCgnActive || subject.id <= 0) return;
    const storageKey = `cgn_alert_${subject.id}`;
    const today = new Date().toISOString().slice(0, 10);
    const lastShown = localStorage.getItem(storageKey);
    if (lastShown !== today) {
      setShowCgnAlert(true);
      localStorage.setItem(storageKey, today);
    }
  }, [isCgnActive, subject.id]);

  const cgnMutation = useMutation({
    mutationFn: async (active: boolean) => {
      const existingDetails = (subject.details || {}) as Record<string, any>;
      return apiRequest("PATCH", `/api/subjects/${subject.id}`, {
        details: { ...existingDetails, cgnActive: active },
        changeReason: active ? "Aktivácia režimu CGN" : "Deaktivácia režimu CGN",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects", subject.id] });
      toast({ title: isCgnActive ? "CGN režim deaktivovaný" : "CGN režim aktivovaný" });
    },
  });

  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleGlobalDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(String(event.active.id));
  }, []);

  const handleGlobalDragEnd = useCallback((allPanelParams: { panelId: number; parameters: DbParameter[] }[]) => (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const activeParamId = Number(active.id);
    const overIdStr = String(over.id);

    let sourcePanelId: number | null = null;
    let sourceParams: DbParameter[] = [];
    for (const pp of allPanelParams) {
      const found = pp.parameters.find(p => p.id === activeParamId);
      if (found) {
        sourcePanelId = pp.panelId;
        sourceParams = pp.parameters;
        break;
      }
    }
    if (sourcePanelId === null) return;

    if (overIdStr.startsWith("panel-drop-")) {
      const targetPanelId = Number(overIdStr.replace("panel-drop-", ""));
      if (targetPanelId !== sourcePanelId && targetPanelId > 0) {
        const targetPanel = allPanelParams.find(pp => pp.panelId === targetPanelId);
        const newSortOrder = targetPanel ? (targetPanel.parameters.length + 1) * 10 : 10;
        batchReorderMutation.mutate([{ id: activeParamId, sortOrder: newSortOrder, panelId: targetPanelId }]);
        return;
      }
    }

    const overParamId = Number(over.id);
    let targetPanelId: number | null = null;
    let targetParams: DbParameter[] = [];
    for (const pp of allPanelParams) {
      if (pp.parameters.some(p => p.id === overParamId)) {
        targetPanelId = pp.panelId;
        targetParams = pp.parameters;
        break;
      }
    }

    if (targetPanelId === null) return;

    if (targetPanelId === sourcePanelId) {
      if (active.id === over.id) return;
      const oldIndex = sourceParams.findIndex(p => p.id === activeParamId);
      const newIndex = sourceParams.findIndex(p => p.id === overParamId);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(sourceParams, oldIndex, newIndex);
      const items = reordered.map((p, i) => ({ id: p.id, sortOrder: (i + 1) * 10 }));
      batchReorderMutation.mutate(items);
    } else {
      const dropIndex = targetParams.findIndex(p => p.id === overParamId);
      const newSortOrder = dropIndex >= 0 ? (dropIndex + 1) * 10 - 5 : (targetParams.length + 1) * 10;
      batchReorderMutation.mutate([{ id: activeParamId, sortOrder: newSortOrder, panelId: targetPanelId }]);
    }
  }, [batchReorderMutation]);

  const allPanels = useMemo(() => {
    if (!dbSections) return [];
    return dbSections.filter(s => s.isPanel && s.id > 0).sort((a, b) => a.name.localeCompare(b.name, "sk"));
  }, [dbSections]);

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
    const det = (subject.details || {}) as Record<string, any>;
    if (!initial["parameter_cgn"]) {
      initial["parameter_cgn"] = det.cgnActive === true ? "CGN / Negarantované" : "Garantované / Overené";
    }
    if (subject.firstName && !initial["meno"]) initial["meno"] = subject.firstName;
    if (subject.lastName && !initial["priezvisko"]) initial["priezvisko"] = subject.lastName;
    if (subject.birthNumber && !initial["rodne_cislo"]) initial["rodne_cislo"] = subject.birthNumber;
    if (subject.email && !initial["email"]) initial["email"] = subject.email;
    if (subject.phone && !initial["telefon"]) initial["telefon"] = subject.phone;
    if (subject.idCardNumber && !initial["cislo_dokladu"]) initial["cislo_dokladu"] = subject.idCardNumber;
    initial["lifecycle_status"] = (subject as any).lifecycleStatus || "active";
    if ((subject as any).deathDate) initial["death_date"] = (subject as any).deathDate;
    if ((subject as any).deathCertificateNumber) initial["death_certificate_number"] = (subject as any).deathCertificateNumber;
    return initial;
  });

  useEffect(() => {
    setDynamicValues(prev => {
      const updates: Record<string, string> = {};
      if (subject.firstName && !prev["meno"]) updates["meno"] = subject.firstName;
      if (subject.lastName && !prev["priezvisko"]) updates["priezvisko"] = subject.lastName;
      if (subject.birthNumber && !prev["rodne_cislo"]) updates["rodne_cislo"] = subject.birthNumber;
      if (subject.email && !prev["email"]) updates["email"] = subject.email;
      if (subject.phone && !prev["telefon"]) updates["telefon"] = subject.phone;
      if (subject.idCardNumber && !prev["cislo_dokladu"]) updates["cislo_dokladu"] = subject.idCardNumber;
      if (Object.keys(updates).length === 0) return prev;
      return { ...prev, ...updates };
    });
  }, [subject.id, subject.firstName, subject.lastName, subject.birthNumber, subject.email, subject.phone, subject.idCardNumber]);

  const isInMemoriam = dynamicValues["lifecycle_status"] === "in_memoriam";
  const isZaniknuta = dynamicValues["lifecycle_status"] === "zaniknuta";
  const isVLikvidacii = dynamicValues["lifecycle_status"] === "v_likvidacii";
  const isTerminated = isZaniknuta || isVLikvidacii;
  const subjectType = (subject as any).type || "person";

  const { data: statusEvidenceList = [] } = useQuery<any[]>({
    queryKey: ["/api/subjects", subject.id, "status-evidence"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subject.id}/status-evidence`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: subject.id > 0,
  });
  const hasEvidence = statusEvidenceList.length > 0 && isTerminated;

  const { data: subjectContactsList = [] } = useQuery<SubjectContact[]>({
    queryKey: ["/api/subjects", subject.id, "contacts"],
    queryFn: async () => {
      const res = await fetch(`/api/subjects/${subject.id}/contacts`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: subject.id > 0,
  });

  const behaviorAlert = useMemo(() => hasBehaviorAlert(dynamicValues), [dynamicValues]);
  const displayName = useMemo(() => [subject.firstName, subject.lastName].filter(Boolean).join(" ") || subject.companyName || "", [subject.firstName, subject.lastName, subject.companyName]);

  const ageCategory = useMemo(() => computeAgeCategory(dynamicValues), [dynamicValues]);

  useEffect(() => {
    if (subjectContactsList.length === 0) return;
    const primaryPhone = subjectContactsList.find(c => c.type === "phone" && c.isPrimary)?.value ?? subjectContactsList.find(c => c.type === "phone")?.value ?? null;
    const primaryEmail = subjectContactsList.find(c => c.type === "email" && c.isPrimary)?.value ?? subjectContactsList.find(c => c.type === "email")?.value ?? null;
    setDynamicValues(prev => {
      const next = { ...prev };
      if (primaryPhone !== null && prev.telefon !== primaryPhone) next.telefon = primaryPhone;
      if (primaryEmail !== null && prev.email !== primaryEmail) next.email = primaryEmail;
      if (next.telefon === prev.telefon && next.email === prev.email) return prev;
      return next;
    });
  }, [subjectContactsList]);

  useEffect(() => {
    if (!ageCategory) return;
    setDynamicValues(prev => {
      if (prev["vekova_kategoria"] === ageCategory) return prev;
      return { ...prev, vekova_kategoria: ageCategory };
    });
  }, [ageCategory]);

  useEffect(() => {
    if (!ageCategory || subject.id <= 0) return;
    const AGE_TAGS = ["Dieťa", "Dôchodca"];
    const currentTags = subjectTags;
    let newTags = currentTags.filter(t => !AGE_TAGS.includes(t));
    if (ageCategory === "Dieťa" && !newTags.includes("Dieťa")) {
      newTags = [...newTags, "Dieťa"];
    } else if (ageCategory === "Dôchodca" && !newTags.includes("Dôchodca")) {
      newTags = [...newTags, "Dôchodca"];
    }
    if (JSON.stringify(newTags) !== JSON.stringify(currentTags)) {
      tagsMutation.mutate(newTags);
    }
  }, [ageCategory, subject.id]);

  const cgnDropdownValue = dynamicValues["parameter_cgn"] || "Garantované / Overené";
  const cgnDropdownIsCgn = cgnDropdownValue === "CGN / Negarantované";

  useEffect(() => {
    const expected = isCgnActive ? "CGN / Negarantované" : "Garantované / Overené";
    setDynamicValues(prev => {
      if (prev["parameter_cgn"] === expected) return prev;
      return { ...prev, parameter_cgn: expected };
    });
  }, [isCgnActive]);

  const cgnSyncRef = useRef(cgnDropdownIsCgn);
  useEffect(() => {
    if (subject.id <= 0) return;
    if (cgnSyncRef.current === cgnDropdownIsCgn) return;
    cgnSyncRef.current = cgnDropdownIsCgn;
    if (cgnDropdownIsCgn !== isCgnActive) {
      cgnMutation.mutate(cgnDropdownIsCgn);
    }
  }, [cgnDropdownIsCgn]);

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

      const primaryPhoneContact = subjectContactsList.find(c => c.type === "phone" && c.isPrimary) ?? subjectContactsList.find(c => c.type === "phone");
      const primaryEmailContact = subjectContactsList.find(c => c.type === "email" && c.isPrimary) ?? subjectContactsList.find(c => c.type === "email");
      if (primaryPhoneContact) {
        payload.phone = primaryPhoneContact.value;
      } else if (dynamicValues.telefon) {
        payload.phone = dynamicValues.telefon;
      }
      if (primaryEmailContact) {
        payload.email = primaryEmailContact.value;
      } else if (dynamicValues.email) {
        payload.email = dynamicValues.email;
      }

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
      if (archiveNotifyRef.current) {
        archiveNotifyRef.current = false;
        setTimeout(() => {
          toast({ title: "🗄️ Trezor", description: "Stará hodnota bola archivovaná.", duration: 3500 });
        }, 600);
      }
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

      <Card className="border border-border/60 bg-card/30" data-testid="module-c-header">
        <CardContent className="p-4 space-y-3">
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
                    onClick={() => {
                      if (clientTypeId === 5 || clientTypeId === 6) {
                        const STATUTAR_PREFIXES = ["statutar_meno_", "statutar_funkcia_", "statutar_rc_"];
                        const changed: StatutarChange[] = [];
                        for (const [key, newVal] of Object.entries(dynamicValues)) {
                          if (!STATUTAR_PREFIXES.some(p => key.startsWith(p))) continue;
                          const oldVal = editOriginalValues.current[key] || "";
                          if ((newVal || "") !== oldVal) {
                            changed.push({
                              fieldKey: key,
                              label: key.replace(/_/g, " "),
                              oldValue: oldVal || "(prázdne)",
                              newValue: newVal || "(prázdne)",
                            });
                          }
                        }
                        if (changed.length > 0) {
                          archiveNotifyRef.current = checkArchiveTrigger(dynamicValues, editOriginalValues.current);
                          setStatutarConfirm({ changes: changed });
                          return;
                        }
                      }
                      archiveNotifyRef.current = checkArchiveTrigger(dynamicValues, editOriginalValues.current);
                      saveMutation.mutate();
                    }}
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
                  onClick={() => {
                    editOriginalValues.current = { ...dynamicValues };
                    setIsEditing(true);
                  }}
                  title="Upraviť profil"
                  data-testid="btn-start-edit"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Upraviť
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-start gap-4">
            {subject.id > 0 && (
              <div className={cn("shrink-0", isInMemoriam && "grayscale")} data-testid="module-c-photo">
                <SubjectProfilePhoto subjectId={subject.id} size="lg" editable={isEditing} showHistory />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-2">
              {subject.id > 0 && (
                <div className="flex items-center gap-2 flex-wrap" data-testid="profile-name-bar">
                  <CgnIndicator isCgnActive={isCgnActive} size="md" />
                  {isInMemoriam && <span className="text-xl" title="In Memoriam" data-testid="in-memoriam-candle">🕯️</span>}
                  <span className={cn("text-lg font-bold", isCgnActive && "text-orange-400", isInMemoriam && "text-purple-300")} data-testid="text-subject-name">{displayName}</span>
                  {isInMemoriam && (
                    <Badge variant="outline" className="border-purple-500/40 text-purple-400 text-[10px]" data-testid="badge-in-memoriam">
                      In Memoriam
                    </Badge>
                  )}
                  {isTerminated && (
                    <Badge variant="outline" className={cn("text-[10px] flex items-center gap-1", isZaniknuta ? "border-red-500/40 text-red-400" : "border-amber-500/40 text-amber-400")} data-testid="badge-terminated">
                      <Ban className="w-3 h-3" />
                      {isZaniknuta ? "Zaniknutá" : "V likvidácii"}
                      {hasEvidence && <Camera className="w-3 h-3 ml-0.5" data-testid="badge-evidence-camera" />}
                    </Badge>
                  )}
                  {behaviorAlert.hasLegalIncapacity && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-600/20 border-2 border-red-500/50 cursor-help animate-pulse"
                      title={behaviorAlert.legalAlertText}
                      data-testid="legal-incapacity-alert"
                    >
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <span className="text-xs font-bold text-red-400">NESPÔSOBILÝ</span>
                    </span>
                  )}
                  {behaviorAlert.hasAlert && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 cursor-help"
                      title={behaviorAlert.alertText}
                      data-testid="behavior-alert-badge"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-[10px] font-semibold text-red-400">POZOR</span>
                    </span>
                  )}
                  {isArchitectMode && (
                    <button
                      onClick={() => cgnMutation.mutate(!isCgnActive)}
                      className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-colors",
                        isCgnActive
                          ? "bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25"
                          : "bg-muted/40 border-border/40 text-muted-foreground hover:bg-muted/60"
                      )}
                      title={isCgnActive ? "Deaktivovať režim CGN" : "Aktivovať režim CGN – Celkom Garantovať Nemožno"}
                      data-testid="btn-toggle-cgn"
                    >
                      {isCgnActive ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                      CGN
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1.5 flex-wrap" data-testid="tag-management-bar">
                {subjectTags.map(tag => (
                  <span key={tag} className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold", getTagStyle(tag).color, getTagStyle(tag).bg, getTagStyle(tag).border)}>
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                    <button onClick={() => removeTag(tag)} className="ml-0.5" title="Odstrániť tag" data-testid={`btn-remove-tag-${tag}`}>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
                <div className="relative">
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => setShowTagPicker(!showTagPicker)} data-testid="btn-add-tag">
                    <Plus className="w-3 h-3 mr-0.5" />
                    Tag
                  </Button>
                  {showTagPicker && (
                    <div className="absolute top-full left-0 z-50 mt-1 w-48 bg-card border rounded-md shadow-xl p-2 space-y-1" data-testid="tag-picker-dropdown">
                      {PRESET_TAGS.filter(t => !subjectTags.includes(t.label)).map(preset => (
                        <button
                          key={preset.label}
                          className={cn("w-full flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/50 text-left", preset.color)}
                          onClick={() => { addTag(preset.label); setShowTagPicker(false); }}
                          data-testid={`btn-preset-tag-${preset.label}`}
                        >
                          <Tag className="w-3 h-3" />
                          {preset.label}
                        </button>
                      ))}
                      <div className="border-t border-border/40 pt-1 mt-1">
                        <div className="flex items-center gap-1">
                          <Input
                            value={customTagInput}
                            onChange={e => setCustomTagInput(e.target.value)}
                            placeholder="Vlastný tag..."
                            className="h-6 text-[10px] flex-1"
                            onKeyDown={e => {
                              if (e.key === "Enter" && customTagInput.trim()) {
                                addTag(customTagInput.trim());
                                setCustomTagInput("");
                                setShowTagPicker(false);
                              }
                            }}
                            data-testid="input-custom-tag"
                          />
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => {
                            if (customTagInput.trim()) {
                              addTag(customTagInput.trim());
                              setCustomTagInput("");
                              setShowTagPicker(false);
                            }
                          }} data-testid="btn-add-custom-tag">
                            <Check className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                <span className="font-mono">{formatUid(subject.uid)}</span>
                <span className="text-border">|</span>
                <span>{CLIENT_TYPE_OPTIONS.find(o => o.value === activeClientType)?.label || "Fyzická osoba"}</span>
                <span className="text-border">|</span>
                <span className={cn("font-medium", subject.isActive ? "text-emerald-400" : "text-red-400")}>{subject.isActive ? "Aktívny" : "Neaktívny"}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-1">
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
        </CardContent>
      </Card>

      {subject.id > 0 && (
        <Card className="border border-border/50 bg-card/30" data-testid="subject-contacts-card">
          <div
            className="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg border-b border-border/30"
            onClick={() => toggleSection("section-multi-kontakt")}
            data-testid="section-toggle-contacts"
          >
            {expandedSections.includes("section-multi-kontakt") ? <ChevronDown className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
            <Phone className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide flex-1">Kontakty</span>
          </div>
          {expandedSections.includes("section-multi-kontakt") && (
            <CardContent className="px-4 pb-3 pt-2">
              <SubjectContactsPanel subjectId={subject.id} readonly={!isEditing} />
            </CardContent>
          )}
        </Card>
      )}

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

      {(() => {
        const HEADER_RENDERED_KEYS = new Set([
          "meno", "priezvisko", "zi_meno", "zi_priezvisko",
          "rodne_cislo", "zi_rodne_cislo",
          "zi_titul_pred", "zi_titul_za",
          "zi_datum_narodenia", "datum_narodenia",
          "zi_statna_prislusnost",
          "zi_sidlo", "zi_stat",
          "email", "telefon",
          "f_interny_kod_arutsok_i1j8",
        ]);

        const HEADER_PANEL_IDS = new Set([53]);

        const filterParams = (params: any[]) =>
          params.filter(p => !HEADER_RENDERED_KEYS.has(p.fieldKey));

        const filterPanels = (panelNodes: { panel: any; parameters: any[] }[]) =>
          panelNodes
            .filter(pn => !HEADER_PANEL_IDS.has(pn.panel.id))
            .map(pn => ({ ...pn, parameters: filterParams(pn.parameters) }))
            .filter(pn => pn.parameters.length > 0);

        const CATEGORY_META: Record<string, { icon: typeof ShieldCheck; color: string }> = {
          povinne: { icon: ShieldCheck, color: "text-destructive" },
          osobne: { icon: User, color: "text-cyan-400" },
          doplnkove: { icon: ListPlus, color: "text-primary" },
          volitelne: { icon: Eye, color: "text-muted-foreground" },
          ine: { icon: MoreHorizontal, color: "text-muted-foreground" },
        };

        const categoryOrder = ["povinne", "osobne", "doplnkove", "volitelne", "ine"];

        const totalParamCount = (nodes: HierarchyNode[]) =>
          nodes.reduce((sum, n) => sum + filterPanels(n.panels).reduce((s, p) => s + p.parameters.length, 0), 0);

        return (
          <>
            {categoryOrder.map(catKey => {
              const nodes = hierarchyByCategory[catKey] || [];
              if (nodes.length === 0 && catKey !== "povinne") return null;
              const meta = CATEGORY_META[catKey] || CATEGORY_META.ine;
              const CatIcon = meta.icon;
              const catLabel = FOLDER_CATEGORY_LABELS[catKey] || catKey.toUpperCase();
              const paramCount = totalParamCount(nodes);

              return (
                <Accordion type="multiple" key={catKey} defaultValue={[]} className="space-y-1 mb-3">
                  <AccordionItem value={catKey} className="border rounded-md px-3" data-testid={`editor-accordion-${catKey}`}>
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <div className="flex items-center gap-2">
                        <CatIcon className={cn("w-4 h-4", meta.color)} />
                        <span className="text-sm font-semibold">{catLabel}</span>
                        <Badge variant="secondary" className="text-[10px]">{paramCount}</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pb-4 space-y-3">
                      {nodes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Žiadne parametre v šablóne (B)</p>
                      ) : (
                        nodes.map(({ section, panels: panelNodes }) => {
                          const sectionKey = `section-${section.id}`;
                          const isSectionExpanded = expandedSections.includes(sectionKey);
                          const filteredPanelNodes = filterPanels(panelNodes);
                          const sectionParamCount = filteredPanelNodes.reduce((s, p) => s + p.parameters.length, 0);
                          if (sectionParamCount === 0) return null;

                          return (
                            <Card key={section.id} className="border border-border/50 bg-muted/10 shadow-sm" data-testid={`section-card-${section.id}`}>
                              <div
                                className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-muted/20 transition-colors rounded-t-lg border-b border-border/30"
                                onClick={() => toggleSection(sectionKey, filteredPanelNodes.map(pn => pn.panel.id))}
                                data-testid={`section-toggle-${section.id}`}
                              >
                                {isSectionExpanded ? <ChevronDown className="w-4 h-4 text-primary/60 shrink-0" /> : <ChevronRight className="w-4 h-4 text-primary/60 shrink-0" />}
                                <FolderOpen className="w-4 h-4 text-primary/70 shrink-0" />
                                {isArchitectMode && renamingSection === section.id ? (
                                  <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                                    <Input
                                      value={renameValue}
                                      onChange={e => setRenameValue(e.target.value)}
                                      className="h-6 text-xs flex-1"
                                      autoFocus
                                      onKeyDown={e => { if (e.key === "Enter") renameSectionMutation.mutate({ id: section.id, name: renameValue }); if (e.key === "Escape") setRenamingSection(null); }}
                                      data-testid={`rename-input-${section.id}`}
                                    />
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => renameSectionMutation.mutate({ id: section.id, name: renameValue })} data-testid={`rename-save-${section.id}`}>
                                      <Check className="w-3 h-3" />
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setRenamingSection(null)}>
                                      <X className="w-3 h-3" />
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-xs font-semibold uppercase tracking-wide flex-1">{section.name}</span>
                                )}
                                <Badge variant="outline" className="text-[9px] shrink-0">{sectionParamCount} polí</Badge>
                                {isArchitectMode && renamingSection !== section.id && (
                                  <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                    <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-amber-500" onClick={() => { setRenamingSection(section.id); setRenameValue(section.name); }} data-testid={`btn-rename-section-${section.id}`}>
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Select value={catKey} onValueChange={val => moveSectionCategoryMutation.mutate({ id: section.id, folderCategory: val })}>
                                      <SelectTrigger className="h-6 w-24 text-[10px] border-amber-500/30 text-amber-500" data-testid={`move-section-${section.id}`}>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {categoryOrder.map(ck => (
                                          <SelectItem key={ck} value={ck}>{FOLDER_CATEGORY_LABELS[ck]?.replace(" ÚDAJE", "")}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                              {isSectionExpanded && (
                                <CardContent className="px-4 pb-4 pt-3 space-y-3">
                                  {!isArchitectMode && filteredPanelNodes.length > 2 && (
                                    <div className="flex flex-wrap gap-1.5 pb-3 border-b border-border/20" data-testid="panel-nav-chips">
                                      {filteredPanelNodes.map(({ panel: pn }) => {
                                        const chipKey = `panel-${pn.id}`;
                                        const active = expandedPanels.has(chipKey);
                                        return (
                                          <button
                                            key={pn.id}
                                            type="button"
                                            onClick={() => scrollToPanel(pn.id)}
                                            className={cn(
                                              "text-[10px] px-2.5 py-0.5 rounded-full border transition-colors font-medium leading-5",
                                              active
                                                ? "border-primary/50 bg-primary/10 text-primary"
                                                : "border-border/40 bg-muted/20 text-muted-foreground hover:border-primary/30 hover:text-primary/70 hover:bg-primary/5"
                                            )}
                                            data-testid={`chip-panel-${pn.id}`}
                                          >
                                            {pn.name}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                  {isArchitectMode ? (
                                    <DndContext
                                      sensors={dndSensors}
                                      collisionDetection={closestCenter}
                                      onDragStart={handleGlobalDragStart}
                                      onDragEnd={handleGlobalDragEnd(filteredPanelNodes.map(pn => ({ panelId: pn.panel.id, parameters: pn.parameters })))}
                                    >
                                      {filteredPanelNodes.map(({ panel, parameters }) => {
                                        const allSortableIds = parameters.map(p => String(p.id));
                                        const heatmapClass = getPanelHeatmapClass(parameters, fieldFreshness);
                                        const heatmapLabel = getHeatmapLabel(parameters, fieldFreshness);
                                        return (
                                          <DroppablePanelZone key={panel.id} panelId={panel.id}>
                                            <div className={cn("space-y-2 rounded-lg border p-3 transition-colors", heatmapClass || "border-border/20 bg-card/40")} data-testid={`panel-group-${panel.id}`}>
                                              <div className="flex items-center gap-2 border-b border-border/40 pb-1">
                                                <GripVertical className="w-3 h-3 text-muted-foreground/50" />
                                                {renamingSection === panel.id ? (
                                                  <div className="flex items-center gap-1 flex-1" onClick={e => e.stopPropagation()}>
                                                    <Input
                                                      value={renameValue}
                                                      onChange={e => setRenameValue(e.target.value)}
                                                      className="h-5 text-[10px] flex-1"
                                                      autoFocus
                                                      onKeyDown={e => { if (e.key === "Enter") renameSectionMutation.mutate({ id: panel.id, name: renameValue }); if (e.key === "Escape") setRenamingSection(null); }}
                                                    />
                                                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => renameSectionMutation.mutate({ id: panel.id, name: renameValue })}>
                                                      <Check className="w-2.5 h-2.5" />
                                                    </Button>
                                                  </div>
                                                ) : (
                                                  <p className="text-[11px] font-medium text-muted-foreground tracking-wide flex-1">
                                                    {panel.name}
                                                    <span className="ml-2 text-[9px] text-muted-foreground/60">({parameters.length})</span>
                                                  </p>
                                                )}
                                                {heatmapLabel && (
                                                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-blue-400/40 text-blue-400 shrink-0" data-testid={`heatmap-badge-${panel.id}`}>
                                                    {heatmapLabel}
                                                  </Badge>
                                                )}
                                                {renamingSection !== panel.id && (
                                                  <Button size="sm" variant="ghost" className="h-5 px-1 text-amber-500" onClick={() => { setRenamingSection(panel.id); setRenameValue(panel.name); }}>
                                                    <Pencil className="w-2.5 h-2.5" />
                                                  </Button>
                                                )}
                                              </div>
                                              <SortableContext items={allSortableIds} strategy={rectSortingStrategy}>
                                                <div
                                                  className="grid gap-4 items-end"
                                                  style={{ gridTemplateColumns: `repeat(${panel.gridColumns || 3}, minmax(0, 1fr))` }}
                                                >
                                                  {parameters.map(param => {
                                                    const field = dbParamToStaticField(param);
                                                    if (field.visibilityRule && field.visibilityRule.dependsOn) {
                                                      const depVal = dynamicValues[field.visibilityRule.dependsOn];
                                                      if (!depVal || depVal !== field.visibilityRule.value) return null;
                                                    }
                                                    return (
                                                      <SortableFieldItem key={field.id} id={String(field.id)} isArchitectMode>
                                                        <div className="pl-4">
                                                          <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} disabled={!isEditing} subjectId={subject.id} />
                                                          <div className="flex items-center gap-1 mt-0.5">
                                                            <Button
                                                              size="sm"
                                                              variant="ghost"
                                                              className="h-4 px-1 text-[9px] text-amber-500 hover:text-amber-400"
                                                              onClick={() => setTransferParam({ paramId: param.id, paramLabel: stripAiPrefix(param.label), currentPanelId: panel.id })}
                                                              data-testid={`btn-transfer-${param.id}`}
                                                            >
                                                              <ArrowRightLeft className="w-2.5 h-2.5 mr-0.5" />
                                                              Presunúť
                                                            </Button>
                                                          </div>
                                                        </div>
                                                      </SortableFieldItem>
                                                    );
                                                  })}
                                                </div>
                                              </SortableContext>
                                              {parameters.length === 0 && (
                                                <div className="py-4 text-center text-xs text-muted-foreground border-2 border-dashed border-amber-500/20 rounded-md">
                                                  Presuňte sem parameter
                                                </div>
                                              )}
                                            </div>
                                          </DroppablePanelZone>
                                        );
                                      })}
                                      <DragOverlay>
                                        {activeDragId && (() => {
                                          const param = dbParameters?.find(p => String(p.id) === activeDragId);
                                          if (!param) return null;
                                          return (
                                            <div className="bg-card border-2 border-amber-500 rounded-md p-2 shadow-xl opacity-90 max-w-[200px]">
                                              <p className="text-xs font-medium truncate">{stripAiPrefix(param.label)}</p>
                                            </div>
                                          );
                                        })()}
                                      </DragOverlay>
                                    </DndContext>
                                  ) : (
                                    filteredPanelNodes.map(({ panel, parameters }) => {
                                      const panelKey = `panel-${panel.id}`;
                                      const isPanelOpen = !isEditing || expandedPanels.has(panelKey);

                                      if (!isEditing) {
                                        const hasVisibleParam = parameters.some(param => {
                                          const field = dbParamToStaticField(param);
                                          if (field.visibilityRule && field.visibilityRule.dependsOn) {
                                            const depVal = dynamicValues[field.visibilityRule.dependsOn];
                                            if (!depVal || depVal !== field.visibilityRule.value) return false;
                                          }
                                          const rawVal = dynamicValues[field.fieldKey];
                                          return rawVal !== undefined && rawVal !== null && rawVal !== "";
                                        });
                                        if (!hasVisibleParam) return null;
                                      }
                                      const heatmapClass = getPanelHeatmapClass(parameters, fieldFreshness);
                                      const heatmapLabel = getHeatmapLabel(parameters, fieldFreshness);
                                      const filledCount = isEditing ? parameters.filter(p => {
                                        const v = dynamicValues[p.fieldKey];
                                        return v !== undefined && v !== null && v !== "";
                                      }).length : 0;
                                      return (
                                        <div
                                          key={panel.id}
                                          ref={el => { panelRefs.current[panelKey] = el; }}
                                          className={cn("rounded-xl border overflow-hidden transition-colors", heatmapClass ? heatmapClass : "border-border/40 dark:border-border/30")}
                                          data-testid={`panel-group-${panel.id}`}
                                        >
                                          <div
                                            className={cn(
                                              "flex items-center gap-2.5 px-3 py-2.5 select-none transition-colors",
                                              isEditing ? "cursor-pointer" : "cursor-default",
                                              isPanelOpen
                                                ? "bg-muted/40 border-b border-border/30"
                                                : "bg-muted/15 hover:bg-muted/30"
                                            )}
                                            onClick={isEditing ? () => togglePanel(panelKey) : undefined}
                                            data-testid={`panel-header-${panel.id}`}
                                          >
                                            {isEditing && (
                                              isPanelOpen
                                                ? <ChevronDown className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                                                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                                            )}
                                            <span className="text-xs font-semibold text-foreground/85 tracking-wide flex-1">{panel.name}</span>
                                            {isEditing && filledCount > 0 && (
                                              <span className="text-[9px] text-emerald-400/80 font-mono shrink-0">{filledCount}/{parameters.length}</span>
                                            )}
                                            {isEditing && filledCount === 0 && (
                                              <span className="text-[9px] text-muted-foreground/40 font-mono shrink-0">{parameters.length} polí</span>
                                            )}
                                            {heatmapLabel && (
                                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-blue-400/40 text-blue-400 shrink-0" data-testid={`heatmap-badge-${panel.id}`}>
                                                {heatmapLabel}
                                              </Badge>
                                            )}
                                          </div>
                                          {isPanelOpen && (
                                            <div className="p-2">
                                              <div className="flex flex-wrap -mx-1.5">
                                                {parameters.map(param => {
                                                  const field = dbParamToStaticField(param);
                                                  if (field.visibilityRule && field.visibilityRule.dependsOn) {
                                                    const depVal = dynamicValues[field.visibilityRule.dependsOn];
                                                    if (!depVal || depVal !== field.visibilityRule.value) return null;
                                                  }
                                                  const rawFieldVal = dynamicValues[field.fieldKey];
                                                  const fieldVal = rawFieldVal ?? "";
                                                  if (!isEditing && (rawFieldVal === undefined || rawFieldVal === null || rawFieldVal === "")) return null;
                                                  const fkLower = field.fieldKey.toLowerCase();
                                                  const isExpiryField = field.fieldType === "date" && (fkLower.includes("platnost") || fkLower.includes("_do") || fkLower.includes("expir") || fkLower.includes("validit") || fkLower.endsWith("do"));
                                                  const pct = field.widthPercent > 0 ? field.widthPercent : 33.333;
                                                  return (
                                                    <div key={field.id} className="min-w-0 relative px-1.5 pb-3" style={{ flex: `0 0 ${pct}%`, width: `${pct}%` }}>
                                                      <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} disabled={!isEditing} subjectId={subject.id} />
                                                      {isExpiryField && fieldVal && !isEditing && (
                                                        <div className="mt-0.5">
                                                          <ExpiryBadge date={fieldVal} />
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                  )}
                                </CardContent>
                              )}
                            </Card>
                          );
                        })
                      )}

                      {catKey === "povinne" && subject.id > 0 && (
                        <Card className="border border-purple-500/30 bg-purple-500/5 shadow-sm" data-testid="section-lifecycle-status">
                          <div
                            className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-purple-500/10 transition-colors rounded-t-lg border-b border-purple-500/20"
                            onClick={() => toggleSection("section-lifecycle")}
                            data-testid="section-toggle-lifecycle"
                          >
                            {expandedSections.includes("section-lifecycle") ? <ChevronDown className="w-4 h-4 text-purple-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-purple-400 shrink-0" />}
                            <FolderOpen className="w-4 h-4 text-purple-400 shrink-0" />
                            <span className="text-xs font-semibold uppercase tracking-wide flex-1">Status životného cyklu</span>
                            <Badge variant="outline" className="text-[9px] shrink-0 border-purple-500/30 text-purple-400">{isInMemoriam ? "3 polí" : isTerminated ? "1 pole + dôkaz" : "1 pole"}</Badge>
                          </div>
                          {expandedSections.includes("section-lifecycle") && (
                            <CardContent className="px-4 pb-4 pt-3 space-y-4">
                              <div className="space-y-2 rounded-lg border border-purple-500/20 bg-card/40 p-3">
                                <div className="flex items-center gap-2 pb-1.5 mb-1 border-b border-purple-500/15">
                                  <p className="text-[11px] font-semibold text-purple-400/80 tracking-wider uppercase flex-1">Stav subjektu</p>
                                </div>
                                <div className="grid gap-4 items-end" style={{ gridTemplateColumns: isInMemoriam ? "repeat(3, minmax(0, 1fr))" : "1fr" }}>
                                  <div className="min-w-0">
                                    <Label className="text-[11px] text-muted-foreground mb-1 block">Stav subjektu</Label>
                                    <Select
                                      value={dynamicValues["lifecycle_status"] || "active"}
                                      onValueChange={val => setDynamicValues(prev => ({ ...prev, lifecycle_status: val }))}
                                      disabled={!isEditing}
                                    >
                                      <SelectTrigger
                                        className={cn(
                                          LIFECYCLE_STATUS_OPTIONS.find(o => o.value === dynamicValues["lifecycle_status"])?.border || "border-emerald-500/30",
                                          LIFECYCLE_STATUS_OPTIONS.find(o => o.value === dynamicValues["lifecycle_status"])?.color || "text-emerald-400"
                                        )}
                                        data-testid="select-lifecycle-status"
                                      >
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {LIFECYCLE_STATUS_OPTIONS.filter(opt => opt.forTypes.includes(subjectType)).map(opt => (
                                          <SelectItem key={opt.value} value={opt.value}>
                                            <span className={cn("font-medium", opt.color)}>{opt.label}</span>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {isInMemoriam && (
                                    <>
                                      <div className="min-w-0">
                                        <Label className="text-[11px] text-muted-foreground mb-1 block">Dátum úmrtia</Label>
                                        <div className="relative">
                                          <Input
                                            type="date"
                                            value={dynamicValues["death_date"] || ""}
                                            onChange={e => setDynamicValues(prev => ({ ...prev, death_date: e.target.value }))}
                                            disabled={!isEditing}
                                            className="pr-12"
                                            data-testid="input-death-date"
                                          />
                                          {subject.id > 0 && <FieldHistoryIndicator subjectId={subject.id} fieldKey="death_date" fieldLabel="Dátum úmrtia" inline />}
                                        </div>
                                      </div>
                                      <div className="min-w-0">
                                        <Label className="text-[11px] text-muted-foreground mb-1 block">Číslo úmrtného listu</Label>
                                        <div className="relative">
                                          <Input
                                            value={dynamicValues["death_certificate_number"] || ""}
                                            onChange={e => setDynamicValues(prev => ({ ...prev, death_certificate_number: e.target.value }))}
                                            disabled={!isEditing}
                                            placeholder="Nepovinné"
                                            className="pr-12"
                                            data-testid="input-death-certificate"
                                          />
                                          {subject.id > 0 && <FieldHistoryIndicator subjectId={subject.id} fieldKey="death_certificate_number" fieldLabel="Číslo úmrtného listu" inline />}
                                        </div>
                                      </div>
                                    </>
                                  )}
                                </div>
                                {isInMemoriam && (
                                  <div className="mt-3 space-y-2">
                                    <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/20" data-testid="lifecycle-legal-capacity-alert">
                                      <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                      <span className="text-[11px] text-red-400">Právna spôsobilosť: <strong>Nie</strong> (automaticky nastavené)</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20" data-testid="lifecycle-gdpr-notice">
                                      <Shield className="w-4 h-4 text-amber-500 shrink-0" />
                                      <span className="text-[11px] text-amber-400">Marketingové súhlasy: automaticky zrušené</span>
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20" data-testid="lifecycle-contracts-notice">
                                      <CreditCard className="w-4 h-4 text-emerald-500 shrink-0" />
                                      <span className="text-[11px] text-emerald-400">Zmluvy: vytváranie nových zmlúv povolené (PZP, dedičské konania)</span>
                                    </div>
                                  </div>
                                )}
                                {isTerminated && (
                                  <div className="mt-3 space-y-2" data-testid="lifecycle-termination-section">
                                    <div className="flex items-center gap-2 p-2 rounded-md bg-red-500/10 border border-red-500/20" data-testid="lifecycle-termination-alert">
                                      <div className="relative shrink-0" data-testid="evidence-icon-container">
                                        <Ban className="w-4 h-4 text-red-500" />
                                        {hasEvidence && <Camera className="w-2.5 h-2.5 text-amber-400 absolute -bottom-0.5 -right-0.5" data-testid="evidence-camera-icon" />}
                                      </div>
                                      <span className="text-[11px] text-red-400">
                                        {isZaniknuta ? "Subjekt zanikol" : "Subjekt je v likvidácii"} – zmluvy sú pozastavené
                                      </span>
                                    </div>
                                    {hasEvidence && (
                                      <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20" data-testid="lifecycle-evidence-notice">
                                        <Camera className="w-4 h-4 text-amber-400 shrink-0" />
                                        <span className="text-[11px] text-amber-400">
                                          Dôkazný materiál z {statusEvidenceList[0]?.registryType === "orsr" ? "ORSR" : "ŽRSR"} priložený ({statusEvidenceList.length} {statusEvidenceList.length === 1 ? "záznam" : "záznamy"})
                                        </span>
                                        <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0 border-amber-500/30 text-amber-400">
                                          ArutsoK
                                        </Badge>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 p-2 rounded-md bg-slate-500/10 border border-slate-500/20" data-testid="lifecycle-register-info">
                                      <Shield className="w-4 h-4 text-slate-400 shrink-0" />
                                      <span className="text-[11px] text-slate-400">
                                        Overené z: {subjectType === "company" || subjectType === "po" ? "Obchodný register SR (ORSR)" : "Živnostenský register SR (ŽRSR)"}
                                      </span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              );
            })}
          </>
        );
      })()}

      <Accordion type="multiple" defaultValue={[]} className="space-y-1">
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

                      const SOURCE_MAP: Record<string, { sources: string[]; label: string }> = {
                        identita: { sources: ["P"], label: "Profil" },
                        legislativa: { sources: ["P"], label: "Profil" },
                        rodina: { sources: ["P"], label: "Profil" },
                        financie: { sources: ["Z", "P"], label: "Zmluvy + Profil" },
                        profil: { sources: ["P"], label: "Profil" },
                        digitalna: { sources: ["P"], label: "Profil" },
                        servis: { sources: ["Z", "P"], label: "Zmluvy + Profil" },
                        relacie: { sources: ["Z", "P"], label: "Zmluvy + Profil" },
                      };
                      const sourceInfo = SOURCE_MAP[cat.key] || { sources: ["P"], label: "Profil" };

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
                                <div className="flex items-center gap-1">
                                  <p className="text-[10px] text-muted-foreground font-medium truncate">{cat.label}</p>
                                  <div className="flex gap-0.5 shrink-0">
                                    {sourceInfo.sources.map(s => (
                                      <sup
                                        key={s}
                                        className={cn(
                                          "text-[8px] font-bold px-0.5 rounded leading-none",
                                          s === "Z" ? "text-amber-400 bg-amber-500/15" : "text-blue-400 bg-blue-500/15"
                                        )}
                                        title={s === "Z" ? "Dáta zo Zmlúv" : "Dáta z Profilu"}
                                        data-testid={`source-badge-${cat.key}-${s}`}
                                      >
                                        ({s})
                                      </sup>
                                    ))}
                                  </div>
                                </div>
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

      {subject.id > 0 && (
        <Accordion type="multiple" defaultValue={[]} className="space-y-1">
          <AccordionItem value="relacie-panels" className="border rounded-md px-3 border-violet-500/20" data-testid="accordion-relacie-panels">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold">{"REL\u00c1CIE A PORTF\u00d3LIO"}</span>
                <Badge variant="outline" className="text-[10px] border-violet-400/40 text-violet-400">AI</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">

              <Card className="border border-pink-500/20 bg-pink-500/5" data-testid="panel-rodinny-klaster">
                <div
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-pink-500/10 transition-colors rounded-t-lg border-b border-pink-500/20"
                  onClick={() => toggleSection("section-family-cluster")}
                  data-testid="section-toggle-family-cluster"
                >
                  {expandedSections.includes("section-family-cluster") ? <ChevronDown className="w-4 h-4 text-pink-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-pink-400 shrink-0" />}
                  <Home className="w-4 h-4 text-pink-400 shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wide flex-1">Rodinný klaster</span>
                  <Badge variant="outline" className="text-[9px] shrink-0 border-pink-500/30 text-pink-400">
                    {familyCluster?.members.length || 0} osôb
                  </Badge>
                </div>
                {expandedSections.includes("section-family-cluster") && (
                  <CardContent className="px-4 pb-4 pt-3 space-y-3">
                    {(!familyCluster || familyCluster.members.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-4" data-testid="family-cluster-empty">Nebol nájdený žiadny rodinný klaster (zhodné priezvisko)</p>
                    ) : (
                      <>
                        <div className="space-y-2" data-testid="family-cluster-members">
                          {familyCluster.members.map(member => (
                            <div key={member.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-pink-500/15 bg-card/40 hover:bg-pink-500/5 transition-colors" data-testid={`family-member-${member.id}`}>
                              <Home className="w-4 h-4 text-pink-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate" data-testid={`family-member-name-${member.id}`}>
                                    {member.firstName} {member.lastName}
                                  </span>
                                  <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">{member.type}</Badge>
                                  {member.lifecycleStatus === "in_memoriam" && (
                                    <span className="text-xs text-purple-400" title="In Memoriam" data-testid={`family-member-in-memoriam-${member.id}`}>In Mem.</span>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5" data-testid={`family-member-stats-${member.id}`}>
                                  {member.contractCount} zmlúv &middot; {(member.annualPremium / 100).toLocaleString("sk-SK", { minimumFractionDigits: 2 })} EUR/rok
                                </p>
                              </div>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-pink-400 hover:text-pink-300 shrink-0" onClick={() => window.open(`/subjects/${member.id}`, "_blank")} data-testid={`btn-view-member-${member.id}`}>
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5" data-testid="family-wealth-total">
                          <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Celkový majetok rodiny</p>
                            <p className="text-sm font-bold text-emerald-400" data-testid="text-family-wealth">
                              {((familyCluster.totalFamilyWealth || 0) / 100).toLocaleString("sk-SK", { minimumFractionDigits: 2 })} EUR
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[9px] border-emerald-400/30 text-emerald-400 shrink-0">
                            {familyCluster.totalContracts} zmlúv
                          </Badge>
                        </div>
                      </>
                    )}
                  </CardContent>
                )}
              </Card>

              <Card className="border border-blue-500/20 bg-blue-500/5" data-testid="panel-portfolio">
                <div
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-blue-500/10 transition-colors rounded-t-lg border-b border-blue-500/20"
                  onClick={() => toggleSection("section-portfolio")}
                  data-testid="section-toggle-portfolio"
                >
                  {expandedSections.includes("section-portfolio") ? <ChevronDown className="w-4 h-4 text-blue-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />}
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wide flex-1">Osobné portfólio subjektu</span>
                  <Badge variant="outline" className="text-[9px] shrink-0 border-blue-500/30 text-blue-400">
                    {subjectPortfolio?.totalContracts || 0} zmlúv
                  </Badge>
                </div>
                {expandedSections.includes("section-portfolio") && (
                  <CardContent className="px-4 pb-4 pt-3 space-y-3">
                    {(!subjectPortfolio || subjectPortfolio.contracts.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-4" data-testid="portfolio-empty">Žiadne zmluvy prepojené na tento subjekt</p>
                    ) : (
                      <>
                        <div className="space-y-2" data-testid="portfolio-contracts">
                          {subjectPortfolio.contracts.map(c => (
                            <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-blue-500/15 bg-card/40 hover:bg-blue-500/5 transition-colors" data-testid={`portfolio-contract-${c.id}`}>
                              <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium truncate" data-testid={`contract-number-${c.id}`}>
                                    {c.contractNumber || formatUid(c.uid) || `${c.id}`}
                                  </span>
                                  {c.statusName && (
                                    <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0" style={{ borderColor: `${c.statusColor}40`, color: c.statusColor || undefined }}>
                                      {c.statusName}
                                    </Badge>
                                  )}
                                  {c.contractType && (
                                    <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">{c.contractType}</Badge>
                                  )}
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {c.partnerName && <span>{c.partnerName}</span>}
                                  {c.productName && <span> &middot; {c.productName}</span>}
                                  {c.sectorName && <span> &middot; {c.sectorName}</span>}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs font-semibold text-blue-400" data-testid={`contract-premium-${c.id}`}>
                                  {c.annualPremium ? `${(c.annualPremium / 100).toLocaleString("sk-SK", { minimumFractionDigits: 2 })} EUR` : "—"}
                                </p>
                                <p className="text-[9px] text-muted-foreground">/rok</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 p-2.5 rounded-lg border border-blue-500/20 bg-blue-500/10" data-testid="portfolio-total">
                          <CreditCard className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="flex-1">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Celkové ročné poistné</p>
                            <p className="text-sm font-bold text-blue-400" data-testid="text-portfolio-total">
                              {((subjectPortfolio.totalAnnualPremium || 0) / 100).toLocaleString("sk-SK", { minimumFractionDigits: 2 })} EUR
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                )}
              </Card>

              <Card className="border border-amber-500/20 bg-amber-500/5" data-testid="panel-suggested-relations">
                <div
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none hover:bg-amber-500/10 transition-colors rounded-t-lg border-b border-amber-500/20"
                  onClick={() => toggleSection("section-suggested-relations")}
                  data-testid="section-toggle-suggested-relations"
                >
                  {expandedSections.includes("section-suggested-relations") ? <ChevronDown className="w-4 h-4 text-amber-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-amber-400 shrink-0" />}
                  <Briefcase className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wide flex-1">Navrhované prepojenia (AI)</span>
                  <Badge variant="outline" className="text-[9px] shrink-0 border-amber-500/30 text-amber-400">
                    {suggestedRelationsData?.filter(s => s.suggestion.status === "pending").length || 0} nových
                  </Badge>
                </div>
                {expandedSections.includes("section-suggested-relations") && (
                  <CardContent className="px-4 pb-4 pt-3 space-y-3">
                    {(!suggestedRelationsData || suggestedRelationsData.length === 0) ? (
                      <p className="text-sm text-muted-foreground text-center py-4" data-testid="suggested-empty">Žiadne navrhované prepojenia. AI motor analyzuje zmluvy a automaticky deteguje tretie osoby.</p>
                    ) : (
                      <div className="space-y-2" data-testid="suggested-relations-list">
                        {suggestedRelationsData.map(({ suggestion, matchedSubject }) => (
                          <div key={suggestion.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-500/15 bg-card/40" data-testid={`suggested-relation-${suggestion.id}`}>
                            {suggestion.detectedRole?.toLowerCase().includes("manžel") || suggestion.detectedRole?.toLowerCase().includes("rodič") || suggestion.detectedRole?.toLowerCase().includes("dieťa")
                              ? <Home className="w-4 h-4 text-pink-400 shrink-0" />
                              : suggestion.detectedRole?.toLowerCase().includes("firma") || suggestion.detectedRole?.toLowerCase().includes("spoločn")
                                ? <Briefcase className="w-4 h-4 text-amber-400 shrink-0" />
                                : <Link2 className="w-4 h-4 text-violet-400 shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium truncate" data-testid={`suggested-name-${suggestion.id}`}>
                                  {suggestion.detectedName}
                                </span>
                                {suggestion.detectedRole && (
                                  <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">{suggestion.detectedRole}</Badge>
                                )}
                                {matchedSubject && (
                                  <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0 border-emerald-400/30 text-emerald-400">
                                    Nájdený v systéme
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <p className="text-[10px] text-muted-foreground" data-testid={`suggestion-confirm-count-${suggestion.id}`}>
                                  Potvrdenie: {suggestion.confirmCount}/5
                                </p>
                                <div className="flex gap-0.5" data-testid={`suggestion-progress-${suggestion.id}`}>
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className={cn("w-1.5 h-1.5 rounded-full", i < suggestion.confirmCount ? "bg-emerald-500" : "bg-muted-foreground/20")} />
                                  ))}
                                </div>
                                {suggestion.status === "auto_confirmed" && (
                                  <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0 border-emerald-500/40 text-emerald-400">Automaticky potvrdené</Badge>
                                )}
                              </div>
                            </div>
                            {suggestion.status === "pending" && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                                  onClick={() => confirmSuggestionMutation.mutate(suggestion.id)}
                                  disabled={confirmSuggestionMutation.isPending}
                                  data-testid={`btn-confirm-suggestion-${suggestion.id}`}
                                >
                                  <ThumbsUp className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  onClick={() => rejectSuggestionMutation.mutate(suggestion.id)}
                                  disabled={rejectSuggestionMutation.isPending}
                                  data-testid={`btn-reject-suggestion-${suggestion.id}`}
                                >
                                  <ThumbsDown className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            )}
                            {matchedSubject && (
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-violet-400 hover:text-violet-300 shrink-0" onClick={() => window.open(`/subjects/${matchedSubject.id}`, "_blank")} data-testid={`btn-view-suggested-${suggestion.id}`}>
                                <ExternalLink className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {transferParam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setTransferParam(null)} data-testid="transfer-dialog-overlay">
          <Card className="w-96 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="transfer-dialog">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Presunúť parameter</h3>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{transferParam.paramLabel}</span> — vyberte cieľový panel:
              </p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {allPanels
                  .filter(p => p.id !== transferParam.currentPanelId)
                  .map(panel => {
                    const parentSection = dbSections?.find(s => s.id === panel.parentSectionId);
                    return (
                      <Button
                        key={panel.id}
                        variant="ghost"
                        className="w-full justify-start text-xs h-8 hover:bg-amber-500/10"
                        onClick={() => transferParamMutation.mutate({ paramId: transferParam.paramId, targetPanelId: panel.id })}
                        disabled={transferParamMutation.isPending}
                        data-testid={`transfer-target-${panel.id}`}
                      >
                        <FolderOpen className="w-3 h-3 mr-2 text-primary/70 shrink-0" />
                        <span className="truncate">
                          {parentSection ? `${parentSection.name} → ` : ""}{panel.name}
                        </span>
                      </Button>
                    );
                  })}
              </div>
              {transferParamMutation.isPending && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Presúvam...
                </div>
              )}
              <div className="flex justify-start pt-1 border-t border-border">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setTransferParam(null)} data-testid="button-transfer-cancel">
                  Zrušiť
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <AlertDialog open={!!statutarConfirm} onOpenChange={open => { if (!open) setStatutarConfirm(null); }}>
        <AlertDialogContent className="border-red-500/30 bg-card max-w-lg" data-testid="dialog-statutar-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Zmena štatutárneho zástupcu
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Mením údaje osoby s podpisovým právom. Táto akcia bude archivovaná. Naozaj chcete pokračovať?
            </AlertDialogDescription>
          </AlertDialogHeader>
          {statutarConfirm && (
            <div className="space-y-2 my-2">
              {statutarConfirm.changes.map(ch => (
                <div key={ch.fieldKey} className="rounded-md border border-border bg-muted/30 p-2.5 text-xs space-y-1" data-testid={`statutar-change-${ch.fieldKey}`}>
                  <div className="font-semibold text-foreground capitalize">{ch.label}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-red-400 line-through font-mono">{ch.oldValue}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-emerald-400 font-semibold font-mono">{ch.newValue}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setStatutarConfirm(null)} data-testid="btn-statutar-cancel">
              Zrušiť
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setStatutarConfirm(null);
                saveMutation.mutate();
              }}
              data-testid="btn-statutar-confirm"
            >
              Potvrdiť zmenu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCgnAlert} onOpenChange={setShowCgnAlert}>
        <AlertDialogContent className="border-orange-500/30 bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-400">
              <TrendingDown className="w-5 h-5 text-red-500 animate-pulse" />
              Upozornenie: Režim zvýšenej kontroly (CGN)
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Subjekt je v režime zvýšenej kontroly (CGN – Celkom Garantovať Nemožno).
              Overte aktuálnosť údajov a platobnú disciplínu pred akoukoľvek akciou.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowCgnAlert(false)} data-testid="btn-cgn-alert-ok">
              Rozumiem
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
