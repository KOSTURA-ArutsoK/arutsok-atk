import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import type { ContractStatus, ContractStatusParameter, MyCompany, Sector, Section, SectorProduct } from "@shared/schema";
import { Plus, Pencil, Loader2, GripVertical } from "lucide-react";
import { ConditionalDelete } from "@/components/conditional-delete";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { ProcessingSaveButton } from "@/components/processing-save-button";
import { SortableTableRow, SortableContext_Wrapper } from "@/components/sortable-list";

const CONTRACT_STATUS_COLUMNS: ColumnDef[] = [
  { key: "sortOrder", label: "Poradie" },
  { key: "name", label: "Nazov stavu zmluvy" },
  { key: "usageCount", label: "Pocet zmluv" },
  { key: "color", label: "Farba stavu zmluvy" },
  { key: "properties", label: "Vlastnosti stavu zmluvy" },
];

const CONTRACT_STATUS_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "sortOrder", label: "Poradie", type: "number" },
  { key: "name", label: "Nazov stavu zmluvy", type: "text" },
];

type VisibilityItem = { entityType: string; entityId: number };

function StatusFormDialog({
  open,
  onOpenChange,
  editingStatus,
  activeStateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingStatus: ContractStatus | null;
  activeStateId: number | null;
}) {
  const { toast } = useToast();
  const { data: allStates } = useStates();
  const { data: companies } = useQuery<MyCompany[]>({ queryKey: ["/api/my-companies"] });
  const { data: sectors } = useQuery<Sector[]>({ queryKey: ["/api/sectors"] });
  const { data: sections } = useQuery<Section[]>({
    queryKey: ["/api/sections"],
    queryFn: async () => {
      const res = await fetch("/api/sections", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });
  const { data: sectorProducts } = useQuery<SectorProduct[]>({ queryKey: ["/api/sector-products"] });

  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [stateId, setStateId] = useState<string>("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isCommissionable, setIsCommissionable] = useState(false);
  const [isFinal, setIsFinal] = useState(false);
  const [assignsNumber, setAssignsNumber] = useState(false);
  const [definesContractEnd, setDefinesContractEnd] = useState(false);

  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>([]);
  const [visibilityItems, setVisibilityItems] = useState<VisibilityItem[]>([]);
  const [selectedContractTypes, setSelectedContractTypes] = useState<string[]>([]);

  const [statusParams, setStatusParams] = useState<ContractStatusParameter[]>([]);
  const [newParamName, setNewParamName] = useState("");
  const [newParamType, setNewParamType] = useState("text");
  const [newParamHelpText, setNewParamHelpText] = useState("");
  const [newParamOptions, setNewParamOptions] = useState("");
  const [newParamRequired, setNewParamRequired] = useState(false);
  const [newParamDefaultValue, setNewParamDefaultValue] = useState("");
  const [editingParam, setEditingParam] = useState<ContractStatusParameter | null>(null);

  const { data: existingCompanies } = useQuery<{ statusId: number; companyId: number }[]>({
    queryKey: ["/api/contract-statuses", editingStatus?.id, "companies"],
    queryFn: async () => {
      const res = await fetch(`/api/contract-statuses/${editingStatus!.id}/companies`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingStatus,
  });

  const { data: existingVisibility } = useQuery<VisibilityItem[]>({
    queryKey: ["/api/contract-statuses", editingStatus?.id, "visibility"],
    queryFn: async () => {
      const res = await fetch(`/api/contract-statuses/${editingStatus!.id}/visibility`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingStatus,
  });

  const { data: existingContractTypes } = useQuery<{ id: number; statusId: number; contractType: string }[]>({
    queryKey: ["/api/contract-statuses", editingStatus?.id, "contract-types"],
    queryFn: async () => {
      const res = await fetch(`/api/contract-statuses/${editingStatus!.id}/contract-types`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingStatus,
  });

  const { data: existingParams } = useQuery<ContractStatusParameter[]>({
    queryKey: ["/api/contract-statuses", editingStatus?.id, "parameters"],
    queryFn: async () => {
      const res = await fetch(`/api/contract-statuses/${editingStatus!.id}/parameters`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingStatus,
  });

  const { sortedData: sortedParams, sortKey: sortKeyParam, sortDirection: sortDirParam, requestSort: requestSortParam } = useTableSort(existingParams || []);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contract-statuses", data.status);
      const created = await res.json();
      await apiRequest("PUT", `/api/contract-statuses/${created.id}/companies`, { companyIds: data.companyIds });
      await apiRequest("PUT", `/api/contract-statuses/${created.id}/visibility`, { items: data.visibility });
      await apiRequest("PUT", `/api/contract-statuses/${created.id}/contract-types`, { contractTypes: data.contractTypes });
      return created;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses/all-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses/all-contract-types"] });
      toast({ title: "Uspech", description: "Stav zmluvy vytvoreny" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit stav zmluvy", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("PUT", `/api/contract-statuses/${editingStatus!.id}`, data.status);
      await apiRequest("PUT", `/api/contract-statuses/${editingStatus!.id}/companies`, { companyIds: data.companyIds });
      await apiRequest("PUT", `/api/contract-statuses/${editingStatus!.id}/visibility`, { items: data.visibility });
      await apiRequest("PUT", `/api/contract-statuses/${editingStatus!.id}/contract-types`, { contractTypes: data.contractTypes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses/all-visibility"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses/all-contract-types"] });
      toast({ title: "Uspech", description: "Stav zmluvy aktualizovany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat stav zmluvy", variant: "destructive" }),
  });

  const createParamMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", `/api/contract-statuses/${editingStatus!.id}/parameters`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses", editingStatus?.id, "parameters"] });
      toast({ title: "Uspech", description: "Parameter pridany" });
      resetParamForm();
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa pridat parameter", variant: "destructive" }),
  });

  const updateParamMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contract-status-parameters/${data.id}`, data.body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses", editingStatus?.id, "parameters"] });
      toast({ title: "Uspech", description: "Parameter aktualizovany" });
      resetParamForm();
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat parameter", variant: "destructive" }),
  });

  const deleteParamMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/contract-status-parameters/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses", editingStatus?.id, "parameters"] });
      toast({ title: "Uspech", description: "Parameter vymazany" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat parameter", variant: "destructive" }),
  });

  function resetParamForm() {
    setEditingParam(null);
    setNewParamName("");
    setNewParamType("text");
    setNewParamHelpText("");
    setNewParamOptions("");
    setNewParamRequired(false);
    setNewParamDefaultValue("");
  }

  useEffect(() => {
    if (open) {
      if (editingStatus) {
        setName(editingStatus.name || "");
        setColor(editingStatus.color || "#3b82f6");
        setStateId(editingStatus.stateId?.toString() || "");
        setSortOrder(editingStatus.sortOrder?.toString() || "0");
        setIsCommissionable(editingStatus.isCommissionable ?? false);
        setIsFinal(editingStatus.isFinal ?? false);
        setAssignsNumber(editingStatus.assignsNumber ?? false);
        setDefinesContractEnd(editingStatus.definesContractEnd ?? false);
        setSelectedContractTypes([]);
      } else {
        setName("");
        setColor("#3b82f6");
        setStateId(activeStateId?.toString() || "");
        setSortOrder("0");
        setIsCommissionable(false);
        setIsFinal(false);
        setAssignsNumber(false);
        setDefinesContractEnd(false);
        setSelectedCompanyIds([]);
        setVisibilityItems([]);
        setSelectedContractTypes([]);
      }
      resetParamForm();
    }
  }, [open, editingStatus, activeStateId]);

  useEffect(() => {
    if (existingCompanies) {
      setSelectedCompanyIds(existingCompanies.map((c: any) => c.companyId));
    }
  }, [existingCompanies]);

  useEffect(() => {
    if (existingVisibility) {
      setVisibilityItems(existingVisibility.map((v: any) => ({ entityType: v.entityType, entityId: v.entityId })));
    }
  }, [existingVisibility]);

  useEffect(() => {
    if (existingContractTypes) {
      setSelectedContractTypes(existingContractTypes.map((ct: any) => ct.contractType));
    }
  }, [existingContractTypes]);

  useEffect(() => {
    if (existingParams) {
      setStatusParams(existingParams);
    }
  }, [existingParams]);

  function handleSubmit() {
    if (!name) {
      toast({ title: "Chyba", description: "Nazov stavu zmluvy je povinny", variant: "destructive" });
      return;
    }
    const payload = {
      status: {
        name,
        color,
        stateId: stateId ? parseInt(stateId) : null,
        sortOrder: parseInt(sortOrder) || 0,
        isCommissionable,
        isFinal,
        assignsNumber,
        definesContractEnd,
      },
      companyIds: selectedCompanyIds,
      visibility: visibilityItems,
      contractTypes: selectedContractTypes,
    };

    if (editingStatus) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  function toggleCompany(companyId: number) {
    setSelectedCompanyIds(prev =>
      prev.includes(companyId) ? prev.filter(id => id !== companyId) : [...prev, companyId]
    );
  }

  function toggleVisibility(entityType: string, entityId: number) {
    setVisibilityItems(prev => {
      const exists = prev.some(v => v.entityType === entityType && v.entityId === entityId);
      if (exists) return prev.filter(v => !(v.entityType === entityType && v.entityId === entityId));
      return [...prev, { entityType, entityId }];
    });
  }

  function isVisibilitySelected(entityType: string, entityId: number) {
    return visibilityItems.some(v => v.entityType === entityType && v.entityId === entityId);
  }

  function handleParamSubmit() {
    if (!newParamName) {
      toast({ title: "Chyba", description: "Nazov parametra je povinny", variant: "destructive" });
      return;
    }
    const paramData = {
      name: newParamName,
      paramType: newParamType,
      helpText: newParamHelpText,
      options: newParamType === "select" || newParamType === "multiselect"
        ? newParamOptions.split(",").map(o => o.trim()).filter(Boolean)
        : [],
      isRequired: newParamRequired,
      defaultValue: newParamDefaultValue,
      sortOrder: (existingParams?.length || 0),
    };

    if (editingParam) {
      updateParamMutation.mutate({ id: editingParam.id, body: paramData });
    } else {
      createParamMutation.mutate(paramData);
    }
  }

  function startEditParam(param: ContractStatusParameter) {
    setEditingParam(param);
    setNewParamName(param.name);
    setNewParamType(param.paramType);
    setNewParamHelpText(param.helpText || "");
    setNewParamOptions(param.options?.join(", ") || "");
    setNewParamRequired(param.isRequired ?? false);
    setNewParamDefaultValue(param.defaultValue || "");
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  const PARAM_TYPES = [
    { value: "text", label: "Text" },
    { value: "number", label: "Cislo" },
    { value: "date", label: "Datum" },
    { value: "select", label: "Vyber" },
    { value: "multiselect", label: "Viacnasobny vyber" },
    { value: "jedna_moznost", label: "Jedna moznost (Single Select)" },
    { value: "viac_moznosti", label: "Viac moznosti (Multi-select)" },
    { value: "boolean", label: "Ano/Nie" },
    { value: "textarea", label: "Dlhy text" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <DialogHeader>
          <DialogTitle data-testid="text-status-dialog-title">
            {editingStatus ? "Upravit stav zmluvy" : "Pridat stav zmluvy"}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="vseobecne" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="vseobecne" data-testid="tab-vseobecne" className="flex-1">Vseobecne udaje</TabsTrigger>
            <TabsTrigger value="parametre" data-testid="tab-parametre" className="flex-1" disabled={!editingStatus}>Parametre</TabsTrigger>
          </TabsList>

          <TabsContent value="vseobecne" className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <p className="text-sm font-semibold text-muted-foreground" data-testid="text-folder1-heading">Priecinok 1: Vseobecne udaje o stave zmluvy</p>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Nazov stavu zmluvy *</label>
                  <Input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Zadajte nazov stavu zmluvy"
                    disabled={editingStatus?.isSystem === true}
                    data-testid="input-status-name"
                  />
                  {editingStatus?.isSystem && (
                    <p className="text-xs text-muted-foreground">Systemovy stav zmluvy - nazov nie je mozne zmenit</p>
                  )}
                  <p className="text-xs text-muted-foreground">Definuje, ako sa bude tento konkretny stav zmluvy volat v systeme.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Farba stavu zmluvy</label>
                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      type="color"
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      className="w-10 h-10 rounded-md border border-border cursor-pointer"
                      data-testid="input-status-color-picker"
                    />
                    <Input
                      value={color}
                      onChange={e => setColor(e.target.value)}
                      placeholder="#3b82f6"
                      className="font-mono flex-1"
                      data-testid="input-status-color-hex"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Farba sa viaze vylucne k tomuto stavu zmluvy a zobrazuje sa pri zmluvach v zoznamoch.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priradene spolocnosti k stavu zmluvy</label>
                  <Card>
                    <CardContent className="p-3 max-h-[150px] overflow-y-auto">
                      {companies && companies.length > 0 ? (
                        <div className="space-y-2">
                          {companies.filter(c => !c.isDeleted).map(company => (
                            <div key={company.id} className="flex items-center gap-2">
                              <Checkbox
                                checked={selectedCompanyIds.includes(company.id)}
                                onCheckedChange={() => toggleCompany(company.id)}
                                data-testid={`checkbox-company-${company.id}`}
                              />
                              <span className="text-sm">{company.name}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Ziadne spolocnosti k dispozicii</p>
                      )}
                    </CardContent>
                  </Card>
                  <p className="text-xs text-muted-foreground">Urcuje, pre ktore spolocnosti bude tento stav zmluvy dostupny.</p>
                </div>

                <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
                  <div>
                    <p className="text-sm font-medium">Stav definuje ukoncenie zmluvy</p>
                    <p className="text-xs text-muted-foreground">Ak je zapnuty, system identifikuje tento stav ako konecnu fazu zivotneho cyklu zmluvy.</p>
                  </div>
                  <Switch checked={definesContractEnd} onCheckedChange={setDefinesContractEnd} data-testid="switch-defines-contract-end" />
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Stat stavu zmluvy</label>
                <Select value={stateId} onValueChange={setStateId}>
                  <SelectTrigger data-testid="select-status-state">
                    <SelectValue placeholder="Vyberte stat" />
                  </SelectTrigger>
                  <SelectContent>
                    {allStates?.map(s => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name} ({s.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Poradie stavu zmluvy</label>
                <Input
                  type="number"
                  value={sortOrder}
                  onChange={e => setSortOrder(e.target.value)}
                  placeholder="0"
                  data-testid="input-status-sort-order"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <p className="text-sm font-medium text-muted-foreground">Dalsie vlastnosti stavu zmluvy</p>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Provizna</p>
                  <p className="text-xs text-muted-foreground">Stav zmluvy spusta vypocet provizii</p>
                </div>
                <Switch checked={isCommissionable} onCheckedChange={setIsCommissionable} data-testid="switch-is-commissionable" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Finalny stav zmluvy</p>
                  <p className="text-xs text-muted-foreground">Zmluva sa stane iba na citanie (zamknuta)</p>
                </div>
                <Switch checked={isFinal} onCheckedChange={setIsFinal} data-testid="switch-is-final" />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Prideluje cislo zmluvy</p>
                  <p className="text-xs text-muted-foreground">Pri dosiahnuti tohto stavu sa prideli globalne poradove cislo zmluvy</p>
                </div>
                <Switch checked={assignsNumber} onCheckedChange={setAssignsNumber} data-testid="switch-assigns-number" />
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-border">
              <label className="text-sm font-medium">Dostupnost stavu zmluvy (Filter viditelnosti)</label>
              <p className="text-xs text-muted-foreground mb-2">Prepojte stav zmluvy na konkretne Sektory, Sekcie alebo Produkty. Stav zmluvy sa zobrazi len pri zmluvach s danym produktom.</p>
              <Card>
                <CardContent className="p-3 max-h-[200px] overflow-y-auto space-y-3">
                  {sectors && sectors.length > 0 ? sectors.map(sector => (
                    <div key={`sector-${sector.id}`} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isVisibilitySelected("sector", sector.id)}
                          onCheckedChange={() => toggleVisibility("sector", sector.id)}
                          data-testid={`checkbox-visibility-sector-${sector.id}`}
                        />
                        <span className="text-sm font-medium">{sector.name}</span>
                        <Badge variant="secondary" className="text-xs">Sektor</Badge>
                      </div>
                      {sections?.filter(sec => sec.sectorId === sector.id).map(section => (
                        <div key={`section-${section.id}`} className="ml-6 space-y-1">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={isVisibilitySelected("section", section.id)}
                              onCheckedChange={() => toggleVisibility("section", section.id)}
                              data-testid={`checkbox-visibility-section-${section.id}`}
                            />
                            <span className="text-sm">{section.name}</span>
                            <Badge variant="secondary" className="text-xs">Sekcia</Badge>
                          </div>
                          {sectorProducts?.filter(sp => sp.sectionId === section.id).map(product => (
                            <div key={`product-${product.id}`} className="ml-6 flex items-center gap-2">
                              <Checkbox
                                checked={isVisibilitySelected("product", product.id)}
                                onCheckedChange={() => toggleVisibility("product", product.id)}
                                data-testid={`checkbox-visibility-product-${product.id}`}
                              />
                              <span className="text-sm">{product.name}</span>
                              <Badge variant="secondary" className="text-xs">Produkt</Badge>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )) : (
                    <p className="text-xs text-muted-foreground">Ziadne sektory</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2 pt-4 border-t border-border">
              <label className="text-sm font-medium">Povolene typy zmluv</label>
              <p className="text-xs text-muted-foreground mb-2">Urcite, pre ktore typy zmluv bude tento stav dostupny. Ak nie je zvoleny ziadny typ, stav bude dostupny pre vsetky typy zmluv.</p>
              <Card>
                <CardContent className="p-3 space-y-2">
                  {["Nova", "Prestupova", "Zmenova"].map(ct => (
                    <div key={ct} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedContractTypes.includes(ct)}
                        onCheckedChange={() => {
                          setSelectedContractTypes(prev =>
                            prev.includes(ct) ? prev.filter(t => t !== ct) : [...prev, ct]
                          );
                        }}
                        data-testid={`checkbox-contract-type-${ct.toLowerCase()}`}
                      />
                      <span className="text-sm">{ct}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 flex-wrap">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-status-cancel">
                Zrusit
              </Button>
              <ProcessingSaveButton isPending={isPending} />
            </div>
          </TabsContent>

          <TabsContent value="parametre" className="space-y-4 mt-4">
            {!editingStatus ? (
              <p className="text-sm text-muted-foreground text-center py-8">Najprv uloz stav zmluvy, potom pridaj parametre</p>
            ) : (
              <>
                <Card>
                  <CardContent className="p-3 space-y-3">
                    <p className="text-sm font-medium">
                      {editingParam ? "Upravit parameter" : "Pridat parameter"}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Nazov *</label>
                        <Input value={newParamName} onChange={e => setNewParamName(e.target.value)} placeholder="Nazov parametra" data-testid="input-param-name" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Typ</label>
                        <Select value={newParamType} onValueChange={setNewParamType}>
                          <SelectTrigger data-testid="select-param-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PARAM_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Pomocny text</label>
                        <Input value={newParamHelpText} onChange={e => setNewParamHelpText(e.target.value)} placeholder="Pomocny text" data-testid="input-param-help" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Predvolena hodnota</label>
                        <Input value={newParamDefaultValue} onChange={e => setNewParamDefaultValue(e.target.value)} placeholder="Predvolena hodnota" data-testid="input-param-default" />
                      </div>
                    </div>
                    {(newParamType === "select" || newParamType === "multiselect") && (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Moznosti (oddelene ciarkami)</label>
                        <Input value={newParamOptions} onChange={e => setNewParamOptions(e.target.value)} placeholder="Moznost 1, Moznost 2, Moznost 3" data-testid="input-param-options" />
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Checkbox checked={newParamRequired} onCheckedChange={(v) => setNewParamRequired(!!v)} data-testid="checkbox-param-required" />
                        <span className="text-sm">Povinny parameter</span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {editingParam && (
                          <Button variant="outline" onClick={resetParamForm} data-testid="button-cancel-edit-param">Zrusit upravu</Button>
                        )}
                        <Button
                          onClick={handleParamSubmit}
                          disabled={createParamMutation.isPending || updateParamMutation.isPending}
                          data-testid="button-save-param"
                        >
                          {(createParamMutation.isPending || updateParamMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                          {editingParam ? "Ulozit zmeny" : "Pridat parameter"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-0">
                    {existingParams && existingParams.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead sortKey="name" sortDirection={sortKeyParam === "name" ? sortDirParam : null} onSort={requestSortParam}>Nazov</TableHead>
                            <TableHead sortKey="paramType" sortDirection={sortKeyParam === "paramType" ? sortDirParam : null} onSort={requestSortParam}>Typ</TableHead>
                            <TableHead sortKey="isRequired" sortDirection={sortKeyParam === "isRequired" ? sortDirParam : null} onSort={requestSortParam}>Povinny</TableHead>
                            <TableHead sortKey="helpText" sortDirection={sortKeyParam === "helpText" ? sortDirParam : null} onSort={requestSortParam}>Pomocny text</TableHead>
                            <TableHead className="text-right">Akcie</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedParams.map(param => (
                            <TableRow key={param.id} data-testid={`row-param-${param.id}`}>
                              <TableCell className="font-medium text-sm" data-testid={`text-param-name-${param.id}`}>{param.name}</TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">{PARAM_TYPES.find(t => t.value === param.paramType)?.label || param.paramType}</Badge>
                              </TableCell>
                              <TableCell>
                                {param.isRequired ? <Badge variant="default" className="text-xs">Povinny</Badge> : <span className="text-xs text-muted-foreground">Nie</span>}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{param.helpText || "-"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1 flex-wrap">
                                  <Button size="icon" variant="ghost" onClick={() => startEditParam(param)} data-testid={`button-edit-param-${param.id}`}>
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <ConditionalDelete canDelete={true} onClick={() => deleteParamMutation.mutate(param.id)} disabled={deleteParamMutation.isPending} testId={`button-delete-param-${param.id}`} />
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-params">Ziadne parametre pre tento stav</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteStatusDialog({
  status,
  open,
  onOpenChange,
}: {
  status: ContractStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/contract-statuses/${status.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses/usage-counts"] });
      toast({ title: "Uspech", description: "Stav zmluvy vymazany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat stav zmluvy", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle data-testid="text-delete-dialog-title">Vymazat stav zmluvy</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground" data-testid="text-delete-confirmation">
            Naozaj chcete vymazat stav zmluvy s nazvom <span className="font-semibold text-foreground">{status.name}</span>? Tuto akciu nie je mozne vratit.
          </p>
          <div className="flex items-center justify-end gap-3 flex-wrap">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-delete-cancel">
              Zrusit
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-confirm"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mazem...
                </>
              ) : (
                "Vymazat"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractStatuses() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const activeStateId = appUser?.activeStateId ?? null;

  const columnVisibility = useColumnVisibility("contract-statuses", CONTRACT_STATUS_COLUMNS);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<ContractStatus | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingStatus, setDeletingStatus] = useState<ContractStatus | null>(null);

  const { data: statuses, isLoading } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
  });

  const { data: usageCounts } = useQuery<{ statusId: number; count: number }[]>({
    queryKey: ["/api/contract-statuses/usage-counts"],
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; sortOrder: number }[]) =>
      apiRequest("PUT", "/api/contract-statuses/reorder", { items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses"] });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa zmenit poradie", variant: "destructive" }),
  });

  const sorted = statuses ? [...statuses].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : [];

  const tableFilter = useSmartFilter(sorted, CONTRACT_STATUS_FILTER_COLUMNS, "contract-statuses");
  const { sortedData: sortedStatuses, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);

  const handleReorder = (items: { id: number | string; sortOrder: number }[]) => {
    reorderMutation.mutate(items.map(i => ({ id: Number(i.id), sortOrder: i.sortOrder })));
  };

  function openCreate() {
    setEditingStatus(null);
    setDialogOpen(true);
  }

  function openEdit(status: ContractStatus) {
    setEditingStatus(status);
    setDialogOpen(true);
  }

  function openDelete(status: ContractStatus) {
    setDeletingStatus(status);
    setDeleteDialogOpen(true);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Nastavenia stavov zmluv</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
          <Button onClick={openCreate} data-testid="button-create-status">
            <Plus className="w-4 h-4 mr-2" />
            Pridat stav zmluvy
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-statuses">
              Ziadne stavy zmluv. Pridajte prvy stav zmluvy tlacidlom vyssie.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  {columnVisibility.isVisible("sortOrder") && <TableHead sortKey="sortOrder" sortDirection={sortKey === "sortOrder" ? sortDirection : null} onSort={requestSort} className="w-20">Poradie</TableHead>}
                  {columnVisibility.isVisible("name") && <TableHead sortKey="name" sortDirection={sortKey === "name" ? sortDirection : null} onSort={requestSort}>Nazov stavu zmluvy</TableHead>}
                  {columnVisibility.isVisible("usageCount") && <TableHead className="w-24 text-center">Pocet zmluv</TableHead>}
                  {columnVisibility.isVisible("color") && <TableHead className="w-32">Farba stavu zmluvy</TableHead>}
                  {columnVisibility.isVisible("properties") && <TableHead>Vlastnosti stavu zmluvy</TableHead>}
                  <TableHead className="w-32 text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext_Wrapper items={sortedStatuses} onReorder={handleReorder}>
                <TableBody>
                  {sortedStatuses.map((status) => {
                    const usageCount = usageCounts?.find(u => u.statusId === status.id)?.count ?? 0;
                    return (
                    <SortableTableRow
                      key={status.id}
                      id={status.id}
                      data-testid={`row-status-${status.id}`}
                      onRowClick={() => openEdit(status)}
                    >
                      {columnVisibility.isVisible("sortOrder") && <TableCell className="font-mono text-sm" data-testid={`text-sort-order-${status.id}`}>
                        {status.sortOrder}
                      </TableCell>}
                      {columnVisibility.isVisible("name") && <TableCell data-testid={`text-status-name-${status.id}`}>
                        <Badge
                          variant="outline"
                          style={{ borderColor: status.color, color: status.color }}
                        >
                          {status.name}
                        </Badge>
                      </TableCell>}
                      {columnVisibility.isVisible("usageCount") && <TableCell className="text-center" data-testid={`cell-usage-count-${status.id}`}>
                        <span
                          className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground"
                          title={`Pouzite v ${usageCount} zmluvach`}
                          data-testid={`badge-usage-count-${status.id}`}
                        >
                          {usageCount}
                        </span>
                      </TableCell>}
                      {columnVisibility.isVisible("color") && <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div
                            className="w-6 h-6 rounded-md border border-border"
                            style={{ backgroundColor: status.color }}
                            data-testid={`color-swatch-${status.id}`}
                          />
                          <span className="text-xs font-mono text-muted-foreground" data-testid={`text-color-hex-${status.id}`}>
                            {status.color}
                          </span>
                        </div>
                      </TableCell>}
                      {columnVisibility.isVisible("properties") && <TableCell>
                        <div className="flex items-center gap-1 flex-wrap">
                          {status.isCommissionable && <Badge variant="secondary" className="text-xs" data-testid={`badge-commissionable-${status.id}`}>Provizna</Badge>}
                          {status.isFinal && <Badge variant="secondary" className="text-xs" data-testid={`badge-final-${status.id}`}>Finalny</Badge>}
                          {status.assignsNumber && <Badge variant="secondary" className="text-xs" data-testid={`badge-assigns-number-${status.id}`}>Cislo</Badge>}
                          {status.definesContractEnd && <Badge variant="secondary" className="text-xs" data-testid={`badge-defines-end-${status.id}`}>Ukoncenie</Badge>}
                        </div>
                      </TableCell>}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {status.isSystem && (
                            <Badge variant="secondary" className="text-xs mr-1" data-testid={`badge-system-status-${status.id}`}>System</Badge>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(status)}
                            data-testid={`button-edit-status-${status.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {!status.isSystem && usageCount === 0 && (
                            <ConditionalDelete canDelete={true} onClick={() => openDelete(status)} testId={`button-delete-status-${status.id}`} />
                          )}
                        </div>
                      </TableCell>
                    </SortableTableRow>
                    );
                  })}
                </TableBody>
              </SortableContext_Wrapper>
            </Table>
          )}
        </CardContent>
      </Card>

      <StatusFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingStatus={editingStatus}
        activeStateId={activeStateId}
      />

      {deletingStatus && (
        <DeleteStatusDialog
          status={deletingStatus}
          open={deleteDialogOpen}
          onOpenChange={(isOpen) => {
            setDeleteDialogOpen(isOpen);
            if (!isOpen) setDeletingStatus(null);
          }}
        />
      )}
    </div>
  );
}
