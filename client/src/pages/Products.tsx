import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import DOMPurify from "dompurify";
import { AddProductCard } from "@/components/AddProductCard";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateSlovak, canCreateRecords, canEditRecords, canDeleteRecords, isAdmin } from "@/lib/utils";
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
import { Plus, Eye, Package, Loader2, HelpCircle, Trash2, FileText, Copy, AlertCircle, Archive, GitBranch, ChevronDown, ChevronRight, History } from "lucide-react";
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
import type { ProductDisplayParam } from "@shared/schema";

const PRODUCT_COLUMNS: ColumnDef[] = [
  { key: "partnerId", label: "Partner" },
  { key: "name", label: "Názov produktu" },
  { key: "code", label: "Kód produktu" },
  { key: "displayName", label: "Zobrazovací kód" },
  { key: "allowedSpecialists", label: "Povolení specialisti" },
];

const PRODUCT_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "partnerId", label: "Partner", type: "number" },
  { key: "name", label: "Názov produktu", type: "text" },
  { key: "code", label: "Kód produktu", type: "text" },
  { key: "displayName", label: "Zobrazovací kód", type: "text" },
];

const SPECIALIST_TYPES = ["NBS", "Zbrojny preukaz", "Reality", "Poistenie", "Dochodok", "Ine"];

function formatProcessingTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useProducts() {
  const { data: appUser } = useAppUser();
  const companyId = appUser?.activeCompanyId ?? null;
  const stateId = appUser?.activeStateId ?? null;
  return useQuery<Product[]>({
    queryKey: ["/api/products", { companyId, stateId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", String(companyId));
      if (stateId) params.set("stateId", String(stateId));
      const url = `/api/products${params.toString() ? `?${params}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
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

function DocBubble({ color, label, docs, setDocs, inputValue, setInputValue, placeholder, testIdPrefix, copyTargets }: {
  color: "red" | "blue";
  label: string;
  docs: string[];
  setDocs: React.Dispatch<React.SetStateAction<string[]>>;
  inputValue: string;
  setInputValue: (v: string) => void;
  placeholder: string;
  testIdPrefix: string;
  copyTargets?: Array<React.Dispatch<React.SetStateAction<string[]>>>;
}) {
  const c = color === "red"
    ? { border: "border-red-500/25", bg: "bg-red-500/5", text: "text-red-700 dark:text-red-400", badge: "bg-red-500/20 text-red-700 dark:text-red-400", listBorder: "border-red-500/20", dash: "border-dashed border-red-500/20" }
    : { border: "border-blue-500/25", bg: "bg-blue-500/5", text: "text-blue-700 dark:text-blue-400", badge: "bg-blue-500/20 text-blue-700 dark:text-blue-400", listBorder: "border-blue-500/20", dash: "border-dashed border-blue-500/20" };
  const add = () => { if (inputValue.trim()) { setDocs(prev => [...prev, inputValue.trim()]); setInputValue(""); } };
  const copyDoc = (doc: string) => {
    copyTargets?.forEach(setter => {
      setter(prev => prev.includes(doc) ? prev : [...prev, doc]);
    });
  };
  return (
    <div className={`rounded-lg border ${c.border} ${c.bg} p-4 space-y-3`}>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold uppercase tracking-wide ${c.text}`}>{label}</span>
        {docs.length > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.badge} font-semibold`}>{docs.length}</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          data-testid={`input-doc-${testIdPrefix}`}
        />
        <Button type="button" size="sm" onClick={add} disabled={!inputValue.trim()} data-testid={`button-add-doc-${testIdPrefix}`}>
          <Plus className="w-4 h-4 mr-1" />Pridať
        </Button>
      </div>
      {docs.length > 0 ? (
        <div className={`rounded-md border ${c.listBorder} divide-y divide-border bg-card`}>
          {docs.map((doc, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className={`w-3.5 h-3.5 ${c.text} flex-shrink-0`} />
                <span className="text-sm truncate" data-testid={`text-doc-${testIdPrefix}-${idx}`}>{doc}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {copyTargets && copyTargets.length > 0 && (
                  <Button
                    type="button"
                    size="icon" variant="ghost" className="h-7 w-7"
                    title="Skopírovať do ostatných stĺpcov"
                    onClick={() => copyDoc(doc)}
                    data-testid={`button-copy-doc-${testIdPrefix}-${idx}`}
                  >
                    <Copy className="w-3 h-3 text-muted-foreground" />
                  </Button>
                )}
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDocs(prev => prev.filter((_, i) => i !== idx))} data-testid={`button-remove-doc-${testIdPrefix}-${idx}`}>
                  <Trash2 className="w-3 h-3 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`rounded-md border ${c.dash} p-3 text-center`}>
          <p className="text-xs text-muted-foreground">Žiadne dokumenty.</p>
        </div>
      )}
    </div>
  );
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
  const [contextError, setContextError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "dokumentacia" | "parametre">("info");
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneVersionLabel, setCloneVersionLabel] = useState("");

  // Display params state for "Parametre zhrnutia zmluvy" tab
  type DisplayParamState = { display: boolean; verify: boolean };
  const [displayParamConfig, setDisplayParamConfig] = useState<Record<string, DisplayParamState>>({});
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [optionalDocuments, setOptionalDocuments] = useState<string[]>([]);
  const [requiredDocumentsReceived, setRequiredDocumentsReceived] = useState<string[]>([]);
  const [optionalDocumentsReceived, setOptionalDocumentsReceived] = useState<string[]>([]);
  const [requiredDocumentsPartner, setRequiredDocumentsPartner] = useState<string[]>([]);
  const [optionalDocumentsPartner, setOptionalDocumentsPartner] = useState<string[]>([]);
  const [newDocName, setNewDocName] = useState("");
  const [newOptDocName, setNewOptDocName] = useState("");
  const [newDocReceivedName, setNewDocReceivedName] = useState("");
  const [newOptDocReceivedName, setNewOptDocReceivedName] = useState("");
  const [newDocPartnerName, setNewDocPartnerName] = useState("");
  const [newOptDocPartnerName, setNewOptDocPartnerName] = useState("");
  const [docSection, setDocSection] = useState<"central" | "received" | "partner">("central");

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

  const { data: existingDisplayParams } = useQuery<ProductDisplayParam[]>({
    queryKey: ["/api/products", editingProduct?.id, "display-params"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${editingProduct!.id}/display-params`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingProduct?.id,
  });

  const { data: productSubjectParamsRaw } = useQuery<{ clientTypeId: number; typeLabel: string; fields: { fieldKey: string; label: string; shortLabel?: string; panelName?: string | null; folderCategory?: string }[] }[]>({
    queryKey: ["/api/products", editingProduct?.id, "subject-params"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${editingProduct!.id}/subject-params`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingProduct?.id,
  });

  const { data: productPanelsWithParams } = useQuery<{ id: number; name: string; parameters: { id: number; name: string; paramType: string }[] }[]>({
    queryKey: ["/api/products", editingProduct?.id, "panels-with-parameters"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${editingProduct!.id}/panels-with-parameters`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingProduct?.id,
  });

  const dynamicSubjectFields = useMemo(() => {
    if (!productSubjectParamsRaw || productSubjectParamsRaw.length === 0) return [];
    const seen = new Set<string>();
    const result: { key: string; label: string; typeLabel: string; panelName: string | null }[] = [];
    const multiType = productSubjectParamsRaw.length > 1;
    for (const typeGroup of productSubjectParamsRaw) {
      for (const f of typeGroup.fields) {
        if (seen.has(f.fieldKey)) continue;
        seen.add(f.fieldKey);
        result.push({ key: f.fieldKey, label: f.label, typeLabel: multiType ? typeGroup.typeLabel : "", panelName: f.panelName ?? null });
      }
    }
    return result;
  }, [productSubjectParamsRaw]);

  const dynamicContractFields = useMemo(() => {
    const seen = new Set<number>();
    const result: { key: string; label: string; panelName: string | null }[] = [];
    for (const panel of (productPanelsWithParams || [])) {
      for (const param of (panel.parameters || [])) {
        if (seen.has(param.id)) continue;
        seen.add(param.id);
        result.push({ key: `param_${param.id}`, label: param.name, panelName: panel.name });
      }
    }
    for (const param of assignedParams) {
      if (seen.has(param.id)) continue;
      seen.add(param.id);
      result.push({ key: `param_${param.id}`, label: param.name, panelName: null });
    }
    return result;
  }, [productPanelsWithParams, assignedParams]);

  const saveDisplayParamsMutation = useMutation({
    mutationFn: (params: Array<{ paramKey: string; label: string; displayInSummary: boolean; requireVerification: boolean; sortOrder: number; paramGroup: string }>) =>
      apiRequest("PUT", `/api/products/${editingProduct!.id}/display-params`, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products", editingProduct?.id, "display-params"] });
      toast({ title: "Uložené", description: "Parametre zhrnutia uložené" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa uložiť parametre", variant: "destructive" }),
  });

  const cloneMutation = useMutation({
    mutationFn: (versionLabel: string) => apiRequest("POST", `/api/products/${editingProduct?.id}/clone`, { versionLabel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Klon vytvorený", description: "Nová verzia produktu bola vytvorená" });
      setCloneDialogOpen(false);
      setCloneVersionLabel("");
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa klonovať produkt", variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/products/${editingProduct?.id}/archive`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Archivované", description: "Produkt bol archivovaný" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa archivovať produkt", variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({ title: "Uspech", description: "Produkt vytvoreny" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      try {
        const text = err?.message || "";
        const jsonPart = text.replace(/^\d+:\s*/, "");
        const data = JSON.parse(jsonPart);
        if (data?.code === 'CONTEXT_MISMATCH' && data?.message) {
          setContextError(data.message);
          return;
        }
        if (data?.message) { toast({ title: "Chyba", description: data.message, variant: "destructive" }); return; }
      } catch {}
      toast({ title: "Chyba", description: "Nepodarilo sa vytvorit produkt", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/products/${editingProduct?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks/count"] });
      if (activeTab === "info") {
        toast({ title: "Uložené", description: "Produkt uložený — doplňte dokumentáciu" });
        setActiveTab("dokumentacia");
      } else {
        toast({ title: "Uspech", description: "Produkt aktualizovany" });
        onOpenChange(false);
      }
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat produkt", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      setActiveTab("info");
      setNewDocName("");
      setDisplayParamConfig({});
      setCloneDialogOpen(false);
      setCloneVersionLabel("");
      if (editingProduct) {
        setPartnerId(editingProduct.partnerId?.toString() || "");
        setCode(editingProduct.code || "");
        setName(editingProduct.name || "");
        setDescription(editingProduct.description || "");
        setAllowedSpecialists(editingProduct.allowedSpecialists || []);
        setAllowedSubjectTypes((editingProduct as any).allowedSubjectTypes || []);
        setNotesHtml(editingProduct.notes || "");
        setRequiredDocuments((editingProduct as any).requiredDocuments || []);
        setOptionalDocuments((editingProduct as any).optionalDocuments || []);
        setRequiredDocumentsReceived((editingProduct as any).requiredDocumentsReceived || []);
        setOptionalDocumentsReceived((editingProduct as any).optionalDocumentsReceived || []);
        setRequiredDocumentsPartner((editingProduct as any).requiredDocumentsPartner || []);
        setOptionalDocumentsPartner((editingProduct as any).optionalDocumentsPartner || []);
      } else {
        setPartnerId("");
        setCode("");
        setName("");
        setDescription("");
        setAllowedSpecialists([]);
        setAllowedSubjectTypes([]);
        setNotesHtml("");
        setRequiredDocuments([]);
        setOptionalDocuments([]);
        setRequiredDocumentsReceived([]);
        setOptionalDocumentsReceived([]);
        setRequiredDocumentsPartner([]);
        setOptionalDocumentsPartner([]);
      }
      setDocSection("central");
    }
  }, [open, editingProduct]);

  // Sync display params when loaded from server
  useEffect(() => {
    if (!existingDisplayParams) return;
    const config: Record<string, { display: boolean; verify: boolean }> = {};
    for (const p of existingDisplayParams) {
      config[p.paramKey] = { display: p.displayInSummary, verify: p.requireVerification };
    }
    setDisplayParamConfig(config);
  }, [existingDisplayParams]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) setContextError(null);
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
      optionalDocuments,
      requiredDocumentsReceived,
      optionalDocumentsReceived,
      requiredDocumentsPartner,
      optionalDocumentsPartner,
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
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size={activeTab === "dokumentacia" ? "xl" : activeTab === "parametre" ? "lg" : "md"}>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <DialogHeader>
          <div className="flex items-start justify-between gap-2">
            <DialogTitle data-testid="text-product-dialog-title">
              {editingProduct ? "Upravit produkt" : "Pridat produkt"}
            </DialogTitle>
            {editingProduct && editingProduct.isArchived && (
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 shrink-0 mt-0.5" data-testid="badge-product-archived">
                <Archive className="w-3 h-3 mr-1" />
                Archivovaný{editingProduct.versionLabel ? ` · ${editingProduct.versionLabel}` : ""}
              </Badge>
            )}
            {editingProduct && !editingProduct.isArchived && editingProduct.versionLabel && (
              <Badge variant="outline" className="shrink-0 mt-0.5 font-mono text-xs" data-testid="badge-product-version">
                <GitBranch className="w-3 h-3 mr-1" />
                {editingProduct.versionLabel}
              </Badge>
            )}
          </div>
        </DialogHeader>
        {contextError && (
          <div className="flex gap-3 items-start border-2 border-red-500 rounded-md p-3 mb-3 text-sm bg-red-50 dark:bg-red-950 text-justify" role="alert" data-testid="alert-context-mismatch">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <span className="text-red-700 dark:text-red-300">{contextError}</span>
          </div>
        )}

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
            <span style={{ display: (requiredDocuments.length + optionalDocuments.length + requiredDocumentsReceived.length + optionalDocumentsReceived.length + requiredDocumentsPartner.length + optionalDocumentsPartner.length) > 0 ? 'inline' : 'none' }}>
              <Badge variant="secondary" className="text-[10px] px-1.5 ml-0.5">{requiredDocuments.length + optionalDocuments.length + requiredDocumentsReceived.length + optionalDocumentsReceived.length + requiredDocumentsPartner.length + optionalDocumentsPartner.length}</Badge>
            </span>
          </button>
          {editingProduct && (
            <button
              type="button"
              className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === "parametre" ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              onClick={() => setActiveTab("parametre")}
              data-testid="tab-product-parametre"
            >
              <Package className="w-3.5 h-3.5" />
              Parametre zhrnutia
              {Object.values(displayParamConfig).some(c => c.display) && (
                <Badge variant="secondary" className="text-[10px] px-1.5 ml-0.5">
                  {Object.values(displayParamConfig).filter(c => c.display).length}
                </Badge>
              )}
            </button>
          )}
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

            <div className="rounded border border-border p-3 space-y-2">
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
                  { val: "os", label: "OS", desc: "Ostatné subjekty" },
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
                <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <span>⚠</span>
                  Produkt bude dostupný len pre: {allowedSubjectTypes.map(t => t === "person" ? "FO" : t === "szco" ? "SZČO" : t === "company" ? "PO" : t === "organization" ? "TS" : t === "state" ? "VS" : "OS").join(", ")}. Zmluvy s iným typom subjektu budú odmietnuté.
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

            {editingProduct && isAdmin(appUser) && (
              <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  Správa verzií
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {!editingProduct.isArchived && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCloneDialogOpen(true)}
                      data-testid="button-clone-product"
                    >
                      <GitBranch className="w-3.5 h-3.5 mr-1.5" />
                      Klonovať ako novú verziu
                    </Button>
                  )}
                  {!editingProduct.isArchived && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
                      onClick={() => {
                        if (confirm(`Naozaj archivovať produkt „${editingProduct.name}"? Archivovaný produkt nie je možné priradiť k novým zmluvám.`)) {
                          archiveMutation.mutate();
                        }
                      }}
                      disabled={archiveMutation.isPending}
                      data-testid="button-archive-product"
                    >
                      <Archive className="w-3.5 h-3.5 mr-1.5" />
                      {archiveMutation.isPending ? "Archivujem..." : "Archivovať verziu"}
                    </Button>
                  )}
                  {editingProduct.isArchived && (
                    <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1">
                      <Archive className="w-3.5 h-3.5" />
                      Tento produkt je archivovaný a nie je možné ho priradiť k novým zmluvám.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end mt-6">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-product-cancel">
                Zrusit
              </Button>
            </div>
          </div>
        </div>

        <div style={{ display: activeTab === "dokumentacia" ? 'block' : 'none' }}>
          <div className="grid grid-cols-3 gap-4">
            {/* STĹPEC 1 — Pri odovzdaní do centrály */}
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-amber-500/20">
                <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Pri odovzdaní do centrály</span>
                {(requiredDocuments.length + optionalDocuments.length) > 0 && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-semibold">{requiredDocuments.length + optionalDocuments.length}</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Dokumenty, ktoré špecialista <strong className="text-foreground/70">odovzdá do centrály</strong> spolu so zmluvou — zaraďujú sa do sprievodky a musia byť skompletizované pred odoslaním.</p>
              <DocBubble color="red" label="Povinné" docs={requiredDocuments} setDocs={setRequiredDocuments} inputValue={newDocName} setInputValue={setNewDocName} placeholder="Povinný dokument..." testIdPrefix="central-req" copyTargets={[setRequiredDocumentsReceived, setRequiredDocumentsPartner]} />
              <DocBubble color="blue" label="Nepovinné" docs={optionalDocuments} setDocs={setOptionalDocuments} inputValue={newOptDocName} setInputValue={setNewOptDocName} placeholder="Nepovinný dokument..." testIdPrefix="central-opt" copyTargets={[setOptionalDocumentsReceived, setOptionalDocumentsPartner]} />
            </div>

            {/* STĹPEC 2 — Prijatá centrálou */}
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-emerald-500/20">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Prijatá centrálou</span>
                {(requiredDocumentsReceived.length + optionalDocumentsReceived.length) > 0 && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold">{requiredDocumentsReceived.length + optionalDocumentsReceived.length}</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Dokumenty, ktoré centrála <strong className="text-foreground/70">akceptuje a eviduje</strong> po prijatí zmluvy — kontrolný zoznam pre backoffice pri spracovaní.</p>
              <DocBubble color="red" label="Povinné" docs={requiredDocumentsReceived} setDocs={setRequiredDocumentsReceived} inputValue={newDocReceivedName} setInputValue={setNewDocReceivedName} placeholder="Povinný dokument..." testIdPrefix="received-req" copyTargets={[setRequiredDocuments, setRequiredDocumentsPartner]} />
              <DocBubble color="blue" label="Nepovinné" docs={optionalDocumentsReceived} setDocs={setOptionalDocumentsReceived} inputValue={newOptDocReceivedName} setInputValue={setNewOptDocReceivedName} placeholder="Nepovinný dokument..." testIdPrefix="received-opt" copyTargets={[setOptionalDocuments, setOptionalDocumentsPartner]} />
            </div>

            {/* STĹPEC 3 — Odovzdaná obchodnému partnerovi */}
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-4 space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-violet-500/20">
                <FileText className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Odovzdaná partnerovi</span>
                {(requiredDocumentsPartner.length + optionalDocumentsPartner.length) > 0 && (
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-700 dark:text-violet-300 font-semibold">{requiredDocumentsPartner.length + optionalDocumentsPartner.length}</span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">Dokumenty, ktoré špecialista <strong className="text-foreground/70">odovzdá obchodnému partnerovi</strong> (poisťovňa, banka, fond) po uzavretí zmluvy — potvrdenia a kópie pre partnera.</p>
              <DocBubble color="red" label="Povinné" docs={requiredDocumentsPartner} setDocs={setRequiredDocumentsPartner} inputValue={newDocPartnerName} setInputValue={setNewDocPartnerName} placeholder="Povinný dokument..." testIdPrefix="partner-req" copyTargets={[setRequiredDocuments, setRequiredDocumentsReceived]} />
              <DocBubble color="blue" label="Nepovinné" docs={optionalDocumentsPartner} setDocs={setOptionalDocumentsPartner} inputValue={newOptDocPartnerName} setInputValue={setNewOptDocPartnerName} placeholder="Nepovinný dokument..." testIdPrefix="partner-opt" copyTargets={[setOptionalDocuments, setOptionalDocumentsReceived]} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-product-docs-cancel">
              Zavrieť bez uloženia
            </Button>
          </div>
        </div>

        {/* ─── TAB: Parametre zhrnutia zmluvy ──────────────────────────── */}
        <div style={{ display: activeTab === "parametre" ? 'block' : 'none' }}>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Nakonfigurujte, ktoré parametre sa zobrazujú v zhrnutí zmluvy a ktoré musí Backoffice overiť.
              Pravidlo: <strong>čo sa nezobrazuje, to sa neoveruje</strong>.
            </p>

            {/* Parametre subjektu — dynamicky z profilu subjektu */}
            <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 pb-1 border-b border-blue-500/20">Parametre subjektu</p>
              {dynamicSubjectFields.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 italic">
                  {allowedSubjectTypes.length === 0
                    ? "Najprv nastavte typ subjektu v záložke Info (Pre koho je produkt určený)."
                    : "Žiadne polia subjektu nenájdené."}
                </p>
              ) : (
                <div className="space-y-0">
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1">
                    <span className="text-[11px] text-muted-foreground font-medium">Parameter</span>
                    <span className="text-[11px] text-muted-foreground font-medium w-24 text-center">Zobrazovať</span>
                    <span className="text-[11px] text-muted-foreground font-medium w-24 text-center">Overiť BO</span>
                  </div>
                  {dynamicSubjectFields.map((param, i) => {
                    const cfg = displayParamConfig[param.key] || { display: false, verify: false };
                    return (
                      <div
                        key={param.key}
                        className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1.5 rounded ${i % 2 === 0 ? "bg-background/50" : ""}`}
                        data-testid={`row-display-param-${param.key}`}
                      >
                        <div className="min-w-0">
                          <span className="text-sm">{param.label}</span>
                          {(param.typeLabel || param.panelName) && (
                            <span className="text-[10px] text-muted-foreground ml-1.5">
                              {[param.panelName, param.typeLabel].filter(Boolean).join(" · ")}
                            </span>
                          )}
                        </div>
                        <div className="w-24 flex justify-center">
                          <Switch
                            checked={cfg.display}
                            onCheckedChange={(checked) => {
                              setDisplayParamConfig(prev => ({
                                ...prev,
                                [param.key]: { display: checked, verify: checked ? prev[param.key]?.verify ?? false : false },
                              }));
                            }}
                            data-testid={`switch-display-${param.key}`}
                          />
                        </div>
                        <div className="w-24 flex justify-center">
                          <Switch
                            checked={cfg.display ? cfg.verify : false}
                            disabled={!cfg.display}
                            onCheckedChange={(checked) => {
                              setDisplayParamConfig(prev => ({
                                ...prev,
                                [param.key]: { display: prev[param.key]?.display ?? false, verify: checked },
                              }));
                            }}
                            data-testid={`switch-verify-${param.key}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Parametre zmluvy — z panelov sektorov + priradených parametrov produktu */}
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 pb-1 border-b border-amber-500/20">Parametre zmluvy</p>
              {dynamicContractFields.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2 italic">
                  Produkt nemá priradené žiadne parametre. Pridajte parametre v Sektory a Odvetvia Zmlúv alebo v Knižnici parametrov.
                </p>
              ) : (
                <div className="space-y-0">
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1">
                    <span className="text-[11px] text-muted-foreground font-medium">Parameter</span>
                    <span className="text-[11px] text-muted-foreground font-medium w-24 text-center">Zobrazovať</span>
                    <span className="text-[11px] text-muted-foreground font-medium w-24 text-center">Overiť BO</span>
                  </div>
                  {dynamicContractFields.map((param, i) => {
                    const cfg = displayParamConfig[param.key] || { display: false, verify: false };
                    return (
                      <div
                        key={param.key}
                        className={`grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1.5 rounded ${i % 2 === 0 ? "bg-background/50" : ""}`}
                        data-testid={`row-display-param-${param.key}`}
                      >
                        <div className="min-w-0">
                          <span className="text-sm">{param.label}</span>
                          {param.panelName && (
                            <span className="text-[10px] text-muted-foreground ml-1.5">{param.panelName}</span>
                          )}
                        </div>
                        <div className="w-24 flex justify-center">
                          <Switch
                            checked={cfg.display}
                            onCheckedChange={(checked) => {
                              setDisplayParamConfig(prev => ({
                                ...prev,
                                [param.key]: { display: checked, verify: checked ? prev[param.key]?.verify ?? false : false },
                              }));
                            }}
                            data-testid={`switch-display-${param.key}`}
                          />
                        </div>
                        <div className="w-24 flex justify-center">
                          <Switch
                            checked={cfg.display ? cfg.verify : false}
                            disabled={!cfg.display}
                            onCheckedChange={(checked) => {
                              setDisplayParamConfig(prev => ({
                                ...prev,
                                [param.key]: { display: prev[param.key]?.display ?? false, verify: checked },
                              }));
                            }}
                            data-testid={`switch-verify-${param.key}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Zobrazované: <strong>{Object.values(displayParamConfig).filter(c => c.display).length}</strong> /
                Overované BO: <strong>{Object.values(displayParamConfig).filter(c => c.display && c.verify).length}</strong>
              </p>
              <Button
                type="button"
                onClick={() => {
                  let sortIdx = 0;
                  const allParams: { paramKey: string; label: string; displayInSummary: boolean; requireVerification: boolean; sortOrder: number; paramGroup: string }[] = [];
                  for (const p of dynamicSubjectFields) {
                    if (displayParamConfig[p.key]?.display) {
                      allParams.push({ paramKey: p.key, label: p.label, displayInSummary: true, requireVerification: displayParamConfig[p.key]?.verify ?? false, sortOrder: sortIdx++, paramGroup: "subjekt" });
                    }
                  }
                  for (const p of dynamicContractFields) {
                    if (displayParamConfig[p.key]?.display) {
                      allParams.push({ paramKey: p.key, label: p.label, displayInSummary: true, requireVerification: displayParamConfig[p.key]?.verify ?? false, sortOrder: sortIdx++, paramGroup: "zmluva" });
                    }
                  }
                  saveDisplayParamsMutation.mutate(allParams);
                }}
                disabled={saveDisplayParamsMutation.isPending}
                data-testid="button-save-display-params"
              >
                {saveDisplayParamsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Uložiť parametre
              </Button>
            </div>
          </div>
        </div>

        {activeTab !== "parametre" && (
          <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
        )}
        </form>
      </DialogContent>
    </Dialog>

    {cloneDialogOpen && editingProduct && (
      <Dialog open={cloneDialogOpen} onOpenChange={setCloneDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Klonovať produkt ako novú verziu</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Vytvorí sa presná kópia produktu <strong>{editingProduct.name}</strong> s novým štítkom verzie. Pôvodný produkt zostane nezmenený.
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Štítok verzie *</label>
              <Input
                value={cloneVersionLabel}
                onChange={e => setCloneVersionLabel(e.target.value)}
                placeholder="napr. v2026_04_01"
                data-testid="input-clone-version-label"
              />
              <p className="text-xs text-muted-foreground">Odporúčaný formát: v{new Date().getFullYear()}_{String(new Date().getMonth() + 1).padStart(2, '0')}_{String(new Date().getDate()).padStart(2, '0')}</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => { setCloneDialogOpen(false); setCloneVersionLabel(""); }} data-testid="button-clone-cancel">
                Zrušiť
              </Button>
              <Button
                type="button"
                onClick={() => { if (cloneVersionLabel.trim()) cloneMutation.mutate(cloneVersionLabel.trim()); }}
                disabled={!cloneVersionLabel.trim() || cloneMutation.isPending}
                data-testid="button-clone-confirm"
              >
                <GitBranch className="w-4 h-4 mr-1.5" />
                {cloneMutation.isPending ? "Klonujem..." : "Vytvoriť klon"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
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

function ProductVersionHistoryRow({ productId, colSpanCount, onEditVersion, expanded }: {
  productId: number;
  colSpanCount: number;
  onEditVersion: (product: Product) => void;
  expanded: boolean;
}) {
  const { data: versions, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products", productId, "version-history"],
    queryFn: async () => {
      const res = await fetch(`/api/products/${productId}/version-history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: expanded,
  });
  const childVersions = (versions || []).filter(v => v.id !== productId);
  if (!expanded) return null;
  return (
    <TableRow className="bg-muted/20">
      <TableCell colSpan={colSpanCount} className="py-2 px-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" />
            Načítavam históriu verzií...
          </div>
        ) : childVersions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Žiadne iné verzie pre tento produkt.</p>
        ) : (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">História verzií</p>
            {childVersions.map(v => (
              <div key={v.id} className="flex items-center gap-3 text-xs">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${v.isArchived ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" : "bg-primary/10 text-primary"}`}>
                  {v.isArchived && <Archive className="w-2.5 h-2.5" />}
                  {v.versionLabel || `ID ${v.id}`}
                </span>
                <span className="text-muted-foreground">{v.name}</span>
                <span className="text-muted-foreground font-mono">{v.code}</span>
                {v.isArchived && <span className="text-orange-600 dark:text-orange-400 text-[10px]">archivovaný</span>}
                <button
                  className="ml-auto text-primary hover:underline text-[11px]"
                  onClick={() => onEditVersion(v)}
                  data-testid={`button-edit-version-${v.id}`}
                >
                  Otvoriť
                </button>
              </div>
            ))}
          </div>
        )}
      </TableCell>
    </TableRow>
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
  const [expandedVersionHistory, setExpandedVersionHistory] = useState<Set<number>>(new Set());

  const columnVisibility = useColumnVisibility("products", PRODUCT_COLUMNS);
  const activeProducts = products?.filter(p => !p.isDeleted) || [];
  const tableFilter = useSmartFilter(activeProducts, PRODUCT_FILTER_COLUMNS, "products");
  const { sortedData: sortedProducts, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);

  const { data: companyDivisions } = useQuery<{ id: number; companyId: number; divisionId: number; division: { id: number; name: string; emoji: string | null; code: string | null } }[]>({
    queryKey: ["/api/companies", appUser?.activeCompanyId, "divisions"],
    queryFn: async () => {
      if (!appUser?.activeCompanyId) return [];
      const res = await fetch(`/api/companies/${appUser.activeCompanyId}/divisions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!appUser?.activeCompanyId,
  });
  const { data: sectors } = useQuery<{ id: number; divisionId: number | null; partnerIds: number[] }[]>({
    queryKey: ["/api/sectors"],
    queryFn: async () => {
      const res = await fetch("/api/sectors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const divisionList = useMemo(() => companyDivisions?.map(cd => cd.division) || [], [companyDivisions]);
  const hasManyDivisions = divisionList.length >= 2;

  const divisionPartnerMap = useMemo(() => {
    const map = new Map<number, Set<number>>();
    sectors?.forEach(s => {
      if (s.divisionId && s.partnerIds?.length) {
        if (!map.has(s.divisionId)) map.set(s.divisionId, new Set());
        s.partnerIds.forEach(pid => map.get(s.divisionId!)!.add(pid));
      }
    });
    return map;
  }, [sectors]);

  const groupedProducts = useMemo(() => {
    if (!hasManyDivisions) return null;
    const getProductDivisionId = (p: Product) => {
      if (!p.partnerId) return null;
      for (const [divId, pids] of divisionPartnerMap.entries()) {
        if (pids.has(p.partnerId)) return divId;
      }
      return null;
    };
    const groups: Array<{ division: { id: number; name: string; emoji: string | null; code: string | null } | null; rows: typeof sortedProducts }> = [];
    const assignedIds = new Set<number>();
    for (const div of divisionList) {
      const rows = sortedProducts.filter(p => getProductDivisionId(p) === div.id);
      if (rows.length > 0) {
        groups.push({ division: div, rows });
        rows.forEach(p => assignedIds.add(p.id));
      }
    }
    const unassigned = sortedProducts.filter(p => !assignedIds.has(p.id));
    if (unassigned.length > 0) groups.push({ division: null, rows: unassigned });
    return groups;
  }, [hasManyDivisions, divisionList, divisionPartnerMap, sortedProducts]);

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
                  {columnVisibility.isVisible("partnerId") && <TableHead sortKey="partnerId" sortDirection={sortKey === "partnerId" ? sortDirection : null} onSort={requestSort}>Partner</TableHead>}
                  {columnVisibility.isVisible("name") && <TableHead sortKey="name" sortDirection={sortKey === "name" ? sortDirection : null} onSort={requestSort}>Názov produktu</TableHead>}
                  {columnVisibility.isVisible("code") && <TableHead sortKey="code" sortDirection={sortKey === "code" ? sortDirection : null} onSort={requestSort}>Kód produktu</TableHead>}
                  {columnVisibility.isVisible("displayName") && <TableHead sortKey="displayName" sortDirection={sortKey === "displayName" ? sortDirection : null} onSort={requestSort}>Zobrazovací kód</TableHead>}
                  {columnVisibility.isVisible("allowedSpecialists") && <TableHead>Povolení specialisti</TableHead>}
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(() => {
                  const colSpanCount = [
                    columnVisibility.isVisible("partnerId"),
                    columnVisibility.isVisible("name"),
                    columnVisibility.isVisible("code"),
                    columnVisibility.isVisible("displayName"),
                    columnVisibility.isVisible("allowedSpecialists"),
                    true,
                  ].filter(Boolean).length;

                  const renderProductRow = (product: Product) => (
                    <React.Fragment key={product.id}>
                    <TableRow data-testid={`row-product-${product.id}`} onRowClick={() => handleEdit(product)}>
                      {columnVisibility.isVisible("partnerId") && <TableCell className="text-sm">{getPartnerName(product.partnerId)}</TableCell>}
                      {columnVisibility.isVisible("name") && (
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            {product.name}
                            {product.versionLabel && (
                              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0" data-testid={`badge-version-${product.id}`}>
                                <GitBranch className="w-2.5 h-2.5 mr-0.5" />
                                {product.versionLabel}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {columnVisibility.isVisible("code") && <TableCell className="text-sm">{product.code}</TableCell>}
                      {columnVisibility.isVisible("displayName") && <TableCell className="text-sm">{product.displayName || "-"}</TableCell>}
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
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedVersionHistory(prev => {
                                    const next = new Set(prev);
                                    if (next.has(product.id)) next.delete(product.id);
                                    else next.add(product.id);
                                    return next;
                                  });
                                }}
                                data-testid={`button-version-history-${product.id}`}
                              >
                                {expandedVersionHistory.has(product.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>História verzií</TooltipContent>
                          </Tooltip>
                          <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); setDetailProduct(product); }} data-testid={`button-view-product-${product.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {canDeleteRecords(appUser) && (product as any).contractsCount === 0 && (
                            <ConditionalDelete canDelete={true} onClick={() => handleDelete(product)} testId={`button-delete-product-${product.id}`} />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    <ProductVersionHistoryRow
                      productId={product.id}
                      colSpanCount={colSpanCount}
                      onEditVersion={handleEdit}
                      expanded={expandedVersionHistory.has(product.id)}
                    />
                    </React.Fragment>  
                  );
                  if (groupedProducts) {
                    return groupedProducts.flatMap(group => [
                      <TableRow key={`div-${group.division?.id ?? "none"}`} className="pointer-events-none">
                        <TableCell colSpan={7} className="py-1.5 px-4 bg-muted/40 border-y">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            {group.division?.emoji ? `${group.division.emoji} ` : ""}{group.division?.name ?? "Bez divízie"}
                          </span>
                        </TableCell>
                      </TableRow>,
                      ...group.rows.map(renderProductRow),
                    ]);
                  }
                  return sortedProducts.map(renderProductRow);
                })()}
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
