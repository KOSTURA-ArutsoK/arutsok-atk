import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Sector, Parameter, SectorParameter } from "@shared/schema";
import { Plus, Pencil, Trash2, Loader2, Search, Layers, Settings2, ChevronsUpDown, X, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sectorType, setSectorType] = useState("general");
  const [selectedParameterIds, setSelectedParameterIds] = useState<number[]>([]);

  const { data: allParameters } = useQuery<Parameter[]>({
    queryKey: ["/api/parameters"],
  });

  const { data: sectorParams } = useQuery<SectorParameter[]>({
    queryKey: ["/api/sectors", editingSector?.id, "parameters"],
    queryFn: async () => {
      const res = await fetch(`/api/sectors/${editingSector!.id}/parameters`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingSector?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/sectors", data);
      return res.json();
    },
    onSuccess: async (created: Sector) => {
      if (selectedParameterIds.length > 0) {
        await apiRequest("PUT", `/api/sectors/${created.id}/parameters`, { parameterIds: selectedParameterIds });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/sectors"] });
      toast({ title: "Uspech", description: "Sektor vytvoreny" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit sektor", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PUT", `/api/sectors/${editingSector!.id}`, data);
      await apiRequest("PUT", `/api/sectors/${editingSector!.id}/parameters`, { parameterIds: selectedParameterIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sectors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sectors", editingSector?.id, "parameters"] });
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
      } else {
        setName("");
        setDescription("");
        setSectorType("general");
        setSelectedParameterIds([]);
      }
    }
  }, [open, editingSector]);

  useEffect(() => {
    if (sectorParams) {
      setSelectedParameterIds(sectorParams.map(sp => sp.parameterId));
    }
  }, [sectorParams]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!name.trim()) {
      toast({ title: "Chyba", description: "Nazov je povinny", variant: "destructive" });
      return;
    }
    const payload = { name, description, sectorType };
    if (editingSector) {
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
          <DialogTitle data-testid="text-sector-dialog-title">
            {editingSector ? "Upravit sektor" : "Pridat sektor"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Nazov *</label>
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
                        className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
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
  const [optionsStr, setOptionsStr] = useState("");

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
        setOptionsStr((editingParameter.options || []).join(", "));
      } else {
        setName("");
        setParamType("text");
        setHelpText("");
        setIsRequired(false);
        setDefaultValue("");
        setOptionsStr("");
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
    const options = paramType === "combobox"
      ? optionsStr.split(",").map(s => s.trim()).filter(Boolean)
      : [];
    const payload = { name, paramType, helpText, isRequired, defaultValue, options };
    if (editingParameter) {
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
            <label className="text-sm font-medium">Predvolena hodnota</label>
            <Input value={defaultValue} onChange={e => setDefaultValue(e.target.value)} data-testid="input-parameter-default" />
          </div>
          {paramType === "combobox" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Moznosti (oddelene ciarkou)</label>
              <Input value={optionsStr} onChange={e => setOptionsStr(e.target.value)} placeholder="moznost1, moznost2, moznost3" data-testid="input-parameter-options" />
            </div>
          )}
          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-parameter-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
      </DialogContent>
    </Dialog>
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

function SectorsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Sector | null>(null);

  const { data: sectors, isLoading } = useQuery<Sector[]>({
    queryKey: ["/api/sectors"],
  });

  const { data: allParameters } = useQuery<Parameter[]>({
    queryKey: ["/api/parameters"],
  });

  const sectorParamQueries = useQuery<Record<number, SectorParameter[]>>({
    queryKey: ["/api/sectors/all-parameters", sectors?.map(s => s.id).join(",")],
    queryFn: async () => {
      if (!sectors || sectors.length === 0) return {};
      const result: Record<number, SectorParameter[]> = {};
      await Promise.all(
        sectors.map(async (s) => {
          const res = await fetch(`/api/sectors/${s.id}/parameters`, { credentials: "include" });
          if (res.ok) {
            result[s.id] = await res.json();
          }
        })
      );
      return result;
    },
    enabled: !!sectors && sectors.length > 0,
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/sectors/${deleteTarget!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sectors"] });
      toast({ title: "Uspech", description: "Sektor vymazany" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat sektor", variant: "destructive" }),
  });

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
                  <TableHead>Nazov</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead>Parametre</TableHead>
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
                  filtered.map(sector => {
                    const paramCount = sectorParamQueries.data?.[sector.id]?.length || 0;
                    return (
                      <TableRow key={sector.id} data-testid={`row-sector-${sector.id}`}>
                        <TableCell className="font-medium">{sector.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{sector.sectorType}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {sector.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{paramCount}</Badge>
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
                    );
                  })
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
                  <TableHead>Napoveda</TableHead>
                  <TableHead>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8" data-testid="text-no-parameters">
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

export default function Sectors() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Layers className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Sektory a parametre</h1>
      </div>

      <Tabs defaultValue="sectors">
        <TabsList data-testid="tabs-sectors-parameters">
          <TabsTrigger value="sectors" data-testid="tab-sectors">
            <Layers className="w-4 h-4 mr-2" />
            Sektory
          </TabsTrigger>
          <TabsTrigger value="parameters" data-testid="tab-parameters">
            <Settings2 className="w-4 h-4 mr-2" />
            Parametre
          </TabsTrigger>
        </TabsList>
        <TabsContent value="sectors">
          <SectorsTab />
        </TabsContent>
        <TabsContent value="parameters">
          <ParametersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
