import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutGrid, Plus, X,
  Layers, FolderOpen, Pencil, Info, Loader2, Tag,
  Rows3, GripVertical, ArrowRightLeft,
  ChevronRight, ChevronsDownUp, ChevronsUpDown, Lock,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SubjectParamSection, SubjectParameter } from "@shared/schema";

// ============================================================
// Context panel selected-item type
// ============================================================
type SelectedCtxItem =
  | { type: "param";   item: SubjectParameter }
  | { type: "section"; item: SubjectParamSection };

// ============================================================
// Constants
// ============================================================
const SUBJECT_TYPES = [
  { code: "FO",   clientTypeId: 1, label: "FO",   full: "Fyzická osoba",                    color: "bg-emerald-600" },
  { code: "PO",   clientTypeId: 4, label: "PO",   full: "Právnická osoba",                  color: "bg-blue-600" },
  { code: "SZCO", clientTypeId: 3, label: "SZČO", full: "Samostatne zárobkovo činná osoba", color: "bg-violet-600" },
  { code: "VS",   clientTypeId: 6, label: "VS",   full: "Verejná správa",                   color: "bg-slate-600" },
  { code: "TS",   clientTypeId: 5, label: "TS",   full: "Tretí sektor",                     color: "bg-amber-600" },
  { code: "OS",   clientTypeId: 7, label: "OS",   full: "Ostatné subjekty",                 color: "bg-rose-600" },
];

const FOLDER_CATEGORIES = [
  { value: "povinne",   label: "Povinné",   color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700" },
  { value: "doplnkove", label: "Doplnkové", color: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700" },
  { value: "volitelne", label: "Voliteľné", color: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700" },
  { value: "ine",       label: "Iné",       color: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600" },
];

function getCategoryStyle(folderCategory: string) {
  return FOLDER_CATEGORIES.find(c => c.value === folderCategory)?.color ?? FOLDER_CATEGORIES[3].color;
}
function getCategoryLabel(folderCategory: string) {
  return FOLDER_CATEGORIES.find(c => c.value === folderCategory)?.label ?? folderCategory;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text", number: "Číslo", date: "Dátum", select: "Výber",
  boolean: "Áno/Nie", textarea: "Plocha", email: "Email", phone: "Tel.",
  file: "Súbor", iban: "IBAN", ico: "IČO", percent: "%",
};

function FieldTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal border-border text-muted-foreground">
      {FIELD_TYPE_LABELS[type] || type}
    </Badge>
  );
}

// ============================================================
// WidthPercentEditor — slider + quick buttons for widthPercent
// ============================================================
function WidthPercentEditor({
  label,
  currentPct,
  onCommit,
  isPending,
  testIdPrefix = "width",
}: {
  label: string;
  currentPct: number;
  onCommit: (value: number) => void;
  isPending: boolean;
  testIdPrefix?: string;
}) {
  const [draft, setDraft] = useState<number>(currentPct);
  const [inputStr, setInputStr] = useState<string>(String(currentPct));
  const lastCommitted = useRef<number>(currentPct);

  useEffect(() => {
    setDraft(currentPct);
    setInputStr(String(currentPct));
    lastCommitted.current = currentPct;
  }, [currentPct]);

  const WIDTH_OPTIONS = [25, 33, 50, 75, 100];

  function clamp(v: number) { return Math.min(100, Math.max(1, v)); }

  function commitIfChanged(value: number) {
    if (value === lastCommitted.current) return;
    lastCommitted.current = value;
    onCommit(value);
  }

  function handleQuickClick(opt: number) {
    setDraft(opt);
    setInputStr(String(opt));
    commitIfChanged(opt);
  }

  function handleSliderChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = clamp(Number(e.target.value));
    setDraft(v);
    setInputStr(String(v));
  }

  function handleSliderCommit() {
    commitIfChanged(draft);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInputStr(e.target.value);
    const v = parseInt(e.target.value, 10);
    if (!isNaN(v)) setDraft(clamp(v));
  }

  function handleInputCommit() {
    const v = parseInt(inputStr, 10);
    const safe = isNaN(v) ? currentPct : clamp(v);
    setDraft(safe);
    setInputStr(String(safe));
    commitIfChanged(safe);
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") { e.preventDefault(); handleInputCommit(); }
  }

  return (
    <div className="px-3 pb-3 flex-shrink-0" data-testid={`${testIdPrefix}-percent-editor`}>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{label}</p>
      {/* Quick buttons */}
      <div className="flex gap-1 flex-wrap mb-2">
        {WIDTH_OPTIONS.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => handleQuickClick(opt)}
            disabled={isPending}
            data-testid={`${testIdPrefix}-btn-${opt}`}
            className={`flex-1 min-w-[calc(33%-4px)] px-2 py-1 rounded text-[11px] font-medium border transition-all ${
              draft === opt
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-background border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {opt}%
          </button>
        ))}
      </div>
      {/* Slider + numeric input */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={1}
          max={100}
          step={1}
          value={draft}
          onChange={handleSliderChange}
          onMouseUp={handleSliderCommit}
          onTouchEnd={handleSliderCommit}
          disabled={isPending}
          data-testid={`${testIdPrefix}-slider`}
          className="flex-1 h-1.5 accent-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <input
          type="number"
          min={1}
          max={100}
          value={inputStr}
          onChange={handleInputChange}
          onBlur={handleInputCommit}
          onKeyDown={handleInputKeyDown}
          disabled={isPending}
          data-testid={`${testIdPrefix}-input`}
          className="w-12 px-1.5 py-0.5 text-[11px] border border-border rounded bg-background text-foreground text-center disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-primary"
        />
        <span className="text-[11px] text-muted-foreground">%</span>
      </div>
      {isPending && (
        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Ukladám...
        </div>
      )}
    </div>
  );
}

// ============================================================
// ParamLabelEditor — inline rename for parameter label
// ============================================================
function ParamLabelEditor({
  currentLabel,
  onCommit,
  isPending,
}: {
  currentLabel: string;
  onCommit: (label: string) => void;
  isPending: boolean;
}) {
  const [draft, setDraft] = useState(currentLabel);
  const lastCommitted = useRef(currentLabel);

  useEffect(() => {
    setDraft(currentLabel);
    lastCommitted.current = currentLabel;
  }, [currentLabel]);

  function handleCommit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === lastCommitted.current) return;
    lastCommitted.current = trimmed;
    onCommit(trimmed);
  }

  return (
    <div className="px-3 pb-2 flex-shrink-0">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Názov parametra</p>
      <input
        type="text"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCommit(); (e.target as HTMLInputElement).blur(); } }}
        disabled={isPending}
        data-testid="param-label-input"
        className="w-full px-2 py-1 text-[12px] border border-border rounded bg-background text-foreground disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-primary"
      />
      {isPending && (
        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
          <Loader2 className="h-2.5 w-2.5 animate-spin" />
          Ukladám...
        </div>
      )}
    </div>
  );
}

// ============================================================
// SortableItem — generic drag-and-drop wrapper
// ============================================================
type DragHandleProps = {
  listeners: ReturnType<typeof useSortable>["listeners"];
  attributes: ReturnType<typeof useSortable>["attributes"];
};

function SortableItem({ id, children, style }: {
  id: number;
  children: (handleProps: DragHandleProps) => React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
        position: "relative",
        zIndex: isDragging ? 1000 : undefined,
        ...style,
      }}
    >
      {children({ listeners, attributes })}
    </div>
  );
}

function DragHandle({ listeners, attributes, testId }: {
  listeners: DragHandleProps["listeners"];
  attributes: DragHandleProps["attributes"];
  testId?: string;
}) {
  return (
    <button
      type="button"
      className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded text-muted-foreground/30 hover:text-muted-foreground/70 cursor-grab active:cursor-grabbing transition-colors"
      {...listeners}
      {...attributes}
      data-testid={testId}
      onClick={e => e.stopPropagation()}
    >
      <GripVertical className="h-3.5 w-3.5" />
    </button>
  );
}

// ============================================================
// Main page
// ============================================================
export default function SektorySubjektovVizia() {
  const { toast } = useToast();

  useEffect(() => {
    document.title = "UI Subjektov (B-Vízia) | Štruktúra";
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Master switcher
  const [activeCode, setActiveCode] = useState("FO");
  const activeType = SUBJECT_TYPES.find(t => t.code === activeCode)!;
  const clientTypeId = activeType.clientTypeId;

  // Selection state
  const [selectedKategoriaId, setSelectedKategoriaId] = useState<number | null>(null);
  const [selectedBlokId, setSelectedBlokId]           = useState<number | null>(null);
  const [selectedPanelId, setSelectedPanelId]         = useState<number | null>(null);
  const [selectedRiadokId, setSelectedRiadokId]       = useState<number | null>(null);

  // Context panel state
  const [ctxItem, setCtxItem] = useState<SelectedCtxItem | null>(null);
  const ctxPanelRef = useRef<HTMLDivElement>(null);

  // Outside-click close for context panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ctxPanelRef.current && !ctxPanelRef.current.contains(e.target as Node)) {
        setCtxItem(null);
      }
    };
    if (ctxItem) {
      document.addEventListener("mousedown", handler);
    }
    return () => document.removeEventListener("mousedown", handler);
  }, [ctxItem]);

  // ============================================================
  // Collapse state
  // collapsedKategorie: IDs whose bloky are HIDDEN (default empty = all expanded)
  // expandedBloky/Panely/Riadky: IDs whose content is SHOWN (default empty = all collapsed)
  // ============================================================
  const [collapsedKategorie, setCollapsedKategorie] = useState<Set<number>>(new Set());
  const [expandedBloky,      setExpandedBloky]      = useState<Set<number>>(new Set());
  const [expandedPanely,     setExpandedPanely]     = useState<Set<number>>(new Set());
  const [expandedRiadky,     setExpandedRiadky]     = useState<Set<number>>(new Set());

  // Inherited FO section: collapsed by default
  const [foInheritedExpanded, setFoInheritedExpanded] = useState(false);

  const toggleKategoria = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedKategorie(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleBlok = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedBloky(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const togglePanel = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPanely(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleRiadok = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedRiadky(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  // Dialog state — add
  const [addKategoriaOpen, setAddKategoriaOpen] = useState(false);
  const [addBlokOpen, setAddBlokOpen]           = useState(false);
  const [addPanelOpen, setAddPanelOpen]         = useState(false);
  const [addRiadokOpen, setAddRiadokOpen]       = useState(false);
  const [editOpen, setEditOpen]                 = useState(false);
  const [editTarget, setEditTarget]             = useState<SubjectParamSection | null>(null);

  // Move blok dialog
  const [moveBlokOpen, setMoveBlokOpen]               = useState(false);
  const [moveBlokTarget, setMoveBlokTarget]           = useState<SubjectParamSection | null>(null);
  const [moveBlokTargetKatId, setMoveBlokTargetKatId] = useState<string>("");

  // Move param to another row dialog
  const [moveParamOpen, setMoveParamOpen]                 = useState(false);
  const [moveParamTarget, setMoveParamTarget]             = useState<SubjectParameter | null>(null);
  const [moveParamTargetRiadokId, setMoveParamTargetRiadokId] = useState<string>("");

  // Move panel to another blok dialog
  const [movePanelOpen, setMovePanelOpen]                 = useState(false);
  const [movePanelTarget, setMovePanelTarget]             = useState<SubjectParamSection | null>(null);
  const [movePanelTargetBlokId, setMovePanelTargetBlokId] = useState<string>("");

  // Move riadok to another panel dialog
  const [moveRiadokOpen, setMoveRiadokOpen]               = useState(false);
  const [moveRiadokTarget, setMoveRiadokTarget]           = useState<SubjectParamSection | null>(null);
  const [moveRiadokTargetPanelId, setMoveRiadokTargetPanelId] = useState<string>("");

  // Form inputs
  const [newKategoriaName, setNewKategoriaName]         = useState("");
  const [newKategoriaCategory, setNewKategoriaCategory] = useState("povinne");
  const [newBlokName, setNewBlokName]                   = useState("");
  const [newPanelName, setNewPanelName]                 = useState("");
  const [newRiadokName, setNewRiadokName]               = useState("");
  const [riadokHasName, setRiadokHasName]               = useState(true);
  const [editName, setEditName]                         = useState("");

  // ============================================================
  // Queries
  // ============================================================
  const sectionsQK = ["/api/subject-param-sections", clientTypeId];
  const { data: allSections = [], isLoading: sectionsLoading } = useQuery<SubjectParamSection[]>({
    queryKey: sectionsQK,
    queryFn: () =>
      apiRequest("GET", `/api/subject-param-sections?clientTypeId=${clientTypeId}`)
        .then(r => r.json()),
  });

  const paramsQK = ["/api/subject-parameters", clientTypeId];
  const { data: allParams = [] } = useQuery<SubjectParameter[]>({
    queryKey: paramsQK,
    queryFn: () =>
      apiRequest("GET", `/api/subject-parameters?clientTypeId=${clientTypeId}`)
        .then(r => r.json()),
  });

  // FO sections — loaded only for non-FO types, to display the inherited base
  const isFoActive = activeCode === "FO";
  const { data: foSections = [] } = useQuery<SubjectParamSection[]>({
    queryKey: ["/api/subject-param-sections", 1],
    queryFn: () =>
      apiRequest("GET", "/api/subject-param-sections?clientTypeId=1").then(r => r.json()),
    enabled: !isFoActive,
  });

  // ============================================================
  // Derived data — build tree
  // ============================================================
  const kategorie = useMemo(
    () => allSections.filter(s => s.sectionType === "kategoria").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [allSections]
  );

  // FO inherited tree helpers (read-only, non-FO types only)
  const foKategorie = useMemo(
    () => foSections.filter(s => s.sectionType === "kategoria").sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [foSections]
  );
  const getFoBloky = (katId: number) =>
    foSections.filter(s => s.sectionType === "blok" && s.parentSectionId === katId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const getFoPanely = (blokId: number) =>
    foSections.filter(s => s.sectionType === "panel" && s.parentSectionId === blokId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const getBloky = (katId: number) =>
    allSections.filter(s => s.sectionType === "blok" && s.parentSectionId === katId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const getPanely = (blokId: number) =>
    allSections.filter(s => s.sectionType === "panel" && s.parentSectionId === blokId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const getRiadky = (panelId: number) =>
    allSections.filter(s => s.sectionType === "riadok" && s.parentSectionId === panelId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const getParamsForRiadok = (riadokId: number) =>
    allParams.filter(p => p.rowId === riadokId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const getParamsForPanel = (panelId: number) =>
    allParams.filter(p => p.panelId === panelId && !p.rowId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Counts for toolbar
  const totalBloky  = useMemo(() => allSections.filter(s => s.sectionType === "blok").length, [allSections]);
  const totalPanely = useMemo(() => allSections.filter(s => s.sectionType === "panel").length, [allSections]);
  const totalRiadky = useMemo(() => allSections.filter(s => s.sectionType === "riadok").length, [allSections]);
  const totalParams = useMemo(() => allParams.length, [allParams]);

  const selectedKategoria = kategorie.find(k => k.id === selectedKategoriaId) ?? null;
  const selectedBlok      = selectedKategoria ? getBloky(selectedKategoria.id).find(b => b.id === selectedBlokId) ?? null : null;
  const selectedPanel     = selectedBlok ? getPanely(selectedBlok.id).find(p => p.id === selectedPanelId) ?? null : null;

  // Collapse / expand all
  const collapseAll = () => {
    setCollapsedKategorie(new Set(kategorie.map(k => k.id)));
    setExpandedBloky(new Set());
    setExpandedPanely(new Set());
    setExpandedRiadky(new Set());
  };
  const expandAll = () => {
    setCollapsedKategorie(new Set());
    setExpandedBloky(new Set(allSections.filter(s => s.sectionType === "blok").map(s => s.id)));
    setExpandedPanely(new Set(allSections.filter(s => s.sectionType === "panel").map(s => s.id)));
    setExpandedRiadky(new Set(allSections.filter(s => s.sectionType === "riadok").map(s => s.id)));
  };

  // ============================================================
  // Mutations
  // ============================================================
  const invalidateSections = () => queryClient.invalidateQueries({ queryKey: sectionsQK });
  const invalidateParams   = () => queryClient.invalidateQueries({ queryKey: paramsQK });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await apiRequest("POST", "/api/subject-param-sections", body);
      return r.json();
    },
    onSuccess: () => invalidateSections(),
    onError: (err: any) => toast({ title: "Chyba", description: err?.message || "Nepodarilo sa vytvoriť.", variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const r = await apiRequest("PATCH", `/api/subject-param-sections/${id}`, { name });
      return r.json();
    },
    onSuccess: () => { invalidateSections(); setEditOpen(false); },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message || "Nepodarilo sa premenovať.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("DELETE", `/api/subject-param-sections/${id}`);
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.message || "Nepodarilo sa vymazať.");
      }
      return r.json().catch(() => ({}));
    },
    onSuccess: (_, id) => {
      if (selectedKategoriaId === id) { setSelectedKategoriaId(null); setSelectedBlokId(null); setSelectedPanelId(null); setSelectedRiadokId(null); }
      if (selectedBlokId === id) { setSelectedBlokId(null); setSelectedPanelId(null); setSelectedRiadokId(null); }
      if (selectedPanelId === id) { setSelectedPanelId(null); setSelectedRiadokId(null); }
      if (selectedRiadokId === id) setSelectedRiadokId(null);
      invalidateSections();
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message || "Nepodarilo sa vymazať.", variant: "destructive" }),
  });

  const reorderSectionsMutation = useMutation({
    mutationFn: async (items: { id: number; sortOrder: number }[]) => {
      const r = await apiRequest("PATCH", "/api/subject-param-sections/reorder", { items });
      return r.json();
    },
    onError: () => { invalidateSections(); toast({ title: "Chyba pri ukladaní poradia", variant: "destructive" }); },
  });

  const moveBlokMutation = useMutation({
    mutationFn: async ({ id, targetKategoriaId }: { id: number; targetKategoriaId: number }) => {
      const r = await apiRequest("PATCH", `/api/subject-param-sections/${id}/move`, { targetKategoriaId });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Chyba"); }
      return r.json();
    },
    onSuccess: () => {
      invalidateSections();
      setMoveBlokOpen(false);
      setMoveBlokTarget(null);
      setMoveBlokTargetKatId("");
      toast({ title: "Blok presunutý" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message, variant: "destructive" }),
  });

  const reorderParamsMutation = useMutation({
    mutationFn: async (items: { id: number; sortOrder: number }[]) => {
      const r = await apiRequest("PATCH", "/api/subject-parameters/reorder", { items });
      return r.json();
    },
    onError: () => { invalidateParams(); toast({ title: "Chyba pri ukladaní poradia", variant: "destructive" }); },
  });

  const moveParamMutation = useMutation({
    mutationFn: async ({ id, rowId, sortOrder }: { id: number; rowId: number | null; sortOrder: number }) => {
      const r = await apiRequest("PATCH", `/api/subject-parameters/${id}`, { rowId, sortOrder });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Chyba"); }
      return r.json();
    },
    onSuccess: () => {
      invalidateParams();
      setMoveParamOpen(false);
      setMoveParamTarget(null);
      setMoveParamTargetRiadokId("");
      toast({ title: "Parameter presunutý" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message, variant: "destructive" }),
  });

  const updateParamWidthMutation = useMutation({
    mutationFn: async ({ id, widthPercent }: { id: number; widthPercent: number }) => {
      const r = await apiRequest("PATCH", `/api/subject-parameters/${id}`, { widthPercent });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Chyba"); }
      return r.json() as Promise<SubjectParameter>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(paramsQK, (old: SubjectParameter[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === updated.id ? updated : p);
      });
      setCtxItem(prev => prev && prev.type === "param" && prev.item.id === updated.id
        ? { type: "param", item: updated }
        : prev
      );
      queryClient.invalidateQueries({ queryKey: paramsQK });
      toast({ title: "Šírka uložená" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message, variant: "destructive" }),
  });

  const updateParamLabelMutation = useMutation({
    mutationFn: async ({ id, label }: { id: number; label: string }) => {
      const r = await apiRequest("PATCH", `/api/subject-parameters/${id}`, { label });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Chyba"); }
      return r.json() as Promise<SubjectParameter>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(paramsQK, (old: SubjectParameter[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === updated.id ? updated : p);
      });
      setCtxItem(prev => prev && prev.type === "param" && prev.item.id === updated.id
        ? { type: "param", item: updated }
        : prev
      );
      queryClient.invalidateQueries({ queryKey: paramsQK });
      toast({ title: "Názov uložený" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message, variant: "destructive" }),
  });

  const updateParamRequiredMutation = useMutation({
    mutationFn: async ({ id, isRequired }: { id: number; isRequired: boolean }) => {
      const r = await apiRequest("PATCH", `/api/subject-parameters/${id}`, { isRequired });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Chyba"); }
      return r.json() as Promise<SubjectParameter>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(paramsQK, (old: SubjectParameter[] | undefined) => {
        if (!old) return old;
        return old.map(p => p.id === updated.id ? updated : p);
      });
      setCtxItem(prev => prev && prev.type === "param" && prev.item.id === updated.id
        ? { type: "param", item: updated }
        : prev
      );
      queryClient.invalidateQueries({ queryKey: paramsQK });
      toast({ title: updated.isRequired ? "Označené ako povinné" : "Označené ako nepovinné" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message, variant: "destructive" }),
  });

  const updateSectionWidthMutation = useMutation({
    mutationFn: async ({ id, widthPercent }: { id: number; widthPercent: number }) => {
      const r = await apiRequest("PATCH", `/api/subject-param-sections/${id}`, { widthPercent });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Chyba"); }
      return r.json() as Promise<SubjectParamSection>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(sectionsQK, (old: SubjectParamSection[] | undefined) => {
        if (!old) return old;
        return old.map(s => s.id === updated.id ? updated : s);
      });
      setCtxItem(prev => prev && prev.type === "section" && prev.item.id === updated.id
        ? { type: "section", item: updated }
        : prev
      );
      queryClient.invalidateQueries({ queryKey: sectionsQK });
      toast({ title: "Šírka uložená" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message, variant: "destructive" }),
  });

  const movePanelMutation = useMutation({
    mutationFn: async ({ id, parentSectionId }: { id: number; parentSectionId: number }) => {
      const r = await apiRequest("PATCH", `/api/subject-param-sections/${id}`, { parentSectionId });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Chyba"); }
      return r.json() as Promise<SubjectParamSection>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(sectionsQK, (old: SubjectParamSection[] | undefined) => {
        if (!old) return old;
        return old.map(s => s.id === updated.id ? updated : s);
      });
      setMovePanelOpen(false); setMovePanelTarget(null); setMovePanelTargetBlokId("");
      setCtxItem(null);
      toast({ title: "Panel presunutý" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message, variant: "destructive" }),
  });

  const moveRiadokMutation = useMutation({
    mutationFn: async ({ id, parentSectionId }: { id: number; parentSectionId: number }) => {
      const r = await apiRequest("PATCH", `/api/subject-param-sections/${id}`, { parentSectionId });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.message || "Chyba"); }
      return r.json() as Promise<SubjectParamSection>;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(sectionsQK, (old: SubjectParamSection[] | undefined) => {
        if (!old) return old;
        return old.map(s => s.id === updated.id ? updated : s);
      });
      setMoveRiadokOpen(false); setMoveRiadokTarget(null); setMoveRiadokTargetPanelId("");
      setCtxItem(null);
      toast({ title: "Riadok presunutý" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message, variant: "destructive" }),
  });

  // ============================================================
  // Reorder helpers — optimistic update then API call
  // ============================================================
  function doReorderSections(reordered: SubjectParamSection[]) {
    const withNewOrder = reordered.map((s, i) => ({ ...s, sortOrder: i * 10 }));
    queryClient.setQueryData(sectionsQK, (old: SubjectParamSection[] | undefined) => {
      if (!old) return old;
      const byId = new Map(withNewOrder.map(s => [s.id, s]));
      return old.map(s => byId.get(s.id) ?? s);
    });
    reorderSectionsMutation.mutate(withNewOrder.map(s => ({ id: s.id, sortOrder: s.sortOrder ?? 0 })));
  }

  function doReorderParams(reordered: SubjectParameter[]) {
    const withNewOrder = reordered.map((p, i) => ({ ...p, sortOrder: i * 10 }));
    queryClient.setQueryData(paramsQK, (old: SubjectParameter[] | undefined) => {
      if (!old) return old;
      const byId = new Map(withNewOrder.map(p => [p.id, p]));
      return old.map(p => byId.get(p.id) ?? p);
    });
    reorderParamsMutation.mutate(withNewOrder.map(p => ({ id: p.id, sortOrder: p.sortOrder ?? 0 })));
  }

  function handleDragEndSections(event: DragEndEvent, items: SubjectParamSection[]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex(i => i.id === Number(active.id));
    const newIdx = items.findIndex(i => i.id === Number(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    doReorderSections(arrayMove(items, oldIdx, newIdx));
  }

  function handleDragEndParams(event: DragEndEvent, items: SubjectParameter[]) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = items.findIndex(i => i.id === Number(active.id));
    const newIdx = items.findIndex(i => i.id === Number(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    doReorderParams(arrayMove(items, oldIdx, newIdx));
  }

  // ============================================================
  // Handlers
  // ============================================================
  const handleAddKategoria = () => {
    if (!newKategoriaName.trim()) return;
    const nextSortOrder = kategorie.length * 10;
    createMutation.mutate(
      { name: newKategoriaName.trim(), clientTypeId, sectionType: "kategoria", folderCategory: newKategoriaCategory, sortOrder: nextSortOrder },
      { onSuccess: () => { toast({ title: "Kategória pridaná" }); setNewKategoriaName(""); setNewKategoriaCategory("povinne"); setAddKategoriaOpen(false); } }
    );
  };

  const handleAddBlok = () => {
    if (!newBlokName.trim() || !selectedKategoriaId || !selectedKategoria) return;
    const nextSortOrder = getBloky(selectedKategoriaId).length * 10;
    createMutation.mutate(
      { name: newBlokName.trim(), clientTypeId, sectionType: "blok", parentSectionId: selectedKategoriaId, folderCategory: selectedKategoria.folderCategory, sortOrder: nextSortOrder },
      { onSuccess: () => { toast({ title: "Blok pridaný" }); setNewBlokName(""); setAddBlokOpen(false); } }
    );
  };

  const handleAddPanel = () => {
    if (!newPanelName.trim() || !selectedBlokId || !selectedKategoria) return;
    const nextSortOrder = getPanely(selectedBlokId).length * 10;
    createMutation.mutate(
      { name: newPanelName.trim(), clientTypeId, sectionType: "panel", parentSectionId: selectedBlokId, folderCategory: selectedKategoria.folderCategory, sortOrder: nextSortOrder },
      { onSuccess: () => { toast({ title: "Panel pridaný" }); setNewPanelName(""); setAddPanelOpen(false); } }
    );
  };

  const handleAddRiadok = () => {
    if (!selectedPanelId || !selectedKategoria) return;
    if (riadokHasName && !newRiadokName.trim()) return;
    const name = riadokHasName ? newRiadokName.trim() : "";
    const nextSortOrder = getRiadky(selectedPanelId).length * 10;
    createMutation.mutate(
      { name, clientTypeId, sectionType: "riadok", parentSectionId: selectedPanelId, folderCategory: selectedKategoria.folderCategory, sortOrder: nextSortOrder },
      { onSuccess: () => { toast({ title: "Riadok pridaný" }); setNewRiadokName(""); setRiadokHasName(true); setAddRiadokOpen(false); } }
    );
  };

  const handleEdit = () => {
    if (!editTarget) return;
    const isRiadok = editTarget.sectionType === "riadok";
    if (!isRiadok && !editName.trim()) return;
    renameMutation.mutate(
      { id: editTarget.id, name: isRiadok ? editName : editName.trim() },
      { onSuccess: () => { toast({ title: "Uložené" }); setEditName(""); setEditTarget(null); } }
    );
  };

  const handleDelete = (section: SubjectParamSection) => {
    const typeLabels: Record<string, string> = { kategoria: "Kategóriu", blok: "Blok", panel: "Panel", riadok: "Riadok" };
    const label = typeLabels[section.sectionType ?? "blok"] ?? "Sekciu";
    if (!window.confirm(`Naozaj vymazať ${label} "${section.name}"?`)) return;
    deleteMutation.mutate(section.id, {
      onSuccess: () => toast({ title: `${label} vymazaný/á` }),
    });
  };

  const openEdit = (section: SubjectParamSection) => {
    setEditTarget(section);
    setEditName(section.name);
    setEditOpen(true);
  };

  const openMoveBlok = (blok: SubjectParamSection, e: React.MouseEvent) => {
    e.stopPropagation();
    setMoveBlokTarget(blok);
    setMoveBlokTargetKatId(String(blok.parentSectionId ?? ""));
    setMoveBlokOpen(true);
  };

  // Get all riadky in the same panel as a parameter (for the move-param dialog)
  const getRiadkyForParam = (param: SubjectParameter): SubjectParamSection[] => {
    let panelId: number | null = null;
    if (param.rowId) {
      const riadok = allSections.find(s => s.id === param.rowId);
      panelId = riadok?.parentSectionId ?? null;
    } else {
      panelId = param.panelId ?? null;
    }
    if (!panelId) return [];
    return getRiadky(panelId);
  };

  const openMoveParam = (param: SubjectParameter, e: React.MouseEvent) => {
    e.stopPropagation();
    setMoveParamTarget(param);
    // Default: current riadok or "none"
    setMoveParamTargetRiadokId(param.rowId ? String(param.rowId) : "none");
    setMoveParamOpen(true);
  };

  const handleMoveParam = () => {
    if (!moveParamTarget || !moveParamTargetRiadokId) return;
    const targetRowId = moveParamTargetRiadokId === "none" ? null : Number(moveParamTargetRiadokId);
    // Compute new sortOrder: append at end of target list
    let newSortOrder: number;
    if (targetRowId === null) {
      // Going to panel-level (no row) — find existing panel-level params in same panel
      const panelId = moveParamTarget.panelId ?? null;
      const existing = panelId ? getParamsForPanel(panelId) : [];
      newSortOrder = (existing.length + 1) * 10;
    } else {
      const existing = getParamsForRiadok(targetRowId);
      newSortOrder = (existing.length + 1) * 10;
    }
    moveParamMutation.mutate({ id: moveParamTarget.id, rowId: targetRowId, sortOrder: newSortOrder });
  };

  const handleMoveBlok = () => {
    if (!moveBlokTarget || !moveBlokTargetKatId) return;
    moveBlokMutation.mutate({ id: moveBlokTarget.id, targetKategoriaId: Number(moveBlokTargetKatId) });
  };

  const switchType = (code: string) => {
    setActiveCode(code);
    setSelectedKategoriaId(null); setSelectedBlokId(null);
    setSelectedPanelId(null); setSelectedRiadokId(null);
    setCtxItem(null);
    // Reset collapse state on type switch
    setCollapsedKategorie(new Set());
    setExpandedBloky(new Set());
    setExpandedPanely(new Set());
    setExpandedRiadky(new Set());
  };

  // ============================================================
  // buildPath — breadcrumb for the context panel
  // ============================================================
  type BreadcrumbStep = { icon: React.ReactNode; label: string };

  function buildPath(ctx: SelectedCtxItem): BreadcrumbStep[] {
    const steps: BreadcrumbStep[] = [];
    if (ctx.type === "param") {
      const param = ctx.item;
      // Find riadok (optional)
      const riadok = param.rowId ? allSections.find(s => s.id === param.rowId) : null;
      const panelId = riadok ? riadok.parentSectionId : param.panelId;
      const panel   = panelId ? allSections.find(s => s.id === panelId) : null;
      const blok    = panel?.parentSectionId ? allSections.find(s => s.id === panel.parentSectionId) : null;
      const kat     = blok?.parentSectionId ? allSections.find(s => s.id === blok.parentSectionId) : null;
      if (kat)    steps.push({ icon: <Tag className="h-3 w-3" />,        label: kat.name });
      if (blok)   steps.push({ icon: <FolderOpen className="h-3 w-3" />, label: blok.name });
      if (panel)  steps.push({ icon: <LayoutGrid className="h-3 w-3" />, label: panel.name });
      if (riadok) steps.push({ icon: <Rows3 className="h-3 w-3" />,      label: riadok.name || "bez názvu" });
      steps.push({ icon: <Tag className="h-3 w-3 text-primary" />,       label: param.label });
    } else {
      const sec = ctx.item;
      if (sec.sectionType === "kategoria") {
        steps.push({ icon: <Tag className="h-3 w-3" />, label: sec.name });
      } else if (sec.sectionType === "blok") {
        const kat = allSections.find(s => s.id === sec.parentSectionId);
        if (kat) steps.push({ icon: <Tag className="h-3 w-3" />, label: kat.name });
        steps.push({ icon: <FolderOpen className="h-3 w-3" />, label: sec.name });
      } else if (sec.sectionType === "panel") {
        const blok = allSections.find(s => s.id === sec.parentSectionId);
        const kat  = blok?.parentSectionId ? allSections.find(s => s.id === blok.parentSectionId) : null;
        if (kat)  steps.push({ icon: <Tag className="h-3 w-3" />,        label: kat.name });
        if (blok) steps.push({ icon: <FolderOpen className="h-3 w-3" />, label: blok.name });
        steps.push({ icon: <LayoutGrid className="h-3 w-3" />, label: sec.name });
      } else if (sec.sectionType === "riadok") {
        const panel = allSections.find(s => s.id === sec.parentSectionId);
        const blok  = panel?.parentSectionId ? allSections.find(s => s.id === panel.parentSectionId) : null;
        const kat   = blok?.parentSectionId ? allSections.find(s => s.id === blok.parentSectionId) : null;
        if (kat)   steps.push({ icon: <Tag className="h-3 w-3" />,        label: kat.name });
        if (blok)  steps.push({ icon: <FolderOpen className="h-3 w-3" />, label: blok.name });
        if (panel) steps.push({ icon: <LayoutGrid className="h-3 w-3" />, label: panel.name });
        steps.push({ icon: <Rows3 className="h-3 w-3" />, label: sec.name || "bez názvu" });
      }
    }
    return steps;
  }

  // ============================================================
  // Render helpers
  // ============================================================
  function EditDeleteButtons({ section }: { section: SubjectParamSection }) {
    return (
      <>
        <button
          onClick={e => { e.stopPropagation(); openEdit(section); }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors"
          data-testid={`button-edit-${section.sectionType}-${section.id}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); handleDelete(section); }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
          data-testid={`button-delete-${section.sectionType}-${section.id}`}
        >
          <X className="h-3 w-3" />
        </button>
      </>
    );
  }

  // Chevron button for collapse toggle
  function CollapseToggle({ expanded, onToggle, testId }: {
    expanded: boolean;
    onToggle: (e: React.MouseEvent) => void;
    testId?: string;
  }) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors"
        data-testid={testId}
      >
        <ChevronRight className={`h-3.5 w-3.5 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} />
      </button>
    );
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-background" data-testid="page-b-vizia">

        {/* === MASTER SWITCHER === */}
        <div className="flex items-center gap-1 px-6 py-3 border-b bg-card flex-shrink-0 flex-wrap">
          <Layers className="h-4 w-4 text-muted-foreground mr-2" />
          <span className="text-sm font-medium text-muted-foreground mr-3">B-Vízia</span>
          {SUBJECT_TYPES.map(st => (
            <button
              key={st.code}
              onClick={() => switchType(st.code)}
              data-testid={`switcher-${st.code}`}
              title={st.full}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-all border ${
                activeCode === st.code
                  ? `${st.color} text-white border-transparent`
                  : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              }`}
            >
              {st.label}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">{activeType.full}</span>
        </div>

        {/* === MAIN AREA === */}
        <div className="flex flex-1 overflow-hidden">

          {/* === CANVAS === */}
          <div className="flex-1 overflow-auto p-6">
            {sectionsLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Načítavam sekcie...
              </div>
            ) : (
              <div className="space-y-6">
                {/* ── INHERITED FO SECTION (non-FO types only) ── */}
                {!isFoActive && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden" data-testid="fo-inherited-section">
                    <button
                      type="button"
                      className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors text-left"
                      onClick={() => setFoInheritedExpanded(v => !v)}
                      data-testid="toggle-fo-inherited"
                    >
                      <Lock className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex-1">
                        Zdedené z FO
                      </span>
                      <span className="text-xs text-slate-400">{foKategorie.length} kategórií</span>
                      <ChevronRight className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${foInheritedExpanded ? "rotate-90" : ""}`} />
                    </button>
                    {foInheritedExpanded && (
                      <div className="p-4 space-y-3 bg-slate-50/50 dark:bg-slate-800/20">
                        {foKategorie.length === 0 ? (
                          <div className="text-xs text-muted-foreground text-center py-4 italic">
                            FO základ zatiaľ neobsahuje žiadne kategórie.
                          </div>
                        ) : (
                          foKategorie.map(kat => {
                            const foBloky = getFoBloky(kat.id);
                            const catStyle = getCategoryStyle(kat.folderCategory);
                            const catLabel = getCategoryLabel(kat.folderCategory);
                            return (
                              <div key={kat.id} className="rounded-lg border border-slate-200/70 dark:border-slate-700/50 bg-white dark:bg-slate-900/30" data-testid={`fo-inherited-kategoria-${kat.id}`}>
                                <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-100/60 dark:bg-slate-800/30 rounded-t-lg">
                                  <Lock className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                  <Tag className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex-1">{kat.name}</span>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border flex-shrink-0 opacity-70 ${catStyle}`}>{catLabel}</Badge>
                                  <span className="text-xs text-slate-400">{foBloky.length} blokov</span>
                                </div>
                                {foBloky.length > 0 && (
                                  <div className="p-3 space-y-2">
                                    {foBloky.map(blok => {
                                      const foPanely = getFoPanely(blok.id);
                                      return (
                                        <div key={blok.id} className="rounded border border-slate-200/50 dark:border-slate-700/40 bg-slate-50/50 dark:bg-slate-800/20" data-testid={`fo-inherited-blok-${blok.id}`}>
                                          <div className="flex items-center gap-1.5 px-2.5 py-1.5">
                                            <FolderOpen className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex-1">{blok.name}</span>
                                            <span className="text-[10px] text-slate-400">{foPanely.length} panelov</span>
                                          </div>
                                          {foPanely.length > 0 && (
                                            <div className="px-2.5 pb-2 space-y-1">
                                              {foPanely.map(panel => (
                                                <div key={panel.id} className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100/60 dark:bg-slate-700/20" data-testid={`fo-inherited-panel-${panel.id}`}>
                                                  <LayoutGrid className="h-3 w-3 text-slate-400 flex-shrink-0" />
                                                  <span className="text-xs text-slate-500 dark:text-slate-400">{panel.name}</span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* ── TYPE-SPECIFIC SECTIONS ── */}
                {kategorie.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Tag className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-sm">Žiadne Kategórie pre typ {activeType.label}.</p>
                    <p className="text-xs mt-1">Pridajte prvú Kategóriu z Toolbar-u vpravo.</p>
                    <Button
                      variant="outline" size="sm" className="mt-3"
                      onClick={() => setAddKategoriaOpen(true)}
                      data-testid="button-empty-add-kategoria"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Pridať Kategóriu
                    </Button>
                  </div>
                ) : (
              /* ── KATEGÓRIE DnD ── */
              <DndContext sensors={sensors} onDragEnd={e => handleDragEndSections(e, kategorie)}>
                <SortableContext items={kategorie.map(k => k.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-4">
                    {kategorie.map(kat => {
                      const isKatSel    = selectedKategoriaId === kat.id;
                      const catStyle    = getCategoryStyle(kat.folderCategory);
                      const catLabel    = getCategoryLabel(kat.folderCategory);
                      const bloky       = getBloky(kat.id);
                      const katExpanded = !collapsedKategorie.has(kat.id);

                      return (
                        <SortableItem key={kat.id} id={kat.id}>
                          {({ listeners: katL, attributes: katA }) => (
                            <div
                              className={`rounded-xl border-2 transition-all ${isKatSel ? "border-primary shadow-sm" : "border-border"}`}
                              data-testid={`section-kategoria-${kat.id}`}
                            >
                              {/* ── Kategória header ── */}
                              <div
                                className={`flex items-center gap-1.5 px-3 py-2.5 cursor-pointer rounded-t-xl ${
                                  isKatSel ? "bg-primary/8" : "bg-muted/30 hover:bg-muted/50"
                                } ${!katExpanded ? "rounded-b-xl" : ""}`}
                                onClick={() => {
                                  setSelectedKategoriaId(prev => prev === kat.id ? null : kat.id);
                                  setSelectedBlokId(null); setSelectedPanelId(null); setSelectedRiadokId(null);
                                  setCtxItem({ type: "section", item: kat });
                                }}
                              >
                                <DragHandle listeners={katL} attributes={katA} testId={`drag-handle-kategoria-${kat.id}`} />
                                <CollapseToggle
                                  expanded={katExpanded}
                                  onToggle={e => toggleKategoria(kat.id, e)}
                                  testId={`collapse-toggle-kategoria-${kat.id}`}
                                />
                                <Tag className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                <span className="font-bold text-sm flex-1 min-w-0 truncate">{kat.name}</span>
                                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border flex-shrink-0 ${catStyle}`}>{catLabel}</Badge>
                                <span className="text-xs text-muted-foreground flex-shrink-0">{bloky.length} blokov</span>
                                {/* Inline add blok — always visible even when collapsed */}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      onClick={e => { e.stopPropagation(); setSelectedKategoriaId(kat.id); setAddBlokOpen(true); }}
                                      className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/40 hover:text-primary transition-colors"
                                      data-testid={`button-inline-add-blok-${kat.id}`}
                                    >
                                      <Plus className="h-3 w-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">Pridať blok</TooltipContent>
                                </Tooltip>
                                <EditDeleteButtons section={kat} />
                              </div>

                              {/* ── Kategória content (Bloky) — collapsible ── */}
                              {katExpanded && (
                                <div className="p-4 space-y-3">
                                  {bloky.length === 0 ? (
                                    <div className="flex items-center justify-center h-10 border-2 border-dashed rounded text-muted-foreground/40 text-xs">
                                      Žiadne bloky — kliknite + v hlavičke kategórie
                                    </div>
                                  ) : (
                                    <DndContext sensors={sensors} onDragEnd={e => handleDragEndSections(e, getBloky(kat.id))}>
                                      <SortableContext items={bloky.map(b => b.id)} strategy={verticalListSortingStrategy}>
                                        <div className="space-y-3">
                                          {bloky.map(blok => {
                                            const isBlokSel  = selectedBlokId === blok.id;
                                            const panely     = getPanely(blok.id);
                                            const blokExpanded = expandedBloky.has(blok.id);

                                            return (
                                              <SortableItem key={blok.id} id={blok.id}>
                                                {({ listeners: blokL, attributes: blokA }) => (
                                                  <div
                                                    className={`rounded-lg border-2 transition-all ${
                                                      isBlokSel ? "border-primary/70 shadow-sm" : "border-border/70"
                                                    }`}
                                                    data-testid={`section-blok-${blok.id}`}
                                                  >
                                                    {/* ── Blok header ── */}
                                                    <div
                                                      className={`flex items-center gap-1.5 px-3 py-2 cursor-pointer rounded-t-md ${
                                                        isBlokSel ? "bg-primary/6" : "bg-muted/20 hover:bg-muted/40"
                                                      } ${!blokExpanded ? "rounded-b-md" : ""}`}
                                                      onClick={() => {
                                                        setSelectedKategoriaId(kat.id);
                                                        setSelectedBlokId(prev => prev === blok.id ? null : blok.id);
                                                        setSelectedPanelId(null); setSelectedRiadokId(null);
                                                        setCtxItem({ type: "section", item: blok });
                                                      }}
                                                    >
                                                      <DragHandle listeners={blokL} attributes={blokA} testId={`drag-handle-blok-${blok.id}`} />
                                                      <CollapseToggle
                                                        expanded={blokExpanded}
                                                        onToggle={e => toggleBlok(blok.id, e)}
                                                        testId={`collapse-toggle-blok-${blok.id}`}
                                                      />
                                                      <FolderOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                      <span className="font-semibold text-sm flex-1 min-w-0 truncate">{blok.name}</span>
                                                      <span className="text-xs text-muted-foreground flex-shrink-0">{panely.length} panelov</span>
                                                      {/* Inline add panel */}
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <button
                                                            type="button"
                                                            onClick={e => { e.stopPropagation(); setSelectedKategoriaId(kat.id); setSelectedBlokId(blok.id); setAddPanelOpen(true); }}
                                                            className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/40 hover:text-primary transition-colors"
                                                            data-testid={`button-inline-add-panel-${blok.id}`}
                                                          >
                                                            <Plus className="h-3 w-3" />
                                                          </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-xs">Pridať panel</TooltipContent>
                                                      </Tooltip>
                                                      {/* Move blok */}
                                                      <Tooltip>
                                                        <TooltipTrigger asChild>
                                                          <button
                                                            type="button"
                                                            onClick={e => openMoveBlok(blok, e)}
                                                            className="flex-shrink-0 h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors"
                                                            data-testid={`button-move-blok-${blok.id}`}
                                                          >
                                                            <ArrowRightLeft className="h-3 w-3" />
                                                          </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="text-xs">Presunúť do inej Kategórie</TooltipContent>
                                                      </Tooltip>
                                                      <EditDeleteButtons section={blok} />
                                                    </div>

                                                    {/* ── Blok content (Panely) — collapsible ── */}
                                                    {blokExpanded && (
                                                      <div className="p-3">
                                                        {panely.length === 0 ? (
                                                          <div className="flex items-center justify-center h-10 border-2 border-dashed rounded text-muted-foreground/40 text-xs">
                                                            Žiadne panely — kliknite + v hlavičke bloku
                                                          </div>
                                                        ) : (
                                                          <DndContext sensors={sensors} onDragEnd={e => handleDragEndSections(e, getPanely(blok.id))}>
                                                            <SortableContext items={panely.map(p => p.id)} strategy={rectSortingStrategy}>
                                                              <div className="flex flex-wrap gap-0">
                                                                {panely.map(panel => {
                                                                  const isPanelSel   = selectedPanelId === panel.id;
                                                                  const riadky       = getRiadky(panel.id);
                                                                  const legacyParams = getParamsForPanel(panel.id);
                                                                  const panelExpanded = expandedPanely.has(panel.id);
                                                                  const panelPct     = (panel.widthPercent ?? 100) > 0 ? (panel.widthPercent ?? 100) : 100;

                                                                  return (
                                                                    <SortableItem key={panel.id} id={panel.id} style={{ flex: `0 0 ${panelPct}%`, width: `${panelPct}%`, padding: "0 6px 6px 0" }}>
                                                                      {({ listeners: panelL, attributes: panelA }) => (
                                                                        <div
                                                                          className={`border-2 rounded-lg flex flex-col transition-all cursor-pointer ${
                                                                            isPanelSel ? "border-primary shadow-sm" : "border-border hover:border-muted-foreground/50"
                                                                          }`}
                                                                          onClick={() => {
                                                                            setSelectedKategoriaId(kat.id);
                                                                            setSelectedBlokId(blok.id);
                                                                            setSelectedPanelId(prev => prev === panel.id ? null : panel.id);
                                                                            setSelectedRiadokId(null);
                                                                            setCtxItem({ type: "section", item: panel });
                                                                          }}
                                                                          data-testid={`card-panel-${panel.id}`}
                                                                        >
                                                                          {/* ── Panel header ── */}
                                                                          <div className={`flex items-center gap-1.5 px-2 py-2 rounded-t-md ${isPanelSel ? "bg-primary/5" : "bg-muted/30"} ${!panelExpanded ? "rounded-b-md" : ""}`}>
                                                                            <DragHandle listeners={panelL} attributes={panelA} testId={`drag-handle-panel-${panel.id}`} />
                                                                            <CollapseToggle
                                                                              expanded={panelExpanded}
                                                                              onToggle={e => togglePanel(panel.id, e)}
                                                                              testId={`collapse-toggle-panel-${panel.id}`}
                                                                            />
                                                                            <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                                                            <span className="text-sm font-medium flex-1 min-w-0 truncate">{panel.name}</span>
                                                                            {/* Inline add riadok */}
                                                                            <Tooltip>
                                                                              <TooltipTrigger asChild>
                                                                                <button
                                                                                  type="button"
                                                                                  onClick={e => { e.stopPropagation(); setSelectedKategoriaId(kat.id); setSelectedBlokId(blok.id); setSelectedPanelId(panel.id); setAddRiadokOpen(true); }}
                                                                                  className="flex-shrink-0 h-4 w-4 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/40 hover:text-primary transition-colors"
                                                                                  data-testid={`button-inline-add-riadok-${panel.id}`}
                                                                                >
                                                                                  <Plus className="h-2.5 w-2.5" />
                                                                                </button>
                                                                              </TooltipTrigger>
                                                                              <TooltipContent side="top" className="text-xs">Pridať riadok</TooltipContent>
                                                                            </Tooltip>
                                                                            <EditDeleteButtons section={panel} />
                                                                          </div>

                                                                          {/* ── Panel content (Riadky) — collapsible ── */}
                                                                          {panelExpanded && (
                                                                            <>
                                                                              <div className="p-2 flex-1 min-h-[40px] space-y-1">
                                                                                {riadky.length === 0 && legacyParams.length === 0 ? (
                                                                                  <div className="flex items-center justify-center h-8 text-muted-foreground/40 text-xs">
                                                                                    Žiadne riadky
                                                                                  </div>
                                                                                ) : (
                                                                                  <>
                                                                                    <DndContext sensors={sensors} onDragEnd={e => handleDragEndSections(e, getRiadky(panel.id))}>
                                                                                      <SortableContext items={riadky.map(r => r.id)} strategy={rectSortingStrategy}>
                                                                                        <div className="flex flex-wrap">
                                                                                        {riadky.map(riadok => {
                                                                                          const isRiadokSel  = selectedRiadokId === riadok.id;
                                                                                          const params       = getParamsForRiadok(riadok.id);
                                                                                          const riadokExpanded = expandedRiadky.has(riadok.id);
                                                                                          const riadokPct    = (riadok.widthPercent ?? 100) > 0 ? (riadok.widthPercent ?? 100) : 100;
                                                                                          return (
                                                                                            <SortableItem key={riadok.id} id={riadok.id} style={{ flex: `0 0 ${riadokPct}%`, width: `${riadokPct}%`, paddingBottom: "4px" }}>
                                                                                              {({ listeners: riadokL, attributes: riadokA }) => (
                                                                                                <div
                                                                                                  className={`rounded border px-1.5 py-1 text-xs cursor-pointer transition-all ${
                                                                                                    isRiadokSel
                                                                                                      ? "border-primary/60 bg-primary/5"
                                                                                                      : "border-border/50 hover:border-muted-foreground/40 hover:bg-muted/20"
                                                                                                  }`}
                                                                                                  onClick={e => {
                                                                                                    e.stopPropagation();
                                                                                                    setSelectedKategoriaId(kat.id);
                                                                                                    setSelectedBlokId(blok.id);
                                                                                                    setSelectedPanelId(panel.id);
                                                                                                    setSelectedRiadokId(prev => prev === riadok.id ? null : riadok.id);
                                                                                                    setCtxItem({ type: "section", item: riadok });
                                                                                                  }}
                                                                                                  data-testid={`card-riadok-${riadok.id}`}
                                                                                                >
                                                                                                  {/* Riadok header row */}
                                                                                                  <div className="flex items-center gap-1 mb-0.5">
                                                                                                    <DragHandle listeners={riadokL} attributes={riadokA} testId={`drag-handle-riadok-${riadok.id}`} />
                                                                                                    <CollapseToggle
                                                                                                      expanded={riadokExpanded}
                                                                                                      onToggle={e => toggleRiadok(riadok.id, e)}
                                                                                                      testId={`collapse-toggle-riadok-${riadok.id}`}
                                                                                                    />
                                                                                                    <Rows3 className="h-2.5 w-2.5 text-muted-foreground/60 flex-shrink-0" />
                                                                                                    {riadok.name ? (
                                                                                                      <span className="font-medium text-muted-foreground/80 flex-1 truncate">{riadok.name}</span>
                                                                                                    ) : (
                                                                                                      <span className="text-muted-foreground/35 flex-1 italic text-[10px]">bez názvu</span>
                                                                                                    )}
                                                                                                    {params.length > 0 && (
                                                                                                      <span className="text-[10px] text-muted-foreground/50">{params.length}p</span>
                                                                                                    )}
                                                                                                    <button
                                                                                                      onClick={e => { e.stopPropagation(); openEdit(riadok); }}
                                                                                                      className="h-4 w-4 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/40 hover:text-foreground"
                                                                                                      data-testid={`button-edit-riadok-inline-${riadok.id}`}
                                                                                                    >
                                                                                                      <Pencil className="h-2.5 w-2.5" />
                                                                                                    </button>
                                                                                                    <button
                                                                                                      onClick={e => { e.stopPropagation(); handleDelete(riadok); }}
                                                                                                      className="h-4 w-4 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/40"
                                                                                                      data-testid={`button-delete-riadok-inline-${riadok.id}`}
                                                                                                    >
                                                                                                      <X className="h-2.5 w-2.5" />
                                                                                                    </button>
                                                                                                  </div>
                                                                                                  {/* Params inside Riadok — collapsible, DnD */}
                                                                                                  {riadokExpanded && (
                                                                                                    params.length > 0 ? (
                                                                                                    <DndContext sensors={sensors} onDragEnd={e => handleDragEndParams(e, getParamsForRiadok(riadok.id))}>
                                                                                                      <SortableContext items={params.map(p => p.id)} strategy={rectSortingStrategy}>
                                                                                                        <div className="flex flex-wrap mt-1">
                                                                                                          {params.map(param => {
                                                                                                            const pct = (param.widthPercent ?? 100) > 0 ? (param.widthPercent ?? 100) : 100;
                                                                                                            return (
                                                                                                              <SortableItem key={param.id} id={param.id} style={{ flex: `0 0 ${pct}%`, width: `${pct}%` }}>
                                                                                                                {({ listeners: pL, attributes: pA }) => (
                                                                                                                  <div
                                                                                                                    className="px-0.5 pb-1 cursor-pointer"
                                                                                                                    data-testid={`param-row-${param.id}`}
                                                                                                                    onClick={e => { e.stopPropagation(); setCtxItem({ type: "param", item: param }); }}
                                                                                                                  >
                                                                                                                    <div className="flex items-center gap-0.5 mb-0.5">
                                                                                                                      <DragHandle listeners={pL} attributes={pA} testId={`drag-handle-param-${param.id}`} />
                                                                                                                      <span className="text-[10px] text-muted-foreground font-medium truncate flex-1">{param.label}</span>
                                                                                                                      {param.isRequired && <span className="text-[9px] text-red-500 font-bold">*</span>}
                                                                                                                      <FieldTypeBadge type={param.fieldType} />
                                                                                                                      <Tooltip>
                                                                                                                        <TooltipTrigger asChild>
                                                                                                                          <button
                                                                                                                            type="button"
                                                                                                                            onClick={e => openMoveParam(param, e)}
                                                                                                                            className="flex-shrink-0 h-3.5 w-3.5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/30 hover:text-primary transition-colors"
                                                                                                                            data-testid={`button-move-param-${param.id}`}
                                                                                                                          >
                                                                                                                            <ArrowRightLeft className="h-2.5 w-2.5" />
                                                                                                                          </button>
                                                                                                                        </TooltipTrigger>
                                                                                                                        <TooltipContent side="top" className="text-xs">Presunúť do iného riadku</TooltipContent>
                                                                                                                      </Tooltip>
                                                                                                                    </div>
                                                                                                                    <div className="h-5 rounded bg-muted/40 border border-border/30" />
                                                                                                                  </div>
                                                                                                                )}
                                                                                                              </SortableItem>
                                                                                                            );
                                                                                                          })}
                                                                                                        </div>
                                                                                                      </SortableContext>
                                                                                                    </DndContext>
                                                                                                    ) : (
                                                                                                      <div className="pl-3.5 text-[10px] text-muted-foreground/40 italic">žiadne parametre</div>
                                                                                                    )
                                                                                                  )}
                                                                                                </div>
                                                                                              )}
                                                                                            </SortableItem>
                                                                                          );
                                                                                        })}
                                                                                        </div>
                                                                                      </SortableContext>
                                                                                    </DndContext>

                                                                                    {/* Legacy params without rowId — also DnD sortable */}
                                                                                    {legacyParams.length > 0 && (
                                                                                      <div className="rounded border border-dashed border-amber-300/60 px-2 py-1">
                                                                                        <div className="text-[10px] text-amber-600/70 mb-0.5">Parametre bez riadku:</div>
                                                                                        <DndContext sensors={sensors} onDragEnd={e => handleDragEndParams(e, getParamsForPanel(panel.id))}>
                                                                                          <SortableContext items={legacyParams.map(p => p.id)} strategy={rectSortingStrategy}>
                                                                                            <div className="flex flex-wrap mt-0.5">
                                                                                              {legacyParams.map(param => {
                                                                                                const pct = (param.widthPercent ?? 100) > 0 ? (param.widthPercent ?? 100) : 100;
                                                                                                return (
                                                                                                  <SortableItem key={param.id} id={param.id} style={{ flex: `0 0 ${pct}%`, width: `${pct}%` }}>
                                                                                                    {({ listeners: pL, attributes: pA }) => (
                                                                                                      <div
                                                                                                        className="px-0.5 pb-1 cursor-pointer"
                                                                                                        data-testid={`param-row-${param.id}`}
                                                                                                        onClick={e => { e.stopPropagation(); setCtxItem({ type: "param", item: param }); }}
                                                                                                      >
                                                                                                        <div className="flex items-center gap-0.5 mb-0.5">
                                                                                                          <DragHandle listeners={pL} attributes={pA} testId={`drag-handle-param-${param.id}`} />
                                                                                                          <span className="text-[10px] text-muted-foreground font-medium truncate flex-1">{param.label}</span>
                                                                                                          {param.isRequired && <span className="text-[9px] text-red-500 font-bold">*</span>}
                                                                                                          <FieldTypeBadge type={param.fieldType} />
                                                                                                          <Tooltip>
                                                                                                            <TooltipTrigger asChild>
                                                                                                              <button
                                                                                                                type="button"
                                                                                                                onClick={e => openMoveParam(param, e)}
                                                                                                                className="flex-shrink-0 h-3.5 w-3.5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/30 hover:text-primary transition-colors"
                                                                                                                data-testid={`button-move-param-${param.id}`}
                                                                                                              >
                                                                                                                <ArrowRightLeft className="h-2.5 w-2.5" />
                                                                                                              </button>
                                                                                                            </TooltipTrigger>
                                                                                                            <TooltipContent side="top" className="text-xs">Presunúť do riadku</TooltipContent>
                                                                                                          </Tooltip>
                                                                                                        </div>
                                                                                                        <div className="h-5 rounded bg-muted/40 border border-border/30" />
                                                                                                      </div>
                                                                                                    )}
                                                                                                  </SortableItem>
                                                                                                );
                                                                                              })}
                                                                                            </div>
                                                                                          </SortableContext>
                                                                                        </DndContext>
                                                                                      </div>
                                                                                    )}
                                                                                  </>
                                                                                )}
                                                                              </div>

                                                                              {/* Panel footer */}
                                                                              <div className="border-t px-3 py-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                                                                <Rows3 className="h-3 w-3" />
                                                                                <span>{riadky.length} riadkov</span>
                                                                                {legacyParams.length > 0 && (
                                                                                  <>
                                                                                    <span>·</span>
                                                                                    <span className="text-amber-600/70">{legacyParams.length} bez riadku</span>
                                                                                  </>
                                                                                )}
                                                                              </div>
                                                                            </>
                                                                          )}
                                                                        </div>
                                                                      )}
                                                                    </SortableItem>
                                                                  );
                                                                })}
                                                              </div>
                                                            </SortableContext>
                                                          </DndContext>
                                                        )}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </SortableItem>
                                            );
                                          })}
                                        </div>
                                      </SortableContext>
                                    </DndContext>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </SortableItem>
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
              </div>
            )}
          </div>

          {/* === CONTEXT PANEL === */}
          {ctxItem && (
            <div
              ref={ctxPanelRef}
              className="min-w-[260px] w-64 border-l bg-card flex-shrink-0 flex flex-col overflow-y-auto"
              data-testid="context-panel"
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-muted/30 flex-shrink-0">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex-1">
                  {ctxItem.type === "param" ? "Parameter" : (
                    ctxItem.item.sectionType === "kategoria" ? "Kategória" :
                    ctxItem.item.sectionType === "blok" ? "Blok" :
                    ctxItem.item.sectionType === "panel" ? "Panel" : "Riadok"
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setCtxItem(null)}
                  className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors"
                  data-testid="context-panel-close"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Name */}
              <div className="px-3 pt-3 pb-1 flex-shrink-0">
                <p className="text-sm font-medium leading-tight break-words">
                  {ctxItem.type === "param" ? ctxItem.item.label : ctxItem.item.name || "— bez názvu —"}
                </p>
              </div>

              {/* Breadcrumb */}
              <div className="px-3 pb-3 flex-shrink-0">
                <div className="flex flex-col gap-0.5 mt-1">
                  {buildPath(ctxItem).map((step, i) => (
                    <div key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      {i > 0 && <span className="ml-2 text-muted-foreground/30">↳</span>}
                      <span className="flex-shrink-0">{step.icon}</span>
                      <span className="truncate">{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t mx-3 mb-2 flex-shrink-0" />

              {/* PARAM: label editor */}
              {ctxItem.type === "param" && (() => {
                const freshParam = allParams.find(p => p.id === ctxItem.item.id) ?? ctxItem.item;
                return (
                  <ParamLabelEditor
                    currentLabel={freshParam.label}
                    onCommit={(label) => updateParamLabelMutation.mutate({ id: freshParam.id, label })}
                    isPending={updateParamLabelMutation.isPending}
                  />
                );
              })()}

              {/* PARAM: isRequired toggle + field type badge */}
              {ctxItem.type === "param" && (() => {
                const freshParam = allParams.find(p => p.id === ctxItem.item.id) ?? ctxItem.item;
                return (
                  <div className="px-3 pb-3 flex-shrink-0">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Vlastnosti</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => updateParamRequiredMutation.mutate({ id: freshParam.id, isRequired: !freshParam.isRequired })}
                        disabled={updateParamRequiredMutation.isPending}
                        data-testid="param-required-toggle"
                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border transition-all ${
                          freshParam.isRequired
                            ? "bg-red-500/10 text-red-600 border-red-300 dark:border-red-700"
                            : "bg-background border-border text-muted-foreground hover:border-primary/60 hover:text-foreground"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${freshParam.isRequired ? "bg-red-500" : "bg-muted-foreground/40"}`} />
                        {freshParam.isRequired ? "Povinné" : "Nepovinné"}
                      </button>
                      <FieldTypeBadge type={freshParam.fieldType} />
                      {updateParamRequiredMutation.isPending && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Loader2 className="h-2.5 w-2.5 animate-spin" />
                          Ukladám...
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* PARAM-specific: widthPercent editor */}
              {ctxItem.type === "param" && (() => {
                const freshParam = allParams.find(p => p.id === ctxItem.item.id) ?? ctxItem.item;
                const currentPct = (freshParam.widthPercent ?? 100) > 0 ? (freshParam.widthPercent ?? 100) : 100;
                return (
                  <WidthPercentEditor
                    label="Šírka poľa"
                    currentPct={currentPct}
                    onCommit={(v) => updateParamWidthMutation.mutate({ id: freshParam.id, widthPercent: v })}
                    isPending={updateParamWidthMutation.isPending}
                    testIdPrefix="param-width"
                  />
                );
              })()}

              {/* SECTION panel/riadok: widthPercent editor */}
              {ctxItem.type === "section" && (ctxItem.item.sectionType === "panel" || ctxItem.item.sectionType === "riadok") && (() => {
                const freshSec = allSections.find(s => s.id === ctxItem.item.id) ?? ctxItem.item;
                const currentPct = (freshSec.widthPercent ?? 100) > 0 ? (freshSec.widthPercent ?? 100) : 100;
                return (
                  <WidthPercentEditor
                    label={`Šírka ${ctxItem.item.sectionType === "panel" ? "panelu" : "riadku"}`}
                    currentPct={currentPct}
                    onCommit={(v) => updateSectionWidthMutation.mutate({ id: freshSec.id, widthPercent: v })}
                    isPending={updateSectionWidthMutation.isPending}
                    testIdPrefix="section-width"
                  />
                );
              })()}

              {/* PARAM: move button */}
              {ctxItem.type === "param" && (
                <div className="px-3 pb-3 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 h-8 text-xs"
                    onClick={() => {
                      const freshParam = allParams.find(p => p.id === ctxItem.item.id) ?? ctxItem.item;
                      setMoveParamTarget(freshParam);
                      setMoveParamTargetRiadokId(freshParam.rowId ? String(freshParam.rowId) : "none");
                      setMoveParamOpen(true);
                    }}
                    data-testid="ctx-panel-move-param"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Presunúť do iného riadku
                  </Button>
                </div>
              )}

              {/* SECTION blok: move button */}
              {ctxItem.type === "section" && ctxItem.item.sectionType === "blok" && (
                <div className="px-3 pb-3 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 h-8 text-xs"
                    onClick={() => {
                      setMoveBlokTarget(ctxItem.item);
                      setMoveBlokTargetKatId(String(ctxItem.item.parentSectionId ?? ""));
                      setMoveBlokOpen(true);
                    }}
                    data-testid="ctx-panel-move-blok"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Presunúť do inej kategórie
                  </Button>
                </div>
              )}

              {/* SECTION panel: move button */}
              {ctxItem.type === "section" && ctxItem.item.sectionType === "panel" && (
                <div className="px-3 pb-3 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 h-8 text-xs"
                    onClick={() => {
                      setMovePanelTarget(ctxItem.item);
                      setMovePanelTargetBlokId(String(ctxItem.item.parentSectionId ?? ""));
                      setMovePanelOpen(true);
                    }}
                    data-testid="ctx-panel-move-panel"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Presunúť do iného bloku
                  </Button>
                </div>
              )}

              {/* SECTION riadok: move button */}
              {ctxItem.type === "section" && ctxItem.item.sectionType === "riadok" && (
                <div className="px-3 pb-3 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 h-8 text-xs"
                    onClick={() => {
                      setMoveRiadokTarget(ctxItem.item);
                      setMoveRiadokTargetPanelId(String(ctxItem.item.parentSectionId ?? ""));
                      setMoveRiadokOpen(true);
                    }}
                    data-testid="ctx-panel-move-riadok"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Presunúť do iného panelu
                  </Button>
                </div>
              )}

              {/* SECTION: edit button */}
              {ctxItem.type === "section" && ctxItem.item.sectionType !== "kategoria" && (
                <div className="px-3 pb-3 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 h-8 text-xs"
                    onClick={() => openEdit(ctxItem.item)}
                    data-testid="ctx-panel-edit-section"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Premenovať
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* === TOOLBAR === */}
          <div className="w-56 border-l bg-card flex-shrink-0 flex flex-col p-4 gap-4 overflow-y-auto">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pridať</p>
              <div className="flex flex-col gap-1.5">
                <Button
                  variant="outline" size="sm" className="justify-start gap-2 h-8"
                  onClick={() => setAddKategoriaOpen(true)}
                  data-testid="toolbar-add-kategoria"
                >
                  <Tag className="h-3.5 w-3.5" />
                  Kategória
                </Button>
                <Button
                  variant="outline" size="sm" className="justify-start gap-2 h-8"
                  onClick={() => setAddBlokOpen(true)}
                  disabled={!selectedKategoriaId}
                  data-testid="toolbar-add-blok"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Blok
                </Button>
                <Button
                  variant="outline" size="sm" className="justify-start gap-2 h-8"
                  onClick={() => setAddPanelOpen(true)}
                  disabled={!selectedBlokId}
                  data-testid="toolbar-add-panel"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Panel
                </Button>
                <Button
                  variant="outline" size="sm" className="justify-start gap-2 h-8"
                  onClick={() => setAddRiadokOpen(true)}
                  disabled={!selectedPanelId}
                  data-testid="toolbar-add-riadok"
                >
                  <Rows3 className="h-3.5 w-3.5" />
                  Riadok
                </Button>
              </div>
            </div>

            {/* Collapse / expand all */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Zobrazenie</p>
              <div className="flex gap-1.5">
                <Button
                  variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs"
                  onClick={collapseAll}
                  data-testid="toolbar-collapse-all"
                >
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                  Zbaliť
                </Button>
                <Button
                  variant="outline" size="sm" className="flex-1 gap-1.5 h-8 text-xs"
                  onClick={expandAll}
                  data-testid="toolbar-expand-all"
                >
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  Rozbaliť
                </Button>
              </div>
            </div>

            {/* Selection context */}
            {(selectedKategoriaId || selectedBlokId || selectedPanelId || selectedRiadokId) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Výber</p>
                <div className="space-y-1 text-xs">
                  {selectedKategoria && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Tag className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{selectedKategoria.name}</span>
                    </div>
                  )}
                  {selectedBlok && (
                    <div className="flex items-center gap-1 text-muted-foreground pl-2">
                      <FolderOpen className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{selectedBlok.name}</span>
                    </div>
                  )}
                  {selectedPanel && (
                    <div className="flex items-center gap-1 text-muted-foreground pl-4">
                      <LayoutGrid className="h-3 w-3 flex-shrink-0" />
                      <span className="truncate">{selectedPanel.name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stats */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Prehľad</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Kategórie</span>
                  <span className="font-medium">{kategorie.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Bloky</span>
                  <span className="font-medium">{totalBloky}</span>
                </div>
                <div className="flex justify-between">
                  <span>Panely</span>
                  <span className="font-medium">{totalPanely}</span>
                </div>
                <div className="flex justify-between">
                  <span>Riadky</span>
                  <span className="font-medium">{totalRiadky}</span>
                </div>
                <div className="flex justify-between">
                  <span>Parametre</span>
                  <span className="font-medium">{totalParams}</span>
                </div>
              </div>
            </div>

            {/* Help */}
            <div className="mt-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground/60 cursor-help">
                    <Info className="h-3 w-3" />
                    <span>Hierarchia</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs max-w-48">
                  Typ → Kategória → Blok → Panel → Riadok → Parameter
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* DIALOGS                                                       */}
        {/* ============================================================ */}

        {/* Add Kategória */}
        <Dialog open={addKategoriaOpen} onOpenChange={setAddKategoriaOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pridať Kategóriu</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Názov</label>
                <Input
                  value={newKategoriaName}
                  onChange={e => setNewKategoriaName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddKategoria(); }}
                  placeholder="napr. Povinné dokumenty"
                  data-testid="input-new-kategoria-name"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Typ kategórie</label>
                <Select value={newKategoriaCategory} onValueChange={setNewKategoriaCategory}>
                  <SelectTrigger data-testid="select-new-kategoria-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLDER_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddKategoriaOpen(false)}>Zrušiť</Button>
              <Button onClick={handleAddKategoria} disabled={!newKategoriaName.trim() || createMutation.isPending} data-testid="button-confirm-add-kategoria">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pridať"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Blok */}
        <Dialog open={addBlokOpen} onOpenChange={setAddBlokOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pridať Blok</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              {selectedKategoria && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  Kategória: <span className="font-medium">{selectedKategoria.name}</span>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Názov bloku</label>
                <Input
                  value={newBlokName}
                  onChange={e => setNewBlokName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddBlok(); }}
                  placeholder="napr. Základné údaje"
                  data-testid="input-new-blok-name"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddBlokOpen(false)}>Zrušiť</Button>
              <Button onClick={handleAddBlok} disabled={!newBlokName.trim() || !selectedKategoriaId || createMutation.isPending} data-testid="button-confirm-add-blok">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pridať"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Panel */}
        <Dialog open={addPanelOpen} onOpenChange={setAddPanelOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pridať Panel</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              {selectedBlok && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  Blok: <span className="font-medium">{selectedBlok.name}</span>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Názov panelu</label>
                <Input
                  value={newPanelName}
                  onChange={e => setNewPanelName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleAddPanel(); }}
                  placeholder="napr. Adresa"
                  data-testid="input-new-panel-name"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddPanelOpen(false)}>Zrušiť</Button>
              <Button onClick={handleAddPanel} disabled={!newPanelName.trim() || !selectedBlokId || createMutation.isPending} data-testid="button-confirm-add-panel">
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pridať"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Riadok */}
        <Dialog open={addRiadokOpen} onOpenChange={v => { setAddRiadokOpen(v); if (!v) { setNewRiadokName(""); setRiadokHasName(true); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Pridať Riadok</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              {selectedPanel && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  Panel: <span className="font-medium">{selectedPanel.name}</span>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">Typ riadku</label>
                <div className="flex gap-1 p-1 bg-muted rounded-md w-fit">
                  <button
                    type="button"
                    onClick={() => setRiadokHasName(true)}
                    className={`px-3 py-1 rounded text-sm transition-all ${riadokHasName ? "bg-background shadow font-medium" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid="toggle-riadok-s-nazvom"
                  >
                    S názvom
                  </button>
                  <button
                    type="button"
                    onClick={() => setRiadokHasName(false)}
                    className={`px-3 py-1 rounded text-sm transition-all ${!riadokHasName ? "bg-background shadow font-medium" : "text-muted-foreground hover:text-foreground"}`}
                    data-testid="toggle-riadok-bez-nazvu"
                  >
                    Bez názvu
                  </button>
                </div>
              </div>
              {riadokHasName && (
                <div>
                  <label className="text-sm font-medium mb-1 block">Názov riadku</label>
                  <Input
                    value={newRiadokName}
                    onChange={e => setNewRiadokName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleAddRiadok(); }}
                    placeholder="napr. Osobné údaje"
                    data-testid="input-new-riadok-name"
                    autoFocus
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddRiadokOpen(false)}>Zrušiť</Button>
              <Button
                onClick={handleAddRiadok}
                disabled={!selectedPanelId || createMutation.isPending || (riadokHasName && !newRiadokName.trim())}
                data-testid="button-confirm-add-riadok"
              >
                {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pridať"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit (rename) */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Premenovať {editTarget?.sectionType === "kategoria" ? "Kategóriu" : editTarget?.sectionType === "blok" ? "Blok" : editTarget?.sectionType === "riadok" ? "Riadok" : "Panel"}
              </DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-1.5">
              <Input
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleEdit(); }}
                placeholder={editTarget?.sectionType === "riadok" ? "Nechajte prázdne pre riadok bez názvu" : ""}
                data-testid="input-edit-name"
                autoFocus
              />
              {editTarget?.sectionType === "riadok" && (
                <p className="text-xs text-muted-foreground">Prázdne pole = riadok bez názvu</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Zrušiť</Button>
              <Button
                onClick={handleEdit}
                disabled={(editTarget?.sectionType !== "riadok" && !editName.trim()) || renameMutation.isPending}
                data-testid="button-confirm-edit"
              >
                {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Uložiť"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Blok to another Kategória */}
        <Dialog open={moveBlokOpen} onOpenChange={v => { setMoveBlokOpen(v); if (!v) { setMoveBlokTarget(null); setMoveBlokTargetKatId(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Presunúť Blok do inej Kategórie</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {moveBlokTarget && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  Blok: <span className="font-medium">{moveBlokTarget.name}</span>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Cieľová Kategória</label>
                <Select value={moveBlokTargetKatId} onValueChange={setMoveBlokTargetKatId}>
                  <SelectTrigger data-testid="select-move-blok-target">
                    <SelectValue placeholder="Vyberte kategóriu..." />
                  </SelectTrigger>
                  <SelectContent>
                    {kategorie.map(k => (
                      <SelectItem key={k.id} value={String(k.id)} disabled={k.id === moveBlokTarget?.parentSectionId}>
                        {k.name}
                        {k.id === moveBlokTarget?.parentSectionId && " (aktuálna)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoveBlokOpen(false)}>Zrušiť</Button>
              <Button
                onClick={handleMoveBlok}
                disabled={!moveBlokTargetKatId || Number(moveBlokTargetKatId) === moveBlokTarget?.parentSectionId || moveBlokMutation.isPending}
                data-testid="button-confirm-move-blok"
              >
                {moveBlokMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Presunúť"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Param to another Row */}
        <Dialog open={moveParamOpen} onOpenChange={v => { setMoveParamOpen(v); if (!v) { setMoveParamTarget(null); setMoveParamTargetRiadokId(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Presunúť parameter do iného riadku</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {moveParamTarget && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5 space-y-0.5">
                  <div>Parameter: <span className="font-medium">{moveParamTarget.label}</span></div>
                  {moveParamTarget.rowId ? (
                    <div>Aktuálny riadok: <span className="font-medium">{allSections.find(s => s.id === moveParamTarget.rowId)?.name || `#${moveParamTarget.rowId}`}</span></div>
                  ) : (
                    <div className="text-amber-600/80">Aktuálne: bez riadku (panel-level)</div>
                  )}
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Cieľový Riadok</label>
                <Select value={moveParamTargetRiadokId} onValueChange={setMoveParamTargetRiadokId}>
                  <SelectTrigger data-testid="select-move-param-target">
                    <SelectValue placeholder="Vyberte riadok..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      — Bez riadku (panel-level)
                    </SelectItem>
                    {moveParamTarget && getRiadkyForParam(moveParamTarget).map(r => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.name || <span className="italic text-muted-foreground">bez názvu</span>}
                        {r.id === moveParamTarget.rowId && " (aktuálny)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoveParamOpen(false)}>Zrušiť</Button>
              <Button
                onClick={handleMoveParam}
                disabled={
                  !moveParamTargetRiadokId ||
                  (moveParamTargetRiadokId === "none" && !moveParamTarget?.rowId) ||
                  (moveParamTargetRiadokId !== "none" && Number(moveParamTargetRiadokId) === moveParamTarget?.rowId) ||
                  moveParamMutation.isPending
                }
                data-testid="button-confirm-move-param"
              >
                {moveParamMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Presunúť"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Panel to another Blok */}
        <Dialog open={movePanelOpen} onOpenChange={v => { setMovePanelOpen(v); if (!v) { setMovePanelTarget(null); setMovePanelTargetBlokId(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Presunúť Panel do iného Bloku</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {movePanelTarget && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  Panel: <span className="font-medium">{movePanelTarget.name}</span>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Cieľový Blok</label>
                <Select value={movePanelTargetBlokId} onValueChange={setMovePanelTargetBlokId}>
                  <SelectTrigger data-testid="select-move-panel-target">
                    <SelectValue placeholder="Vyberte blok..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allSections.filter(s => s.sectionType === "blok" && s.clientTypeId === clientTypeId).map(b => (
                      <SelectItem key={b.id} value={String(b.id)} disabled={b.id === movePanelTarget?.parentSectionId}>
                        {b.name}
                        {b.id === movePanelTarget?.parentSectionId && " (aktuálny)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMovePanelOpen(false)}>Zrušiť</Button>
              <Button
                onClick={() => movePanelTarget && movePanelTargetBlokId && movePanelMutation.mutate({ id: movePanelTarget.id, parentSectionId: Number(movePanelTargetBlokId) })}
                disabled={!movePanelTargetBlokId || Number(movePanelTargetBlokId) === movePanelTarget?.parentSectionId || movePanelMutation.isPending}
                data-testid="button-confirm-move-panel"
              >
                {movePanelMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Presunúť"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Move Riadok to another Panel */}
        <Dialog open={moveRiadokOpen} onOpenChange={v => { setMoveRiadokOpen(v); if (!v) { setMoveRiadokTarget(null); setMoveRiadokTargetPanelId(""); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Presunúť Riadok do iného Panelu</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              {moveRiadokTarget && (
                <div className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
                  Riadok: <span className="font-medium">{moveRiadokTarget.name || "— bez názvu —"}</span>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1 block">Cieľový Panel</label>
                <Select value={moveRiadokTargetPanelId} onValueChange={setMoveRiadokTargetPanelId}>
                  <SelectTrigger data-testid="select-move-riadok-target">
                    <SelectValue placeholder="Vyberte panel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allSections.filter(s => s.sectionType === "panel" && s.clientTypeId === clientTypeId).map(p => (
                      <SelectItem key={p.id} value={String(p.id)} disabled={p.id === moveRiadokTarget?.parentSectionId}>
                        {p.name}
                        {p.id === moveRiadokTarget?.parentSectionId && " (aktuálny)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMoveRiadokOpen(false)}>Zrušiť</Button>
              <Button
                onClick={() => moveRiadokTarget && moveRiadokTargetPanelId && moveRiadokMutation.mutate({ id: moveRiadokTarget.id, parentSectionId: Number(moveRiadokTargetPanelId) })}
                disabled={!moveRiadokTargetPanelId || Number(moveRiadokTargetPanelId) === moveRiadokTarget?.parentSectionId || moveRiadokMutation.isPending}
                data-testid="button-confirm-move-riadok"
              >
                {moveRiadokMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Presunúť"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
}
