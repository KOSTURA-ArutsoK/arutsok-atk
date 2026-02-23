import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Subject } from "@shared/schema";
import { type StaticField } from "@/lib/staticFieldDefs";
import { getCategoriesForClientType } from "@/lib/staticFieldDefs";
import { getDocumentValidityStatus, isValidityField, isNumberFieldWithExpiredPair } from "@/lib/document-validity";
import { FieldHistoryIndicator } from "@/components/field-history-indicator";
import { SubjectProfilePhoto } from "@/components/subject-profile-photo";
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
  ChevronDown, ChevronRight, GripVertical, FolderOpen, ArrowRightLeft,
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
        {subjectId && (
          <FieldHistoryIndicator subjectId={subjectId} fieldKey={field.fieldKey} fieldLabel={displayLabel} />
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

export function SubjectProfileModuleC({ subject }: ModuleCProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editReason, setEditReason] = useState("");
  const [transferParam, setTransferParam] = useState<{ paramId: number; paramLabel: string; currentPanelId: number } | null>(null);

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
        <div className="flex items-center gap-4">
          {subject.id > 0 && (
            <div className="shrink-0" data-testid="module-c-photo">
              <SubjectProfilePhoto subjectId={subject.id} size="lg" editable={isEditing} showHistory />
            </div>
          )}
          <div className="flex-1 flex justify-center">
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

      {(() => {
        const CATEGORY_META: Record<string, { icon: typeof ShieldCheck; color: string }> = {
          povinne: { icon: ShieldCheck, color: "text-destructive" },
          osobne: { icon: User, color: "text-cyan-400" },
          doplnkove: { icon: ListPlus, color: "text-primary" },
          volitelne: { icon: Eye, color: "text-muted-foreground" },
          ine: { icon: MoreHorizontal, color: "text-muted-foreground" },
        };

        const categoryOrder = ["povinne", "osobne", "doplnkove", "volitelne", "ine"];

        const toggleSection = (key: string) => {
          setExpandedSections(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
          );
        };

        const totalParamCount = (nodes: HierarchyNode[]) =>
          nodes.reduce((sum, n) => sum + n.panels.reduce((s, p) => s + p.parameters.length, 0), 0);

        return (
          <>
            {categoryOrder.map(catKey => {
              const nodes = hierarchyByCategory[catKey] || [];
              if (nodes.length === 0 && catKey !== "povinne") return null;
              const meta = CATEGORY_META[catKey] || CATEGORY_META.ine;
              const CatIcon = meta.icon;
              const catLabel = FOLDER_CATEGORY_LABELS[catKey] || catKey.toUpperCase();
              const paramCount = catKey === "povinne" ? 3 + totalParamCount(nodes) : totalParamCount(nodes);

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
                      {catKey === "povinne" && (
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
                      )}

                      {nodes.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Žiadne parametre v šablóne (B)</p>
                      ) : (
                        nodes.map(({ section, panels: panelNodes }) => {
                          const sectionKey = `section-${section.id}`;
                          const isSectionExpanded = expandedSections.includes(sectionKey);
                          const sectionParamCount = panelNodes.reduce((s, p) => s + p.parameters.length, 0);

                          return (
                            <Card key={section.id} className="border border-border/60 bg-card/50" data-testid={`section-card-${section.id}`}>
                              <div
                                className="flex items-center gap-2 px-3 py-2.5 cursor-pointer select-none hover:bg-muted/30 transition-colors"
                                onClick={() => toggleSection(sectionKey)}
                                data-testid={`section-toggle-${section.id}`}
                              >
                                {isSectionExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
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
                                <CardContent className="px-3 pb-3 pt-0 space-y-3">
                                  {isArchitectMode ? (
                                    <DndContext
                                      sensors={dndSensors}
                                      collisionDetection={closestCenter}
                                      onDragStart={handleGlobalDragStart}
                                      onDragEnd={handleGlobalDragEnd(panelNodes.map(pn => ({ panelId: pn.panel.id, parameters: pn.parameters })))}
                                    >
                                      {panelNodes.map(({ panel, parameters }) => {
                                        const allSortableIds = parameters.map(p => String(p.id));
                                        return (
                                          <DroppablePanelZone key={panel.id} panelId={panel.id}>
                                            <div className="space-y-2" data-testid={`panel-group-${panel.id}`}>
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
                                    panelNodes.map(({ panel, parameters }) => (
                                      <div key={panel.id} className="space-y-2" data-testid={`panel-group-${panel.id}`}>
                                        <div className="flex items-center gap-2 border-b border-border/40 pb-1">
                                          <GripVertical className="w-3 h-3 text-muted-foreground/50" />
                                          <p className="text-[11px] font-medium text-muted-foreground tracking-wide flex-1">
                                            {panel.name}
                                            <span className="ml-2 text-[9px] text-muted-foreground/60">({parameters.length})</span>
                                          </p>
                                        </div>
                                        <div
                                          className="grid gap-4 items-end"
                                          style={{ gridTemplateColumns: `repeat(${panel.gridColumns || 3}, minmax(0, 1fr))` }}
                                        >
                                          {parameters.map(param => {
                                            const field = dbParamToStaticField(param);
                                            return (
                                              <div key={field.id} className="min-w-0 relative">
                                                <DynamicFieldInput field={field} dynamicValues={dynamicValues} setDynamicValues={setDynamicValues} disabled={!isEditing} subjectId={subject.id} />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))
                                  )}
                                </CardContent>
                              )}
                            </Card>
                          );
                        })
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
                        identita: { sources: ["B"], label: "Profil (B)" },
                        legislativa: { sources: ["B"], label: "Profil (B)" },
                        rodina: { sources: ["B"], label: "Profil (B)" },
                        financie: { sources: ["A", "B"], label: "Zmluvy (A) + Profil (B)" },
                        profil: { sources: ["B"], label: "Profil (B)" },
                        digitalna: { sources: ["B"], label: "Profil (B)" },
                        servis: { sources: ["A", "B"], label: "Zmluvy (A) + Profil (B)" },
                        relacie: { sources: ["A", "B"], label: "Zmluvy (A) + Profil (B)" },
                      };
                      const sourceInfo = SOURCE_MAP[cat.key] || { sources: ["B"], label: "Profil (B)" };

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
                                          s === "A" ? "text-amber-400 bg-amber-500/15" : "text-blue-400 bg-blue-500/15"
                                        )}
                                        title={s === "A" ? "Dáta zo Zmlúv (Modul A)" : "Dáta z Profilu (Modul B)"}
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

      {transferParam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setTransferParam(null)} data-testid="transfer-dialog-overlay">
          <Card className="w-96 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()} data-testid="transfer-dialog">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Presunúť parameter</h3>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => setTransferParam(null)}>
                  <X className="w-4 h-4" />
                </Button>
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
