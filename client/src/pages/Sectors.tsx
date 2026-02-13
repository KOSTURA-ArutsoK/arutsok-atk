import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { usePartners } from "@/hooks/use-partners";
import type { Sector, Parameter, SectorProduct, SectorProductParameter, Panel, PanelParameter, ProductPanel, Section } from "@shared/schema";
import { Plus, Pencil, Trash2, Loader2, Search, Layers, Settings2, ChevronsUpDown, X, Check, FolderOpen, List, Package, Info, LayoutGrid } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ProcessingSaveButton } from "@/components/processing-save-button";

const PARAM_TYPES = [
  { value: "text", label: "Text" },
  { value: "textarea", label: "Dlhy text" },
  { value: "number", label: "Cislo" },
  { value: "currency", label: "Mena \u20ac" },
  { value: "percent", label: "Percento %" },
  { value: "date", label: "Datum" },
  { value: "datetime", label: "Datum a cas" },
  { value: "boolean", label: "Ano/Nie" },
  { value: "combobox", label: "Vyber zo zoznamu" },
  { value: "email", label: "E-mail" },
  { value: "phone", label: "Telefon" },
  { value: "url", label: "URL adresa" },
  { value: "file", label: "Subor / priloha" },
  { value: "iban", label: "IBAN" },
] as const;

function getParamTypeLabel(value: string): string {
  return PARAM_TYPES.find(t => t.value === value)?.label || value;
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

function SectorFormDialog({
  open,
  onOpenChange,
  editingSector,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSector: Sector | null;
}) {
  const { toast } = useToast();
  const timerRef = useRef<number>(0);
  const { data: partners } = usePartners();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sectorType, setSectorType] = useState("general");
  const [selectedPartnerIds, setSelectedPartnerIds] = useState<number[]>([]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sectors", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sectors"] });
      toast({ title: "Uspech", description: "Sektor vytvoreny" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit sektor", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PUT", `/api/sectors/${editingSector!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sectors"] });
      toast({ title: "Uspech", description: "Sektor aktualizovany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat sektor", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingSector) {
        setName(editingSector.name || "");
        setDescription(editingSector.description || "");
        setSectorType(editingSector.sectorType || "general");
        setSelectedPartnerIds(editingSector.partnerIds || []);
      } else {
        setName("");
        setDescription("");
        setSectorType("general");
        setSelectedPartnerIds([]);
      }
    }
  }, [open, editingSector]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    const payload = { name, description, sectorType, partnerIds: selectedPartnerIds };
    if (editingSector) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const activePartners = partners?.filter(p => !p.isDeleted) || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-sector-dialog-title">
            {editingSector ? "Upravit sektor" : "Pridat sektor"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov sektoru *</label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-sector-name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Popis</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} data-testid="input-sector-description" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Typ</label>
            <Select value={sectorType} onValueChange={setSectorType}>
              <SelectTrigger data-testid="select-sector-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">Vseobecny</SelectItem>
                <SelectItem value="params">Parametricky</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Firmy posobiace v sektore</label>
            {selectedPartnerIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedPartnerIds.map(pid => {
                  const p = activePartners.find(x => x.id === pid);
                  return p ? (
                    <Badge key={pid} variant="secondary" className="gap-1">
                      {p.name}
                      <button
                        type="button"
                        className="ml-0.5 rounded-full hover-elevate"
                        onClick={() => setSelectedPartnerIds(prev => prev.filter(id => id !== pid))}
                        data-testid={`badge-remove-partner-${pid}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between" data-testid="button-select-partners">
                  <span className="text-muted-foreground">
                    {selectedPartnerIds.length > 0 ? `${selectedPartnerIds.length} vybranych` : "Vyberte firmy..."}
                  </span>
                  <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Hladat firmy..." data-testid="input-search-partner-combobox" />
                  <CommandList>
                    <CommandEmpty>Ziadne firmy</CommandEmpty>
                    <CommandGroup>
                      {activePartners.map(partner => {
                        const isSelected = selectedPartnerIds.includes(partner.id);
                        return (
                          <CommandItem
                            key={partner.id}
                            value={partner.name}
                            onSelect={() => {
                              if (isSelected) {
                                setSelectedPartnerIds(prev => prev.filter(id => id !== partner.id));
                              } else {
                                setSelectedPartnerIds(prev => [...prev, partner.id]);
                              }
                            }}
                            data-testid={`combobox-partner-${partner.id}`}
                          >
                            <Check className={`w-4 h-4 mr-2 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                            <span className="flex-1">{partner.name}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-sector-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
      </DialogContent>
    </Dialog>
  );
}

function SectorProductFormDialog({
  open,
  onOpenChange,
  editingProduct,
  sections,
  preSelectedSectionId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: SectorProduct | null;
  sections: Section[];
  preSelectedSectionId?: number;
}) {
  const { toast } = useToast();
  const timerRef = useRef<number>(0);

  const [sectionId, setSectionId] = useState<string>("");
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [selectedParameterIds, setSelectedParameterIds] = useState<number[]>([]);

  const { data: allParameters } = useQuery<Parameter[]>({
    queryKey: ["/api/parameters"],
  });

  const { data: productParams } = useQuery<SectorProductParameter[]>({
    queryKey: ["/api/sector-products", editingProduct?.id, "parameters"],
    queryFn: async () => {
      const res = await fetch(`/api/sector-products/${editingProduct!.id}/parameters`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingProduct?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sector-products", data);
      return res.json();
    },
    onSuccess: async (created: SectorProduct) => {
      if (selectedParameterIds.length > 0) {
        await apiRequest("PUT", `/api/sector-products/${created.id}/parameters`, { parameterIds: selectedParameterIds });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products"] });
      toast({ title: "Uspech", description: "Produkt vytvoreny" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit produkt", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PUT", `/api/sector-products/${editingProduct!.id}`, data);
      await apiRequest("PUT", `/api/sector-products/${editingProduct!.id}/parameters`, { parameterIds: selectedParameterIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", editingProduct?.id, "parameters"] });
      toast({ title: "Uspech", description: "Produkt aktualizovany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat produkt", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingProduct) {
        setSectionId(editingProduct.sectionId.toString());
        setName(editingProduct.name || "");
        setAbbreviation(editingProduct.abbreviation || "");
      } else {
        setSectionId(preSelectedSectionId?.toString() || "");
        setName("");
        setAbbreviation("");
        setSelectedParameterIds([]);
      }
    }
  }, [open, editingProduct, preSelectedSectionId]);

  useEffect(() => {
    if (productParams) {
      setSelectedParameterIds(productParams.map(pp => pp.parameterId));
    }
  }, [productParams]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    if (!sectionId) {
      toast({ title: "Chyba", description: "Vyberte sekciu", variant: "destructive" });
      return;
    }
    const payload = { sectionId: parseInt(sectionId), name, abbreviation };
    if (editingProduct) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-sector-product-dialog-title">
            {editingProduct ? "Upravit produkt" : "Pridat produkt"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Sekcia *</label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger data-testid="select-sector-product-section">
                <SelectValue placeholder="Vyberte sekciu" />
              </SelectTrigger>
              <SelectContent>
                {sections.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov produktu *</label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-sector-product-name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Skratka produktu</label>
            <Input value={abbreviation} onChange={e => setAbbreviation(e.target.value)} className="font-mono uppercase" data-testid="input-sector-product-abbreviation" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Parametre</label>
            {selectedParameterIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedParameterIds.map(pid => {
                  const p = allParameters?.find(x => x.id === pid);
                  return p ? (
                    <Badge key={pid} variant="secondary" className="gap-1">
                      {p.name}
                      <button
                        type="button"
                        className="ml-0.5 rounded-full hover-elevate"
                        onClick={() => setSelectedParameterIds(prev => prev.filter(id => id !== pid))}
                        data-testid={`badge-remove-param-${pid}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between" data-testid="button-select-parameters">
                  <span className="text-muted-foreground">
                    {selectedParameterIds.length > 0 ? `${selectedParameterIds.length} vybranych` : "Vyberte parametre..."}
                  </span>
                  <ChevronsUpDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Hladat parametre..." data-testid="input-search-param-combobox" />
                  <CommandList>
                    <CommandEmpty>Ziadne parametre</CommandEmpty>
                    <CommandGroup>
                      {allParameters?.map(param => {
                        const isSelected = selectedParameterIds.includes(param.id);
                        return (
                          <CommandItem
                            key={param.id}
                            value={param.name}
                            onSelect={() => {
                              if (isSelected) {
                                setSelectedParameterIds(prev => prev.filter(id => id !== param.id));
                              } else {
                                setSelectedParameterIds(prev => [...prev, param.id]);
                              }
                            }}
                            data-testid={`combobox-param-${param.id}`}
                          >
                            <Check className={`w-4 h-4 mr-2 ${isSelected ? "opacity-100" : "opacity-0"}`} />
                            <span className="flex-1">{param.name}</span>
                            <Badge variant="outline" className="text-xs ml-2">{getParamTypeLabel(param.paramType)}</Badge>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-sector-product-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
      </DialogContent>
    </Dialog>
  );
}

interface ChoiceOption {
  order: number;
  name: string;
}

function parseOptions(raw: string[] | null | undefined): ChoiceOption[] {
  if (!raw || raw.length === 0) return [];
  return raw.map((item, idx) => ({ order: idx + 1, name: item }));
}

function serializeOptions(opts: ChoiceOption[]): string[] {
  return opts
    .sort((a, b) => a.order - b.order)
    .map(o => o.name);
}

function ChoiceOptionsModal({
  open,
  onOpenChange,
  options,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: ChoiceOption[];
  onSave: (opts: ChoiceOption[]) => void;
}) {
  const [rows, setRows] = useState<ChoiceOption[]>([]);

  useEffect(() => {
    if (open) {
      setRows(options.length > 0 ? [...options] : []);
    }
  }, [open, options]);

  function addRow() {
    const nextOrder = rows.length > 0 ? Math.max(...rows.map(r => r.order)) + 1 : 1;
    setRows(prev => [...prev, { order: nextOrder, name: "" }]);
  }

  function updateRow(idx: number, field: "order" | "name", value: string | number) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function deleteRow(idx: number) {
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    const cleaned = rows.filter(r => r.name.trim() !== "");
    onSave(cleaned);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[500px] flex flex-col z-[60]">
        <DialogHeader>
          <DialogTitle data-testid="text-choice-options-title">Moznosti vyberu</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Poradove cislo</TableHead>
                <TableHead>Nazov moznosti</TableHead>
                <TableHead className="w-[60px]">Akcie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    Ziadne moznosti. Kliknite na tlacidlo nizsie.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={row.order}
                      onChange={e => updateRow(idx, "order", parseInt(e.target.value) || 1)}
                      className="w-20"
                      data-testid={`input-option-order-${idx}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={row.name}
                      onChange={e => updateRow(idx, "name", e.target.value)}
                      placeholder="napr. Skoda, BMW..."
                      data-testid={`input-option-name-${idx}`}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteRow(idx)}
                      data-testid={`button-delete-option-${idx}`}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between gap-2 pt-3 border-t flex-wrap">
          <Button variant="outline" onClick={addRow} data-testid="button-add-option">
            <Plus className="w-4 h-4 mr-1" />
            Pridat moznost
          </Button>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-options-cancel">
              Zrusit
            </Button>
            <Button onClick={handleSave} data-testid="button-options-save">
              Ulozit moznosti
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ParameterFormDialog({
  open,
  onOpenChange,
  editingParameter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingParameter: Parameter | null;
}) {
  const { toast } = useToast();
  const timerRef = useRef<number>(0);

  const [name, setName] = useState("");
  const [paramType, setParamType] = useState("text");
  const [helpText, setHelpText] = useState("");
  const [isRequired, setIsRequired] = useState(false);
  const [defaultValue, setDefaultValue] = useState("");
  const [choiceOptions, setChoiceOptions] = useState<ChoiceOption[]>([]);
  const [optionsModalOpen, setOptionsModalOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/parameters", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parameters"] });
      toast({ title: "Uspech", description: "Parameter vytvoreny" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit parameter", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/parameters/${editingParameter!.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parameters"] });
      toast({ title: "Uspech", description: "Parameter aktualizovany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat parameter", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingParameter) {
        setName(editingParameter.name || "");
        setParamType(editingParameter.paramType || "text");
        setHelpText(editingParameter.helpText || "");
        setIsRequired(editingParameter.isRequired || false);
        setDefaultValue(editingParameter.defaultValue || "");
        setChoiceOptions(parseOptions(editingParameter.options));
      } else {
        setName("");
        setParamType("text");
        setHelpText("");
        setIsRequired(false);
        setDefaultValue("");
        setChoiceOptions([]);
      }
    }
  }, [open, editingParameter]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    const options = paramType === "combobox" ? serializeOptions(choiceOptions) : [];
    const payload = { name, paramType, helpText, isRequired, defaultValue, options };
    if (editingParameter) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-parameter-dialog-title">
            {editingParameter ? "Upravit parameter" : "Pridat parameter"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov *</label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-parameter-name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Typ</label>
            <Select value={paramType} onValueChange={setParamType}>
              <SelectTrigger data-testid="select-parameter-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PARAM_TYPES.map(pt => (
                  <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Napoveda</label>
            <Input value={helpText} onChange={e => setHelpText(e.target.value)} placeholder="napr. TP riadok 30" data-testid="input-parameter-helptext" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Povinny udaj</label>
            <Switch checked={isRequired} onCheckedChange={setIsRequired} data-testid="switch-parameter-required" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Predvolena hodnota k danemu parametru</label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" data-testid="icon-default-value-info" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]" data-testid="tooltip-default-value-info">
                  <p className="text-xs">Hodnota, ktoru tu zadate, sa automaticky predvyplni pri vytvarani novej zmluvy v tomto sektore. Pouzivatel ju moze v pripade potreby zmenit.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <Input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} data-testid="input-parameter-default" />
          </div>
          <div className={`rounded-md border border-border p-4 space-y-3 ${paramType !== "combobox" ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-2">
              <FolderOpen className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Moznosti vyberu</span>
              {paramType !== "combobox" && (
                <span className="text-xs text-muted-foreground ml-auto">Dostupne len pre typ &quot;Vyber zo zoznamu&quot;</span>
              )}
            </div>
            {paramType === "combobox" && choiceOptions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {choiceOptions.sort((a, b) => a.order - b.order).map((opt, i) => (
                  <Badge key={i} variant="secondary">
                    {opt.order}. {opt.name}
                  </Badge>
                ))}
              </div>
            )}
            {paramType === "combobox" && choiceOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">Ziadne moznosti definovane</p>
            )}
            <Button
              type="button"
              variant="default"
              disabled={paramType !== "combobox"}
              onClick={() => setOptionsModalOpen(true)}
              data-testid="button-manage-options"
            >
              <List className="w-4 h-4 mr-1" />
              Spravovat moznosti
            </Button>
          </div>
          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-parameter-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
      </DialogContent>
    </Dialog>
    <ChoiceOptionsModal
      open={optionsModalOpen}
      onOpenChange={setOptionsModalOpen}
      options={choiceOptions}
      onSave={setChoiceOptions}
    />
    </>
  );
}

function SectionFormDialog({
  open,
  onOpenChange,
  editingSection,
  sectors,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingSection: Section | null;
  sectors: Sector[];
}) {
  const { toast } = useToast();
  const timerRef = useRef<number>(0);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sectorId, setSectorId] = useState<string>("");

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sections", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sections"] });
      toast({ title: "Uspech", description: "Sekcia vytvorena" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit sekciu", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PUT", `/api/sections/${editingSection!.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sections"] });
      toast({ title: "Uspech", description: "Sekcia aktualizovana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat sekciu", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingSection) {
        setName(editingSection.name || "");
        setDescription(editingSection.description || "");
        setSectorId(editingSection.sectorId?.toString() || "");
      } else {
        setName("");
        setDescription("");
        setSectorId("");
      }
    }
  }, [open, editingSection]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    if (!sectorId) {
      toast({ title: "Chyba", description: "Vyberte sektor", variant: "destructive" });
      return;
    }
    const payload = { name, description, sectorId: parseInt(sectorId) };
    if (editingSection) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-section-dialog-title">
            {editingSection ? "Upravit sekciu" : "Pridat sekciu"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov sekcie *</label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-section-name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Popis</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} data-testid="input-section-description" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Sektor *</label>
            <Select value={sectorId} onValueChange={setSectorId}>
              <SelectTrigger data-testid="select-section-sector">
                <SelectValue placeholder="Vyberte sektor" />
              </SelectTrigger>
              <SelectContent>
                {sectors.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-section-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
      </DialogContent>
    </Dialog>
  );
}

function SectionsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterSectorId, setFilterSectorId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Section | null>(null);

  const { data: sectors } = useQuery<Sector[]>({
    queryKey: ["/api/sectors"],
  });

  const { data: sections, isLoading } = useQuery<Section[]>({
    queryKey: ["/api/sections"],
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/sections/${deleteTarget!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sections"] });
      toast({ title: "Uspech", description: "Sekcia vymazana" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat sekciu", variant: "destructive" }),
  });

  function getSectorName(sectorId: number): string {
    return sectors?.find(s => s.id === sectorId)?.name || `#${sectorId}`;
  }

  const sorted = [...(sections || [])].sort((a, b) => b.id - a.id);

  const filtered = sorted.filter(sec => {
    if (filterSectorId !== "all" && sec.sectorId !== parseInt(filterSectorId)) return false;
    const searchLower = search.toLowerCase();
    return sec.name.toLowerCase().includes(searchLower) ||
      (sec.description || "").toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hladat sekcie..."
            className="pl-9"
            data-testid="input-search-sections"
          />
        </div>
        <Select value={filterSectorId} onValueChange={setFilterSectorId}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-sector-for-sections">
            <SelectValue placeholder="Vsetky sektory" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsetky sektory</SelectItem>
            {sectors?.map(s => (
              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditingSection(null); setDialogOpen(true); }} data-testid="button-add-section">
          <Plus className="w-4 h-4 mr-2" /> Pridat sekciu
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazov sekcie</TableHead>
                  <TableHead>Sektor</TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8" data-testid="text-no-sections">
                      Ziadne sekcie
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(section => (
                    <TableRow key={section.id} data-testid={`row-section-${section.id}`}>
                      <TableCell className="font-medium">{section.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getSectorName(section.sectorId)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {section.description || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditingSection(section); setDialogOpen(true); }}
                            data-testid={`button-edit-section-${section.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTarget(section)}
                            data-testid={`button-delete-section-${section.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      <SectionFormDialog
        open={dialogOpen}
        onOpenChange={(isOpen) => { setDialogOpen(isOpen); if (!isOpen) setEditingSection(null); }}
        editingSection={editingSection}
        sectors={sectors || []}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}
        title={`Naozaj chcete vymazat sekciu "${deleteTarget?.name}"?`}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function SectorsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sector | null>(null);
  const { data: partners } = usePartners();

  const { data: sectors, isLoading } = useQuery<Sector[]>({
    queryKey: ["/api/sectors"],
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/sectors/${deleteTarget!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sectors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products"] });
      toast({ title: "Uspech", description: "Sektor vymazany" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat sektor", variant: "destructive" }),
  });

  function getPartnerNames(ids: number[] | null): string {
    if (!ids || ids.length === 0 || !partners) return "-";
    return ids.map(id => partners.find(p => p.id === id)?.name || `#${id}`).join(", ");
  }

  const filtered = sectors?.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.description || "").toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hladat sektory..."
            className="pl-9"
            data-testid="input-search-sectors"
          />
        </div>
        <Button onClick={() => { setEditingSector(null); setDialogOpen(true); }} data-testid="button-add-sector">
          <Plus className="w-4 h-4 mr-2" /> Pridat sektor
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazov sektoru</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Firmy posobiace v sektore</TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8" data-testid="text-no-sectors">
                      Ziadne sektory
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(sector => (
                    <TableRow key={sector.id} data-testid={`row-sector-${sector.id}`}>
                      <TableCell className="font-medium">{sector.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{sector.sectorType}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[250px] truncate">
                        {getPartnerNames(sector.partnerIds)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {sector.description || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditingSector(sector); setDialogOpen(true); }}
                            data-testid={`button-edit-sector-${sector.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTarget(sector)}
                            data-testid={`button-delete-sector-${sector.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      <SectorFormDialog
        open={dialogOpen}
        onOpenChange={(isOpen) => { setDialogOpen(isOpen); if (!isOpen) setEditingSector(null); }}
        editingSector={editingSector}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}
        title={`Naozaj chcete vymazat sektor "${deleteTarget?.name}"?`}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function ProductsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterSectionId, setFilterSectionId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<SectorProduct | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SectorProduct | null>(null);
  const [panelAssignProduct, setPanelAssignProduct] = useState<SectorProduct | null>(null);

  const { data: sections } = useQuery<Section[]>({
    queryKey: ["/api/sections"],
  });

  const { data: sectorProds, isLoading } = useQuery<SectorProduct[]>({
    queryKey: ["/api/sector-products"],
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/sector-products/${deleteTarget!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products"] });
      toast({ title: "Uspech", description: "Produkt vymazany" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat produkt", variant: "destructive" }),
  });

  function getSectionName(sectionId: number): string {
    return sections?.find(s => s.id === sectionId)?.name || `#${sectionId}`;
  }

  const filtered = (sectorProds || []).filter(p => {
    if (filterSectionId !== "all" && p.sectionId !== parseInt(filterSectionId)) return false;
    const searchLower = search.toLowerCase();
    return p.name.toLowerCase().includes(searchLower) ||
      (p.abbreviation || "").toLowerCase().includes(searchLower);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hladat produkty..."
            className="pl-9"
            data-testid="input-search-sector-products"
          />
        </div>
        <Select value={filterSectionId} onValueChange={setFilterSectionId}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-section">
            <SelectValue placeholder="Vsetky sekcie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Vsetky sekcie</SelectItem>
            {sections?.map(s => (
              <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditingProduct(null); setDialogOpen(true); }} data-testid="button-add-sector-product">
          <Plus className="w-4 h-4 mr-2" /> Pridat produkt
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazov produktu</TableHead>
                  <TableHead>Skratka produktu</TableHead>
                  <TableHead>Sekcia</TableHead>
                  <TableHead>Panely</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8" data-testid="text-no-sector-products">
                      Ziadne produkty
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(product => (
                    <ProductTableRow
                      key={product.id}
                      product={product}
                      sectionName={getSectionName(product.sectionId)}
                      onEdit={() => { setEditingProduct(product); setDialogOpen(true); }}
                      onDelete={() => setDeleteTarget(product)}
                      onManagePanels={() => setPanelAssignProduct(product)}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <SectorProductFormDialog
        open={dialogOpen}
        onOpenChange={(isOpen) => { setDialogOpen(isOpen); if (!isOpen) setEditingProduct(null); }}
        editingProduct={editingProduct}
        sections={sections || []}
        preSelectedSectionId={filterSectionId !== "all" ? parseInt(filterSectionId) : undefined}
      />

      <ProductPanelAssignDialog
        open={!!panelAssignProduct}
        onOpenChange={(isOpen) => { if (!isOpen) setPanelAssignProduct(null); }}
        sectorProduct={panelAssignProduct}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}
        title={`Naozaj chcete vymazat produkt "${deleteTarget?.name}"?`}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function ProductTableRow({
  product,
  sectionName,
  onEdit,
  onDelete,
  onManagePanels,
}: {
  product: SectorProduct;
  sectionName: string;
  onEdit: () => void;
  onDelete: () => void;
  onManagePanels: () => void;
}) {
  const { data: productPanels } = useQuery<ProductPanel[]>({
    queryKey: ["/api/sector-products", product.id, "panels"],
    queryFn: async () => {
      const res = await fetch(`/api/sector-products/${product.id}/panels`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <TableRow data-testid={`row-sector-product-${product.id}`}>
      <TableCell className="font-medium">{product.name}</TableCell>
      <TableCell className="font-mono text-sm">{product.abbreviation || "-"}</TableCell>
      <TableCell>
        <Badge variant="outline">{sectionName}</Badge>
      </TableCell>
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          onClick={onManagePanels}
          data-testid={`button-manage-panels-${product.id}`}
        >
          <LayoutGrid className="w-3 h-3 mr-1" />
          {productPanels?.length ?? 0}
        </Button>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            data-testid={`button-edit-sector-product-${product.id}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            data-testid={`button-delete-sector-product-${product.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ParametersTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingParameter, setEditingParameter] = useState<Parameter | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Parameter | null>(null);

  const { data: parameters, isLoading } = useQuery<Parameter[]>({
    queryKey: ["/api/parameters"],
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/parameters/${deleteTarget!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parameters"] });
      toast({ title: "Uspech", description: "Parameter vymazany" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat parameter", variant: "destructive" }),
  });

  const filtered = parameters?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.helpText || "").toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hladat parametre..."
            className="pl-9"
            data-testid="input-search-parameters"
          />
        </div>
        <Button onClick={() => { setEditingParameter(null); setDialogOpen(true); }} data-testid="button-add-parameter">
          <Plus className="w-4 h-4 mr-2" /> Pridat parameter
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nazov</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Povinny udaj</TableHead>
                  <TableHead>Predvolena hodnota k danemu parametru</TableHead>
                  <TableHead>Napoveda</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8" data-testid="text-no-parameters">
                      Ziadne parametre
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(param => (
                    <TableRow key={param.id} data-testid={`row-parameter-${param.id}`}>
                      <TableCell className="font-medium">{param.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getParamTypeLabel(param.paramType)}</Badge>
                      </TableCell>
                      <TableCell>
                        {param.isRequired ? (
                          <Badge variant="default">Ano</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">Nie</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {param.defaultValue || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {param.helpText || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setEditingParameter(param); setDialogOpen(true); }}
                            data-testid={`button-edit-parameter-${param.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteTarget(param)}
                            data-testid={`button-delete-parameter-${param.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      <ParameterFormDialog
        open={dialogOpen}
        onOpenChange={(isOpen) => { setDialogOpen(isOpen); if (!isOpen) setEditingParameter(null); }}
        editingParameter={editingParameter}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(isOpen) => { if (!isOpen) setDeleteTarget(null); }}
        title={`Naozaj chcete vymazat parameter "${deleteTarget?.name}"?`}
        onConfirm={() => deleteMutation.mutate()}
        isPending={deleteMutation.isPending}
      />
    </div>
  );
}

function PanelFormDialog({
  open,
  onOpenChange,
  editingPanel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPanel: Panel | null;
}) {
  const { toast } = useToast();
  const timerRef = useRef<number>(0);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedParameterIds, setSelectedParameterIds] = useState<number[]>([]);

  const { data: allParameters } = useQuery<Parameter[]>({
    queryKey: ["/api/parameters"],
  });

  const { data: panelParams } = useQuery<PanelParameter[]>({
    queryKey: ["/api/panels", editingPanel?.id, "parameters"],
    queryFn: async () => {
      const res = await fetch(`/api/panels/${editingPanel!.id}/parameters`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingPanel?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/panels", data);
      return res.json();
    },
    onSuccess: async (created: Panel) => {
      if (selectedParameterIds.length > 0) {
        await apiRequest("PUT", `/api/panels/${created.id}/parameters`, { parameterIds: selectedParameterIds });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
      toast({ title: "Uspech", description: "Panel vytvoreny" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit panel", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PUT", `/api/panels/${editingPanel!.id}`, data);
      await apiRequest("PUT", `/api/panels/${editingPanel!.id}/parameters`, { parameterIds: selectedParameterIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panels", editingPanel?.id, "parameters"] });
      toast({ title: "Uspech", description: "Panel aktualizovany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat panel", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingPanel) {
        setName(editingPanel.name || "");
        setDescription(editingPanel.description || "");
      } else {
        setName("");
        setDescription("");
        setSelectedParameterIds([]);
      }
    }
  }, [open, editingPanel]);

  useEffect(() => {
    if (panelParams) {
      setSelectedParameterIds(panelParams.map(pp => pp.parameterId));
    }
  }, [panelParams]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    const payload = { name, description };
    if (editingPanel) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;
  const [paramSearch, setParamSearch] = useState("");
  const filteredParams = allParameters?.filter(p =>
    p.name.toLowerCase().includes(paramSearch.toLowerCase())
  ) || [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-panel-dialog-title">
            {editingPanel ? "Upravit panel" : "Pridat panel"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov panelu *</label>
            <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-panel-name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Popis</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} data-testid="input-panel-description" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Priradene parametre</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={paramSearch}
                onChange={e => setParamSearch(e.target.value)}
                placeholder="Hladat parametre..."
                className="pl-9"
                data-testid="input-panel-param-search"
              />
            </div>
            <div className="border rounded-md max-h-[220px] overflow-y-auto">
              {filteredParams.length === 0 ? (
                <div className="text-center text-muted-foreground py-4 text-sm">Ziadne parametre</div>
              ) : (
                filteredParams.map(param => {
                  const isChecked = selectedParameterIds.includes(param.id);
                  return (
                    <div
                      key={param.id}
                      className="flex items-center justify-between px-3 py-2 border-b last:border-b-0"
                      data-testid={`panel-param-row-${param.id}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-sm truncate">{param.name}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{getParamTypeLabel(param.paramType)}</Badge>
                      </div>
                      <Switch
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedParameterIds(prev => [...prev, param.id]);
                          } else {
                            setSelectedParameterIds(prev => prev.filter(id => id !== param.id));
                          }
                        }}
                        data-testid={`switch-panel-param-${param.id}`}
                      />
                    </div>
                  );
                })
              )}
            </div>
            {selectedParameterIds.length > 0 && (
              <p className="text-xs text-muted-foreground">{selectedParameterIds.length} parametrov prirade&shy;nych</p>
            )}
          </div>
          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-panel-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
      </DialogContent>
    </Dialog>
  );
}

function PanelsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<Panel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Panel | null>(null);

  const { data: panels, isLoading } = useQuery<Panel[]>({
    queryKey: ["/api/panels"],
  });

  const { data: allParameters } = useQuery<Parameter[]>({
    queryKey: ["/api/parameters"],
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/panels/${deleteTarget!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
      toast({ title: "Uspech", description: "Panel vymazany" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat panel", variant: "destructive" }),
  });

  const filtered = panels?.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || "").toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Hladat panely..."
            className="pl-9"
            data-testid="input-search-panels"
          />
        </div>
        <Button onClick={() => { setEditingPanel(null); setDialogOpen(true); }} data-testid="button-add-panel">
          <Plus className="w-4 h-4 mr-2" /> Pridat panel
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[60px]">ID</TableHead>
                  <TableHead>Nazov</TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead>Parametre</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8" data-testid="text-no-panels">
                      Ziadne panely
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(panel => (
                    <PanelTableRow key={panel.id} panel={panel} onEdit={() => { setEditingPanel(panel); setDialogOpen(true); }} onDelete={() => setDeleteTarget(panel)} />
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

function PanelTableRow({ panel, onEdit, onDelete }: { panel: Panel; onEdit: () => void; onDelete: () => void }) {
  const { data: panelParams } = useQuery<PanelParameter[]>({
    queryKey: ["/api/panels", panel.id, "parameters"],
    queryFn: async () => {
      const res = await fetch(`/api/panels/${panel.id}/parameters`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  return (
    <TableRow data-testid={`row-panel-${panel.id}`}>
      <TableCell className="font-mono text-sm text-muted-foreground">{panel.id}</TableCell>
      <TableCell className="font-medium">{panel.name}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{panel.description || "-"}</TableCell>
      <TableCell>
        <Badge variant="outline">{panelParams?.length ?? 0}</Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            data-testid={`button-edit-panel-${panel.id}`}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            data-testid={`button-delete-panel-${panel.id}`}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function ProductPanelAssignDialog({
  open,
  onOpenChange,
  sectorProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorProduct: SectorProduct | null;
}) {
  const { toast } = useToast();
  const [selectedPanelIds, setSelectedPanelIds] = useState<number[]>([]);

  const { data: allPanels } = useQuery<Panel[]>({
    queryKey: ["/api/panels"],
  });

  const { data: productPanels } = useQuery<ProductPanel[]>({
    queryKey: ["/api/sector-products", sectorProduct?.id, "panels"],
    queryFn: async () => {
      const res = await fetch(`/api/sector-products/${sectorProduct!.id}/panels`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!sectorProduct?.id,
  });

  useEffect(() => {
    if (productPanels) {
      setSelectedPanelIds(productPanels.map(pp => pp.panelId));
    }
  }, [productPanels]);

  useEffect(() => {
    if (open && !sectorProduct) {
      setSelectedPanelIds([]);
    }
  }, [open, sectorProduct]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/sector-products/${sectorProduct!.id}/panels`, { panelIds: selectedPanelIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sector-products", sectorProduct?.id, "panels"] });
      toast({ title: "Uspech", description: "Panely priradene" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa priradit panely", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[500px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-product-panels-dialog-title">
            Panely - {sectorProduct?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(!allPanels || allPanels.length === 0) ? (
            <div className="text-center text-muted-foreground py-4 text-sm">Ziadne panely k dispozicii</div>
          ) : (
            <div className="border rounded-md max-h-[300px] overflow-y-auto">
              {allPanels.map(panel => {
                const isChecked = selectedPanelIds.includes(panel.id);
                return (
                  <div
                    key={panel.id}
                    className="flex items-center justify-between px-3 py-2 border-b last:border-b-0"
                    data-testid={`product-panel-row-${panel.id}`}
                  >
                    <span className="text-sm">{panel.name}</span>
                    <Switch
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPanelIds(prev => [...prev, panel.id]);
                        } else {
                          setSelectedPanelIds(prev => prev.filter(id => id !== panel.id));
                        }
                      }}
                      data-testid={`switch-product-panel-${panel.id}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 flex-wrap">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-product-panels-cancel">
              Zrusit
            </Button>
            <ProcessingSaveButton isPending={saveMutation.isPending} onClick={() => saveMutation.mutate()} type="button" />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Sectors() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Layers className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Sektory, sekcie, produkty a parametre</h1>
      </div>

      <Tabs defaultValue="sectors">
        <TabsList data-testid="tabs-sectors-products-parameters">
          <TabsTrigger value="sectors" data-testid="tab-sectors">
            <Layers className="w-4 h-4 mr-2" />
            Sektory
          </TabsTrigger>
          <TabsTrigger value="sections" data-testid="tab-sections">
            <FolderOpen className="w-4 h-4 mr-2" />
            Sekcie
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-products">
            <Package className="w-4 h-4 mr-2" />
            Produkty
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
        <TabsContent value="sectors">
          <SectorsTab />
        </TabsContent>
        <TabsContent value="sections">
          <SectionsTab />
        </TabsContent>
        <TabsContent value="products">
          <ProductsTab />
        </TabsContent>
        <TabsContent value="panels">
          <PanelsTab />
        </TabsContent>
        <TabsContent value="parameters">
          <ParametersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
