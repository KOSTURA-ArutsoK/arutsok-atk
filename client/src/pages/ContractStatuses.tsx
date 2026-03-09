import { useState, useEffect, useRef } from "react";
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
import type { ContractStatus, ContractStatusParameter, MyCompany, Sector, Section, SectorProduct, LifecyclePhaseConfig } from "@shared/schema";
import { Plus, Pencil, Loader2, GripVertical, Flag, MessageSquare, Settings2, FileText, ChevronRight, ChevronDown } from "lucide-react";
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
  { key: "definesContractEnd", label: "Ukoncenie zmluvy" },
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
  const [isIntervention, setIsIntervention] = useState(false);

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

  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyChannel, setNotifyChannel] = useState<string>("email");
  const [notifySubject, setNotifySubject] = useState("");
  const [notifyTemplate, setNotifyTemplate] = useState("");
  const templateRef = useRef<HTMLTextAreaElement>(null);
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
        setIsIntervention(editingStatus.isIntervention ?? false);
        setSelectedContractTypes([]);
        setNotifyEnabled((editingStatus as any).notifyEnabled ?? false);
        setNotifyChannel((editingStatus as any).notifyChannel || "email");
        setNotifySubject((editingStatus as any).notifySubject || "");
        setNotifyTemplate((editingStatus as any).notifyTemplate || "");
      } else {
        setName("");
        setColor("#3b82f6");
        setStateId(activeStateId?.toString() || "");
        setSortOrder("0");
        setIsCommissionable(false);
        setIsFinal(false);
        setAssignsNumber(false);
        setDefinesContractEnd(false);
        setIsIntervention(false);
        setSelectedCompanyIds([]);
        setVisibilityItems([]);
        setSelectedContractTypes([]);
        setNotifyEnabled(false);
        setNotifyChannel("email");
        setNotifySubject("");
        setNotifyTemplate("");
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
        isIntervention,
        notifyEnabled,
        notifyChannel: notifyEnabled ? notifyChannel : null,
        notifySubject: notifyEnabled && (notifyChannel === "email" || notifyChannel === "both") ? notifySubject : null,
        notifyTemplate: notifyEnabled ? notifyTemplate : null,
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

  function insertSmartTag(tag: string) {
    const ta = templateRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = notifyTemplate;
      setNotifyTemplate(val.substring(0, start) + tag + val.substring(end));
      setTimeout(() => { ta.focus(); ta.setSelectionRange(start + tag.length, start + tag.length); }, 0);
    } else {
      setNotifyTemplate(prev => prev + tag);
    }
  }

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
          <TabsList className="w-full justify-between">
            <TabsTrigger value="vseobecne" data-testid="tab-vseobecne" className="flex-1">Vseobecne udaje</TabsTrigger>
            <TabsTrigger value="parametre" data-testid="tab-parametre" className="flex-1" disabled={!editingStatus}>Parametre</TabsTrigger>
            <TabsTrigger value="notifikacie" data-testid="tab-notifikacie" className="flex-1">Notifikacie</TabsTrigger>
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

                <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
                  <div>
                    <p className="text-sm font-medium">Intervencia</p>
                    <p className="text-xs text-muted-foreground">Zmluvy s tymto stavom sa zobrazia v prehlade intervencii</p>
                  </div>
                  <Switch checked={isIntervention} onCheckedChange={setIsIntervention} data-testid="switch-is-intervention" />
                </div>
              </CardContent>
            </Card>

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

          <TabsContent value="notifikacie" className="space-y-4 mt-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <p className="text-sm font-semibold text-muted-foreground flex items-center gap-2" data-testid="text-notify-heading">
                  <MessageSquare className="w-4 h-4" />
                  Komunikacny modul
                </p>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium">Odoslat notifikaciu</p>
                    <p className="text-xs text-muted-foreground">Pri zmene stavu zmluvy sa automaticky odosle sprava</p>
                  </div>
                  <Switch checked={notifyEnabled} onCheckedChange={setNotifyEnabled} data-testid="switch-notify-enabled" />
                </div>

                {notifyEnabled && (
                  <>
                    <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
                      <div className="flex-1">
                        <p className="text-sm font-medium">Kanal dorucenia</p>
                        <p className="text-xs text-muted-foreground">Vyberte sposob dorucenia notifikacie</p>
                      </div>
                      <Select value={notifyChannel} onValueChange={setNotifyChannel}>
                        <SelectTrigger className="w-[180px]" data-testid="select-notify-channel">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="email">E-mail</SelectItem>
                          <SelectItem value="both">Oba (SMS + E-mail)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(notifyChannel === "email" || notifyChannel === "both") && (
                      <div className="flex items-center justify-between gap-4 pt-3 border-t border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">Predmet spravy</p>
                          <p className="text-xs text-muted-foreground">Predmet e-mailovej notifikacie</p>
                        </div>
                        <Input
                          value={notifySubject}
                          onChange={e => setNotifySubject(e.target.value)}
                          placeholder="Zmena stavu zmluvy"
                          className="flex-1 max-w-[300px]"
                          data-testid="input-notify-subject"
                        />
                      </div>
                    )}

                    <div className="pt-3 border-t border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Sablona spravy</p>
                          <p className="text-xs text-muted-foreground">Pouzite tlacidla na vlozenie premennych zo zmluvy</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1" data-testid="label-system-tags">
                            <Settings2 className="w-3 h-3" /> Systemove (z aktualnej zmluvy)
                          </p>
                          <div className="flex flex-wrap gap-1 w-full" data-testid="section-system-tags">
                            {[
                              { tag: "{{contract_number}}", label: "Cislo zmluvy", testId: "button-tag-contract-number" },
                              { tag: "{{client_name}}", label: "Meno klienta", testId: "button-tag-client-name" },
                              { tag: "{{valid_until}}", label: "Datum platnosti", testId: "button-tag-valid-until" },
                            ].map(item => (
                              <Button
                                key={item.tag}
                                type="button"
                                variant="outline"
                                size="sm"
                                className="text-xs h-7 px-2"
                                data-testid={item.testId}
                                onClick={() => insertSmartTag(item.tag)}
                              >
                                {item.label}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1" data-testid="label-status-tags">
                            <FileText className="w-3 h-3" /> Moje (zo stavu)
                          </p>
                          {(existingParams && existingParams.length > 0) ? (
                            <div className="flex flex-wrap gap-1 w-full" data-testid="section-status-tags">
                              {existingParams.map(p => (
                                <Button
                                  key={p.id}
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="text-xs h-7 px-2"
                                  data-testid={`button-tag-param-${p.id}`}
                                  onClick={() => insertSmartTag(`{{param_${p.name}}}`)}
                                >
                                  {p.name}
                                </Button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground italic" data-testid="text-no-status-params">
                              {editingStatus ? "Pridajte parametre v tabe 'Parametre'" : "Najprv ulozte stav, potom pridajte parametre"}
                            </p>
                          )}
                        </div>
                      </div>

                      <textarea
                        ref={templateRef}
                        value={notifyTemplate}
                        onChange={e => setNotifyTemplate(e.target.value)}
                        placeholder="Vazeny klient {{client_name}}, stav Vasej zmluvy c. {{contract_number}} bol zmeneny. Platnost: {{valid_until}}."
                        rows={6}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                        data-testid="textarea-notify-template"
                      />
                      <p className="text-xs text-muted-foreground">
                        Dostupne premenne: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{"{{contract_number}}"}</code>{" "}
                        <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{"{{client_name}}"}</code>{" "}
                        <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{"{{valid_until}}"}</code>
                        {existingParams && existingParams.length > 0 && existingParams.map(p => (
                          <span key={p.id}>{" "}<code className="bg-muted px-1 py-0.5 rounded text-[10px]">{`{{param_${p.name}}}`}</code></span>
                        ))}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-end gap-3 mt-6 flex-wrap">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-notify-cancel">
                Zrusit
              </Button>
              <ProcessingSaveButton isPending={isPending} />
            </div>
          </TabsContent>
        </Tabs>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LifecyclePhaseFormDialog({
  open,
  onOpenChange,
  phase,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phase: LifecyclePhaseConfig | null;
}) {
  const { toast } = useToast();
  const [color, setColor] = useState("#3b82f6");
  const [isCommissionable, setIsCommissionable] = useState(false);
  const [isFinal, setIsFinal] = useState(false);
  const [definesContractEnd, setDefinesContractEnd] = useState(false);
  const [isIntervention, setIsIntervention] = useState(false);
  const [isStorno, setIsStorno] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  const [notifyChannel, setNotifyChannel] = useState("email");
  const [notifySubject, setNotifySubject] = useState("");
  const [notifyTemplate, setNotifyTemplate] = useState("");

  useEffect(() => {
    if (open && phase) {
      setColor(phase.color || "#3b82f6");
      setIsCommissionable(phase.isCommissionable ?? false);
      setIsFinal(phase.isFinal ?? false);
      setDefinesContractEnd(phase.definesContractEnd ?? false);
      setIsIntervention(phase.isIntervention ?? false);
      setIsStorno(phase.isStorno ?? false);
      setNotifyEnabled(phase.notifyEnabled ?? false);
      setNotifyChannel(phase.notifyChannel || "email");
      setNotifySubject(phase.notifySubject || "");
      setNotifyTemplate(phase.notifyTemplate || "");
    }
  }, [open, phase]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/lifecycle-phase-configs/${phase!.phase}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/lifecycle-phases"] });
      toast({ title: "Uspech", description: "Konfiguracia fazy aktualizovana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat fazu", variant: "destructive" }),
  });

  function handleSubmit() {
    updateMutation.mutate({
      color,
      isCommissionable,
      isFinal,
      definesContractEnd,
      isIntervention,
      isStorno,
      notifyEnabled,
      notifyChannel: notifyEnabled ? notifyChannel : null,
      notifySubject: notifyEnabled ? notifySubject : null,
      notifyTemplate: notifyEnabled ? notifyTemplate : null,
    });
  }

  if (!phase) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle data-testid="text-phase-dialog-title">Faza spracovania: {phase.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Faza</label>
              <p className="text-sm font-mono" data-testid="text-phase-id">{phase.phase}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nazov</label>
              <p className="text-sm" data-testid="text-phase-name">{phase.name}</p>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Farba</label>
            <div className="flex items-center gap-2 mt-1">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-8 h-8 rounded cursor-pointer" data-testid="input-phase-color" />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="w-32 font-mono text-xs" data-testid="input-phase-color-text" />
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase">Vlastnosti</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={isCommissionable} onCheckedChange={(v) => setIsCommissionable(!!v)} data-testid="checkbox-phase-commissionable" />
                Provizna
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={isFinal} onCheckedChange={(v) => setIsFinal(!!v)} data-testid="checkbox-phase-final" />
                Finalny stav
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={definesContractEnd} onCheckedChange={(v) => setDefinesContractEnd(!!v)} data-testid="checkbox-phase-contract-end" />
                Ukoncenie zmluvy
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={isIntervention} onCheckedChange={(v) => setIsIntervention(!!v)} data-testid="checkbox-phase-intervention" />
                Intervencia
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={isStorno} onCheckedChange={(v) => setIsStorno(!!v)} data-testid="checkbox-phase-storno" />
                Storno
              </label>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={notifyEnabled} onCheckedChange={setNotifyEnabled} data-testid="switch-phase-notify" />
              Notifikacie
            </label>
            {notifyEnabled && (
              <div className="space-y-2 pl-4 border-l-2 border-border">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Kanal</label>
                  <Select value={notifyChannel} onValueChange={setNotifyChannel}>
                    <SelectTrigger data-testid="select-phase-notify-channel"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="both">Email + SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Predmet emailu</label>
                  <Input value={notifySubject} onChange={(e) => setNotifySubject(e.target.value)} placeholder="Predmet..." data-testid="input-phase-notify-subject" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Sablona</label>
                  <textarea value={notifyTemplate} onChange={(e) => setNotifyTemplate(e.target.value)} className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Obsah notifikacie..." data-testid="input-phase-notify-template" />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 flex-wrap">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-phase-cancel">Zrusit</Button>
            <Button type="button" onClick={handleSubmit} disabled={updateMutation.isPending} data-testid="button-phase-save">
              {updateMutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Ukladam...</> : "Ulozit"}
            </Button>
          </div>
        </div>
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
  const [systemExpanded, setSystemExpanded] = useState(false);
  const [customExpanded, setCustomExpanded] = useState(false);
  const [endingExpanded, setEndingExpanded] = useState(false);
  const [phasesExpanded, setPhasesExpanded] = useState(false);
  const [phaseDialogOpen, setPhaseDialogOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<LifecyclePhaseConfig | null>(null);

  const { data: statuses, isLoading } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
  });

  const { data: usageCounts } = useQuery<{ statusId: number; count: number }[]>({
    queryKey: ["/api/contract-statuses/usage-counts"],
  });

  const { data: lifecyclePhases } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/lifecycle-phases"],
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

      {(() => {
        const systemStatuses = sortedStatuses.filter(s => s.isSystem);
        const customStatuses = sortedStatuses.filter(s => !s.isSystem);
        const endingStatuses = sortedStatuses.filter(s => s.definesContractEnd);

        const statusTableHeader = (
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              {columnVisibility.isVisible("sortOrder") && <TableHead sortKey="sortOrder" sortDirection={sortKey === "sortOrder" ? sortDirection : null} onSort={requestSort} className="w-20">Poradie</TableHead>}
              {columnVisibility.isVisible("name") && <TableHead sortKey="name" sortDirection={sortKey === "name" ? sortDirection : null} onSort={requestSort}>Nazov stavu zmluvy</TableHead>}
              {columnVisibility.isVisible("usageCount") && <TableHead className="w-24 text-center">Pocet zmluv</TableHead>}
              {columnVisibility.isVisible("definesContractEnd") && <TableHead className="w-28 text-center">Ukoncenie</TableHead>}
              {columnVisibility.isVisible("color") && <TableHead className="w-32">Farba stavu zmluvy</TableHead>}
              {columnVisibility.isVisible("properties") && <TableHead>Vlastnosti stavu zmluvy</TableHead>}
              <TableHead className="w-32 text-right">Akcie</TableHead>
            </TableRow>
          </TableHeader>
        );

        const renderStatusRow = (status: any, options: { showDragHandle?: boolean; showDelete?: boolean } = {}) => {
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
                <Badge variant="outline" style={{ borderColor: status.color, color: status.color }}>
                  {status.name}
                </Badge>
              </TableCell>}
              {columnVisibility.isVisible("usageCount") && <TableCell className="text-center" data-testid={`cell-usage-count-${status.id}`}>
                <span className="inline-flex items-center justify-center min-w-[1.5rem] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-muted text-muted-foreground" title={`Pouzite v ${usageCount} zmluvach`} data-testid={`badge-usage-count-${status.id}`}>
                  {usageCount}
                </span>
              </TableCell>}
              {columnVisibility.isVisible("definesContractEnd") && <TableCell className="text-center" data-testid={`cell-defines-end-${status.id}`}>
                {status.definesContractEnd && <Flag className="w-4 h-4 text-destructive mx-auto" data-testid={`icon-defines-end-${status.id}`} />}
              </TableCell>}
              {columnVisibility.isVisible("color") && <TableCell>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-6 h-6 rounded-md border border-border" style={{ backgroundColor: status.color }} data-testid={`color-swatch-${status.id}`} />
                  <span className="text-xs font-mono text-muted-foreground" data-testid={`text-color-hex-${status.id}`}>{status.color}</span>
                </div>
              </TableCell>}
              {columnVisibility.isVisible("properties") && <TableCell>
                <div className="flex items-center gap-1 flex-wrap">
                  {status.isCommissionable && <Badge variant="secondary" className="text-xs" data-testid={`badge-commissionable-${status.id}`}>Provizna</Badge>}
                  {status.isFinal && <Badge variant="secondary" className="text-xs" data-testid={`badge-final-${status.id}`}>Finalny</Badge>}
                  {status.assignsNumber && <Badge variant="secondary" className="text-xs" data-testid={`badge-assigns-number-${status.id}`}>Cislo</Badge>}
                  {status.definesContractEnd && <Badge variant="secondary" className="text-xs" data-testid={`badge-defines-end-${status.id}`}>Ukoncenie</Badge>}
                  {status.isIntervention && <Badge variant="secondary" className="text-xs" data-testid={`badge-intervention-${status.id}`}>Intervencia</Badge>}
                </div>
              </TableCell>}
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1 flex-wrap">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(status)} data-testid={`button-edit-status-${status.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  {options.showDelete !== false && !status.isSystem && usageCount === 0 && (
                    <ConditionalDelete canDelete={true} onClick={() => openDelete(status)} testId={`button-delete-status-${status.id}`} />
                  )}
                </div>
              </TableCell>
            </SortableTableRow>
          );
        };

        return isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-statuses">
            Ziadne stavy zmluv. Pridajte prvy stav zmluvy tlacidlom vyssie.
          </p>
        ) : (
          <>
            {systemStatuses.length > 0 && (
              <Card data-testid="card-system-statuses">
                <CardContent className="p-0">
                  <div
                    className="px-4 py-3 border-b flex items-center justify-between cursor-pointer select-none hover:bg-muted/50 transition-colors"
                    onClick={() => setSystemExpanded(prev => !prev)}
                    data-testid="header-system-statuses"
                  >
                    <div className="flex items-center gap-2">
                      {systemExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider" data-testid="text-system-statuses-title">Systemove stavy</h2>
                      <Badge variant="secondary" className="text-xs" data-testid="badge-system-count">{systemStatuses.length}</Badge>
                    </div>
                  </div>
                  {systemExpanded && (
                    <>
                      <Table>
                        {statusTableHeader}
                        <TableBody>
                          {systemStatuses.map(s => renderStatusRow(s, { showDragHandle: false, showDelete: false }))}
                        </TableBody>
                      </Table>
                      {lifecyclePhases && lifecyclePhases.length > 0 && (
                        <div className="border-t">
                          <div
                            className="px-4 py-3 border-b flex items-center justify-between cursor-pointer select-none hover:bg-muted/50 transition-colors"
                            onClick={() => setPhasesExpanded(prev => !prev)}
                            data-testid="header-lifecycle-phases"
                          >
                            <div className="flex items-center gap-2">
                              {phasesExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider" data-testid="text-lifecycle-phases-title">Systemove stavy pri spracovani papierovych zmluv</h3>
                              <Badge variant="secondary" className="text-xs" data-testid="badge-phases-count">{lifecyclePhases.length}</Badge>
                            </div>
                          </div>
                          {phasesExpanded && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-20">Faza</TableHead>
                                  <TableHead>Nazov fazy</TableHead>
                                  <TableHead className="w-32">Farba</TableHead>
                                  <TableHead>Vlastnosti</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {lifecyclePhases.map((phase: any) => (
                                  <TableRow
                                    key={phase.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => { setEditingPhase(phase); setPhaseDialogOpen(true); }}
                                    data-testid={`row-lifecycle-phase-${phase.phase ?? phase.id}`}
                                  >
                                    <TableCell className="font-mono text-sm" data-testid={`text-phase-id-${phase.phase ?? phase.id}`}>{phase.phase ?? phase.id}</TableCell>
                                    <TableCell data-testid={`text-phase-name-${phase.phase ?? phase.id}`}>
                                      <Badge variant="outline" style={{ borderColor: phase.color || '#3b82f6', color: phase.color || '#3b82f6' }}>
                                        {phase.name}
                                      </Badge>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-md border border-border" style={{ backgroundColor: phase.color || '#3b82f6' }} />
                                        <span className="text-xs font-mono text-muted-foreground">{phase.color || '#3b82f6'}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1 flex-wrap">
                                        {phase.isCommissionable && <Badge variant="secondary" className="text-xs">Provizna</Badge>}
                                        {phase.isFinal && <Badge variant="secondary" className="text-xs">Finalny</Badge>}
                                        {phase.definesContractEnd && <Badge variant="secondary" className="text-xs">Ukoncenie</Badge>}
                                        {phase.isIntervention && <Badge variant="secondary" className="text-xs">Intervencia</Badge>}
                                        {phase.isStorno && <Badge variant="secondary" className="text-xs">Storno</Badge>}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            <Card data-testid="card-custom-statuses">
              <CardContent className="p-0">
                <div
                  className="px-4 py-3 border-b flex items-center justify-between cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => setCustomExpanded(prev => !prev)}
                  data-testid="header-custom-statuses"
                >
                  <div className="flex items-center gap-2">
                    {customExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider" data-testid="text-custom-statuses-title">Volitelne stavy</h2>
                    <Badge variant="secondary" className="text-xs" data-testid="badge-custom-count">{customStatuses.length}</Badge>
                  </div>
                </div>
                {customExpanded && (
                  customStatuses.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Ziadne volitelne stavy. Pridajte prvy stav zmluvy tlacidlom vyssie.</p>
                  ) : (
                    <SortableContext_Wrapper items={customStatuses} onReorder={handleReorder}>
                      <Table>
                        {statusTableHeader}
                        <TableBody>
                          {customStatuses.map(s => renderStatusRow(s, { showDragHandle: true, showDelete: true }))}
                        </TableBody>
                      </Table>
                    </SortableContext_Wrapper>
                  )
                )}
              </CardContent>
            </Card>

            {endingStatuses.length > 0 && (
              <Card data-testid="card-ending-statuses">
                <CardContent className="p-0">
                  <div
                    className="px-4 py-3 border-b flex items-center justify-between cursor-pointer select-none hover:bg-muted/50 transition-colors"
                    onClick={() => setEndingExpanded(prev => !prev)}
                    data-testid="header-ending-statuses"
                  >
                    <div className="flex items-center gap-2">
                      {endingExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider" data-testid="text-ending-statuses-title">Stavy ukoncujuce kontrakt</h2>
                      <Badge variant="destructive" className="text-xs" data-testid="badge-ending-count">{endingStatuses.length}</Badge>
                    </div>
                  </div>
                  {endingExpanded && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-20">Poradie</TableHead>
                          <TableHead>Nazov stavu</TableHead>
                          <TableHead className="w-32">Farba</TableHead>
                          <TableHead>Vlastnosti</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {endingStatuses.map(status => (
                          <TableRow key={status.id} data-testid={`row-ending-status-${status.id}`}>
                            <TableCell className="font-mono text-sm">{status.sortOrder}</TableCell>
                            <TableCell>
                              <Badge variant="outline" style={{ borderColor: status.color, color: status.color }}>
                                {status.name}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-md border border-border" style={{ backgroundColor: status.color }} />
                                <span className="text-xs font-mono text-muted-foreground">{status.color}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                <Badge variant="secondary" className="text-xs">Ukoncenie</Badge>
                                {status.isCommissionable && <Badge variant="secondary" className="text-xs">Provizna</Badge>}
                                {status.isFinal && <Badge variant="secondary" className="text-xs">Finalny</Badge>}
                                {status.isSystem && <Badge variant="secondary" className="text-xs">System</Badge>}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}
          </>
        );
      })()}

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

      <LifecyclePhaseFormDialog
        open={phaseDialogOpen}
        onOpenChange={(isOpen) => {
          setPhaseDialogOpen(isOpen);
          if (!isOpen) setEditingPhase(null);
        }}
        phase={editingPhase}
      />
    </div>
  );
}
