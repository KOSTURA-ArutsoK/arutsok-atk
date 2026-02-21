import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateSlovak } from "@/lib/utils";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useLocation } from "wouter";
import type { Contract, ContractStatus, ContractTemplate, ContractInventory, Subject, Partner, Product, MyCompany, Sector, Section, SectorProduct, ClientGroup, ClientType, AppUser, ContractAcquirer } from "@shared/schema";
import { Plus, Pencil, Trash2, Eye, FileText, Loader2, Lock, LayoutGrid, Send, Upload, Inbox, CheckCircle2, ChevronDown, ChevronRight, Printer, Search, Archive, AlertTriangle, Calendar, XCircle, MessageSquare, Paperclip, X, Users, Check, Award, Percent, History } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityTimeline } from "@/components/activity-timeline";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelectCheckboxes } from "@/components/multi-select-checkboxes";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogScrollContent,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpIcon } from "@/components/help-icon";
import { Label } from "@/components/ui/label";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";

const CONTRACTS_COLUMNS: ColumnDef[] = [
  { key: "contractNumber", label: "Cislo zmluvy" },
  { key: "proposalNumber", label: "Cislo navrhu" },
  { key: "globalNumber", label: "Poradove cislo" },
  { key: "subjectId", label: "Klient" },
  { key: "partnerId", label: "Partner" },
  { key: "productId", label: "Produkt" },
  { key: "status", label: "Stav" },
  { key: "inventoryId", label: "Sprievodka" },
  { key: "annualPremium", label: "Rocne poistne" },
  { key: "signedDate", label: "Vytvorenie zmluvy" },
  { key: "premiumAmount", label: "Lehotne poistne" },
];

const CONTRACTS_EVIDENCIA_COLUMNS: ColumnDef[] = [
  { key: "contractNumber", label: "Cislo zmluvy" },
  { key: "proposalNumber", label: "Cislo navrhu" },
  { key: "globalNumber", label: "Poradove cislo" },
  { key: "subjectId", label: "Klient" },
  { key: "partnerId", label: "Partner" },
  { key: "productId", label: "Produkt" },
  { key: "status", label: "Stav" },
  { key: "annualPremium", label: "Rocne poistne" },
  { key: "signedDate", label: "Vytvorenie zmluvy" },
  { key: "premiumAmount", label: "Lehotne poistne" },
];

const CONTRACTS_SPRIEVODKA_COLUMNS: ColumnDef[] = [
  { key: "contractNumber", label: "Cislo zmluvy" },
  { key: "proposalNumber", label: "Cislo navrhu" },
  { key: "subjectId", label: "Klient" },
  { key: "partnerId", label: "Partner" },
  { key: "productId", label: "Produkt" },
  { key: "annualPremium", label: "Rocne poistne" },
  { key: "signedDate", label: "Vytvorenie zmluvy" },
  { key: "premiumAmount", label: "Lehotne poistne" },
];

const MAIN_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "contractNumber", label: "Cislo zmluvy", type: "text" },
  { key: "proposalNumber", label: "Cislo navrhu", type: "text" },
  { key: "globalNumber", label: "Poradove cislo", type: "number" },
  { key: "subjectId", label: "Klient", type: "number" },
  { key: "partnerId", label: "Partner", type: "number" },
  { key: "productId", label: "Produkt", type: "number" },
  { key: "inventoryId", label: "Sprievodka", type: "number" },
  { key: "annualPremium", label: "Rocne poistne", type: "number" },
  { key: "signedDate", label: "Vytvorenie zmluvy", type: "date" },
  { key: "premiumAmount", label: "Lehotne poistne", type: "number" },
];

const EVIDENCIA_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "contractNumber", label: "Cislo zmluvy", type: "text" },
  { key: "proposalNumber", label: "Cislo navrhu", type: "text" },
  { key: "globalNumber", label: "Poradove cislo", type: "number" },
  { key: "subjectId", label: "Klient", type: "number" },
  { key: "partnerId", label: "Partner", type: "number" },
  { key: "productId", label: "Produkt", type: "number" },
  { key: "annualPremium", label: "Rocne poistne", type: "number" },
  { key: "signedDate", label: "Vytvorenie zmluvy", type: "date" },
  { key: "premiumAmount", label: "Lehotne poistne", type: "number" },
];

const SPRIEVODKA_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "contractNumber", label: "Cislo zmluvy", type: "text" },
  { key: "proposalNumber", label: "Cislo navrhu", type: "text" },
  { key: "subjectId", label: "Klient", type: "number" },
  { key: "partnerId", label: "Partner", type: "number" },
  { key: "productId", label: "Produkt", type: "number" },
  { key: "annualPremium", label: "Rocne poistne", type: "number" },
  { key: "signedDate", label: "Vytvorenie zmluvy", type: "date" },
  { key: "premiumAmount", label: "Lehotne poistne", type: "number" },
];

function InlineSortOrderEdit({ contractId, currentOrder }: { contractId: number; currentOrder: number | null }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(currentOrder || ""));
  const { toast } = useToast();

  const renumberMutation = useMutation({
    mutationFn: async (newSortOrder: number) => {
      const res = await apiRequest("PATCH", `/api/contracts/${contractId}/renumber`, { newSortOrder });
      return res;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
      toast({
        title: "Poradie aktualizované",
        description: data.shifted > 0 ? `Posunutých ${data.shifted} zmlúv` : undefined,
      });
      setEditing(false);
    },
    onError: () => toast({ title: "Chyba pri zmene poradia", variant: "destructive" }),
  });

  if (!editing) {
    return (
      <span
        className="cursor-pointer hover:text-primary hover:underline"
        onClick={(e) => { e.stopPropagation(); setEditing(true); setValue(String(currentOrder || "")); }}
        title="Klikni pre zmenu poradia"
        data-testid={`sort-order-${contractId}`}
      >
        {currentOrder || "-"}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
      <Input
        type="number"
        min={1}
        value={value}
        onChange={e => setValue(e.target.value)}
        className="h-6 w-14 text-xs text-center"
        autoFocus
        onKeyDown={e => {
          if (e.key === "Enter") {
            const n = parseInt(value);
            if (n > 0) renumberMutation.mutate(n);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        data-testid={`input-sort-order-${contractId}`}
      />
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={() => {
          const n = parseInt(value);
          if (n > 0) renumberMutation.mutate(n);
        }}
        disabled={renumberMutation.isPending}
        data-testid={`btn-confirm-sort-${contractId}`}
      >
        <Check className="w-3 h-3" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-6 w-6 p-0"
        onClick={() => setEditing(false)}
        data-testid={`btn-cancel-sort-${contractId}`}
      >
        <X className="w-3 h-3" />
      </Button>
    </div>
  );
}

function formatProcessingTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const formatDate = formatDateSlovak;

function formatAmount(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null) return "-";
  return `${amount} ${currency || "EUR"}`;
}

function ContractFormDialog({
  open,
  onOpenChange,
  editingContract,
  activeStateId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingContract: Contract | null;
  activeStateId: number | null;
}) {
  const { toast } = useToast();
  const { data: allStates } = useStates();
  const timerRef = useRef<number>(0);

  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });
  const { data: partners } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
  });
  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });
  const { data: companies } = useQuery<MyCompany[]>({
    queryKey: ["/api/my-companies"],
  });
  const { data: statuses } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
  });
  const { data: templates } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contract-templates"],
  });
  const { data: inventories } = useQuery<ContractInventory[]>({
    queryKey: ["/api/contract-inventories"],
  });
  const { data: clientGroups } = useQuery<ClientGroup[]>({
    queryKey: ["/api/client-groups"],
  });
  const { data: allSPForEdit } = useQuery<SectorProduct[]>({
    queryKey: ["/api/sector-products"],
  });
  const { data: allSectionsForEdit } = useQuery<Section[]>({
    queryKey: ["/api/sections"],
    queryFn: async () => {
      const res = await fetch("/api/sections", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: appUsersAll } = useQuery<AppUser[]>({
    queryKey: ["/api/app-users"],
  });
  const { data: existingAcquirers } = useQuery<ContractAcquirer[]>({
    queryKey: ["/api/contracts", editingContract?.id, "acquirers"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${editingContract!.id}/acquirers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingContract?.id,
  });

  const { data: existingRewardDistributions } = useQuery<any[]>({
    queryKey: ["/api/contracts", editingContract?.id, "reward-distributions"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${editingContract!.id}/reward-distributions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!editingContract?.id,
  });

  const [acquirerUserIds, setAcquirerUserIds] = useState<number[]>([]);
  const [acquirerSearch, setAcquirerSearch] = useState("");

  const [specialistUid, setSpecialistUid] = useState("");
  const [specialistPercentage, setSpecialistPercentage] = useState("");
  const [recommenders, setRecommenders] = useState<{ uid: string; percentage: string }[]>([]);
  const [rewardSearchSpecialist, setRewardSearchSpecialist] = useState("");
  const [rewardSearchRecommender, setRewardSearchRecommender] = useState("");
  const [addingRecommender, setAddingRecommender] = useState(false);
  const [newRecommenderUid, setNewRecommenderUid] = useState("");
  const [newRecommenderPercentage, setNewRecommenderPercentage] = useState("");

  const rewardTotalPercentage = useMemo(() => {
    const specPct = parseFloat(specialistPercentage) || 0;
    const recPct = recommenders.reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0);
    return specPct + recPct;
  }, [specialistPercentage, recommenders]);

  const rewardPercentageRemaining = useMemo(() => {
    return Math.max(0, 100 - rewardTotalPercentage);
  }, [rewardTotalPercentage]);

  const [clientGroupId, setClientGroupId] = useState<string>("");
  const [identifierType, setIdentifierType] = useState<string>("");
  const [identifierValue, setIdentifierValue] = useState<string>("");
  const [identifierWarning, setIdentifierWarning] = useState<string | null>(null);
  const [contractSectorId, setContractSectorId] = useState<string>("");
  const [contractSectionId, setContractSectionId] = useState<string>("");
  const [contractNumber, setContractNumber] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [partnerId, setPartnerId] = useState<string>("");
  const [sectorProductId, setSectorProductIdRaw] = useState<string>("");
  const [panelValues, setPanelValues] = useState<Record<string, string>>({});
  const setSectorProductId = useCallback((val: string) => {
    setSectorProductIdRaw(val);
    setPanelValues({});
  }, []);

  const setContractSectorIdCascade = useCallback((val: string) => {
    setContractSectorId(val);
    setContractSectionId("");
    setSectorProductId("");
  }, [setSectorProductId]);

  const setContractSectionIdCascade = useCallback((val: string) => {
    setContractSectionId(val);
    setSectorProductId("");
  }, [setSectorProductId]);

  const { data: contractSectors } = useQuery<Sector[]>({ queryKey: ["/api/sectors"] });
  const { data: contractSections } = useQuery<Section[]>({
    queryKey: ["/api/sections", { sectorId: contractSectorId }],
    queryFn: async () => {
      const res = await fetch(`/api/sections?sectorId=${contractSectorId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!contractSectorId,
  });
  const { data: contractSectorProducts } = useQuery<SectorProduct[]>({
    queryKey: ["/api/sector-products", { sectionId: contractSectionId }],
    queryFn: async () => {
      const res = await fetch(`/api/sector-products?sectionId=${contractSectionId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!contractSectionId,
  });
  const [statusId, setStatusId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [inventoryId, setInventoryId] = useState<string>("");
  const [stateId, setStateId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [signedDate, setSignedDate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [notes, setNotes] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  type PanelWithParams = {
    id: number;
    name: string;
    description: string;
    parameters: Array<{
      id: number;
      name: string;
      paramType: string;
      helpText: string;
      options: string[];
      isRequired: boolean;
      defaultValue: string;
    }>;
  };

  const { data: productPanels, isLoading: panelsLoading } = useQuery<PanelWithParams[]>({
    queryKey: ["/api/sector-products", sectorProductId, "panels-with-parameters"],
    queryFn: async () => {
      const res = await fetch(`/api/sector-products/${sectorProductId}/panels-with-parameters`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!sectorProductId,
  });

  const saveAcquirersForContract = async (contractId: number) => {
    for (const userId of acquirerUserIds) {
      try {
        await apiRequest("POST", `/api/contracts/${contractId}/acquirers`, { userId });
      } catch {}
    }
  };

  const syncAcquirersForContract = async (contractId: number) => {
    const existing = existingAcquirers || [];
    const toRemove = existing.filter(a => !acquirerUserIds.includes(a.userId));
    const existingUserIds = existing.map(a => a.userId);
    const toAdd = acquirerUserIds.filter(uid => !existingUserIds.includes(uid));
    for (const acq of toRemove) {
      try {
        await apiRequest("DELETE", `/api/contract-acquirers/${acq.id}`);
      } catch {}
    }
    for (const userId of toAdd) {
      try {
        await apiRequest("POST", `/api/contracts/${contractId}/acquirers`, { userId });
      } catch {}
    }
  };

  const saveRewardDistributions = async (contractId: number) => {
    const distributions: { type: string; uid: string; percentage: string; sortOrder: number }[] = [];
    if (specialistUid) {
      distributions.push({ type: "specialist", uid: specialistUid, percentage: specialistPercentage || "0", sortOrder: 0 });
      if (recommenders.length === 0) {
        distributions.push({ type: "recommender", uid: specialistUid, percentage: "0", sortOrder: 1 });
      }
    }
    recommenders.forEach((r, i) => {
      distributions.push({ type: "recommender", uid: r.uid, percentage: r.percentage || "0", sortOrder: i + 1 });
    });
    try {
      await apiRequest("POST", `/api/contracts/${contractId}/reward-distributions`, { distributions });
    } catch {}
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contracts", data),
    onSuccess: async (res: any) => {
      const created = await res.json?.() ?? res;
      if (acquirerUserIds.length > 0 && created?.id) {
        await saveAcquirersForContract(created.id);
      }
      if (created?.id) {
        await saveRewardDistributions(created.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Uspech", description: "Zmluva vytvorena" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit zmluvu", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contracts/${editingContract?.id}`, data),
    onSuccess: async () => {
      if (editingContract?.id) {
        await syncAcquirersForContract(editingContract.id);
        await saveRewardDistributions(editingContract.id);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Uspech", description: "Zmluva aktualizovana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat zmluvu", variant: "destructive" }),
  });

  useEffect(() => {
    if (open) {
      timerRef.current = performance.now();
      if (editingContract) {
        setContractNumber(editingContract.contractNumber || "");
        setSubjectId(editingContract.subjectId?.toString() || "");
        setPartnerId(editingContract.partnerId?.toString() || "");
        const spId = editingContract.sectorProductId;
        setSectorProductIdRaw(spId?.toString() || "");
        setPanelValues(editingContract.dynamicPanelValues || {});
        setStatusId(editingContract.statusId?.toString() || "");
        setTemplateId(editingContract.templateId?.toString() || "");
        setInventoryId(editingContract.inventoryId?.toString() || "");
        setStateId(editingContract.stateId?.toString() || "");
        setCompanyId(editingContract.companyId?.toString() || "");
        setSignedDate(editingContract.signedDate ? new Date(editingContract.signedDate).toISOString().split("T")[0] : "");
        setEffectiveDate(editingContract.effectiveDate ? new Date(editingContract.effectiveDate).toISOString().split("T")[0] : "");
        setExpiryDate(editingContract.expiryDate ? new Date(editingContract.expiryDate).toISOString().split("T")[0] : "");
        setPremiumAmount(editingContract.premiumAmount?.toString() || "");
        setCommissionAmount(editingContract.commissionAmount?.toString() || "");
        setCurrency(editingContract.currency || "EUR");
        setNotes(editingContract.notes || "");
        setClientGroupId((editingContract as any).clientGroupId?.toString() || "");
        setIdentifierType((editingContract as any).identifierType || "");
        setIdentifierValue((editingContract as any).identifierValue || "");
        setIdentifierWarning(null);
        setAcquirerUserIds([]);
        setAcquirerSearch("");
        setSpecialistUid("");
        setSpecialistPercentage("");
        setRecommenders([]);
        setRewardSearchSpecialist("");
        setRewardSearchRecommender("");
        setAddingRecommender(false);
        setNewRecommenderUid("");
        setNewRecommenderPercentage("");
        if (spId && allSPForEdit && allSectionsForEdit) {
          const sp = allSPForEdit.find(p => p.id === spId);
          if (sp) {
            const sec = allSectionsForEdit.find(s => s.id === sp.sectionId);
            if (sec) {
              setContractSectorId(sec.sectorId.toString());
              setContractSectionId(sec.id.toString());
            }
          }
        } else {
          setContractSectorId("");
          setContractSectionId("");
        }
      } else {
        setContractNumber("");
        setSubjectId("");
        setPartnerId("");
        setSectorProductId("");
        setPanelValues({});
        setStatusId("");
        setTemplateId("");
        setInventoryId("");
        setStateId(activeStateId?.toString() || "");
        setCompanyId("");
        setSignedDate("");
        setEffectiveDate("");
        setExpiryDate("");
        setPremiumAmount("");
        setCommissionAmount("");
        setCurrency("EUR");
        setNotes("");
        setClientGroupId("");
        setIdentifierType("");
        setIdentifierValue("");
        setIdentifierWarning(null);
        setContractSectorId("");
        setContractSectionId("");
        setAcquirerUserIds([]);
        setAcquirerSearch("");
        setSpecialistUid("");
        setSpecialistPercentage("");
        setRecommenders([]);
        setRewardSearchSpecialist("");
        setRewardSearchRecommender("");
        setAddingRecommender(false);
        setNewRecommenderUid("");
        setNewRecommenderPercentage("");
      }
    }
  }, [open, editingContract, activeStateId, allSPForEdit, allSectionsForEdit]);

  useEffect(() => {
    if (existingAcquirers && editingContract) {
      setAcquirerUserIds(existingAcquirers.map(a => a.userId));
    }
  }, [existingAcquirers, editingContract]);

  useEffect(() => {
    if (existingRewardDistributions && editingContract) {
      const spec = existingRewardDistributions.find((d: any) => d.type === "specialist");
      if (spec) {
        setSpecialistUid(spec.uid || "");
        setSpecialistPercentage(spec.percentage || "");
      }
      const recs = existingRewardDistributions
        .filter((d: any) => d.type === "recommender")
        .sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0))
        .map((d: any) => ({ uid: d.uid || "", percentage: d.percentage || "" }));
      setRecommenders(recs);
    }
  }, [existingRewardDistributions, editingContract]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!contractNumber) {
      toast({ title: "Chyba", description: "Cislo zmluvy je povinne", variant: "destructive" });
      return;
    }
    if (rewardTotalPercentage > 100) {
      toast({ title: "Chyba", description: "Sucet odmien presiahol 100%. Upravte hodnoty pred ulozenim.", variant: "destructive" });
      return;
    }
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    if (!clientGroupId) {
      toast({ title: "Chyba", description: "Typ osoby je povinny", variant: "destructive" });
      return;
    }
    const payload = {
      contractNumber,
      clientGroupId: clientGroupId ? parseInt(clientGroupId) : null,
      identifierType: identifierType || null,
      identifierValue: identifierValue || null,
      subjectId: subjectId ? parseInt(subjectId) : null,
      partnerId: partnerId ? parseInt(partnerId) : null,
      productId: null,
      sectorProductId: sectorProductId ? parseInt(sectorProductId) : null,
      statusId: statusId ? parseInt(statusId) : null,
      templateId: templateId ? parseInt(templateId) : null,
      inventoryId: inventoryId ? parseInt(inventoryId) : null,
      stateId: stateId ? parseInt(stateId) : null,
      companyId: companyId ? parseInt(companyId) : null,
      signedDate: signedDate ? new Date(signedDate).toISOString() : null,
      effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : null,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
      premiumAmount: premiumAmount ? parseInt(premiumAmount) : null,
      commissionAmount: commissionAmount ? parseInt(commissionAmount) : null,
      currency,
      notes: notes || null,
      processingTimeSec,
      dynamicPanelValues: Object.keys(panelValues).length > 0 ? panelValues : undefined,
    };

    if (editingContract) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="xl">
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} className="flex flex-col flex-1 min-h-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle data-testid="text-contract-dialog-title">
            {editingContract ? "Upravit zmluvu" : "Pridat zmluvu"}
          </DialogTitle>
          <div className="flex items-center gap-2 text-amber-500 text-sm mt-1" style={{ display: editingContract?.isLocked ? 'flex' : 'none' }}>
            <Lock className="w-4 h-4" />
            <span>Zmluva je zamknuta v supiske. Iba admin moze upravovat.</span>
          </div>
        </DialogHeader>
        <DialogScrollContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Typ osoby *</label>
              <Select value={clientGroupId} onValueChange={setClientGroupId}>
                <SelectTrigger data-testid="select-contract-client-group">
                  <SelectValue placeholder="Vyberte typ osoby" />
                </SelectTrigger>
                <SelectContent>
                  {clientGroups?.map(g => (
                    <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Zakladny identifikator</label>
              <div className="flex gap-2">
                <Select value={identifierType} onValueChange={(val) => { setIdentifierType(val); setIdentifierValue(""); setIdentifierWarning(null); }}>
                  <SelectTrigger className="w-[160px]" data-testid="select-identifier-type">
                    <SelectValue placeholder="Typ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ico">ICO</SelectItem>
                    <SelectItem value="rodne_cislo">Rodne cislo</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={identifierValue}
                  onChange={e => {
                    const val = e.target.value;
                    setIdentifierValue(val);
                    setIdentifierWarning(null);
                    const cleanVal = val.replace(/[^0-9]/g, "");
                    if (identifierType === "rodne_cislo" && (cleanVal.length === 9 || cleanVal.length === 10)) {
                      setTimeout(async () => {
                        if (!activeStateId) return;
                        try {
                          const res = await fetch(`/api/subjects/check-identifier?type=rodne_cislo&value=${encodeURIComponent(cleanVal)}&stateId=${activeStateId}`, { credentials: "include" });
                          const data = await res.json();
                          if (data.exists) {
                            setIdentifierWarning(`Osoba s tymto rodnym cislom uz existuje v zozname klientov: ${data.subjectName} (${data.subjectUid})`);
                          }
                          const contractNumberInput = document.querySelector('[data-testid="input-contract-number"]') as HTMLInputElement;
                          if (contractNumberInput) contractNumberInput.focus();
                        } catch {}
                      }, 100);
                    }
                  }}
                  onBlur={async () => {
                    if (!identifierValue.trim() || !identifierType || !activeStateId) return;
                    try {
                      const res = await fetch(`/api/subjects/check-identifier?type=${identifierType}&value=${encodeURIComponent(identifierValue.trim())}&stateId=${activeStateId}`, { credentials: "include" });
                      const data = await res.json();
                      if (data.exists) {
                        setIdentifierWarning(`Osoba s tymto ${identifierType === "ico" ? "ICO" : "rodnym cislom"} uz existuje v zozname klientov: ${data.subjectName} (${data.subjectUid})`);
                      }
                    } catch {}
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const contractNumberInput = document.querySelector('[data-testid="input-contract-number"]') as HTMLInputElement;
                      if (contractNumberInput) contractNumberInput.focus();
                    }
                  }}
                  placeholder={identifierType === "ico" ? "Zadajte ICO" : identifierType === "rodne_cislo" ? "Zadajte rodne cislo" : "Najprv vyberte typ"}
                  disabled={!identifierType}
                  data-testid="input-identifier-value"
                />
              </div>
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 mt-1" data-testid="text-identifier-warning" style={{ display: identifierWarning ? 'flex' : 'none' }}>
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">{identifierWarning}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cislo zmluvy *</label>
              <Input
                value={contractNumber}
                onChange={e => { setContractNumber(e.target.value); setDuplicateWarning(null); }}
                onBlur={async () => {
                  if (!contractNumber.trim() || editingContract) return;
                  try {
                    const res = await fetch(`/api/contracts/check-duplicate?contractNumber=${encodeURIComponent(contractNumber.trim())}`, { credentials: "include" });
                    const data = await res.json();
                    if (data.exists) {
                      setDuplicateWarning(data.subjectName ? `Zmluva s tymto cislom uz existuje pre klienta ${data.subjectName}` : "Zmluva s tymto cislom uz existuje");
                    }
                  } catch {}
                }}
                data-testid="input-contract-number"
              />
              <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 mt-1" data-testid="text-duplicate-warning" style={{ display: duplicateWarning ? 'flex' : 'none' }}>
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-400">{duplicateWarning}</p>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Klient</label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger data-testid="select-contract-subject">
                  <SelectValue placeholder="Vyberte klienta" />
                </SelectTrigger>
                <SelectContent>
                  {subjects?.filter(s => s.isActive).map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.type === "person" ? `${s.firstName} ${s.lastName}` : s.companyName} ({s.uid})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Partner</label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger data-testid="select-contract-partner">
                  <SelectValue placeholder="Vyberte partnera" />
                </SelectTrigger>
                <SelectContent>
                  {partners?.filter(p => !p.isDeleted).map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 border rounded-md p-4" data-testid="section-reward-distributions">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Získatelia</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={rewardTotalPercentage > 100 ? "destructive" : rewardTotalPercentage === 100 ? "default" : "outline"} className="text-[10px] font-mono">
                  {rewardTotalPercentage}% / 100%
                </Badge>
                <span className="text-[10px] text-muted-foreground" style={{ visibility: rewardPercentageRemaining > 0 && rewardTotalPercentage <= 100 ? 'visible' : 'hidden' }}>
                  Zostava: {rewardPercentageRemaining}%
                </span>
              </div>
            </div>

            <p className="text-xs text-destructive font-medium" style={{ visibility: rewardTotalPercentage > 100 ? 'visible' : 'hidden' }}>
              Sucet percent presiahol 100%. Upravte hodnoty.
            </p>

            <div className="space-y-3">
              <div className="border rounded-md p-3 space-y-2" data-testid="panel-specialist-reward">
                <div className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-semibold uppercase tracking-wide">Specialista</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">UID specialistu</label>
                    <div className="relative">
                      <Input
                        placeholder="Zadajte UID alebo hladajte..."
                        value={specialistUid}
                        onChange={e => {
                          setSpecialistUid(e.target.value);
                          setRewardSearchSpecialist(e.target.value);
                        }}
                        className="font-mono text-sm"
                        data-testid="input-specialist-uid"
                      />
                      {(() => {
                        const searchLower = rewardSearchSpecialist.toLowerCase().trim();
                        const filtered = searchLower && searchLower.length >= 2
                          ? (appUsersAll || []).filter(u =>
                              (`${u.firstName || ""} ${u.lastName || ""} ${u.username || ""} ${u.uid || ""}`.toLowerCase().includes(searchLower))
                            )
                          : [];
                        return (
                          <div className="absolute top-full left-0 right-0 z-50 border rounded-md bg-popover max-h-[120px] overflow-y-auto" style={{ display: filtered.length > 0 ? 'block' : 'none' }} data-testid="list-specialist-suggestions">
                            {filtered.slice(0, 8).map(u => (
                              <div
                                key={u.id}
                                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover-elevate text-sm"
                                onClick={() => {
                                  setSpecialistUid(u.uid || "");
                                  setRewardSearchSpecialist("");
                                }}
                                data-testid={`row-specialist-suggestion-${u.id}`}
                              >
                                <span className="font-medium text-xs">{u.firstName || ""} {u.lastName || ""}</span>
                                <span className="text-xs text-muted-foreground font-mono ml-auto">{u.uid || ""}</span>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Podiel (%)</label>
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="0"
                        value={specialistPercentage}
                        onChange={e => setSpecialistPercentage(e.target.value)}
                        className="pr-8 font-mono text-sm"
                        data-testid="input-specialist-percentage"
                      />
                      <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Ak nie su zadani odporucitelia, specialista bude automaticky pridany ako odporucitel s 0%.
                </p>
              </div>

              <div className="border rounded-md p-3 space-y-2" data-testid="panel-recommenders-reward">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Odporucitelia</span>
                    <Badge variant="outline" className="text-[10px]">{recommenders.length}</Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAddingRecommender(true);
                      setNewRecommenderUid("");
                      setNewRecommenderPercentage("");
                      setRewardSearchRecommender("");
                    }}
                    data-testid="button-add-recommender"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Pridat odporucitela
                  </Button>
                </div>

                <div className="border rounded-md p-2 space-y-2" style={{ display: addingRecommender ? 'block' : 'none' }} data-testid="panel-add-recommender">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">UID odporucitela</label>
                      <div className="relative">
                        <Input
                          placeholder="Zadajte UID alebo hladajte..."
                          value={newRecommenderUid}
                          onChange={e => {
                            setNewRecommenderUid(e.target.value);
                            setRewardSearchRecommender(e.target.value);
                          }}
                          className="font-mono text-sm"
                          data-testid="input-new-recommender-uid"
                        />
                        {(() => {
                          const searchLower = rewardSearchRecommender.toLowerCase().trim();
                          const filtered = searchLower && searchLower.length >= 2
                            ? (appUsersAll || []).filter(u =>
                                (`${u.firstName || ""} ${u.lastName || ""} ${u.username || ""} ${u.uid || ""}`.toLowerCase().includes(searchLower))
                              )
                            : [];
                          return (
                            <div className="absolute top-full left-0 right-0 z-50 border rounded-md bg-popover max-h-[120px] overflow-y-auto" style={{ display: filtered.length > 0 ? 'block' : 'none' }} data-testid="list-recommender-suggestions">
                              {filtered.slice(0, 8).map(u => (
                                <div
                                  key={u.id}
                                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover-elevate text-sm"
                                  onClick={() => {
                                    setNewRecommenderUid(u.uid || "");
                                    setRewardSearchRecommender("");
                                  }}
                                  data-testid={`row-recommender-suggestion-${u.id}`}
                                >
                                  <span className="font-medium text-xs">{u.firstName || ""} {u.lastName || ""}</span>
                                  <span className="text-xs text-muted-foreground font-mono ml-auto">{u.uid || ""}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Podiel (%)</label>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0"
                          value={newRecommenderPercentage}
                          onChange={e => setNewRecommenderPercentage(e.target.value)}
                          className="pr-8 font-mono text-sm"
                          data-testid="input-new-recommender-percentage"
                        />
                        <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddingRecommender(false)}
                      data-testid="button-cancel-recommender"
                    >
                      Zrusit
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (!newRecommenderUid.trim()) {
                          toast({ title: "Chyba", description: "Zadajte UID odporucitela", variant: "destructive" });
                          return;
                        }
                        const newTotal = rewardTotalPercentage + (parseFloat(newRecommenderPercentage) || 0);
                        if (newTotal > 100) {
                          toast({ title: "Chyba", description: `Sucet percent by presahoval 100% (${newTotal.toFixed(2)}%)`, variant: "destructive" });
                          return;
                        }
                        setRecommenders(prev => [...prev, { uid: newRecommenderUid.trim(), percentage: newRecommenderPercentage || "0" }]);
                        setNewRecommenderUid("");
                        setNewRecommenderPercentage("");
                        setRewardSearchRecommender("");
                        setAddingRecommender(false);
                      }}
                      data-testid="button-confirm-recommender"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Potvrdit
                    </Button>
                  </div>
                </div>

                <div className="space-y-1" data-testid="list-recommenders">
                  {recommenders.map((rec, idx) => {
                    const user = (appUsersAll || []).find(u => u.uid === rec.uid);
                    return (
                      <div key={`${rec.uid}-${idx}`} className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-muted/30" data-testid={`row-recommender-${idx}`}>
                        <Users className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span className="text-sm font-medium">{user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username : rec.uid}</span>
                        <span className="text-xs text-muted-foreground font-mono">{rec.uid}</span>
                        <div className="flex items-center gap-1 ml-auto">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={rec.percentage}
                            onChange={e => {
                              const val = e.target.value;
                              setRecommenders(prev => prev.map((r, i) => i === idx ? { ...r, percentage: val } : r));
                            }}
                            className="w-20 h-7 text-xs font-mono text-right"
                            data-testid={`input-recommender-percentage-${idx}`}
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRecommenders(prev => prev.filter((_, i) => i !== idx))}
                          data-testid={`button-remove-recommender-${idx}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  <div style={{ display: recommenders.length === 0 && specialistUid ? 'block' : 'none' }}>
                    <div className="flex items-center gap-2 px-3 py-1.5 border rounded-md bg-muted/20 border-dashed" data-testid="row-autofill-recommender">
                      <Users className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground italic">
                        {(() => {
                          const user = (appUsersAll || []).find(u => u.uid === specialistUid);
                          return user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username : specialistUid;
                        })()}
                      </span>
                      <span className="text-xs text-muted-foreground font-mono">{specialistUid}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">0% (auto)</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Specialista bude automaticky pridany ako odporucitel s 0% pri ulozeni.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground" style={{ display: recommenders.length === 0 && !specialistUid ? 'block' : 'none' }}>
                    Ziadni odporucitelia. Zadajte specialistu alebo pridajte odporucitelov manualne.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sektor</label>
              <Select value={contractSectorId} onValueChange={setContractSectorIdCascade}>
                <SelectTrigger data-testid="select-contract-sector">
                  <SelectValue placeholder="Vyberte sektor" />
                </SelectTrigger>
                <SelectContent>
                  {contractSectors?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sekcia</label>
              <Select value={contractSectionId} onValueChange={setContractSectionIdCascade} disabled={!contractSectorId}>
                <SelectTrigger data-testid="select-contract-section">
                  <SelectValue placeholder="Vyberte sekciu" />
                </SelectTrigger>
                <SelectContent>
                  {contractSections?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Produkt</label>
              <Select value={sectorProductId} onValueChange={setSectorProductId} disabled={!contractSectionId}>
                <SelectTrigger data-testid="select-contract-product">
                  <SelectValue placeholder="Vyberte produkt" />
                </SelectTrigger>
                <SelectContent>
                  {contractSectorProducts?.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name} {p.abbreviation ? `(${p.abbreviation})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 border rounded-md p-4" data-testid="section-contract-panels" style={{ display: sectorProductId && productPanels && productPanels.length > 0 ? 'block' : 'none' }}>
              <div className="flex items-center gap-2 mb-2">
                <LayoutGrid className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Parametre produktu</span>
              </div>
              {productPanels.map(panel => (
                <Card key={panel.id} className="p-3" data-testid={`panel-section-${panel.id}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold">{panel.name}</span>
                    <span className="text-xs text-muted-foreground" style={{ display: panel.description ? 'inline' : 'none' }}>({panel.description})</span>
                  </div>
                  {panel.parameters.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {panel.parameters.map(param => (
                        <div key={param.id} className="space-y-1">
                          <label className="text-xs font-medium">
                            {param.name}
                            <span className="text-destructive ml-1" style={{ display: param.isRequired ? 'inline' : 'none' }}>*</span>
                          </label>
                          {param.paramType === "textarea" ? (
                            <Textarea
                              value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                              onChange={e => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: e.target.value }))}
                              rows={2}
                              data-testid={`input-panel-param-${panel.id}-${param.id}`}
                            />
                          ) : param.paramType === "boolean" ? (
                            <Select
                              value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                              onValueChange={val => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: val }))}
                            >
                              <SelectTrigger data-testid={`select-panel-param-${panel.id}-${param.id}`}>
                                <SelectValue placeholder="Vyberte" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ano">Ano</SelectItem>
                                <SelectItem value="nie">Nie</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (param.paramType === "combobox" || param.paramType === "jedna_moznost") && param.options?.length > 0 ? (
                            <Select
                              value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                              onValueChange={val => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: val }))}
                            >
                              <SelectTrigger data-testid={`select-panel-param-${panel.id}-${param.id}`}>
                                <SelectValue placeholder="Vyberte" />
                              </SelectTrigger>
                              <SelectContent>
                                {param.options.map(opt => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : param.paramType === "viac_moznosti" && param.options?.length > 0 ? (
                            <MultiSelectCheckboxes
                              paramId={`${panel.id}_${param.id}`}
                              options={param.options || []}
                              value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                              onChange={(val) => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: val }))}
                            />
                          ) : param.paramType === "decimal" ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                                onChange={e => {
                                  const raw = e.target.value.replace(/,/g, ".");
                                  const dp = (param as any).decimalPlaces ?? 2;
                                  const regex = dp > 0 ? new RegExp(`^\\d*\\.?\\d{0,${dp}}$`) : /^\d*$/;
                                  if (raw === "" || raw === "." || regex.test(raw)) {
                                    setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: raw }));
                                  }
                                }}
                                data-testid={`input-panel-param-${panel.id}-${param.id}`}
                                className="flex-1"
                              />
                              <span style={{ display: (param as any).unit ? 'inline' : 'none' }} className="text-sm text-muted-foreground font-medium whitespace-nowrap">{(param as any).unit}</span>
                            </div>
                          ) : (
                            <Input
                              type={param.paramType === "number" || param.paramType === "currency" || param.paramType === "percent" ? "number" : param.paramType === "date" ? "date" : param.paramType === "datetime" ? "datetime-local" : param.paramType === "email" ? "email" : param.paramType === "url" ? "url" : "text"}
                              value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                              onChange={e => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: e.target.value }))}
                              data-testid={`input-panel-param-${panel.id}-${param.id}`}
                            />
                          )}
                          <p className="text-xs text-muted-foreground" style={{ display: param.helpText ? 'block' : 'none' }}>{param.helpText}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Ziadne parametre</p>
                  )}
                </Card>
              ))}
            </div>
          <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground" style={{ display: sectorProductId && panelsLoading ? 'flex' : 'none' }}>
            <Loader2 className="w-4 h-4 animate-spin" />
            Nacitavam panely...
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Stav zmluvy</label>
              <Select value={statusId} onValueChange={setStatusId}>
                <SelectTrigger data-testid="select-contract-status">
                  <SelectValue placeholder="Vyberte stav" />
                </SelectTrigger>
                <SelectContent>
                  {statuses?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                        {s.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Sablona</label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger data-testid="select-contract-template">
                  <SelectValue placeholder="Vyberte sablonu" />
                </SelectTrigger>
                <SelectContent>
                  {templates?.filter(t => t.isActive).map(t => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Supiska</label>
              <Select value={inventoryId} onValueChange={setInventoryId}>
                <SelectTrigger data-testid="select-contract-inventory">
                  <SelectValue placeholder="Vyberte supisku" />
                </SelectTrigger>
                <SelectContent>
                  {inventories?.filter(i => !i.isClosed).map(i => (
                    <SelectItem key={i.id} value={i.id.toString()}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Stat</label>
              <Select value={stateId} onValueChange={setStateId}>
                <SelectTrigger data-testid="select-contract-state">
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
              <label className="text-sm font-medium">Spolocnost</label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger data-testid="select-contract-company">
                  <SelectValue placeholder="Vyberte spolocnost" />
                </SelectTrigger>
                <SelectContent>
                  {companies?.filter(c => !c.isDeleted).map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Datum podpisu</label>
              <Input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)} data-testid="input-contract-signed-date" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Datum ucinnosti</label>
              <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} data-testid="input-contract-effective-date" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Datum expiracie</label>
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} data-testid="input-contract-expiry-date" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Suma poistneho</label>
              <Input type="number" value={premiumAmount} onChange={e => setPremiumAmount(e.target.value)} className="font-mono" data-testid="input-contract-premium" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Suma provizie</label>
              <Input type="number" value={commissionAmount} onChange={e => setCommissionAmount(e.target.value)} className="font-mono" data-testid="input-contract-commission" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mena</label>
              <Input value={currency} onChange={e => setCurrency(e.target.value)} data-testid="input-contract-currency" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Poznamky</label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} data-testid="input-contract-notes" />
          </div>

          <div className="flex items-center justify-end mt-6">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} data-testid="button-contract-cancel">
              Zrusit
            </Button>
          </div>
        </div>
        </DialogScrollContent>
        <div className="px-6 pb-6 pt-2">
          <ProcessingSaveButton isPending={isPending} />
        </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ContractDetailDialog({
  contract,
  open,
  onClose,
  subjects,
  partners,
  sectorProducts,
  statuses,
  templates,
  inventories,
  companies,
  states,
}: {
  contract: Contract | null;
  open: boolean;
  onClose: () => void;
  subjects: Subject[];
  partners: Partner[];
  sectorProducts: SectorProduct[];
  statuses: ContractStatus[];
  templates: ContractTemplate[];
  inventories: ContractInventory[];
  companies: MyCompany[];
  states: { id: number; name: string; code: string }[];
}) {
  const subjectName = subjects?.find(s => s.id === contract?.subjectId);
  const partnerName = partners?.find(p => p.id === contract?.partnerId)?.name || "-";
  const sectorProduct = sectorProducts?.find(p => p.id === contract?.sectorProductId);
  const status = statuses?.find(s => s.id === contract?.statusId);
  const templateName = templates?.find(t => t.id === contract?.templateId)?.name || "-";
  const inventoryName = inventories?.find(i => i.id === contract?.inventoryId)?.name || "-";
  const companyName = companies?.find(c => c.id === contract?.companyId)?.name || "-";
  const stateName = states?.find(s => s.id === contract?.stateId)?.name || "-";

  if (!contract) {
    return (
      <Dialog open={false} onOpenChange={onClose}>
        <DialogContent size="xl">
          <DialogHeader className="px-6 pt-6 pb-2"><DialogTitle>-</DialogTitle></DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent size="xl">
        <DialogHeader className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle data-testid="text-contract-detail-title">Zmluva {contract.contractNumber || contract.uid}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium"
                  style={{ borderColor: status?.color, color: status?.color, backgroundColor: status ? `${status.color}15` : 'transparent', display: status ? 'inline-flex' : 'none' }}
                  data-testid="badge-detail-status"
                >
                  {status?.name}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogScrollContent>
        <Tabs defaultValue="detail" className="mt-2">
          <TabsList data-testid="tabs-contract-detail">
            <TabsTrigger value="detail" data-testid="tab-contract-detail">
              <FileText className="w-3.5 h-3.5 mr-1" /> Detail
            </TabsTrigger>
            <TabsTrigger value="historia" data-testid="tab-contract-historia">
              <History className="w-3.5 h-3.5 mr-1" /> História
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detail" className="mt-3">
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Cislo zmluvy</span>
                  <p className="text-sm" data-testid="text-detail-contract-number">{contract.contractNumber || "-"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Klient</span>
                  <p className="text-sm" data-testid="text-detail-subject">
                    {subjectName ? (subjectName.type === "person" ? `${subjectName.firstName} ${subjectName.lastName}` : subjectName.companyName) : "-"}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Partner</span>
                  <p className="text-sm" data-testid="text-detail-partner">{partnerName}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Produkt</span>
                  <p className="text-sm" data-testid="text-detail-product">{sectorProduct ? `${sectorProduct.name}${sectorProduct.abbreviation ? ` (${sectorProduct.abbreviation})` : ''}` : "-"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Sablona</span>
                  <p className="text-sm" data-testid="text-detail-template">{templateName}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Supiska</span>
                  <p className="text-sm" data-testid="text-detail-inventory">{inventoryName}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Spolocnost</span>
                  <p className="text-sm" data-testid="text-detail-company">{companyName}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Stat</span>
                  <p className="text-sm" data-testid="text-detail-state">{stateName}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Mena</span>
                  <p className="text-sm" data-testid="text-detail-currency">{contract.currency || "EUR"}</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Datum podpisu</span>
                  <p className="text-sm" data-testid="text-detail-signed-date">{formatDate(contract.signedDate)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Datum ucinnosti</span>
                  <p className="text-sm" data-testid="text-detail-effective-date">{formatDate(contract.effectiveDate)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Datum expiracie</span>
                  <p className="text-sm" data-testid="text-detail-expiry-date">{formatDate(contract.expiryDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Suma poistneho</span>
                  <p className="text-sm font-mono" data-testid="text-detail-premium">{formatAmount(contract.premiumAmount, contract.currency)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Suma provizie</span>
                  <p className="text-sm font-mono" data-testid="text-detail-commission">{formatAmount(contract.commissionAmount, contract.currency)}</p>
                </div>
              </div>

              <div style={{ display: contract.notes ? 'block' : 'none' }}>
                <span className="text-xs text-muted-foreground">Poznamky</span>
                <p className="text-sm mt-1" data-testid="text-detail-notes">{contract.notes}</p>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                <span>Cas spracovania: {formatProcessingTime(contract.processingTimeSec || 0)}</span>
                <span>Vytvorene: {formatDateSlovak(contract.createdAt)}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="historia" className="mt-3">
            <ActivityTimeline subjectId={contract.subjectId || undefined} contractId={contract.id} />
          </TabsContent>
        </Tabs>
        </DialogScrollContent>
      </DialogContent>
    </Dialog>
  );
}

function DeleteContractDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: Contract | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/contracts/${contract?.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Uspech", description: "Zmluva vymazana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat zmluvu", variant: "destructive" }),
  });

  return (
    <Dialog open={open && !!contract} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle data-testid="text-delete-dialog-title">Vymazat zmluvu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground" data-testid="text-delete-confirmation">
            Naozaj chcete vymazat zmluvu <span className="font-semibold text-foreground">{contract?.contractNumber}</span>? Tuto akciu nie je mozne vratit.
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

export default function Contracts() {
  const { data: appUser } = useAppUser();
  const activeStateId = appUser?.activeStateId ?? null;
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const isEvidencia = location === "/evidencia-zmluv";

  const columnVisibility = useColumnVisibility("contracts", CONTRACTS_COLUMNS);
  const evidenciaColumnVisibility = useColumnVisibility("contracts-evidencia", CONTRACTS_EVIDENCIA_COLUMNS);
  const sprievodkaColumnVisibility = useColumnVisibility("contracts-sprievodka", CONTRACTS_SPRIEVODKA_COLUMNS);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContract, setDeletingContract] = useState<Contract | null>(null);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  const [filterStatusId, setFilterStatusId] = useState<string>("all");
  const [filterStatusIds, setFilterStatusIds] = useState<number[]>([]);
  const [filterInventoryId, setFilterInventoryId] = useState<string>("all");

  useEffect(() => {
    const search = window.location.search;
    if (!search) {
      setFilterStatusIds([]);
      return;
    }
    const params = new URLSearchParams(search);
    const singleId = params.get("statusId");
    const multiIds = params.get("statusIds");
    if (multiIds) {
      const ids = multiIds.split(",").map(Number).filter(n => !isNaN(n));
      setFilterStatusIds(ids);
      setFilterStatusId("all");
    } else if (singleId) {
      setFilterStatusId(singleId);
      setFilterStatusIds([]);
    } else {
      setFilterStatusIds([]);
    }
  }, [location]);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sprievodkaDialogOpen, setSprievodkaDialogOpen] = useState(false);

  const [acceptedSprievodkaIds, setAcceptedSprievodkaIds] = useState<Record<number, Set<number>>>({});
  const [expandedSprievodky, setExpandedSprievodky] = useState<Set<number>>(new Set());
  const [activeFolder, setActiveFolder] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [duplicateModal, setDuplicateModal] = useState<{ open: boolean; subjectName?: string }>({ open: false });
  const [preSelectOpen, setPreSelectOpen] = useState(false);
  const [preSelectStep, setPreSelectStep] = useState<1 | 2>(1);
  const [preSelectPartnerId, setPreSelectPartnerId] = useState<string>("");
  const [preSelectProductId, setPreSelectProductId] = useState<string>("");
  const [preSelectSubjectSearch, setPreSelectSubjectSearch] = useState("");
  const [preSelectSubjectId, setPreSelectSubjectId] = useState<string>("");
  const [preSelectClientTypeId, setPreSelectClientTypeId] = useState<string>("");
  const [clientTypeSelectOpen, setClientTypeSelectOpen] = useState(false);
  const refProductTrigger = useRef<HTMLButtonElement>(null);
  const refStep1Next = useRef<HTMLButtonElement>(null);
  const refSearchInput = useRef<HTMLInputElement>(null);
  const refStep2Confirm = useRef<HTMLButtonElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ total: number; success: number; errors: number; created?: number; updated?: number; warnings?: number; duplicityWarnings?: any[]; details: any[] } | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const { data: statuses } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
  });

  const { data: inventories } = useQuery<ContractInventory[]>({
    queryKey: ["/api/contract-inventories"],
  });

  const { data: allClientTypes } = useQuery<ClientType[]>({ queryKey: ["/api/client-types"] });
  const activeClientTypes = (allClientTypes || []).filter(ct => ct.isActive).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const contractsParams = (() => {
    if (isEvidencia) {
      return { unprocessed: "true" } as Record<string, string>;
    }
    const p: Record<string, string> = {};
    if (filterStatusId && filterStatusId !== "all") p.statusId = filterStatusId;
    if (filterInventoryId && filterInventoryId !== "all") p.inventoryId = filterInventoryId;
    return p;
  })();

  const contractsQueryKey = ["/api/contracts", contractsParams];

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: contractsQueryKey,
    queryFn: async () => {
      const qs = new URLSearchParams(contractsParams).toString();
      const res = await fetch(`/api/contracts${qs ? `?${qs}` : ""}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: dispatchedContracts, isLoading: isLoadingDispatched } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/dispatched"],
    enabled: isEvidencia,
  });

  const { data: acceptedContracts, isLoading: isLoadingAccepted } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/accepted"],
    enabled: isEvidencia,
  });

  const { data: archivedContracts, isLoading: isLoadingArchived } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/archived"],
    enabled: isEvidencia,
  });

  const { data: rejectedContracts, isLoading: isLoadingRejected } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/rejected"],
    enabled: isEvidencia,
  });

  const { data: subjects } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: partners } = useQuery<Partner[]>({ queryKey: ["/api/partners"] });
  const { data: products } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: allSectorProducts } = useQuery<SectorProduct[]>({ queryKey: ["/api/sector-products"] });
  const { data: companies } = useQuery<MyCompany[]>({ queryKey: ["/api/my-companies"] });
  const { data: templates } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contract-templates"],
  });
  const { data: allStates } = useStates();

  const allContractIds = [
    ...(contracts?.map(c => c.id) || []),
    ...(dispatchedContracts?.map(c => c.id) || []),
    ...(acceptedContracts?.map(c => c.id) || []),
    ...(archivedContracts?.map(c => c.id) || []),
    ...(rejectedContracts?.map(c => c.id) || []),
  ];

  const { data: statusChangeMeta } = useQuery<Record<number, { hasNote: boolean; hasDocs: boolean }>>({
    queryKey: ["/api/contracts/status-change-meta", allContractIds.join(",")],
    queryFn: async () => {
      if (allContractIds.length === 0) return {};
      const res = await fetch("/api/contracts/status-change-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractIds: allContractIds }),
        credentials: "include",
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: allContractIds.length > 0,
  });

  const nahratadoSystemuStatusId = statuses?.find(s => s.name === "Nahrata do systemu" || s.name === "Nahratá do systému")?.id;
  const activeContracts = contracts?.filter(c => {
    if (c.isDeleted) return false;
    if (!isEvidencia && nahratadoSystemuStatusId && c.statusId === nahratadoSystemuStatusId) return false;
    if (filterStatusIds.length > 0 && c.statusId && !filterStatusIds.includes(c.statusId)) return false;
    return true;
  }) || [];
  const activeDispatched = dispatchedContracts?.filter(c => !c.isDeleted) || [];

  const dispatchedBySprievodka = (() => {
    const groups: Record<number, { inventory: ContractInventory | undefined; contracts: Contract[] }> = {};
    for (const c of activeDispatched) {
      if (!c.inventoryId) continue;
      if (!groups[c.inventoryId]) {
        groups[c.inventoryId] = {
          inventory: inventories?.find(i => i.id === c.inventoryId),
          contracts: [],
        };
      }
      groups[c.inventoryId].contracts.push(c);
    }
    return Object.entries(groups).map(([key, val]) => ({
      inventoryId: Number(key),
      inventory: val.inventory,
      contracts: val.contracts,
    }));
  })();

  function invalidateContractCaches() {
    queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/dispatched"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/accepted"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/rejected"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/archived"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
  }

  const dispatchMutation = useMutation({
    mutationFn: async ({ name, contractIds }: { name: string; contractIds: number[] }) => {
      const inventoryRes = await apiRequest("POST", "/api/contract-inventories", {
        name,
        stateId: activeStateId,
        sortOrder: 0,
        isClosed: false,
      });
      const inventoryData = await inventoryRes.json();
      try {
        await apiRequest("POST", `/api/contract-inventories/${inventoryData.id}/dispatch`, { contractIds });
      } catch (dispatchErr) {
        try { await apiRequest("DELETE", `/api/contract-inventories/${inventoryData.id}`); } catch {}
        throw dispatchErr;
      }
      return inventoryData;
    },
    onSuccess: () => {
      invalidateContractCaches();
      toast({ title: "Uspech", description: "Zmluvy odoslane na schvalenie" });
      setSelectedIds([]);
      setSprievodkaDialogOpen(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa odoslat zmluvy", variant: "destructive" }),
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ inventoryId, contractIds }: { inventoryId: number; contractIds: number[] }) => {
      await apiRequest("POST", `/api/contract-inventories/${inventoryId}/accept`, { contractIds });
    },
    onSuccess: () => {
      invalidateContractCaches();
      toast({ title: "Uspech", description: "Zmluvy schvalene a prijate do systemu" });
      setAcceptedSprievodkaIds({});
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa schvalit zmluvy", variant: "destructive" }),
  });

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  }

  function toggleSelectAll() {
    if (selectedIds.length === activeContracts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(activeContracts.map(c => c.id));
    }
  }

  function toggleAcceptContract(inventoryId: number, contractId: number) {
    setAcceptedSprievodkaIds(prev => {
      const set = new Set(prev[inventoryId] || []);
      if (set.has(contractId)) set.delete(contractId);
      else set.add(contractId);
      return { ...prev, [inventoryId]: set };
    });
  }

  function toggleAcceptAll(inventoryId: number, contractsInGroup: Contract[]) {
    setAcceptedSprievodkaIds(prev => {
      const current = prev[inventoryId] || new Set();
      if (current.size === contractsInGroup.length) {
        return { ...prev, [inventoryId]: new Set() };
      }
      return { ...prev, [inventoryId]: new Set(contractsInGroup.map(c => c.id)) };
    });
  }

  function toggleSprievodkaExpanded(id: number) {
    setExpandedSprievodky(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDispatch() {
    const autoName = `Sprievodka ${new Date().toISOString().slice(0, 10)}`;
    dispatchMutation.mutate({
      name: autoName,
      contractIds: selectedIds,
    });
  }

  function handleAccept(inventoryId: number) {
    const ids = acceptedSprievodkaIds[inventoryId];
    if (!ids || ids.size === 0) {
      toast({ title: "Chyba", description: "Vyberte zmluvy na schvalenie", variant: "destructive" });
      return;
    }
    acceptMutation.mutate({ inventoryId, contractIds: Array.from(ids) });
  }

  function getSubjectDisplay(subjectId: number | null) {
    if (!subjectId) return "-";
    const s = subjects?.find(sub => sub.id === subjectId);
    if (!s) return "-";
    return s.type === "person" ? `${s.firstName} ${s.lastName}` : s.type === "szco" ? `${s.companyName || ""} - ${s.firstName} ${s.lastName}` : (s.companyName || "-");
  }

  async function handleExcelImport() {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const res = await fetch("/api/contracts/import-excel", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: "Chyba", description: data.message || "Chyba pri importe", variant: "destructive" });
        setImportLoading(false);
        return;
      }
      setImportResult(data);
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({
        title: "Import dokonceny",
        description: `Uspesne: ${data.success} z ${data.total}`,
      });
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message || "Neznama chyba", variant: "destructive" });
    }
    setImportLoading(false);
  }

  function openEdit(contract: Contract) {
    navigate(`/contracts/${contract.id}/edit`);
  }

  function openDelete(contract: Contract) {
    setDeletingContract(contract);
    setDeleteDialogOpen(true);
  }

  function openView(contract: Contract) {
    setViewingContract(contract);
  }

  function getProductName(contract: Contract) {
    const spMatch = allSectorProducts?.find(p => p.id === contract.sectorProductId);
    return spMatch ? `${spMatch.name}${spMatch.abbreviation ? ` (${spMatch.abbreviation})` : ''}` : "-";
  }

  function getPartnerName(contract: Contract) {
    return partners?.find(p => p.id === contract.partnerId)?.name || "-";
  }

  const isDispatching = dispatchMutation.isPending;
  const isAccepting = acceptMutation.isPending;

  const activeAccepted = acceptedContracts?.filter(c => !c.isDeleted) || [];
  const activeArchived = archivedContracts?.filter(c => !c.isDeleted) || [];
  const activeRejected = rejectedContracts?.filter(c => !c.isDeleted) || [];

  const folderDefs = [
    { id: 1, label: "Čakajúce na odoslanie", icon: Inbox, color: "text-amber-500", bgColor: "bg-amber-500/15", count: activeContracts.length },
    { id: 2, label: "Odoslané na sprievodke", icon: Send, color: "text-blue-500", bgColor: "bg-blue-500/15", count: activeDispatched.length },
    { id: 3, label: "Neprijaté zmluvy – výhrady", icon: CheckCircle2, color: "text-red-500", bgColor: "bg-red-500/15", count: activeRejected.length },
    { id: 4, label: "Archív zmlúv", icon: Archive, color: "text-muted-foreground", bgColor: "bg-muted/30", count: activeArchived.length },
  ];

  function filterBySearch(list: Contract[]) {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(c =>
      (c.contractNumber || "").toLowerCase().includes(q) ||
      (c.globalNumber ? String(c.globalNumber) : "").includes(q) ||
      getSubjectDisplay(c.subjectId).toLowerCase().includes(q) ||
      getPartnerName(c).toLowerCase().includes(q) ||
      getProductName(c).toLowerCase().includes(q)
    );
  }

  function renderContractTable(list: Contract[], options?: { showCheckbox?: boolean; showOrder?: boolean; showStatus?: boolean; showRegistration?: boolean; showActions?: boolean; sortState?: { sortKey: string | null; sortDirection: "asc" | "desc" | null; requestSort: (key: string) => void } }) {
    const { showCheckbox, showOrder, showStatus, showRegistration, showActions = true, sortState } = options || {};
    const sk = sortState?.sortKey ?? null;
    const sd = sortState?.sortDirection ?? null;
    const rs = sortState?.requestSort;
    return (
      <div className="relative overflow-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
      <Table stickyHeader>
        <TableHeader>
          <TableRow>
            {showCheckbox && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedIds.length === list.length && list.length > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </TableHead>
            )}
            {showOrder && <TableHead className="w-[40px] text-center">#</TableHead>}
            {evidenciaColumnVisibility.isVisible("contractNumber") && <TableHead sortKey="contractNumber" sortDirection={sk === "contractNumber" ? sd : null} onSort={rs}>Cislo zmluvy</TableHead>}
            {evidenciaColumnVisibility.isVisible("proposalNumber") && <TableHead sortKey="proposalNumber" sortDirection={sk === "proposalNumber" ? sd : null} onSort={rs}>Cislo navrhu</TableHead>}
            {showRegistration && evidenciaColumnVisibility.isVisible("globalNumber") && <TableHead sortKey="globalNumber" sortDirection={sk === "globalNumber" ? sd : null} onSort={rs}>Poradove cislo</TableHead>}
            {evidenciaColumnVisibility.isVisible("subjectId") && <TableHead sortKey="subjectId" sortDirection={sk === "subjectId" ? sd : null} onSort={rs}>Klient</TableHead>}
            {evidenciaColumnVisibility.isVisible("partnerId") && <TableHead sortKey="partnerId" sortDirection={sk === "partnerId" ? sd : null} onSort={rs}>Partner</TableHead>}
            {evidenciaColumnVisibility.isVisible("productId") && <TableHead sortKey="productId" sortDirection={sk === "productId" ? sd : null} onSort={rs}>Produkt</TableHead>}
            {showStatus && evidenciaColumnVisibility.isVisible("status") && <TableHead>Stav</TableHead>}
            {evidenciaColumnVisibility.isVisible("annualPremium") && <TableHead sortKey="annualPremium" sortDirection={sk === "annualPremium" ? sd : null} onSort={rs}>Rocne poistne</TableHead>}
            {evidenciaColumnVisibility.isVisible("signedDate") && <TableHead sortKey="signedDate" sortDirection={sk === "signedDate" ? sd : null} onSort={rs}>Vytvorenie zmluvy</TableHead>}
            {evidenciaColumnVisibility.isVisible("premiumAmount") && <TableHead sortKey="premiumAmount" sortDirection={sk === "premiumAmount" ? sd : null} onSort={rs}>Lehotne poistne</TableHead>}
            {showActions && <TableHead className="text-right">Akcie</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map(contract => {
            const status = statuses?.find(s => s.id === contract.statusId);
            return (
              <TableRow key={contract.id} data-testid={`row-evidencia-${contract.id}`} onRowClick={() => openEdit(contract)}>
                {showCheckbox && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(contract.id)}
                      onCheckedChange={() => toggleSelect(contract.id)}
                      data-testid={`checkbox-contract-${contract.id}`}
                    />
                  </TableCell>
                )}
                {showOrder && (
                  <TableCell className="text-center text-xs text-muted-foreground" data-testid={`text-selection-order-${contract.id}`}>
                    {selectedIds.includes(contract.id) ? selectedIds.indexOf(contract.id) + 1 : ""}
                  </TableCell>
                )}
                {evidenciaColumnVisibility.isVisible("contractNumber") && <TableCell className="font-mono text-sm" data-testid={`text-contract-number-${contract.id}`}>
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-500 shrink-0" style={{ display: contract.isLocked ? 'block' : 'none' }} />
                    {contract.contractNumber || "-"}
                  </span>
                </TableCell>}
                {evidenciaColumnVisibility.isVisible("proposalNumber") && <TableCell className="text-sm font-mono" data-testid={`text-contract-proposal-${contract.id}`}>{contract.proposalNumber || "-"}</TableCell>}
                {showRegistration && evidenciaColumnVisibility.isVisible("globalNumber") && (
                  <TableCell className="font-mono text-sm" data-testid={`text-contract-registration-${contract.id}`}>
                    {contract.globalNumber ? (
                      <span className="font-semibold">{contract.globalNumber}</span>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">V procese</Badge>
                    )}
                  </TableCell>
                )}
                {evidenciaColumnVisibility.isVisible("subjectId") && <TableCell className="text-sm">{getSubjectDisplay(contract.subjectId)}</TableCell>}
                {evidenciaColumnVisibility.isVisible("partnerId") && <TableCell className="text-sm">{getPartnerName(contract)}</TableCell>}
                {evidenciaColumnVisibility.isVisible("productId") && <TableCell className="text-sm">{getProductName(contract)}</TableCell>}
                {showStatus && evidenciaColumnVisibility.isVisible("status") && (
                  <TableCell data-testid={`text-contract-status-${contract.id}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {status ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium leading-snug"
                          style={{ borderColor: status.color, color: status.color, backgroundColor: `${status.color}15`, whiteSpace: 'normal', wordBreak: 'break-word' }}
                        >{status.name}</span>
                      ) : "-"}
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0" data-testid={`icon-note-${contract.id}`} style={{ display: statusChangeMeta?.[contract.id]?.hasNote ? 'block' : 'none' }} />
                      <Paperclip className="w-3.5 h-3.5 text-amber-400 shrink-0" data-testid={`icon-docs-${contract.id}`} style={{ display: statusChangeMeta?.[contract.id]?.hasDocs ? 'block' : 'none' }} />
                    </div>
                  </TableCell>
                )}
                {evidenciaColumnVisibility.isVisible("annualPremium") && <TableCell className="text-sm font-mono">{formatAmount(contract.annualPremium, contract.currency)}</TableCell>}
                {evidenciaColumnVisibility.isVisible("signedDate") && <TableCell className="text-sm">{formatDate(contract.signedDate)}</TableCell>}
                {evidenciaColumnVisibility.isVisible("premiumAmount") && <TableCell className="text-sm font-mono">{formatAmount(contract.premiumAmount, contract.currency)}</TableCell>}
                {showActions && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <Button size="icon" variant="ghost" onClick={() => openView(contract)} data-testid={`button-view-contract-${contract.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(contract)} data-testid={`button-edit-contract-${contract.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => openDelete(contract)} data-testid={`button-delete-contract-${contract.id}`}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      </div>
    );
  }

  const importDialog = (
    <Dialog open={importDialogOpen} onOpenChange={(open) => {
      setImportDialogOpen(open);
      if (!open) { setImportFile(null); setImportResult(null); }
    }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle data-testid="text-import-title">Hromadný import zmlúv</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Nahrajte Excel (.xlsx) alebo CSV súbor s údajmi o zmluvách a klientoch. Systém automaticky:
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              <li>Podľa RČ/IČO nájde existujúceho klienta a aktualizuje ho, alebo vytvorí nového</li>
              <li>Namapuje dáta do 30 kategórií klienta podľa nastavených pravidiel</li>
              <li>Skontroluje duplicitné ŠPZ a VIN naprieč klientmi</li>
              <li>Zmluvy bez dátumu storna nechá na manuálne posúdenie</li>
            </ul>
            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              data-testid="input-import-file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setImportFile(f); setImportResult(null); }
              }}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => importFileRef.current?.click()} data-testid="button-choose-file">
                <Upload className="w-4 h-4 mr-1" />
                Vybrať súbor
              </Button>
              <span className="text-sm text-muted-foreground truncate max-w-[250px]" data-testid="text-selected-file">
                {importFile ? importFile.name : "Žiadny súbor"}
              </span>
            </div>
          </div>
          {importResult && (
            <div className="space-y-3 p-3 rounded-md border">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="text-center">
                  <p className="text-xl font-bold text-green-500" data-testid="text-import-success">{importResult.success}</p>
                  <p className="text-[10px] text-muted-foreground">Úspešných</p>
                </div>
                {(importResult.created || 0) > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-blue-500" data-testid="text-import-created">{importResult.created}</p>
                    <p className="text-[10px] text-muted-foreground">Nových klientov</p>
                  </div>
                )}
                {(importResult.updated || 0) > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-amber-500" data-testid="text-import-updated">{importResult.updated}</p>
                    <p className="text-[10px] text-muted-foreground">Aktualizovaných</p>
                  </div>
                )}
                {importResult.errors > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-destructive" data-testid="text-import-errors">{importResult.errors}</p>
                    <p className="text-[10px] text-muted-foreground">Chýb</p>
                  </div>
                )}
                {(importResult.warnings || 0) > 0 && (
                  <div className="text-center">
                    <p className="text-xl font-bold text-yellow-500" data-testid="text-import-warnings">{importResult.warnings}</p>
                    <p className="text-[10px] text-muted-foreground">Varovaní</p>
                  </div>
                )}
              </div>

              {importResult.duplicityWarnings && importResult.duplicityWarnings.length > 0 && (
                <div className="border border-yellow-500/30 rounded p-2 bg-yellow-500/5">
                  <p className="text-xs font-medium text-yellow-600 mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Potenciálne konflikty majetku ({importResult.duplicityWarnings.length})
                  </p>
                  <div className="max-h-[100px] overflow-y-auto text-xs space-y-0.5">
                    {importResult.duplicityWarnings.map((dw: any, i: number) => (
                      <p key={i} className="text-yellow-700">
                        Riadok {dw.row}: {dw.field} {dw.value} — UID {dw.existingUid} ↔ {dw.newUid}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {importResult.errors > 0 && (
                <div className="border border-destructive/30 rounded p-2 bg-destructive/5">
                  <p className="text-xs font-medium text-destructive mb-1">Chyby:</p>
                  <div className="max-h-[100px] overflow-y-auto text-xs space-y-0.5">
                    {importResult.details?.filter((d: any) => d.error).map((d: any, i: number) => (
                      <p key={i} className="text-destructive">Riadok {d.row}: {d.error}</p>
                    ))}
                  </div>
                </div>
              )}

              {importResult.details?.some((d: any) => d.warnings?.length > 0) && (
                <div className="border border-amber-500/30 rounded p-2 bg-amber-500/5">
                  <p className="text-xs font-medium text-amber-600 mb-1">Varovania:</p>
                  <div className="max-h-[100px] overflow-y-auto text-xs space-y-0.5">
                    {importResult.details.filter((d: any) => d.warnings?.length > 0).map((d: any, i: number) => (
                      <div key={i}>
                        {d.warnings.map((w: string, wi: number) => (
                          <p key={wi} className="text-amber-600">Riadok {d.row}: {w}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-import-cancel">
              Zavrieť
            </Button>
            <Button onClick={handleExcelImport} disabled={!importFile || importLoading} data-testid="button-import-submit">
              {importLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Importovať
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const preSelectFilteredProducts = (() => {
    if (!products) return [];
    if (!preSelectPartnerId) return products.filter(p => !p.isDeleted);
    return products.filter(p => !p.isDeleted && p.partnerId === parseInt(preSelectPartnerId));
  })();

  const handlePreSelectStep1Next = () => {
    setPreSelectStep(2);
    setPreSelectSubjectSearch("");
    setPreSelectSubjectId("");
  };

  useEffect(() => {
    if (preSelectStep === 2 && !preSelectClientTypeId) {
      const t = setTimeout(() => setClientTypeSelectOpen(true), 150);
      return () => clearTimeout(t);
    }
  }, [preSelectStep, preSelectClientTypeId]);

  const handlePreSelectStep2Back = () => {
    setPreSelectStep(1);
    setPreSelectSubjectSearch("");
    setPreSelectSubjectId("");
    setPreSelectClientTypeId("");
    setClientTypeSelectOpen(false);
  };

  const handlePreSelectConfirm = () => {
    if (!preSelectSubjectId) {
      const selectedCt = activeClientTypes.find(ct => ct.id.toString() === preSelectClientTypeId);
      const ctCode = selectedCt?.code || "";
      const searchVal = preSelectSubjectSearch.trim();
      const navParams = new URLSearchParams();
      navParams.set("addNew", "true");
      if (ctCode) navParams.set("clientType", ctCode);
      if (searchVal) navParams.set("baseValue", searchVal);
      setPreSelectOpen(false);
      setPreSelectStep(1);
      setPreSelectPartnerId("");
      setPreSelectProductId("");
      setPreSelectSubjectSearch("");
      setPreSelectSubjectId("");
      setPreSelectClientTypeId("");
      navigate(`/subjects?${navParams.toString()}`);
      return;
    }
    const params = new URLSearchParams();
    if (preSelectPartnerId) params.set("partnerId", preSelectPartnerId);
    if (preSelectProductId) params.set("productId", preSelectProductId);
    params.set("subjectId", preSelectSubjectId);
    const qs = params.toString();
    navigate(`/contracts/new${qs ? `?${qs}` : ""}`);
    setPreSelectOpen(false);
    setPreSelectStep(1);
    setPreSelectPartnerId("");
    setPreSelectProductId("");
    setPreSelectSubjectSearch("");
    setPreSelectSubjectId("");
    setPreSelectClientTypeId("");
  };

  const handleOpenPreSelect = () => {
    setPreSelectStep(1);
    setPreSelectPartnerId("");
    setPreSelectProductId("");
    setPreSelectSubjectSearch("");
    setPreSelectSubjectId("");
    setPreSelectClientTypeId("");
    setPreSelectOpen(true);
  };

  const preSelectFilteredSubjects = (() => {
    if (!subjects) return [];
    const active = subjects;
    if (!preSelectSubjectSearch.trim()) return active;
    const q = preSelectSubjectSearch.toLowerCase().trim();
    return active.filter(s => {
      const fullName = s.type === "company"
        ? (s.companyName || "")
        : s.type === "szco"
        ? `${s.companyName || ""} ${s.firstName || ""} ${s.lastName || ""}`.trim()
        : `${s.firstName || ""} ${s.lastName || ""}`.trim();
      const birthNum = s.birthNumber || "";
      const ico = (s.details as any)?.ico || "";
      return fullName.toLowerCase().includes(q) || birthNum.includes(q) || ico.includes(q) || (s.uid || "").toLowerCase().includes(q);
    });
  })();

  const preSelectDialog = (
    <Dialog open={preSelectOpen} onOpenChange={(open) => { setPreSelectOpen(open); if (!open) { setPreSelectStep(1); setPreSelectClientTypeId(""); } }}>
      <DialogContent size="xl" onCloseAutoFocus={(e) => e.preventDefault()} data-testid="dialog-pre-select-contract">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle data-testid="text-preselect-title">
            {preSelectStep === 1 ? "Krok 1: Vyber partnera a produktu" : "Krok 2: Vyber klienta (subjektu)"}
          </DialogTitle>
        </DialogHeader>

        <DialogScrollContent>
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${preSelectStep === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} data-testid="step-indicator-1">1</div>
          <div className="flex-1 h-px bg-border" />
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${preSelectStep === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} data-testid="step-indicator-2">2</div>
        </div>

        <div style={{ display: preSelectStep === 1 ? 'block' : 'none' }}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vyberte partnera a produkt pre predvyplnenie zmluvy.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium">Partner</label>
              <Select value={preSelectPartnerId} onValueChange={(v) => { setPreSelectPartnerId(v); setPreSelectProductId(""); setTimeout(() => refProductTrigger.current?.focus(), 50); }}>
                <SelectTrigger data-testid="select-preselect-partner">
                  <SelectValue placeholder="Vyberte partnera" />
                </SelectTrigger>
                <SelectContent>
                  {partners?.filter(p => !p.isDeleted).map(p => (
                    <SelectItem key={p.id} value={p.id.toString()} data-testid={`option-preselect-partner-${p.id}`}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Produkt z katalogu</label>
              <Select value={preSelectProductId} onValueChange={(v) => { setPreSelectProductId(v); setTimeout(() => refStep1Next.current?.focus(), 50); }} disabled={!preSelectPartnerId}>
                <SelectTrigger ref={refProductTrigger} data-testid="select-preselect-product">
                  <SelectValue placeholder={preSelectPartnerId ? "Vyberte produkt (volitelne)" : "Najprv vyberte partnera"} />
                </SelectTrigger>
                <SelectContent>
                  {preSelectFilteredProducts.map(p => (
                    <SelectItem key={p.id} value={p.id.toString()} data-testid={`option-preselect-product-${p.id}`}>
                      {p.name} {p.code ? `(${p.code})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button ref={refStep1Next} onClick={handlePreSelectStep1Next} disabled={!preSelectPartnerId} data-testid="button-preselect-next">
                Dalej
              </Button>
            </div>
          </div>
        </div>

        <div style={{ display: preSelectStep === 2 ? 'block' : 'none' }}>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Najprv vyberte typ klienta, potom vyhladajte podla rodneho cisla, ICO alebo mena.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-medium">Typ klienta</label>
              <Select open={clientTypeSelectOpen} onOpenChange={setClientTypeSelectOpen} value={preSelectClientTypeId} onValueChange={(v) => { setPreSelectClientTypeId(v); setClientTypeSelectOpen(false); setPreSelectSubjectSearch(""); setPreSelectSubjectId(""); setTimeout(() => refSearchInput.current?.focus(), 50); }}>
                <SelectTrigger data-testid="select-preselect-client-type">
                  <SelectValue placeholder="Vyberte typ klienta" />
                </SelectTrigger>
                <SelectContent>
                  {activeClientTypes.map(ct => (
                    <SelectItem key={ct.id} value={ct.id.toString()} data-testid={`option-preselect-client-type-${ct.id}`}>
                      {ct.code} - {ct.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div style={{ display: preSelectClientTypeId ? 'block' : 'none' }}>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Vyhladavanie</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      ref={refSearchInput}
                      placeholder="Rodne cislo / ICO / Meno..."
                      value={preSelectSubjectSearch}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPreSelectSubjectSearch(val);
                        const digitsOnly = val.replace(/[^0-9]/g, "");
                        if (digitsOnly.length >= 10) {
                          setTimeout(() => refStep2Confirm.current?.focus(), 100);
                        }
                      }}
                      className="pl-9"
                      data-testid="input-preselect-subject-search"
                    />
                  </div>
                </div>

                <div className="border rounded-md max-h-[300px] overflow-y-auto" data-testid="list-preselect-subjects">
                  <div style={{ display: preSelectFilteredSubjects.length === 0 ? 'block' : 'none' }} className="p-4 text-center text-sm text-muted-foreground" data-testid="text-no-subjects">
                    {preSelectSubjectSearch.trim() ? "Ziadny klient nenajdeny" : "Zadajte hladany vyraz"}
                  </div>
                  <div style={{ display: preSelectFilteredSubjects.length > 0 ? 'block' : 'none' }}>
                    {preSelectFilteredSubjects.map(s => {
                      const displayName = s.type === "company"
                        ? (s.companyName || "Bez nazvu")
                        : s.type === "szco"
                        ? `${s.companyName || ""} - ${s.firstName || ""} ${s.lastName || ""}`.trim()
                        : `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Bez mena";
                      const typeLabel = s.type === "person" ? "FO" : s.type === "company" ? "PO" : s.type === "szco" ? "SZČO" : s.type;
                      const identifier = s.type === "company" ? ((s as any).ico || "") : s.type === "szco" ? ((s.details as any)?.ico || s.birthNumber || "") : (s.birthNumber || "");
                      const isSelected = preSelectSubjectId === s.id.toString();
                      return (
                        <div
                          key={s.id}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 hover-elevate ${isSelected ? "bg-primary/10" : ""}`}
                          onClick={() => { setPreSelectSubjectId(s.id.toString()); setTimeout(() => refStep2Confirm.current?.focus(), 50); }}
                          data-testid={`row-preselect-subject-${s.id}`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-primary" : "border-muted-foreground/40"}`}>
                            <div style={{ display: isSelected ? 'block' : 'none' }} className="w-2 h-2 rounded-full bg-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate" data-testid={`text-preselect-subject-name-${s.id}`}>{displayName}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 flex-shrink-0" data-testid={`badge-preselect-subject-type-${s.id}`}>{typeLabel}</Badge>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-mono">{s.uid}</span>
                              <span style={{ display: identifier ? 'inline' : 'none' }}>{s.type === "company" ? "ICO" : "RC"}: {identifier}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" tabIndex={2} onClick={handlePreSelectStep2Back} data-testid="button-preselect-back">
                Spat
              </Button>
              <Button ref={refStep2Confirm} tabIndex={0} onClick={handlePreSelectConfirm} data-testid="button-preselect-confirm">
                Otvorit zmluvu
              </Button>
            </div>
          </div>
        </div>

        </DialogScrollContent>
      </DialogContent>
    </Dialog>
  );

  const filteredNahravanie = filterBySearch(activeContracts);
  const filteredRejected = filterBySearch(activeRejected);
  const filteredArchived = filterBySearch(activeArchived);

  const evidenciaFilter = useSmartFilter(filteredNahravanie, EVIDENCIA_FILTER_COLUMNS, "contracts-evidencia");
  const rejectedFilter = useSmartFilter(filteredRejected, EVIDENCIA_FILTER_COLUMNS, "contracts-rejected");
  const archivedFilter = useSmartFilter(filteredArchived, EVIDENCIA_FILTER_COLUMNS, "contracts-archived");
  const mainFilter = useSmartFilter(activeContracts, MAIN_FILTER_COLUMNS, "contracts-main");

  const { sortedData: sortedNahravanie, sortKey: skNahr, sortDirection: sdNahr, requestSort: rsNahr } = useTableSort(evidenciaFilter.filteredData);
  const { sortedData: sortedRejected, sortKey: skRej, sortDirection: sdRej, requestSort: rsRej } = useTableSort(rejectedFilter.filteredData);
  const { sortedData: sortedArchived, sortKey: skArch, sortDirection: sdArch, requestSort: rsArch } = useTableSort(archivedFilter.filteredData);
  const { sortedData: sortedMain, sortKey: skMain, sortDirection: sdMain, requestSort: rsMain } = useTableSort(mainFilter.filteredData);

  if (isEvidencia) {

    return (
      <div className="p-6 space-y-4">
        {preSelectDialog}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Spracovanie zmlúv</h1>
            <HelpIcon text="Prehled vsetkych zmluv v systeme. Zmluvy sa viazu na klientov, produkty a partnerov." side="right" />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { setImportFile(null); setImportResult(null); setImportDialogOpen(true); }} data-testid="button-import-excel">
              <Upload className="w-4 h-4 mr-2" />
              Import z Excelu
            </Button>
            <Button onClick={handleOpenPreSelect} data-testid="button-create-contract">
              <Plus className="w-4 h-4 mr-2" />
              Pridat zmluvu
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3" data-testid="folder-tabs">
          {folderDefs.map(f => {
            const FIcon = f.icon;
            const isActive = activeFolder === f.id;
            return (
              <Card
                key={f.id}
                className={`cursor-pointer transition-colors ${isActive ? "border-primary" : ""}`}
                onClick={() => setActiveFolder(f.id)}
                data-testid={`folder-tab-${f.id}`}
              >
                <div className="flex items-center gap-3 p-3">
                  <div className={`w-8 h-8 rounded-md ${f.bgColor} flex items-center justify-center shrink-0`}>
                    <FIcon className={`w-4 h-4 ${f.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{f.label}</p>
                    <p className="text-lg font-bold">{f.count}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Hladat zmluvy (cislo, klient, partner, produkt...)"
              className="pl-9"
              data-testid="input-search-contracts"
            />
          </div>
          <SmartFilterBar filter={evidenciaFilter} />
          <ColumnManager columnVisibility={evidenciaColumnVisibility} />
          <ColumnManager columnVisibility={sprievodkaColumnVisibility} />
        </div>

        <div id="folder-1-wrapper" style={{ display: activeFolder === 1 ? 'block' : 'none' }}>
          <Card data-testid="folder-nahravanie">
            <div className="flex items-center gap-3 p-3 border-b flex-wrap">
              <div className="flex-1">
                <p className="text-xs text-red-400 italic" data-testid="text-ordering-note">Poznamka: Zmluvy budu na sprievodke zoradene podla poradia, v akom ich oznacite.</p>
              </div>
              <span id="selected-dispatch-wrapper" style={{ display: selectedIds.length > 0 ? 'inline' : 'none' }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted-foreground">Vybranych: <span className="font-semibold text-foreground">{selectedIds.length}</span></span>
                  <Button size="sm" onClick={() => setSprievodkaDialogOpen(true)} data-testid="button-dispatch">
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Odoslat
                  </Button>
                </div>
              </span>
            </div>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredNahravanie.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-nahravanie">Ziadne zmluvy na nahravanie</p>
              ) : renderContractTable(sortedNahravanie, { showCheckbox: true, showOrder: true, sortState: { sortKey: skNahr, sortDirection: sdNahr, requestSort: rsNahr } })}
            </CardContent>
          </Card>
        </div>

        <div id="folder-2-wrapper" style={{ display: activeFolder === 2 ? 'block' : 'none' }}>
          <Card data-testid="folder-cakajuce">
            <CardContent className="p-0">
              {isLoadingDispatched ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : dispatchedBySprievodka.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-cakajuce">Ziadne zmluvy cakajuce na prijatie</p>
              ) : (
                <div className="divide-y">
                  {dispatchedBySprievodka.map(group => {
                    const isExpanded = expandedSprievodky.has(group.inventoryId);
                    const checkedIds = acceptedSprievodkaIds[group.inventoryId] || new Set();
                    const allChecked = checkedIds.size === group.contracts.length && group.contracts.length > 0;

                    return (
                      <div key={group.inventoryId} data-testid={`sprievodka-group-${group.inventoryId}`}>
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer hover-elevate flex-wrap"
                          onClick={() => toggleSprievodkaExpanded(group.inventoryId)}
                          data-testid={`button-toggle-sprievodka-${group.inventoryId}`}
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                          <FileText className="w-4 h-4 text-amber-500 shrink-0" />
                          <span className="text-sm font-medium flex-1" data-testid={`text-sprievodka-name-${group.inventoryId}`}>
                            {group.inventory?.name || `Sprievodka #${group.inventoryId}`}
                          </span>
                          <Badge variant="outline" data-testid={`badge-sprievodka-count-${group.inventoryId}`}>
                            {group.contracts.length} {group.contracts.length === 1 ? "zmluva" : group.contracts.length < 5 ? "zmluvy" : "zmluv"}
                          </Badge>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); }} data-testid={`button-print-sprievodka-${group.inventoryId}`}>
                            <Printer className="w-3.5 h-3.5 mr-1.5" />
                            Tlacit sprievodku
                          </Button>
                          <span id={`accept-btn-wrapper-${group.inventoryId}`} style={{ display: checkedIds.size > 0 ? 'inline' : 'none' }}>
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAccept(group.inventoryId); }} disabled={isAccepting} data-testid={`button-accept-${group.inventoryId}`}>
                              {isAccepting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                              Schvalit a prijat ({checkedIds.size})
                            </Button>
                          </span>
                        </div>
                        <div id={`expanded-wrapper-${group.inventoryId}`} style={{ display: isExpanded ? 'block' : 'none' }}>
                          <div className="border-t">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[40px]">
                                    <Checkbox checked={allChecked} onCheckedChange={() => toggleAcceptAll(group.inventoryId, group.contracts)} data-testid={`checkbox-accept-all-${group.inventoryId}`} />
                                  </TableHead>
                                  <TableHead className="w-[40px] text-center">#</TableHead>
                                  {sprievodkaColumnVisibility.isVisible("contractNumber") && <TableHead>Cislo zmluvy</TableHead>}
                                  {sprievodkaColumnVisibility.isVisible("proposalNumber") && <TableHead>Cislo navrhu</TableHead>}
                                  {sprievodkaColumnVisibility.isVisible("subjectId") && <TableHead>Klient</TableHead>}
                                  {sprievodkaColumnVisibility.isVisible("partnerId") && <TableHead>Partner</TableHead>}
                                  {sprievodkaColumnVisibility.isVisible("productId") && <TableHead>Produkt</TableHead>}
                                  {sprievodkaColumnVisibility.isVisible("annualPremium") && <TableHead>Rocne poistne</TableHead>}
                                  {sprievodkaColumnVisibility.isVisible("signedDate") && <TableHead>Vytvorenie zmluvy</TableHead>}
                                  {sprievodkaColumnVisibility.isVisible("premiumAmount") && <TableHead>Lehotne poistne</TableHead>}
                                  <TableHead className="text-right">Akcie</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.contracts.map(contract => (
                                  <TableRow key={contract.id} data-testid={`row-cakajuce-${contract.id}`} onRowClick={() => openEdit(contract)}>
                                    <TableCell>
                                      <Checkbox checked={checkedIds.has(contract.id)} onCheckedChange={() => toggleAcceptContract(group.inventoryId, contract.id)} data-testid={`checkbox-accept-${contract.id}`} />
                                    </TableCell>
                                    <TableCell className="text-center text-xs text-muted-foreground">
                                      <InlineSortOrderEdit contractId={contract.id} currentOrder={contract.sortOrderInInventory} />
                                    </TableCell>
                                    {sprievodkaColumnVisibility.isVisible("contractNumber") && <TableCell className="font-mono text-sm" data-testid={`text-dispatched-number-${contract.id}`}>
                                      <span className="flex items-center gap-1">
                                        <Lock className="w-3 h-3 text-amber-500 shrink-0" style={{ display: contract.isLocked ? 'block' : 'none' }} />
                                        {contract.contractNumber || "-"}
                                      </span>
                                    </TableCell>}
                                    {sprievodkaColumnVisibility.isVisible("proposalNumber") && <TableCell className="text-sm font-mono">{contract.proposalNumber || "-"}</TableCell>}
                                    {sprievodkaColumnVisibility.isVisible("subjectId") && <TableCell className="text-sm">{getSubjectDisplay(contract.subjectId)}</TableCell>}
                                    {sprievodkaColumnVisibility.isVisible("partnerId") && <TableCell className="text-sm">{getPartnerName(contract)}</TableCell>}
                                    {sprievodkaColumnVisibility.isVisible("productId") && <TableCell className="text-sm">{getProductName(contract)}</TableCell>}
                                    {sprievodkaColumnVisibility.isVisible("annualPremium") && <TableCell className="text-sm font-mono">{formatAmount(contract.annualPremium, contract.currency)}</TableCell>}
                                    {sprievodkaColumnVisibility.isVisible("signedDate") && <TableCell className="text-sm">{formatDate(contract.signedDate)}</TableCell>}
                                    {sprievodkaColumnVisibility.isVisible("premiumAmount") && <TableCell className="text-sm font-mono">{formatAmount(contract.premiumAmount, contract.currency)}</TableCell>}
                                    <TableCell className="text-right">
                                      <Button size="icon" variant="ghost" onClick={() => openView(contract)} data-testid={`button-view-dispatched-${contract.id}`}>
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div id="folder-3-wrapper" style={{ display: activeFolder === 3 ? 'block' : 'none' }}>
          <Card data-testid="folder-neprijate">
            <div className="flex items-center gap-3 p-3 border-b">
              <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-muted-foreground">Zmluvy, ktore neboli zaskrtnute pri prijati sprievodky.</p>
            </div>
            <CardContent className="p-0">
              {isLoadingRejected ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredRejected.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-neprijate">Ziadne neprijate zmluvy</p>
              ) : renderContractTable(sortedRejected, { showStatus: true, showRegistration: true, showActions: true, sortState: { sortKey: skRej, sortDirection: sdRej, requestSort: rsRej } })}
            </CardContent>
          </Card>
        </div>

        <div id="folder-4-wrapper" style={{ display: activeFolder === 4 ? 'block' : 'none' }}>
          <Card data-testid="folder-archiv">
            <div className="flex items-center gap-3 p-3 border-b">
              <Archive className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">Neprijate zmluvy starsie ako 100 dni.</p>
            </div>
            <CardContent className="p-0">
              {isLoadingArchived ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredArchived.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-archiv">Ziadne archivovane zmluvy</p>
              ) : renderContractTable(sortedArchived, { showStatus: true, showRegistration: true, showActions: false, sortState: { sortKey: skArch, sortDirection: sdArch, requestSort: rsArch } })}
            </CardContent>
          </Card>
        </div>

        <Dialog open={sprievodkaDialogOpen} onOpenChange={setSprievodkaDialogOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle data-testid="text-sprievodka-dialog-title">Odoslat zmluvy</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vybranych zmluv: <span className="font-semibold text-foreground">{selectedIds.length}</span>. Zmluvy budu odoslane na schvalenie Centralnej kancelarii cez novu sprievodku.
              </p>
              <p className="text-xs font-medium text-red-400" data-testid="text-sprievodka-order-note">
                Zmluvy budu na sprievodke zoradene podla poradia, v akom ich oznacite.
              </p>
              <div className="flex items-center justify-end gap-3 flex-wrap">
                <Button variant="outline" onClick={() => setSprievodkaDialogOpen(false)} data-testid="button-sprievodka-cancel">
                  Zrusit
                </Button>
                <Button onClick={handleDispatch} disabled={isDispatching} data-testid="button-sprievodka-confirm">
                  {isDispatching ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Odosielam...</>) : (<><Send className="w-4 h-4 mr-2" />Odoslat</>)}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={duplicateModal.open} onOpenChange={(o) => setDuplicateModal({ open: o })}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle data-testid="text-duplicate-title">Duplicitna zmluva</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-md bg-amber-500/10">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <p className="text-sm" data-testid="text-duplicate-message">
                  Zmluva s tymto cislom uz existuje{duplicateModal.subjectName ? ` pre klienta ${duplicateModal.subjectName}` : ""}.
                </p>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setDuplicateModal({ open: false })} data-testid="button-duplicate-close">
                  Zavriet
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <DeleteContractDialog
          contract={deletingContract}
          open={deleteDialogOpen}
          onOpenChange={(isOpen) => {
            setDeleteDialogOpen(isOpen);
            if (!isOpen) setDeletingContract(null);
          }}
        />

        <ContractDetailDialog
          contract={viewingContract}
          open={!!viewingContract}
          onClose={() => setViewingContract(null)}
          subjects={subjects || []}
          partners={partners || []}
          sectorProducts={allSectorProducts || []}
          statuses={statuses || []}
          templates={templates || []}
          inventories={inventories || []}
          companies={companies || []}
          states={allStates || []}
        />
        {importDialog}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {preSelectDialog}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Evidencia zmlúv</h1>
          <HelpIcon text="Prehled vsetkych zmluv v systeme. Zmluvy sa viazu na klientov, produkty a partnerov." side="right" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setImportDialogOpen(true)} data-testid="button-bulk-import">
            <Upload className="w-4 h-4 mr-2" />
            Hromadný import
          </Button>
          <Button onClick={() => navigate("/evidencia-zmluv")} data-testid="button-create-contract">
            <Plus className="w-4 h-4 mr-2" />
            Evidovať zmluvu
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Stav</label>
          <Select value={filterStatusId} onValueChange={setFilterStatusId}>
            <SelectTrigger className="w-[200px]" data-testid="select-filter-status">
              <SelectValue placeholder="Vsetky stavy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vsetky stavy</SelectItem>
              {statuses?.map(s => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Supiska</label>
          <Select value={filterInventoryId} onValueChange={setFilterInventoryId}>
            <SelectTrigger className="w-[200px]" data-testid="select-filter-inventory">
              <SelectValue placeholder="Vsetky supisky" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vsetky supisky</SelectItem>
              {inventories?.map(i => (
                <SelectItem key={i.id} value={i.id.toString()}>{i.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        <SmartFilterBar filter={mainFilter} />
        <ColumnManager columnVisibility={columnVisibility} />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : activeContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-contracts">
              Ziadne zmluvy
            </p>
          ) : (
            <div className="relative overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <Table stickyHeader>
              <TableHeader>
                <TableRow>
                  {columnVisibility.isVisible("contractNumber") && <TableHead sortKey="contractNumber" sortDirection={skMain === "contractNumber" ? sdMain : null} onSort={rsMain}>Cislo zmluvy</TableHead>}
                  {columnVisibility.isVisible("proposalNumber") && <TableHead sortKey="proposalNumber" sortDirection={skMain === "proposalNumber" ? sdMain : null} onSort={rsMain}>Cislo navrhu</TableHead>}
                  {columnVisibility.isVisible("globalNumber") && <TableHead sortKey="globalNumber" sortDirection={skMain === "globalNumber" ? sdMain : null} onSort={rsMain}>Poradove cislo</TableHead>}
                  {columnVisibility.isVisible("subjectId") && <TableHead sortKey="subjectId" sortDirection={skMain === "subjectId" ? sdMain : null} onSort={rsMain}>Klient</TableHead>}
                  {columnVisibility.isVisible("partnerId") && <TableHead sortKey="partnerId" sortDirection={skMain === "partnerId" ? sdMain : null} onSort={rsMain}>Partner</TableHead>}
                  {columnVisibility.isVisible("productId") && <TableHead sortKey="productId" sortDirection={skMain === "productId" ? sdMain : null} onSort={rsMain}>Produkt</TableHead>}
                  {columnVisibility.isVisible("status") && <TableHead>Stav</TableHead>}
                  {columnVisibility.isVisible("inventoryId") && <TableHead sortKey="inventoryId" sortDirection={skMain === "inventoryId" ? sdMain : null} onSort={rsMain}>Sprievodka</TableHead>}
                  {columnVisibility.isVisible("annualPremium") && <TableHead sortKey="annualPremium" sortDirection={skMain === "annualPremium" ? sdMain : null} onSort={rsMain}>Rocne poistne</TableHead>}
                  {columnVisibility.isVisible("signedDate") && <TableHead sortKey="signedDate" sortDirection={skMain === "signedDate" ? sdMain : null} onSort={rsMain}>Vytvorenie zmluvy</TableHead>}
                  {columnVisibility.isVisible("premiumAmount") && <TableHead sortKey="premiumAmount" sortDirection={skMain === "premiumAmount" ? sdMain : null} onSort={rsMain}>Lehotne poistne</TableHead>}
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMain.map(contract => {
                  const status = statuses?.find(s => s.id === contract.statusId);
                  const inventoryName = inventories?.find(i => i.id === contract.inventoryId)?.name || "-";

                  return (
                    <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`} onRowClick={() => openEdit(contract)}>
                      {columnVisibility.isVisible("contractNumber") && <TableCell className="font-mono text-sm" data-testid={`text-contract-number-${contract.id}`}>
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-500 shrink-0" style={{ display: contract.isLocked ? 'block' : 'none' }} />
                          {contract.contractNumber || "-"}
                        </span>
                      </TableCell>}
                      {columnVisibility.isVisible("proposalNumber") && <TableCell className="text-sm font-mono" data-testid={`text-contract-proposal-${contract.id}`}>{contract.proposalNumber || "-"}</TableCell>}
                      {columnVisibility.isVisible("globalNumber") && <TableCell className="font-mono text-sm" data-testid={`text-contract-registration-${contract.id}`}>
                        {contract.globalNumber ? (
                          <span className="font-semibold">{contract.globalNumber}</span>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">V procese</Badge>
                        )}
                      </TableCell>}
                      {columnVisibility.isVisible("subjectId") && <TableCell className="text-sm" data-testid={`text-contract-subject-${contract.id}`}>
                        {getSubjectDisplay(contract.subjectId)}
                      </TableCell>}
                      {columnVisibility.isVisible("partnerId") && <TableCell className="text-sm" data-testid={`text-contract-partner-${contract.id}`}>
                        {getPartnerName(contract)}
                      </TableCell>}
                      {columnVisibility.isVisible("productId") && <TableCell className="text-sm" data-testid={`text-contract-product-${contract.id}`}>
                        {getProductName(contract)}
                      </TableCell>}
                      {columnVisibility.isVisible("status") && <TableCell data-testid={`text-contract-status-${contract.id}`} style={{ maxWidth: '150px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                        {status ? (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium leading-snug"
                            style={{ borderColor: status.color, color: status.color, backgroundColor: `${status.color}15`, whiteSpace: 'normal', wordBreak: 'break-word' }}
                            data-testid={`badge-contract-status-${contract.id}`}
                          >
                            {status.name}
                          </span>
                        ) : "-"}
                      </TableCell>}
                      {columnVisibility.isVisible("inventoryId") && <TableCell className="text-sm" data-testid={`text-contract-inventory-${contract.id}`}>
                        {inventoryName}
                      </TableCell>}
                      {columnVisibility.isVisible("annualPremium") && <TableCell className="text-sm font-mono" data-testid={`text-contract-annual-${contract.id}`}>
                        {formatAmount(contract.annualPremium, contract.currency)}
                      </TableCell>}
                      {columnVisibility.isVisible("signedDate") && <TableCell className="text-sm" data-testid={`text-contract-date-${contract.id}`}>
                        {formatDate(contract.signedDate)}
                      </TableCell>}
                      {columnVisibility.isVisible("premiumAmount") && <TableCell className="text-sm font-mono" data-testid={`text-contract-amount-${contract.id}`}>
                        {formatAmount(contract.premiumAmount, contract.currency)}
                      </TableCell>}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button size="icon" variant="ghost" onClick={() => openView(contract)} data-testid={`button-view-contract-${contract.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(contract)} data-testid={`button-edit-contract-${contract.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={() => openDelete(contract)} data-testid={`button-delete-contract-${contract.id}`}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <DeleteContractDialog
        contract={deletingContract}
        open={deleteDialogOpen}
        onOpenChange={(isOpen) => {
          setDeleteDialogOpen(isOpen);
          if (!isOpen) setDeletingContract(null);
        }}
      />

      <ContractDetailDialog
        contract={viewingContract}
        open={!!viewingContract}
        onClose={() => setViewingContract(null)}
        subjects={subjects || []}
        partners={partners || []}
        sectorProducts={allSectorProducts || []}
        statuses={statuses || []}
        templates={templates || []}
        inventories={inventories || []}
        companies={companies || []}
        states={allStates || []}
      />
      {importDialog}
    </div>
  );
}
