import { useState, useRef, useCallback, useEffect, useMemo, type ComponentType } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateSlovak, formatUid, getDateSemaphore, getDateSemaphoreClasses, canCreateRecords, canDeleteRecords, canEditRecords } from "@/lib/utils";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useLocation } from "wouter";
import type { Contract, ContractStatus, ContractTemplate, ContractInventory, Subject, Partner, Product, MyCompany, Sector, Section, SectorProduct, ClientGroup, ClientType, AppUser, ContractAcquirer } from "@shared/schema";
import { Plus, Pencil, Trash2, Eye, FileText, Loader2, Lock, LayoutGrid, Send, Upload, Inbox, CheckCircle2, ChevronDown, ChevronRight, Printer, Search, Archive, AlertTriangle, Calendar, XCircle, MessageSquare, Paperclip, X, Users, Check, Award, Percent, History, ListChecks, ArrowRight, ArrowUpRight, ArrowUp, Clock, Ghost, Ban, HelpCircle, ScanLine } from "lucide-react";
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

const LIFECYCLE_PHASE_NAMES: Record<number, string> = {
  1: "Čakajúce",
  2: "Odoslané",
  3: "Výhrady",
  4: "Archív",
  5: "Prijaté CK",
  6: "V spracovaní",
  7: "Intervencia",
  8: "Pripravené",
  9: "Odoslané OP",
  10: "Prijaté OP",
};

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
  { key: "freshness", label: "Čerstvosť" },
];

function getFreshnessSemaphore(updatedAt: string | Date | null | undefined): { color: string; label: string; blink: boolean } {
  if (!updatedAt) return { color: "#6b7280", label: "Neznáme", blink: false };
  const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days < 30) return { color: "#22c55e", label: `${days}d`, blink: false };
  if (days < 60) return { color: "#f59e0b", label: `${days}d`, blink: false };
  if (days <= 90) return { color: "#ef4444", label: `${days}d`, blink: false };
  return { color: "#ef4444", label: `${days}d`, blink: true };
}

function getSmartStatusColor(statusColor: string | undefined, expiryDate: string | Date | null | undefined): string {
  if (!statusColor) return "#6b7280";
  if (!expiryDate) return statusColor;
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return statusColor;
  return "#ef4444";
}

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

  const { data: migrationModeData } = useQuery<{ value: string | null }>({
    queryKey: ["/api/system-settings", "MIGRATION_MODE"],
    queryFn: async () => {
      const res = await fetch("/api/system-settings/MIGRATION_MODE");
      return res.json();
    },
  });
  const isMigrationMode = migrationModeData?.value === "ON";

  const [migReceivedByCentral, setMigReceivedByCentral] = useState("");
  const [migSentToPartner, setMigSentToPartner] = useState("");
  const [migReceivedByPartner, setMigReceivedByPartner] = useState("");
  const [migObjectionEnteredAt, setMigObjectionEnteredAt] = useState("");
  const [migDispatchedAt, setMigDispatchedAt] = useState("");
  const [migLifecyclePhase, setMigLifecyclePhase] = useState("");

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
        setMigReceivedByCentral(editingContract.receivedByCentralAt ? new Date(editingContract.receivedByCentralAt).toISOString().split("T")[0] : "");
        setMigSentToPartner(editingContract.sentToPartnerAt ? new Date(editingContract.sentToPartnerAt).toISOString().split("T")[0] : "");
        setMigReceivedByPartner(editingContract.receivedByPartnerAt ? new Date(editingContract.receivedByPartnerAt).toISOString().split("T")[0] : "");
        setMigObjectionEnteredAt(editingContract.objectionEnteredAt ? new Date(editingContract.objectionEnteredAt).toISOString().split("T")[0] : "");
        setMigDispatchedAt(editingContract.dispatchedAt ? new Date(editingContract.dispatchedAt).toISOString().split("T")[0] : "");
        setMigLifecyclePhase(editingContract.lifecyclePhase?.toString() || "0");
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
        setMigReceivedByCentral("");
        setMigSentToPartner("");
        setMigReceivedByPartner("");
        setMigObjectionEnteredAt("");
        setMigDispatchedAt("");
        setMigLifecyclePhase("0");
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
      ...(isMigrationMode ? {
        _migrationDates: {
          receivedByCentralAt: migReceivedByCentral ? new Date(migReceivedByCentral).toISOString() : null,
          sentToPartnerAt: migSentToPartner ? new Date(migSentToPartner).toISOString() : null,
          receivedByPartnerAt: migReceivedByPartner ? new Date(migReceivedByPartner).toISOString() : null,
          objectionEnteredAt: migObjectionEnteredAt ? new Date(migObjectionEnteredAt).toISOString() : null,
          dispatchedAt: migDispatchedAt ? new Date(migDispatchedAt).toISOString() : null,
          lifecyclePhase: migLifecyclePhase ? parseInt(migLifecyclePhase) : undefined,
        },
      } : {}),
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
                      {s.type === "person" ? `${s.firstName} ${s.lastName}` : s.companyName} ({formatUid(s.uid)})
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
                                <span className="text-xs text-muted-foreground font-mono ml-auto">{formatUid(u.uid)}</span>
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
                                  <span className="text-xs text-muted-foreground font-mono ml-auto">{formatUid(u.uid)}</span>
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
                        <span className="text-sm font-medium">{user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username : formatUid(rec.uid)}</span>
                        <span className="text-xs text-muted-foreground font-mono">{formatUid(rec.uid)}</span>
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
              {productPanels?.map(panel => (
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
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className={getDateSemaphoreClasses(getDateSemaphore(expiryDate))} data-testid="input-contract-expiry-date" />
            </div>
          </div>

          {isMigrationMode && (
            <div className="border border-purple-500/30 rounded-md p-3 bg-purple-950/10 space-y-3">
              <div className="flex items-center gap-2 text-purple-400 text-xs font-medium">
                <Ghost className="w-3 h-3" />
                Ghost Mode - Procesné dátumy (migrácia)
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Prijatie na centrálu</label>
                  <Input type="date" value={migReceivedByCentral} onChange={e => setMigReceivedByCentral(e.target.value)} className="h-8 text-xs" data-testid="input-mig-received-central" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Odoslanie partnerovi</label>
                  <Input type="date" value={migSentToPartner} onChange={e => setMigSentToPartner(e.target.value)} className="h-8 text-xs" data-testid="input-mig-sent-partner" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Prijatie partnerom</label>
                  <Input type="date" value={migReceivedByPartner} onChange={e => setMigReceivedByPartner(e.target.value)} className="h-8 text-xs" data-testid="input-mig-received-partner" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Dátum výhrady</label>
                  <Input type="date" value={migObjectionEnteredAt} onChange={e => setMigObjectionEnteredAt(e.target.value)} className="h-8 text-xs" data-testid="input-mig-objection" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Dátum odoslania</label>
                  <Input type="date" value={migDispatchedAt} onChange={e => setMigDispatchedAt(e.target.value)} className="h-8 text-xs" data-testid="input-mig-dispatched" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Fáza životného cyklu</label>
                  <select value={migLifecyclePhase} onChange={e => setMigLifecyclePhase(e.target.value)} className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs" data-testid="select-mig-lifecycle">
                    <option value="0">0 - Nová</option>
                    <option value="1">1 - Evidencia</option>
                    <option value="2">2 - Sprievodka</option>
                    <option value="3">3 - Výhrady</option>
                    <option value="4">4 - Archív</option>
                    <option value="5">5 - Centrum</option>
                    <option value="6">6 - Spracovanie</option>
                    <option value="7">7 - Kontrola</option>
                    <option value="8">8 - Schválenie</option>
                    <option value="9">9 - Odoslanie</option>
                    <option value="10">10 - Doručenie</option>
                  </select>
                </div>
              </div>
            </div>
          )}

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

function ContractLifecycleTimeline({ contractId }: { contractId: number }) {
  const { data: history, isLoading } = useQuery<{
    id: number;
    contractId: number;
    fromPhase: number | null;
    toPhase: number;
    changedBy: string | null;
    note: string | null;
    createdAt: string;
  }[]>({
    queryKey: ["/api/contracts", contractId, "lifecycle-history"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/lifecycle-history`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const phaseNames: Record<number, string> = {
    0: "Nový záznam",
    1: "Nahratá - čaká na odoslanie",
    2: "Odoslané na sprievodke",
    3: "Výhrady",
    4: "Archív",
    5: "Prijaté do centrály",
    6: "V spracovaní",
    7: "Intervencia",
    8: "Pripravené",
    9: "Odoslané OP",
    10: "Prijaté OP",
  };

  if (isLoading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin" /></div>;
  if (!history || history.length === 0) return <p className="text-sm text-muted-foreground text-center py-6" data-testid="text-no-lifecycle">Žiadna história životného cyklu</p>;

  return (
    <div className="space-y-0" data-testid="lifecycle-timeline">
      {history.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3 pb-4" data-testid={`lifecycle-entry-${entry.id}`}>
          <div className="flex flex-col items-center">
            <div className={`w-3 h-3 rounded-full shrink-0 mt-1 ${entry.toPhase <= 5 ? "bg-amber-500" : "bg-cyan-500"}`} />
            {idx < history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold">
                {phaseNames[entry.fromPhase ?? 0] || `Fáza ${entry.fromPhase}`}
              </span>
              <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
              <Badge variant="outline" className={`text-[10px] ${entry.toPhase <= 5 ? "border-amber-500/40 text-amber-400" : "border-cyan-500/40 text-cyan-400"}`}>
                {phaseNames[entry.toPhase] || `Fáza ${entry.toPhase}`}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
              <Clock className="w-2.5 h-2.5" />
              <span>{new Date(entry.createdAt).toLocaleString("sk-SK")}</span>
              {entry.changedBy && <span>• {entry.changedBy}</span>}
            </div>
            {entry.note && <p className="text-[11px] text-muted-foreground mt-1 italic">"{entry.note}"</p>}
          </div>
        </div>
      ))}
    </div>
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
              <DialogTitle data-testid="text-contract-detail-title">Zmluva {contract.contractNumber || formatUid(contract.uid)}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full border text-[11px] font-medium"
                  style={{ borderColor: getSmartStatusColor(status?.color, contract?.expiryDate), color: getSmartStatusColor(status?.color, contract?.expiryDate), backgroundColor: status ? `${getSmartStatusColor(status?.color, contract?.expiryDate)}15` : 'transparent', display: status ? 'inline-flex' : 'none' }}
                  data-testid="badge-detail-status"
                >
                  {status?.name}
                </span>
                {(contract as any).isFirstContract && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-red-500/40 text-red-400 text-[10px] font-semibold" data-testid="badge-detail-first-contract">1. ZMLUVA</span>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <DialogScrollContent>
        <Tabs defaultValue="detail" className="mt-2">
          <TabsList className="w-full justify-between" data-testid="tabs-contract-detail">
            <TabsTrigger value="detail" data-testid="tab-contract-detail">
              <FileText className="w-3.5 h-3.5 mr-1" /> Detail
            </TabsTrigger>
            <TabsTrigger value="lifecycle" data-testid="tab-contract-lifecycle">
              <Clock className="w-3.5 h-3.5 mr-1" /> 🕰️ Stroj času
            </TabsTrigger>
            <TabsTrigger value="historia" data-testid="tab-contract-historia">
              <History className="w-3.5 h-3.5 mr-1" /> História
            </TabsTrigger>
          </TabsList>

          <TabsContent value="detail" className="mt-3">
            {(contract as any).isFirstContract && (
              <div className="mb-3 px-3 py-2 bg-red-900/20 border border-red-500/50 rounded" data-testid="banner-detail-first-contract">
                <div className="flex items-center gap-2 text-red-400 text-xs font-medium">
                  <span>🛑</span>
                  <span>Provízny stop — Prvá zmluva v divízii. Beneficient: <strong>{(contract as any).commissionRedirectedToName || "Nadriadený neurčený"}</strong></span>
                </div>
              </div>
            )}
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Cislo zmluvy</span>
                  <p className="text-sm" data-testid="text-detail-contract-number">{contract.contractNumber || "-"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Klient</span>
                  <p className="text-sm flex items-center gap-1.5" data-testid="text-detail-subject">
                    {subjectName ? (subjectName.type === "person" ? `${subjectName.firstName} ${subjectName.lastName}` : subjectName.companyName) : "-"}
                    {(subjectName as any)?.effectiveListStatus === "cierny" && <span title="Globálny čierny zoznam"><Ban className="w-3.5 h-3.5 text-red-500 shrink-0" /></span>}
                    {(subjectName as any)?.effectiveListStatus === "cerveny" && <span title="Lokálny červený zoznam"><AlertTriangle className="w-3.5 h-3.5 text-orange-500 shrink-0" /></span>}
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
                  <p className={`text-sm ${getDateSemaphore(contract.expiryDate) === "expired" ? "text-red-500 font-medium" : getDateSemaphore(contract.expiryDate) === "warning" ? "text-orange-500 font-medium" : ""}`} data-testid="text-detail-expiry-date">{formatDate(contract.expiryDate)}</p>
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

          <TabsContent value="lifecycle" className="mt-3">
            <ContractLifecycleTimeline contractId={contract.id} />
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

type FolderDef = { id: number; label: string; icon: ComponentType<{ className?: string }>; color: string; bgColor: string; count: number; tooltip?: string };

function SupiskaCountdownButton({ receivedAt, onEdit, supiskaId }: { receivedAt: string | Date; onEdit: (e: React.MouseEvent) => void; supiskaId: number }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function update() {
      const start = new Date(receivedAt).getTime();
      const end = start + 24 * 60 * 60 * 1000;
      const now = Date.now();
      const diff = end - now;
      if (diff <= 0) {
        setRemaining("00:00:00");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [receivedAt]);

  return (
    <Button
      size="sm"
      variant="default"
      className="bg-red-700 hover:bg-red-800 text-yellow-300 font-mono font-bold"
      onClick={onEdit}
      data-testid={`button-countdown-supiska-${supiskaId}`}
    >
      <Award className="w-3 h-3 mr-1 text-yellow-300" />{remaining}
    </Button>
  );
}

function WorkflowDiagram({ folderDefs, row2FolderDefs, activeFolder, onFolderClick }: { folderDefs: FolderDef[]; row2FolderDefs: FolderDef[]; activeFolder: number; onFolderClick: (id: number) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<string[]>([]);
  const [blueLPath, setBlueLPath] = useState<string>("");
  const [redPath, setRedPath] = useState<string>("");
  const [blackPath, setBlackPath] = useState<string>("");
  const [orangePath, setOrangePath] = useState<string>("");
  const [greenPath, setGreenPath] = useState<string>("");
  const [junctionMask, setJunctionMask] = useState<{x: number; y: number; w: number; h: number} | null>(null);
  const [arrows, setArrows] = useState<{ d: string; color: string }[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const cards = Array.from(el.querySelectorAll('[data-phase-card]')) as HTMLElement[];
      if (cards.length < 10) { setPaths([]); setArrows([]); setBlueLPath(""); setRedPath(""); setBlackPath(""); setOrangePath(""); setGreenPath(""); return; }
      const cR = el.getBoundingClientRect();
      const g = (c: HTMLElement) => {
        const r = c.getBoundingClientRect();
        return { cx: r.left + r.width / 2 - cR.left, t: r.top - cR.top, b: r.bottom - cR.top };
      };
      const p = cards.map(g);
      const pad = 5;
      const full = (c: HTMLElement) => {
        const card = c.querySelector('[data-testid^="folder-tab-"]') as HTMLElement || c;
        const r = card.getBoundingClientRect();
        return { l: r.left - cR.left, r: r.right - cR.left, t: r.top - cR.top, b: r.bottom - cR.top };
      };
      const f = cards.map(full);
      const rc = 8;
      const globalTop = Math.min(f[0].t, f[4].t) - pad;
      const globalBottom = Math.max(f[5].b, f[6].b, f[7].b, f[8].b, f[9].b) + pad;
      const row1Bottom = Math.max(f[0].b, f[1].b, f[2].b, f[3].b, f[4].b);
      const row2Top = Math.min(f[5].t, f[6].t, f[7].t, f[8].t, f[9].t);
      const stepY = (row1Bottom + row2Top) / 2;

      const left = Math.min(f[0].l, f[5].l) - pad;
      const right1 = f[0].r + pad;
      const mid6x = (f[6].l + f[6].r) / 2;

      const bluePath = [
        `M ${left + rc},${globalTop}`,
        `H ${right1 - rc} A ${rc},${rc} 0 0 1 ${right1},${globalTop + rc}`,
        `V ${stepY - rc} A ${rc},${rc} 0 0 0 ${right1 + rc},${stepY}`,
        `H ${mid6x}`,
        `V ${globalBottom}`,
        `H ${left + rc} A ${rc},${rc} 0 0 1 ${left},${globalBottom - rc}`,
        `V ${globalTop + rc} A ${rc},${rc} 0 0 1 ${left + rc},${globalTop}`,
        'Z',
      ].join(' ');
      setBlueLPath(bluePath);

      const rightRed = Math.max(f[4].r, f[9].r) + pad;
      const redLeftR1 = f[4].l - pad;
      const redLeftR2 = mid6x;
      const combinedRedPath = [
        `M ${redLeftR1 + rc},${globalTop}`,
        `H ${rightRed - rc} A ${rc},${rc} 0 0 1 ${rightRed},${globalTop + rc}`,
        `V ${globalBottom - rc} A ${rc},${rc} 0 0 1 ${rightRed - rc},${globalBottom}`,
        `H ${redLeftR2 + rc} A ${rc},${rc} 0 0 1 ${redLeftR2},${globalBottom - rc}`,
        `V ${stepY + rc} A ${rc},${rc} 0 0 1 ${redLeftR2 + rc},${stepY}`,
        `H ${redLeftR1 - rc} A ${rc},${rc} 0 0 0 ${redLeftR1},${stepY - rc}`,
        `V ${globalTop + rc} A ${rc},${rc} 0 0 1 ${redLeftR1 + rc},${globalTop}`,
        'Z',
      ].join(' ');
      setRedPath(combinedRedPath);
      setJunctionMask({ x: mid6x - 1, y: stepY, w: 2, h: globalBottom - stepY });

      setGreenPath("");

      const leftGray = f[1].l - pad;
      const topGray = f[1].t - pad;
      const rightGray = f[2].r + pad;
      const bottomGray = Math.max(f[1].b, f[2].b) + pad;
      const grayPath = [
        `M ${leftGray + rc},${topGray}`,
        `H ${rightGray - rc} A ${rc},${rc} 0 0 1 ${rightGray},${topGray + rc}`,
        `V ${bottomGray - rc} A ${rc},${rc} 0 0 1 ${rightGray - rc},${bottomGray}`,
        `H ${leftGray + rc} A ${rc},${rc} 0 0 1 ${leftGray},${bottomGray - rc}`,
        `V ${topGray + rc} A ${rc},${rc} 0 0 1 ${leftGray + rc},${topGray}`,
        'Z',
      ].join(' ');
      setBlackPath(grayPath);

      const leftOr = f[3].l - pad;
      const topOr = f[3].t - pad;
      const rightOr = f[3].r + pad;
      const bottomOr = f[3].b + pad;
      const orPath = [
        `M ${leftOr + rc},${topOr}`,
        `H ${rightOr - rc} A ${rc},${rc} 0 0 1 ${rightOr},${topOr + rc}`,
        `V ${bottomOr - rc} A ${rc},${rc} 0 0 1 ${rightOr - rc},${bottomOr}`,
        `H ${leftOr + rc} A ${rc},${rc} 0 0 1 ${leftOr},${bottomOr - rc}`,
        `V ${topOr + rc} A ${rc},${rc} 0 0 1 ${leftOr + rc},${topOr}`,
        'Z',
      ].join(' ');
      setOrangePath(orPath);

      const aw = 6; const headW = 14; const headH = 10;
      const mkVArrow = (fromIdx: number, toIdx: number, color: string, offsetX = 0) => {
        const cx = (f[fromIdx].l + f[fromIdx].r) / 2 + offsetX;
        const down = f[toIdx].t > f[fromIdx].b;
        const startY = down ? f[fromIdx].b + 2 : f[fromIdx].t - 2;
        const endY = down ? f[toIdx].t - 2 : f[toIdx].b + 2;
        const bodyEndY = down ? endY - headH : endY + headH;
        return {
          color,
          d: [
            `M ${cx - aw},${startY}`,
            `V ${bodyEndY}`,
            `H ${cx - headW}`,
            `L ${cx},${endY}`,
            `L ${cx + headW},${bodyEndY}`,
            `H ${cx + aw}`,
            `V ${startY}`,
            'Z',
          ].join(' '),
        };
      };
      const mkDArrow = (fromIdx: number, toIdx: number, color: string) => {
        const fromCx = (f[fromIdx].l + f[fromIdx].r) / 2;
        const fromCy = (f[fromIdx].t + f[fromIdx].b) / 2;
        const toCx = (f[toIdx].l + f[toIdx].r) / 2;
        const toCy = (f[toIdx].t + f[toIdx].b) / 2;
        const dx = toCx - fromCx;
        const dy = toCy - fromCy;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;
        const px = -uy;
        const py = ux;
        const hw = Math.min(f[fromIdx].r - f[fromIdx].l, f[fromIdx].b - f[fromIdx].t) / 2;
        const startX = fromCx + ux * hw;
        const startY = fromCy + uy * hw;
        const hw2 = Math.min(f[toIdx].r - f[toIdx].l, f[toIdx].b - f[toIdx].t) / 2;
        const endX = toCx - ux * hw2;
        const endY = toCy - uy * hw2;
        const baseX = endX - ux * headH;
        const baseY = endY - uy * headH;
        return {
          color,
          d: [
            `M ${startX + px * aw},${startY + py * aw}`,
            `L ${baseX + px * aw},${baseY + py * aw}`,
            `L ${baseX + px * headW},${baseY + py * headW}`,
            `L ${endX},${endY}`,
            `L ${baseX - px * headW},${baseY - py * headW}`,
            `L ${baseX - px * aw},${baseY - py * aw}`,
            `L ${startX - px * aw},${startY - py * aw}`,
            'Z',
          ].join(' '),
        };
      };
      const mkHArrow = (fromIdx: number, toIdx: number, color: string, offsetY = 0) => {
        const cy = (f[fromIdx].t + f[fromIdx].b) / 2 + offsetY;
        const right = f[toIdx].l > f[fromIdx].r;
        const startX = right ? f[fromIdx].r + 2 : f[fromIdx].l - 2;
        const endX = right ? f[toIdx].l - 2 : f[toIdx].r + 2;
        const bodyEndX = right ? endX - headH : endX + headH;
        return {
          color,
          d: [
            `M ${startX},${cy - aw}`,
            `H ${bodyEndX}`,
            `V ${cy - headW}`,
            `L ${endX},${cy}`,
            `L ${bodyEndX},${cy + headW}`,
            `V ${cy + aw}`,
            `H ${startX}`,
            'Z',
          ].join(' '),
        };
      };
      setArrows([
        mkVArrow(0, 5, '#3b82f6'),
        mkHArrow(5, 6, '#3b82f6'),
        mkHArrow(6, 7, '#ef4444'),
        mkHArrow(7, 8, '#ef4444', -18),
        mkHArrow(8, 7, '#ef4444', 18),
        mkHArrow(8, 9, '#ef4444'),
        mkVArrow(9, 4, '#ef4444'),
        mkVArrow(8, 3, '#ef4444', -16),
        mkVArrow(3, 8, '#f97316', 16),
        mkVArrow(6, 1, '#a1a1aa'),
        mkHArrow(1, 2, '#a1a1aa', -18),
        mkHArrow(2, 1, '#a1a1aa', 18),
        mkHArrow(1, 0, '#a1a1aa'),
      ]);

      setPaths([]);
    };
    const ro = new ResizeObserver(compute);
    ro.observe(el);
    compute();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative rounded-lg border bg-card p-4 overflow-visible" data-testid="workflow-diagram">
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
        <defs>
          <filter id="arrow-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.25" />
          </filter>
          {junctionMask && (
            <mask id="junction-mask" maskUnits="userSpaceOnUse">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              <rect x={junctionMask.x} y={junctionMask.y} width={junctionMask.w} height={junctionMask.h} fill="black" />
            </mask>
          )}
        </defs>
        {blueLPath && (
          <>
            <path d={blueLPath} fill="#3b82f6" fillOpacity="0.12" stroke="none" />
            <path d={blueLPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeOpacity="0.35" strokeLinejoin="round" mask={junctionMask ? "url(#junction-mask)" : undefined} />
          </>
        )}
        {redPath && (
          <>
            <path d={redPath} fill="#ef4444" fillOpacity="0.12" stroke="none" />
            <path d={redPath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeOpacity="0.35" strokeLinejoin="round" mask={junctionMask ? "url(#junction-mask)" : undefined} />
          </>
        )}
        {greenPath && (
          <path d={greenPath} fill="#ef4444" fillOpacity="0.12" stroke="#ef4444" strokeWidth="1.5" strokeOpacity="0.35" strokeLinejoin="round" />
        )}
        {blackPath && (
          <path d={blackPath} fill="#71717a" fillOpacity="0.18" stroke="#71717a" strokeWidth="1.5" strokeOpacity="0.35" strokeLinejoin="round" />
        )}
        {orangePath && (
          <path d={orangePath} fill="#f97316" fillOpacity="0.15" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.35" strokeLinejoin="round" />
        )}
        {arrows.map((a, i) => (
          <path key={`arrow-${i}`} d={a.d} fill={a.color} fillOpacity="0.45" stroke={a.color} strokeWidth="0.5" strokeOpacity="0.6" strokeLinejoin="round" filter="url(#arrow-shadow)" />
        ))}
      </svg>
      <div className="relative z-10 space-y-6" data-testid="folder-tabs">
        <div className="grid grid-cols-5 gap-6 px-4">
          {folderDefs.map(f => {
            const FIcon = f.icon;
            const isActive = activeFolder === f.id;
            return (
              <div key={f.id} data-phase-card={f.id}>
                <Card className={`cursor-pointer transition-colors relative h-[100px] ${isActive ? "border-primary shadow-sm bg-yellow-300/40 dark:bg-yellow-500/25" : "bg-card"}`} onClick={() => onFolderClick(f.id)} data-testid={`folder-tab-${f.id}`}>
                  {f.tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="absolute top-1 right-1 z-20 rounded-full bg-muted/60 hover:bg-muted p-0.5 transition-colors" onClick={(e) => e.stopPropagation()} data-testid={`help-phase-${f.id}`}>
                          <HelpCircle className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {f.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <div className="flex flex-col items-center p-2 text-center h-full">
                    <div className="flex items-center justify-center gap-1 shrink-0">
                      {[4, 7, 10].includes(f.id) ? (
                        <ArrowUpRight className={`w-7 h-7 shrink-0 fill-current ${f.id === 4 ? 'text-zinc-400' : f.id === 10 ? 'text-emerald-500' : 'text-foreground'}`} strokeWidth={6} />
                      ) : (
                        <div className="w-7 h-7 shrink-0" />
                      )}
                      <div className={`w-8 h-8 rounded-md ${f.bgColor} flex items-center justify-center shrink-0`}>
                        <FIcon className={`w-4 h-4 ${f.color}`} />
                      </div>
                      <div className="w-7 h-7 shrink-0" />
                    </div>
                    <div className="flex-1 flex items-center">
                      <p className="text-[11px] font-semibold leading-tight">{f.label}</p>
                    </div>
                    <p className="text-lg font-bold leading-none shrink-0">{f.count}</p>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-5 gap-6 px-4">
          {row2FolderDefs.map(f => {
            const FIcon = f.icon;
            const isActive = activeFolder === f.id;
            return (
              <div key={f.id} data-phase-card={f.id}>
                <Card className={`cursor-pointer transition-colors relative h-[100px] ${isActive ? "border-primary shadow-sm bg-yellow-300/40 dark:bg-yellow-500/25" : "bg-card"}`} onClick={() => onFolderClick(f.id)} data-testid={`folder-tab-${f.id}`}>
                  {f.tooltip && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="absolute top-1 right-1 z-20 rounded-full bg-muted/60 hover:bg-muted p-0.5 transition-colors" onClick={(e) => e.stopPropagation()} data-testid={`help-phase-${f.id}`}>
                          <HelpCircle className="w-3 h-3 text-muted-foreground" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[220px] text-xs">
                        {f.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  )}
                  <div className="flex flex-col items-center p-2 text-center h-full">
                    <div className="flex items-center justify-center gap-1 shrink-0">
                      {[4, 7, 10].includes(f.id) ? (
                        <ArrowUpRight className={`w-7 h-7 shrink-0 fill-current ${f.id === 4 ? 'text-zinc-400' : f.id === 10 ? 'text-emerald-500' : 'text-foreground'}`} strokeWidth={6} />
                      ) : (
                        <div className="w-7 h-7 shrink-0" />
                      )}
                      <div className={`w-8 h-8 rounded-md ${f.bgColor} flex items-center justify-center shrink-0`}>
                        <FIcon className={`w-4 h-4 ${f.color}`} />
                      </div>
                      <div className="w-7 h-7 shrink-0" />
                    </div>
                    <div className="flex-1 flex items-center">
                      <p className="text-[11px] font-semibold leading-tight">{f.label}</p>
                    </div>
                    <p className="text-lg font-bold leading-none shrink-0">{f.count}</p>
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Contracts() {
  const { data: appUser } = useAppUser();
  const activeStateId = appUser?.activeStateId ?? null;
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const isEvidencia = location === "/evidencia-zmluv";

  const { data: migrationModeMainData } = useQuery<{ value: string | null }>({
    queryKey: ["/api/system-settings", "MIGRATION_MODE"],
    queryFn: async () => {
      const res = await fetch("/api/system-settings/MIGRATION_MODE");
      return res.json();
    },
  });
  const isMigrationMode = migrationModeMainData?.value === "ON";

  const columnVisibility = useColumnVisibility("contracts", CONTRACTS_COLUMNS);
  const evidenciaColumnVisibility = useColumnVisibility("contracts-evidencia", CONTRACTS_EVIDENCIA_COLUMNS);
  const sprievodkaColumnVisibility = useColumnVisibility("contracts-sprievodka", CONTRACTS_SPRIEVODKA_COLUMNS);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContract, setDeletingContract] = useState<Contract | null>(null);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  const [filterStatusId, setFilterStatusId] = useState<string>("all");
  const [filterStatusIds, setFilterStatusIds] = useState<number[]>([]);
  const [filterInventoryId, setFilterInventoryId] = useState<string>("all");
  const [filterNeedsManualVerification, setFilterNeedsManualVerification] = useState(false);

  useEffect(() => {
    const search = window.location.search;
    if (!search) {
      setFilterStatusIds([]);
      setFilterNeedsManualVerification(false);
      return;
    }
    const params = new URLSearchParams(search);
    const singleId = params.get("statusId");
    const multiIds = params.get("statusIds");
    const needsManual = params.get("needsManualVerification") === "true";
    setFilterNeedsManualVerification(needsManual);
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
  const [rerouteSelectedIds, setRerouteSelectedIds] = useState<number[]>([]);
  const [rerouteDialogOpen, setRerouteDialogOpen] = useState(false);
  const [rerouteSource, setRerouteSource] = useState<"neprijate" | "archiv" | "spracovanie" | null>(null);

  const [expandedSprievodky, setExpandedSprievodky] = useState<Set<number>>(new Set());
  const [bulkDateDialogOpen, setBulkDateDialogOpen] = useState(false);
  const [bulkDateTarget, setBulkDateTarget] = useState<{ type: "inventory" | "template"; id: number; name: string } | null>(null);
  const [bulkLogisticDate, setBulkLogisticDate] = useState("");
  const [bulkOnlyMissing, setBulkOnlyMissing] = useState(true);
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
  const [preSelectNumberType, setPreSelectNumberType] = useState<"proposal" | "contract">("proposal");
  const [preSelectNumberValue, setPreSelectNumberValue] = useState("");
  const [preSelectTitleBefore, setPreSelectTitleBefore] = useState("");
  const [preSelectFirstName, setPreSelectFirstName] = useState("");
  const [preSelectLastName, setPreSelectLastName] = useState("");
  const [preSelectTitleAfter, setPreSelectTitleAfter] = useState("");
  const [preSelectSaving, setPreSelectSaving] = useState(false);
  const [preSelectSubjectType, setPreSelectSubjectType] = useState<"person" | "company" | "szco">("person");
  const [preSelectIco, setPreSelectIco] = useState("");
  const [preSelectBusinessName, setPreSelectBusinessName] = useState("");
  const [preSelectBirthNumber, setPreSelectBirthNumber] = useState("");
  const [preSelectShowNameFields, setPreSelectShowNameFields] = useState(false);
  const refProductTrigger = useRef<HTMLButtonElement>(null);
  const refStep1Next = useRef<HTMLButtonElement>(null);
  const refSearchInput = useRef<HTMLInputElement>(null);
  const refStep2Confirm = useRef<HTMLButtonElement>(null);
  const refNumberToggleProposal = useRef<HTMLButtonElement>(null);
  const refNumberToggleContract = useRef<HTMLButtonElement>(null);
  const refNumberInput = useRef<HTMLInputElement>(null);
  const refTitleBeforeInput = useRef<HTMLInputElement>(null);
  const refIcoInput = useRef<HTMLInputElement>(null);
  const refBirthNumberInput = useRef<HTMLInputElement>(null);
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

  const PAGE_SIZE = 50;
  const [contractPages, setContractPages] = useState<Contract[]>([]);
  const [contractsTotal, setContractsTotal] = useState(0);
  const [contractsOffset, setContractsOffset] = useState(0);

  const contractsFilterParams = (() => {
    if (isEvidencia) {
      return { unprocessed: "true" } as Record<string, string>;
    }
    const p: Record<string, string> = {};
    if (filterStatusIds.length > 0) {
      p.statusIds = filterStatusIds.join(",");
    } else if (filterStatusId && filterStatusId !== "all") {
      p.statusId = filterStatusId;
    }
    if (filterNeedsManualVerification) p.needsManualVerification = "true";
    if (filterInventoryId && filterInventoryId !== "all") p.inventoryId = filterInventoryId;
    return p;
  })();

  const contractsFilterKey = JSON.stringify(contractsFilterParams);

  useEffect(() => {
    setContractPages([]);
    setContractsTotal(0);
    setContractsOffset(0);
  }, [contractsFilterKey]);

  const contractsQueryKey = ["/api/contracts", contractsFilterParams, contractsOffset];

  const { data: contractsPage, isLoading: isLoadingContracts, isFetching: isFetchingContracts } = useQuery<{ data: Contract[]; total: number; limit: number; offset: number }>({
    queryKey: contractsQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams(contractsFilterParams);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(contractsOffset));
      const res = await fetch(`/api/contracts?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  useEffect(() => {
    if (!contractsPage) return;
    setContractsTotal(contractsPage.total);
    if (contractsOffset === 0) {
      setContractPages(contractsPage.data);
    } else {
      setContractPages(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newContracts = contractsPage.data.filter(c => !existingIds.has(c.id));
        return [...prev, ...newContracts];
      });
    }
  }, [contractsPage, contractsOffset]);

  const isLoading = isLoadingContracts && contractsOffset === 0;
  const isLoadingMore = isFetchingContracts && contractsOffset > 0;
  const contracts = contractPages;
  const hasMoreContracts = contractPages.length < contractsTotal;

  const loadMoreContracts = useCallback(() => {
    setContractsOffset(prev => prev + PAGE_SIZE);
  }, []);

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

  const { data: phase6Contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/by-phase", 6],
    queryFn: async () => {
      const res = await fetch("/api/contracts/by-phase/6", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isEvidencia,
  });

  const { data: phase7Contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/by-phase", 7],
    queryFn: async () => {
      const res = await fetch("/api/contracts/by-phase/7", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isEvidencia,
  });

  const { data: phase8Contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/by-phase", 8],
    queryFn: async () => {
      const res = await fetch("/api/contracts/by-phase/8", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isEvidencia,
  });

  const { data: phase9Contracts = [] } = useQuery<Contract[]>({
    queryKey: ["/api/contracts/by-phase", 9],
    queryFn: async () => {
      const res = await fetch("/api/contracts/by-phase/9", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isEvidencia,
  });

  const phase10Contracts: Contract[] = [];

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

  const activeContracts = contracts?.filter(c => {
    if (c.isDeleted) return false;
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
    setContractPages([]);
    setContractsOffset(0);
    queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/dispatched"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/accepted"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/rejected"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contracts/archived"] });
    queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
    for (let p = 6; p <= 10; p++) {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/by-phase", p] });
    }
    queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 8] });
    queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 9] });
    queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 10] });
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

  const approveSprievodkaMutation = useMutation({
    mutationFn: async ({ inventoryId, contractIds }: { inventoryId: number; contractIds: number[] }) => {
      await apiRequest("POST", `/api/contract-inventories/${inventoryId}/accept`, { contractIds });
    },
    onSuccess: () => {
      invalidateContractCaches();
      toast({ title: "Úspech", description: "Sprievodka schválená a odoslaná do centrály" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa schváliť a odoslať sprievodku", variant: "destructive" }),
  });

  const bulkDateMutation = useMutation({
    mutationFn: async ({ type, id, logisticOperationDate, onlyMissing }: { type: string; id: number; logisticOperationDate: string; onlyMissing: boolean }) => {
      const endpoint = type === "inventory"
        ? `/api/contract-inventories/${id}/bulk-apply-date`
        : `/api/contract-templates/${id}/bulk-apply-date`;
      const res = await apiRequest("POST", endpoint, { logisticDate: logisticOperationDate, onlyMissing });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-templates"] });
      toast({ title: "Dátumy aplikované", description: `Aktualizovaných: ${data.updated || 0} zmlúv` });
      setBulkDateDialogOpen(false);
      setBulkLogisticDate("");
      setBulkDateTarget(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aplikovať dátumy", variant: "destructive" }),
  });

  const lifecyclePhaseMutation = useMutation({
    mutationFn: async ({ contractId, phase, note }: { contractId: number; phase: number; note?: string }) => {
      const res = await apiRequest("PATCH", `/api/contracts/${contractId}/lifecycle-phase`, { phase, note });
      return res.json();
    },
    onSuccess: () => {
      invalidateContractCaches();
      toast({ title: "Fáza aktualizovaná" });
    },
    onError: () => toast({ title: "Chyba pri zmene fázy", variant: "destructive" }),
  });

  const rerouteMutation = useMutation({
    mutationFn: async ({ contractIds, targetPhase, sourceFolder }: { contractIds: number[]; targetPhase: number; sourceFolder: string }) => {
      const res = await apiRequest("POST", "/api/contracts/bulk-reroute", { contractIds, targetPhase, sourceFolder });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
      toast({ title: "Presmerovanie úspešné", description: `Presmerovaných: ${data.rerouted} zmlúv → Sprievodka č. ${data.sequenceNumber}` });
      setRerouteSelectedIds([]);
      setRerouteDialogOpen(false);
      setRerouteSource(null);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa presmerovať zmluvy", variant: "destructive" }),
  });

  const createSprievodkaFromObjMutation = useMutation({
    mutationFn: async (contractIds: number[]) => {
      const res = await apiRequest("POST", "/api/contract-inventories/reroute-objections", { contractIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories/summary"] });
      toast({ title: "Úspech", description: `Vytvorená nová sprievodka č. ${data.sequenceNumber} s ${data.rerouted} zmluvami` });
      setRerouteSelectedIds([]);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť novú sprievodku", variant: "destructive" }),
  });

  const sendToCentralMutation = useMutation({
    mutationFn: async (contractIds: number[]) => {
      const res = await apiRequest("POST", "/api/contracts/send-to-central", { contractIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/contract-inventories/summary"] });
      toast({ title: "Odoslané do centrály", description: `Odoslaných: ${data.sent} zmlúv` });
      setRerouteSelectedIds([]);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa odoslať zmluvy do centrály", variant: "destructive" }),
  });

  const moveToProcessingMutation = useMutation({
    mutationFn: async (contractIds: number[]) => {
      const allPhase5Ids = (activeAccepted || []).map(c => c.id);
      const rejectedIds = allPhase5Ids.filter(id => !contractIds.includes(id));
      const res = await apiRequest("POST", "/api/contracts/move-to-processing", { contractIds, rejectedIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateContractCaches();
      const parts = [`Presunutých: ${data.moved} kontraktov`];
      if (data.rejected > 0) parts.push(`Odmietnutých: ${data.rejected} (výhrady)`);
      toast({ title: "Presun do spracovania", description: parts.join(". ") });
      setRerouteSelectedIds([]);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa presunúť kontrakty do spracovania", variant: "destructive" }),
  });

  const moveToInterventionMutation = useMutation({
    mutationFn: async (contractId: number) => {
      const res = await apiRequest("POST", `/api/contracts/${contractId}/move-to-internal-intervention`);
      return res.json();
    },
    onSuccess: () => {
      invalidateContractCaches();
      toast({ title: "Interná intervencia", description: "Kontrakt bol presunutý do interných intervencií" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa presunúť kontrakt do interných intervencií", variant: "destructive" }),
  });

  const { data: phase8Supisky = [] } = useQuery<any[]>({
    queryKey: ["/api/supisky/by-phase", 8],
    queryFn: async () => {
      const res = await fetch("/api/supisky/by-phase/8", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isEvidencia,
  });

  const { data: phase9Supisky = [] } = useQuery<any[]>({
    queryKey: ["/api/supisky/by-phase", 9],
    queryFn: async () => {
      const res = await fetch("/api/supisky/by-phase/9", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isEvidencia,
  });

  const { data: phase10Supisky = [] } = useQuery<any[]>({
    queryKey: ["/api/supisky/by-phase", 10],
    queryFn: async () => {
      const res = await fetch("/api/supisky/by-phase/10", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isEvidencia,
  });

  const createProcessingSupiskaMutation = useMutation({
    mutationFn: async (contractIds: number[]) => {
      const res = await apiRequest("POST", "/api/contracts/create-processing-supiska", { contractIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 8] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 9] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/by-phase", 8] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/by-phase", 9] });
      toast({ title: "Súpiska vytvorená", description: `Súpiska č. ${data.sequenceNumber} s ${data.moved} kontraktmi` });
      setRerouteSelectedIds([]);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvoriť súpisku", variant: "destructive" }),
  });

  const assignOcrDataMutation = useMutation({
    mutationFn: async (contractIds: number[]) => {
      const res = await apiRequest("POST", "/api/contracts/assign-ocr-data", { contractIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/by-phase", 6] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/by-phase", 8] });
      const moved = data.results?.filter((r: any) => r.movedToPhase8).length || 0;
      toast({ title: "Dátová linka priradená", description: `Priradené OCR dáta k ${data.updated} kontraktom${moved > 0 ? `. ${moved} presunutých do SPRACOVANIE` : ""}` });
      setRerouteSelectedIds([]);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa priradiť OCR dáta", variant: "destructive" }),
  });

  const assignScansMutation = useMutation({
    mutationFn: async (contractIds: number[]) => {
      const res = await apiRequest("POST", "/api/contracts/assign-scans", { contractIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/by-phase", 6] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/by-phase", 8] });
      const moved = data.results?.filter((r: any) => r.movedToPhase8).length || 0;
      toast({ title: "Skeny priradené", description: `Priradené skeny k ${data.updated} kontraktom${moved > 0 ? `. ${moved} presunutých do SPRACOVANIE` : ""}` });
      setRerouteSelectedIds([]);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa priradiť skeny", variant: "destructive" }),
  });

  const manualCompletePhase6Mutation = useMutation({
    mutationFn: async (contractId: number) => {
      const res = await apiRequest("POST", "/api/contracts/manual-complete-phase6", { contractId });
      return res.json();
    },
    onSuccess: () => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/by-phase", 6] });
      queryClient.invalidateQueries({ queryKey: ["/api/contracts/by-phase", 8] });
      toast({ title: "Manuálne dokončené", description: "Kontrakt presunutý do Manuálna kontrola kontraktov" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa dokončiť manuálne", variant: "destructive" }),
  });

  const moveToPhase9Mutation = useMutation({
    mutationFn: async (supiskaId: number) => {
      const res = await apiRequest("POST", `/api/supisky/${supiskaId}/move-to-phase9`);
      return res.json();
    },
    onSuccess: () => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 8] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 9] });
      toast({ title: "Presunuté", description: "Súpiska bola presunutá na odoslanie obchodnému partnerovi" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa presunúť súpisku", variant: "destructive" }),
  });

  const dispatchSupiskaMutation = useMutation({
    mutationFn: async ({ supiskaId, dispatchMethod, dispatchedAt }: { supiskaId: number; dispatchMethod: string; dispatchedAt: string }) => {
      const res = await apiRequest("POST", `/api/supisky/${supiskaId}/dispatch`, { dispatchMethod, dispatchedAt });
      return res.json();
    },
    onSuccess: () => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 8] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 9] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 10] });
      toast({ title: "Odoslané obchodnému partnerovi" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa odoslať súpisku", variant: "destructive" }),
  });

  const receiveSupiskaMutation = useMutation({
    mutationFn: async ({ supiskaId, receivedAt }: { supiskaId: number; receivedAt: string }) => {
      const res = await apiRequest("POST", `/api/supisky/${supiskaId}/receive`, { receivedAt });
      return res.json();
    },
    onSuccess: () => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 9] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 10] });
      toast({ title: "24h odpočet spustený", description: "Sprievodka bude finalizovaná po 24 hodinách" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa potvrdiť prijatie", variant: "destructive" }),
  });

  const removeFromSupiskaMutation = useMutation({
    mutationFn: async ({ supiskaId, contractId }: { supiskaId: number; contractId: number }) => {
      const res = await apiRequest("POST", `/api/supisky/${supiskaId}/remove-contract/${contractId}`);
      return res.json();
    },
    onSuccess: () => {
      invalidateContractCaches();
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 8] });
      queryClient.invalidateQueries({ queryKey: ["/api/supisky/by-phase", 9] });
      toast({ title: "Zmluva vyradená", description: "Zmluva bola vrátená do Manuálna kontrola kontraktov" });
      setRemoveFromSupiskaConfirm(null);
    },
    onError: () => { toast({ title: "Chyba", description: "Nepodarilo sa vyradiť zmluvu zo súpisky", variant: "destructive" }); setRemoveFromSupiskaConfirm(null); },
  });

  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [dispatchSuopiskaId, setDispatchSuopiskaId] = useState<number | null>(null);
  const [dispatchMethod, setDispatchMethod] = useState("");
  const [dispatchDate, setDispatchDate] = useState("");
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [receiveSuopiskaId, setReceiveSuopiskaId] = useState<number | null>(null);
  const [receiveDate, setReceiveDate] = useState("");
  const [removeFromSupiskaConfirm, setRemoveFromSupiskaConfirm] = useState<{ contractId: number; contractNumber: string; supiskaId: number; supName: string } | null>(null);
  const [printedSprievodkyIds, setPrintedSprievodkyIds] = useState<Set<number>>(new Set());

  const REROUTE_CONFIG: Record<string, { targetPhase: number; targetLabel: string }> = {
    neprijate: { targetPhase: 2, targetLabel: "Odoslané na sprievodke (pôvodné ID)" },
    archiv: { targetPhase: 6, targetLabel: "Roztriedenie kontraktov" },
    spracovanie: { targetPhase: 8, targetLabel: "Manuálna kontrola kontraktov" },
    intervencia: { targetPhase: 6, targetLabel: "Roztriedenie kontraktov" },
    dokoncit: { targetPhase: 0, targetLabel: "Dokončené – vypadnutie zo spracovania" },
  };

  function toggleRerouteSelect(id: number) {
    if (activeFolder === 8) {
      setRerouteSelectedIds(prev => {
        if (prev.includes(id)) return prev.filter(x => x !== id);
        if (prev.length >= 25) {
          toast({ title: "Limit dosiahnutý", description: "Na jednu súpisku je možné zaradiť maximálne 25 zmlúv.", variant: "destructive" });
          return prev;
        }
        return [...prev, id];
      });
    } else {
      setRerouteSelectedIds(prev => {
        if (prev.includes(id)) return prev.filter(x => x !== id);
        return [...prev, id];
      });
    }
  }

  function toggleRerouteSelectAll(list: Contract[]) {
    if (activeFolder === 8) {
      if (rerouteSelectedIds.length > 0) {
        setRerouteSelectedIds([]);
      } else {
        const limited = list.slice(0, 25);
        if (list.length > 25) {
          toast({ title: "Limit dosiahnutý", description: `Vybraných prvých 25 z ${list.length} zmlúv. Na jednu súpisku je možné zaradiť maximálne 25 zmlúv.`, variant: "destructive" });
        }
        setRerouteSelectedIds(limited.map(c => c.id));
      }
    } else if (rerouteSelectedIds.length === list.length && list.length > 0) {
      setRerouteSelectedIds([]);
    } else {
      setRerouteSelectedIds(list.map(c => c.id));
    }
  }

  function handleReroute(source: "neprijate" | "archiv" | "spracovanie" | "intervencia" | "dokoncit") {
    setRerouteSource(source);
    setRerouteDialogOpen(true);
  }

  function confirmReroute() {
    if (!rerouteSource || rerouteSelectedIds.length === 0) return;
    const config = REROUTE_CONFIG[rerouteSource];
    rerouteMutation.mutate({
      contractIds: rerouteSelectedIds,
      targetPhase: config.targetPhase,
      sourceFolder: rerouteSource,
    });
  }

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      return [...prev, id];
    });
  }

  async function toggleSelectAll() {
    if (selectedIds.length === activeContracts.length && activeContracts.length === contractsTotal) {
      setSelectedIds([]);
    } else if (hasMoreContracts) {
      try {
        const params = new URLSearchParams(contractsFilterParams);
        params.set("limit", String(contractsTotal));
        params.set("offset", "0");
        const res = await fetch(`/api/contracts?${params.toString()}`, { credentials: "include" });
        if (res.ok) {
          const allData = await res.json();
          setContractPages(allData.data);
          setContractsTotal(allData.total);
          setContractsOffset(allData.total);
          setSelectedIds(allData.data.filter((c: Contract) => !c.isDeleted).map((c: Contract) => c.id));
        }
      } catch {}
    } else {
      setSelectedIds(activeContracts.map(c => c.id));
    }
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


  function getSubjectDisplayName(subjectId: number | null) {
    if (!subjectId) return "-";
    const s = subjects?.find(sub => sub.id === subjectId);
    if (!s) return "-";
    return s.type === "person" ? `${s.firstName} ${s.lastName}` : s.type === "szco" ? `${s.companyName || ""} - ${s.firstName} ${s.lastName}` : (s.companyName || "-");
  }

  function getSubjectDisplay(subjectId: number | null) {
    if (!subjectId) return "-";
    const s = subjects?.find(sub => sub.id === subjectId);
    if (!s) return "-";
    const name = s.type === "person" ? `${s.firstName} ${s.lastName}` : s.type === "szco" ? `${s.companyName || ""} - ${s.firstName} ${s.lastName}` : (s.companyName || "-");
    const eff = (s as any).effectiveListStatus;
    if (!eff) return name;
    return (
      <span className="inline-flex items-center gap-1">
        {name}
        {eff === "cierny" && <Ban className="w-3 h-3 text-red-500 shrink-0" />}
        {eff === "cerveny" && <AlertTriangle className="w-3 h-3 text-orange-500 shrink-0" />}
      </span>
    );
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

  const activeAccepted = acceptedContracts?.filter(c => !c.isDeleted) || [];

  const acceptedBySprievodka = (() => {
    const groups: Record<number, { inventory: ContractInventory | undefined; contracts: Contract[] }> = {};
    const ungrouped: Contract[] = [];
    for (const c of activeAccepted) {
      if (!c.inventoryId) { ungrouped.push(c); continue; }
      if (!groups[c.inventoryId]) {
        groups[c.inventoryId] = {
          inventory: inventories?.find(i => i.id === c.inventoryId),
          contracts: [],
        };
      }
      groups[c.inventoryId].contracts.push(c);
    }
    const result = Object.entries(groups).map(([key, val]) => ({
      inventoryId: Number(key),
      inventory: val.inventory,
      contracts: val.contracts,
    }));
    if (ungrouped.length > 0) {
      result.push({ inventoryId: 0, inventory: undefined, contracts: ungrouped });
    }
    return result;
  })();
  const activeArchived = archivedContracts?.filter(c => !c.isDeleted) || [];
  const activeRejected = rejectedContracts?.filter(c => !c.isDeleted) || [];

  const folderDefs: FolderDef[] = [
    { id: 1, label: "Nahratie a vytvorenie sprievodky", icon: Inbox, color: "text-amber-500", bgColor: "bg-amber-500/15", count: contractsTotal || activeContracts.length, tooltip: "Zmluva bola nahratá do systému a čaká na zaradenie do sprievodky a odoslanie na centrálu partnera." },
    { id: 3, label: "Neprijaté zmluvy – výhrady", icon: XCircle, color: "text-red-500", bgColor: "bg-red-500/15", count: activeRejected.length, tooltip: "Zmluvy, ktoré boli vrátené s výhradami od obchodného partnera alebo centrály. Vyžadujú opravu a opätovné odoslanie." },
    { id: 4, label: "Archív zmlúv (s výhradami)", icon: Archive, color: "text-zinc-400", bgColor: "bg-zinc-400/15", count: activeArchived.length, tooltip: "Archivované zmluvy s výhradami, ktoré neboli opravené alebo boli trvalo zamietnuté." },
    { id: 7, label: "Interné intervencie", icon: AlertTriangle, color: "text-orange-500", bgColor: "bg-orange-500/15", count: phase7Contracts.length, tooltip: "Zmluvy vyžadujúce interný zásah — napr. chýbajúce dokumenty, nezrovnalosti v údajoch alebo eskalácia." },
    { id: 10, label: "🏆 Potvrdiť prijatie obch. partnerom", icon: Award, color: "text-yellow-500", bgColor: "bg-yellow-500/15", count: phase10Supisky.length, tooltip: "Sprievodky odoslané obchodnému partnerovi — čakajú na potvrdenie prijatia." },
  ];

  const row2FolderDefs: FolderDef[] = [
    { id: 2, label: "Odoslať sprievodku do centrály", icon: Send, color: "text-blue-500", bgColor: "bg-blue-500/15", count: activeDispatched.length, tooltip: "Zmluvy zaradené do sprievodky a odoslané do centrály spoločnosti na spracovanie." },
    { id: 5, label: "Odoslané sprievodky a prijatie do centrály", icon: CheckCircle2, color: "text-green-500", bgColor: "bg-green-500/15", count: activeAccepted.length, tooltip: "Zmluvy prijaté centrálou partnera. Čakajú na spracovanie a evidenciu v systéme partnera." },
    { id: 6, label: "Roztriedenie kontraktov", icon: LayoutGrid, color: "text-cyan-500", bgColor: "bg-cyan-500/15", count: phase6Contracts.length, tooltip: "Zmluvy aktívne spracovávané centrálou — kontrola údajov, validácia dokumentov a evidencia." },
    { id: 8, label: "Manuálna kontrola kontraktov", icon: ListChecks, color: "text-emerald-500", bgColor: "bg-emerald-500/15", count: phase8Contracts.length, tooltip: "Zmluvy kompletne spracované a pripravené na odoslanie späť obchodnému partnerovi." },
    { id: 9, label: "Odoslať obchodnému partnerovi", icon: Send, color: "text-indigo-500", bgColor: "bg-indigo-500/15", count: phase9Supisky.reduce((sum: number, s: any) => sum + (s.contracts?.length || 0), 0), tooltip: "Sprievodky pripravené na odoslanie obchodnému partnerovi." },
  ];

  function filterBySearch(list: Contract[]) {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(c =>
      (c.contractNumber || "").toLowerCase().includes(q) ||
      (c.globalNumber ? String(c.globalNumber) : "").includes(q) ||
      getSubjectDisplayName(c.subjectId).toLowerCase().includes(q) ||
      getPartnerName(c).toLowerCase().includes(q) ||
      getProductName(c).toLowerCase().includes(q)
    );
  }

  function renderContractTable(list: Contract[], options?: { showCheckbox?: boolean; showOrder?: boolean; showStatus?: boolean; showRegistration?: boolean; showActions?: boolean; showTimer?: boolean; showRerouteCheckbox?: boolean; checkboxOnly?: boolean; hideContractNumbers?: boolean; sortState?: { sortKey: string | null; sortDirection: "asc" | "desc" | null; requestSort: (key: string) => void } }) {
    const { showCheckbox, showOrder, showStatus, showRegistration, showActions = true, showTimer, showRerouteCheckbox, checkboxOnly, hideContractNumbers, sortState } = options || {};
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
            {showRerouteCheckbox && (
              <TableHead resizable={false} style={{ width: 40, minWidth: 40, maxWidth: 40, padding: '0 8px' }}>
                <Checkbox
                  checked={rerouteSelectedIds.length === list.length && list.length > 0}
                  onCheckedChange={() => toggleRerouteSelectAll(list)}
                  data-testid="checkbox-reroute-select-all"
                />
              </TableHead>
            )}
            {showOrder && <TableHead className="w-[40px] text-center">#</TableHead>}
            {!hideContractNumbers && <TableHead sortKey="contractNumber" sortDirection={sk === "contractNumber" ? sd : null} onSort={rs}>Číslo kontraktu</TableHead>}
            <TableHead sortKey="partnerId" sortDirection={sk === "partnerId" ? sd : null} onSort={rs}>Partner</TableHead>
            <TableHead sortKey="productId" sortDirection={sk === "productId" ? sd : null} onSort={rs}>Produkt</TableHead>
            <TableHead sortKey="proposalNumber" sortDirection={sk === "proposalNumber" ? sd : null} onSort={rs}>Číslo návrhu zmluvy</TableHead>
            {!hideContractNumbers && <TableHead>Číslo zmluvy</TableHead>}
            <TableHead>Typ subjektu</TableHead>
            <TableHead sortKey="subjectId" sortDirection={sk === "subjectId" ? sd : null} onSort={rs}>Subjekt</TableHead>
            {showTimer && <TableHead>Zostáva dní</TableHead>}
            {showActions && <TableHead className="text-right">Akcie</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map(contract => {
            const sub = subjects?.find(s => s.id === contract.subjectId);
            const subjectType = sub?.type === "person" ? "FO" : sub?.type === "szco" ? "SZČO" : sub?.type === "company" ? "PO" : "—";
            const subjectFullName = sub ? [sub.titleBefore, sub.firstName, sub.lastName, sub.titleAfter].filter(Boolean).join(" ") || sub.companyName || "—" : "—";
            return (
              <TableRow key={contract.id} data-testid={`row-evidencia-${contract.id}`} onRowClick={() => { if (checkboxOnly && showRerouteCheckbox) { toggleRerouteSelect(contract.id); } else if (checkboxOnly && showCheckbox) { toggleSelect(contract.id); } else if (!checkboxOnly) { openEdit(contract); } }}>
                {showCheckbox && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(contract.id)}
                      onCheckedChange={() => toggleSelect(contract.id)}
                      data-testid={`checkbox-contract-${contract.id}`}
                    />
                  </TableCell>
                )}
                {showRerouteCheckbox && (
                  <TableCell style={{ width: 40, minWidth: 40, maxWidth: 40, padding: '0 8px' }} onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={rerouteSelectedIds.includes(contract.id)}
                      onCheckedChange={() => toggleRerouteSelect(contract.id)}
                      data-testid={`checkbox-reroute-${contract.id}`}
                    />
                  </TableCell>
                )}
                {showOrder && (
                  <TableCell className="text-center text-xs text-muted-foreground py-1" data-testid={`text-selection-order-${contract.id}`}>
                    {selectedIds.includes(contract.id) ? selectedIds.indexOf(contract.id) + 1 : ""}
                  </TableCell>
                )}
                {!hideContractNumbers && (
                  <TableCell className="font-mono text-sm font-bold text-blue-500 py-1" data-testid={`text-contract-number-${contract.id}`}>
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-amber-500 shrink-0" style={{ display: contract.isLocked ? 'block' : 'none' }} />
                      {contract.contractNumber || "—"}
                      {(contract as any).isFirstContract && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-red-500/40 text-red-400 text-[10px] font-semibold whitespace-nowrap" data-testid={`badge-first-contract-${contract.id}`}>1. ZMLUVA</span>
                      )}
                    </span>
                  </TableCell>
                )}
                <TableCell className="text-sm py-1">{getPartnerName(contract)}</TableCell>
                <TableCell className="text-sm py-1">{getProductName(contract)}</TableCell>
                <TableCell className="text-sm font-mono py-1" data-testid={`text-contract-proposal-${contract.id}`}>{contract.proposalNumber || "—"}</TableCell>
                {!hideContractNumbers && <TableCell className="text-sm font-mono py-1" data-testid={`text-contract-insurancenumber-${contract.id}`}>{contract.insuranceContractNumber || "—"}</TableCell>}
                <TableCell className="text-sm py-1">
                  <Badge variant="outline" className={`text-[10px] ${subjectType === "FO" ? "border-blue-500/50 text-blue-400" : subjectType === "SZČO" ? "border-amber-500/50 text-amber-400" : subjectType === "PO" ? "border-purple-500/50 text-purple-400" : "border-muted text-muted-foreground"}`}>{subjectType}</Badge>
                </TableCell>
                <TableCell className="text-sm py-1" data-testid={`text-subject-name-${contract.id}`}>{subjectFullName}</TableCell>
                {showTimer && <TableCell className="py-1" data-testid={`text-contract-timer-${contract.id}`}>
                  {(() => {
                    const c = contract as any;
                    const limit = c.objectionDaysLimit ?? 100;
                    const enteredAt = c.objectionEnteredAt;
                    if (!enteredAt) return <span className="text-xs text-muted-foreground">-</span>;
                    const daysPassed = Math.floor((Date.now() - new Date(enteredAt).getTime()) / (1000 * 60 * 60 * 24));
                    const remaining = Math.max(0, limit - daysPassed);
                    const isUrgent = remaining <= Math.min(limit * 0.3, 10) || limit <= 30;
                    const isWarning = remaining <= limit * 0.5;
                    return (
                      <span className={`text-xs font-mono font-bold ${isUrgent ? "text-red-500" : isWarning ? "text-amber-500" : "text-green-400"}`}>
                        {remaining > 0 ? `${remaining} dní` : "EXPIROVANÉ"}
                      </span>
                    );
                  })()}
                </TableCell>}
                {showActions && (
                  <TableCell className="text-right py-1">
                    <div className="flex items-center justify-end gap-0.5 flex-nowrap">
                      {contract.lifecyclePhase === 7 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 border-cyan-500 text-cyan-500 hover:bg-cyan-500/10 hover:text-cyan-400"
                          onClick={(e) => { e.stopPropagation(); openEdit(contract); }}
                          data-testid={`button-fix-intervention-${contract.id}`}
                        >
                          <Pencil className="w-3 h-3 mr-1" />
                          <span className="text-[11px]">Opraviť intervenciu</span>
                        </Button>
                      )}
                      {contract.lifecyclePhase === 8 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 border-orange-500 text-orange-500 hover:bg-orange-500/10 hover:text-orange-400"
                          onClick={(e) => { e.stopPropagation(); moveToInterventionMutation.mutate(contract.id); }}
                          disabled={moveToInterventionMutation.isPending}
                          data-testid={`button-internal-intervention-${contract.id}`}
                        >
                          {moveToInterventionMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                          <span className="text-[11px]">Interná intervencia</span>
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openView(contract)} data-testid={`button-view-contract-${contract.id}`}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      {canEditRecords(appUser) && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(contract)} data-testid={`button-edit-contract-${contract.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {canDeleteRecords(appUser) && (contract.lifecyclePhase || 0) < 5 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDelete(contract)} data-testid={`button-delete-contract-${contract.id}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                        </Tooltip>
                      )}
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
    if (preSelectStep === 2) {
      const t = setTimeout(() => refSearchInput.current?.focus(), 150);
      return () => clearTimeout(t);
    }
  }, [preSelectStep]);

  const handlePreSelectStep2Back = () => {
    setPreSelectStep(1);
    setPreSelectSubjectSearch("");
    setPreSelectSubjectId("");
    setPreSelectClientTypeId("");
    setClientTypeSelectOpen(false);
    setPreSelectTitleBefore("");
    setPreSelectFirstName("");
    setPreSelectLastName("");
    setPreSelectTitleAfter("");
    setPreSelectSubjectType("person");
    setPreSelectIco("");
    setPreSelectBusinessName("");
    setPreSelectBirthNumber("");
    setPreSelectShowNameFields(false);
  };

  const preSelectIsValid = (() => {
    if (preSelectSubjectId) return true;
    if (preSelectSubjectType === "person") return !!(preSelectFirstName.trim() && preSelectLastName.trim());
    if (preSelectSubjectType === "szco") return !!(preSelectBusinessName.trim() && preSelectFirstName.trim() && preSelectLastName.trim());
    if (preSelectSubjectType === "company") return !!preSelectBusinessName.trim();
    return false;
  })();

  const handlePreSelectConfirm = async () => {
    if (!preSelectSubjectId && !preSelectIsValid) {
      toast({ title: "Chyba", description: "Vyplnte povinne polia", variant: "destructive" });
      return;
    }
    setPreSelectSaving(true);
    try {
      let finalSubjectId = preSelectSubjectId ? parseInt(preSelectSubjectId) : null;

      if (!finalSubjectId) {
        const subjectData: Record<string, any> = {
          type: preSelectSubjectType,
          firstName: preSelectFirstName.trim() || null,
          lastName: preSelectLastName.trim() || null,
          titleBefore: preSelectTitleBefore.trim() || null,
          titleAfter: preSelectTitleAfter.trim() || null,
        };
        if (preSelectSubjectType === "person" && preSelectBirthNumber.trim()) {
          subjectData.birthNumber = preSelectBirthNumber.trim();
        }
        if (preSelectSubjectType === "szco" || preSelectSubjectType === "company") {
          subjectData.companyName = preSelectBusinessName.trim() || null;
          if (preSelectIco.trim()) {
            subjectData.details = { ico: preSelectIco.trim() };
          }
        }
        const subjectRes = await apiRequest("POST", "/api/subjects", subjectData);
        const newSubject = await subjectRes.json();
        finalSubjectId = newSubject.id;
        queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      }

      const contractData: Record<string, any> = {
        subjectId: finalSubjectId,
        lifecyclePhase: 1,
      };
      if (preSelectPartnerId) contractData.partnerId = parseInt(preSelectPartnerId);
      if (preSelectProductId) contractData.productId = parseInt(preSelectProductId);
      if (preSelectNumberValue.trim()) {
        if (preSelectNumberType === "proposal") {
          contractData.proposalNumber = preSelectNumberValue.trim();
        } else {
          contractData.contractNumber = preSelectNumberValue.trim();
        }
      }

      await apiRequest("POST", "/api/contracts", contractData);
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Uspech", description: "Zmluva zapisana" });

      setPreSelectOpen(false);
      setPreSelectStep(1);
      setPreSelectPartnerId("");
      setPreSelectProductId("");
      setPreSelectSubjectSearch("");
      setPreSelectSubjectId("");
      setPreSelectClientTypeId("");
      setPreSelectNumberType("proposal");
      setPreSelectNumberValue("");
      setPreSelectTitleBefore("");
      setPreSelectFirstName("");
      setPreSelectLastName("");
      setPreSelectTitleAfter("");
      setPreSelectSubjectType("person");
      setPreSelectIco("");
      setPreSelectBusinessName("");
      setPreSelectBirthNumber("");
      setPreSelectShowNameFields(false);
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa zapisat zmluvu", variant: "destructive" });
    } finally {
      setPreSelectSaving(false);
    }
  };

  const handleOpenPreSelect = () => {
    setPreSelectStep(1);
    setPreSelectPartnerId("");
    setPreSelectProductId("");
    setPreSelectSubjectSearch("");
    setPreSelectSubjectId("");
    setPreSelectClientTypeId("");
    setPreSelectNumberType("proposal");
    setPreSelectNumberValue("");
    setPreSelectTitleBefore("");
    setPreSelectFirstName("");
    setPreSelectLastName("");
    setPreSelectTitleAfter("");
    setPreSelectSaving(false);
    setPreSelectSubjectType("person");
    setPreSelectIco("");
    setPreSelectBusinessName("");
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
    <Dialog open={preSelectOpen} onOpenChange={(open) => { setPreSelectOpen(open); if (!open) { setPreSelectStep(1); setPreSelectClientTypeId(""); setPreSelectNumberType("proposal"); setPreSelectNumberValue(""); setPreSelectTitleBefore(""); setPreSelectFirstName(""); setPreSelectLastName(""); setPreSelectTitleAfter(""); setPreSelectSaving(false); setPreSelectSubjectType("person"); setPreSelectIco(""); setPreSelectBusinessName(""); setPreSelectBirthNumber(""); setPreSelectShowNameFields(false); } }}>
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
          <div className="space-y-2">

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
              <Select value={preSelectProductId} onValueChange={(v) => { setPreSelectProductId(v); setTimeout(() => { const ref = preSelectNumberType === "proposal" ? refNumberToggleProposal : refNumberToggleContract; ref.current?.focus(); }, 50); }} disabled={!preSelectPartnerId}>
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

            <div className="space-y-1">
              <label className="text-xs font-medium">Typ cisla</label>
              <div className="flex border rounded-md overflow-hidden" data-testid="toggle-number-type">
                <button
                  ref={refNumberToggleProposal}
                  type="button"
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${preSelectNumberType === "proposal" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                  onClick={() => setPreSelectNumberType("proposal")}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight") { e.preventDefault(); setPreSelectNumberType("contract"); refNumberToggleContract.current?.focus(); }
                    else if (e.key === "Enter") { e.preventDefault(); setTimeout(() => refNumberInput.current?.focus(), 50); }
                  }}
                  data-testid="toggle-number-type-proposal"
                >
                  Cislo navrhu zmluvy
                </button>
                <button
                  ref={refNumberToggleContract}
                  type="button"
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${preSelectNumberType === "contract" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
                  onClick={() => setPreSelectNumberType("contract")}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowLeft") { e.preventDefault(); setPreSelectNumberType("proposal"); refNumberToggleProposal.current?.focus(); }
                    else if (e.key === "Enter") { e.preventDefault(); setTimeout(() => refNumberInput.current?.focus(), 50); }
                  }}
                  data-testid="toggle-number-type-contract"
                >
                  Cislo zmluvy
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">{preSelectNumberType === "proposal" ? "Cislo navrhu zmluvy" : "Cislo zmluvy"}</label>
              <Input
                ref={refNumberInput}
                value={preSelectNumberValue}
                onChange={(e) => setPreSelectNumberValue(e.target.value)}
                placeholder={preSelectNumberType === "proposal" ? "Zadajte cislo navrhu..." : "Zadajte cislo zmluvy..."}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); refStep1Next.current?.focus(); }
                }}
                data-testid="input-preselect-number"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button ref={refStep1Next} onClick={handlePreSelectStep1Next} disabled={!preSelectPartnerId} data-testid="button-preselect-next">
                Dalej
              </Button>
            </div>
          </div>
        </div>

        <div style={{ display: preSelectStep === 2 ? 'block' : 'none' }}>
          <div className="space-y-2">

            {!preSelectSubjectId && (
              <div className="space-y-1">
                <label className="text-xs font-medium">Typ subjektu</label>
                <div className="flex border rounded-md overflow-hidden" data-testid="toggle-subject-type">
                  <button type="button" className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${preSelectSubjectType === "person" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`} onClick={() => { setPreSelectSubjectType("person"); setPreSelectBusinessName(""); setPreSelectIco(""); setPreSelectShowNameFields(false); setPreSelectBirthNumber(""); }} data-testid="toggle-subject-type-fo">FO</button>
                  <button type="button" className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${preSelectSubjectType === "szco" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`} onClick={() => { setPreSelectSubjectType("szco"); setPreSelectShowNameFields(false); setPreSelectBirthNumber(""); }} data-testid="toggle-subject-type-szco">SZČO</button>
                  <button type="button" className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${preSelectSubjectType === "company" ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`} onClick={() => { setPreSelectSubjectType("company"); setPreSelectShowNameFields(false); setPreSelectBirthNumber(""); }} data-testid="toggle-subject-type-po">PO</button>
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium">Vyhladavanie</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={refSearchInput}
                  placeholder={preSelectSubjectType === "person" ? "Rodné číslo / Meno..." : preSelectSubjectType === "szco" ? "Rodné číslo / IČO / Meno..." : "IČO / Názov..."}
                  value={preSelectSubjectSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPreSelectSubjectSearch(val);
                    setPreSelectSubjectId("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Tab" && preSelectSubjectSearch.trim() && preSelectFilteredSubjects.length > 0) {
                      e.preventDefault();
                      const firstRow = document.querySelector('[data-testid^="row-preselect-subject-"]') as HTMLElement;
                      if (firstRow) firstRow.focus();
                    }
                  }}
                  className="pl-9"
                  data-testid="input-preselect-subject-search"
                />
              </div>
            </div>

            <div style={{ display: preSelectSubjectSearch.trim() && preSelectFilteredSubjects.length > 0 ? 'block' : 'none' }}>
              <div className="border rounded-md max-h-[200px] overflow-y-auto" data-testid="list-preselect-subjects">
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
                      tabIndex={0}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 hover-elevate ${isSelected ? "bg-primary/10" : ""} focus:bg-primary/10 focus:outline-none`}
                      onClick={() => {
                        setPreSelectSubjectId(s.id.toString());
                        setPreSelectSubjectType(s.type as "person" | "company" | "szco");
                        setPreSelectTitleBefore((s as any).titleBefore || "");
                        setPreSelectFirstName(s.firstName || "");
                        setPreSelectLastName(s.lastName || "");
                        setPreSelectTitleAfter((s as any).titleAfter || "");
                        setPreSelectBusinessName(s.companyName || "");
                        setPreSelectIco((s.details as any)?.ico || "");
                        setPreSelectBirthNumber(s.birthNumber || "");
                        setPreSelectShowNameFields(true);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" || e.key === "Enter") {
                          e.preventDefault();
                          setPreSelectSubjectId(s.id.toString());
                          setPreSelectSubjectType(s.type as "person" | "company" | "szco");
                          setPreSelectTitleBefore((s as any).titleBefore || "");
                          setPreSelectFirstName(s.firstName || "");
                          setPreSelectLastName(s.lastName || "");
                          setPreSelectTitleAfter((s as any).titleAfter || "");
                          setPreSelectBusinessName(s.companyName || "");
                          setPreSelectIco((s.details as any)?.ico || "");
                          setPreSelectBirthNumber(s.birthNumber || "");
                          setPreSelectShowNameFields(true);
                          setTimeout(() => {
                            const sType = s.type as string;
                            if (sType === "szco" || sType === "company") {
                              const el = document.querySelector('[data-testid="input-preselect-business-name"]') as HTMLElement;
                              if (el) { el.focus(); return; }
                            }
                            const el = document.querySelector('[data-testid="input-preselect-title-before"]') as HTMLElement;
                            if (el) { el.focus(); return; }
                            refStep2Confirm.current?.focus();
                          }, 80);
                        } else if (e.key === "ArrowDown") {
                          e.preventDefault();
                          const next = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                          if (next) next.focus();
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          const prev = (e.currentTarget as HTMLElement).previousElementSibling as HTMLElement;
                          if (prev) prev.focus();
                          else refSearchInput.current?.focus();
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          refSearchInput.current?.focus();
                        }
                      }}
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
                          <span className="font-mono">{formatUid(s.uid)}</span>
                          <span style={{ display: identifier ? 'inline' : 'none' }}>{s.type === "company" ? "ICO" : "RC"}: {identifier}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: preSelectSubjectSearch.trim() && preSelectFilteredSubjects.length === 0 ? 'block' : 'none' }}>
              <p className="text-xs text-muted-foreground mb-2" data-testid="text-no-subjects">Klient nenajdeny — vyplnte udaje noveho klienta</p>
            </div>

            {(preSelectSubjectType === "szco" || preSelectSubjectType === "company") && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">{preSelectSubjectType === "szco" ? "Nazov zivnosti" : "Nazov spolocnosti"} *</label>
                  <Input
                    value={preSelectBusinessName}
                    onChange={(e) => setPreSelectBusinessName(e.target.value)}
                    placeholder={preSelectSubjectType === "szco" ? "Nazov zivnosti" : "Nazov spolocnosti"}
                    readOnly={!!preSelectSubjectId}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const el = document.querySelector('[data-testid="input-preselect-ico"]') as HTMLElement;
                        if (el) el.focus();
                      }
                    }}
                    data-testid="input-preselect-business-name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">ICO</label>
                  <Input
                    ref={refIcoInput}
                    value={preSelectIco}
                    onChange={(e) => setPreSelectIco(e.target.value)}
                    placeholder="ICO"
                    readOnly={!!preSelectSubjectId}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setPreSelectShowNameFields(true);
                        setTimeout(() => refTitleBeforeInput.current?.focus(), 50);
                      }
                    }}
                    data-testid="input-preselect-ico"
                  />
                </div>
              </div>
            )}


            {(preSelectShowNameFields || (preSelectSubjectType === "person" && !preSelectSubjectId)) && (
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Titul pred menom</label>
                  <Input
                    ref={refTitleBeforeInput}
                    value={preSelectTitleBefore}
                    onChange={(e) => setPreSelectTitleBefore(e.target.value)}
                    placeholder="napr. Ing."
                    readOnly={!!preSelectSubjectId}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const el = document.querySelector('[data-testid="input-preselect-first-name"]') as HTMLElement;
                        if (el) el.focus();
                      }
                    }}
                    data-testid="input-preselect-title-before"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Meno {(preSelectSubjectType === "person" || preSelectSubjectType === "szco") && "*"}</label>
                  <Input
                    value={preSelectFirstName}
                    onChange={(e) => setPreSelectFirstName(e.target.value)}
                    placeholder="Meno"
                    readOnly={!!preSelectSubjectId}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const el = document.querySelector('[data-testid="input-preselect-last-name"]') as HTMLElement;
                        if (el) el.focus();
                      }
                    }}
                    data-testid="input-preselect-first-name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Priezvisko {(preSelectSubjectType === "person" || preSelectSubjectType === "szco") && "*"}</label>
                  <Input
                    value={preSelectLastName}
                    onChange={(e) => setPreSelectLastName(e.target.value)}
                    placeholder="Priezvisko"
                    readOnly={!!preSelectSubjectId}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const el = document.querySelector('[data-testid="input-preselect-title-after"]') as HTMLElement;
                        if (el) el.focus();
                      }
                    }}
                    data-testid="input-preselect-last-name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Titul za menom</label>
                  <Input
                    value={preSelectTitleAfter}
                    onChange={(e) => setPreSelectTitleAfter(e.target.value)}
                    placeholder="napr. PhD."
                    readOnly={!!preSelectSubjectId}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        refStep2Confirm.current?.focus();
                      }
                    }}
                    data-testid="input-preselect-title-after"
                  />
                </div>
              </div>
            )}

            {preSelectSubjectId && (
              <p className="text-xs text-muted-foreground">Vybrany existujuci klient ({preSelectSubjectType === "person" ? "FO" : preSelectSubjectType === "szco" ? "SZČO" : "PO"}) — polia su len na citanie. <button type="button" className="text-primary underline" onClick={() => { setPreSelectSubjectId(""); setPreSelectSubjectType("person"); setPreSelectTitleBefore(""); setPreSelectFirstName(""); setPreSelectLastName(""); setPreSelectTitleAfter(""); setPreSelectBusinessName(""); setPreSelectIco(""); setPreSelectBirthNumber(""); setPreSelectShowNameFields(false); }} data-testid="button-deselect-subject">Zrusit vyber</button></p>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" tabIndex={2} onClick={handlePreSelectStep2Back} data-testid="button-preselect-back">
                Spat
              </Button>
              <Button ref={refStep2Confirm} tabIndex={0} onClick={handlePreSelectConfirm} disabled={!preSelectIsValid || preSelectSaving} data-testid="button-preselect-confirm">
                {preSelectSaving ? "Zapisujem..." : "Zapisat zmluvu"}
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
            {canCreateRecords(appUser) && (
              <>
                <Button variant="outline" onClick={() => { setImportFile(null); setImportResult(null); setImportDialogOpen(true); }} data-testid="button-import-excel">
                  <Upload className="w-4 h-4 mr-2" />
                  Import z Excelu
                </Button>
                <Button onClick={handleOpenPreSelect} data-testid="button-create-contract">
                  <Plus className="w-4 h-4 mr-2" />
                  Pridat zmluvu
                </Button>
              </>
            )}
          </div>
        </div>

        <WorkflowDiagram
          folderDefs={folderDefs}
          row2FolderDefs={row2FolderDefs}
          activeFolder={activeFolder}
          onFolderClick={(id: number) => { setActiveFolder(id); setRerouteSelectedIds([]); }}
        />

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
                <p className="text-xs text-muted-foreground" data-testid="text-contracts-counter">
                  Zobrazených <span className="font-semibold text-foreground">{contracts.length}</span> z celkového počtu <span className="font-semibold text-foreground">{contractsTotal}</span> zmlúv
                </p>
                <p className="text-xs text-red-400 italic" data-testid="text-ordering-note">Poznamka: Zmluvy budu na sprievodke zoradene podla poradia, v akom ich oznacite.</p>
              </div>
              <span id="selected-dispatch-wrapper" style={{ display: selectedIds.length > 0 ? 'inline' : 'none' }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted-foreground">Vybranych: <span className="font-semibold text-foreground">{selectedIds.length}</span></span>
                  <Button size="sm" onClick={() => setSprievodkaDialogOpen(true)} data-testid="button-dispatch">
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Vytvoriť sprievodku
                  </Button>
                </div>
              </span>
            </div>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredNahravanie.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-nahravanie">Ziadne zmluvy na nahravanie</p>
              ) : (
                <>
                  {renderContractTable(sortedNahravanie, { showCheckbox: true, showOrder: true, checkboxOnly: true, hideContractNumbers: true, sortState: { sortKey: skNahr, sortDirection: sdNahr, requestSort: rsNahr } })}
                  {hasMoreContracts && (
                    <div className="flex items-center justify-center py-4 border-t">
                      <Button variant="outline" size="sm" onClick={loadMoreContracts} disabled={isLoadingMore} data-testid="button-load-more">
                        {isLoadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        Načítať ďalšie ({contracts.length} / {contractsTotal})
                      </Button>
                    </div>
                  )}
                </>
              )}
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
                            {group.inventory?.name || `Sprievodka ${group.inventoryId}`}
                            {group.inventory?.logisticOperationDate && (
                              <span className="ml-2 text-xs text-muted-foreground font-normal">
                                ({formatDateSlovak(group.inventory.logisticOperationDate)})
                              </span>
                            )}
                          </span>
                          <Badge variant="outline" data-testid={`badge-sprievodka-count-${group.inventoryId}`}>
                            {group.contracts.length} {group.contracts.length === 1 ? "zmluva" : group.contracts.length < 5 ? "zmluvy" : "zmluv"}
                          </Badge>
                          {isMigrationMode && (
                            <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-400 hover:bg-purple-950/20" onClick={(e) => {
                              e.stopPropagation();
                              setBulkDateTarget({ type: "inventory", id: group.inventoryId, name: group.inventory?.name || `Sprievodka ${group.inventoryId}` });
                              setBulkLogisticDate(group.inventory?.logisticOperationDate ? new Date(group.inventory.logisticOperationDate).toISOString().split("T")[0] : "");
                              setBulkDateDialogOpen(true);
                            }} data-testid={`button-bulk-dates-sprievodka-${group.inventoryId}`}>
                              <Ghost className="w-3.5 h-3.5 mr-1.5" />
                              Hromadné dátumy
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); }} data-testid={`button-print-sprievodka-${group.inventoryId}`}>
                            <Printer className="w-3.5 h-3.5 mr-1.5" />
                            Tlačiť sprievodku
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={approveSprievodkaMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              const allIds = group.contracts.map(c => c.id);
                              approveSprievodkaMutation.mutate({ inventoryId: group.inventoryId, contractIds: allIds });
                            }}
                            data-testid={`button-approve-sprievodka-${group.inventoryId}`}
                          >
                            {approveSprievodkaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                            Schváliť a odoslať sprievodku do centrály
                          </Button>
                        </div>
                        <div id={`expanded-wrapper-${group.inventoryId}`} style={{ display: isExpanded ? 'block' : 'none' }}>
                          <div className="border-t">
                            <Table>
                              <TableHeader>
                                <TableRow>
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
                                  <TableRow key={contract.id} data-testid={`row-cakajuce-${contract.id}`}>
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
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">Zmluvy, ktore neboli zaskrtnute pri prijati sprievodky, pretože v nej neboli.</p>
            </div>
            {activeRejected.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] text-amber-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Dynamický timer: Lehota výhrady závisí od nastavenia produktu. Zmluvy po uplynutí lehoty budú automaticky archivované.</span>
              </div>
            )}
            {rerouteSelectedIds.length > 0 && activeFolder === 3 && (
              <div className="flex items-center justify-between gap-2 p-3 border-b bg-blue-500/10 flex-wrap">
                <span className="text-sm text-muted-foreground">Vybraných zmlúv: <span className="font-bold text-foreground">{rerouteSelectedIds.length}</span></span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    disabled={createSprievodkaFromObjMutation.isPending}
                    onClick={() => createSprievodkaFromObjMutation.mutate(rerouteSelectedIds)}
                    data-testid="button-create-sprievodka-from-objections"
                  >
                    {createSprievodkaFromObjMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4 mr-2" />
                    )}
                    Vytvoriť novú sprievodku z výhrad ({rerouteSelectedIds.length})
                  </Button>
                  <Button
                    variant="default"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    disabled={sendToCentralMutation.isPending}
                    onClick={() => sendToCentralMutation.mutate(rerouteSelectedIds)}
                    data-testid="button-send-to-central"
                  >
                    {sendToCentralMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Schváliť a odoslať sprievodku do centrály ({rerouteSelectedIds.length})
                  </Button>
                </div>
              </div>
            )}
            <CardContent className="p-0">
              {isLoadingRejected ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredRejected.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-neprijate">Ziadne neprijate zmluvy</p>
              ) : renderContractTable(sortedRejected, { showStatus: true, showRegistration: true, showActions: true, showTimer: true, showRerouteCheckbox: true, sortState: { sortKey: skRej, sortDirection: sdRej, requestSort: rsRej } })}
            </CardContent>
          </Card>
        </div>

        <div id="folder-4-wrapper" style={{ display: activeFolder === 4 ? 'block' : 'none' }}>
          <Card data-testid="folder-archiv">
            <div className="flex items-center gap-3 p-3 border-b">
              <Archive className="w-4 h-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">Neprijaté zmluvy po uplynutí lehoty výhrady (podľa produktu).</p>
            </div>
            <CardContent className="p-0">
              {isLoadingArchived ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredArchived.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-archiv">Ziadne archivovane zmluvy</p>
              ) : renderContractTable(sortedArchived, { showStatus: true, showRegistration: true, showActions: false, showRerouteCheckbox: true, sortState: { sortKey: skArch, sortDirection: sdArch, requestSort: rsArch } })}
            </CardContent>
            {rerouteSelectedIds.length > 0 && activeFolder === 4 && (
              <div className="flex items-center justify-between p-3 border-t bg-cyan-500/5">
                <span className="text-sm text-muted-foreground">Vybraných zmlúv: <span className="font-bold text-foreground">{rerouteSelectedIds.length}</span></span>
                <Button variant="default" className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => handleReroute("archiv")} data-testid="button-reroute-archiv">
                  <Send className="w-4 h-4 mr-2" />Odoslať do spracovania
                </Button>
              </div>
            )}
          </Card>
        </div>

        <div id="folder-5-wrapper" style={{ display: activeFolder === 5 ? 'block' : 'none' }}>
          <Card data-testid="folder-prijate-centrala">
            <div className="flex items-center gap-3 p-3 border-b flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              <p className="text-xs text-muted-foreground flex-1">Zmluvy prijaté do centrály. Tu sa zo zmluvy stáva kontrakt.</p>
              {rerouteSelectedIds.length > 0 && activeFolder === 5 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Vybraných: <span className="font-bold text-foreground">{rerouteSelectedIds.length}</span></span>
                  <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => moveToProcessingMutation.mutate(rerouteSelectedIds)} disabled={moveToProcessingMutation.isPending} data-testid="button-move-to-processing">
                    {moveToProcessingMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <span className="mr-1.5">📋</span>}
                    Potvrď zmluvy na sprievodke a daj roztriediť ({rerouteSelectedIds.length})
                  </Button>
                </div>
              )}
            </div>
            <CardContent className="p-0">
              {isLoadingAccepted ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : acceptedBySprievodka.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-prijate">Žiadne zmluvy prijaté do centrály</p>
              ) : (
                <div className="divide-y">
                  {acceptedBySprievodka.map(group => {
                    const isExpanded = expandedSprievodky.has(group.inventoryId + 200000);
                    return (
                      <div key={group.inventoryId} data-testid={`accepted-sprievodka-group-${group.inventoryId}`}>
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer hover-elevate flex-wrap"
                          onClick={() => toggleSprievodkaExpanded(group.inventoryId + 200000)}
                          data-testid={`button-toggle-accepted-sprievodka-${group.inventoryId}`}
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                          <FileText className="w-4 h-4 text-green-500 shrink-0" />
                          <span className="text-sm font-medium flex-1" data-testid={`text-accepted-sprievodka-name-${group.inventoryId}`}>
                            {group.inventory?.name || (group.inventoryId === 0 ? "Bez sprievodky" : `Sprievodka ${group.inventoryId}`)}
                            {group.inventory?.logisticOperationDate && (
                              <span className="ml-2 text-xs text-muted-foreground font-normal">
                                ({formatDateSlovak(group.inventory.logisticOperationDate)})
                              </span>
                            )}
                          </span>
                          <Badge variant="outline" data-testid={`badge-accepted-sprievodka-count-${group.inventoryId}`}>
                            {group.contracts.length} {group.contracts.length === 1 ? "zmluva" : group.contracts.length < 5 ? "zmluvy" : "zmluv"}
                          </Badge>
                        </div>
                        <div style={{ display: isExpanded ? 'block' : 'none' }}>
                          <div className="border-t">
                            {renderContractTable(group.contracts, { showStatus: true, showRegistration: true, showActions: true, showRerouteCheckbox: true, checkboxOnly: true })}
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

        {(() => {
          const phaseLabels: Record<number, string> = {
            6: "Prebieha skenovanie a OCR extrakcia. Dopĺňajú sa chýbajúce parametre.",
            7: "Chýba údaj (napr. kópia OP). Kontrakt je blokovaný pre súpisky.",
            8: "Kontrakt je čistý a validovaný. Čaká na hromadné odoslanie partnerovi.",
            9: "Zmluvy fyzicky odoslané obchodnému partnerovi. Čakajú na potvrdenie doručenia.",
            10: "Doručené partnerovi. Doplní sa dátum prijatia partnerom. Kontrakt definitívne vypadáva z dashboardu.",
          };
          return [6, 7, 8, 9, 10].map(phaseId => {
            const phaseContracts = phaseId === 6 ? phase6Contracts : phaseId === 7 ? phase7Contracts : phaseId === 8 ? phase8Contracts : phaseId === 9 ? phase9Contracts : phase10Contracts;
            const phaseDef = row2FolderDefs.find(f => f.id === phaseId) || folderDefs.find(f => f.id === phaseId);
            const showCheckbox = [6, 7].includes(phaseId);
            const isGroupedPhase = [8, 9, 10].includes(phaseId);
            const supiskyForPhase = phaseId === 8 ? phase8Supisky : phaseId === 9 ? phase9Supisky : phaseId === 10 ? phase10Supisky : [];

            return (
              <div key={phaseId} id={`folder-${phaseId}-wrapper`} style={{ display: activeFolder === phaseId ? 'block' : 'none' }}>
                <Card data-testid={`folder-phase-${phaseId}`}>
                  <div className="flex items-center gap-3 p-3 border-b flex-wrap">
                    {phaseDef && (() => { const I = phaseDef.icon; return <I className={`w-4 h-4 ${phaseDef.color} shrink-0`} />; })()}
                    <p className="text-xs text-muted-foreground flex-1">{phaseLabels[phaseId]}</p>
                    {phaseId === 8 && rerouteSelectedIds.length > 0 && activeFolder === 8 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Vybraných: <span className="font-bold text-foreground">{rerouteSelectedIds.length}/25</span></span>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => createProcessingSupiskaMutation.mutate(rerouteSelectedIds)} disabled={createProcessingSupiskaMutation.isPending} data-testid="button-create-supiska">
                          {createProcessingSupiskaMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5 mr-1.5" />}
                          Vytvoriť súpisku ({rerouteSelectedIds.length}/25)
                        </Button>
                      </div>
                    )}
                    {phaseId === 6 && rerouteSelectedIds.length > 0 && activeFolder === 6 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Vybraných: <span className="font-bold text-foreground">{rerouteSelectedIds.length}</span></span>
                        <Button size="sm" className="bg-cyan-600 hover:bg-cyan-700 text-white" onClick={() => assignOcrDataMutation.mutate(rerouteSelectedIds)} disabled={assignOcrDataMutation.isPending} data-testid="button-assign-ocr">
                          {assignOcrDataMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ScanLine className="w-3.5 h-3.5 mr-1.5" />}
                          Priradiť ku skenom — dátová linka
                        </Button>
                        <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white" onClick={() => assignScansMutation.mutate(rerouteSelectedIds)} disabled={assignScansMutation.isPending} data-testid="button-assign-scans">
                          {assignScansMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />}
                          Manuálne nahrať skeny
                        </Button>
                      </div>
                    )}
                    {phaseId === 7 && rerouteSelectedIds.length > 0 && activeFolder === 7 && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Vybraných: <span className="font-bold text-foreground">{rerouteSelectedIds.length}</span></span>
                        <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleReroute("intervencia")} data-testid="button-reroute-intervencia">
                          <ArrowRight className="w-3.5 h-3.5 mr-1.5" />Vrátiť do spracovania ({rerouteSelectedIds.length})
                        </Button>
                      </div>
                    )}
                    
                  </div>
                  <CardContent className="p-0">
                    {phaseId === 6 ? (
                      phaseContracts.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-phase-6">Žiadne kontrakty v tejto fáze</p>
                      ) : (() => {
                        const groups = new Map<string, Contract[]>();
                        phaseContracts.forEach(c => {
                          const partnerName = partners?.find(p => p.id === c.partnerId)?.name || "Neznámy partner";
                          const productName = products?.find(p => p.id === c.productId)?.name || allSectorProducts?.find(sp => sp.id === c.sectorProductId)?.name || "Neznámy produkt";
                          const key = `${partnerName} - ${productName}`;
                          if (!groups.has(key)) groups.set(key, []);
                          groups.get(key)!.push(c);
                        });
                        const sortedGroups = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "sk"));
                        return (
                          <div className="divide-y">
                            {sortedGroups.map(([groupName, groupContracts]) => {
                              const toggleKey = 300000 + Array.from(groups.keys()).indexOf(groupName);
                              const isGroupExpanded = expandedSprievodky.has(toggleKey);
                              return (
                                <div key={groupName}>
                                  <div
                                    className="flex items-center gap-3 p-3 cursor-pointer hover-elevate flex-wrap"
                                    onClick={() => toggleSprievodkaExpanded(toggleKey)}
                                    data-testid={`button-toggle-group-${groupName.replace(/\s/g, '-')}`}
                                  >
                                    {isGroupExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                                    <LayoutGrid className="w-4 h-4 text-cyan-500 shrink-0" />
                                    <span className="text-sm font-medium flex-1">{groupName}</span>
                                    <Badge variant="outline" className="text-xs">{groupContracts.length} {groupContracts.length === 1 ? "zmluva" : groupContracts.length < 5 ? "zmluvy" : "zmluv"}</Badge>
                                  </div>
                                  <div style={{ display: isGroupExpanded ? 'block' : 'none' }}>
                                    <div className="border-t">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="border-b bg-muted/30">
                                            <th className="p-2 w-8">
                                              <Checkbox
                                                checked={groupContracts.every(c => rerouteSelectedIds.includes(c.id)) && groupContracts.length > 0}
                                                onCheckedChange={() => {
                                                  const allSelected = groupContracts.every(c => rerouteSelectedIds.includes(c.id));
                                                  if (allSelected) {
                                                    setRerouteSelectedIds(prev => prev.filter(id => !groupContracts.find(c => c.id === id)));
                                                  } else {
                                                    setRerouteSelectedIds(prev => [...new Set([...prev, ...groupContracts.map(c => c.id)])]);
                                                  }
                                                }}
                                                data-testid={`checkbox-group-select-all-${groupName.replace(/\s/g, '-')}`}
                                              />
                                            </th>
                                            <th className="p-2 text-left font-medium text-muted-foreground">Číslo kontraktu</th>
                                            <th className="p-2 text-left font-medium text-muted-foreground">Partner</th>
                                            <th className="p-2 text-left font-medium text-muted-foreground">Produkt</th>
                                            <th className="p-2 text-left font-medium text-muted-foreground">Číslo návrhu zmluvy</th>
                                            <th className="p-2 text-left font-medium text-muted-foreground">Číslo zmluvy</th>
                                            <th className="p-2 text-left font-medium text-muted-foreground">Typ subjektu</th>
                                            <th className="p-2 text-left font-medium text-muted-foreground">Subjekt</th>
                                            <th className="p-2 text-center font-medium text-muted-foreground">OCR</th>
                                            <th className="p-2 text-center font-medium text-muted-foreground">Skeny</th>
                                            <th className="p-2 text-right font-medium text-muted-foreground">Akcie</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {groupContracts.map(contract => {
                                            const hasOcr = (contract as any).ocrDataAssigned === true;
                                            const hasScans = (contract as any).scansUploaded === true;
                                            const isPartial = hasOcr || hasScans;
                                            const rowBg = isPartial ? "bg-orange-500/10" : "";
                                            const sub6 = subjects?.find(s => s.id === contract.subjectId);
                                            const subType6 = sub6?.type === "person" ? "FO" : sub6?.type === "szco" ? "SZČO" : sub6?.type === "company" ? "PO" : "—";
                                            const subName6 = sub6 ? [sub6.titleBefore, sub6.firstName, sub6.lastName, sub6.titleAfter].filter(Boolean).join(" ") || sub6.companyName || "—" : "—";
                                            return (
                                              <tr key={contract.id} className={`border-b hover:bg-muted/20 ${rowBg}`} data-testid={`row-phase6-contract-${contract.id}`}>
                                                <td className="p-2">
                                                  <Checkbox
                                                    checked={rerouteSelectedIds.includes(contract.id)}
                                                    onCheckedChange={() => toggleRerouteSelect(contract.id)}
                                                    data-testid={`checkbox-phase6-${contract.id}`}
                                                  />
                                                </td>
                                                <td className="p-2 font-mono text-blue-500 font-bold">{contract.contractNumber || "—"}</td>
                                                <td className="p-2">{getPartnerName(contract)}</td>
                                                <td className="p-2">{getProductName(contract)}</td>
                                                <td className="p-2 font-mono">{contract.proposalNumber || "—"}</td>
                                                <td className="p-2 font-mono">{contract.insuranceContractNumber || "—"}</td>
                                                <td className="p-2">
                                                  <Badge variant="outline" className={`text-[10px] ${subType6 === "FO" ? "border-blue-500/50 text-blue-400" : subType6 === "SZČO" ? "border-amber-500/50 text-amber-400" : subType6 === "PO" ? "border-purple-500/50 text-purple-400" : "border-muted text-muted-foreground"}`}>{subType6}</Badge>
                                                </td>
                                                <td className="p-2">{subName6}</td>
                                                <td className="p-2 text-center">
                                                  {hasOcr ? <Check className="w-4 h-4 text-green-500 inline" /> : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="p-2 text-center">
                                                  {hasScans ? <Check className="w-4 h-4 text-green-500 inline" /> : <span className="text-muted-foreground">—</span>}
                                                </td>
                                                <td className="p-2 text-right">
                                                  {!hasOcr && !hasScans && (
                                                    <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => manualCompletePhase6Mutation.mutate(contract.id)} disabled={manualCompletePhase6Mutation.isPending} data-testid={`button-manual-complete-${contract.id}`}>
                                                      <Upload className="w-3 h-3 mr-1" />Manuálne nahrať
                                                    </Button>
                                                  )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()
                    ) : isGroupedPhase ? (
                      (() => {
                        const supiskaContractIds = new Set(supiskyForPhase.flatMap((s: any) => (s.contracts || []).map((c: any) => c.id)));
                        const looseContracts = phaseId === 8 ? phaseContracts.filter(c => !supiskaContractIds.has(c.id) && !c.lockedBySupiskaId) : [];
                        const hasContent = supiskyForPhase.length > 0 || looseContracts.length > 0;
                        if (!hasContent) return (
                          <p className="text-sm text-muted-foreground text-center py-8" data-testid={`text-no-phase-${phaseId}`}>Žiadne kontrakty v tejto fáze</p>
                        );
                        return (
                        <div className="divide-y">
                          {looseContracts.length > 0 && (
                            <div>
                              <div className="flex items-center gap-3 p-3 border-b bg-emerald-500/5">
                                <ListChecks className="w-4 h-4 text-emerald-500 shrink-0" />
                                <span className="text-sm font-medium flex-1">Nezaradené kontrakty</span>
                                <Badge variant="outline" className="text-xs">{looseContracts.length} {looseContracts.length === 1 ? "zmluva" : looseContracts.length < 5 ? "zmluvy" : "zmluv"}</Badge>
                              </div>
                              {renderContractTable(looseContracts, { showStatus: true, showRegistration: true, showActions: true, showRerouteCheckbox: true })}
                            </div>
                          )}
                          {supiskyForPhase.map((sup: any) => {
                            const isSupExpanded = expandedSprievodky.has(sup.id + 100000);
                            return (
                              <div key={sup.id}>
                                <div
                                  className="flex items-center gap-3 p-3 cursor-pointer hover-elevate flex-wrap"
                                  onClick={() => toggleSprievodkaExpanded(sup.id + 100000)}
                                  data-testid={`button-toggle-supiska-${sup.id}`}
                                >
                                  {isSupExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                                  <ListChecks className="w-4 h-4 text-muted-foreground shrink-0" />
                                  <span className="text-sm font-medium flex-1" data-testid={`text-supiska-name-${sup.id}`}>{sup.name}</span>
                                  <Badge variant="outline" className="text-xs">{sup.contracts?.length || 0} kontraktov</Badge>
                                  {phaseId === 8 && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                      onClick={(e) => { e.stopPropagation(); moveToPhase9Mutation.mutate(sup.id); }}
                                      disabled={moveToPhase9Mutation.isPending}
                                      data-testid={`button-move-phase9-${sup.id}`}
                                    >
                                      {moveToPhase9Mutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <ArrowRight className="w-3 h-3 mr-1" />}
                                      Presunúť na odoslanie
                                    </Button>
                                  )}
                                  {phaseId === 9 && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className={`${!printedSprievodkyIds.has(sup.id) ? "animate-pulse border-amber-500 text-amber-500 hover:bg-amber-500/10" : "border-green-500 text-green-500"}`}
                                        onClick={(e) => { e.stopPropagation(); setPrintedSprievodkyIds(prev => new Set([...prev, sup.id])); window.print(); }}
                                        data-testid={`button-print-supiska-phase9-${sup.id}`}
                                      >
                                        <Printer className="w-3 h-3 mr-1" />Vytlačiť súpisku
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                        onClick={(e) => { e.stopPropagation(); setDispatchSuopiskaId(sup.id); setDispatchMethod(""); setDispatchDate(""); setDispatchDialogOpen(true); }}
                                        data-testid={`button-dispatch-supiska-${sup.id}`}
                                      >
                                        <Send className="w-3 h-3 mr-1" />Odoslať obchodnému partnerovi
                                      </Button>
                                    </>
                                  )}
                                  {phaseId === 10 && sup.status === "Odoslana" && (
                                    <Button
                                      size="sm"
                                      variant="default"
                                      className="bg-purple-600 hover:bg-purple-700 text-white"
                                      onClick={(e) => { e.stopPropagation(); setReceiveSuopiskaId(sup.id); setReceiveDate(""); setReceiveDialogOpen(true); }}
                                      data-testid={`button-receive-supiska-${sup.id}`}
                                    >
                                      <Award className="w-3 h-3 mr-1" />Potvrdiť prijatie
                                    </Button>
                                  )}
                                  {phaseId === 10 && sup.status === "Odpocet" && sup.receivedByPartnerAt && (
                                    <SupiskaCountdownButton
                                      receivedAt={sup.receivedByPartnerAt}
                                      onEdit={(e) => { e.stopPropagation(); setReceiveSuopiskaId(sup.id); setReceiveDate(""); setReceiveDialogOpen(true); }}
                                      supiskaId={sup.id}
                                    />
                                  )}
                                </div>
                                <div style={{ display: isSupExpanded ? 'block' : 'none' }}>
                                  {(sup.dispatchMethod || sup.receivedByPartnerAt) && (
                                    <div className="flex items-center gap-3 px-3 pb-2 text-xs text-muted-foreground flex-wrap">
                                      {sup.dispatchMethod && <span>Spôsob: <span className="font-medium text-foreground">{sup.dispatchMethod}</span></span>}
                                      {sup.dispatchedAt && <span>Odoslané: <span className="font-medium text-foreground">{formatDateSlovak(sup.dispatchedAt)}</span></span>}
                                      {sup.receivedByPartnerAt && <span>Prijaté: <span className="font-medium text-foreground">{formatDateSlovak(sup.receivedByPartnerAt)}</span></span>}
                                    </div>
                                  )}
                                  {sup.contracts && sup.contracts.length > 0 && (
                                    phaseId === 9 ? (
                                      <Table>
                                        <TableHeader>
                                          <TableRow>
                                            <TableHead resizable={false} style={{ width: 40, minWidth: 40, maxWidth: 40, padding: '0 8px' }}></TableHead>
                                            {evidenciaColumnVisibility.isVisible("contractNumber") && <TableHead>Číslo zmluvy</TableHead>}
                                            {evidenciaColumnVisibility.isVisible("proposalNumber") && <TableHead>Číslo návrhu</TableHead>}
                                            {evidenciaColumnVisibility.isVisible("subjectId") && <TableHead>Klient</TableHead>}
                                            {evidenciaColumnVisibility.isVisible("partnerId") && <TableHead>Partner</TableHead>}
                                            {evidenciaColumnVisibility.isVisible("productId") && <TableHead>Produkt</TableHead>}
                                          </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                          {sup.contracts.map((contract: Contract) => (
                                            <TableRow key={contract.id} data-testid={`row-phase9-${contract.id}`}>
                                              <TableCell style={{ width: 40, minWidth: 40, maxWidth: 40, padding: '0 8px' }} onClick={e => e.stopPropagation()}>
                                                <Checkbox
                                                  checked={true}
                                                  onCheckedChange={() => {
                                                    setRemoveFromSupiskaConfirm({
                                                      contractId: contract.id,
                                                      contractNumber: contract.contractNumber || contract.proposalNumber || `ID ${contract.id}`,
                                                      supiskaId: sup.id,
                                                      supName: sup.name,
                                                    });
                                                  }}
                                                  data-testid={`checkbox-phase9-${contract.id}`}
                                                />
                                              </TableCell>
                                              {evidenciaColumnVisibility.isVisible("contractNumber") && <TableCell className="font-mono text-sm">{contract.contractNumber || "-"}</TableCell>}
                                              {evidenciaColumnVisibility.isVisible("proposalNumber") && <TableCell className="text-sm font-mono">{contract.proposalNumber || "-"}</TableCell>}
                                              {evidenciaColumnVisibility.isVisible("subjectId") && <TableCell className="text-sm">{getSubjectDisplay(contract.subjectId)}</TableCell>}
                                              {evidenciaColumnVisibility.isVisible("partnerId") && <TableCell className="text-sm">{getPartnerName(contract)}</TableCell>}
                                              {evidenciaColumnVisibility.isVisible("productId") && <TableCell className="text-sm">{getProductName(contract)}</TableCell>}
                                            </TableRow>
                                          ))}
                                        </TableBody>
                                      </Table>
                                    ) : renderContractTable(sup.contracts, { showStatus: true, showRegistration: true, showActions: true })
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        );
                      })()
                    ) : (
                      <>
                        {phaseContracts.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-8" data-testid={`text-no-phase-${phaseId}`}>Žiadne kontrakty v tejto fáze</p>
                        ) : renderContractTable(phaseContracts, { showStatus: true, showRegistration: true, showActions: true, showRerouteCheckbox: showCheckbox })}
                      </>
                    )}
                  </CardContent>
                  {false && phaseId === 6 && rerouteSelectedIds.length > 0 && activeFolder === 6 && (
                    <div className="flex items-center justify-between p-3 border-t bg-green-500/5">
                      <span className="text-sm text-muted-foreground">Vybraných: <span className="font-bold text-foreground">{rerouteSelectedIds.length}</span></span>
                      <Button variant="default" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => createProcessingSupiskaMutation.mutate(rerouteSelectedIds)} disabled={createProcessingSupiskaMutation.isPending} data-testid="button-create-supiska-old">
                        {createProcessingSupiskaMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ListChecks className="w-4 h-4 mr-2" />}
                        Vytvoriť súpisku ({rerouteSelectedIds.length})
                      </Button>
                    </div>
                  )}
                  {false && phaseId === 7 && rerouteSelectedIds.length > 0 && activeFolder === 7 && (
                    <div className="flex items-center justify-between p-3 border-t bg-orange-500/5">
                      <span className="text-sm text-muted-foreground">Vybraných: <span className="font-bold text-foreground">{rerouteSelectedIds.length}</span></span>
                      <Button variant="default" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => handleReroute("intervencia")} data-testid="button-reroute-intervencia-old">
                        <ArrowRight className="w-4 h-4 mr-2" />Vrátiť do spracovania ({rerouteSelectedIds.length})
                      </Button>
                    </div>
                  )}
                </Card>
              </div>
            );
          });
        })()}


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

        <Dialog open={rerouteDialogOpen} onOpenChange={(o) => { setRerouteDialogOpen(o); if (!o) setRerouteSource(null); }}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle data-testid="text-reroute-dialog-title">OPV Oprava – Presmerovanie</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vybraných zmlúv: <span className="font-semibold text-foreground">{rerouteSelectedIds.length}</span>
              </p>
              {rerouteSource && (
                <div className="flex items-center gap-3 p-3 rounded-md bg-blue-500/10">
                  <Send className="w-4 h-4 text-blue-400 shrink-0" />
                  <p className="text-sm" data-testid="text-reroute-target">
                    Cieľ: <span className="font-semibold text-foreground">{REROUTE_CONFIG[rerouteSource]?.targetLabel}</span>
                  </p>
                </div>
              )}
              <p className="text-xs text-amber-400" data-testid="text-reroute-preserve-note">
                Systém vytvorí NOVÚ súpisku s novým poradovým číslom. Pôvodné číslo sprievodky bude archivované v histórii.
              </p>
              <div className="flex items-center justify-end gap-3 flex-wrap">
                <Button variant="outline" onClick={() => { setRerouteDialogOpen(false); setRerouteSource(null); }} data-testid="button-reroute-cancel">
                  Zrušiť
                </Button>
                <Button onClick={confirmReroute} disabled={rerouteMutation.isPending} data-testid="button-reroute-confirm">
                  {rerouteMutation.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />Presmerovávam...</>) : (<><Send className="w-4 h-4 mr-2" />Presmerovať</>)}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={dispatchDialogOpen} onOpenChange={setDispatchDialogOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle data-testid="text-dispatch-dialog-title">Odoslanie súpisky partnerovi</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Spôsob odoslania</Label>
                <Select value={dispatchMethod} onValueChange={setDispatchMethod}>
                  <SelectTrigger data-testid="select-dispatch-method">
                    <SelectValue placeholder="Vyberte spôsob" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="osobne">Osobne</SelectItem>
                    <SelectItem value="postou">Poštou</SelectItem>
                    <SelectItem value="elektronicky">Elektronicky</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dátum a čas odoslania</Label>
                <Input type="datetime-local" value={dispatchDate} onChange={e => setDispatchDate(e.target.value)} data-testid="input-dispatch-date" />
              </div>
              <div className="flex items-center justify-end gap-3 flex-wrap">
                <Button variant="outline" onClick={() => setDispatchDialogOpen(false)} data-testid="button-dispatch-cancel">Zrušiť</Button>
                <Button
                  disabled={!dispatchMethod || !dispatchDate || dispatchSupiskaMutation.isPending}
                  onClick={() => {
                    if (dispatchSuopiskaId && dispatchMethod && dispatchDate) {
                      dispatchSupiskaMutation.mutate({ supiskaId: dispatchSuopiskaId, dispatchMethod, dispatchedAt: dispatchDate });
                      setDispatchDialogOpen(false);
                    }
                  }}
                  data-testid="button-dispatch-confirm"
                >
                  {dispatchSupiskaMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                  Odoslať
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={receiveDialogOpen} onOpenChange={setReceiveDialogOpen}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle data-testid="text-receive-dialog-title">Potvrdenie prijatia partnerom</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Dátum a čas prijatia</Label>
                <Input type="datetime-local" value={receiveDate} max={new Date().toISOString().slice(0, 16)} onChange={e => setReceiveDate(e.target.value)} data-testid="input-receive-date" />
                {receiveDate && new Date(receiveDate) > new Date() && (
                  <p className="text-xs text-red-500" data-testid="text-receive-date-future">Dátum a čas prijatia nesmie byť v budúcnosti</p>
                )}
              </div>
              <div className="flex items-center justify-end gap-3 flex-wrap">
                <Button variant="outline" onClick={() => setReceiveDialogOpen(false)} data-testid="button-receive-cancel">Zrušiť</Button>
                <Button
                  disabled={!receiveDate || new Date(receiveDate) > new Date() || receiveSupiskaMutation.isPending}
                  onClick={() => {
                    if (receiveSuopiskaId && receiveDate) {
                      receiveSupiskaMutation.mutate({ supiskaId: receiveSuopiskaId, receivedAt: receiveDate });
                      setReceiveDialogOpen(false);
                    }
                  }}
                  data-testid="button-receive-confirm"
                >
                  {receiveSupiskaMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Award className="w-4 h-4 mr-2" />}
                  Potvrdiť prijatie
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!removeFromSupiskaConfirm} onOpenChange={(o) => { if (!o) setRemoveFromSupiskaConfirm(null); }}>
          <DialogContent size="sm">
            <DialogHeader>
              <DialogTitle data-testid="text-remove-from-supiska-title">Vyradiť zmluvu zo súpisky?</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Naozaj chcete vyradiť zmluvu <span className="font-bold text-foreground">{removeFromSupiskaConfirm?.contractNumber}</span> zo súpisky <span className="font-bold text-foreground">{removeFromSupiskaConfirm?.supName}</span>?
              </p>
              <p className="text-sm text-amber-500">Zmluva bude vrátená do fázy „Manuálna kontrola kontraktov".</p>
              <div className="flex items-center justify-end gap-3 flex-wrap">
                <Button variant="outline" onClick={() => setRemoveFromSupiskaConfirm(null)} data-testid="button-remove-supiska-cancel">Zrušiť</Button>
                <Button
                  variant="destructive"
                  disabled={removeFromSupiskaMutation.isPending}
                  onClick={() => {
                    if (removeFromSupiskaConfirm) {
                      removeFromSupiskaMutation.mutate({ supiskaId: removeFromSupiskaConfirm.supiskaId, contractId: removeFromSupiskaConfirm.contractId });
                    }
                  }}
                  data-testid="button-remove-supiska-confirm"
                >
                  {removeFromSupiskaMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <XCircle className="w-4 h-4 mr-2" />}
                  Vyradiť zo súpisky
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
          {canCreateRecords(appUser) && (
            <>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)} data-testid="button-bulk-import">
                <Upload className="w-4 h-4 mr-2" />
                Hromadný import
              </Button>
              <Button onClick={() => navigate("/evidencia-zmluv")} data-testid="button-create-contract">
                <Plus className="w-4 h-4 mr-2" />
                Evidovať zmluvu
              </Button>
            </>
          )}
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
                  {columnVisibility.isVisible("status") && <TableHead style={{ minWidth: 140 }}>Stav</TableHead>}
                  {columnVisibility.isVisible("proposalNumber") && <TableHead sortKey="proposalNumber" sortDirection={skMain === "proposalNumber" ? sdMain : null} onSort={rsMain}>Cislo navrhu</TableHead>}
                  {columnVisibility.isVisible("globalNumber") && <TableHead sortKey="globalNumber" sortDirection={skMain === "globalNumber" ? sdMain : null} onSort={rsMain}>Poradove cislo</TableHead>}
                  {columnVisibility.isVisible("partnerId") && <TableHead sortKey="partnerId" sortDirection={skMain === "partnerId" ? sdMain : null} onSort={rsMain}>Partner</TableHead>}
                  {columnVisibility.isVisible("subjectId") && <TableHead sortKey="subjectId" sortDirection={skMain === "subjectId" ? sdMain : null} onSort={rsMain}>Klient</TableHead>}
                  {columnVisibility.isVisible("productId") && <TableHead sortKey="productId" sortDirection={skMain === "productId" ? sdMain : null} onSort={rsMain}>Produkt</TableHead>}
                  {columnVisibility.isVisible("inventoryId") && <TableHead sortKey="inventoryId" sortDirection={skMain === "inventoryId" ? sdMain : null} onSort={rsMain}>Sprievodka</TableHead>}
                  {columnVisibility.isVisible("annualPremium") && <TableHead sortKey="annualPremium" sortDirection={skMain === "annualPremium" ? sdMain : null} onSort={rsMain}>Rocne poistne</TableHead>}
                  {columnVisibility.isVisible("signedDate") && <TableHead sortKey="signedDate" sortDirection={skMain === "signedDate" ? sdMain : null} onSort={rsMain}>Vytvorenie zmluvy</TableHead>}
                  {columnVisibility.isVisible("premiumAmount") && <TableHead sortKey="premiumAmount" sortDirection={skMain === "premiumAmount" ? sdMain : null} onSort={rsMain}>Lehotne poistne</TableHead>}
                  {columnVisibility.isVisible("freshness") && <TableHead>Čerstvosť</TableHead>}
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedMain.map(contract => {
                  const status = statuses?.find(s => s.id === contract.statusId);
                  const inventoryName = inventories?.find(i => i.id === contract.inventoryId)?.name || "-";
                  const freshness = getFreshnessSemaphore(contract.updatedAt);

                  return (
                    <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`} onRowClick={() => openEdit(contract)}>
                      {columnVisibility.isVisible("contractNumber") && <TableCell className="font-mono text-sm font-bold text-blue-500 py-1" data-testid={`text-contract-number-${contract.id}`}>
                        <span className="flex items-center gap-1">
                          <Lock className="w-3 h-3 text-amber-500 shrink-0" style={{ display: contract.isLocked ? 'block' : 'none' }} />
                          {contract.contractNumber || "-"}
                        </span>
                      </TableCell>}
                      {columnVisibility.isVisible("status") && <TableCell className="py-1" data-testid={`text-contract-status-${contract.id}`} style={{ minWidth: 140 }}>
                        <div className="flex items-center justify-center">
                          {status ? (
                            <span
                              className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md border text-[11px] font-medium leading-tight text-center whitespace-normal"
                              style={{ borderColor: getSmartStatusColor(status.color, contract.expiryDate), color: getSmartStatusColor(status.color, contract.expiryDate), backgroundColor: `${getSmartStatusColor(status.color, contract.expiryDate)}15`, wordBreak: 'normal', overflowWrap: 'break-word' }}
                              data-testid={`badge-contract-status-${contract.id}`}
                            >
                              {status.name}
                            </span>
                          ) : "-"}
                        </div>
                      </TableCell>}
                      {columnVisibility.isVisible("proposalNumber") && <TableCell className="text-sm font-mono py-1" data-testid={`text-contract-proposal-${contract.id}`}>{contract.proposalNumber || "-"}</TableCell>}
                      {columnVisibility.isVisible("globalNumber") && <TableCell className="font-mono text-sm py-1" data-testid={`text-contract-registration-${contract.id}`}>
                        {contract.globalNumber ? (
                          <span className="font-semibold">{contract.globalNumber}</span>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">V procese</Badge>
                        )}
                      </TableCell>}
                      {columnVisibility.isVisible("partnerId") && <TableCell className="text-sm py-1" data-testid={`text-contract-partner-${contract.id}`}>
                        {getPartnerName(contract)}
                      </TableCell>}
                      {columnVisibility.isVisible("subjectId") && <TableCell className="text-sm py-1" data-testid={`text-contract-subject-${contract.id}`}>
                        {getSubjectDisplay(contract.subjectId)}
                      </TableCell>}
                      {columnVisibility.isVisible("productId") && <TableCell className="text-sm py-1" data-testid={`text-contract-product-${contract.id}`}>
                        {getProductName(contract)}
                      </TableCell>}
                      {columnVisibility.isVisible("inventoryId") && <TableCell className="text-sm py-1" data-testid={`text-contract-inventory-${contract.id}`}>
                        {inventoryName}
                      </TableCell>}
                      {columnVisibility.isVisible("annualPremium") && <TableCell className="text-sm font-mono py-1" data-testid={`text-contract-annual-${contract.id}`}>
                        {formatAmount(contract.annualPremium, contract.currency)}
                      </TableCell>}
                      {columnVisibility.isVisible("signedDate") && <TableCell className="text-sm py-1" data-testid={`text-contract-date-${contract.id}`}>
                        {formatDate(contract.signedDate)}
                      </TableCell>}
                      {columnVisibility.isVisible("premiumAmount") && <TableCell className="text-sm font-mono py-1" data-testid={`text-contract-amount-${contract.id}`}>
                        {formatAmount(contract.premiumAmount, contract.currency)}
                      </TableCell>}
                      {columnVisibility.isVisible("freshness") && <TableCell className="py-1" data-testid={`text-freshness-${contract.id}`}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5">
                              <div
                                className={`w-2.5 h-2.5 rounded-full shrink-0${freshness.blink ? " animate-pulse" : ""}`}
                                style={{ backgroundColor: freshness.color }}
                              />
                              <span className="text-xs text-muted-foreground">{freshness.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>Posledná aktualizácia: {freshness.label} dozadu</TooltipContent>
                        </Tooltip>
                      </TableCell>}
                      <TableCell className="text-right py-1">
                        <div className="flex items-center justify-end gap-0.5 flex-nowrap">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openView(contract)} data-testid={`button-view-contract-${contract.id}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {canEditRecords(appUser) && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(contract)} data-testid={`button-edit-contract-${contract.id}`}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          )}
                          {canDeleteRecords(appUser) && (contract.lifecyclePhase || 0) < 5 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openDelete(contract)} data-testid={`button-delete-contract-${contract.id}`}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Zmazať prázdny záznam</TooltipContent>
                            </Tooltip>
                          )}
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

      <Dialog open={bulkDateDialogOpen} onOpenChange={setBulkDateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-400">
              <Ghost className="w-4 h-4" />
              Hromadné dátumy - {bulkDateTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Dátum logistickej operácie</label>
              <Input type="date" value={bulkLogisticDate} onChange={e => setBulkLogisticDate(e.target.value)} data-testid="input-bulk-logistic-date" />
              <p className="text-xs text-muted-foreground">Tento dátum sa zdedí do všetkých zmlúv v tejto {bulkDateTarget?.type === "inventory" ? "sprievodke" : "súpiske"}</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox checked={bulkOnlyMissing} onCheckedChange={(v) => setBulkOnlyMissing(!!v)} data-testid="checkbox-bulk-only-missing" />
              <label className="text-sm">Len chýbajúce dátumy (neprepísať existujúce)</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkDateDialogOpen(false)} data-testid="button-bulk-cancel">Zrušiť</Button>
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                disabled={!bulkLogisticDate || bulkDateMutation.isPending}
                onClick={() => {
                  if (bulkDateTarget) {
                    bulkDateMutation.mutate({
                      type: bulkDateTarget.type,
                      id: bulkDateTarget.id,
                      logisticOperationDate: new Date(bulkLogisticDate).toISOString(),
                      onlyMissing: bulkOnlyMissing,
                    });
                  }
                }}
                data-testid="button-bulk-apply"
              >
                {bulkDateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null}
                Aplikovať dátumy
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
