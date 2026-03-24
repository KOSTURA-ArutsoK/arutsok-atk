import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Users, LayoutGrid, AlignLeft, Plus, X, GripVertical,
  Layers, FolderOpen, Pencil, Save, Info, Search,
} from "lucide-react";
import type { UiBlueprint, SubjectParameter } from "@shared/schema";

// ============================================================
// Types for layoutJson structure
// ============================================================
type BpParameter = {
  id: string;
  paramId: number;
  label: string;
  fieldType: string;
  width: "25%" | "50%" | "75%" | "100%";
  sortOrder: number;
};

type BpPanel = {
  id: string;
  name: string;
  sortOrder: number;
  parametre: BpParameter[];
};

type BpMegaBlok = {
  id: string;
  name: string;
  sortOrder: number;
  panely: BpPanel[];
};

type BlueprintLayout = {
  megaBloky: BpMegaBlok[];
};

function emptyLayout(): BlueprintLayout {
  return { megaBloky: [] };
}

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

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

const WIDTH_OPTIONS = ["25%", "50%", "75%", "100%"] as const;

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

function WidthBadge({ width }: { width: string }) {
  return (
    <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">{width}</span>
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

  // Master switcher
  const [activeCode, setActiveCode] = useState("FO");
  const activeType = SUBJECT_TYPES.find(t => t.code === activeCode)!;
  const clientTypeId = activeType.clientTypeId;

  // Local editable layout (in-memory before save)
  const [layout, setLayout] = useState<BlueprintLayout>(emptyLayout());
  const [blueprintId, setBlueprintId] = useState<number | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Selection
  const [selectedMegaBlokId, setSelectedMegaBlokId] = useState<string | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);

  // Dialogs
  const [addMegaBlokOpen, setAddMegaBlokOpen] = useState(false);
  const [editMegaBlokOpen, setEditMegaBlokOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [addParamOpen, setAddParamOpen] = useState(false);

  // Inputs
  const [newMegaBlokName, setNewMegaBlokName] = useState("");
  const [editMegaBlokName, setEditMegaBlokName] = useState("");
  const [newPanelName, setNewPanelName] = useState("");
  const [editPanelName, setEditPanelName] = useState("");
  const [paramSearch, setParamSearch] = useState("");
  const [selectedParamIds, setSelectedParamIds] = useState<number[]>([]);
  const [paramWidths, setParamWidths] = useState<Record<number, "25%" | "50%" | "75%" | "100%">>({});

  // Drag state
  const dragParam = useRef<{ paramId: string; fromPanelId: string } | null>(null);

  // ============================================================
  // Load blueprint for active subject type
  // ============================================================
  const { data: blueprintData, isLoading: bpLoading } = useQuery<UiBlueprint | null>({
    queryKey: ["/api/ui-blueprints/find", "SUBJECT", activeCode],
    queryFn: () =>
      apiRequest("GET", `/api/ui-blueprints/find?type=SUBJECT&targetId=${activeCode}`)
        .then(r => r.json()),
  });

  useEffect(() => {
    if (bpLoading) return;
    if (blueprintData) {
      setBlueprintId(blueprintData.id);
      const lay = (blueprintData.layoutJson as any) as BlueprintLayout;
      setLayout(lay?.megaBloky ? lay : emptyLayout());
    } else {
      setBlueprintId(null);
      setLayout(emptyLayout());
    }
    setIsDirty(false);
    setSelectedMegaBlokId(null);
    setSelectedPanelId(null);
  }, [blueprintData, bpLoading]);

  // ============================================================
  // Available parameters for active subject type
  // ============================================================
  const { data: allParams = [] } = useQuery<SubjectParameter[]>({
    queryKey: ["/api/subject-parameters", clientTypeId],
    queryFn: () =>
      apiRequest("GET", `/api/subject-parameters?clientTypeId=${clientTypeId}`)
        .then(r => r.json()),
  });

  // Which paramIds are already in the layout?
  const usedParamIds = useMemo(() => {
    const ids = new Set<number>();
    layout.megaBloky.forEach(mb =>
      mb.panely.forEach(p =>
        p.parametre.forEach(pr => ids.add(pr.paramId))
      )
    );
    return ids;
  }, [layout]);

  const filteredParams = useMemo(() => {
    const q = paramSearch.trim().toLowerCase();
    return allParams
      .filter(p => !usedParamIds.has(p.id))
      .filter(p =>
        !q ||
        p.label.toLowerCase().includes(q) ||
        p.fieldKey.toLowerCase().includes(q) ||
        (p.shortLabel || "").toLowerCase().includes(q)
      );
  }, [allParams, usedParamIds, paramSearch]);

  // ============================================================
  // Derived
  // ============================================================
  const megaBloky = layout.megaBloky;
  const selectedMegaBlok = megaBloky.find(mb => mb.id === selectedMegaBlokId) ?? null;
  const selectedPanel = selectedMegaBlok?.panely.find(p => p.id === selectedPanelId) ?? null;

  // ============================================================
  // Helpers to mutate layout
  // ============================================================
  const updateLayout = useCallback((updater: (l: BlueprintLayout) => BlueprintLayout) => {
    setLayout(prev => updater(prev));
    setIsDirty(true);
  }, []);

  // ============================================================
  // Save blueprint
  // ============================================================
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (blueprintId) {
        return apiRequest("PUT", `/api/ui-blueprints/${blueprintId}`, { layoutJson: layout }).then(r => r.json());
      } else {
        return apiRequest("POST", "/api/ui-blueprints", {
          type: "SUBJECT",
          targetId: activeCode,
          layoutJson: layout,
        }).then(r => r.json());
      }
    },
    onSuccess: (data: UiBlueprint) => {
      setBlueprintId(data.id);
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ["/api/ui-blueprints/find", activeCode, "SUBJECT"] });
      toast({ title: "Blueprint uložený" });
    },
    onError: () => toast({ title: "Chyba pri ukladaní", variant: "destructive" }),
  });

  // ============================================================
  // Mega-Blok handlers
  // ============================================================
  const handleAddMegaBlok = useCallback(() => {
    if (!newMegaBlokName.trim()) return;
    updateLayout(l => ({
      megaBloky: [
        ...l.megaBloky,
        { id: genId(), name: newMegaBlokName.trim(), sortOrder: l.megaBloky.length, panely: [] },
      ],
    }));
    setNewMegaBlokName("");
    setAddMegaBlokOpen(false);
    toast({ title: "Mega-Blok pridaný" });
  }, [newMegaBlokName, updateLayout, toast]);

  const handleEditMegaBlok = useCallback(() => {
    if (!editMegaBlokName.trim() || !selectedMegaBlokId) return;
    updateLayout(l => ({
      megaBloky: l.megaBloky.map(mb =>
        mb.id === selectedMegaBlokId ? { ...mb, name: editMegaBlokName.trim() } : mb
      ),
    }));
    setEditMegaBlokOpen(false);
    toast({ title: "Mega-Blok premenovaný" });
  }, [editMegaBlokName, selectedMegaBlokId, updateLayout, toast]);

  const handleDeleteMegaBlok = useCallback((id: string) => {
    updateLayout(l => ({
      megaBloky: l.megaBloky.filter(mb => mb.id !== id).map((mb, i) => ({ ...mb, sortOrder: i })),
    }));
    if (selectedMegaBlokId === id) {
      setSelectedMegaBlokId(null);
      setSelectedPanelId(null);
    }
    toast({ title: "Mega-Blok odstránený" });
  }, [selectedMegaBlokId, updateLayout, toast]);

  // ============================================================
  // Panel handlers
  // ============================================================
  const handleAddPanel = useCallback(() => {
    if (!newPanelName.trim() || !selectedMegaBlokId) return;
    updateLayout(l => ({
      megaBloky: l.megaBloky.map(mb =>
        mb.id !== selectedMegaBlokId ? mb : {
          ...mb,
          panely: [...mb.panely, { id: genId(), name: newPanelName.trim(), sortOrder: mb.panely.length, parametre: [] }],
        }
      ),
    }));
    setNewPanelName("");
    setAddPanelOpen(false);
    toast({ title: "Panel pridaný" });
  }, [newPanelName, selectedMegaBlokId, updateLayout, toast]);

  const handleEditPanel = useCallback(() => {
    if (!editPanelName.trim() || !selectedMegaBlokId || !selectedPanelId) return;
    updateLayout(l => ({
      megaBloky: l.megaBloky.map(mb =>
        mb.id !== selectedMegaBlokId ? mb : {
          ...mb,
          panely: mb.panely.map(p => p.id === selectedPanelId ? { ...p, name: editPanelName.trim() } : p),
        }
      ),
    }));
    setEditPanelOpen(false);
    toast({ title: "Panel premenovaný" });
  }, [editPanelName, selectedMegaBlokId, selectedPanelId, updateLayout, toast]);

  const handleDeletePanel = useCallback((mbId: string, panelId: string) => {
    updateLayout(l => ({
      megaBloky: l.megaBloky.map(mb =>
        mb.id !== mbId ? mb : {
          ...mb,
          panely: mb.panely.filter(p => p.id !== panelId).map((p, i) => ({ ...p, sortOrder: i })),
        }
      ),
    }));
    if (selectedPanelId === panelId) setSelectedPanelId(null);
    toast({ title: "Panel odstránený" });
  }, [selectedPanelId, updateLayout, toast]);

  // ============================================================
  // Parameter handlers
  // ============================================================
  const handleAddParams = useCallback(() => {
    if (!selectedParamIds.length || !selectedMegaBlokId || !selectedPanelId) return;
    const paramsToAdd = allParams.filter(p => selectedParamIds.includes(p.id));
    updateLayout(l => ({
      megaBloky: l.megaBloky.map(mb =>
        mb.id !== selectedMegaBlokId ? mb : {
          ...mb,
          panely: mb.panely.map(panel =>
            panel.id !== selectedPanelId ? panel : {
              ...panel,
              parametre: [
                ...panel.parametre,
                ...paramsToAdd.map((p, i) => ({
                  id: genId(),
                  paramId: p.id,
                  label: p.label,
                  fieldType: p.fieldType,
                  width: (paramWidths[p.id] ?? "100%") as "25%" | "50%" | "75%" | "100%",
                  sortOrder: panel.parametre.length + i,
                })),
              ],
            }
          ),
        }
      ),
    }));
    setSelectedParamIds([]);
    setParamWidths({});
    setParamSearch("");
    setAddParamOpen(false);
    toast({ title: `Pridaných ${paramsToAdd.length} parametrov` });
  }, [selectedParamIds, selectedMegaBlokId, selectedPanelId, allParams, paramWidths, updateLayout, toast]);

  const handleRemoveParam = useCallback((mbId: string, panelId: string, paramId: string) => {
    updateLayout(l => ({
      megaBloky: l.megaBloky.map(mb =>
        mb.id !== mbId ? mb : {
          ...mb,
          panely: mb.panely.map(p =>
            p.id !== panelId ? p : {
              ...p,
              parametre: p.parametre.filter(pr => pr.id !== paramId).map((pr, i) => ({ ...pr, sortOrder: i })),
            }
          ),
        }
      ),
    }));
  }, [updateLayout]);

  const handleChangeParamWidth = useCallback((mbId: string, panelId: string, paramId: string, width: "25%" | "50%" | "75%" | "100%") => {
    updateLayout(l => ({
      megaBloky: l.megaBloky.map(mb =>
        mb.id !== mbId ? mb : {
          ...mb,
          panely: mb.panely.map(p =>
            p.id !== panelId ? p : {
              ...p,
              parametre: p.parametre.map(pr => pr.id === paramId ? { ...pr, width } : pr),
            }
          ),
        }
      ),
    }));
  }, [updateLayout]);

  // Drag-and-drop between panels
  const handleDragStart = useCallback((paramId: string, fromPanelId: string) => {
    dragParam.current = { paramId, fromPanelId };
  }, []);

  const handleDropOnPanel = useCallback((mbId: string, toPanelId: string) => {
    if (!dragParam.current) return;
    const { paramId, fromPanelId } = dragParam.current;
    if (fromPanelId === toPanelId) { dragParam.current = null; return; }
    updateLayout(l => {
      let movedParam: BpParameter | undefined;
      const newMegaBloky = l.megaBloky.map(mb =>
        mb.id !== mbId ? mb : {
          ...mb,
          panely: mb.panely.map(p => {
            if (p.id === fromPanelId) {
              const found = p.parametre.find(pr => pr.id === paramId);
              if (found) movedParam = found;
              return { ...p, parametre: p.parametre.filter(pr => pr.id !== paramId).map((pr, i) => ({ ...pr, sortOrder: i })) };
            }
            return p;
          }),
        }
      );
      if (!movedParam) return l;
      return {
        megaBloky: newMegaBloky.map(mb =>
          mb.id !== mbId ? mb : {
            ...mb,
            panely: mb.panely.map(p =>
              p.id !== toPanelId ? p : {
                ...p,
                parametre: [...p.parametre, { ...movedParam!, sortOrder: p.parametre.length }],
              }
            ),
          }
        ),
      };
    });
    dragParam.current = null;
  }, [updateLayout]);

  // ============================================================
  // Switch subject type
  // ============================================================
  const switchType = useCallback((code: string) => {
    if (isDirty) {
      const ok = window.confirm("Máte neuložené zmeny. Prepnúť bez uloženia?");
      if (!ok) return;
    }
    setActiveCode(code);
    setSelectedMegaBlokId(null);
    setSelectedPanelId(null);
    setIsDirty(false);
  }, [isDirty]);

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
          {isDirty && (
            <span className="text-xs text-amber-500 font-medium ml-2">● Neuložené zmeny</span>
          )}
        </div>

        {/* === MAIN AREA === */}
        <div className="flex flex-1 overflow-hidden">
          {/* === CANVAS === */}
          <div className="flex-1 overflow-auto p-6">
            {bpLoading ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Načítavam blueprint...</div>
            ) : megaBloky.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
                <Users className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Žiadne Mega-Bloky pre typ {activeType.label}.</p>
                <p className="text-xs mt-1">Pridajte prvý Mega-Blok (sekciu) z Toolbar-u vpravo.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddMegaBlokOpen(true)} data-testid="button-empty-add-megablok">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Pridať Mega-Blok
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                {megaBloky.map(mb => {
                  const isSelMb = selectedMegaBlokId === mb.id;
                  const panelWarn = mb.panely.length > 6 || (mb.panely.length > 0 && mb.panely.length < 2);
                  return (
                    <div
                      key={mb.id}
                      className={`rounded-lg border-2 transition-all ${isSelMb ? "border-primary" : "border-border"}`}
                      data-testid={`section-block-${mb.id}`}
                    >
                      {/* Mega-Blok header */}
                      <div
                        className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer rounded-t-md ${
                          isSelMb ? "bg-primary/8" : "bg-muted/40 hover:bg-muted/60"
                        }`}
                        onClick={() => {
                          setSelectedMegaBlokId(prev => prev === mb.id ? null : mb.id);
                          setSelectedPanelId(null);
                        }}
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-sm flex-1">{mb.name}</span>
                        <span className="text-xs text-muted-foreground">{mb.panely.length} panelov</span>
                        {panelWarn && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-amber-500 text-xs cursor-help">⚠</span>
                            </TooltipTrigger>
                            <TooltipContent>Odporúčaný počet: 2–6 panelov</TooltipContent>
                          </Tooltip>
                        )}
                        <button
                          onClick={e => {
                            e.stopPropagation();
                            setSelectedMegaBlokId(mb.id);
                            setEditMegaBlokName(mb.name);
                            setEditMegaBlokOpen(true);
                          }}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors"
                          data-testid={`button-edit-section-${mb.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteMegaBlok(mb.id); }}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
                          data-testid={`button-delete-section-${mb.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Panels grid */}
                      <div className="p-4">
                        {mb.panely.length === 0 ? (
                          <div className="flex items-center justify-center h-16 border-2 border-dashed rounded text-muted-foreground/50 text-xs">
                            Žiadne panely — vyberte blok a pridajte panel z Toolbar-u
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {mb.panely.map(panel => {
                              const isPanelSel = selectedPanelId === panel.id;
                              const paramCount = panel.parametre.length;
                              const paramWarn = paramCount > 15 || (paramCount > 0 && paramCount < 5);
                              return (
                                <div
                                  key={panel.id}
                                  className={`border-2 rounded-lg flex flex-col transition-all cursor-pointer ${
                                    isPanelSel ? "border-primary shadow-sm" : "border-border hover:border-muted-foreground/50"
                                  }`}
                                  onClick={() => {
                                    setSelectedMegaBlokId(mb.id);
                                    setSelectedPanelId(prev => prev === panel.id ? null : panel.id);
                                  }}
                                  data-testid={`card-panel-${panel.id}`}
                                  onDragOver={e => e.preventDefault()}
                                  onDrop={() => handleDropOnPanel(mb.id, panel.id)}
                                >
                                  {/* Panel header */}
                                  <div className={`flex items-center gap-2 px-3 py-2 rounded-t-md ${isPanelSel ? "bg-primary/5" : "bg-muted/30"}`}>
                                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                    <span className="text-sm font-medium flex-1 truncate">{panel.name}</span>
                                    {paramWarn && (
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className="text-amber-500 text-xs cursor-help">⚠</span>
                                        </TooltipTrigger>
                                        <TooltipContent>Odporúčaný počet: 5–15 parametrov</TooltipContent>
                                      </Tooltip>
                                    )}
                                    <button
                                      onClick={e => {
                                        e.stopPropagation();
                                        setSelectedMegaBlokId(mb.id);
                                        setSelectedPanelId(panel.id);
                                        setEditPanelName(panel.name);
                                        setEditPanelOpen(true);
                                      }}
                                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors"
                                      data-testid={`button-edit-panel-${panel.id}`}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleDeletePanel(mb.id, panel.id); }}
                                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
                                      data-testid={`button-delete-panel-${panel.id}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>

                                  {/* Parameter list */}
                                  <div className="p-2 flex-1 min-h-[56px]">
                                    {panel.parametre.length === 0 ? (
                                      <div className="flex items-center justify-center h-10 text-muted-foreground/40 text-xs">
                                        Žiadne parametre
                                      </div>
                                    ) : (
                                      <div className="space-y-0.5">
                                        {panel.parametre.map(param => (
                                          <div
                                            key={param.id}
                                            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground group hover:bg-muted/50 cursor-grab active:cursor-grabbing"
                                            draggable
                                            onDragStart={() => handleDragStart(param.id, panel.id)}
                                            data-testid={`param-row-${param.id}`}
                                          >
                                            <GripVertical className="h-3 w-3 flex-shrink-0 opacity-30 group-hover:opacity-70" />
                                            <AlignLeft className="h-3 w-3 flex-shrink-0 opacity-50" />
                                            <span className="flex-1 truncate">{param.label}</span>
                                            <FieldTypeBadge type={param.fieldType} />
                                            <WidthBadge width={param.width} />
                                            {/* Width selector */}
                                            <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                                              {WIDTH_OPTIONS.map(w => (
                                                <button
                                                  key={w}
                                                  onClick={e => {
                                                    e.stopPropagation();
                                                    handleChangeParamWidth(mb.id, panel.id, param.id, w);
                                                  }}
                                                  className={`text-[9px] px-0.5 rounded ${param.width === w ? "bg-primary text-white" : "hover:bg-muted text-muted-foreground"}`}
                                                  title={`Šírka ${w}`}
                                                >
                                                  {w.replace("%", "")}
                                                </button>
                                              ))}
                                            </div>
                                            <button
                                              onClick={e => { e.stopPropagation(); handleRemoveParam(mb.id, panel.id, param.id); }}
                                              className="hidden group-hover:flex h-4 w-4 items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
                                              data-testid={`button-remove-param-${param.id}`}
                                            >
                                              <X className="h-2.5 w-2.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Footer */}
                                  <div className="border-t px-3 py-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <AlignLeft className="h-3 w-3" />
                                    <span>{panel.parametre.length} parametrov</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Add panel button */}
                        <button
                          onClick={() => { setSelectedMegaBlokId(mb.id); setAddPanelOpen(true); }}
                          className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                          data-testid={`button-add-panel-to-section-${mb.id}`}
                        >
                          <Plus className="h-3 w-3" />
                          Pridať panel do tohto bloku
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* === TOOLBAR === */}
          <div className="w-56 border-l bg-card flex-shrink-0 flex flex-col p-4 gap-4 overflow-y-auto">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pridať</p>
              <div className="flex flex-col gap-1.5">
                <Button
                  variant="outline" size="sm" className="justify-start gap-2 h-8"
                  onClick={() => setAddMegaBlokOpen(true)}
                  data-testid="toolbar-add-section"
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Mega-Blok
                </Button>
                <Button
                  variant="outline" size="sm" className="justify-start gap-2 h-8"
                  onClick={() => { if (selectedMegaBlokId) setAddPanelOpen(true); }}
                  disabled={!selectedMegaBlokId}
                  data-testid="toolbar-add-panel"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Panel
                </Button>
                <Button
                  variant="outline" size="sm" className="justify-start gap-2 h-8"
                  onClick={() => { if (selectedPanelId) setAddParamOpen(true); }}
                  disabled={!selectedPanelId}
                  data-testid="toolbar-add-param"
                >
                  <AlignLeft className="h-3.5 w-3.5" />
                  Parameter
                </Button>
              </div>
            </div>

            {/* Anti-Vata */}
            <div>
              <div className="flex items-center gap-1 mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Anti-Vata</p>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p className="font-semibold mb-1">Anti-Vata pravidlo</p>
                    <p>Parametre mimo Blueprint sa v profile subjektu <strong>nezobrazia</strong>. Len explicitne priradené parametre sú viditeľné. Žiadne implicitné zobrazenie.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p>📦 2–6 panelov / blok</p>
                <p>⚙ 5–15 parametrov / panel</p>
                <p>📐 Šírka: 25/50/75/100%</p>
              </div>
              {selectedMegaBlok && (
                <div className="mt-2 text-[11px] space-y-0.5 border-t pt-2">
                  <p className="text-muted-foreground font-medium truncate">{selectedMegaBlok.name}</p>
                  <p className={selectedMegaBlok.panely.length > 6 || (selectedMegaBlok.panely.length > 0 && selectedMegaBlok.panely.length < 2) ? "text-amber-500" : "text-green-600"}>
                    Panely: {selectedMegaBlok.panely.length}
                  </p>
                  {selectedPanel && (
                    <p className={selectedPanel.parametre.length > 15 || (selectedPanel.parametre.length > 0 && selectedPanel.parametre.length < 5) ? "text-amber-500" : "text-green-600"}>
                      Parametre: {selectedPanel.parametre.length}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="border-t pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Súhrn</p>
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p>Mega-Bloky: <span className="text-foreground font-medium">{megaBloky.length}</span></p>
                <p>Panely: <span className="text-foreground font-medium">{megaBloky.reduce((s, mb) => s + mb.panely.length, 0)}</span></p>
                <p>Parametre: <span className="text-foreground font-medium">{megaBloky.reduce((s, mb) => s + mb.panely.reduce((ss, p) => ss + p.parametre.length, 0), 0)}</span></p>
                <p>Dostupné: <span className="text-foreground font-medium">{allParams.length - usedParamIds.size}</span> / {allParams.length}</p>
              </div>
            </div>

            {/* Save */}
            <div className="mt-auto border-t pt-3">
              <Button
                className="w-full gap-2"
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="button-save-blueprint"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Ukladám..." : "Uložiť Blueprint"}
              </Button>
              {blueprintId && (
                <p className="text-[10px] text-muted-foreground text-center mt-1">ID: {blueprintId}</p>
              )}
            </div>
          </div>
        </div>

        {/* === DIALOGS === */}

        {/* Add Mega-Blok */}
        <Dialog open={addMegaBlokOpen} onOpenChange={setAddMegaBlokOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nový Mega-Blok (sekcia)</DialogTitle></DialogHeader>
            <Input
              placeholder="Názov (napr. Identita, Financie, Dokumenty...)"
              value={newMegaBlokName}
              onChange={e => setNewMegaBlokName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddMegaBlok()}
              data-testid="input-new-section-name"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddMegaBlokOpen(false); setNewMegaBlokName(""); }}>Zrušiť</Button>
              <Button onClick={handleAddMegaBlok} disabled={!newMegaBlokName.trim()} data-testid="button-confirm-add-section">Pridať</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Mega-Blok */}
        <Dialog open={editMegaBlokOpen} onOpenChange={setEditMegaBlokOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Premenovať Mega-Blok</DialogTitle></DialogHeader>
            <Input
              value={editMegaBlokName}
              onChange={e => setEditMegaBlokName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleEditMegaBlok()}
              autoFocus
              data-testid="input-edit-section-name"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditMegaBlokOpen(false)}>Zrušiť</Button>
              <Button onClick={handleEditMegaBlok} disabled={!editMegaBlokName.trim()}>Uložiť</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Panel */}
        <Dialog open={addPanelOpen} onOpenChange={setAddPanelOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nový panel v „{selectedMegaBlok?.name}"</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Názov panelu (napr. Osobné údaje, Adresa...)"
              value={newPanelName}
              onChange={e => setNewPanelName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddPanel()}
              autoFocus
              data-testid="input-new-panel-name"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddPanelOpen(false); setNewPanelName(""); }}>Zrušiť</Button>
              <Button onClick={handleAddPanel} disabled={!newPanelName.trim()} data-testid="button-confirm-add-panel">Pridať</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Panel */}
        <Dialog open={editPanelOpen} onOpenChange={setEditPanelOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Premenovať panel</DialogTitle></DialogHeader>
            <Input
              value={editPanelName}
              onChange={e => setEditPanelName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleEditPanel()}
              autoFocus
              data-testid="input-edit-panel-name"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPanelOpen(false)}>Zrušiť</Button>
              <Button onClick={handleEditPanel} disabled={!editPanelName.trim()}>Uložiť</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Parameter */}
        <Dialog open={addParamOpen} onOpenChange={open => { setAddParamOpen(open); if (!open) { setSelectedParamIds([]); setParamWidths({}); setParamSearch(""); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Pridať parametre do panelu „{selectedPanel?.name}"</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {/* Anti-Vata info */}
              <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
                <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <p><strong>Anti-Vata:</strong> Len tu priradené parametre sa zobrazia v profile subjektu. Parametre mimo Blueprint zostanú neviditeľné.</p>
              </div>
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Hľadať parameter..."
                  value={paramSearch}
                  onChange={e => setParamSearch(e.target.value)}
                  className="pl-8"
                  data-testid="input-param-search"
                />
              </div>
              {/* Parameter list */}
              <div className="border rounded-lg overflow-auto max-h-64">
                {filteredParams.length === 0 ? (
                  <div className="flex items-center justify-center h-20 text-muted-foreground/50 text-xs">
                    {paramSearch ? "Žiadne výsledky" : "Všetky parametre sú už priradené"}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredParams.map(param => {
                      const isSelected = selectedParamIds.includes(param.id);
                      const currentWidth = paramWidths[param.id] ?? "100%";
                      return (
                        <div
                          key={param.id}
                          className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/50"}`}
                          onClick={() => {
                            setSelectedParamIds(prev =>
                              prev.includes(param.id) ? prev.filter(id => id !== param.id) : [...prev, param.id]
                            );
                          }}
                          data-testid={`param-option-${param.id}`}
                        >
                          <div className={`h-3.5 w-3.5 rounded border flex-shrink-0 flex items-center justify-center ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                            {isSelected && <span className="text-white text-[8px] leading-none">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{param.label}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{param.fieldKey}</p>
                          </div>
                          <FieldTypeBadge type={param.fieldType} />
                          {/* Width selector */}
                          {isSelected && (
                            <div className="flex items-center gap-0.5" onClick={e => e.stopPropagation()}>
                              {WIDTH_OPTIONS.map(w => (
                                <button
                                  key={w}
                                  onClick={e => {
                                    e.stopPropagation();
                                    setParamWidths(prev => ({ ...prev, [param.id]: w }));
                                  }}
                                  className={`text-[9px] px-1 py-0.5 rounded ${currentWidth === w ? "bg-primary text-white" : "border border-border text-muted-foreground hover:bg-muted"}`}
                                  data-testid={`width-option-${param.id}-${w}`}
                                >
                                  {w}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {selectedParamIds.length > 0 && (
                <p className="text-xs text-muted-foreground">Vybrané: {selectedParamIds.length} parametrov</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddParamOpen(false); setSelectedParamIds([]); setParamWidths({}); setParamSearch(""); }}>Zrušiť</Button>
              <Button
                onClick={handleAddParams}
                disabled={!selectedParamIds.length}
                data-testid="button-confirm-add-params"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Pridať ({selectedParamIds.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
