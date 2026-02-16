import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Trash2, Settings2, Layers, ArrowLeft, Pencil,
  Type, AlignLeft, List, CheckSquare, ToggleLeft, Phone, Mail,
  Hash, Image, Calendar, CreditCard, Search, Loader2,
  FolderOpen, LayoutGrid, GripVertical, HelpCircle, X,
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
      <DialogContent className="sm:max-w-[400px]">
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
      <DialogContent className="sm:max-w-[400px] flex flex-col items-stretch justify-start">
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

function FolderFormDialog({
  open,
  onOpenChange,
  editingFolder,
  clientTypeId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingFolder: ClientTypeSection | null;
  clientTypeId: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");

  useEffect(() => {
    if (open) {
      if (editingFolder) setName(editingFolder.name);
      else setName("");
    }
  }, [open, editingFolder]);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const res = await apiRequest("POST", `/api/client-types/${clientTypeId}/sections`, {
        name: data.name,
        sortOrder: 0,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "sections"] });
      toast({ title: "Uspech", description: "Priecinok vytvoreny" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit priecinok", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      await apiRequest("PATCH", `/api/client-type-sections/${editingFolder!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "sections"] });
      toast({ title: "Uspech", description: "Priecinok aktualizovany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat priecinok", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) setName(""); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle data-testid="text-folder-dialog-title">{editingFolder ? "Upravit priecinok" : "Pridat priecinok"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Nazov priecinku *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="napr. Osobne udaje"
              data-testid="input-folder-name"
              autoFocus
            />
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrusit</Button>
          <Button
            onClick={() => {
              if (!name.trim()) return;
              if (editingFolder) updateMutation.mutate({ name: name.trim() });
              else createMutation.mutate({ name: name.trim() });
            }}
            disabled={!name.trim() || isPending}
            data-testid="button-save-folder"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingFolder ? "Ulozit" : "Vytvorit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PanelFormDialog({
  open,
  onOpenChange,
  editingPanel,
  clientTypeId,
  folders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPanel: ClientTypePanel | null;
  clientTypeId: number;
  folders: ClientTypeSection[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [gridColumns, setGridColumns] = useState("2");

  useEffect(() => {
    if (open) {
      if (editingPanel) {
        setName(editingPanel.name);
        setSectionId(editingPanel.sectionId?.toString() || "");
        setGridColumns((editingPanel.gridColumns || 2).toString());
      } else {
        setName("");
        setSectionId("");
        setGridColumns("2");
      }
    }
  }, [open, editingPanel]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", `/api/client-types/${clientTypeId}/panels`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "panels"] });
      toast({ title: "Uspech", description: "Panel vytvoreny" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit panel", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PATCH", `/api/client-type-panels/${editingPanel!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "panels"] });
      toast({ title: "Uspech", description: "Panel aktualizovany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat panel", variant: "destructive" }),
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  function handleSubmit() {
    if (!name.trim()) return;
    const normalizedSectionId = sectionId && sectionId !== "none" ? parseInt(sectionId) : null;
    const payload = {
      name: name.trim(),
      sectionId: normalizedSectionId,
      gridColumns: parseInt(gridColumns),
      sortOrder: 0,
    };
    if (editingPanel) updateMutation.mutate(payload);
    else createMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { onOpenChange(isOpen); if (!isOpen) { setName(""); setSectionId(""); setGridColumns("2"); } }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle data-testid="text-panel-dialog-title">{editingPanel ? "Upravit panel" : "Pridat panel"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Nazov panelu *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="napr. Kontaktne udaje" data-testid="input-panel-name" autoFocus />
          </div>
          <div>
            <Label className="text-xs">Priecinok</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger data-testid="select-panel-folder"><SelectValue placeholder="Bez priecinku" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Bez priecinku</SelectItem>
                {folders.map(f => (
                  <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Pocet stlpcov v gridu</Label>
            <Select value={gridColumns} onValueChange={setGridColumns}>
              <SelectTrigger data-testid="select-panel-grid-columns"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 stlpec</SelectItem>
                <SelectItem value="2">2 stlpce</SelectItem>
                <SelectItem value="3">3 stlpce</SelectItem>
                <SelectItem value="4">4 stlpce</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Zrusit</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || isPending} data-testid="button-save-panel">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : editingPanel ? "Ulozit" : "Vytvorit"}
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
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editingField: ClientTypeField | null;
  clientTypeId: number;
  panels: ClientTypePanel[];
  existingFields: ClientTypeField[];
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
      } else {
        setFieldKey(""); setLabel(""); setFieldType("short_text"); setPanelId("");
        setIsRequired(false); setOptions(""); setDependsOn(""); setDependsValue("");
      }
    }
  }, [open, editingField]);

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
        sectionId: null,
        isRequired,
        options: options ? options.split(",").map(o => o.trim()).filter(Boolean) : [],
        visibilityRule,
        sortOrder: existingFields.length,
      });
    },
    onSuccess: () => {
      toast({ title: "Parameter vytvoreny" });
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "fields"] });
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
      });
    },
    onSuccess: () => {
      toast({ title: "Parameter aktualizovany" });
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "fields"] });
      onOpenChange(false);
    },
    onError: () => { toast({ title: "Chyba", variant: "destructive" }); },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const showOptions = isSelectFieldType(fieldType);
  const [newOptionText, setNewOptionText] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto flex flex-col items-stretch justify-start">
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

          <div className="grid grid-cols-2 gap-4">
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

function FoldersTab({ clientTypeId }: { clientTypeId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ClientTypeSection | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientTypeSection | null>(null);

  const { data: folders = [], isLoading } = useQuery<ClientTypeSection[]>({
    queryKey: ["/api/client-types", clientTypeId, "sections"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientTypeId}/sections`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: panels = [] } = useQuery<ClientTypePanel[]>({
    queryKey: ["/api/client-types", clientTypeId, "panels"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientTypeId}/panels`, { credentials: "include" });
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/client-type-sections/${deleteTarget!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "panels"] });
      toast({ title: "Uspech", description: "Priecinok vymazany" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat priecinok", variant: "destructive" }),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: number; sortOrder: number }[]) => {
      await apiRequest("PUT", `/api/client-types/${clientTypeId}/sections/reorder`, { items });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "sections"] });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sorted = [...folders].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
    const oldIndex = sorted.findIndex(f => f.id === active.id);
    const newIndex = sorted.findIndex(f => f.id === over.id);
    const reordered = arrayMove(sorted, oldIndex, newIndex);
    reorderMutation.mutate(reordered.map((f, i) => ({ id: f.id, sortOrder: i })));
  }

  function getPanelCount(folderId: number): number {
    return panels.filter(p => p.sectionId === folderId).length;
  }

  const sorted = [...folders].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const filtered = sorted.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hladat priecinky..." className="pl-9" data-testid="input-search-folders" />
        </div>
        <Button onClick={() => { setEditingFolder(null); setDialogOpen(true); }} data-testid="button-add-folder">
          <Plus className="w-4 h-4 mr-2" /> Pridat priecinok
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Nazov priecinku</TableHead>
                    <TableHead>Panely</TableHead>
                    <TableHead>Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <SortableContext items={filtered.map(f => f.id)} strategy={verticalListSortingStrategy}>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8" data-testid="text-no-folders">Ziadne priecinky</TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(folder => (
                        <SortableRow key={folder.id} id={folder.id}>
                          <TableCell className="font-medium">{folder.name}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" data-testid={`badge-folder-panel-count-${folder.id}`}>{getPanelCount(folder.id)}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" onClick={() => { setEditingFolder(folder); setDialogOpen(true); }} data-testid={`button-edit-folder-${folder.id}`}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <div style={{ visibility: getPanelCount(folder.id) > 0 ? 'hidden' : 'visible' }}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon" variant="ghost"
                                      onClick={() => setDeleteTarget(folder)}
                                      data-testid={`button-delete-folder-${folder.id}`}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </TableCell>
                        </SortableRow>
                      ))
                    )}
                  </TableBody>
                </SortableContext>
              </Table>
            </DndContext>
          </CardContent>
        </Card>
      )}

      <FolderFormDialog
        open={dialogOpen}
        onOpenChange={(isOpen) => { setDialogOpen(isOpen); if (!isOpen) setEditingFolder(null); }}
        editingFolder={editingFolder}
        clientTypeId={clientTypeId}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}
        title={`Naozaj chcete vymazat priecinok "${deleteTarget?.name}"?`}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function PanelsTab({ clientTypeId }: { clientTypeId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterFolderId, setFilterFolderId] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<ClientTypePanel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientTypePanel | null>(null);

  const { data: panels = [], isLoading } = useQuery<ClientTypePanel[]>({
    queryKey: ["/api/client-types", clientTypeId, "panels"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientTypeId}/panels`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: folders = [] } = useQuery<ClientTypeSection[]>({
    queryKey: ["/api/client-types", clientTypeId, "sections"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientTypeId}/sections`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: fields = [] } = useQuery<ClientTypeField[]>({
    queryKey: ["/api/client-types", clientTypeId, "fields"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientTypeId}/fields`, { credentials: "include" });
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/client-type-panels/${deleteTarget!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "fields"] });
      toast({ title: "Uspech", description: "Panel vymazany" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat panel", variant: "destructive" }),
  });

  function getFolderName(sectionId: number | null): string {
    if (!sectionId) return "Bez priecinku";
    return folders.find(f => f.id === sectionId)?.name || `#${sectionId}`;
  }

  function getFieldCount(panelId: number): number {
    return fields.filter(f => f.panelId === panelId).length;
  }

  const sorted = [...panels].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const filtered = sorted.filter(p => {
    if (filterFolderId !== "all" && p.sectionId !== parseInt(filterFolderId)) return false;
    return p.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hladat panely..." className="pl-9" data-testid="input-search-panels" />
        </div>
        <Select value={filterFolderId} onValueChange={setFilterFolderId}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-folder"><SelectValue placeholder="Vsetky priecinky" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsetky priecinky</SelectItem>
            {folders.map(f => (
              <SelectItem key={f.id} value={f.id.toString()}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditingPanel(null); setDialogOpen(true); }} data-testid="button-add-panel">
          <Plus className="w-4 h-4 mr-2" /> Pridat panel
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazov panelu</TableHead>
                  <TableHead>Priecinok</TableHead>
                  <TableHead>Grid stlpce</TableHead>
                  <TableHead>Parametre</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8" data-testid="text-no-panels">Ziadne panely</TableCell>
                  </TableRow>
                ) : (
                  filtered.map(panel => (
                    <TableRow key={panel.id} data-testid={`row-panel-${panel.id}`}>
                      <TableCell className="font-medium">{panel.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getFolderName(panel.sectionId)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{panel.gridColumns || 2}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" data-testid={`badge-panel-field-count-${panel.id}`}>{getFieldCount(panel.id)}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => { setEditingPanel(panel); setDialogOpen(true); }} data-testid={`button-edit-panel-${panel.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <div style={{ visibility: getFieldCount(panel.id) > 0 ? 'hidden' : 'visible' }}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon" variant="ghost"
                                  onClick={() => setDeleteTarget(panel)}
                                  data-testid={`button-delete-panel-${panel.id}`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PanelFormDialog
        open={dialogOpen}
        onOpenChange={(isOpen) => { setDialogOpen(isOpen); if (!isOpen) setEditingPanel(null); }}
        editingPanel={editingPanel}
        clientTypeId={clientTypeId}
        folders={folders}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}
        title={`Naozaj chcete vymazat panel "${deleteTarget?.name}"?`}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function ParametersTab({ clientTypeId }: { clientTypeId: number }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterPanelId, setFilterPanelId] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<ClientTypeField | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientTypeField | null>(null);

  const { data: fields = [], isLoading } = useQuery<ClientTypeField[]>({
    queryKey: ["/api/client-types", clientTypeId, "fields"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientTypeId}/fields`, { credentials: "include" });
      return res.json();
    },
  });

  const { data: panels = [] } = useQuery<ClientTypePanel[]>({
    queryKey: ["/api/client-types", clientTypeId, "panels"],
    queryFn: async () => {
      const res = await fetch(`/api/client-types/${clientTypeId}/panels`, { credentials: "include" });
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/client-type-fields/${deleteTarget!.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/client-types", clientTypeId, "fields"] });
      toast({ title: "Uspech", description: "Parameter vymazany" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat parameter", variant: "destructive" }),
  });

  function getPanelName(panelId: number | null): string {
    if (!panelId) return "Bez panelu";
    return panels.find(p => p.id === panelId)?.name || `#${panelId}`;
  }

  const sorted = [...fields].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const filtered = sorted.filter(f => {
    if (filterPanelId !== "all" && f.panelId !== parseInt(filterPanelId)) return false;
    const searchLower = search.toLowerCase();
    return f.label.toLowerCase().includes(searchLower) || f.fieldKey.toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hladat parametre..." className="pl-9" data-testid="input-search-parameters" />
        </div>
        <Select value={filterPanelId} onValueChange={setFilterPanelId}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-panel"><SelectValue placeholder="Vsetky panely" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsetky panely</SelectItem>
            {panels.map(p => (
              <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditingField(null); setDialogOpen(true); }} data-testid="button-add-parameter">
          <Plus className="w-4 h-4 mr-2" /> Pridat parameter
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazov parametra</TableHead>
                  <TableHead>Kluc</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Panel</TableHead>
                  <TableHead>Povinne</TableHead>
                  <TableHead>Podmienka</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8" data-testid="text-no-parameters">Ziadne parametre</TableCell>
                  </TableRow>
                ) : (
                  filtered.map(field => {
                    const ftDef = FIELD_TYPES.find(t => t.value === field.fieldType);
                    const Icon = ftDef?.icon || Type;
                    return (
                      <TableRow key={field.id} data-testid={`row-parameter-${field.id}`}>
                        <TableCell className="font-medium">{field.label}</TableCell>
                        <TableCell className="font-mono text-sm text-muted-foreground">{field.fieldKey}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Icon className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs">{ftDef?.label || field.fieldType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{getPanelName(field.panelId)}</Badge>
                        </TableCell>
                        <TableCell>
                          {field.isRequired
                            ? <Badge variant="default" className="bg-emerald-600 text-white">Ano</Badge>
                            : <Badge variant="outline">Nie</Badge>}
                        </TableCell>
                        <TableCell>
                          {field.visibilityRule ? (
                            <span className="text-xs text-muted-foreground">
                              {(field.visibilityRule as any).dependsOn} = {(field.visibilityRule as any).value}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" onClick={() => { setEditingField(field); setDialogOpen(true); }} data-testid={`button-edit-parameter-${field.id}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(field)} data-testid={`button-delete-parameter-${field.id}`}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <FieldFormDialog
        open={dialogOpen}
        onOpenChange={(isOpen) => { setDialogOpen(isOpen); if (!isOpen) setEditingField(null); }}
        editingField={editingField}
        clientTypeId={clientTypeId}
        panels={panels}
        existingFields={fields}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}
        title={`Naozaj chcete vymazat parameter "${deleteTarget?.label}"?`}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function TypeDetailView({ clientType, onBack }: { clientType: ClientType; onBack: () => void }) {
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

      <Tabs defaultValue="folders">
        <TabsList data-testid="tabs-client-type-detail">
          <TabsTrigger value="folders" data-testid="tab-folders">
            <FolderOpen className="w-4 h-4 mr-2" />
            Priecinky
          </TabsTrigger>
          <TabsTrigger value="panels" data-testid="tab-panels">
            <LayoutGrid className="w-4 h-4 mr-2" />
            Panely
          </TabsTrigger>
          <TabsTrigger value="parameters" data-testid="tab-parameters">
            <Settings2 className="w-4 h-4 mr-2" />
            Parametre
          </TabsTrigger>
        </TabsList>
        <TabsContent value="folders">
          <FoldersTab clientTypeId={clientType.id} />
        </TabsContent>
        <TabsContent value="panels">
          <PanelsTab clientTypeId={clientType.id} />
        </TabsContent>
        <TabsContent value="parameters">
          <ParametersTab clientTypeId={clientType.id} />
        </TabsContent>
      </Tabs>
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
                  {isLoading && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nacitavam...</TableCell></TableRow>
                  )}
                  {!isLoading && clientTypes.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Ziadne typy klientov</TableCell></TableRow>
                  )}
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" onClick={() => deleteTypeMutation.mutate(ct.id)} data-testid={`button-delete-type-${ct.id}`}>
                                  <Trash2 className="w-3 h-3 text-destructive" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                            </Tooltip>
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
