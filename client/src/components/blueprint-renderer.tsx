/**
 * BlueprintRenderer — Task #127
 * Renders product blueprints (A-Vízia) with folder tabs, panel grid, parameter fields.
 * Also provides SubjectBlueprintSection (B-Vízia) for rendering subject blueprints.
 *
 * Cross-Pulling: contract parameters can pull values from subject's dynamicFields.
 * MIRROR panels: display subject blueprint fields inline within contract blueprint.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderOpen, LayoutGrid, AlignLeft, Link2, Info, ArrowLeftRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================
// Types
// ============================================================
export interface BpParameter {
  id: number;
  name: string;
  paramType: string;
  helpText?: string | null;
  options?: string[];
  isRequired?: boolean;
  defaultValue?: string | null;
  width: string;
  sortOrder: number;
}

export interface BpPanel {
  id: number;
  name: string;
  description?: string | null;
  sortOrder: number;
  gridColumns?: number;
  parameters: BpParameter[];
  // MIRROR panel support (Task #127 Cross-Pulling)
  type?: "MIRROR";
  sourceBlueprint?: "SUBJECT";
  sourceType?: string;
}

export interface BpFolder {
  id: number;
  name: string;
  sortOrder: number;
  panels: BpPanel[];
}

export interface FullBlueprint {
  folders: BpFolder[];
  blueprintId: number | null;
}

// ============================================================
// Color schemes (Task #127 spec: Royal Blue / Emerald / Dark Grey / Red)
// ============================================================
export type ColorScheme = "holding" | "client" | "network" | "risk" | "default";

const COLOR_SCHEME_STYLES: Record<ColorScheme, {
  tabActive: string;
  tabBorder: string;
  panelHeader: string;
  panelBorder: string;
  crossPull: string;
}> = {
  holding: {
    tabActive: "border-blue-500 text-blue-600",
    tabBorder: "hover:border-blue-300",
    panelHeader: "bg-blue-50/60 dark:bg-blue-900/20",
    panelBorder: "border-blue-200/60 dark:border-blue-800/40",
    crossPull: "border-blue-300/50 bg-blue-50/20 dark:bg-blue-900/10",
  },
  client: {
    tabActive: "border-emerald-500 text-emerald-600",
    tabBorder: "hover:border-emerald-300",
    panelHeader: "bg-emerald-50/60 dark:bg-emerald-900/20",
    panelBorder: "border-emerald-200/60 dark:border-emerald-800/40",
    crossPull: "border-emerald-300/50 bg-emerald-50/20 dark:bg-emerald-900/10",
  },
  network: {
    tabActive: "border-slate-500 text-slate-600",
    tabBorder: "hover:border-slate-300",
    panelHeader: "bg-slate-100/60 dark:bg-slate-800/30",
    panelBorder: "border-slate-300/60 dark:border-slate-700/40",
    crossPull: "border-slate-300/50 bg-slate-50/20 dark:bg-slate-800/10",
  },
  risk: {
    tabActive: "border-red-500 text-red-600",
    tabBorder: "hover:border-red-300",
    panelHeader: "bg-red-50/60 dark:bg-red-900/20",
    panelBorder: "border-red-200/60 dark:border-red-800/40",
    crossPull: "border-red-300/50 bg-red-50/20 dark:bg-red-900/10",
  },
  default: {
    tabActive: "border-primary text-primary",
    tabBorder: "hover:border-muted-foreground/40",
    panelHeader: "bg-muted/40",
    panelBorder: "border-border",
    crossPull: "border-blue-300/50 bg-blue-50/20 dark:bg-blue-900/10",
  },
};

// ============================================================
// Width to tailwind class
// ============================================================
function widthToColSpan(width: string): string {
  switch (width) {
    case "25%":  return "col-span-1";
    case "50%":  return "col-span-2";
    case "75%":  return "col-span-3";
    case "100%": return "col-span-4";
    default:     return "col-span-2";
  }
}

// ============================================================
// Single parameter field renderer
// ============================================================
interface ParamFieldProps {
  param: BpParameter;
  panelId: number;
  value: string;
  onChange: (panelId: number, paramId: number, value: string) => void;
  crossValue?: string;
  readOnly?: boolean;
  crossPullClass?: string;
}

function ParamField({ param, panelId, value, onChange, crossValue, readOnly, crossPullClass }: ParamFieldProps) {
  const displayValue = value || crossValue || "";
  const isCrossPulled = !value && !!crossValue;

  return (
    <div className={cn("flex flex-col gap-1", widthToColSpan(param.width))} data-testid={`param-field-${panelId}-${param.id}`}>
      <label className="text-xs font-medium flex items-center gap-1">
        {param.name}
        {param.isRequired && <span className="text-destructive">*</span>}
        {isCrossPulled && (
          <span title="Hodnota prebraná zo subjektu (Cross-Pull)">
            <Link2 className="h-3 w-3 text-blue-400" />
          </span>
        )}
      </label>
      <ParameterInput
        param={param}
        panelId={panelId}
        value={displayValue}
        onChange={(val) => !readOnly && onChange(panelId, param.id, val)}
        readOnly={readOnly}
        isCrossPulled={isCrossPulled}
        crossPullClass={crossPullClass}
      />
      {param.helpText && (
        <p className="text-[10px] text-muted-foreground">{param.helpText}</p>
      )}
    </div>
  );
}

interface ParamInputProps {
  param: BpParameter;
  panelId: number;
  value: string;
  onChange: (val: string) => void;
  readOnly?: boolean;
  isCrossPulled?: boolean;
  crossPullClass?: string;
}

function ParameterInput({ param, panelId, value, onChange, readOnly, isCrossPulled, crossPullClass }: ParamInputProps) {
  const baseClass = cn(
    "text-sm",
    isCrossPulled && (crossPullClass || "border-blue-300/50 bg-blue-50/20 dark:bg-blue-900/10")
  );

  if (param.paramType === "textarea") {
    return (
      <Textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        readOnly={readOnly}
        className={baseClass}
        data-testid={`input-blueprint-${panelId}-${param.id}`}
      />
    );
  }

  if (param.paramType === "boolean") {
    return (
      <Select value={value} onValueChange={onChange} disabled={readOnly}>
        <SelectTrigger className={baseClass} data-testid={`select-blueprint-${panelId}-${param.id}`}>
          <SelectValue placeholder="Vyberte" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ano">Áno</SelectItem>
          <SelectItem value="nie">Nie</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if ((param.paramType === "select" || param.paramType === "combobox" || param.paramType === "jedna_moznost") && (param.options || []).length > 0) {
    return (
      <Select value={value} onValueChange={onChange} disabled={readOnly}>
        <SelectTrigger className={baseClass} data-testid={`select-blueprint-${panelId}-${param.id}`}>
          <SelectValue placeholder="Vyberte" />
        </SelectTrigger>
        <SelectContent>
          {(param.options || []).map(opt => (
            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (param.paramType === "date") {
    return (
      <Input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        readOnly={readOnly}
        className={baseClass}
        data-testid={`input-blueprint-${panelId}-${param.id}`}
      />
    );
  }

  if (param.paramType === "number") {
    return (
      <Input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        readOnly={readOnly}
        className={baseClass}
        data-testid={`input-blueprint-${panelId}-${param.id}`}
      />
    );
  }

  return (
    <Input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      readOnly={readOnly}
      className={baseClass}
      data-testid={`input-blueprint-${panelId}-${param.id}`}
    />
  );
}

// ============================================================
// Panel card renderer
// ============================================================
interface PanelCardProps {
  panel: BpPanel;
  values: Record<string, string>;
  onChange: (panelId: number, paramId: number, value: string) => void;
  crossPullValues?: Record<string, string>;
  readOnly?: boolean;
  colors?: typeof COLOR_SCHEME_STYLES["default"];
}

function PanelCard({ panel, values, onChange, crossPullValues, readOnly, colors }: PanelCardProps) {
  if (panel.parameters.length === 0) return null;
  const c = colors || COLOR_SCHEME_STYLES["default"];

  return (
    <div className={cn("border-2 rounded-lg overflow-hidden", c.panelBorder)} data-testid={`blueprint-panel-${panel.id}`}>
      <div className={cn("flex items-center gap-2 px-3 py-2 border-b", c.panelHeader)}>
        <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-sm font-semibold">{panel.name}</span>
        {panel.description && (
          <span className="text-xs text-muted-foreground">({panel.description})</span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{panel.parameters.length} polí</span>
      </div>
      <div className="p-3 grid grid-cols-4 gap-3">
        {panel.parameters.map(param => {
          const key = `${panel.id}_${param.id}`;
          const crossKey = param.name.toLowerCase().replace(/\s+/g, "_");
          return (
            <ParamField
              key={param.id}
              param={param}
              panelId={panel.id}
              value={values[key] || ""}
              onChange={onChange}
              crossValue={crossPullValues?.[crossKey] || crossPullValues?.[param.name]}
              readOnly={readOnly}
              crossPullClass={c.crossPull}
            />
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MIRROR Panel — Cross-Pulling (Task #127 Modul C)
// Displays subject blueprint fields inline within contract blueprint
// ============================================================
interface MirrorPanelProps {
  panel: BpPanel;
  subjectDynamicFields?: Record<string, any>;
}

interface MirrorAllPanel { id: number; name: string; description?: string | null; }
interface MirrorAllParam { id: number; name: string; paramType: string; helpText?: string | null; options?: string[]; defaultValue?: string | null; }

interface SubjectMirrorBlueprintData {
  id: number;
  type: string;
  targetId: string;
  layoutJson: {
    megaBlocks: {
      id: string;
      name: string;
      order: number;
      panels: {
        panelId: number;
        order: number;
        parameters: { parameterId: number; order: number; width: string }[];
      }[];
    }[];
  };
}

function MirrorPanel({ panel, subjectDynamicFields = {} }: MirrorPanelProps) {
  const sourceType = panel.sourceType || "FO";

  const { data: allPanels = [] } = useQuery<MirrorAllPanel[]>({ queryKey: ["/api/panels"] });
  const { data: allParams = [] } = useQuery<MirrorAllParam[]>({ queryKey: ["/api/parameters"] });
  const { data: blueprint } = useQuery<SubjectMirrorBlueprintData | null>({
    queryKey: ["/api/ui-blueprints/find", sourceType, "SUBJECT"],
    queryFn: () =>
      apiRequest("GET", `/api/ui-blueprints/find?type=SUBJECT&targetId=${sourceType}`).then(r => r.json()),
    enabled: !!sourceType,
  });

  const enrichedPanels = useMemo(() => {
    if (!blueprint?.layoutJson?.megaBlocks) return [];
    const result: { id: number; name: string; parameters: (MirrorAllParam & { width: string })[] }[] = [];
    for (const mb of blueprint.layoutJson.megaBlocks) {
      for (const p of (mb.panels || [])) {
        const panelDef = allPanels.find(pl => pl.id === p.panelId);
        if (!panelDef) continue;
        const parameters = (p.parameters || [])
          .map(pr => {
            const param = allParams.find(pa => pa.id === pr.parameterId);
            return param ? { ...param, width: pr.width || "50%" } : null;
          })
          .filter(Boolean) as (MirrorAllParam & { width: string })[];
        result.push({ id: panelDef.id, name: panelDef.name, parameters });
      }
    }
    return result;
  }, [blueprint, allPanels, allParams]);

  return (
    <div
      className="border-2 border-blue-300/40 dark:border-blue-700/30 rounded-lg overflow-hidden bg-blue-50/10 dark:bg-blue-900/5"
      data-testid={`blueprint-mirror-panel-${panel.id}`}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-200/40 dark:border-blue-800/30 bg-blue-50/40 dark:bg-blue-900/20">
        <ArrowLeftRight className="h-3.5 w-3.5 text-blue-400" />
        <span className="text-sm font-semibold">{panel.name}</span>
        <Badge variant="outline" className="text-[10px] border-blue-300/50 text-blue-500 py-0 px-1.5 ml-1">
          Zrkadlový blok · {sourceType}
        </Badge>
        <span className="ml-auto text-xs text-blue-400/70">Cross-Pull</span>
      </div>
      {enrichedPanels.length === 0 ? (
        <div className="px-3 py-3 text-xs text-muted-foreground">
          B-Vízia šablóna pre {sourceType} nie je definovaná alebo nemá polia.
        </div>
      ) : (
        <div className="p-3 space-y-3">
          {enrichedPanels.map(ep => (
            <div key={ep.id}>
              {enrichedPanels.length > 1 && (
                <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-400/70 mb-1.5">{ep.name}</div>
              )}
              <div className="grid grid-cols-4 gap-3">
                {ep.parameters.map(param => {
                  const rawVal = subjectDynamicFields[param.name] ?? subjectDynamicFields[param.name.toLowerCase().replace(/\s+/g, "_")] ?? "";
                  const strVal = rawVal !== null && rawVal !== undefined ? String(rawVal) : "";
                  return (
                    <div key={param.id} className={cn("flex flex-col gap-1", widthToColSpan(param.width))} data-testid={`mirror-param-field-${ep.id}-${param.id}`}>
                      <label className="text-xs font-medium flex items-center gap-1 text-blue-600/80 dark:text-blue-400/80">
                        {param.name}
                        <Link2 className="h-3 w-3 text-blue-400/60" />
                      </label>
                      {strVal ? (
                        <div className="text-sm min-h-[32px] px-3 py-1.5 bg-blue-50/30 dark:bg-blue-900/10 rounded border border-blue-200/40 dark:border-blue-800/30 flex items-center">
                          {strVal}
                        </div>
                      ) : (
                        <div className="text-sm min-h-[32px] px-3 py-1.5 rounded border border-dashed border-blue-200/40 dark:border-blue-700/30 flex items-center text-muted-foreground/50 text-xs">
                          —
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// A-VÍZIA BLUEPRINT RENDERER
// Renders product blueprint: Folders (tabs) → Panels (grid) → Parameters
// ============================================================
interface BlueprintRendererProps {
  productId: number | string;
  values?: Record<string, string>;
  onChange?: (panelId: number, paramId: number, value: string) => void;
  crossPullValues?: Record<string, string>;
  subjectDynamicFields?: Record<string, any>;
  readOnly?: boolean;
  compact?: boolean;
  colorScheme?: ColorScheme;
}

export function BlueprintRenderer({
  productId, values = {}, onChange, crossPullValues, subjectDynamicFields, readOnly, compact, colorScheme = "default",
}: BlueprintRendererProps) {
  const colors = COLOR_SCHEME_STYLES[colorScheme];
  const [activeTab, setActiveTab] = useState(0);

  const { data: blueprint, isLoading } = useQuery<FullBlueprint>({
    queryKey: ["/api/sector-products", productId, "full-blueprint"],
    queryFn: () =>
      apiRequest("GET", `/api/sector-products/${productId}/full-blueprint`).then(r => r.json()),
    enabled: !!productId,
  });

  const noop = (pid: number, paramId: number, val: string) => {};
  const handleChange = onChange || noop;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!blueprint || !blueprint.folders || blueprint.folders.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-4 px-3 border rounded-md bg-muted/20">
        <Info className="h-4 w-4" />
        <span>Pre tento produkt nie je definovaná A-Vízia šablóna.</span>
      </div>
    );
  }

  const activeFolder = blueprint.folders[activeTab] || blueprint.folders[0];

  return (
    <div className="space-y-3" data-testid="blueprint-renderer">
      {/* Folder tabs */}
      {blueprint.folders.length > 1 && (
        <div className="flex gap-0.5 border-b overflow-x-auto">
          {blueprint.folders.map((folder, idx) => (
            <button
              key={folder.id}
              onClick={() => setActiveTab(idx)}
              data-testid={`blueprint-tab-${folder.id}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === idx
                  ? colors.tabActive
                  : cn("border-transparent text-muted-foreground hover:text-foreground", colors.tabBorder)
              )}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {folder.name}
              <span className="text-xs text-muted-foreground">({folder.panels.reduce((s, p) => s + p.parameters.length, 0)})</span>
            </button>
          ))}
        </div>
      )}

      {/* Active folder panels */}
      <div className="space-y-3">
        {activeFolder.panels.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Žiadne panely v tomto priečinku.</div>
        ) : (
          activeFolder.panels.map(panel => {
            if (panel.type === "MIRROR") {
              return (
                <MirrorPanel
                  key={`mirror-${panel.id}`}
                  panel={panel}
                  subjectDynamicFields={subjectDynamicFields || crossPullValues}
                />
              );
            }
            return (
              <PanelCard
                key={panel.id}
                panel={panel}
                values={values}
                onChange={handleChange}
                crossPullValues={crossPullValues}
                readOnly={readOnly}
                colors={colors}
              />
            );
          })
        )}
      </div>

      {/* Cross-pull info */}
      {crossPullValues && Object.keys(crossPullValues).length > 0 && !compact && (
        <div className="flex items-center gap-1.5 text-xs text-blue-500/80 pt-1">
          <Link2 className="h-3 w-3" />
          <span>Polia označené <Link2 className="inline h-3 w-3 mx-0.5" /> sú predplnené z profilu subjektu (Cross-Pull)</span>
        </div>
      )}
    </div>
  );
}

// ============================================================
// B-VÍZIA SUBJECT BLUEPRINT SECTION
// Renders subject blueprint: MegaBlocks → Panels → Parameters
// Used inside subject profile as a read/edit section
// ============================================================

type SubjectCode = "FO" | "PO" | "SZCO" | "VS" | "TS" | "OS";

const CLIENT_TYPE_TO_CODE: Record<number, SubjectCode> = {
  1: "FO",
  3: "SZCO",
  4: "PO",
  5: "TS",
  6: "VS",
  7: "OS",
};

interface SubjectBlueprintSectionProps {
  clientTypeId?: number | null;
  subjectCode?: SubjectCode;
  dynamicFields?: Record<string, any>;
  readOnly?: boolean;
  compact?: boolean;
}

interface SubjectMegaBlock {
  id: string;
  name: string;
  order: number;
  panels: {
    panelId: number;
    order: number;
    parameters: { parameterId: number; order: number; width: string }[];
  }[];
}

interface SubjectBlueprintData {
  id: number;
  type: string;
  targetId: string;
  layoutJson: { megaBlocks: SubjectMegaBlock[] };
}

interface AllPanel { id: number; name: string; description?: string | null; }
interface AllParam { id: number; name: string; paramType: string; helpText?: string | null; options?: string[]; isRequired?: boolean; defaultValue?: string | null; }

// ── Internal helper: renders a set of megaBlocks with tabs + panels ──
interface MegaBlockGroupProps {
  megaBlocks: (SubjectMegaBlock & { panels: (AllPanel & { parameters: (AllParam & { width: string })[] })[] })[];
  dynamicFields: Record<string, any>;
  compact: boolean;
  inherited?: boolean;
}

function MegaBlockGroup({ megaBlocks, dynamicFields, compact, inherited = false }: MegaBlockGroupProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = Math.min(activeIdx, Math.max(megaBlocks.length - 1, 0));
  const activeBlock = megaBlocks[safeIdx];

  const borderStyle = inherited
    ? "border-2 border-slate-200/70 dark:border-slate-700/50 rounded-lg overflow-hidden"
    : "border-2 border-emerald-200/60 dark:border-emerald-800/40 rounded-lg overflow-hidden";
  const headerBg = inherited
    ? "bg-slate-50/70 dark:bg-slate-800/30 border-b border-slate-200/50 dark:border-slate-700/40"
    : "bg-emerald-50/60 dark:bg-emerald-900/20 border-b border-emerald-200/40 dark:border-emerald-800/30";
  const iconColor = inherited ? "text-slate-500/60" : "text-emerald-600/70";
  const tabActive = inherited ? "border-slate-500 text-slate-600 dark:text-slate-300" : "border-emerald-500 text-emerald-600";
  const tabHover = "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40";

  if (!activeBlock) {
    return (
      <div className="text-sm text-muted-foreground py-3 text-center italic">
        {inherited ? "FO základ zatiaľ neobsahuje žiadne bloky." : "Žiadne bloky v šablóne."}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {megaBlocks.length > 1 && (
        <div className="flex gap-0.5 border-b overflow-x-auto">
          {megaBlocks.map((mb, idx) => (
            <button
              key={mb.id}
              onClick={() => setActiveIdx(idx)}
              data-testid={`subject-blueprint-tab-${mb.id}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                safeIdx === idx ? tabActive : tabHover
              )}
            >
              {mb.name}
            </button>
          ))}
        </div>
      )}

      <div className={compact ? "space-y-2" : "space-y-3"}>
        {(activeBlock.panels || []).length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Žiadne panely v tomto bloku.</div>
        ) : (
          (activeBlock.panels as (AllPanel & { parameters: (AllParam & { width: string })[] })[]).map(panel => (
            <div
              key={panel.id}
              className={borderStyle}
              data-testid={`subject-panel-${panel.id}${inherited ? "-inherited" : ""}`}
            >
              <div className={cn("flex items-center gap-2 px-3 py-2", headerBg)}>
                <LayoutGrid className={cn("h-3.5 w-3.5", iconColor)} />
                <span className="text-sm font-semibold">{panel.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{panel.parameters.length} polí</span>
              </div>
              <div className={cn("p-3 grid grid-cols-4 gap-3", compact && "gap-2", inherited && "bg-muted/10")}>
                {panel.parameters.map(param => {
                  const rawVal = dynamicFields[param.name] ?? dynamicFields[param.name.toLowerCase().replace(/\s+/g, "_")] ?? "";
                  const strVal = rawVal !== null && rawVal !== undefined ? String(rawVal) : "";
                  return (
                    <div key={param.id} className={cn("flex flex-col gap-1", widthToColSpan(param.width))} data-testid={`subject-param-field-${param.id}`}>
                      <label className={cn("text-xs font-medium", inherited && "text-muted-foreground")}>{param.name}</label>
                      {strVal ? (
                        <div className={cn("text-sm min-h-[32px] px-3 py-1.5 rounded border flex items-center", inherited ? "bg-muted/20 border-border/60 text-muted-foreground" : "bg-muted/30 border-border")}>
                          {strVal}
                        </div>
                      ) : (
                        <div className="text-sm min-h-[32px] px-3 py-1.5 rounded border border-dashed border-border flex items-center text-muted-foreground/50 text-xs">
                          —
                        </div>
                      )}
                      {param.helpText && (
                        <p className="text-[10px] text-muted-foreground">{param.helpText}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SubjectBlueprintSection({
  clientTypeId, subjectCode, dynamicFields = {}, readOnly = true, compact = false,
}: SubjectBlueprintSectionProps) {
  const code: SubjectCode | undefined = subjectCode || (clientTypeId ? CLIENT_TYPE_TO_CODE[clientTypeId] : undefined);
  const isFo = code === "FO";

  const { data: allPanels = [] } = useQuery<AllPanel[]>({ queryKey: ["/api/panels"] });
  const { data: allParams = [] } = useQuery<AllParam[]>({ queryKey: ["/api/parameters"] });

  const { data: blueprint, isLoading } = useQuery<SubjectBlueprintData | null>({
    queryKey: ["/api/ui-blueprints/find", code, "SUBJECT"],
    queryFn: () =>
      code
        ? apiRequest("GET", `/api/ui-blueprints/find?type=SUBJECT&targetId=${code}`).then(r => r.json())
        : Promise.resolve(null),
    enabled: !!code,
  });

  const { data: foBlueprintRaw, isLoading: foLoading } = useQuery<SubjectBlueprintData | null>({
    queryKey: ["/api/ui-blueprints/find", "FO", "SUBJECT"],
    queryFn: () => apiRequest("GET", `/api/ui-blueprints/find?type=SUBJECT&targetId=FO`).then(r => r.json()),
    enabled: !isFo,
  });

  function enrichMegaBlocks(bp: SubjectBlueprintData | null | undefined) {
    if (!bp?.layoutJson?.megaBlocks) return [];
    return bp.layoutJson.megaBlocks
      .map(mb => ({
        ...mb,
        panels: (mb.panels || []).map(p => {
          const panel = allPanels.find(pl => pl.id === p.panelId);
          if (!panel) return null;
          const parameters: (AllParam & { width: string })[] = (p.parameters || [])
            .map(pr => {
              const param = allParams.find(pa => pa.id === pr.parameterId);
              return param ? { ...param, width: pr.width || "50%" } : null;
            })
            .filter(Boolean) as (AllParam & { width: string })[];
          return { ...panel, parameters };
        }).filter(Boolean),
      }))
      .sort((a, b) => a.order - b.order) as (SubjectMegaBlock & { panels: (AllPanel & { parameters: (AllParam & { width: string })[] })[] })[];
  }

  const megaBlocks = useMemo(() => enrichMegaBlocks(blueprint), [blueprint, allPanels, allParams]);
  const foMegaBlocks = useMemo(() => enrichMegaBlocks(foBlueprintRaw), [foBlueprintRaw, allPanels, allParams]);

  if (!code) return null;
  if (isLoading || (!isFo && foLoading)) return <Skeleton className="h-24 w-full" />;

  // FO: only own blocks
  if (isFo) {
    if (!blueprint || megaBlocks.length === 0) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground text-sm py-3 px-3 border rounded-md bg-muted/20">
          <Info className="h-4 w-4" />
          <span>Pre typ FO nie je definovaná B-Vízia šablóna.</span>
        </div>
      );
    }
    return (
      <div className="space-y-3" data-testid="subject-blueprint-section">
        <MegaBlockGroup megaBlocks={megaBlocks} dynamicFields={dynamicFields} compact={compact} />
      </div>
    );
  }

  // Non-FO: show inherited FO section + own type-specific section
  const hasOwnBlocks = megaBlocks.length > 0;
  const hasFoBlocks = foMegaBlocks.length > 0;

  if (!hasFoBlocks && !hasOwnBlocks) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-3 px-3 border rounded-md bg-muted/20">
        <Info className="h-4 w-4" />
        <span>Pre typ {code} nie je definovaná B-Vízia šablóna.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="subject-blueprint-section">
      {/* Inherited FO section */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden" data-testid="subject-blueprint-fo-inherited">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-700">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Zdedené z FO</span>
        </div>
        <div className="p-3">
          <MegaBlockGroup megaBlocks={foMegaBlocks} dynamicFields={dynamicFields} compact={compact} inherited={true} />
        </div>
      </div>

      {/* Type-specific section */}
      {hasOwnBlocks && (
        <div className="space-y-3" data-testid="subject-blueprint-own">
          <MegaBlockGroup megaBlocks={megaBlocks} dynamicFields={dynamicFields} compact={compact} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// CONTRACT BLUEPRINT VIEW
// Read-only view of A-Vízia parameters stored in dynamicPanelValues
// Used in the contract detail dialog (nahratieViewDialog)
// ============================================================
interface ContractBlueprintViewProps {
  productId: number | string;
  dynamicPanelValues?: Record<string, string>;
  subjectDynamicFields?: Record<string, any>;
  colorScheme?: ColorScheme;
}

export function ContractBlueprintView({
  productId, dynamicPanelValues = {}, subjectDynamicFields, colorScheme = "default",
}: ContractBlueprintViewProps) {
  const colors = COLOR_SCHEME_STYLES[colorScheme];
  const [activeTab, setActiveTab] = useState(0);

  const { data: blueprint, isLoading } = useQuery<FullBlueprint>({
    queryKey: ["/api/sector-products", productId, "full-blueprint"],
    queryFn: () =>
      apiRequest("GET", `/api/sector-products/${productId}/full-blueprint`).then(r => r.json()),
    enabled: !!productId,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  if (!blueprint || !blueprint.folders || blueprint.folders.length === 0) {
    return null;
  }

  // Check if there's any data stored
  const hasData = Object.keys(dynamicPanelValues).length > 0;
  if (!hasData) return null;

  const activeFolder = blueprint.folders[activeTab] || blueprint.folders[0];

  return (
    <div className="space-y-3" data-testid="contract-blueprint-view">
      {/* Folder tabs */}
      {blueprint.folders.length > 1 && (
        <div className="flex gap-0.5 border-b overflow-x-auto">
          {blueprint.folders.map((folder, idx) => (
            <button
              key={folder.id}
              onClick={() => setActiveTab(idx)}
              data-testid={`contract-blueprint-tab-${folder.id}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === idx
                  ? colors.tabActive
                  : cn("border-transparent text-muted-foreground hover:text-foreground", colors.tabBorder)
              )}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {folder.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {activeFolder.panels.map(panel => {
          if (panel.type === "MIRROR") {
            return (
              <MirrorPanel
                key={`mirror-${panel.id}`}
                panel={panel}
                subjectDynamicFields={subjectDynamicFields}
              />
            );
          }

          const panelParams = panel.parameters.filter(param => {
            const key = `${panel.id}_${param.id}`;
            return dynamicPanelValues[key];
          });

          if (panelParams.length === 0) return null;

          return (
            <div
              key={panel.id}
              className={cn("border-2 rounded-lg overflow-hidden", colors.panelBorder)}
              data-testid={`contract-blueprint-panel-${panel.id}`}
            >
              <div className={cn("flex items-center gap-2 px-3 py-2 border-b", colors.panelHeader)}>
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold">{panel.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{panelParams.length} polí</span>
              </div>
              <div className="p-3 grid grid-cols-4 gap-3">
                {panelParams.map(param => {
                  const key = `${panel.id}_${param.id}`;
                  const val = dynamicPanelValues[key] || "";
                  return (
                    <div
                      key={param.id}
                      className={cn("flex flex-col gap-1", widthToColSpan(param.width))}
                      data-testid={`contract-param-field-${panel.id}-${param.id}`}
                    >
                      <label className="text-xs font-medium text-muted-foreground">{param.name}</label>
                      <div className="text-sm min-h-[32px] px-3 py-1.5 bg-muted/20 rounded border border-border flex items-center">
                        {val || <span className="text-muted-foreground/50 text-xs">—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
