/**
 * BlueprintRenderer — Task #127
 * Renders product blueprints (A-Vízia) with folder tabs, panel grid, parameter fields.
 * Also provides SubjectBlueprintSection (B-Vízia) for rendering subject blueprints.
 *
 * Cross-Pulling: contract parameters can pull values from subject's dynamicFields.
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
import { FolderOpen, LayoutGrid, AlignLeft, Link2, Info } from "lucide-react";
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
}

function ParamField({ param, panelId, value, onChange, crossValue, readOnly }: ParamFieldProps) {
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
}

function ParameterInput({ param, panelId, value, onChange, readOnly, isCrossPulled }: ParamInputProps) {
  const baseClass = cn(
    "text-sm",
    isCrossPulled && "border-blue-300/50 bg-blue-50/20 dark:bg-blue-900/10"
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
}

function PanelCard({ panel, values, onChange, crossPullValues, readOnly }: PanelCardProps) {
  if (panel.parameters.length === 0) return null;

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`blueprint-panel-${panel.id}`}>
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
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
            />
          );
        })}
      </div>
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
  readOnly?: boolean;
  compact?: boolean;
}

export function BlueprintRenderer({
  productId, values = {}, onChange, crossPullValues, readOnly, compact,
}: BlueprintRendererProps) {
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
  const allPanelsFlat = useMemo(() => blueprint.folders.flatMap(f => f.panels), [blueprint]);

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
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
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
          activeFolder.panels.map(panel => (
            <PanelCard
              key={panel.id}
              panel={panel}
              values={values}
              onChange={handleChange}
              crossPullValues={crossPullValues}
              readOnly={readOnly}
            />
          ))
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

export function SubjectBlueprintSection({
  clientTypeId, subjectCode, dynamicFields = {}, readOnly = true,
}: SubjectBlueprintSectionProps) {
  const [activeBlockIdx, setActiveBlockIdx] = useState(0);

  const code: SubjectCode | undefined = subjectCode || (clientTypeId ? CLIENT_TYPE_TO_CODE[clientTypeId] : undefined);

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

  // Enrich mega blocks with panel/param data
  const megaBlocks = useMemo(() => {
    if (!blueprint?.layoutJson?.megaBlocks) return [];
    return blueprint.layoutJson.megaBlocks
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
      .sort((a, b) => a.order - b.order);
  }, [blueprint, allPanels, allParams]);

  if (!code) return null;
  if (isLoading) return <Skeleton className="h-24 w-full" />;
  if (!blueprint || megaBlocks.length === 0) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm py-3 px-3 border rounded-md bg-muted/20">
        <Info className="h-4 w-4" />
        <span>Pre typ {code} nie je definovaná B-Vízia šablóna.</span>
      </div>
    );
  }

  const activeBlock = megaBlocks[activeBlockIdx] || megaBlocks[0];

  return (
    <div className="space-y-3" data-testid="subject-blueprint-section">
      {/* MegaBlock tabs */}
      {megaBlocks.length > 1 && (
        <div className="flex gap-0.5 border-b overflow-x-auto">
          {megaBlocks.map((mb, idx) => (
            <button
              key={mb.id}
              onClick={() => setActiveBlockIdx(idx)}
              data-testid={`subject-blueprint-tab-${mb.id}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeBlockIdx === idx
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40"
              )}
            >
              {mb.name}
            </button>
          ))}
        </div>
      )}

      {/* Panels in active block */}
      <div className="space-y-3">
        {(activeBlock?.panels || []).length === 0 ? (
          <div className="text-sm text-muted-foreground py-4 text-center">Žiadne panely v tomto bloku.</div>
        ) : (
          (activeBlock.panels as (AllPanel & { parameters: (AllParam & { width: string })[] })[]).map(panel => (
            <div key={panel.id} className="border rounded-lg overflow-hidden" data-testid={`subject-panel-${panel.id}`}>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b">
                <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold">{panel.name}</span>
              </div>
              <div className="p-3 grid grid-cols-4 gap-3">
                {panel.parameters.map(param => {
                  const rawVal = dynamicFields[param.name] ?? dynamicFields[param.name.toLowerCase().replace(/\s+/g, "_")] ?? "";
                  const strVal = rawVal !== null && rawVal !== undefined ? String(rawVal) : "";
                  return (
                    <div key={param.id} className={cn("flex flex-col gap-1", widthToColSpan(param.width))} data-testid={`subject-param-field-${param.id}`}>
                      <label className="text-xs font-medium">{param.name}</label>
                      {strVal ? (
                        <div className="text-sm min-h-[32px] px-3 py-1.5 bg-muted/30 rounded border border-border flex items-center">
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
