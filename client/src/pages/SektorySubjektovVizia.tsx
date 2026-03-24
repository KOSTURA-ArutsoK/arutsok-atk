import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Users, LayoutGrid, AlignLeft, Plus, X, GripVertical,
  Layers, FolderOpen, Pencil,
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
  { value: "povinne",    label: "Povinné",    color: "bg-red-500 text-white" },
  { value: "doplnkove",  label: "Doplnkové",  color: "bg-orange-500 text-white" },
  { value: "volitelne",  label: "Voliteľné",  color: "bg-blue-500 text-white" },
  { value: "ine",        label: "Iné",        color: "bg-slate-400 text-white" },
];

function getCategoryStyle(cat: string) {
  return FOLDER_CATEGORIES.find(c => c.value === cat)?.color ?? "bg-slate-300 text-white";
}
function getCategoryLabel(cat: string) {
  return FOLDER_CATEGORIES.find(c => c.value === cat)?.label ?? cat;
}

function FieldTypeBadge({ type }: { type: string }) {
  const labels: Record<string, string> = {
    text: "Text", number: "Číslo", date: "Dátum", select: "Výber",
    boolean: "Áno/Nie", textarea: "Plocha", email: "Email", phone: "Tel.",
    file: "Súbor", iban: "IBAN", ico: "IČO", percent: "%",
  };
  return (
    <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal border-border text-muted-foreground">
      {labels[type] || type}
    </Badge>
  );
}

// ============================================================
// Main page
// ============================================================
export default function SektorySubjektovVizia() {
  const { toast } = useToast();

  const [activeCode, setActiveCode] = useState("FO");
  const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);

  // Dialogs
  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [editSectionOpen, setEditSectionOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [editPanelOpen, setEditPanelOpen] = useState(false);

  // Inputs
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionCategory, setNewSectionCategory] = useState("povinne");
  const [editSectionName, setEditSectionName] = useState("");
  const [newPanelName, setNewPanelName] = useState("");
  const [editPanelName, setEditPanelName] = useState("");

  const activeType = SUBJECT_TYPES.find(t => t.code === activeCode)!;
  const clientTypeId = activeType.clientTypeId;

  // ============================================================
  // Queries
  // ============================================================
  const { data: allItems = [], isLoading } = useQuery<SubjectParamSection[]>({
    queryKey: ["/api/subject-param-sections", clientTypeId],
    queryFn: () =>
      apiRequest("GET", `/api/subject-param-sections?clientTypeId=${clientTypeId}`)
        .then(r => r.json()),
  });

  const { data: allParams = [] } = useQuery<SubjectParameter[]>({
    queryKey: ["/api/subject-parameters", clientTypeId],
    queryFn: () =>
      apiRequest("GET", `/api/subject-parameters?clientTypeId=${clientTypeId}`)
        .then(r => r.json()),
  });

  // Split into sections and panels
  const sections = useMemo(
    () => allItems.filter(i => !i.isPanel).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [allItems]
  );

  const panelsBySection = useMemo(() => {
    const map = new Map<number, SubjectParamSection[]>();
    allItems.filter(i => i.isPanel && i.parentSectionId).forEach(p => {
      const arr = map.get(p.parentSectionId!) ?? [];
      arr.push(p);
      map.set(p.parentSectionId!, arr);
    });
    // Sort each bucket
    map.forEach((arr, key) => map.set(key, arr.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))));
    return map;
  }, [allItems]);

  const paramsByPanel = useMemo(() => {
    const map = new Map<number, SubjectParameter[]>();
    allParams.filter(p => p.panelId).forEach(p => {
      const arr = map.get(p.panelId!) ?? [];
      arr.push(p);
      map.set(p.panelId!, arr);
    });
    return map;
  }, [allParams]);

  const activeSection = sections.find(s => s.id === selectedSectionId) ?? null;
  const activePanels = selectedSectionId ? (panelsBySection.get(selectedSectionId) ?? []) : [];
  const activePanel = activePanels.find(p => p.id === selectedPanelId) ?? null;
  const activeParamCount = selectedPanelId ? (paramsByPanel.get(selectedPanelId)?.length ?? 0) : 0;

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/subject-param-sections", clientTypeId] });
  }, [clientTypeId]);

  // ============================================================
  // Mutations
  // ============================================================
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiRequest("POST", "/api/subject-param-sections", body).then(r => r.json()),
    onSuccess: invalidate,
    onError: () => toast({ title: "Chyba pri vytváraní", variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, ...body }: { id: number; [k: string]: unknown }) =>
      apiRequest("PATCH", `/api/subject-param-sections/${id}`, body).then(r => r.json()),
    onSuccess: invalidate,
    onError: () => toast({ title: "Chyba pri úprave", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest("DELETE", `/api/subject-param-sections/${id}`),
    onSuccess: invalidate,
    onError: () => toast({ title: "Chyba pri mazaní", variant: "destructive" }),
  });

  // ============================================================
  // Handlers — Sections (Mega-Bloky)
  // ============================================================
  const handleAddSection = useCallback(() => {
    if (!newSectionName.trim()) return;
    createMutation.mutate({
      name: newSectionName.trim(),
      clientTypeId,
      isPanel: false,
      folderCategory: newSectionCategory,
      sortOrder: sections.length,
    }, {
      onSuccess: () => {
        toast({ title: "Mega-Blok pridaný" });
        setNewSectionName("");
        setNewSectionCategory("povinne");
        setAddSectionOpen(false);
      },
    });
  }, [newSectionName, newSectionCategory, clientTypeId, sections.length]);

  const handleEditSection = useCallback(() => {
    if (!editSectionName.trim() || !selectedSectionId) return;
    patchMutation.mutate({ id: selectedSectionId, name: editSectionName.trim() }, {
      onSuccess: () => { toast({ title: "Mega-Blok premenovaný" }); setEditSectionOpen(false); },
    });
  }, [editSectionName, selectedSectionId]);

  const handleDeleteSection = useCallback((id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Mega-Blok odstránený" });
        if (selectedSectionId === id) { setSelectedSectionId(null); setSelectedPanelId(null); }
      },
    });
  }, [selectedSectionId]);

  // ============================================================
  // Handlers — Panels
  // ============================================================
  const handleAddPanel = useCallback(() => {
    if (!newPanelName.trim() || !selectedSectionId) return;
    const parent = sections.find(s => s.id === selectedSectionId);
    createMutation.mutate({
      name: newPanelName.trim(),
      clientTypeId,
      isPanel: true,
      parentSectionId: selectedSectionId,
      folderCategory: parent?.folderCategory ?? "povinne",
      sortOrder: activePanels.length,
    }, {
      onSuccess: () => { toast({ title: "Panel pridaný" }); setNewPanelName(""); setAddPanelOpen(false); },
    });
  }, [newPanelName, selectedSectionId, clientTypeId, sections, activePanels.length]);

  const handleEditPanel = useCallback(() => {
    if (!editPanelName.trim() || !selectedPanelId) return;
    patchMutation.mutate({ id: selectedPanelId, name: editPanelName.trim() }, {
      onSuccess: () => { toast({ title: "Panel premenovaný" }); setEditPanelOpen(false); },
    });
  }, [editPanelName, selectedPanelId]);

  const handleDeletePanel = useCallback((id: number) => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        toast({ title: "Panel odstránený" });
        if (selectedPanelId === id) setSelectedPanelId(null);
      },
    });
  }, [selectedPanelId]);

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="flex flex-col h-full bg-background" data-testid="page-b-vizia">
      {/* === MASTER SWITCHER === */}
      <div className="flex items-center gap-1 px-6 py-3 border-b bg-card flex-shrink-0 flex-wrap">
        <Layers className="h-4 w-4 text-muted-foreground mr-2" />
        <span className="text-sm font-medium text-muted-foreground mr-3">B-Vízia</span>
        {SUBJECT_TYPES.map(st => (
          <button
            key={st.code}
            onClick={() => {
              setActiveCode(st.code);
              setSelectedSectionId(null);
              setSelectedPanelId(null);
            }}
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
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Načítavam...</div>
          ) : sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
              <Users className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">Žiadne Mega-Bloky pre typ {activeType.label}.</p>
              <p className="text-xs mt-1">Pridajte prvý Mega-Blok (sekciu) z Toolbar-u vpravo.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddSectionOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Pridať Mega-Blok
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {sections.map(section => {
                const panels = panelsBySection.get(section.id) ?? [];
                const isSel = selectedSectionId === section.id;
                const panelWarn = panels.length > 6 || (panels.length > 0 && panels.length < 2);
                return (
                  <div
                    key={section.id}
                    className={`rounded-lg border-2 transition-all ${isSel ? "border-primary" : "border-border"}`}
                    data-testid={`section-block-${section.id}`}
                  >
                    {/* Section header */}
                    <div
                      className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer rounded-t-md ${
                        isSel ? "bg-primary/8" : "bg-muted/40 hover:bg-muted/60"
                      }`}
                      onClick={() => {
                        setSelectedSectionId(prev => prev === section.id ? null : section.id);
                        setSelectedPanelId(null);
                      }}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground/40" />
                      <FolderOpen className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold text-sm flex-1">{section.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCategoryStyle(section.folderCategory)}`}>
                        {getCategoryLabel(section.folderCategory)}
                      </span>
                      <span className="text-xs text-muted-foreground">{panels.length} panelov</span>
                      {panelWarn && <span className="text-amber-500 text-xs">⚠</span>}
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedSectionId(section.id);
                          setEditSectionName(section.name);
                          setEditSectionOpen(true);
                        }}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors"
                        data-testid={`button-edit-section-${section.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeleteSection(section.id); }}
                        className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
                        data-testid={`button-delete-section-${section.id}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Panels grid */}
                    <div className="p-4">
                      {panels.length === 0 ? (
                        <div className="flex items-center justify-center h-16 border-2 border-dashed rounded text-muted-foreground/50 text-xs">
                          Žiadne panely — pridajte z Toolbar-u
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {panels.map(panel => {
                            const params = paramsByPanel.get(panel.id) ?? [];
                            const isPanelSel = selectedPanelId === panel.id;
                            const paramWarn = params.length > 15 || (params.length > 0 && params.length < 5);
                            return (
                              <div
                                key={panel.id}
                                className={`border-2 rounded-lg flex flex-col transition-all cursor-pointer ${
                                  isPanelSel ? "border-primary shadow-sm" : "border-border hover:border-muted-foreground/50"
                                }`}
                                onClick={() => {
                                  setSelectedSectionId(section.id);
                                  setSelectedPanelId(prev => prev === panel.id ? null : panel.id);
                                }}
                                data-testid={`card-panel-${panel.id}`}
                              >
                                {/* Panel header */}
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-t-md ${
                                  isPanelSel ? "bg-primary/5" : "bg-muted/30"
                                }`}>
                                  <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                                  <span className="text-sm font-medium flex-1 truncate">{panel.name}</span>
                                  {paramWarn && <span className="text-amber-500 text-xs">⚠</span>}
                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      setSelectedSectionId(section.id);
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
                                    onClick={e => { e.stopPropagation(); handleDeletePanel(panel.id); }}
                                    className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
                                    data-testid={`button-delete-panel-${panel.id}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>

                                {/* Parameter list */}
                                <div className="p-2 flex-1 min-h-[56px]">
                                  {params.length === 0 ? (
                                    <div className="flex items-center justify-center h-10 text-muted-foreground/40 text-xs">
                                      Žiadne parametre
                                    </div>
                                  ) : (
                                    <div className="space-y-0.5">
                                      {params.slice(0, 8).map(param => (
                                        <div
                                          key={param.id}
                                          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground"
                                          data-testid={`param-row-${param.id}`}
                                        >
                                          <AlignLeft className="h-3 w-3 flex-shrink-0 opacity-50" />
                                          <span className="flex-1 truncate">{param.label}</span>
                                          <FieldTypeBadge type={param.fieldType} />
                                          {param.isRequired && (
                                            <span className="text-red-500 text-[10px] font-bold">*</span>
                                          )}
                                        </div>
                                      ))}
                                      {params.length > 8 && (
                                        <div className="text-[10px] text-muted-foreground/50 px-2 py-0.5">
                                          + {params.length - 8} ďalších...
                                        </div>
                                      )}
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
                        onClick={() => { setSelectedSectionId(section.id); setAddPanelOpen(true); }}
                        className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                        data-testid={`button-add-panel-to-section-${section.id}`}
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
                onClick={() => setAddSectionOpen(true)}
                data-testid="toolbar-add-section"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Mega-Blok
              </Button>
              <Button
                variant="outline" size="sm" className="justify-start gap-2 h-8"
                onClick={() => setAddPanelOpen(true)}
                disabled={!selectedSectionId}
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
            <div className="flex flex-col gap-1">
              {FOLDER_CATEGORIES.map(cat => (
                <div key={cat.value} className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${cat.color.split(" ")[0]}`} />
                  <span className="text-[11px] text-muted-foreground">{cat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Anti-Vata info */}
          <div className="mt-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Anti-Vata</p>
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <p>📦 2–6 panelov / blok</p>
              <p>⚙ 5–15 parametrov / panel</p>
            </div>
            {activeSection && (
              <div className="mt-2 text-[11px] space-y-0.5">
                <p className={activePanels.length > 6 || activePanels.length < 2 ? "text-amber-500" : "text-green-600"}>
                  Panely: {activePanels.length}
                </p>
                {activePanel && (
                  <p className={activeParamCount > 15 || (activeParamCount > 0 && activeParamCount < 5) ? "text-amber-500" : "text-green-600"}>
                    Parametre: {activeParamCount}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Súhrn</p>
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <p>Mega-Bloky: <span className="text-foreground font-medium">{sections.length}</span></p>
              <p>Panely: <span className="text-foreground font-medium">{allItems.filter(i => i.isPanel).length}</span></p>
              <p>Parametre: <span className="text-foreground font-medium">{allParams.length}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* === DIALOGS === */}

      {/* Add Mega-Blok */}
      <Dialog open={addSectionOpen} onOpenChange={setAddSectionOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Nový Mega-Blok (sekcia)</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Názov (napr. Identita, Financie...)"
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddSection()}
              data-testid="input-new-section-name"
              autoFocus
            />
            <Select value={newSectionCategory} onValueChange={setNewSectionCategory}>
              <SelectTrigger data-testid="select-section-category">
                <SelectValue placeholder="Kategória" />
              </SelectTrigger>
              <SelectContent>
                {FOLDER_CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddSectionOpen(false); setNewSectionName(""); }}>Zrušiť</Button>
            <Button
              onClick={handleAddSection}
              disabled={!newSectionName.trim() || createMutation.isPending}
              data-testid="button-confirm-add-section"
            >
              Pridať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Mega-Blok */}
      <Dialog open={editSectionOpen} onOpenChange={setEditSectionOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Premenovať Mega-Blok</DialogTitle></DialogHeader>
          <Input
            value={editSectionName}
            onChange={e => setEditSectionName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleEditSection()}
            autoFocus
            data-testid="input-edit-section-name"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSectionOpen(false)}>Zrušiť</Button>
            <Button onClick={handleEditSection} disabled={!editSectionName.trim() || patchMutation.isPending}>
              Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Panel */}
      <Dialog open={addPanelOpen} onOpenChange={setAddPanelOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Nový panel v „{activeSection?.name}"</DialogTitle>
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
              Pridať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Panel */}
      <Dialog open={editPanelOpen} onOpenChange={setEditPanelOpen}>
        <DialogContent size="sm">
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
            <Button onClick={handleEditPanel} disabled={!editPanelName.trim() || patchMutation.isPending}>
              Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
