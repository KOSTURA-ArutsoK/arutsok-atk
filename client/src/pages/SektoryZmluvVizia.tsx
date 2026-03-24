import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, Layers, FolderOpen, LayoutGrid, SlidersHorizontal, Copy, Plus, X, AlignLeft, GripVertical } from "lucide-react";
import type { Sector, Section, SectorProduct, ContractFolder, Panel, Parameter } from "@shared/schema";

// --- Type for the full blueprint response ---
type BpParameter = Parameter & { sortOrder: number; width: string };
type BpPanel = Panel & { sortOrder: number; gridColumns: number; parameters: BpParameter[] };
type BpFolder = ContractFolder & { sortOrder: number; panels: BpPanel[] };
type FullBlueprint = { folders: BpFolder[]; blueprintId: number | null };

// --- Width options ---
const WIDTH_OPTIONS = [
  { label: "25%", value: "25%" },
  { label: "50%", value: "50%" },
  { label: "75%", value: "75%" },
  { label: "100%", value: "100%" },
];

const PARAM_TYPE_LABELS: Record<string, string> = {
  text: "Text", number: "Číslo", date: "Dátum", select: "Výber",
  boolean: "Áno/Nie", textarea: "Plocha", email: "Email", phone: "Tel.",
};

function ParamTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal border-border text-muted-foreground">
      {PARAM_TYPE_LABELS[type] || type}
    </Badge>
  );
}

// --- Density warnings ---
function getDensityWarning(count: number, min: number, max: number, label: string): string | null {
  if (count > max) return `Vata! ${label} má ${count} položiek (max. odporúčaných ${max}).`;
  if (count < min && count > 0) return `Málo ${label.toLowerCase()}í (min. odporúčaných ${min}).`;
  return null;
}

export default function SektoryZmluvVizia() {
  const { toast } = useToast();

  // --- Navigation state ---
  const [sectorId, setSectorId] = useState<string>("none");
  const [sectionId, setSectionId] = useState<string>("none");
  const [productId, setProductId] = useState<string>("none");
  const [activeFolderIdx, setActiveFolderIdx] = useState(0);

  // --- Selected items for toolbar ---
  const [selectedPanelId, setSelectedPanelId] = useState<number | null>(null);
  const [selectedParamId, setSelectedParamId] = useState<number | null>(null);

  // --- Dialog states ---
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const [addPanelOpen, setAddPanelOpen] = useState(false);
  const [addParamOpen, setAddParamOpen] = useState(false);
  const [cloneOpen, setCloneOpen] = useState(false);

  // --- Multi-select for dialogs ---
  const [selectedFolderIds, setSelectedFolderIds] = useState<number[]>([]);
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);
  const [selectedParamIds, setSelectedParamIds] = useState<number[]>([]);
  const [cloneTargetProductId, setCloneTargetProductId] = useState<string>("none");

  // === QUERIES ===
  const { data: sectors = [] } = useQuery<Sector[]>({ queryKey: ["/api/sectors"] });
  const { data: sections = [] } = useQuery<Section[]>({ queryKey: ["/api/sections"] });
  const { data: sectorProducts = [] } = useQuery<SectorProduct[]>({ queryKey: ["/api/sector-products"] });
  const { data: allFolders = [] } = useQuery<ContractFolder[]>({ queryKey: ["/api/contract-folders"] });
  const { data: allPanels = [] } = useQuery<Panel[]>({ queryKey: ["/api/panels"] });
  const { data: allParams = [] } = useQuery<Parameter[]>({ queryKey: ["/api/parameters"] });

  const selProductId = productId !== "none" ? Number(productId) : null;

  const { data: blueprint, isLoading: bpLoading } = useQuery<FullBlueprint>({
    queryKey: ["/api/sector-products", selProductId, "full-blueprint"],
    queryFn: () => apiRequest("GET", `/api/sector-products/${selProductId}/full-blueprint`).then(r => r.json()),
    enabled: !!selProductId,
  });

  // --- Filtered navigation ---
  const filteredSections = useMemo(() =>
    sections.filter(s => s.sectorId === Number(sectorId)), [sections, sectorId]);
  const filteredProducts = useMemo(() =>
    sectorProducts.filter(p => p.sectionId === Number(sectionId)), [sectorProducts, sectionId]);

  // --- Active folder ---
  const folders = blueprint?.folders || [];
  const activeFolder = folders[activeFolderIdx] || null;

  // --- Breadcrumb ---
  const selSector = sectors.find(s => s.id === Number(sectorId));
  const selSection = sections.find(s => s.id === Number(sectionId));
  const selProduct = sectorProducts.find(p => p.id === selProductId);

  // === MUTATIONS ===

  // Update parameter width in blueprint
  const updateWidthMutation = useMutation({
    mutationFn: async ({ folderId, panelId, parameterId, width }: { folderId: number; panelId: number; parameterId: number; width: string }) => {
      const bp = blueprint;
      if (!selProductId) return;

      const existingBpId = bp?.blueprintId;
      const layoutJson = buildUpdatedLayoutJson(bp, folderId, panelId, parameterId, width);

      if (existingBpId) {
        return apiRequest("PUT", `/api/ui-blueprints/${existingBpId}`, { layoutJson }).then(r => r.json());
      } else {
        return apiRequest("POST", "/api/ui-blueprints", {
          type: "PRODUCT", targetId: String(selProductId), layoutJson,
        }).then(r => r.json());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selProductId, "full-blueprint"] });
    },
  });

  // Add folders to product
  const addFoldersMutation = useMutation({
    mutationFn: async (folderIds: number[]) => {
      const currentFolderIds = folders.map(f => f.id);
      const newIds = [...new Set([...currentFolderIds, ...folderIds])];
      const assignments = newIds.map((fid, idx) => ({ folderId: fid, sortOrder: idx }));
      return apiRequest("PUT", `/api/sector-products/${selProductId}/folders`, { assignments }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selProductId, "full-blueprint"] });
      setAddFolderOpen(false);
      setSelectedFolderIds([]);
      toast({ title: "Priečinky pridané" });
    },
  });

  // Remove folder from product
  const removeFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      const remaining = folders.filter(f => f.id !== folderId).map((f, idx) => ({ folderId: f.id, sortOrder: idx }));
      return apiRequest("PUT", `/api/sector-products/${selProductId}/folders`, { assignments: remaining }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selProductId, "full-blueprint"] });
      setActiveFolderIdx(0);
      toast({ title: "Priečinok odstránený" });
    },
  });

  // Add panels to folder
  const addPanelsMutation = useMutation({
    mutationFn: async (panelIds: number[]) => {
      if (!activeFolder) return;
      const currentPanelIds = activeFolder.panels.map(p => p.id);
      const newIds = [...new Set([...currentPanelIds, ...panelIds])];
      const assignments = newIds.map(pid => ({ panelId: pid, gridColumns: 1 }));
      return apiRequest("PUT", `/api/contract-folders/${activeFolder.id}/panels`, { assignments }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selProductId, "full-blueprint"] });
      setAddPanelOpen(false);
      setSelectedPanelIds([]);
      toast({ title: "Panely pridané" });
    },
  });

  // Remove panel from folder
  const removePanelMutation = useMutation({
    mutationFn: async ({ folderId, panelId }: { folderId: number; panelId: number }) => {
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;
      const remaining = folder.panels.filter(p => p.id !== panelId).map(p => ({ panelId: p.id, gridColumns: p.gridColumns }));
      return apiRequest("PUT", `/api/contract-folders/${folderId}/panels`, { assignments: remaining }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selProductId, "full-blueprint"] });
      setSelectedPanelId(null);
      toast({ title: "Panel odstránený" });
    },
  });

  // Add parameters to panel
  const addParamsMutation = useMutation({
    mutationFn: async ({ panelId, paramIds }: { panelId: number; paramIds: number[] }) => {
      const panel = activeFolder?.panels.find(p => p.id === panelId);
      const currentParamIds = panel?.parameters.map(p => p.id) || [];
      const newIds = [...new Set([...currentParamIds, ...paramIds])];
      const assignments = newIds.map((pid, idx) => ({ parameterId: pid, sortOrder: idx }));
      return apiRequest("PUT", `/api/panels/${panelId}/parameters`, { assignments }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selProductId, "full-blueprint"] });
      setAddParamOpen(false);
      setSelectedParamIds([]);
      toast({ title: "Parametre pridané" });
    },
  });

  // Remove parameter from panel
  const removeParamMutation = useMutation({
    mutationFn: async ({ panelId, parameterId }: { panelId: number; parameterId: number }) => {
      const panel = activeFolder?.panels.find(p => p.id === panelId);
      if (!panel) return;
      const remaining = panel.parameters.filter(p => p.id !== parameterId).map((p, idx) => ({ parameterId: p.id, sortOrder: idx }));
      return apiRequest("PUT", `/api/panels/${panelId}/parameters`, { assignments: remaining }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selProductId, "full-blueprint"] });
      setSelectedParamId(null);
      toast({ title: "Parameter odstránený" });
    },
  });

  // Clone blueprint
  const cloneMutation = useMutation({
    mutationFn: async (targetProductId: number) => {
      const bpId = blueprint?.blueprintId;
      if (bpId) {
        return apiRequest("POST", `/api/ui-blueprints/${bpId}/clone`, { newTargetId: String(targetProductId) }).then(r => r.json());
      }
      // Clone without blueprint (just copy folder assignments)
      const folderAssignments = folders.map((f, idx) => ({ folderId: f.id, sortOrder: idx }));
      return apiRequest("PUT", `/api/sector-products/${targetProductId}/folders`, { assignments: folderAssignments }).then(r => r.json());
    },
    onSuccess: () => {
      setCloneOpen(false);
      setCloneTargetProductId("none");
      toast({ title: "Produkt naklonovaný", description: "Šablóna bola skopírovaná na cieľový produkt." });
    },
  });

  // === HELPERS ===
  function buildUpdatedLayoutJson(bp: FullBlueprint | undefined, folderId: number, panelId: number, parameterId: number, width: string) {
    const existing = (bp?.folders || []).map(f => ({
      folderId: f.id,
      panels: f.panels.map(p => ({
        panelId: p.id,
        parameters: p.parameters.map(pr => ({
          parameterId: pr.id,
          width: (pr.id === parameterId && p.id === panelId && f.id === folderId) ? width : (pr.width || "50%"),
        })),
      })),
    }));
    return { folders: existing };
  }

  const handleSectorChange = useCallback((val: string) => {
    setSectorId(val); setSectionId("none"); setProductId("none"); setActiveFolderIdx(0);
  }, []);
  const handleSectionChange = useCallback((val: string) => {
    setSectionId(val); setProductId("none"); setActiveFolderIdx(0);
  }, []);
  const handleProductChange = useCallback((val: string) => {
    setProductId(val); setActiveFolderIdx(0); setSelectedPanelId(null); setSelectedParamId(null);
  }, []);

  // Available panels/folders/params for dialogs
  const availableFolders = allFolders.filter(f => !folders.find(bf => bf.id === f.id));
  const availablePanels = allPanels.filter(p => !activeFolder?.panels.find(bp => bp.id === p.id));
  const selectedPanelForParams = activeFolder?.panels.find(p => p.id === selectedPanelId);
  const availableParams = allParams.filter(p => !selectedPanelForParams?.parameters.find(bp => bp.id === p.id));

  // Other products for clone
  const otherProducts = sectorProducts.filter(p => p.id !== selProductId);

  return (
    <div className="flex flex-col h-full bg-background" data-testid="page-a-vizia">
      {/* === TOP NAV === */}
      <div className="flex items-center gap-2 px-6 py-3 border-b bg-card flex-shrink-0">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-muted-foreground mr-2">A-Vízia</span>

        <Select value={sectorId} onValueChange={handleSectorChange}>
          <SelectTrigger className="w-48 h-8 text-sm" data-testid="select-sector">
            <SelectValue placeholder="Sektor..." />
          </SelectTrigger>
          <SelectContent>
            {sectors.filter(s => !s.deletedAt).map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />

        <Select value={sectionId} onValueChange={handleSectionChange} disabled={sectorId === "none"}>
          <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-section">
            <SelectValue placeholder="Sekcia..." />
          </SelectTrigger>
          <SelectContent>
            {filteredSections.filter(s => !s.deletedAt).map(s => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />

        <Select value={productId} onValueChange={handleProductChange} disabled={sectionId === "none"}>
          <SelectTrigger className="w-52 h-8 text-sm" data-testid="select-product">
            <SelectValue placeholder="Produkt..." />
          </SelectTrigger>
          <SelectContent>
            {filteredProducts.filter(p => !p.deletedAt).map(p => (
              <SelectItem key={p.id} value={String(p.id)}>{p.name}{p.abbreviation ? ` (${p.abbreviation})` : ""}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {selProductId && (
          <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)} data-testid="button-clone-product">
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Klonovať produkt
          </Button>
        )}
      </div>

      {/* === BREADCRUMB === */}
      {selProductId && (
        <div className="px-6 py-2 border-b bg-muted/30 flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
          <span>{selSector?.name || "—"}</span>
          <ChevronRight className="h-3 w-3" />
          <span>{selSection?.name || "—"}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="font-medium text-foreground">{selProduct?.name || "—"}</span>
          {selProduct?.abbreviation && <Badge variant="secondary" className="ml-1 text-[10px] px-1">{selProduct.abbreviation}</Badge>}
        </div>
      )}

      {/* === MAIN AREA === */}
      <div className="flex flex-1 overflow-hidden">
        {/* === CANVAS === */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selProductId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Vyberte Sektor → Sekciu → Produkt v navigácii vyššie</p>
              </div>
            </div>
          ) : bpLoading ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Načítavam šablónu...
            </div>
          ) : (
            <>
              {/* Folder Tabs */}
              <div className="flex items-center gap-1 px-6 pt-4 pb-0 border-b bg-card flex-shrink-0 flex-wrap">
                {folders.map((folder, idx) => (
                  <button
                    key={folder.id}
                    onClick={() => { setActiveFolderIdx(idx); setSelectedPanelId(null); setSelectedParamId(null); }}
                    data-testid={`tab-folder-${folder.id}`}
                    className={`flex items-center gap-1.5 px-4 py-2 text-sm border-b-2 transition-colors whitespace-nowrap ${
                      activeFolderIdx === idx
                        ? "border-primary text-primary font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    }`}
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    {folder.name}
                    {getDensityWarning(folder.panels.length, 2, 6, "Priečinok") && (
                      <span className="text-amber-500 text-xs">⚠</span>
                    )}
                  </button>
                ))}
                <button
                  onClick={() => setAddFolderOpen(true)}
                  className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                  data-testid="button-add-folder"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Priečinok
                </button>
              </div>

              {/* Panel Grid */}
              <div className="flex-1 overflow-auto p-6">
                {!activeFolder ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <FolderOpen className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-sm">Žiadne priečinky. Pridajte prvý priečinok.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddFolderOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Pridať priečinok
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Density warning */}
                    {getDensityWarning(activeFolder.panels.length, 2, 6, "Priečinok") && (
                      <div className="mb-4 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                        ⚠ {getDensityWarning(activeFolder.panels.length, 2, 6, "Priečinok")}
                      </div>
                    )}

                    {activeFolder.panels.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed rounded-lg">
                        <LayoutGrid className="h-8 w-8 mb-2 opacity-20" />
                        <p className="text-sm">Žiadne panely v tomto priečinku.</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddPanelOpen(true)}>
                          <Plus className="h-3.5 w-3.5 mr-1.5" />
                          Pridať panel
                        </Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {activeFolder.panels.map(panel => (
                          <PanelCard
                            key={panel.id}
                            panel={panel}
                            folderId={activeFolder.id}
                            isSelected={selectedPanelId === panel.id}
                            selectedParamId={selectedParamId}
                            onSelectPanel={() => { setSelectedPanelId(panel.id === selectedPanelId ? null : panel.id); setSelectedParamId(null); }}
                            onSelectParam={(pid) => { setSelectedPanelId(panel.id); setSelectedParamId(pid === selectedParamId ? null : pid); }}
                            onRemovePanel={() => removePanelMutation.mutate({ folderId: activeFolder.id, panelId: panel.id })}
                            onRemoveParam={(pid) => removeParamMutation.mutate({ panelId: panel.id, parameterId: pid })}
                            onAddParams={() => { setSelectedPanelId(panel.id); setAddParamOpen(true); }}
                            onWidthChange={(pid, w) => updateWidthMutation.mutate({ folderId: activeFolder.id, panelId: panel.id, parameterId: pid, width: w })}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* === TOOLBAR === */}
        {selProductId && (
          <div className="w-56 border-l bg-card flex-shrink-0 flex flex-col p-4 gap-4 overflow-y-auto">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pridať</p>
              <div className="flex flex-col gap-1.5">
                <Button variant="outline" size="sm" className="justify-start gap-2 h-8" onClick={() => setAddFolderOpen(true)} data-testid="toolbar-add-folder">
                  <FolderOpen className="h-3.5 w-3.5" />
                  Priečinok
                </Button>
                <Button variant="outline" size="sm" className="justify-start gap-2 h-8" onClick={() => setAddPanelOpen(true)} disabled={!activeFolder} data-testid="toolbar-add-panel">
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
            {selectedParamId && selectedPanelId && activeFolder && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Šírka poľa</p>
                <div className="grid grid-cols-2 gap-1">
                  {WIDTH_OPTIONS.map(opt => {
                    const panel = activeFolder.panels.find(p => p.id === selectedPanelId);
                    const param = panel?.parameters.find(p => p.id === selectedParamId);
                    const isActive = param?.width === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => updateWidthMutation.mutate({
                          folderId: activeFolder.id,
                          panelId: selectedPanelId,
                          parameterId: selectedParamId,
                          width: opt.value,
                        })}
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

            {/* Remove actions */}
            {(selectedPanelId || activeFolder) && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Odstrániť</p>
                <div className="flex flex-col gap-1.5">
                  {activeFolder && (
                    <Button
                      variant="outline" size="sm"
                      className="justify-start gap-2 h-8 text-destructive hover:text-destructive hover:border-destructive"
                      onClick={() => removeFolderMutation.mutate(activeFolder.id)}
                      data-testid="toolbar-remove-folder"
                    >
                      <X className="h-3.5 w-3.5" />
                      Priečinok
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Density info */}
            <div className="mt-auto">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Anti-Vata</p>
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <p>📁 3–7 priečinkov</p>
                <p>📦 2–6 panelov</p>
                <p>⚙ 5–15 parametrov</p>
              </div>
              {activeFolder && (
                <div className="mt-2 text-[11px] space-y-0.5">
                  <p className={activeFolder.panels.length > 6 || activeFolder.panels.length < 2 ? "text-amber-500" : "text-green-600"}>
                    Panely: {activeFolder.panels.length}
                  </p>
                  {selectedPanelId && (() => {
                    const p = activeFolder.panels.find(p => p.id === selectedPanelId);
                    return p ? (
                      <p className={p.parameters.length > 15 || p.parameters.length < 5 ? "text-amber-500" : "text-green-600"}>
                        Parametre: {p.parameters.length}
                      </p>
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* === DIALOGS === */}

      {/* Add folders dialog */}
      <Dialog open={addFolderOpen} onOpenChange={setAddFolderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pridať priečinky k produktu</DialogTitle>
          </DialogHeader>
          {availableFolders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Všetky dostupné priečinky sú už priradené.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {availableFolders.map(f => (
                <label key={f.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer" data-testid={`checkbox-folder-${f.id}`}>
                  <Checkbox
                    checked={selectedFolderIds.includes(f.id)}
                    onCheckedChange={(checked) =>
                      setSelectedFolderIds(prev => checked ? [...prev, f.id] : prev.filter(id => id !== f.id))
                    }
                  />
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{f.name}</span>
                </label>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddFolderOpen(false); setSelectedFolderIds([]); }}>Zrušiť</Button>
            <Button onClick={() => addFoldersMutation.mutate(selectedFolderIds)} disabled={selectedFolderIds.length === 0 || addFoldersMutation.isPending} data-testid="button-confirm-add-folders">
              Pridať ({selectedFolderIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add panels dialog */}
      <Dialog open={addPanelOpen} onOpenChange={setAddPanelOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pridať panely do „{activeFolder?.name}"</DialogTitle>
          </DialogHeader>
          {availablePanels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Všetky dostupné panely sú už priradené.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {availablePanels.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer" data-testid={`checkbox-panel-${p.id}`}>
                  <Checkbox
                    checked={selectedPanelIds.includes(p.id)}
                    onCheckedChange={(checked) =>
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
              onClick={() => {
                if (!selectedPanelId && activeFolder && allPanels.length > 0) {
                  addPanelsMutation.mutate(selectedPanelIds);
                } else {
                  addPanelsMutation.mutate(selectedPanelIds);
                }
              }}
              disabled={selectedPanelIds.length === 0 || addPanelsMutation.isPending}
              data-testid="button-confirm-add-panels"
            >
              Pridať ({selectedPanelIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add parameters dialog */}
      <Dialog open={addParamOpen} onOpenChange={setAddParamOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Pridať parametre do „{activeFolder?.panels.find(p => p.id === selectedPanelId)?.name}"
            </DialogTitle>
          </DialogHeader>
          {availableParams.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">Žiadne dostupné parametre.</p>
          ) : (
            <div className="max-h-72 overflow-y-auto space-y-1">
              {availableParams.map(p => (
                <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer" data-testid={`checkbox-param-${p.id}`}>
                  <Checkbox
                    checked={selectedParamIds.includes(p.id)}
                    onCheckedChange={(checked) =>
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
              onClick={() => addParamsMutation.mutate({ panelId: selectedPanelId!, paramIds: selectedParamIds })}
              disabled={selectedParamIds.length === 0 || !selectedPanelId || addParamsMutation.isPending}
              data-testid="button-confirm-add-params"
            >
              Pridať ({selectedParamIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Clone dialog */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Klonovať šablónu produktu</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Vyberte cieľový produkt, na ktorý sa prenesie celá šablóna priečinkov a rozloženie.</p>
          <Select value={cloneTargetProductId} onValueChange={setCloneTargetProductId}>
            <SelectTrigger data-testid="select-clone-target">
              <SelectValue placeholder="Vybrať cieľový produkt..." />
            </SelectTrigger>
            <SelectContent>
              {otherProducts.map(p => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneOpen(false)}>Zrušiť</Button>
            <Button
              onClick={() => cloneMutation.mutate(Number(cloneTargetProductId))}
              disabled={cloneTargetProductId === "none" || cloneMutation.isPending}
              data-testid="button-confirm-clone"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Klonovať
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// === PANEL CARD COMPONENT ===
interface PanelCardProps {
  panel: BpPanel;
  folderId: number;
  isSelected: boolean;
  selectedParamId: number | null;
  onSelectPanel: () => void;
  onSelectParam: (id: number) => void;
  onRemovePanel: () => void;
  onRemoveParam: (id: number) => void;
  onAddParams: () => void;
  onWidthChange: (paramId: number, width: string) => void;
}

function PanelCard({
  panel, folderId, isSelected, selectedParamId,
  onSelectPanel, onSelectParam, onRemovePanel, onRemoveParam, onAddParams, onWidthChange,
}: PanelCardProps) {
  const paramWarning = getDensityWarning(panel.parameters.length, 5, 15, "Panel");

  return (
    <div
      className={`border-2 rounded-lg flex flex-col transition-all ${
        isSelected ? "border-primary shadow-sm" : "border-border hover:border-muted-foreground/50"
      }`}
      data-testid={`card-panel-${panel.id}`}
    >
      {/* Panel Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 cursor-pointer rounded-t-md ${
          isSelected ? "bg-primary/5" : "bg-muted/30 hover:bg-muted/50"
        }`}
        onClick={onSelectPanel}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
        <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-medium flex-1 truncate">{panel.name}</span>
        {paramWarning && <span className="text-amber-500 text-xs">⚠</span>}
        <button
          onClick={(e) => { e.stopPropagation(); onRemovePanel(); }}
          className="h-5 w-5 flex items-center justify-center rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
          data-testid={`button-remove-panel-${panel.id}`}
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Parameters */}
      <div className="p-2 flex-1 min-h-[80px]">
        {panel.parameters.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-16 text-muted-foreground/50 text-xs gap-1">
            <span>Žiadne parametre</span>
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
                  onClick={(e) => { e.stopPropagation(); onRemoveParam(param.id); }}
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
