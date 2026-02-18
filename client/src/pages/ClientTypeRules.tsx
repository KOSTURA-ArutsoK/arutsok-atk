import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTableSort } from "@/hooks/use-table-sort";
import { useAppUser } from "@/hooks/use-app-user";
import { useToast } from "@/hooks/use-toast";
import type { ClientType, ClientTypeSection, ClientTypePanel, ClientTypeField } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ConditionalDelete } from "@/components/conditional-delete";
import {
  Plus, Settings2, Layers, ArrowLeft, Pencil,
  Type, AlignLeft, List, CheckSquare, ToggleLeft, Phone, Mail,
  Hash, Image, Calendar, CreditCard, Search, Loader2,
  FolderOpen, GripVertical, HelpCircle, X, Info,
} from "lucide-react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const FIELD_TYPES = [
  { value: "short_text", label: "Kratky text", icon: Type },
  { value: "long_text", label: "Dlhy text", icon: AlignLeft },
  { value: "combobox", label: "Combobox", icon: List },
  { value: "jedna_moznost", label: "Jedna moznost (Single Select)", icon: List },
  { value: "viac_moznosti", label: "Viac moznosti (Multi-select)", icon: CheckSquare },
  { value: "checkbox", label: "Checkbox", icon: CheckSquare },
  { value: "switch", label: "Ano/Nie", icon: ToggleLeft },
  { value: "phone", label: "Telefon", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "number", label: "Cislo", icon: Hash },
  { value: "file", label: "Foto/Subor", icon: Image },
  { value: "date", label: "Datum", icon: Calendar },
  { value: "iban", label: "IBAN", icon: CreditCard },
  { value: "decimal", label: "Desatinne cislo", icon: Hash },
];

function isSelectFieldType(t: string): boolean {
  return ["combobox", "jedna_moznost", "viac_moznosti"].includes(t);
}

function SortableRow({ id, children }: { id: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <TableRow ref={setNodeRef} style={style} data-testid={`row-sortable-${id}`}>
      <TableCell className="w-8 cursor-grab">
        <span {...attributes} {...listeners} data-testid={`handle-sortable-${id}`}>
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </span>
      </TableCell>
      {children}
    </TableRow>
  );
}

function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onConfirm: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle data-testid="text-delete-dialog-title">Potvrdit vymazanie</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="flex items-center justify-end gap-2 mt-4 flex-wrap">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-delete-cancel">
            Zrusit
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isPending} data-testid="button-delete-confirm">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vymazat"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddTypeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [basePar, setBasePar] = useState("rc");

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/client-types", { code: code.toUpperCase(), name, baseParameter: basePar });
    },
    onSuccess: () => {
      toast({ title: "Vytvorene" });
      queryClient.invalidateQueries({ queryKey: ["/api/client-types"] });
      onOpenChange(false);
      setCode(""); setName(""); setBasePar("rc");
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" className="flex flex-col items-stretch justify-start">
        <DialogHeader><DialogTitle>Novy typ klienta</DialogTitle></DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Kod</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="napr. FO" data-testid="input-type-code" />
          </div>
          <div>
            <Label className="text-xs">Nazov</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="napr. Fyzicka osoba" data-testid="input-type-name" />
          </div>
          <div>
            <Label className="text-xs">Zakladny parameter</Label>
            <Select value={basePar} onValueChange={setBasePar}>
              <SelectTrigger data-testid="select-base-param"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rc">Rodne cislo (RC)</SelectItem>
                <SelectItem value="ico">ICO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrusit</Button>
          <Button onClick={() => mutation.mutate()} disabled={!code.trim() || !name.trim() || mutation.isPending} data-testid="button-save-type">
            Vytvorit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldFormDialog({
  open,
  onOpenChange,
  editingField,
  clientTypeId,
  panels,
  existingFields,
  sectionId,
  defaultCategory,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingField: ClientTypeField | null;
  clientTypeId: number;
  panels: ClientTypePanel[];
  existingFields: ClientTypeField[];
  sectionId: number | null;
  defaultCategory?: string;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [fieldKey, setFieldKey] = useState("");
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState("short_text");
  const [panelId, setPanelId] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [options, setOptions] = useState("");
  const [dependsOn, setDependsOn] = useState("");
  const [dependsValue, setDependsValue] = useState("");
  const [unit, setUnit] = useState("");
  const [decimalPlaces, setDecimalPlaces] = useState(2);
  useEffect(() => {
    if (open) {
      if (editingField) {
        setFieldKey(editingField.fieldKey);
        setLabel(editingField.label);
        setFieldType(editingField.fieldType);
        setPanelId(editingField.panelId?.toString() || "");
        setIsRequired(editingField.isRequired || false);
        setOptions(editingField.options?.join(", ") || "");
        const vr = editingField.visibilityRule as any;
        setDependsOn(vr?.dependsOn || "");
        setDependsValue(vr?.value || "");
        setUnit((editingField as any).unit || "");
        setDecimalPlaces((editingField as any).decimalPlaces ?? 2);
      } else {
        setFieldKey(""); setLabel(""); setFieldType("short_text"); setPanelId("");
        setIsRequired(false); setOptions(""); setDependsOn(""); setDependsValue("");
        setUnit(""); setDecimalPlaces(2);
      }
    }
  }, [open, editingField]);

  const fieldCategory = editingField ? ((editingField as any).fieldCategory || "povinne") : (defaultCategory || "povinne");

  function buildPayload() {
    const normalizedDependsOn = dependsOn && dependsOn !== "none" ? dependsOn : "";
    const visibilityRule = normalizedDependsOn && dependsValue
      ? { dependsOn: normalizedDependsOn, value: dependsValue }
      : null;
    const normalizedPanelId = panelId && panelId !== "none" ? Number(panelId) : null;
    return { visibilityRule, normalizedPanelId };
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const { visibilityRule, normalizedPanelId } = buildPayload();
      await apiRequest("POST", `/api/client-types/${clientTypeId}/fields`, {
        fieldKey: fieldKey.trim(),
        label: label.trim(),
        fieldType,
        panelId: normalizedPanelId,
        sectionId: sectionId,
        isRequired,
        options: options ? options.split(",").map(o => o.trim()).filter(Boolean) : [],
        visibilityRule,
        sortOrder: existingFields.length,
        unit: fieldType === "decimal" ? (unit || null) : null,
        decimalPlaces: fieldType === "decimal" ? decimalPlaces : null,
        fieldCategory,
      });
    },
    onSuccess: () => {
      toast({ title: "Parameter vytvoreny" });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && typeof key[0] === "string" && (key[0] as string).startsWith("/api/client-types");
      }});
      onOpenChange(false);
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { visibilityRule, normalizedPanelId } = buildPayload();
      await apiRequest("PATCH", `/api/client-type-fields/${editingField!.id}`, {
        fieldKey: fieldKey.trim(),
        label: label.trim(),
        fieldType,
        panelId: normalizedPanelId,
        isRequired,
        options: options ? options.split(",").map(o => o.trim()).filter(Boolean) : [],
        visibilityRule,
        unit: fieldType === "decimal" ? (unit || null) : null,
        decimalPlaces: fieldType === "decimal" ? decimalPlaces : null,
        fieldCategory,
      });
    },
    onSuccess: () => {
      toast({ title: "Parameter aktualizovany" });
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && typeof key[0] === "string" && (key[0] as string).startsWith("/api/client-types");
      }});
      onOpenChange(false);
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const showOptions = isSelectFieldType(fieldType);
  const [newOptionText, setNewOptionText] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="flex flex-col items-stretch justify-start">
        <DialogHeader><DialogTitle>{editingField ? "Upravit parameter" : "Novy parameter"}</DialogTitle></DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-xs">Kluc parametra</Label>
              <Input value={fieldKey} onChange={(e) => setFieldKey(e.target.value)} placeholder="napr. korespondencna_adresa" data-testid="input-field-key" />
            </div>
            <div>
              <Label className="text-xs">Nazov (label)</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="napr. Korespondencna adresa" data-testid="input-field-label" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Typ parametra</Label>
              <Select value={fieldType} onValueChange={setFieldType}>
                <SelectTrigger data-testid="select-field-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map(ft => (
                    <SelectItem key={ft.value} value={ft.value}>{ft.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Kategoria</Label>
              <div className="mt-1.5">
                <Badge variant="outline" data-testid="badge-field-category-info">
                  {fieldCategory === 'povinne' ? 'POVINNE UDAJE' : fieldCategory === 'doplnkove' ? 'DOPLNKOVE UDAJE' : 'VOLITELNE UDAJE'}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-xs">Panel</Label>
              <Select value={panelId} onValueChange={setPanelId}>
                <SelectTrigger data-testid="select-field-panel"><SelectValue placeholder="Bez panelu" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Bez panelu</SelectItem>
                  {panels.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div style={{ display: fieldType === "decimal" ? 'block' : 'none' }} className="rounded-md border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Nastavenia desatinneho cisla</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" data-testid="icon-ct-decimal-info" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]" data-testid="tooltip-ct-decimal-info">
                  <p className="text-xs">Pouzite pre sumy, percenta alebo kryptomeny. Podporuje presnost az na 8 desatinnych miest.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Jednotka (Suffix)</label>
                <Input
                  value={unit}
                  onChange={e => setUnit(e.target.value)}
                  placeholder="napr. €, %, BTC, ETH"
                  data-testid="input-ct-field-unit"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Pocet desatinnych miest</label>
                <Select value={decimalPlaces.toString()} onValueChange={v => setDecimalPlaces(parseInt(v))}>
                  <SelectTrigger data-testid="select-ct-field-decimal-places">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0,1,2,3,4,5,6,7,8].map(n => (
                      <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className={`rounded-md border border-border p-4 space-y-3 ${!showOptions ? "opacity-50" : ""}`} style={{ display: showOptions || fieldType === "combobox" ? 'block' : 'block' }}>
            <div className="flex items-center gap-2 flex-wrap">
              <List className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Moznosti vyberu</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="cursor-help" data-testid="icon-field-options-info">
                    <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]" data-testid="tooltip-field-options-info">
                  <p className="text-xs">Pouzite pre pevne definovane zoznamy (ciselniky), aby sa predislo preklepom pri rucnom pisani.</p>
                </TooltipContent>
              </Tooltip>
              <span style={{ display: !showOptions ? 'inline' : 'none' }} className="text-xs text-muted-foreground ml-auto">Dostupne len pre typy s vyberom moznosti</span>
            </div>
            <div style={{ display: showOptions ? 'block' : 'none' }}>
              <div style={{ display: options ? 'block' : 'none' }}>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {options.split(",").map(o => o.trim()).filter(Boolean).map((opt, i) => (
                    <Badge key={i} variant="secondary" className="flex items-center gap-1">
                      {opt}
                      <button
                        type="button"
                        className="ml-1 hover:text-destructive"
                        onClick={() => {
                          const arr = options.split(",").map(o => o.trim()).filter(Boolean);
                          arr.splice(i, 1);
                          setOptions(arr.join(", "));
                        }}
                        data-testid={`button-remove-option-${i}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={newOptionText}
                  onChange={(e) => setNewOptionText(e.target.value)}
                  placeholder="Pridaj moznost..."
                  className="flex-1"
                  data-testid="input-add-option"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newOptionText.trim()) {
                      e.preventDefault();
                      const existing = options ? options.split(",").map(o => o.trim()).filter(Boolean) : [];
                      existing.push(newOptionText.trim());
                      setOptions(existing.join(", "));
                      setNewOptionText("");
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={!newOptionText.trim()}
                  onClick={() => {
                    const existing = options ? options.split(",").map(o => o.trim()).filter(Boolean) : [];
                    existing.push(newOptionText.trim());
                    setOptions(existing.join(", "));
                    setNewOptionText("");
                  }}
                  data-testid="button-add-option"
                >
                  <Plus className="w-4 h-4 mr-1" /> Pridat
                </Button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Checkbox
              id="field-required"
              checked={isRequired}
              onCheckedChange={(c) => setIsRequired(!!c)}
              data-testid="checkbox-field-required"
            />
            <Label htmlFor="field-required" className="text-sm cursor-pointer">Povinne pole</Label>
          </div>

          <Separator />

          <div>
            <Label className="text-xs font-semibold">Podmienena viditelnost</Label>
            <p className="text-xs text-muted-foreground mb-2">Toto pole sa zobrazi len ak ine pole ma urcitu hodnotu.</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Zavisi od pola</Label>
                <Select value={dependsOn} onValueChange={setDependsOn}>
                  <SelectTrigger data-testid="select-depends-on"><SelectValue placeholder="Ziadne" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ziadne</SelectItem>
                    {existingFields.filter(f => f.id !== editingField?.id).map(f => (
                      <SelectItem key={f.fieldKey} value={f.fieldKey}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Hodnota</Label>
                <Input value={dependsValue} onChange={(e) => setDependsValue(e.target.value)} placeholder="napr. Ano" data-testid="input-depends-value" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrusit</Button>
          <Button
            onClick={() => {
              if (editingField) updateMutation.mutate();
              else createMutation.mutate();
            }}
            disabled={!fieldKey.trim() || !label.trim() || isPending}
            data-testid="button-save-field"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingField ? "Ulozit" : "Vytvorit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InlineNumberInput({ value, onChange, min, max, suffix, testId }: {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  testId?: string;
}) {
  const [localValue, setLocalValue] = useState(String(value));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const commitValue = useCallback((val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    const clamped = Math.max(min ?? 0, Math.min(max ?? 999, num));
    if (clamped !== value) {
      onChange(clamped);
    }
  }, [min, max, value, onChange]);

  const handleChange = (e: { target: { value: string } }) => {
    const val = e.target.value;
    setLocalValue(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => commitValue(val), 600);
  };

  const handleBlur = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    commitValue(localValue);
  };

  const handleKeyDown = (e: { key: string }) => {
    if (e.key === "Enter") {
      if (timerRef.current) clearTimeout(timerRef.current);
      commitValue(localValue);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Input
        type="number"
        value={localValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        className="w-16 text-xs text-center"
        data-testid={testId}
      />
      <span style={{ display: suffix ? 'inline' : 'none' }} className="text-xs text-muted-foreground">{suffix}</span>
    </div>
  );
}

function FieldTable({
  displayFields,
  fieldSortKey,
  fieldSortDirection,
  fieldRequestSort,
  getPanelName,
  layoutMutation,
  setEditingField,
  setDialogOpen,
  useDnd,
}: {
  displayFields: ClientTypeField[];
  fieldSortKey: string | null;
  fieldSortDirection: "asc" | "desc" | null;
  fieldRequestSort: (key: string) => void;
  getPanelName: (panelId: number | null) => string;
  layoutMutation: any;
  setEditingField: (f: ClientTypeField | null) => void;
  setDialogOpen: (open: boolean) => void;
  useDnd: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-8"></TableHead>
          <TableHead sortKey="label" sortDirection={fieldSortKey === "label" ? fieldSortDirection : null} onSort={fieldRequestSort}>Nazov</TableHead>
          <TableHead sortKey="fieldType" sortDirection={fieldSortKey === "fieldType" ? fieldSortDirection : null} onSort={fieldRequestSort}>Typ</TableHead>
          <TableHead sortKey="panelId" sortDirection={fieldSortKey === "panelId" ? fieldSortDirection : null} onSort={fieldRequestSort}>Panel</TableHead>
          <TableHead sortKey="isRequired" sortDirection={fieldSortKey === "isRequired" ? fieldSortDirection : null} onSort={fieldRequestSort}>Povinne</TableHead>
          <TableHead sortKey="rowNumber" sortDirection={fieldSortKey === "rowNumber" ? fieldSortDirection : null} onSort={fieldRequestSort}>Riadok</TableHead>
          <TableHead sortKey="widthPercent" sortDirection={fieldSortKey === "widthPercent" ? fieldSortDirection : null} onSort={fieldRequestSort}>Sirka</TableHead>
          <TableHead>Akcie</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {displayFields.map((field) => {
          const ftDef = FIELD_TYPES.find(t => t.value === field.fieldType);
          const Icon = ftDef?.icon || Type;
          const hidden = (field as any).isHidden ?? false;
          const cells = (
            <>
              <TableCell>
                <div className={hidden ? "opacity-40" : ""}>
                  <span className="font-medium text-sm">{field.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{field.fieldKey}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 flex-wrap">
                  <Icon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs">{ftDef?.label || field.fieldType}</span>
                  <span style={{ display: field.fieldType === "decimal" && (field as any).unit ? 'inline' : 'none' }} className="text-xs text-muted-foreground">{(field as any).unit}</span>
                  <span style={{ display: field.fieldType === "decimal" ? 'inline' : 'none' }} className="text-xs text-muted-foreground">({(field as any).decimalPlaces ?? 2} des.)</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{getPanelName(field.panelId)}</Badge>
              </TableCell>
              <TableCell>
                <Switch
                  checked={field.isRequired ?? false}
                  onCheckedChange={(checked) => layoutMutation.mutate({ id: field.id, data: { isRequired: checked } })}
                  data-testid={`switch-required-${field.id}`}
                />
              </TableCell>
              <TableCell>
                <InlineNumberInput
                  value={(field as any).rowNumber ?? 0}
                  onChange={(val) => layoutMutation.mutate({ id: field.id, data: { rowNumber: val } })}
                  min={0}
                  max={99}
                  testId={`input-row-number-${field.id}`}
                />
              </TableCell>
              <TableCell>
                <InlineNumberInput
                  value={(field as any).widthPercent ?? 100}
                  onChange={(val) => layoutMutation.mutate({ id: field.id, data: { widthPercent: val } })}
                  min={10}
                  max={100}
                  suffix="%"
                  testId={`input-width-percent-${field.id}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditingField(field); setDialogOpen(true); }} data-testid={`button-edit-parameter-${field.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => layoutMutation.mutate({ id: field.id, data: { isHidden: !hidden } })}
                        data-testid={`button-toggle-visibility-${field.id}`}
                      >
                        <Layers className={`w-4 h-4 ${hidden ? 'text-muted-foreground opacity-40' : 'text-amber-500'}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{hidden ? 'Zobraziť parameter' : 'Skryť parameter'}</TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
            </>
          );
          if (useDnd) {
            return (
              <SortableRow key={field.id} id={field.id}>
                {cells}
              </SortableRow>
            );
          }
          return (
            <TableRow key={field.id} data-testid={`row-parameter-${field.id}`}>
              <TableCell className="w-8">
                <GripVertical className="w-4 h-4 text-muted-foreground opacity-30" />
              </TableCell>
              {cells}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function FolderSection({
  section,
  fields,
  panels,
  allFields,
  clientTypeId,
}: {
  section: ClientTypeSection;
  fields: ClientTypeField[];
  panels: ClientTypePanel[];
  allFields: ClientTypeField[];
  clientTypeId: number;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<ClientTypeField | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientTypeField | null>(null);

  const folderCategory = (section as any).folderCategory || "povinne";

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/client-type-fields/${deleteTarget!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && typeof key[0] === "string" && (key[0] as string).startsWith("/api/client-types");
      }});
      toast({ title: "Uspech", description: "Parameter vymazany" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat parameter", variant: "destructive" }),
  });

  const layoutMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { rowNumber?: number; widthPercent?: number; sortOrder?: number; isRequired?: boolean; isHidden?: boolean } }) => {
      await apiRequest("PATCH", `/api/client-type-fields/${id}/layout`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => {
        const key = query.queryKey;
        return Array.isArray(key) && typeof key[0] === "string" && (key[0] as string).startsWith("/api/client-types");
      }});
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa ulozit zmenu", variant: "destructive" }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sorted.findIndex(f => f.id === active.id);
    const newIndex = sorted.findIndex(f => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    reordered.forEach((f, i) => {
      if ((f.sortOrder ?? 0) !== i) {
        layoutMutation.mutate({ id: f.id, data: { sortOrder: i } });
      }
    });
  }

  const sorted = [...fields].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const { sortedData: sortedFields, sortKey: fieldSortKey, sortDirection: fieldSortDirection, requestSort: fieldRequestSort } = useTableSort(sorted);

  function getPanelName(panelId: number | null): string {
    if (!panelId) return "Bez panelu";
    return panels.find(p => p.id === panelId)?.name || `#${panelId}`;
  }

  const displayFields = fieldSortKey ? sortedFields : sorted;

  return (
    <Card data-testid={`folder-section-${section.id}`}>
      <div
        className="flex items-center gap-3 p-4 cursor-pointer select-none flex-wrap"
        onClick={() => setExpanded(!expanded)}
        data-testid={`folder-header-${section.id}`}
      >
        <FolderOpen className="w-5 h-5 text-muted-foreground shrink-0" />
        <span className="font-semibold text-sm flex-1" data-testid={`text-folder-name-${section.id}`}>
          {section.name}
        </span>
        <Badge variant="secondary" data-testid={`badge-folder-field-count-${section.id}`}>
          {fields.length} {fields.length === 1 ? 'parameter' : 'parametrov'}
        </Badge>
        <Layers className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-0' : '-rotate-90'}`} />
      </div>
      <div style={{ display: expanded ? 'block' : 'none' }}>
        <Separator />
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-end">
            <Button size="sm" onClick={() => { setEditingField(null); setDialogOpen(true); }} data-testid={`button-add-parameter-${section.id}`}>
              <Plus className="w-4 h-4 mr-2" /> Pridat parameter
            </Button>
          </div>

          {displayFields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6" data-testid={`text-no-parameters-${section.id}`}>
              Ziadne parametre v tomto priecinku
            </p>
          )}
          {displayFields.length > 0 && !fieldSortKey && (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={displayFields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                <FieldTable
                  displayFields={displayFields}
                  fieldSortKey={fieldSortKey}
                  fieldSortDirection={fieldSortDirection}
                  fieldRequestSort={fieldRequestSort}
                  getPanelName={getPanelName}
                  layoutMutation={layoutMutation}
                  setEditingField={setEditingField}
                  setDialogOpen={setDialogOpen}
                  useDnd={true}
                />
              </SortableContext>
            </DndContext>
          )}
          {displayFields.length > 0 && !!fieldSortKey && (
            <FieldTable
              displayFields={displayFields}
              fieldSortKey={fieldSortKey}
              fieldSortDirection={fieldSortDirection}
              fieldRequestSort={fieldRequestSort}
              getPanelName={getPanelName}
              layoutMutation={layoutMutation}
              setEditingField={setEditingField}
              setDialogOpen={setDialogOpen}
              useDnd={false}
            />
          )}
        </CardContent>
      </div>

      <FieldFormDialog
        open={dialogOpen}
        onOpenChange={(isOpen) => { setDialogOpen(isOpen); if (!isOpen) setEditingField(null); }}
        editingField={editingField}
        clientTypeId={clientTypeId}
        panels={panels.filter(p => p.sectionId === section.id || !p.sectionId)}
        existingFields={allFields}
        sectionId={section.id}
        defaultCategory={folderCategory}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}
        title={`Naozaj chcete vymazat parameter "${deleteTarget?.label}"?`}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
      />
    </Card>
  );
}

function TypeDetailView({ clientType, onBack }: { clientType: ClientType; onBack: () => void }) {
  const { data: sections = [], isLoading: sectionsLoading } = useQuery<ClientTypeSection[]>({
    queryKey: ["/api/client-types", clientType.id, "sections"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType.id}/sections`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: fields = [], isLoading: fieldsLoading } = useQuery<ClientTypeField[]>({
    queryKey: ["/api/client-types", clientType.id, "fields"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType.id}/fields`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: panels = [] } = useQuery<ClientTypePanel[]>({
    queryKey: ["/api/client-types", clientType.id, "panels"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientType.id}/panels`, { credentials: "include" });
      return res.json();
    },
  });

  const isLoading = sectionsLoading || fieldsLoading;

  const orderedSections = [...sections].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  function getFieldsForSection(sectionId: number): ClientTypeField[] {
    return fields.filter(f => f.sectionId === sectionId);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack} data-testid="button-back-types">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Spat
        </Button>
        <div>
          <h2 className="text-xl font-bold" data-testid="text-type-detail-name">{clientType.name} ({clientType.code})</h2>
          <p className="text-xs text-muted-foreground">
            Zakladny parameter: {clientType.baseParameter === "ico" ? "ICO" : "Rodne cislo"}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-4">
          {orderedSections.map(section => (
            <FolderSection
              key={section.id}
              section={section}
              fields={getFieldsForSection(section.id)}
              panels={panels}
              allFields={fields}
              clientTypeId={clientType.id}
            />
          ))}
          <div style={{ display: orderedSections.length === 0 ? 'block' : 'none' }}>
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <p className="text-muted-foreground text-sm" data-testid="text-no-sections">Ziadne priecinky. Kontaktujte administratora.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClientTypeRules() {
  const { data: appUser } = useAppUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const { data: clientTypes = [], isLoading } = useQuery<ClientType[]>({
    queryKey: ["/api/client-types"],
  });

  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<ClientType | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const deleteTypeMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/client-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types"] });
      toast({ title: "Typ odstraneny" });
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: Array<{ id: number; sortOrder: number }>) => {
      await apiRequest("PUT", "/api/client-types/reorder", { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types"] });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = clientTypes.findIndex(ct => ct.id === active.id);
    const newIndex = clientTypes.findIndex(ct => ct.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove([...clientTypes], oldIndex, newIndex);
    const items = reordered.map((ct, i) => ({ id: ct.id, sortOrder: i }));
    reorderMutation.mutate(items);
  }

  if (selectedType) {
    return <TypeDetailView clientType={selectedType} onBack={() => setSelectedType(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-client-types-title">Pravidla typov klientov</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sprava typov klientov, priecinkov, panelov a parametrov formulara.
          </p>
        </div>
        <div style={{ display: isAdmin ? 'inline' : 'none' }}>
          <Button onClick={() => setAddTypeOpen(true)} data-testid="button-add-client-type">
            <Plus className="w-4 h-4 mr-2" />
            Novy typ
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Kod</TableHead>
                  <TableHead>Nazov</TableHead>
                  <TableHead>Zakladny parameter</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext items={clientTypes.map(ct => ct.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  <TableRow style={{ display: isLoading ? 'table-row' : 'none' }}><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell></TableRow>
                  <TableRow style={{ display: !isLoading && clientTypes.length === 0 ? 'table-row' : 'none' }}><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Ziadne typy klientov</TableCell></TableRow>
                  {clientTypes.map(ct => (
                    <SortableRow key={ct.id} id={ct.id}>
                      <TableCell className="font-mono font-bold">{ct.code}</TableCell>
                      <TableCell className="font-medium">{ct.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ct.baseParameter === "ico" ? "ICO" : "Rodne cislo"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={ct.isActive ? "default" : "destructive"} className={ct.isActive ? "bg-emerald-600 text-white" : ""}>
                          {ct.isActive ? "Aktivny" : "Neaktivny"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setSelectedType(ct)} data-testid={`button-edit-type-${ct.id}`}>
                            <Settings2 className="w-3 h-3 mr-1" />
                            Konfigurovat
                          </Button>
                          <div style={{ display: isAdmin ? 'inline' : 'none' }}>
                            <ConditionalDelete
                              canDelete={((ct as any).childCount ?? 0) === 0}
                              onClick={() => deleteTypeMutation.mutate(ct.id)}
                              testId={`button-delete-type-${ct.id}`}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </SortableRow>
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </DndContext>
        </CardContent>
      </Card>

      <AddTypeDialog open={addTypeOpen} onOpenChange={setAddTypeOpen} />
    </div>
  );
}
