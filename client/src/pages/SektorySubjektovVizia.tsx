import { useState, useMemo, useEffect } from "react";
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
  Users, LayoutGrid, AlignLeft, Plus, X,
  Layers, FolderOpen, Pencil, Info, Loader2,
} from "lucide-react";
import type { SubjectParamSection, SubjectParameter } from "@shared/schema";

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
  { value: "povinne",    label: "Povinné",      color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-950 dark:text-red-300 dark:border-red-700" },
  { value: "doplnkove",  label: "Doplnkové",    color: "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-700" },
  { value: "volitelne",  label: "Voliteľné",    color: "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700" },
  { value: "ine",        label: "Iné",          color: "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600" },
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

  // Selection
  const [selectedMegaBlokId, setSelectedMegaBlokId] = useState<number | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);

  // Dialogs
  const [addMegaBlokOpen, setAddMegaBlokOpen] = useState(false);
  const [editMegaBlokOpen, setEditMegaBlokOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [editPanelOpen, setEditPanelOpen] = useState(false);

  // Inputs
  const [newMegaBlokName, setNewMegaBlokName] = useState("");
  const [newMegaBlokCategory, setNewMegaBlokCategory] = useState("povinne");
  const [editName, setEditName] = useState("");
  const [newPanelName, setNewPanelName] = useState("");

  // ============================================================
  // Query: sections for current clientType
  // ============================================================
  const sectionsQK = ["/api/subject-param-sections", clientTypeId];
  const { data: allSections = [], isLoading: sectionsLoading } = useQuery<SubjectParamSection[]>({
    queryKey: sectionsQK,
    queryFn: () =>
      apiRequest("GET", `/api/subject-param-sections?clientTypeId=${clientTypeId}`)
        .then(r => r.json()),
  });

  // ============================================================
  // Query: parameters for current clientType (read-only display)
  // ============================================================
  const { data: allParams = [] } = useQuery<SubjectParameter[]>({
    queryKey: ["/api/subject-parameters", clientTypeId],
    queryFn: () =>
      apiRequest("GET", `/api/subject-parameters?clientTypeId=${clientTypeId}`)
        .then(r => r.json()),
  });

  // ============================================================
  // Derived: Mega-Bloky and Panely
  // ============================================================
  const megaBloky = useMemo(
    () => allSections.filter(s => !s.isPanel).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [allSections]
  );

  const getPanely = (megaBlokId: number) =>
    allSections
      .filter(s => s.isPanel && s.parentSectionId === megaBlokId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const getParams = (panelId: number) =>
    allParams
      .filter(p => p.panelId === panelId)
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const selectedMegaBlok = megaBloky.find(mb => mb.id === selectedMegaBlokId) ?? null;
  const selectedPanel = selectedMegaBlok
    ? getPanely(selectedMegaBlok.id).find(p => p.id === selectedPanelId) ?? null
    : null;

  // Total counts
  const totalPanels = useMemo(() => allSections.filter(s => s.isPanel).length, [allSections]);
  const totalParams = useMemo(() => allParams.length, [allParams]);

  // ============================================================
  // Mutations
  // ============================================================
  const invalidate = () => queryClient.invalidateQueries({ queryKey: sectionsQK });

  const createMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await apiRequest("POST", "/api/subject-param-sections", body);
      return r.json();
    },
    onSuccess: () => { invalidate(); },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message || "Nepodarilo sa vytvoriť sekciu.", variant: "destructive" }),
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const r = await apiRequest("PATCH", `/api/subject-param-sections/${id}`, { name });
      return r.json();
    },
    onSuccess: () => { invalidate(); setEditMegaBlokOpen(false); setEditPanelOpen(false); },
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
      if (selectedMegaBlokId === id) { setSelectedMegaBlokId(null); setSelectedPanelId(null); }
      if (selectedPanelId === id) setSelectedPanelId(null);
      invalidate();
    },
    onError: (err: any) => toast({ title: "Chyba", description: err?.message || "Nepodarilo sa vymazať.", variant: "destructive" }),
  });

  // ============================================================
  // Handlers
  // ============================================================
  const handleAddMegaBlok = () => {
    if (!newMegaBlokName.trim()) return;
    createMutation.mutate(
      { name: newMegaBlokName.trim(), clientTypeId, isPanel: false, folderCategory: newMegaBlokCategory },
      {
        onSuccess: () => {
          toast({ title: "Mega-Blok pridaný" });
          setNewMegaBlokName("");
          setNewMegaBlokCategory("povinne");
          setAddMegaBlokOpen(false);
        },
      }
    );
  };

  const handleEditSection = (id: number) => {
    if (!editName.trim()) return;
    renameMutation.mutate(
      { id, name: editName.trim() },
      { onSuccess: () => { toast({ title: "Premenované" }); setEditName(""); } }
    );
  };

  const handleDeleteSection = (id: number, isMegaBlok: boolean) => {
    const label = isMegaBlok ? "Mega-Blok" : "Panel";
    if (!window.confirm(`Naozaj vymazať ${label}?`)) return;
    deleteMutation.mutate(id, {
      onSuccess: () => toast({ title: `${label} vymazaný` }),
    });
  };

  const handleAddPanel = () => {
    if (!newPanelName.trim() || !selectedMegaBlokId || !selectedMegaBlok) return;
    createMutation.mutate(
      {
        name: newPanelName.trim(),
        clientTypeId,
        isPanel: true,
        parentSectionId: selectedMegaBlokId,
        folderCategory: selectedMegaBlok.folderCategory,
      },
      {
        onSuccess: () => {
          toast({ title: "Panel pridaný" });
          setNewPanelName("");
          setAddPanelOpen(false);
        },
      }
    );
  };

  const switchType = (code: string) => {
    setActiveCode(code);
    setSelectedMegaBlokId(null);
    setSelectedPanelId(null);
  };

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
            ) : megaBloky.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
                <Users className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Žiadne Mega-Bloky pre typ {activeType.label}.</p>
                <p className="text-xs mt-1">Pridajte prvý Mega-Blok (sekciu) z Toolbar-u vpravo.</p>
                <Button
                  variant="outline" size="sm" className="mt-3"
                  onClick={() => setAddMegaBlokOpen(true)}
                  data-testid="button-empty-add-megablok"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Pridať Mega-Blok
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                {megaBloky.map(mb => {
                  const isSelMb = selectedMegaBlokId === mb.id;
                  const panely = getPanely(mb.id);
                  const panelWarn = panely.length > 6 || (panely.length > 0 && panely.length < 2);
                  const catStyle = getCategoryStyle(mb.folderCategory);
                  const catLabel = getCategoryLabel(mb.folderCategory);
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
                        <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-semibold text-sm flex-1">{mb.name}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 border ${catStyle}`}
                          data-testid={`badge-category-${mb.id}`}
                        >
                          {catLabel}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{panely.length} panelov</span>
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
                            setEditName(mb.name);
                            setEditMegaBlokOpen(true);
                          }}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors"
                          data-testid={`button-edit-section-${mb.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDeleteSection(mb.id, true); }}
                          className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
                          data-testid={`button-delete-section-${mb.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>

                      {/* Panels grid */}
                      <div className="p-4">
                        {panely.length === 0 ? (
                          <div className="flex items-center justify-center h-16 border-2 border-dashed rounded text-muted-foreground/50 text-xs">
                            Žiadne panely — vyberte blok a pridajte panel z Toolbar-u
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {panely.map(panel => {
                              const isPanelSel = selectedPanelId === panel.id;
                              const params = getParams(panel.id);
                              const paramWarn = params.length > 15 || (params.length > 0 && params.length < 5);
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
                                        setEditName(panel.name);
                                        setEditPanelOpen(true);
                                      }}
                                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors"
                                      data-testid={`button-edit-panel-${panel.id}`}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); handleDeleteSection(panel.id, false); }}
                                      className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
                                      data-testid={`button-delete-panel-${panel.id}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>

                                  {/* Parameter list (read-only) */}
                                  <div className="p-2 flex-1 min-h-[56px]">
                                    {params.length === 0 ? (
                                      <div className="flex items-center justify-center h-10 text-muted-foreground/40 text-xs">
                                        Žiadne parametre
                                      </div>
                                    ) : (
                                      <div className="space-y-0.5">
                                        {params.map(param => (
                                          <div
                                            key={param.id}
                                            className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground"
                                            data-testid={`param-row-${param.id}`}
                                          >
                                            <AlignLeft className="h-3 w-3 flex-shrink-0 opacity-50" />
                                            <span className="flex-1 truncate">{param.label}</span>
                                            <FieldTypeBadge type={param.fieldType} />
                                            {param.isRequired && (
                                              <span className="text-[9px] text-red-500 font-bold">*</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Footer */}
                                  <div className="border-t px-3 py-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                                    <AlignLeft className="h-3 w-3" />
                                    <span>{params.length} parametrov</span>
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
              </div>
            </div>

            {/* Category legend */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Kategórie</p>
              <div className="space-y-1">
                {FOLDER_CATEGORIES.map(cat => (
                  <div key={cat.value} className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-sm border ${cat.color}`} />
                    <span className="text-[11px] text-muted-foreground">{cat.label}</span>
                  </div>
                ))}
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
                    <p>Parametre priradené do panelov sa zobrazia v profile subjektu. Parametre mimo sekcií zostanú neviditeľné.</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p>📦 2–6 panelov / blok</p>
                <p>⚙ 5–15 parametrov / panel</p>
              </div>
              {selectedMegaBlok && (
                <div className="mt-2 text-[11px] space-y-0.5 border-t pt-2">
                  <p className="text-muted-foreground font-medium truncate">{selectedMegaBlok.name}</p>
                  {(() => {
                    const panely = getPanely(selectedMegaBlok.id);
                    return (
                      <p className={panely.length > 6 || (panely.length > 0 && panely.length < 2) ? "text-amber-500" : "text-green-600"}>
                        Panely: {panely.length}
                      </p>
                    );
                  })()}
                  {selectedPanel && (
                    <p className={getParams(selectedPanel.id).length > 15 || (getParams(selectedPanel.id).length > 0 && getParams(selectedPanel.id).length < 5) ? "text-amber-500" : "text-green-600"}>
                      Parametre: {getParams(selectedPanel.id).length}
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
                <p>Panely: <span className="text-foreground font-medium">{totalPanels}</span></p>
                <p>Parametre: <span className="text-foreground font-medium">{totalParams}</span></p>
              </div>
            </div>

            {(createMutation.isPending || renameMutation.isPending || deleteMutation.isPending) && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground border-t pt-3">
                <Loader2 className="h-3 w-3 animate-spin" />
                Ukladám...
              </div>
            )}
          </div>
        </div>

        {/* === DIALOGS === */}

        {/* Add Mega-Blok */}
        <Dialog open={addMegaBlokOpen} onOpenChange={open => { setAddMegaBlokOpen(open); if (!open) { setNewMegaBlokName(""); setNewMegaBlokCategory("povinne"); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Nový Mega-Blok (sekcia)</DialogTitle></DialogHeader>
            <div className="space-y-3 py-1">
              <Input
                placeholder="Názov (napr. Identita, Financie, Dokumenty...)"
                value={newMegaBlokName}
                onChange={e => setNewMegaBlokName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddMegaBlok()}
                data-testid="input-new-section-name"
                autoFocus
              />
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Kategória sekcie</label>
                <Select value={newMegaBlokCategory} onValueChange={setNewMegaBlokCategory}>
                  <SelectTrigger data-testid="select-category" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOLDER_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setAddMegaBlokOpen(false); setNewMegaBlokName(""); setNewMegaBlokCategory("povinne"); }}>Zrušiť</Button>
              <Button
                onClick={handleAddMegaBlok}
                disabled={!newMegaBlokName.trim() || createMutation.isPending}
                data-testid="button-confirm-add-section"
              >
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Pridať
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Mega-Blok */}
        <Dialog open={editMegaBlokOpen} onOpenChange={open => { setEditMegaBlokOpen(open); if (!open) setEditName(""); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Premenovať Mega-Blok</DialogTitle></DialogHeader>
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && selectedMegaBlokId && handleEditSection(selectedMegaBlokId)}
              autoFocus
              data-testid="input-edit-section-name"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditMegaBlokOpen(false)}>Zrušiť</Button>
              <Button
                onClick={() => selectedMegaBlokId && handleEditSection(selectedMegaBlokId)}
                disabled={!editName.trim() || renameMutation.isPending}
              >
                Uložiť
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Panel */}
        <Dialog open={addPanelOpen} onOpenChange={open => { setAddPanelOpen(open); if (!open) setNewPanelName(""); }}>
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
              <Button
                onClick={handleAddPanel}
                disabled={!newPanelName.trim() || createMutation.isPending}
                data-testid="button-confirm-add-panel"
              >
                {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Pridať
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Panel */}
        <Dialog open={editPanelOpen} onOpenChange={open => { setEditPanelOpen(open); if (!open) setEditName(""); }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Premenovať panel</DialogTitle></DialogHeader>
            <Input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && selectedPanelId && handleEditSection(selectedPanelId)}
              autoFocus
              data-testid="input-edit-panel-name"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditPanelOpen(false)}>Zrušiť</Button>
              <Button
                onClick={() => selectedPanelId && handleEditSection(selectedPanelId)}
                disabled={!editName.trim() || renameMutation.isPending}
              >
                Uložiť
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
