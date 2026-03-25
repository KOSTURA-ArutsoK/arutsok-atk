import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronRight, ChevronDown, ChevronLeft, Layers, FolderOpen, LayoutGrid,
  AlignLeft, Copy, Plus, X, GripVertical, Search,
} from "lucide-react";
import type { Sector, Section, SectorProduct, ContractFolder, Panel, Parameter } from "@shared/schema";

// --- Type for the full blueprint response ---
type BpParameter = Parameter & { sortOrder: number; width: number };
type BpPanel = Panel & { sortOrder: number; gridColumns: number; width: number; parameters: BpParameter[] };
type BpFolder = ContractFolder & { sortOrder: number; panels: BpPanel[] };
type FullBlueprint = { folders: BpFolder[]; blueprintId: number | null };

// --- Width preset options for parameters ---
const PARAM_WIDTH_PRESETS = [25, 33, 50, 75, 100];
// --- Width preset options for panels ---
const PANEL_WIDTH_PRESETS = [25, 33, 50, 75, 100];

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
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [activeFolderIdx, setActiveFolderIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSectors, setExpandedSectors] = useState<Record<number, boolean>>({});
  const [expandedSections, setExpandedSections] = useState<Record<number, boolean>>({});

  // --- Panel collapse state ---
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

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

  const { data: blueprint, isLoading: bpLoading } = useQuery<FullBlueprint>({
    queryKey: ["/api/sector-products", selectedProductId, "full-blueprint"],
    queryFn: () => apiRequest("GET", `/api/sector-products/${selectedProductId}/full-blueprint`).then(r => r.json()),
    enabled: !!selectedProductId,
  });

  // Direct panels (without folder) — used as fallback when product has no folders
  type DirectPanel = Panel & { parameters: (Parameter & { panelSortOrder: number })[] };
  const { data: directPanels = [] } = useQuery<DirectPanel[]>({
    queryKey: ["/api/sector-products", selectedProductId, "panels-with-parameters"],
    queryFn: () => apiRequest("GET", `/api/sector-products/${selectedProductId}/panels-with-parameters`).then(r => r.json()),
    enabled: !!selectedProductId,
  });

  // --- Active folder ---
  const folders = blueprint?.folders || [];
  const activeFolder = folders[activeFolderIdx] || null;

  // --- No-folder fallback: show direct panels when folders is empty but panels exist ---
  const hasFolders = folders.length > 0;
  const hasDirectPanelsOnly = !hasFolders && directPanels.length > 0;
  const hasNoStructure = !hasFolders && directPanels.length === 0;

  // --- Selected product info ---
  const selProduct = sectorProducts.find(p => p.id === selectedProductId);
  const selSection = sections.find(s => s.id === selProduct?.sectionId);
  const selSector = sectors.find(s => s.id === selSection?.sectorId);

  // --- Tree structure for left panel ---
  const activeSectors = useMemo(() => sectors.filter(s => !s.deletedAt), [sectors]);
  const activeSections = useMemo(() => sections.filter(s => !s.deletedAt), [sections]);
  const activeProducts = useMemo(() => sectorProducts.filter(p => !p.deletedAt), [sectorProducts]);

  // Filter tree by search query
  const lowerSearch = searchQuery.toLowerCase().trim();
  const filteredTree = useMemo(() => {
    if (!lowerSearch) return null; // null = show full tree without filter

    const matchingProducts = activeProducts.filter(p =>
      p.name.toLowerCase().includes(lowerSearch) ||
      (p.abbreviation?.toLowerCase() || "").includes(lowerSearch)
    );
    const matchingSectionIds = new Set(matchingProducts.map(p => p.sectionId));
    const matchingSections = activeSections.filter(s =>
      s.name.toLowerCase().includes(lowerSearch) || matchingSectionIds.has(s.id)
    );
    const matchingSectorIds = new Set(matchingSections.map(s => s.sectorId).filter(Boolean));
    const matchingSectors = activeSectors.filter(s =>
      s.name.toLowerCase().includes(lowerSearch) || matchingSectorIds.has(s.id)
    );

    return { sectors: matchingSectors, sectionIds: new Set(matchingSections.map(s => s.id)), productSet: new Set(matchingProducts.map(p => p.id)) };
  }, [lowerSearch, activeSectors, activeSections, activeProducts]);

  const visibleSectors = filteredTree ? filteredTree.sectors : activeSectors;

  const handleSelectProduct = useCallback((productId: number) => {
    setSelectedProductId(productId);
    setActiveFolderIdx(0);
    setSelectedPanelId(null);
    setSelectedParamId(null);
  }, []);

  const toggleSector = useCallback((sectorId: number) => {
    setExpandedSectors(prev => ({ ...prev, [sectorId]: !prev[sectorId] }));
  }, []);

  const toggleSection = useCallback((sectionId: number) => {
    setExpandedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  }, []);

  // === MUTATIONS ===

  // Update parameter width in blueprint
  const updateWidthMutation = useMutation({
    mutationFn: async ({ folderId, panelId, parameterId, width }: { folderId: number; panelId: number; parameterId: number; width: number }) => {
      const bp = blueprint;
      if (!selectedProductId) return;

      const existingBpId = bp?.blueprintId;
      const layoutJson = buildUpdatedLayoutJson(bp, folderId, panelId, parameterId, width);

      if (existingBpId) {
        return apiRequest("PUT", `/api/ui-blueprints/${existingBpId}`, { layoutJson }).then(r => r.json());
      } else {
        return apiRequest("POST", "/api/ui-blueprints", {
          type: "PRODUCT", targetId: String(selectedProductId), layoutJson,
        }).then(r => r.json());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selectedProductId, "full-blueprint"] });
    },
  });

  // Update panel width in blueprint
  const updatePanelWidthMutation = useMutation({
    mutationFn: async ({ folderId, panelId, width }: { folderId: number; panelId: number; width: number }) => {
      const bp = blueprint;
      if (!selectedProductId) return;

      const existingBpId = bp?.blueprintId;
      const layoutJson = buildUpdatedPanelWidthLayoutJson(bp, folderId, panelId, width);

      if (existingBpId) {
        return apiRequest("PUT", `/api/ui-blueprints/${existingBpId}`, { layoutJson }).then(r => r.json());
      } else {
        return apiRequest("POST", "/api/ui-blueprints", {
          type: "PRODUCT", targetId: String(selectedProductId), layoutJson,
        }).then(r => r.json());
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selectedProductId, "full-blueprint"] });
    },
  });

  // Add folders to product
  const addFoldersMutation = useMutation({
    mutationFn: async (folderIds: number[]) => {
      const currentFolderIds = folders.map(f => f.id);
      const newIds = [...new Set([...currentFolderIds, ...folderIds])];
      const assignments = newIds.map((fid, idx) => ({ folderId: fid, sortOrder: idx }));
      return apiRequest("PUT", `/api/sector-products/${selectedProductId}/folders`, { assignments }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selectedProductId, "full-blueprint"] });
      setAddFolderOpen(false);
      setSelectedFolderIds([]);
      toast({ title: "Priečinky pridané" });
    },
  });

  // Remove folder from product
  const removeFolderMutation = useMutation({
    mutationFn: async (folderId: number) => {
      const remaining = folders.filter(f => f.id !== folderId).map((f, idx) => ({ folderId: f.id, sortOrder: idx }));
      return apiRequest("PUT", `/api/sector-products/${selectedProductId}/folders`, { assignments: remaining }).then(r => r.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selectedProductId, "full-blueprint"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selectedProductId, "full-blueprint"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selectedProductId, "full-blueprint"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selectedProductId, "full-blueprint"] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", selectedProductId, "full-blueprint"] });
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
  function buildUpdatedLayoutJson(bp: FullBlueprint | undefined, folderId: number, panelId: number, parameterId: number, width: number) {
    const existing = (bp?.folders || []).map(f => ({
      folderId: f.id,
      panels: f.panels.map(p => ({
        panelId: p.id,
        width: p.width || 50,
        parameters: p.parameters.map(pr => ({
          parameterId: pr.id,
          width: (pr.id === parameterId && p.id === panelId && f.id === folderId) ? width : (pr.width || 50),
        })),
      })),
    }));
    return { folders: existing };
  }

  function buildUpdatedPanelWidthLayoutJson(bp: FullBlueprint | undefined, folderId: number, panelId: number, width: number) {
    const existing = (bp?.folders || []).map(f => ({
      folderId: f.id,
      panels: f.panels.map(p => ({
        panelId: p.id,
        width: (p.id === panelId && f.id === folderId) ? width : (p.width || 50),
        parameters: p.parameters.map(pr => ({
          parameterId: pr.id,
          width: pr.width || 50,
        })),
      })),
    }));
    return { folders: existing };
  }

  // Available panels/folders/params for dialogs
  const availableFolders = allFolders.filter(f => !folders.find(bf => bf.id === f.id));
  const availablePanels = allPanels.filter(p => !activeFolder?.panels.find(bp => bp.id === p.id));
  const selectedPanelForParams = activeFolder?.panels.find(p => p.id === selectedPanelId);
  const availableParams = allParams.filter(p => !selectedPanelForParams?.parameters.find(bp => bp.id === p.id));

  // Other products for clone
  const otherProducts = sectorProducts.filter(p => p.id !== selectedProductId);

  // Whether sector/section should be expanded in tree
  function isSectorExpanded(sectorId: number) {
    if (lowerSearch) return true;
    return expandedSectors[sectorId] ?? false;
  }
  function isSectionExpanded(sectionId: number) {
    if (lowerSearch) return true;
    return expandedSections[sectionId] ?? false;
  }

  return (
    <div className="flex flex-col h-full bg-background" data-testid="page-a-vizia">
      {/* === TOP BAR === */}
      <div className="flex items-center gap-2 px-6 py-3 border-b bg-card flex-shrink-0">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">A-Vízia</span>
        <span className="text-xs text-muted-foreground ml-1">— Builder šablón produktov</span>
        <div className="flex-1" />
        {selectedProductId && (
          <Button variant="outline" size="sm" onClick={() => setCloneOpen(true)} data-testid="button-clone-product">
            <Copy className="h-3.5 w-3.5 mr-1.5" />
            Klonovať produkt
          </Button>
        )}
      </div>

      {/* === MAIN TWO-PANEL LAYOUT === */}
      <div className="flex flex-1 overflow-hidden">

        {/* === LEFT PANEL — Product Tree === */}
        <div className="flex flex-shrink-0 relative">
          {/* Panel content */}
          <div className={`border-r bg-card flex flex-col transition-all duration-150 ${leftPanelCollapsed ? "w-0 overflow-hidden" : "w-64"}`}>
            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Hľadaj produkt..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  data-testid="input-search-products"
                />
              </div>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto py-1">
              {visibleSectors.length === 0 && (
                <p className="text-xs text-muted-foreground px-4 py-3">
                  {lowerSearch ? "Žiadne výsledky." : "Žiadne sektory."}
                </p>
              )}
              {visibleSectors.map(sector => {
                const sectorSections = activeSections.filter(s =>
                  s.sectorId === sector.id &&
                  (!filteredTree || filteredTree.sectionIds.has(s.id))
                );
                const expanded = isSectorExpanded(sector.id);

                return (
                  <div key={sector.id} data-testid={`tree-sector-${sector.id}`}>
                    {/* Sector row */}
                    <button
                      className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-muted/50 text-left transition-colors"
                      onClick={() => toggleSector(sector.id)}
                      data-testid={`toggle-sector-${sector.id}`}
                    >
                      {expanded
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      }
                      <span className="text-sm font-medium truncate">{sector.name}</span>
                    </button>

                    {/* Sections */}
                    {expanded && sectorSections.map(section => {
                      const sectionProducts = activeProducts.filter(p =>
                        p.sectionId === section.id &&
                        (!filteredTree || filteredTree.productSet.has(p.id))
                      );
                      const secExpanded = isSectionExpanded(section.id);

                      return (
                        <div key={section.id} data-testid={`tree-section-${section.id}`}>
                          {/* Section row */}
                          <button
                            className="w-full flex items-center gap-1.5 pl-7 pr-3 py-1.5 hover:bg-muted/50 text-left transition-colors"
                            onClick={() => toggleSection(section.id)}
                            data-testid={`toggle-section-${section.id}`}
                          >
                            {secExpanded
                              ? <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              : <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            }
                            <span className="text-xs text-muted-foreground truncate">{section.name}</span>
                          </button>

                          {/* Products */}
                          {secExpanded && sectionProducts.map(product => {
                            const isSelected = selectedProductId === product.id;
                            return (
                              <button
                                key={product.id}
                                onClick={() => handleSelectProduct(product.id)}
                                className={`w-full flex items-center gap-1.5 pl-12 pr-3 py-1 text-left transition-colors text-xs ${
                                  isSelected
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-foreground hover:bg-muted/50"
                                }`}
                                data-testid={`product-item-${product.id}`}
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-current flex-shrink-0 opacity-60" />
                                <span className="truncate flex-1">{product.name}</span>
                                {product.abbreviation && (
                                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                    {product.abbreviation}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Left panel toggle button */}
          <button
            onClick={() => setLeftPanelCollapsed(c => !c)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full z-10 flex items-center justify-center w-5 h-10 bg-card border border-l-0 rounded-r text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title={leftPanelCollapsed ? "Zobraziť strom" : "Skryť strom"}
            data-testid="toggle-left-panel"
          >
            {leftPanelCollapsed
              ? <ChevronRight className="h-3 w-3" />
              : <ChevronLeft className="h-3 w-3" />
            }
          </button>
        </div>

        {/* === RIGHT PANEL — Blueprint Preview === */}
        <div className="flex-1 flex overflow-hidden">

          {/* === CANVAS === */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedProductId ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Layers className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Vyberte produkt zo zoznamu vľavo</p>
                </div>
              </div>
            ) : (
              <>
                {/* Breadcrumb */}
                <div className="px-6 py-2 border-b bg-muted/30 flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <span>{selSector?.name || "—"}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span>{selSection?.name || "—"}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="font-medium text-foreground">{selProduct?.name || "—"}</span>
                  {selProduct?.abbreviation && (
                    <Badge variant="secondary" className="ml-1 text-[10px] px-1">{selProduct.abbreviation}</Badge>
                  )}
                </div>

                {bpLoading ? (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                    Načítavam šablónu...
                  </div>
                ) : hasNoStructure ? (
                  /* === EMPTY STATE === */
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-6">
                    <FolderOpen className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-sm">Tento produkt zatiaľ nemá priradenú žiadnu štruktúru.</p>
                    <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddFolderOpen(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Pridať priečinok
                    </Button>
                  </div>
                ) : hasDirectPanelsOnly ? (
                  /* === DIRECT PANELS (no folders) === */
                  <div className="flex-1 overflow-auto p-6">
                    <p className="text-xs text-muted-foreground mb-4">Panely bez priečinka:</p>
                    <div className="flex flex-wrap gap-4 items-start">
                      {directPanels.map(panel => {
                        const bpPanel: BpPanel = {
                          ...panel,
                          sortOrder: 0,
                          gridColumns: 1,
                          width: 50,
                          parameters: panel.parameters.map(p => ({ ...p, sortOrder: p.panelSortOrder, width: 50 })),
                        };
                        return (
                          <PanelCard
                            key={panel.id}
                            panel={bpPanel}
                            isSelected={selectedPanelId === panel.id}
                            selectedParamId={selectedParamId}
                            onSelectPanel={() => { setSelectedPanelId(panel.id === selectedPanelId ? null : panel.id); setSelectedParamId(null); }}
                            onSelectParam={(pid) => { setSelectedPanelId(panel.id); setSelectedParamId(pid === selectedParamId ? null : pid); }}
                            onRemovePanel={() => {}}
                            onRemoveParam={() => {}}
                            onAddParams={() => { setSelectedPanelId(panel.id); setAddParamOpen(true); }}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* === FOLDER TABS + PANELS === */
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
                          {getDensityWarning(folder.panels.length, 1, 6, "Priečinok") && (
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
                          <p className="text-sm">Žiadne panely v tomto priečinku.</p>
                          <Button variant="outline" size="sm" className="mt-3" onClick={() => setAddFolderOpen(true)}>
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            Pridať priečinok
                          </Button>
                        </div>
                      ) : (
                        <>
                          {/* Density warning */}
                          {getDensityWarning(activeFolder.panels.length, 1, 6, "Priečinok") && (
                            <div className="mb-4 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
                              ⚠ {getDensityWarning(activeFolder.panels.length, 1, 6, "Priečinok")}
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
                            <div className="flex flex-wrap gap-4 items-start">
                              {activeFolder.panels.map(panel => (
                                <PanelCard
                                  key={panel.id}
                                  panel={panel}
                                  isSelected={selectedPanelId === panel.id}
                                  selectedParamId={selectedParamId}
                                  onSelectPanel={() => { setSelectedPanelId(panel.id === selectedPanelId ? null : panel.id); setSelectedParamId(null); }}
                                  onSelectParam={(pid) => { setSelectedPanelId(panel.id); setSelectedParamId(pid === selectedParamId ? null : pid); }}
                                  onRemovePanel={() => removePanelMutation.mutate({ folderId: activeFolder.id, panelId: panel.id })}
                                  onRemoveParam={(pid) => removeParamMutation.mutate({ panelId: panel.id, parameterId: pid })}
                                  onAddParams={() => { setSelectedPanelId(panel.id); setAddParamOpen(true); }}
                                />
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* === TOOLBAR === */}
          {selectedProductId && (
            <div className="flex flex-shrink-0 relative">
              {/* Right panel toggle button */}
              <button
                onClick={() => setRightPanelCollapsed(c => !c)}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full z-10 flex items-center justify-center w-5 h-10 bg-card border border-r-0 rounded-l text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title={rightPanelCollapsed ? "Zobraziť toolbar" : "Skryť toolbar"}
                data-testid="toggle-right-panel"
              >
                {rightPanelCollapsed
                  ? <ChevronLeft className="h-3 w-3" />
                  : <ChevronRight className="h-3 w-3" />
                }
              </button>
            <div className={`border-l bg-card flex flex-col gap-4 overflow-y-auto transition-all duration-150 ${rightPanelCollapsed ? "w-0 overflow-hidden p-0" : "w-56 p-4"}`}>
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

              {/* Width selector for selected panel */}
              {selectedPanelId && !selectedParamId && activeFolder && (() => {
                const panel = activeFolder.panels.find(p => p.id === selectedPanelId);
                const currentWidth = panel?.width || 50;
                return (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Šírka panelu</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {PANEL_WIDTH_PRESETS.map(w => (
                        <button
                          key={w}
                          onClick={() => updatePanelWidthMutation.mutate({ folderId: activeFolder.id, panelId: selectedPanelId, width: w })}
                          data-testid={`panel-width-preset-${w}`}
                          className={`px-2 py-1 text-xs rounded border transition-colors ${
                            currentWidth === w
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:border-primary hover:text-primary"
                          }`}
                        >
                          {w}%
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Width selector for selected parameter */}
              {selectedParamId && selectedPanelId && activeFolder && (() => {
                const panel = activeFolder.panels.find(p => p.id === selectedPanelId);
                const param = panel?.parameters.find(p => p.id === selectedParamId);
                const currentWidth = param?.width || 50;
                const otherParamsSum = (panel?.parameters || [])
                  .filter(p => p.id !== selectedParamId)
                  .reduce((sum, p) => sum + (p.width || 0), 0);
                const remainder = 100 - otherParamsSum;
                const allParamsSum = (panel?.parameters || [])
                  .reduce((sum, p) => sum + (p.width || 0), 0);
                const sumOk = allParamsSum === 100;

                return (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Šírka poľa</p>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {PARAM_WIDTH_PRESETS.map(w => (
                        <button
                          key={w}
                          onClick={() => updateWidthMutation.mutate({
                            folderId: activeFolder.id,
                            panelId: selectedPanelId,
                            parameterId: selectedParamId,
                            width: w,
                          })}
                          data-testid={`param-width-preset-${w}`}
                          className={`px-2 py-1 text-xs rounded border transition-colors ${
                            currentWidth === w
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:border-primary hover:text-primary"
                          }`}
                        >
                          {w}%
                        </button>
                      ))}
                    </div>
                    <input
                      type="number"
                      min={5}
                      max={100}
                      value={currentWidth}
                      onChange={(e) => {
                        const val = Math.min(100, Math.max(5, Number(e.target.value)));
                        updateWidthMutation.mutate({
                          folderId: activeFolder.id,
                          panelId: selectedPanelId,
                          parameterId: selectedParamId,
                          width: val,
                        });
                      }}
                      data-testid="param-width-custom-input"
                      className="w-full text-xs border border-border rounded px-2 py-1 bg-background text-foreground mb-2 focus:outline-none focus:border-primary"
                    />
                    <p className="text-[11px] text-muted-foreground" data-testid="param-width-remainder">
                      Zostatok: {remainder}%
                    </p>
                    {!sumOk && (
                      <p className="text-[11px] text-amber-500 mt-1" data-testid="param-width-sum-warning">
                        Súčet: {allParamsSum}% — {allParamsSum < 100 ? `chýba ${100 - allParamsSum}%` : `presahuje o ${allParamsSum - 100}%`}
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Remove actions */}
              {activeFolder && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Odstrániť</p>
                  <div className="flex flex-col gap-1.5">
                    <Button
                      variant="outline" size="sm"
                      className="justify-start gap-2 h-8 text-destructive hover:text-destructive hover:border-destructive"
                      onClick={() => removeFolderMutation.mutate(activeFolder.id)}
                      data-testid="toolbar-remove-folder"
                    >
                      <X className="h-3.5 w-3.5" />
                      Priečinok
                    </Button>
                  </div>
                </div>
              )}

              {/* Density info */}
              <div className="mt-auto">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Anti-Vata</p>
                <div className="text-[11px] text-muted-foreground space-y-0.5">
                  <p>📁 3–7 priečinkov</p>
                  <p>📦 1–6 panelov</p>
                  <p>⚙ 5–15 parametrov</p>
                </div>
                {activeFolder && (
                  <div className="mt-2 text-[11px] space-y-0.5">
                    <p className={activeFolder.panels.length > 6 || activeFolder.panels.length < 1 ? "text-amber-500" : "text-green-600"}>
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
            </div>
          )}
        </div>
      </div>

      {/* === DIALOGS === */}

      {/* Add folders dialog */}
      <Dialog open={addFolderOpen} onOpenChange={setAddFolderOpen}>
        <DialogContent size="sm">
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
        <DialogContent size="sm">
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
              onClick={() => addPanelsMutation.mutate(selectedPanelIds)}
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
        <DialogContent size="sm">
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
        <DialogContent size="sm">
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
  isSelected: boolean;
  selectedParamId: number | null;
  onSelectPanel: () => void;
  onSelectParam: (id: number) => void;
  onRemovePanel: () => void;
  onRemoveParam: (id: number) => void;
  onAddParams: () => void;
}

function PanelCard({
  panel, isSelected, selectedParamId,
  onSelectPanel, onSelectParam, onRemovePanel, onRemoveParam, onAddParams,
}: PanelCardProps) {
  const paramWarning = getDensityWarning(panel.parameters.length, 5, 15, "Panel");
  const panelWidth = panel.width || 50;

  return (
    <div
      className={`border-2 rounded-lg flex flex-col transition-all ${
        isSelected ? "border-primary shadow-sm" : "border-border hover:border-muted-foreground/50"
      }`}
      style={{ width: `calc(${panelWidth}% - 1rem)`, minWidth: "200px" }}
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
                <span className="text-[10px] text-muted-foreground/60 w-8 text-right">{param.width}%</span>
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
