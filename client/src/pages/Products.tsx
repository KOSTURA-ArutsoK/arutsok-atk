import { useState, useRef, useCallback, useEffect } from "react";
import DOMPurify from "dompurify";
import { AddProductCard } from "@/components/AddProductCard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateSlovak, canCreateRecords, canEditRecords, canDeleteRecords } from "@/lib/utils";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
import { usePartners } from "@/hooks/use-partners";
import { useAppUser } from "@/hooks/use-app-user";
import { useToast } from "@/hooks/use-toast";
import { useMyCompanies } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import type { Product, CommissionScheme, Partner, Parameter, ProductParameter, MyCompany } from "@shared/schema";
import { Plus, Pencil, Eye, Package, Loader2, HelpCircle, Trash2, FileText } from "lucide-react";
import { ConditionalDelete } from "@/components/conditional-delete";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { RichTextEditor } from "@/components/rich-text-editor";
import { ProcessingSaveButton } from "@/components/processing-save-button";
import { HelpIcon } from "@/components/help-icon";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";

const PRODUCT_COLUMNS: ColumnDef[] = [
  { key: "code", label: "Kod" },
  { key: "name", label: "Nazov" },
  { key: "displayName", label: "Zobrazovaci nazov" },
  { key: "partnerId", label: "Partner" },
  { key: "companyId", label: "Spolocnost" },
  { key: "stateId", label: "Stat" },
  { key: "allowedSpecialists", label: "Povoleni specialisti" },
];

const PRODUCT_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "code", label: "Kod", type: "text" },
  { key: "name", label: "Nazov", type: "text" },
  { key: "displayName", label: "Zobrazovaci nazov", type: "text" },
  { key: "partnerId", label: "Partner", type: "number" },
  { key: "companyId", label: "Spolocnost", type: "number" },
  { key: "stateId", label: "Stat", type: "number" },
];

const SPECIALIST_TYPES = ["NBS", "Zbrojny preukaz", "Reality", "Poistenie", "Dochodok", "Ine"];

function formatProcessingTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useProducts() {
  return useQuery<Product[]>({
    queryKey: ["/api/products"],
  });
}

function useCommissions(productId: number | null) {
  return useQuery<CommissionScheme[]>({
    queryKey: ["/api/commissions", { productId }],
    queryFn: async () => {
      const res = await fetch(`/api/commissions?productId=${productId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!productId,
  });
}

function ProductFormDialog({
  open,
  onOpenChange,
  editingProduct,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingProduct: Product | null;
}) {
  const { toast } = useToast();
  const { data: partners } = usePartners();
  const { data: appUser } = useAppUser();
  const timerRef = useRef<number>(0);

  const [partnerId, setPartnerId] = useState<string>("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allowedSpecialists, setAllowedSpecialists] = useState<string[]>([]);
  const [allowedSubjectTypes, setAllowedSubjectTypes] = useState<string[]>([]);
  const [notesHtml, setNotesHtml] = useState("");
  const [paramValues, setParamValues] = useState<Record<number, string>>({});
  const [activeTab, setActiveTab] = useState<"info" | "dokumentacia">("info");
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [newDocName, setNewDocName] = useState("");

  const { data: allParameters } = useQuery<Parameter[]>({
    queryKey: ["/api/parameters"],
  });
  const { data: productParams } = useQuery<ProductParameter[]>({
    queryKey: ["/api/products", editingProduct?.id, "parameters"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${editingProduct!.id}/parameters`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingProduct?.id,
  });

  const assignedParams = (productParams || []).map(pp => {
    const param = allParameters?.find(p => p.id === pp.parameterId);
    return param ? { ...param, overrideRequired: pp.overrideRequired, overrideHelpText: pp.overrideHelpText } : null;
  }).filter(Boolean) as (Parameter & { overrideRequired?: boolean | null; overrideHelpText?: string | null })[];

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Uspech", description: "Produkt vytvoreny" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      let msg = "Nepodarilo sa vytvorit produkt";
      try {
        const text = err?.message || "";
        const jsonPart = text.replace(/^\d+:\s*/, "");
        const data = JSON.parse(jsonPart);
        if (data?.message) msg = data.message;
      } catch {}
      toast({ title: "Chyba", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/products/${editingProduct?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Uspech", description: "Produkt aktualizovany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat produkt", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      setActiveTab("info");
      setNewDocName("");
      if (editingProduct) {
        setPartnerId(editingProduct.partnerId?.toString() || "");
        setCode(editingProduct.code || "");
        setName(editingProduct.name || "");
        setDescription(editingProduct.description || "");
        setAllowedSpecialists(editingProduct.allowedSpecialists || []);
        setAllowedSubjectTypes((editingProduct as any).allowedSubjectTypes || []);
        setNotesHtml(editingProduct.notes || "");
        setRequiredDocuments((editingProduct as any).requiredDocuments || []);
      } else {
        setPartnerId("");
        setCode("");
        setName("");
        setDescription("");
        setAllowedSpecialists([]);
        setAllowedSubjectTypes([]);
        setNotesHtml("");
        setRequiredDocuments([]);
      }
    }
  }, [open, editingProduct]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!code || !name) {
      toast({ title: "Chyba", description: "Kod a nazov su povinne", variant: "destructive" });
      return;
    }
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const payload = {
      partnerId: partnerId ? parseInt(partnerId) : null,
      companyId: appUser?.activeCompanyId || null,
      stateId: appUser?.activeStateId || null,
      code,
      name,
      description,
      allowedSpecialists,
      allowedSubjectTypes,
      notes: notesHtml,
      requiredDocuments,
      processingTimeSec,
      dynamicParams: Object.keys(paramValues).length > 0 ? paramValues : undefined,
    };

    if (editingProduct) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <DialogHeader>
          <DialogTitle data-testid="text-product-dialog-title">
            {editingProduct ? "Upravit produkt" : "Pridat produkt"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-1 border-b mb-3">
          <button
            type="button"
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${activeTab === "info" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setActiveTab("info")}
            data-testid="tab-product-info"
          >
            Informacie
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "dokumentacia" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
            onClick={() => setActiveTab("dokumentacia")}
            data-testid="tab-product-dokumentacia"
          >
            <FileText className="w-3.5 h-3.5" />
            Dokumentacia
            <span style={{ display: requiredDocuments.length > 0 ? 'inline' : 'none' }}>
              <Badge variant="secondary" className="text-[10px] px-1.5 ml-0.5">{requiredDocuments.length}</Badge>
            </span>
          </button>
        </div>

        <div style={{ display: activeTab === "info" ? 'block' : 'none' }}>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Partner</label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger data-testid="select-product-partner">
                  <SelectValue placeholder="Vyberte partnera" />
                </SelectTrigger>
                <SelectContent>
                  {partners?.filter(p => !p.isDeleted).map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Kod *</label>
                <Input value={code} onChange={e => setCode(e.target.value)} className="font-mono uppercase" data-testid="input-product-code" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nazov produktu *</label>
                <Input value={name} onChange={e => setName(e.target.value)} data-testid="input-product-name" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Popis</label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} data-testid="input-product-description" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Povoleni specialisti</label>
              <div className="grid grid-cols-3 gap-2">
                {SPECIALIST_TYPES.map(type => (
                  <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={allowedSpecialists.includes(type)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setAllowedSpecialists(prev => [...prev, type]);
                        } else {
                          setAllowedSpecialists(prev => prev.filter(t => t !== type));
                        }
                      }}
                      data-testid={`checkbox-specialist-${type.toLowerCase().replace(/\s+/g, "-")}`}
                    />
                    {type}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Pre koho je produkt určený</label>
                <span className="text-xs text-muted-foreground">(ak nevyberiete, produkt je povolený pre všetky typy)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  { val: "person", label: "FO", desc: "Fyzická osoba" },
                  { val: "szco", label: "SZČO", desc: "Živnostník" },
                  { val: "company", label: "PO", desc: "Právnická osoba" },
                  { val: "organization", label: "TS", desc: "Tretí sektor (nadácia)" },
                  { val: "state", label: "VS", desc: "Verejný sektor" },
                ] as const).map(opt => {
                  const active = allowedSubjectTypes.includes(opt.val);
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => {
                        if (active) {
                          setAllowedSubjectTypes(prev => prev.filter(t => t !== opt.val));
                        } else {
                          setAllowedSubjectTypes(prev => [...prev, opt.val]);
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium transition-colors ${active ? "bg-primary/15 border-primary text-primary" : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}
                      data-testid={`toggle-subject-type-allowed-${opt.val}`}
                    >
                      {active && <span className="text-primary">✓</span>}
                      {opt.label}
                      <span className={`text-[10px] ${active ? "text-primary/70" : "text-muted-foreground"}`}>— {opt.desc}</span>
                    </button>
                  );
                })}
              </div>
              {allowedSubjectTypes.length > 0 && (
                <p className="text-xs text-amber-400 flex items-center gap-1">
                  <span>⚠</span>
                  Produkt bude dostupný len pre: {allowedSubjectTypes.map(t => t === "person" ? "FO" : t === "szco" ? "SZČO" : t === "company" ? "PO" : t === "organization" ? "TS" : "VS").join(", ")}. Zmluvy s iným typom subjektu budú odmietnuté.
                </p>
              )}
            </div>

            {assignedParams.length > 0 && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Dynamicke parametre</label>
                <div className="grid grid-cols-2 gap-3">
                  {assignedParams.map(param => {
                    const helpText = param.overrideHelpText || param.helpText;
                    const isReq = param.overrideRequired ?? param.isRequired;
                    return (
                      <div key={param.id} className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <label className="text-sm font-medium">
                            {param.name}{isReq ? " *" : ""}
                          </label>
                          {helpText && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" data-testid={`tooltip-param-${param.id}`}>
                                <p className="text-xs">{helpText}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        {param.paramType === "textarea" ? (
                          <Textarea
                            value={paramValues[param.id] || ""}
                            onChange={e => setParamValues(prev => ({ ...prev, [param.id]: e.target.value }))}
                            rows={2}
                            data-testid={`input-param-${param.id}`}
                          />
                        ) : param.paramType === "combobox" || param.paramType === "jedna_moznost" ? (
                          <Select
                            value={paramValues[param.id] || ""}
                            onValueChange={val => setParamValues(prev => ({ ...prev, [param.id]: val }))}
                          >
                            <SelectTrigger data-testid={`select-param-${param.id}`}>
                              <SelectValue placeholder="Vyberte..." />
                            </SelectTrigger>
                            <SelectContent>
                              {(param.options || []).map(opt => (
                                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : param.paramType === "viac_moznosti" ? (
                          <MultiSelectCheckboxes
                            paramId={param.id}
                            options={param.options || []}
                            value={paramValues[param.id] || ""}
                            onChange={(val) => setParamValues(prev => ({ ...prev, [param.id]: val }))}
                          />
                        ) : param.paramType === "boolean" ? (
                          <div className="flex items-center gap-2 pt-1">
                            <Switch
                              checked={paramValues[param.id] === "true"}
                              onCheckedChange={checked => setParamValues(prev => ({ ...prev, [param.id]: String(checked) }))}
                              data-testid={`switch-param-${param.id}`}
                            />
                            <span className="text-sm text-muted-foreground">{paramValues[param.id] === "true" ? "Ano" : "Nie"}</span>
                          </div>
                        ) : param.paramType === "date" ? (
                          <Input
                            type="date"
                            value={paramValues[param.id] || ""}
                            onChange={e => setParamValues(prev => ({ ...prev, [param.id]: e.target.value }))}
                            data-testid={`input-param-${param.id}`}
                          />
                        ) : param.paramType === "number" ? (
                          <Input
                            type="number"
                            value={paramValues[param.id] || ""}
                            onChange={e => setParamValues(prev => ({ ...prev, [param.id]: e.target.value }))}
                            data-testid={`input-param-${param.id}`}
                          />
                        ) : (
                          <Input
                            value={paramValues[param.id] || ""}
                            onChange={e => setParamValues(prev => ({ ...prev, [param.id]: e.target.value }))}
                            data-testid={`input-param-${param.id}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Poznamky</label>
              <RichTextEditor
                content={notesHtml}
                onChange={setNotesHtml}
                placeholder="Zadajte poznamky k produktu..."
                data-testid="editor-product-notes"
              />
            </div>

            <div className="flex items-center justify-end mt-6">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-product-cancel">
                Zrusit
              </Button>
            </div>
          </div>
        </div>

        <div style={{ display: activeTab === "dokumentacia" ? 'block' : 'none' }}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Definujte povinne dokumenty, ktore musi PFA odovzdat pri vytvoreni zmluvy s tymto produktom.
            </p>

            <div className="flex gap-2">
              <Input
                value={newDocName}
                onChange={e => setNewDocName(e.target.value)}
                placeholder="Nazov dokumentu (napr. Kopia OP)"
                onKeyDown={e => {
                  if (e.key === "Enter" && newDocName.trim()) {
                    setRequiredDocuments(prev => [...prev, newDocName.trim()]);
                    setNewDocName("");
                  }
                }}
                data-testid="input-new-document-name"
              />
              <Button
                size="sm"
                onClick={() => {
                  if (newDocName.trim()) {
                    setRequiredDocuments(prev => [...prev, newDocName.trim()]);
                    setNewDocName("");
                  }
                }}
                disabled={!newDocName.trim()}
                data-testid="button-add-document"
              >
                <Plus className="w-4 h-4 mr-1" />
                Pridat
              </Button>
            </div>

            <div style={{ display: requiredDocuments.length > 0 ? 'block' : 'none' }}>
              <div className="border rounded-md divide-y">
                {requiredDocuments.map((doc, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate" data-testid={`text-document-name-${idx}`}>{doc}</span>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setRequiredDocuments(prev => prev.filter((_, i) => i !== idx))}
                      data-testid={`button-remove-document-${idx}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: requiredDocuments.length === 0 ? 'block' : 'none' }}>
              <div className="border rounded-md p-6 text-center">
                <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Zatial neboli definovane ziadne povinne dokumenty.</p>
                <p className="text-xs text-muted-foreground mt-1">Pridajte nazvy dokumentov pomocou pola vyssie.</p>
              </div>
            </div>
          </div>
        </div>
        <ProcessingSaveButton isPending={isPending} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CommissionSection({ productId }: { productId: number }) {
  const { toast } = useToast();
  const { data: commissions, isLoading } = useCommissions(productId);
  const { sortedData: sortedCommissions, sortKey: commSortKey, sortDirection: commSortDirection, requestSort: commRequestSort } = useTableSort(commissions || []);
  const [showAdd, setShowAdd] = useState(false);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [validTo, setValidTo] = useState("");
  const [type, setType] = useState("Body");
  const [value, setValue] = useState("");
  const [coefficient, setCoefficient] = useState("");
  const [currency, setCurrency] = useState("EUR");

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/commissions", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commissions", { productId }] });
      toast({ title: "Uspech", description: "Sadzba pridana" });
      setShowAdd(false);
      setValidFrom(new Date().toISOString().split("T")[0]);
      setValidTo("");
      setType("Body");
      setValue("");
      setCoefficient("");
      setCurrency("EUR");
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa pridat sadzbu", variant: "destructive" }),
  });

  function handleAddRate() {
    if (!value || !validFrom) {
      toast({ title: "Chyba", description: "Hodnota a datum od su povinne", variant: "destructive" });
      return;
    }
    createMutation.mutate({
      productId,
      validFrom: new Date(validFrom).toISOString(),
      validTo: validTo ? new Date(validTo).toISOString() : null,
      type,
      value: parseInt(value),
      coefficient: coefficient ? parseInt(coefficient) : null,
      currency,
    });
  }

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="commissions" className="border-border">
        <AccordionTrigger data-testid="accordion-commissions" className="text-sm font-medium">
          Sadzobnik (Provizie)
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            )}
            {commissions && commissions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead sortKey="validFrom" sortDirection={commSortKey === "validFrom" ? commSortDirection : null} onSort={commRequestSort}>Platnost od</TableHead>
                    <TableHead sortKey="validTo" sortDirection={commSortKey === "validTo" ? commSortDirection : null} onSort={commRequestSort}>Platnost do</TableHead>
                    <TableHead sortKey="type" sortDirection={commSortKey === "type" ? commSortDirection : null} onSort={commRequestSort}>Typ</TableHead>
                    <TableHead sortKey="value" sortDirection={commSortKey === "value" ? commSortDirection : null} onSort={commRequestSort}>Hodnota</TableHead>
                    <TableHead sortKey="coefficient" sortDirection={commSortKey === "coefficient" ? commSortDirection : null} onSort={commRequestSort}>Koeficient</TableHead>
                    <TableHead sortKey="currency" sortDirection={commSortKey === "currency" ? commSortDirection : null} onSort={commRequestSort}>Mena</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCommissions.map(c => (
                    <TableRow key={c.id} data-testid={`row-commission-${c.id}`}>
                      <TableCell className="text-xs">{formatDateSlovak(c.validFrom)}</TableCell>
                      <TableCell className="text-xs">{formatDateSlovak(c.validTo)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{c.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono">{c.value}</TableCell>
                      <TableCell className="font-mono">{c.coefficient ?? "-"}</TableCell>
                      <TableCell>{c.currency}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              !isLoading && <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-commissions">Ziadne sadzby</p>
            )}

            {!showAdd ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowAdd(true)} data-testid="button-show-add-commission">
                <Plus className="w-4 h-4 mr-1" /> Pridat sadzbu
              </Button>
            ) : (
              <div className="space-y-3 p-3 rounded-md border border-border">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Platnost od *</label>
                    <Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} className="text-xs" data-testid="input-commission-valid-from" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Platnost do</label>
                    <Input type="date" value={validTo} onChange={e => setValidTo(e.target.value)} className="text-xs" data-testid="input-commission-valid-to" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Typ</label>
                    <Select value={type} onValueChange={setType}>
                      <SelectTrigger data-testid="select-commission-type" className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Body">Body (body x koeficient)</SelectItem>
                        <SelectItem value="Percenta">Percenta (%)</SelectItem>
                        <SelectItem value="Fixna">Fixna (EUR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Hodnota *</label>
                    <Input type="number" value={value} onChange={e => setValue(e.target.value)} className="text-xs font-mono" data-testid="input-commission-value" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Koeficient</label>
                    <Input type="number" value={coefficient} onChange={e => setCoefficient(e.target.value)} className="text-xs font-mono" disabled={type !== "Body"} data-testid="input-commission-coefficient" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Mena</label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger data-testid="select-commission-currency" className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="CZK">CZK</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button type="button" size="sm" onClick={handleAddRate} disabled={createMutation.isPending} data-testid="button-add-commission">
                    {createMutation.isPending ? "Ukladam..." : "Pridat sadzbu"}
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)} data-testid="button-cancel-commission">
                    Zrusit
                  </Button>
                </div>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function ProductDetailDialog({
  product,
  onClose,
  partners,
  companies,
  states,
}: {
  product: Product;
  onClose: () => void;
  partners: Partner[];
  companies: MyCompany[];
  states: { id: number; name: string; code: string }[];
}) {
  const partnerName = partners?.find(p => p.id === product.partnerId)?.name || "-";
  const companyName = companies?.find(c => c.id === product.companyId)?.name || "-";
  const stateName = states?.find(s => s.id === product.stateId)?.name || "-";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent size="md">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle data-testid="text-product-detail-name">{product.name}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {product.code && <Badge variant="secondary" className="font-mono">{product.code}</Badge>}
                {product.displayName && <span className="text-xs text-muted-foreground">{product.displayName}</span>}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-muted-foreground">Partner</span>
              <p className="text-sm" data-testid="text-detail-partner">{partnerName}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Spolocnost</span>
              <p className="text-sm" data-testid="text-detail-company">{companyName}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Stat</span>
              <p className="text-sm" data-testid="text-detail-state">{stateName}</p>
            </div>
          </div>

          {product.description && (
            <div>
              <span className="text-xs text-muted-foreground">Popis</span>
              <p className="text-sm" data-testid="text-detail-description">{product.description}</p>
            </div>
          )}

          {product.allowedSpecialists && product.allowedSpecialists.length > 0 && (
            <div>
              <span className="text-xs text-muted-foreground">Povoleni specialisti</span>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                {product.allowedSpecialists.map(s => (
                  <Badge key={s} variant="outline">{s}</Badge>
                ))}
              </div>
            </div>
          )}

          {product.notes && (
            <div>
              <span className="text-xs text-muted-foreground">Poznamky</span>
              <div className="text-sm mt-1 prose prose-sm dark:prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.notes) }} data-testid="text-detail-notes" />
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span>Cas spracovania: {formatProcessingTime(product.processingTimeSec || 0)}</span>
            <span>Vytvorene: {formatDateSlovak(product.createdAt)}</span>
          </div>

          <CommissionSection productId={product.id} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteProductDialog({
  product,
  open,
  onOpenChange,
}: {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [adminCode, setAdminCode] = useState("");

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/products/${product.id}`, { adminCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Uspech", description: "Produkt vymazany" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat produkt", variant: "destructive" }),
  });

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      setStep(1);
      setAdminCode("");
    }
    onOpenChange(isOpen);
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle data-testid="text-delete-dialog-title">Vymazat produkt</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Pre vymazanie produktu <span className="font-medium text-foreground">{product.name}</span> zadajte admin kod.
            </p>
            <Input
              type="password"
              placeholder="Admin kod"
              value={adminCode}
              onChange={e => setAdminCode(e.target.value)}
              data-testid="input-delete-admin-code"
            />
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-delete-cancel">
                Zrusit
              </Button>
              <Button type="button" variant="destructive" onClick={() => { if (adminCode) setStep(2); }} disabled={!adminCode} data-testid="button-delete-next">
                Dalej
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="p-4 rounded-md border border-destructive/50 bg-destructive/10">
              <p className="text-sm font-medium text-destructive">Naozaj vymazat?</p>
              <p className="text-xs text-muted-foreground mt-1">
                Produkt <span className="font-medium">{product.name}</span> ({product.code}) bude oznaceny ako vymazany. Tuto akciu nie je mozne vratit.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} data-testid="button-delete-back">
                Spat
              </Button>
              <Button type="button" variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} data-testid="button-delete-confirm">
                {deleteMutation.isPending ? "Mazem..." : "Vymazat"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Products() {
  const { data: appUser } = useAppUser();
  const { data: products, isLoading } = useProducts();
  const { data: partners } = usePartners();
  const { data: companies } = useMyCompanies();
  const { data: allStates } = useStates();

  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const columnVisibility = useColumnVisibility("products", PRODUCT_COLUMNS);
  const activeProducts = products?.filter(p => !p.isDeleted) || [];
  const tableFilter = useSmartFilter(activeProducts, PRODUCT_FILTER_COLUMNS, "products");
  const { sortedData: sortedProducts, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);

  function getPartnerName(id: number | null) {
    if (!id || !partners) return "-";
    return partners.find(p => p.id === id)?.name || "-";
  }

  function getCompanyName(id: number | null) {
    if (!id || !companies) return "-";
    return companies.find(c => c.id === id)?.name || "-";
  }

  function getStateName(id: number | null) {
    if (!id || !allStates) return "-";
    return allStates.find(s => s.id === id)?.name || "-";
  }

  function handleEdit(product: Product) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  function handleAdd() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function handleDelete(product: Product) {
    setDeleteProduct(product);
    setDeleteOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold" data-testid="text-page-title">Katalóg produktov</h2>
            <HelpIcon text="Katalog produktov v hierarchii Sektor > Sekcia > Produkt. Produkty obsahuju panely s parametrami." side="right" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">Správa produktov</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
        </div>
      </div>

      {canCreateRecords(appUser) && (
        <AddProductCard onClick={handleAdd} />
      )}

      <Card style={{ marginTop: -50 }}>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : activeProducts.length === 0 ? (
            <div className="text-center pb-10 text-sm text-muted-foreground" data-testid="text-no-products">
              Ziadne produkty.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columnVisibility.isVisible("code") && <TableHead sortKey="code" sortDirection={sortKey === "code" ? sortDirection : null} onSort={requestSort}>Kod</TableHead>}
                  {columnVisibility.isVisible("name") && <TableHead sortKey="name" sortDirection={sortKey === "name" ? sortDirection : null} onSort={requestSort}>Nazov</TableHead>}
                  {columnVisibility.isVisible("displayName") && <TableHead sortKey="displayName" sortDirection={sortKey === "displayName" ? sortDirection : null} onSort={requestSort}>Zobrazovaci nazov</TableHead>}
                  {columnVisibility.isVisible("partnerId") && <TableHead sortKey="partnerId" sortDirection={sortKey === "partnerId" ? sortDirection : null} onSort={requestSort}>Partner</TableHead>}
                  {columnVisibility.isVisible("companyId") && <TableHead sortKey="companyId" sortDirection={sortKey === "companyId" ? sortDirection : null} onSort={requestSort}>Spolocnost</TableHead>}
                  {columnVisibility.isVisible("stateId") && <TableHead sortKey="stateId" sortDirection={sortKey === "stateId" ? sortDirection : null} onSort={requestSort}>Stat</TableHead>}
                  {columnVisibility.isVisible("allowedSpecialists") && <TableHead>Povoleni specialisti</TableHead>}
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedProducts.map(product => (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`} onRowClick={() => handleEdit(product)}>
                    {columnVisibility.isVisible("code") && <TableCell className="font-mono text-xs">{product.code}</TableCell>}
                    {columnVisibility.isVisible("name") && <TableCell className="font-medium">{product.name}</TableCell>}
                    {columnVisibility.isVisible("displayName") && <TableCell className="text-sm text-muted-foreground">{product.displayName || "-"}</TableCell>}
                    {columnVisibility.isVisible("partnerId") && <TableCell className="text-sm">{getPartnerName(product.partnerId)}</TableCell>}
                    {columnVisibility.isVisible("companyId") && <TableCell className="text-sm">{getCompanyName(product.companyId)}</TableCell>}
                    {columnVisibility.isVisible("stateId") && <TableCell className="text-sm">{getStateName(product.stateId)}</TableCell>}
                    {columnVisibility.isVisible("allowedSpecialists") && <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {product.allowedSpecialists && product.allowedSpecialists.length > 0
                          ? product.allowedSpecialists.map(s => (
                              <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                            ))
                          : <span className="text-xs text-muted-foreground">-</span>
                        }
                      </div>
                    </TableCell>}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setDetailProduct(product)} data-testid={`button-view-product-${product.id}`}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {canEditRecords(appUser) && (
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(product)} data-testid={`button-edit-product-${product.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canDeleteRecords(appUser) && (
                          <ConditionalDelete canDelete={true} onClick={() => handleDelete(product)} testId={`button-delete-product-${product.id}`} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingProduct={editingProduct}
      />

      {detailProduct && (
        <ProductDetailDialog
          product={detailProduct}
          onClose={() => setDetailProduct(null)}
          partners={partners || []}
          companies={companies || []}
          states={allStates || []}
        />
      )}

      {deleteProduct && (
        <DeleteProductDialog
          product={deleteProduct}
          open={deleteOpen}
          onOpenChange={(open) => {
            setDeleteOpen(open);
            if (!open) setDeleteProduct(null);
          }}
        />
      )}
    </div>
  );
}
