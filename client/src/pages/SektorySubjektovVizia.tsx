import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Users, LayoutGrid, AlignLeft, Plus, X, GripVertical,
  Layers, FolderOpen, Pencil, Check, SlidersHorizontal,
} from "lucide-react";
import type { Panel, Parameter } from "@shared/schema";

// ============================================================
// Types
// ============================================================
type BpParam = Parameter & { sortOrder: number; width: string };
type BpPanel = Panel & { order: number; parameters: BpParam[] };
type MegaBlock = {
  id: string;
  name: string;
  order: number;
  panels: BpPanel[];
};
type SubjectLayoutJson = { megaBlocks: MegaBlock[] };
type BlueprintRecord = { id: number; type: string; targetId: string; layoutJson: SubjectLayoutJson };

// ============================================================
// Constants
// ============================================================
const SUBJECT_TYPES = [
  { code: "FO",   label: "FO",   full: "Fyzická osoba",                    color: "bg-emerald-600" },
  { code: "PO",   label: "PO",   full: "Právnická osoba",                  color: "bg-blue-600" },
  { code: "SZCO", label: "SZČO", full: "Samostatne zárobkovo činná osoba", color: "bg-violet-600" },
  { code: "VS",   label: "VS",   full: "Verejná správa",                   color: "bg-slate-600" },
  { code: "TS",   label: "TS",   full: "Tretí sektor",                     color: "bg-amber-600" },
  { code: "OS",   label: "OS",   full: "Ostatné subjekty",                 color: "bg-rose-600" },
];

const PARAM_TYPE_LABELS: Record<string, string> = {
  text: "Text", number: "Číslo", date: "Dátum", select: "Výber",
  boolean: "Áno/Nie", textarea: "Plocha", email: "Email", phone: "Tel.",
};

const WIDTH_OPTIONS = [
  { label: "25%", value: "25%" },
  { label: "50%", value: "50%" },
  { label: "75%", value: "75%" },
  { label: "100%", value: "100%" },
];

function ParamTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal border-border text-muted-foreground">
      {PARAM_TYPE_LABELS[type] || type}
    </Badge>
  );
}

function nanoid6() {
  return Math.random().toString(36).slice(2, 8);
}

// ============================================================
// Main page
// ============================================================
export default function SektorySubjektovVizia() {
  const { toast } = useToast();

  // --- State ---
  const [activeType, setActiveType] = useState("FO");
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [selectedParamId, setSelectedParamId] = useState<number | null>(null);

  // --- Dialogs ---
  const [addBlockOpen, setAddBlockOpen] = useState(false);
  const [editBlockOpen, setEditBlockOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [addParamOpen, setAddParamOpen] = useState(false);

  // --- Inputs ---
  const [newBlockName, setNewBlockName] = useState("");
  const [editBlockName, setEditBlockName] = useState("");
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);
  const [selectedParamIds, setSelectedParamIds] = useState<number[]>([]);

  // ============================================================
  // Queries
  // ============================================================
  const { data: allPanels = [] } = useQuery<Panel[]>({ queryKey: ["/api/panels"] });
  const { data: allParams = [] } = useQuery<Parameter[]>({ queryKey: ["/api/parameters"] });

  const { data: blueprint, isLoading: bpLoading, refetch: refetchBp } = useQuery<BlueprintRecord | null>({
    queryKey: ["/api/ui-blueprints/find", activeType],
    queryFn: () =>
      apiRequest("GET", `/api/ui-blueprints/find?type=SUBJECT&targetId=${activeType}`)
        .then(r => r.json()),
    retry: false,
  });

  // ============================================================
  // Derived
  // ============================================================
  const layout: SubjectLayoutJson = useMemo(() => {
    const raw = blueprint?.layoutJson as any;
    if (!raw || !raw.megaBlocks) return { megaBlocks: [] };
    // Enrich panels with full panel/param data from allPanels/allParams
    const enriched: MegaBlock[] = (raw.megaBlocks || []).map((mb: any) => ({
      ...mb,
      panels: (mb.panels || []).map((p: any) => {
        const panel = allPanels.find(pl => pl.id === p.panelId);
        if (!panel) return null;
        const params: BpParam[] = (p.parameters || []).map((pr: any) => {
          const param = allParams.find(pa => pa.id === pr.parameterId);
          return param ? { ...param, sortOrder: pr.order ?? 0, width: pr.width ?? "50%" } : null;
        }).filter(Boolean) as BpParam[];
        params.sort((a, b) => a.sortOrder - b.sortOrder);
        return { ...panel, order: p.order ?? 0, parameters: params } as BpPanel;
      }).filter(Boolean).sort((a: BpPanel, b: BpPanel) => a.order - b.order),
    })).sort((a: MegaBlock, b: MegaBlock) => a.order - b.order);
    return { megaBlocks: enriched };
  }, [blueprint, allPanels, allParams]);

  const activeBlock = layout.megaBlocks.find(mb => mb.id === selectedBlockId) || null;
  const selectedPanel = activeBlock?.panels.find(p => p.id === selectedPanelId) || null;
  const selectedParam = selectedPanel?.parameters.find(p => p.id === selectedParamId) || null;

  // ============================================================
  // Save blueprint helper
  // ============================================================
  const saveBlueprintMutation = useMutation({
    mutationFn: async (newLayout: SubjectLayoutJson) => {
      // Convert enriched back to raw (just IDs + layout data)
      const rawLayout = {
        megaBlocks: newLayout.megaBlocks.map((mb, mbIdx) => ({
          id: mb.id,
          name: mb.name,
          order: mbIdx,
          panels: mb.panels.map((p, pIdx) => ({
            panelId: p.id,
            order: pIdx,
            parameters: p.parameters.map((pr, prIdx) => ({
              parameterId: pr.id,
              order: prIdx,
              width: pr.width,
            })),
          })),
        })),
      };

      if (blueprint?.id) {
        return apiRequest("PUT", `/api/ui-blueprints/${blueprint.id}`, { layoutJson: rawLayout }).then(r => r.json());
      } else {
        return apiRequest("POST", "/api/ui-blueprints", {
          type: "SUBJECT", targetId: activeType, layoutJson: rawLayout,
        }).then(r => r.json());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ui-blueprints/find", activeType] });
      refetchBp();
    },
    onError: () => toast({ title: "Chyba pri ukladaní", variant: "destructive" }),
  });

  // ============================================================
  // CRUD helpers - all mutate the layoutJson
  // ============================================================

  function cloneLayout(): MegaBlock[] {
    return JSON.parse(JSON.stringify(layout.megaBlocks));
  }

  const handleAddBlock = useCallback(() => {
    if (!newBlockName.trim()) return;
    const blocks = cloneLayout();
    blocks.push({ id: `block-${nanoid6()}`, name: newBlockName.trim(), order: blocks.length, panels: [] });
    saveBlueprintMutation.mutate({ megaBlocks: blocks });
    setNewBlockName("");
    setAddBlockOpen(false);
    toast({ title: "Mega-Blok pridaný" });
  }, [newBlockName, layout]);

  const handleEditBlock = useCallback(() => {
    if (!editBlockName.trim() || !selectedBlockId) return;
    const blocks = cloneLayout();
    const mb = blocks.find(b => b.id === selectedBlockId);
    if (mb) mb.name = editBlockName.trim();
    saveBlueprintMutation.mutate({ megaBlocks: blocks });
    setEditBlockOpen(false);
    toast({ title: "Mega-Blok premenovaný" });
  }, [editBlockName, selectedBlockId, layout]);

  const handleRemoveBlock = useCallback((blockId: string) => {
    const blocks = cloneLayout().filter(b => b.id !== blockId);
    saveBlueprintMutation.mutate({ megaBlocks: blocks });
    if (selectedBlockId === blockId) { setSelectedBlockId(null); setSelectedPanelId(null); setSelectedParamId(null); }
    toast({ title: "Mega-Blok odstránený" });
  }, [selectedBlockId, layout]);

  const handleAddPanels = useCallback((panelIds: number[]) => {
    if (!selectedBlockId) return;
    const blocks = cloneLayout();
    const mb = blocks.find(b => b.id === selectedBlockId);
    if (!mb) return;
    panelIds.forEach(pid => {
      if (!mb.panels.find((p: any) => p.panelId === pid || p.id === pid)) {
        const panel = allPanels.find(p => p.id === pid);
        if (panel) mb.panels.push({ ...panel, order: mb.panels.length, parameters: [] });
      }
    });
    saveBlueprintMutation.mutate({ megaBlocks: blocks });
    setAddPanelOpen(false);
    setSelectedPanelIds([]);
    toast({ title: "Panely pridané" });
  }, [selectedBlockId, layout, allPanels]);

  const handleRemovePanel = useCallback((blockId: string, panelId: number) => {
    const blocks = cloneLayout();
    const mb = blocks.find(b => b.id === blockId);
    if (!mb) return;
    mb.panels = mb.panels.filter((p: any) => (p.id ?? p.panelId) !== panelId);
    saveBlueprintMutation.mutate({ megaBlocks: blocks });
    if (selectedPanelId === panelId) { setSelectedPanelId(null); setSelectedParamId(null); }
    toast({ title: "Panel odstránený" });
  }, [selectedPanelId, layout]);

  const handleAddParams = useCallback((paramIds: number[]) => {
    if (!selectedBlockId || !selectedPanelId) return;
    const blocks = cloneLayout();
    const mb = blocks.find(b => b.id === selectedBlockId);
    if (!mb) return;
    const panel = mb.panels.find((p: any) => (p.id ?? p.panelId) === selectedPanelId);
    if (!panel) return;
    if (!panel.parameters) panel.parameters = [];
    paramIds.forEach(pid => {
      if (!panel.parameters.find((p: any) => p.id === pid || p.parameterId === pid)) {
        const param = allParams.find(p => p.id === pid);
        if (param) panel.parameters.push({ ...param, sortOrder: panel.parameters.length, width: "50%" });
      }
    });
    saveBlueprintMutation.mutate({ megaBlocks: blocks });
    setAddParamOpen(false);
    setSelectedParamIds([]);
    toast({ title: "Parametre pridané" });
  }, [selectedBlockId, selectedPanelId, layout, allParams]);

  const handleRemoveParam = useCallback((blockId: string, panelId: number, paramId: number) => {
    const blocks = cloneLayout();
    const mb = blocks.find(b => b.id === blockId);
    if (!mb) return;
    const panel = mb.panels.find((p: any) => (p.id ?? p.panelId) === panelId);
    if (!panel) return;
    panel.parameters = (panel.parameters || []).filter((p: any) => (p.id ?? p.parameterId) !== paramId);
    saveBlueprintMutation.mutate({ megaBlocks: blocks });
    if (selectedParamId === paramId) setSelectedParamId(null);
    toast({ title: "Parameter odstránený" });
  }, [selectedParamId, layout]);

  const handleWidthChange = useCallback((blockId: string, panelId: number, paramId: number, width: string) => {
    const blocks = cloneLayout();
    const mb = blocks.find(b => b.id === blockId);
    if (!mb) return;
    const panel = mb.panels.find((p: any) => (p.id ?? p.panelId) === panelId);
    if (!panel) return;
    const param = (panel.parameters || []).find((p: any) => (p.id ?? p.parameterId) === paramId);
    if (!param) return;
    param.width = width;
    saveBlueprintMutation.mutate({ megaBlocks: blocks });
  }, [layout]);

  // ============================================================
  // Available items (not yet assigned)
  // ============================================================
  const assignedPanelIds = useMemo(() => {
    const ids = new Set<number>();
    layout.megaBlocks.forEach(mb => mb.panels.forEach(p => ids.add(p.id)));
    return ids;
  }, [layout]);

  const availablePanels = allPanels.filter(p => !assignedPanelIds.has(p.id));
  const assignedParamIdsInPanel = useMemo(() =>
    new Set(selectedPanel?.parameters.map(p => p.id) || []), [selectedPanel]);
  const availableParams = allParams.filter(p => !assignedParamIdsInPanel.has(p.id));

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
              setActiveType(st.code);
              setSelectedBlockId(null);
              setSelectedPanelId(null);
              setSelectedParamId(null);
            }}
            data-testid={`switcher-${st.code}`}
            title={st.full}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-all border ${
              activeType === st.code
                ? `${st.color} text-white border-transparent`
                : "border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
            }`}
          >
            {st.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {SUBJECT_TYPES.find(s => s.code === activeType)?.full}
        </span>
      </div>

      {/* === MAIN AREA === */}
      <div className="flex flex-1 overflow-hidden">
        {/* === CANVAS === */}
        <div className="flex-1 overflow-auto p-6">
          {bpLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">Načítavam...</div>
          ) : layout.megaBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground border-2 border-dashed rounded-lg">
              <Users className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm">Žiadne Mega-Bloky pre typ {activeType}.</p>
              <p className="text-xs mt-1">Pridajte prvý Mega-Blok (sekciu) z Toolbar-u vpravo.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddBlockOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Pridať Mega-Blok
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {layout.megaBlocks.map(mb => (
                <MegaBlockSection
                  key={mb.id}
                  block={mb}
                  isSelected={selectedBlockId === mb.id}
                  selectedPanelId={selectedPanelId}
                  selectedParamId={selectedParamId}
                  onSelectBlock={() => {
                    setSelectedBlockId(prev => prev === mb.id ? null : mb.id);
                    setSelectedPanelId(null);
                    setSelectedParamId(null);
                  }}
                  onEditBlock={() => { setSelectedBlockId(mb.id); setEditBlockName(mb.name); setEditBlockOpen(true); }}
                  onRemoveBlock={() => handleRemoveBlock(mb.id)}
                  onSelectPanel={(pid) => { setSelectedBlockId(mb.id); setSelectedPanelId(prev => prev === pid ? null : pid); setSelectedParamId(null); }}
                  onSelectParam={(pid) => { setSelectedParamId(prev => prev === pid ? null : pid); }}
                  onRemovePanel={(pid) => handleRemovePanel(mb.id, pid)}
                  onRemoveParam={(panelId, paramId) => handleRemoveParam(mb.id, panelId, paramId)}
                  onAddPanels={() => { setSelectedBlockId(mb.id); setAddPanelOpen(true); }}
                  onAddParams={(pid) => { setSelectedBlockId(mb.id); setSelectedPanelId(pid); setAddParamOpen(true); }}
                />
              ))}
            </div>
          )}
        </div>

        {/* === TOOLBAR === */}
        <div className="w-56 border-l bg-card flex-shrink-0 flex flex-col p-4 gap-4 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pridať</p>
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" size="sm" className="justify-start gap-2 h-8" onClick={() => setAddBlockOpen(true)} data-testid="toolbar-add-block">
                <FolderOpen className="h-3.5 w-3.5" />
                Mega-Blok
              </Button>
              <Button variant="outline" size="sm" className="justify-start gap-2 h-8" onClick={() => setAddPanelOpen(true)} disabled={!selectedBlockId} data-testid="toolbar-add-panel">
                <LayoutGrid className="h-3.5 w-3.5" />
                Panel
              </Button>
              <Button variant="outline" size="sm" className="justify-start gap-2 h-8" onClick={() => setAddParamOpen(true)} disabled={!selectedPanelId} data-testid="toolbar-add-param">
                <AlignLeft className="h-3.5 w-3.5" />
                Parameter
              </Button>
            </div>
          </div>

          {/* Width selector for selected parameter */}
          {selectedParamId && selectedPanelId && selectedBlockId && selectedParam && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Šírka poľa</p>
              <div className="grid grid-cols-2 gap-1">
                {WIDTH_OPTIONS.map(opt => {
                  const isActive = selectedParam?.width === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleWidthChange(selectedBlockId, selectedPanelId, selectedParamId, opt.value)}
                      data-testid={`width-option-${opt.value}`}
                      className={`px-2 py-1.5 text-xs rounded border transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary hover:text-primary"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Anti-Vata info */}
          <div className="mt-auto">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Anti-Vata</p>
            <div className="text-[11px] text-muted-foreground space-y-0.5">
              <p>📦 2–6 panelov / blok</p>
              <p>⚙ 5–15 parametrov / panel</p>
            </div>
            {selectedBlockId && activeBlock && (
              <div className="mt-2 text-[11px] space-y-0.5">
                <p className={activeBlock.panels.length > 6 || activeBlock.panels.length < 2 ? "text-amber-500" : "text-green-600"}>
                  Panely: {activeBlock.panels.length}
                </p>
                {selectedPanel && (
                  <p className={selectedPanel.parameters.length > 15 || selectedPanel.parameters.length < 5 ? "text-amber-500" : "text-green-600"}>
                    Parametre: {selectedPanel.parameters.length}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* === DIALOGS === */}

      {/* Add Mega-Blok */}
      <Dialog open={addBlockOpen} onOpenChange={setAddBlockOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Nový Mega-Blok (sekcia)</DialogTitle></DialogHeader>
          <Input
            placeholder="Názov (napr. Identita, Financie...)"
            value={newBlockName}
            onChange={e => setNewBlockName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddBlock()}
            data-testid="input-new-block-name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddBlockOpen(false); setNewBlockName(""); }}>Zrušiť</Button>
            <Button onClick={handleAddBlock} disabled={!newBlockName.trim() || saveBlueprintMutation.isPending} data-testid="button-confirm-add-block">
              Pridať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Mega-Blok name */}
      <Dialog open={editBlockOpen} onOpenChange={setEditBlockOpen}>
        <DialogContent size="sm">
          <DialogHeader><DialogTitle>Premenovať Mega-Blok</DialogTitle></DialogHeader>
          <Input
            value={editBlockName}
            onChange={e => setEditBlockName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleEditBlock()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBlockOpen(false)}>Zrušiť</Button>
            <Button onClick={handleEditBlock} disabled={!editBlockName.trim() || saveBlueprintMutation.isPending}>
              Uložiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add panels */}
      <Dialog open={addPanelOpen} onOpenChange={setAddPanelOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Pridať panely do „{activeBlock?.name}"</DialogTitle>
          </DialogHeader>
          {availablePanels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Všetky dostupné panely sú už priradené.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {availablePanels.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer" data-testid={`checkbox-panel-${p.id}`}>
                  <Checkbox
                    checked={selectedPanelIds.includes(p.id)}
                    onCheckedChange={checked =>
                      setSelectedPanelIds(prev => checked ? [...prev, p.id] : prev.filter(id => id !== p.id))
                    }
                  />
                  <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{p.name}</span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddPanelOpen(false); setSelectedPanelIds([]); }}>Zrušiť</Button>
            <Button
              onClick={() => handleAddPanels(selectedPanelIds)}
              disabled={selectedPanelIds.length === 0 || saveBlueprintMutation.isPending}
              data-testid="button-confirm-add-panels"
            >
              Pridať ({selectedPanelIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add parameters */}
      <Dialog open={addParamOpen} onOpenChange={setAddParamOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Pridať parametre do „{selectedPanel?.name}"</DialogTitle>
          </DialogHeader>
          {availableParams.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Žiadne dostupné parametre.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {availableParams.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer" data-testid={`checkbox-param-${p.id}`}>
                  <Checkbox
                    checked={selectedParamIds.includes(p.id)}
                    onCheckedChange={checked =>
                      setSelectedParamIds(prev => checked ? [...prev, p.id] : prev.filter(id => id !== p.id))
                    }
                  />
                  <span className="text-sm flex-1">{p.name}</span>
                  <ParamTypeBadge type={p.paramType} />
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddParamOpen(false); setSelectedParamIds([]); }}>Zrušiť</Button>
            <Button
              onClick={() => handleAddParams(selectedParamIds)}
              disabled={selectedParamIds.length === 0 || saveBlueprintMutation.isPending}
              data-testid="button-confirm-add-params"
            >
              Pridať ({selectedParamIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================
// MegaBlock Section Component
// ============================================================
interface MegaBlockSectionProps {
  block: MegaBlock;
  isSelected: boolean;
  selectedPanelId: number | null;
  selectedParamId: number | null;
  onSelectBlock: () => void;
  onEditBlock: () => void;
  onRemoveBlock: () => void;
  onSelectPanel: (id: number) => void;
  onSelectParam: (id: number) => void;
  onRemovePanel: (id: number) => void;
  onRemoveParam: (panelId: number, paramId: number) => void;
  onAddPanels: () => void;
  onAddParams: (panelId: number) => void;
}

function MegaBlockSection({
  block, isSelected, selectedPanelId, selectedParamId,
  onSelectBlock, onEditBlock, onRemoveBlock,
  onSelectPanel, onSelectParam, onRemovePanel, onRemoveParam,
  onAddPanels, onAddParams,
}: MegaBlockSectionProps) {
  const panelWarning = block.panels.length > 6 || (block.panels.length > 0 && block.panels.length < 2);

  return (
    <div className={`rounded-lg border-2 transition-all ${isSelected ? "border-primary" : "border-border"}`}>
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 cursor-pointer rounded-t-md ${
          isSelected ? "bg-primary/8" : "bg-muted/40 hover:bg-muted/60"
        }`}
        onClick={onSelectBlock}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/40" />
        <FolderOpen className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-sm flex-1">{block.name}</span>
        <span className="text-xs text-muted-foreground">{block.panels.length} panelov</span>
        {panelWarning && <span className="text-amber-500 text-xs">⚠</span>}
        <button
          onClick={e => { e.stopPropagation(); onEditBlock(); }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-muted text-muted-foreground/50 hover:text-foreground transition-colors"
          data-testid={`button-edit-block-${block.id}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onRemoveBlock(); }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
          data-testid={`button-remove-block-${block.id}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Panels grid */}
      <div className="p-4">
        {block.panels.length === 0 ? (
          <div className="flex items-center justify-center h-20 border-2 border-dashed rounded text-muted-foreground/50 text-xs">
            Žiadne panely — pridajte z Toolbar-u
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {block.panels.map(panel => (
              <BPanelCard
                key={panel.id}
                panel={panel}
                blockId={block.id}
                isSelected={selectedPanelId === panel.id}
                selectedParamId={selectedParamId}
                onSelectPanel={() => onSelectPanel(panel.id)}
                onSelectParam={onSelectParam}
                onRemovePanel={() => onRemovePanel(panel.id)}
                onRemoveParam={(paramId) => onRemoveParam(panel.id, paramId)}
                onAddParams={() => onAddParams(panel.id)}
              />
            ))}
          </div>
        )}
        {/* Add panel button */}
        <button
          onClick={onAddPanels}
          className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
          data-testid={`button-add-panel-to-block-${block.id}`}
        >
          <Plus className="h-3 w-3" />
          Pridať panel do tohto bloku
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Panel Card Component (B-Vízia)
// ============================================================
interface BPanelCardProps {
  panel: BpPanel;
  blockId: string;
  isSelected: boolean;
  selectedParamId: number | null;
  onSelectPanel: () => void;
  onSelectParam: (id: number) => void;
  onRemovePanel: () => void;
  onRemoveParam: (id: number) => void;
  onAddParams: () => void;
}

function BPanelCard({
  panel, blockId, isSelected, selectedParamId,
  onSelectPanel, onSelectParam, onRemovePanel, onRemoveParam, onAddParams,
}: BPanelCardProps) {
  const paramWarning = panel.parameters.length > 15 || (panel.parameters.length > 0 && panel.parameters.length < 5);

  return (
    <div
      className={`border-2 rounded-lg flex flex-col transition-all ${
        isSelected ? "border-primary shadow-sm" : "border-border hover:border-muted-foreground/50"
      }`}
      data-testid={`card-panel-${panel.id}`}
    >
      {/* Panel header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-t-md ${
          isSelected ? "bg-primary/5" : "bg-muted/30 hover:bg-muted/50"
        }`}
        onClick={onSelectPanel}
      >
        <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium flex-1 truncate">{panel.name}</span>
        {paramWarning && <span className="text-amber-500 text-xs">⚠</span>}
        <button
          onClick={e => { e.stopPropagation(); onRemovePanel(); }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
          data-testid={`button-remove-panel-${panel.id}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Parameters */}
      <div className="p-2 flex-1 min-h-[64px]">
        {panel.parameters.length === 0 ? (
          <div className="flex items-center justify-center h-12 text-muted-foreground/40 text-xs">
            Žiadne parametre
          </div>
        ) : (
          <div className="space-y-0.5">
            {panel.parameters.map(param => (
              <div
                key={param.id}
                onClick={() => onSelectParam(param.id)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-xs transition-colors group ${
                  selectedParamId === param.id
                    ? "bg-primary/10 text-foreground"
                    : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`param-row-${param.id}`}
              >
                <span className="flex-1 truncate">{param.name}</span>
                <ParamTypeBadge type={param.paramType} />
                <span className="text-[10px] text-muted-foreground/60 w-8 text-right">{param.width}</span>
                <button
                  onClick={e => { e.stopPropagation(); onRemoveParam(param.id); }}
                  className="h-4 w-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                  data-testid={`button-remove-param-${param.id}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add params footer */}
      <div className="border-t px-3 py-1.5">
        <button
          onClick={onAddParams}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors w-full"
          data-testid={`button-add-params-to-panel-${panel.id}`}
        >
          <Plus className="h-3 w-3" />
          Pridať parameter
        </button>
      </div>
    </div>
  );
}
