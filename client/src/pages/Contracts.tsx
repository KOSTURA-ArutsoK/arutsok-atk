import { useState, useRef, useCallback, useEffect, useMemo, type ComponentType } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateSlovak, formatUid, expandUid, getDateSemaphore, getDateSemaphoreClasses, canCreateRecords, canDeleteRecords, canEditRecords, isAdmin, NAVRH_LABEL_FULL, NAVRH_LABEL_SHORT } from "@/lib/utils";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { useLocation, useSearch } from "wouter";
import type { Contract, ContractStatus, ContractTemplate, ContractInventory, Subject, Partner, Product, MyCompany, Sector, Section, SectorProduct, ClientGroup, ClientType, AppUser, ContractAcquirer } from "@shared/schema";
import { validateSlovakICO } from "@shared/ico-validator";
import { Plus, Pencil, Trash2, Eye, FileText, FileCheck, Files, Loader2, Lock, LayoutGrid, Send, Upload, Inbox, CheckCircle2, ChevronDown, ChevronRight, Printer, Search, Archive, AlertTriangle, AlertCircle, Calendar, XCircle, MessageSquare, Paperclip, X, Users, User, Check, Award, Percent, History, ListChecks, ArrowRight, ArrowUpRight, ArrowUp, Clock, Ghost, Ban, HelpCircle, ScanLine, Briefcase, Building, Building2, ArrowLeftRight, Info, Download } from "lucide-react";
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
  DialogFooter,
  DialogScrollContent,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  { key: "proposalNumber", label: NAVRH_LABEL_SHORT },
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
  { key: "proposalNumber", label: NAVRH_LABEL_SHORT },
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
  { key: "partnerId", label: "Partner" },
  { key: "productId", label: "Produkt" },
  { key: "proposalNumber", label: NAVRH_LABEL_SHORT },
  { key: "contractNumber", label: "Číslo zmluvy" },
  { key: "subjectId", label: "Klient" },
];

const MAIN_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "contractNumber", label: "Cislo zmluvy", type: "text" },
  { key: "proposalNumber", label: NAVRH_LABEL_SHORT, type: "text" },
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
  { key: "proposalNumber", label: NAVRH_LABEL_SHORT, type: "text" },
  { key: "globalNumber", label: "Poradove cislo", type: "number" },
  { key: "subjectId", label: "Klient", type: "number" },
  { key: "partnerId", label: "Partner", type: "number" },
  { key: "productId", label: "Produkt", type: "number" },
  { key: "annualPremium", label: "Rocne poistne", type: "number" },
  { key: "signedDate", label: "Vytvorenie zmluvy", type: "date" },
  { key: "premiumAmount", label: "Lehotne poistne", type: "number" },
];

const SPRIEVODKA_FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "partnerId", label: "Partner", type: "number" },
  { key: "productId", label: "Produkt", type: "number" },
  { key: "proposalNumber", label: NAVRH_LABEL_SHORT, type: "text" },
  { key: "contractNumber", label: "Číslo zmluvy", type: "text" },
  { key: "subjectId", label: "Klient", type: "number" },
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
  const [contractType, setContractType] = useState<string>("Nova");
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
        setContractType((editingContract as any).contractType || "Nova");
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
        setContractType("Nova");
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
      contractType,
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Typ zmluvy *</label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger data-testid="select-contract-type">
                  <SelectValue placeholder="Vyberte typ zmluvy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Nova">🟢 Nová zmluva</SelectItem>
                  <SelectItem value="Prestupova">🔵 Prestupová zmluva</SelectItem>
                  <SelectItem value="Zmenova">🟡 Zmenová zmluva</SelectItem>
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

            {(specialistUid || recommenders.length > 0) && (
              <div className={`rounded-md p-2 ${rewardTotalPercentage === 100 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                <p className={`text-xs font-medium ${rewardTotalPercentage === 100 ? 'text-emerald-600' : 'text-destructive'}`} data-testid="text-reward-status">
                  {rewardTotalPercentage === 100
                    ? `Celkový súčet odmien je 100,00 % - Uloženie je povolené.`
                    : `Celkový súčet odmien nie je 100,00 % (${rewardTotalPercentage.toFixed(2).replace(".", ",")} %) - Uloženie je zablokované.`
                  }
                </p>
              </div>
            )}

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
                        placeholder="UID alebo meno..."
                        value={specialistUid}
                        onChange={e => {
                          setSpecialistUid(e.target.value);
                          setRewardSearchSpecialist(e.target.value);
                        }}
                        onBlur={e => {
                          const val = e.target.value.trim();
                          if (val && /^\d+$/.test(val.replace(/\s/g, ''))) {
                            setSpecialistUid(expandUid(val));
                          }
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
                          placeholder="UID alebo meno..."
                          value={newRecommenderUid}
                          onChange={e => {
                            setNewRecommenderUid(e.target.value);
                            setRewardSearchRecommender(e.target.value);
                          }}
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val && /^\d+$/.test(val.replace(/\s/g, ''))) {
                              setNewRecommenderUid(expandUid(val));
                            }
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
              <label className="text-sm font-medium">Dátum uzatvorenia</label>
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
                  <span className="text-xs text-muted-foreground">Dátum uzatvorenia</span>
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

  const searchString = useSearch();
  const VALID_VIEWS = ["moje", "portfolio"] as const;
  type ContractViewType = typeof VALID_VIEWS[number];
  const contractView = useMemo(() => {
    const params = new URLSearchParams(searchString);
    const raw = params.get("view");
    if (raw && (VALID_VIEWS as readonly string[]).includes(raw)) return raw as ContractViewType;
    return null;
  }, [searchString]);

  const VIEW_TITLES: Record<string, string> = {
    moje: "Moje zmluvy",
    portfolio: "Klientske portfólio",
  };

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
    const search = searchString;
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
  }, [searchString, location]);

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
  const [preSelectStep, setPreSelectStep] = useState<1 | 2 | 3 | 4>(1);
  const [preSelectContractType, setPreSelectContractType] = useState<string>("Nova");
  const [preSelectPartnerId, setPreSelectPartnerId] = useState<string>("");
  const [preSelectProductId, setPreSelectProductId] = useState<string>("");
  const [preSelectProductOpen, setPreSelectProductOpen] = useState(false);
  const [preSelectContractTypeOpen, setPreSelectContractTypeOpen] = useState(false);
  const [preSelectSubjectSearch, setPreSelectSubjectSearch] = useState("");
  const [preSelectSubjectId, setPreSelectSubjectId] = useState<string>("");
  const [preSelectClientTypeId, setPreSelectClientTypeId] = useState<string>("");
  const [clientTypeSelectOpen, setClientTypeSelectOpen] = useState(false);
  const [preSelectNumberType, setPreSelectNumberType] = useState<"proposal" | "contract" | "both">("proposal");
  const [preSelectNumberValue2, setPreSelectNumberValue2] = useState("");
  const [preSelectNumberValue, setPreSelectNumberValue] = useState("");
  const [preSelectNumberDuplicates, setPreSelectNumberDuplicates] = useState<Array<{ id: number; contractNumber: string | null; proposalNumber: string | null; stateId: number | null; sameState: boolean; subjectName: string; titleBefore: string; titleAfter: string; lifecyclePhase: number | null }>>([]);
  const [preSelectCheckingDuplicates, setPreSelectCheckingDuplicates] = useState(false);
  const [preSelectTitleBefore, setPreSelectTitleBefore] = useState("");
  const [preSelectFirstName, setPreSelectFirstName] = useState("");
  const [preSelectLastName, setPreSelectLastName] = useState("");
  const [preSelectTitleAfter, setPreSelectTitleAfter] = useState("");
  const [preSelectSaving, setPreSelectSaving] = useState(false);
  const [preSelectSubjectType, setPreSelectSubjectType] = useState<"person" | "company" | "szco" | "organization">("person");
  const [preSelectIco, setPreSelectIco] = useState("");
  const [preSelectBusinessName, setPreSelectBusinessName] = useState("");
  const [preSelectBirthNumber, setPreSelectBirthNumber] = useState("");
  const [preSelectSearchHint, setPreSelectSearchHint] = useState<null | "szco_or_po" | "possible_rc">(null);
  const [preSelectShowNameFields, setPreSelectShowNameFields] = useState(false);
  const [preSelectIcoLookup, setPreSelectIcoLookup] = useState<{ found: boolean; name?: string; street?: string; streetNumber?: string; zip?: string; city?: string; legalForm?: string; dic?: string; source?: string; message?: string } | null>(null);
  const [preSelectIcoLookupLoading, setPreSelectIcoLookupLoading] = useState(false);
  const [preSelectIcoConfirmed, setPreSelectIcoConfirmed] = useState(false);
  const [preSelectIcoError, setPreSelectIcoError] = useState<string | null>(null);
  const [preSelectEditingContractId, setPreSelectEditingContractId] = useState<number | null>(null);
  const [preSelectFiles, setPreSelectFiles] = useState<File[]>([]);
  const [preSelectCreatedContractId, setPreSelectCreatedContractId] = useState<number | null>(null);
  const [preSelectUploading, setPreSelectUploading] = useState(false);
  const [preSelectSignedDate, setPreSelectSignedDate] = useState("");
  const [preSelectSignedDay, setPreSelectSignedDay] = useState("");
  const [preSelectSignedMonth, setPreSelectSignedMonth] = useState("");
  const [preSelectSignedYear, setPreSelectSignedYear] = useState("");
  const [preSelectWithTime, setPreSelectWithTime] = useState(false);
  const [preSelectSignedTime, setPreSelectSignedTime] = useState("");
  const [preSelectUploadedCount, setPreSelectUploadedCount] = useState(0);
  const [preSelectFileError, setPreSelectFileError] = useState<string | null>(null);
  const [preSelectSpecialistUid, setPreSelectSpecialistUid] = useState("");
  const [preSelectSpecialistPercentage, setPreSelectSpecialistPercentage] = useState("");
  const [preSelectRecommenders, setPreSelectRecommenders] = useState<{ uid: string; percentage: string }[]>([]);
  const [preSelectRewardSearchSpecialist, setPreSelectRewardSearchSpecialist] = useState("");
  const [preSelectRewardSearchRecommender, setPreSelectRewardSearchRecommender] = useState("");
  const [preSelectAddingRecommender, setPreSelectAddingRecommender] = useState(false);
  const [preSelectNewRecommenderUid, setPreSelectNewRecommenderUid] = useState("");
  const [preSelectNewRecommenderPercentage, setPreSelectNewRecommenderPercentage] = useState("");

  const [quickFixOpen, setQuickFixOpen] = useState(false);
  const [quickFixContract, setQuickFixContract] = useState<Contract | null>(null);
  const [quickFixPartnerId, setQuickFixPartnerId] = useState("");
  const [quickFixProductId, setQuickFixProductId] = useState("");
  const [quickFixNumberType, setQuickFixNumberType] = useState<"proposal" | "contract" | "both">("proposal");
  const [quickFixNumberValue, setQuickFixNumberValue] = useState("");
  const [quickFixNumberValue2, setQuickFixNumberValue2] = useState("");
  const [quickFixSubjectId, setQuickFixSubjectId] = useState("");
  const [quickFixSubjectSearch, setQuickFixSubjectSearch] = useState("");
  const [quickFixSaving, setQuickFixSaving] = useState(false);

  const preSelectRewardTotal = useMemo(() => {
    const specPct = parseFloat(preSelectSpecialistPercentage) || 0;
    const recPct = preSelectRecommenders.reduce((sum, r) => sum + (parseFloat(r.percentage) || 0), 0);
    return specPct + recPct;
  }, [preSelectSpecialistPercentage, preSelectRecommenders]);

  const preSelectRewardRemaining = useMemo(() => {
    return Math.max(0, 100 - preSelectRewardTotal);
  }, [preSelectRewardTotal]);

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const MAX_BATCH_SIZE = 100 * 1024 * 1024;
  const MAX_BATCH_FILES = 25;
  const MAX_DOCS_PER_CONTRACT = 100;
  const MAX_VIDEOS_PER_CONTRACT = 5;
  const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm"]);
  const userCanUploadVideo = appUser && (isAdmin(appUser) || appUser.role === 'agent');
  const refFileInput = useRef<HTMLInputElement>(null);
  const refPartnerTrigger = useRef<HTMLButtonElement>(null);
  const refProductTrigger = useRef<HTMLButtonElement>(null);
  const refContractTypeTrigger = useRef<HTMLButtonElement>(null);
  const refSignedDateInput = useRef<HTMLInputElement>(null);
  const refStep1Next = useRef<HTMLButtonElement>(null);
  const refSearchInput = useRef<HTMLInputElement>(null);
  const refStep2Confirm = useRef<HTMLButtonElement>(null);
  const refNumberToggleProposal = useRef<HTMLButtonElement>(null);
  const refNumberToggleContract = useRef<HTMLButtonElement>(null);
  const refNumberInput = useRef<HTMLInputElement>(null);
  const refTitleBeforeInput = useRef<HTMLInputElement>(null);
  const refIcoInput = useRef<HTMLInputElement>(null);
  const refBirthNumberInput = useRef<HTMLInputElement>(null);
  const refFirstNameInput = useRef<HTMLInputElement>(null);
  const refLastNameInput = useRef<HTMLInputElement>(null);
  const refTitleAfterInput = useRef<HTMLInputElement>(null);
  const refBusinessNameInput = useRef<HTMLInputElement>(null);
  const refRegisterButton = useRef<HTMLButtonElement>(null);
  const refSignedDay = useRef<HTMLInputElement>(null);
  const refSignedMonth = useRef<HTMLInputElement>(null);
  const refSignedYear = useRef<HTMLInputElement>(null);
  const refTimeBtnNone = useRef<HTMLButtonElement>(null);
  const refSignedTimeInput = useRef<HTMLInputElement>(null);
  const refPreSelectSpecialistUid = useRef<HTMLInputElement>(null);
  const refPreSelectSpecialistPct = useRef<HTMLInputElement>(null);
  const refImportSpecialistUid = useRef<HTMLInputElement>(null);
  const refImportSpecialistPct = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (preSelectStep === 3) {
      setTimeout(() => refPreSelectSpecialistUid.current?.focus(), 100);
    }
  }, [preSelectStep]);

  const getEmptyRequiredFields = (step: number): string[] => {
    const missing: string[] = [];
    if (step === 1) {
      if (!preSelectPartnerId) missing.push("partner");
      if (!preSelectNumberValue.trim()) missing.push("number");
      if (preSelectNumberType === "both" && !preSelectNumberValue2.trim()) missing.push("number2");
    } else if (step === 2) {
      if (preSelectSubjectType === "company" || preSelectSubjectType === "szco" || preSelectSubjectType === "organization") {
        if (!preSelectBusinessName.trim()) missing.push("business-name");
      }
      if (preSelectSubjectType === "person" || preSelectSubjectType === "szco") {
        if (!preSelectFirstName.trim()) missing.push("first-name");
        if (!preSelectLastName.trim()) missing.push("last-name");
      }
    }
    return missing;
  };

  const focusNextEmptyRequired = (currentFieldId: string) => {
    const step = preSelectStep;
    const emptyFields = getEmptyRequiredFields(step);
    if (emptyFields.length === 0) {
      if (step === 1) refStep1Next.current?.focus();
      else refStep2Confirm.current?.focus();
      return;
    }
    const currentIdx = emptyFields.indexOf(currentFieldId);
    const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % emptyFields.length : 0;
    const nextField = emptyFields[nextIdx >= emptyFields.length ? 0 : nextIdx];
    const refMap: Record<string, React.RefObject<any> | string> = {
      "partner": "select-preselect-partner",
      "number": refNumberInput,
      "number2": "input-preselect-contract-number",
      "business-name": refBusinessNameInput,
      "first-name": refFirstNameInput,
      "last-name": refLastNameInput,
    };
    const ref = refMap[nextField];
    if (!ref) { if (step === 1) refStep1Next.current?.focus(); else refStep2Confirm.current?.focus(); return; }
    if (typeof ref === "string") {
      setTimeout(() => { const el = document.querySelector(`[data-testid="${ref}"]`) as HTMLElement; if (el) el.focus(); }, 50);
    } else {
      setTimeout(() => ref.current?.focus(), 50);
    }
  };

  const isFieldMissing = (fieldId: string): boolean => {
    const emptyFields = getEmptyRequiredFields(preSelectStep);
    return emptyFields.includes(fieldId);
  };

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<{ total: number; success: number; errors: number; duplicates?: number; created?: number; updated?: number; warnings?: number; incomplete?: number; nameConfirmationNeeded?: number; duplicityWarnings?: any[]; details: any[] } | null>(null);
  const [importSummaryOpen, setImportSummaryOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [nameConfirmOpen, setNameConfirmOpen] = useState(false);
  const [nameConfirmContract, setNameConfirmContract] = useState<any>(null);
  const [nameConfirmLoading, setNameConfirmLoading] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2>(1);
  const [importCreatedIds, setImportCreatedIds] = useState<number[]>([]);
  const [importSpecialistUid, setImportSpecialistUid] = useState("");
  const [importSpecialistPercentage, setImportSpecialistPercentage] = useState("");
  const [importRecommenders, setImportRecommenders] = useState<{ uid: string; percentage: string }[]>([]);
  const [importRewardSearchSpecialist, setImportRewardSearchSpecialist] = useState("");
  const [importRewardSearchRecommender, setImportRewardSearchRecommender] = useState("");
  const [importAddingRecommender, setImportAddingRecommender] = useState(false);
  const [importNewRecommenderUid, setImportNewRecommenderUid] = useState("");
  const [importNewRecommenderPercentage, setImportNewRecommenderPercentage] = useState("");
  const [importRewardSaving, setImportRewardSaving] = useState(false);

  useEffect(() => {
    if (importStep === 2) {
      setTimeout(() => refImportSpecialistUid.current?.focus(), 100);
    }
  }, [importStep]);

  const importRewardTotal = useMemo(() => {
    let total = parseFloat(importSpecialistPercentage) || 0;
    importRecommenders.forEach(r => { total += parseFloat(r.percentage) || 0; });
    return total;
  }, [importSpecialistPercentage, importRecommenders]);

  const importRewardRemaining = useMemo(() => Math.max(0, 100 - importRewardTotal), [importRewardTotal]);

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

  const contractsFilterKeyRef = useRef(contractsFilterKey);
  const [contractsResetCounter, setContractsResetCounter] = useState(0);
  useEffect(() => {
    if (contractsFilterKeyRef.current !== contractsFilterKey) {
      contractsFilterKeyRef.current = contractsFilterKey;
      setContractPages([]);
      setContractsTotal(0);
      setContractsOffset(0);
      setContractsResetCounter(c => c + 1);
    }
  }, [contractsFilterKey]);

  const contractsQueryKey = ["/api/contracts", contractsFilterKey, contractsOffset];

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
  }, [contractsPage, contractsOffset, contractsResetCounter]);

  const isLoading = isLoadingContracts && contractsOffset === 0;
  const isLoadingMore = isFetchingContracts && contractsOffset > 0;
  const userUid = appUser?.uid || "";

  const viewFilteredContracts = useMemo(() => {
    if (!contractView) return contractPages;
    if ((contractView === "moje" || contractView === "portfolio") && !userUid) return [];
    const normalizedUserUid = userUid.replace(/\s/g, "");
    switch (contractView) {
      case "moje":
        return contractPages.filter(c => {
          const k = (c.klientUid || "").replace(/\s/g, "");
          return k === normalizedUserUid;
        });
      case "portfolio":
        return contractPages.filter(c => {
          const z = (c.ziskatelUid || "").replace(/\s/g, "");
          const s = (c.specialistaUid || "").replace(/\s/g, "");
          return z === normalizedUserUid || s === normalizedUserUid;
        });
      default:
        return contractPages;
    }
  }, [contractPages, contractView, userUid]);

  const contracts = viewFilteredContracts;
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
  const { data: appUsersAll } = useQuery<AppUser[]>({ queryKey: ["/api/app-users"] });
  const { data: companies } = useQuery<MyCompany[]>({ queryKey: ["/api/my-companies"] });
  const { data: templates } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contract-templates"],
  });
  const { data: allStates } = useStates();

  const lookupSubjectByUid = (uid: string): { found: boolean; label: string } => {
    if (!uid.trim()) return { found: false, label: "" };
    const normalizedUid = uid.replace(/\s/g, "");
    const user = (appUsersAll || []).find(u => (u.uid || "").replace(/\s/g, "") === normalizedUid);
    if (user) {
      const parts = [user.firstName, user.lastName].filter(Boolean);
      return { found: true, label: parts.join(" ") || user.username || "Bez mena" };
    }
    const subj = (subjects || []).find(s => (s.uid || "").replace(/\s/g, "") === normalizedUid && !s.deletedAt);
    if (subj) {
      if (subj.type === "fo") {
        const det = (subj.details || {}) as Record<string, unknown>;
        const titleBefore = (det.titleBefore as string) || "";
        const titleAfter = (det.titleAfter as string) || "";
        const parts = [titleBefore, subj.firstName, subj.lastName].filter(Boolean);
        const full = titleAfter ? `${parts.join(" ")}, ${titleAfter}` : parts.join(" ");
        return { found: true, label: full || "Bez mena" };
      }
      return { found: true, label: subj.companyName || "Bez nazvu" };
    }
    return { found: false, label: "Subjekt nenajdeny" };
  };

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
    const selectableContracts = activeContracts.filter(c => !(c as any).incompleteData);
    if (selectedIds.length === selectableContracts.length && selectableContracts.length > 0) {
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
          setSelectedIds(allData.data.filter((c: any) => !c.isDeleted && !c.incompleteData).map((c: Contract) => c.id));
        }
      } catch {}
    } else {
      setSelectedIds(selectableContracts.map(c => c.id));
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
      const createdDetails = (data.details || []).filter((d: any) => d.contractId && (d.status === "ok" || d.status === "incomplete"));
      const createdIds = createdDetails.map((d: any) => d.contractId as number);
      setImportCreatedIds(createdIds);
      const allHaveDistributions = createdDetails.length > 0 && createdDetails.every((d: any) => d.hasDistributions);
      if (createdIds.length > 0 && !allHaveDistributions) {
        setImportStep(2);
        setImportFile(null);
      } else {
        setImportDialogOpen(false);
        setImportFile(null);
        setImportSummaryOpen(true);
        if (allHaveDistributions) {
          toast({ title: "Úspech", description: `Import dokončený. Získatelia boli priradení z Excelu pre ${createdIds.length} zmlúv.` });
        }
      }
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
    if (spMatch) return `${spMatch.name}${spMatch.abbreviation ? ` (${spMatch.abbreviation})` : ''}`;
    const prodMatch = products?.find(p => p.id === contract.productId);
    if (prodMatch) return prodMatch.name || "—";
    return "—";
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

  function renderContractTable(list: Contract[], options?: { showCheckbox?: boolean; showOrder?: boolean; showStatus?: boolean; showRegistration?: boolean; showActions?: boolean; showTimer?: boolean; showRerouteCheckbox?: boolean; checkboxOnly?: boolean; hideContractNumbers?: boolean; earlyPhase?: boolean; sortState?: { sortKey: string | null; sortDirection: "asc" | "desc" | null; requestSort: (key: string) => void } }) {
    const { showCheckbox, showOrder, showStatus, showRegistration, showActions = true, showTimer, showRerouteCheckbox, checkboxOnly, hideContractNumbers, earlyPhase, sortState } = options || {};
    const sk = sortState?.sortKey ?? null;
    const sd = sortState?.sortDirection ?? null;
    const rs = sortState?.requestSort;
    return (
      <div className="relative overflow-auto" style={{ maxHeight: 'calc(100vh - 350px)' }}>
      <Table stickyHeader>
        <TableHeader>
          <TableRow>
            {showCheckbox && (() => {
              const selectableCount = list.filter(c => !(c as any).incompleteData).length;
              return (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedIds.length === selectableCount && selectableCount > 0}
                  onCheckedChange={toggleSelectAll}
                  data-testid="checkbox-select-all"
                />
              </TableHead>
              );
            })()}
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
            {!hideContractNumbers && !earlyPhase && <TableHead sortKey="contractNumber" sortDirection={sk === "contractNumber" ? sd : null} onSort={rs}>Číslo kontraktu</TableHead>}
            <TableHead sortKey="partnerId" sortDirection={sk === "partnerId" ? sd : null} onSort={rs}>Partner</TableHead>
            <TableHead sortKey="productId" sortDirection={sk === "productId" ? sd : null} onSort={rs}>Produkt</TableHead>
            <TableHead sortKey="proposalNumber" sortDirection={sk === "proposalNumber" ? sd : null} onSort={rs} title={NAVRH_LABEL_FULL}>{NAVRH_LABEL_SHORT}</TableHead>
            {earlyPhase && <TableHead className="whitespace-nowrap text-xs">D: Číslo zmluvy</TableHead>}
            {!earlyPhase && !hideContractNumbers && <TableHead>Číslo zmluvy</TableHead>}
            <TableHead className="whitespace-nowrap text-xs">{earlyPhase ? "E: " : ""}Typ subjektu</TableHead>
            {earlyPhase ? (
              <>
                <TableHead className="whitespace-nowrap text-xs">F: RČ / IČO</TableHead>
                <TableHead className="whitespace-nowrap text-xs">G: Názov firmy</TableHead>
                <TableHead className="whitespace-nowrap text-xs">H: Titul pred</TableHead>
                <TableHead className="whitespace-nowrap text-xs">I: Meno</TableHead>
                <TableHead className="whitespace-nowrap text-xs">J: Priezvisko</TableHead>
                <TableHead className="whitespace-nowrap text-xs">K: Titul za</TableHead>
                <TableHead className="whitespace-nowrap text-xs">L+M: Špecialist (UID %)</TableHead>
                <TableHead className="whitespace-nowrap text-xs">N+O: Odporúčateľ 1 (UID %)</TableHead>
                <TableHead className="whitespace-nowrap text-xs">P+Q: Odporúčateľ 2 (UID %)</TableHead>
              </>
            ) : (
              <TableHead sortKey="subjectId" sortDirection={sk === "subjectId" ? sd : null} onSort={rs}>Subjekt</TableHead>
            )}
            <TableHead className="text-center w-[60px]">🗂️</TableHead>
            {showTimer && <TableHead>Zostáva dní</TableHead>}
            {showActions && <TableHead className="text-right">Akcie</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map(contract => {
            const sub = subjects?.find(s => s.id === contract.subjectId);
            const subjectType = sub?.type === "person" ? "FO" : sub?.type === "szco" ? "SZČO" : sub?.type === "company" ? "PO" : "—";
            const subjectFullName = sub ? [sub.titleBefore, sub.firstName, sub.lastName, sub.titleAfter].filter(Boolean).join(" ") || sub.companyName || "—" : "—";
            const isIncomplete = !!(contract as any).incompleteData;
            const incompleteReason = (contract as any).incompleteDataReason || "";
            const needsNameConfirm = !!(contract as any).needsManualVerification;
            const incompleteFields = isIncomplete ? (incompleteReason.replace(/^Chýba:\s*/, "").split(",").map((f: string) => f.trim().toLowerCase())) : [];
            const fieldMissing = (field: string) => incompleteFields.some((f: string) => f.includes(field));
            const isRowSelected = selectedIds.includes(contract.id) || rerouteSelectedIds.includes(contract.id);
            const phaseSelectedClass = isRowSelected ? (({
              1: "[&>td]:bg-blue-500/25 hover:[&>td]:bg-blue-500/30 border-l-2 border-l-blue-500",
              2: "[&>td]:bg-blue-500/25 hover:[&>td]:bg-blue-500/30 border-l-2 border-l-blue-500",
              3: "[&>td]:bg-red-500/25 hover:[&>td]:bg-red-500/30 border-l-2 border-l-red-500",
              4: "[&>td]:bg-zinc-400/25 hover:[&>td]:bg-zinc-400/30 border-l-2 border-l-zinc-400",
              5: "[&>td]:bg-green-500/25 hover:[&>td]:bg-green-500/30 border-l-2 border-l-green-500",
              6: "[&>td]:bg-cyan-500/25 hover:[&>td]:bg-cyan-500/30 border-l-2 border-l-cyan-500",
              7: "[&>td]:bg-orange-500/25 hover:[&>td]:bg-orange-500/30 border-l-2 border-l-orange-500",
              8: "[&>td]:bg-emerald-500/25 hover:[&>td]:bg-emerald-500/30 border-l-2 border-l-emerald-500",
              9: "[&>td]:bg-indigo-500/25 hover:[&>td]:bg-indigo-500/30 border-l-2 border-l-indigo-500",
              10: "[&>td]:bg-yellow-500/25 hover:[&>td]:bg-yellow-500/30 border-l-2 border-l-yellow-500",
            } as Record<number, string>)[(contract as any).lifecyclePhase] || "[&>td]:bg-blue-500/25 hover:[&>td]:bg-blue-500/30 border-l-2 border-l-blue-500") : null;
            const rowClass = isRowSelected ? phaseSelectedClass! : isIncomplete ? "bg-red-500/15 hover:bg-red-500/20 border-l-2 border-l-red-500" : (needsNameConfirm && !isIncomplete) ? "bg-orange-500/8 hover:bg-orange-500/15 border-l-2 border-l-orange-500" : "";
            return (
              <TableRow key={contract.id} data-testid={`row-evidencia-${contract.id}`} className={rowClass} onRowClick={() => { if (needsNameConfirm && !checkboxOnly) { setNameConfirmContract(contract); setNameConfirmOpen(true); return; } if (checkboxOnly && showRerouteCheckbox) { toggleRerouteSelect(contract.id); } else if (checkboxOnly && showCheckbox) { if (earlyPhase && isIncomplete) { openIncompleteEdit(contract); } else if (earlyPhase && !isIncomplete) { toggleSelect(contract.id); } else if (!isIncomplete) { toggleSelect(contract.id); } } else if (!checkboxOnly) { if (earlyPhase || isIncomplete) { openIncompleteEdit(contract); } else { openEdit(contract); } } }}>
                {showCheckbox && (
                  <TableCell>
                    {isIncomplete ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex"><Checkbox disabled checked={false} data-testid={`checkbox-contract-${contract.id}`} /></span>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[250px] text-xs">
                          <p className="font-semibold text-red-400 mb-0.5">Neúplná zmluva</p>
                          <p>{incompleteReason}</p>
                          <p className="mt-0.5 text-muted-foreground">Doplňte chýbajúce údaje pred zaradením na sprievodku.</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Checkbox
                        checked={selectedIds.includes(contract.id)}
                        onCheckedChange={() => toggleSelect(contract.id)}
                        data-testid={`checkbox-contract-${contract.id}`}
                      />
                    )}
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
                {!hideContractNumbers && !earlyPhase && (
                  <TableCell className="font-mono text-sm font-bold text-blue-500 py-1" data-testid={`text-contract-number-${contract.id}`}>
                    <span className="flex items-center gap-1 flex-wrap">
                      <Lock className="w-3 h-3 text-amber-500 shrink-0" style={{ display: contract.isLocked ? 'block' : 'none' }} />
                      {contract.contractNumber || "—"}
                      {(contract as any).contractType === "Nova" && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-bold bg-green-500/15 text-green-400 border border-green-500/30 whitespace-nowrap" data-testid={`badge-contract-type-${contract.id}`}>🟢 N</span>
                      )}
                      {(contract as any).contractType === "Prestupova" && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30 whitespace-nowrap" data-testid={`badge-contract-type-${contract.id}`}>🔵 P</span>
                      )}
                      {(contract as any).contractType === "Zmenova" && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-bold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 whitespace-nowrap" data-testid={`badge-contract-type-${contract.id}`}>🟡 Z</span>
                      )}
                      {(contract as any).contractType === "Dodatok" && (
                        <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/30 whitespace-nowrap" data-testid={`badge-contract-type-${contract.id}`}>🟠 D</span>
                      )}
                      {(contract as any).isFirstContract && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-red-500/40 text-red-400 text-[10px] font-semibold whitespace-nowrap" data-testid={`badge-first-contract-${contract.id}`}>1. ZMLUVA</span>
                      )}
                    </span>
                  </TableCell>
                )}
                <TableCell className="text-sm py-1">
                  <span className="flex items-center gap-1">
                    {getPartnerName(contract)}
                    {isIncomplete && fieldMissing("partner") && (
                      <Tooltip><TooltipTrigger asChild><AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" /></TooltipTrigger><TooltipContent className="text-xs">Chýba Partner</TooltipContent></Tooltip>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-sm py-1">
                  <span className="flex items-center gap-1">
                    {getProductName(contract)}
                    {isIncomplete && fieldMissing("produkt") && (
                      <Tooltip><TooltipTrigger asChild><AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" /></TooltipTrigger><TooltipContent className="text-xs">Chýba Produkt</TooltipContent></Tooltip>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-sm font-mono py-1" data-testid={`text-contract-proposal-${contract.id}`}>
                  <span className="flex items-center gap-1">
                    {contract.proposalNumber || "—"}
                    {isIncomplete && fieldMissing("číslo") && (
                      <Tooltip><TooltipTrigger asChild><AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" /></TooltipTrigger><TooltipContent className="text-xs">Chýba číslo návrhu/zmluvy</TooltipContent></Tooltip>
                    )}
                  </span>
                </TableCell>
                {earlyPhase && <TableCell className="text-xs font-mono py-1" data-testid={`text-contract-insurancenumber-${contract.id}`}>{contract.insuranceContractNumber || "—"}</TableCell>}
                {!earlyPhase && !hideContractNumbers && <TableCell className="text-sm font-mono py-1" data-testid={`text-contract-insurancenumber-${contract.id}`}>{contract.insuranceContractNumber || "—"}</TableCell>}
                <TableCell className="text-sm py-1">
                  <Badge variant="outline" className={`text-[10px] ${subjectType === "FO" ? "border-blue-500/50 text-blue-400" : subjectType === "SZČO" ? "border-amber-500/50 text-amber-400" : subjectType === "PO" ? "border-purple-500/50 text-purple-400" : "border-muted text-muted-foreground"}`}>{subjectType}</Badge>
                </TableCell>
                {earlyPhase ? (() => {
                  const raw = (contract as any).importedRawData || {};
                  const rcIco = sub ? (sub.type === "person" ? sub.birthNumber : sub.type === "szco" ? ((contract as any).szcoIco || sub.birthNumber) : (sub as any).ico) : (raw.rc_ico || null);
                  const nazovFirmy = sub?.companyName || raw.nazov_firmy || null;
                  const titulPred = sub?.titleBefore || raw.titul_pred || null;
                  const meno = sub?.firstName || raw.meno || null;
                  const priezvisko = sub?.lastName || raw.priezvisko || null;
                  const titulZa = sub?.titleAfter || raw.titul_za || null;
                  return (
                    <>
                      <TableCell className="text-xs font-mono py-1 whitespace-nowrap" data-testid={`text-subject-rcico-${contract.id}`}>
                        <span className="flex items-center gap-1">
                          {rcIco || <span className="text-muted-foreground/40">—</span>}
                          {isIncomplete && (fieldMissing("rodné") || fieldMissing("ičo")) && <Tooltip><TooltipTrigger asChild><AlertTriangle className="w-3 h-3 text-red-500 shrink-0" /></TooltipTrigger><TooltipContent className="text-xs">Chýba RČ / IČO</TooltipContent></Tooltip>}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs py-1 max-w-[120px] truncate" title={nazovFirmy || ""}>{nazovFirmy || <span className="text-muted-foreground/40">—</span>}</TableCell>
                      <TableCell className="text-xs py-1">{titulPred || <span className="text-muted-foreground/40">—</span>}</TableCell>
                      <TableCell className="text-xs py-1" data-testid={`text-subject-firstname-${contract.id}`}>
                        <span className="flex items-center gap-1">
                          {meno || <span className="text-muted-foreground/40">—</span>}
                          {isIncomplete && fieldMissing("meno") && <Tooltip><TooltipTrigger asChild><AlertTriangle className="w-3 h-3 text-red-500 shrink-0" /></TooltipTrigger><TooltipContent className="text-xs">Chýba Meno</TooltipContent></Tooltip>}
                          {needsNameConfirm && !isIncomplete && <Tooltip><TooltipTrigger asChild><AlertTriangle className="w-3 h-3 text-orange-400 shrink-0" /></TooltipTrigger><TooltipContent className="text-xs">Sporné meno — kliknite pre potvrdenie</TooltipContent></Tooltip>}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs py-1" data-testid={`text-subject-lastname-${contract.id}`}>
                        <span className="flex items-center gap-1">
                          {priezvisko || <span className="text-muted-foreground/40">—</span>}
                          {isIncomplete && fieldMissing("priezvisko") && <Tooltip><TooltipTrigger asChild><AlertTriangle className="w-3 h-3 text-red-500 shrink-0" /></TooltipTrigger><TooltipContent className="text-xs">Chýba Priezvisko</TooltipContent></Tooltip>}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs py-1">{titulZa || <span className="text-muted-foreground/40">—</span>}</TableCell>
                      <TableCell className="text-xs font-mono py-1 whitespace-nowrap">
                        {raw.specialista ? <span className="text-muted-foreground">{formatUid(raw.specialista)}{raw.specialista_podiel != null && raw.specialista_podiel !== "" ? <span className="text-primary font-semibold"> ({raw.specialista_podiel}%)</span> : ""}</span> : <span className="text-muted-foreground/30">—</span>}
                      </TableCell>
                      <TableCell className="text-xs font-mono py-1 whitespace-nowrap">
                        {raw.odporucitel ? <span className="text-muted-foreground">{formatUid(raw.odporucitel)}{raw.odporucitel_podiel != null && raw.odporucitel_podiel !== "" ? <span className="text-primary font-semibold"> ({raw.odporucitel_podiel}%)</span> : ""}</span> : <span className="text-muted-foreground/30">—</span>}
                      </TableCell>
                      <TableCell className="text-xs font-mono py-1 whitespace-nowrap">
                        {raw.odporucitel2 ? <span className="text-muted-foreground">{formatUid(raw.odporucitel2)}{raw.odporucitel2_podiel != null && raw.odporucitel2_podiel !== "" ? <span className="text-primary font-semibold"> ({raw.odporucitel2_podiel}%)</span> : ""}</span> : <span className="text-muted-foreground/30">—</span>}
                      </TableCell>
                    </>
                  );
                })() : (
                  <TableCell className="text-sm py-1" data-testid={`text-subject-name-${contract.id}`}>
                    <span className="flex items-center gap-1 flex-wrap">
                      <span>{subjectFullName}</span>
                      {isIncomplete && (fieldMissing("meno") || fieldMissing("priezvisko") || fieldMissing("rodné") || fieldMissing("ičo") || fieldMissing("názov firmy")) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[250px] text-xs">
                            <p className="font-semibold text-red-400">Neúplné údaje subjektu</p>
                            <p>{incompleteFields.filter((f: string) => f.includes("meno") || f.includes("priezvisko") || f.includes("rodné") || f.includes("ičo") || f.includes("názov firmy")).join(", ")}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {needsNameConfirm && !isIncomplete && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-orange-500/40 bg-orange-500/10 text-orange-400 text-[10px] font-semibold whitespace-nowrap cursor-pointer" data-testid={`badge-name-confirm-${contract.id}`}>
                              <AlertTriangle className="w-3 h-3 mr-0.5 shrink-0" />
                              Sporné meno
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[250px] text-xs">
                            <p className="font-semibold text-orange-400">Vyžaduje potvrdenie mena</p>
                            <p>Kliknite na riadok pre prehodenie alebo potvrdenie mena a priezviska.</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                  </TableCell>
                )}
                {Array.isArray(contract.documents) && contract.documents.length > 0 && (
                  <TableCell className="py-1 text-center" data-testid={`text-docs-count-${contract.id}`}>
                    <span className="inline-flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold whitespace-nowrap">
                            🗂️ {contract.documents.length}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          {contract.documents.length} {contract.documents.length === 1 ? "nahraný dokument" : contract.documents.length < 5 ? "nahrané dokumenty" : "nahraných dokumentov"}
                        </TooltipContent>
                      </Tooltip>
                      {contract.documents.length >= 30 && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" data-testid={`icon-high-docs-${contract.id}`} />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs max-w-[220px]">
                            Táto zmluva obsahuje vysoký počet dokumentov. Skontrolujte, či nie sú duplicitné.
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                  </TableCell>
                )}
                {Array.isArray(contract.documents) && contract.documents.length === 0 && (
                  <TableCell className="py-1" />
                )}
                {!Array.isArray(contract.documents) && (
                  <TableCell className="py-1" />
                )}
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
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => earlyPhase ? openIncompleteEdit(contract) : openEdit(contract)} data-testid={`button-edit-contract-${contract.id}`}>
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

  const [importConfirmOpen, setImportConfirmOpen] = useState(false);

  async function handleImportRewardSave() {
    if (importCreatedIds.length === 0) return;
    setImportRewardSaving(true);
    try {
      const distributions: { type: string; uid: string; percentage: string; sortOrder: number }[] = [];
      if (importSpecialistUid) {
        distributions.push({ type: "specialist", uid: importSpecialistUid, percentage: importSpecialistPercentage || "0", sortOrder: 0 });
        if (importRecommenders.length === 0) {
          distributions.push({ type: "recommender", uid: importSpecialistUid, percentage: "0", sortOrder: 1 });
        }
      }
      importRecommenders.forEach((r, i) => {
        distributions.push({ type: "recommender", uid: r.uid, percentage: r.percentage || "0", sortOrder: i + 1 });
      });
      if (distributions.length > 0) {
        let savedCount = 0;
        for (const cid of importCreatedIds) {
          try {
            await apiRequest("POST", `/api/contracts/${cid}/reward-distributions`, { distributions });
            savedCount++;
          } catch {}
        }
        toast({ title: "Úspech", description: `Odmeny uložené pre ${savedCount} z ${importCreatedIds.length} zmlúv` });
      }
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message || "Chyba pri ukladaní odmien", variant: "destructive" });
    }
    setImportRewardSaving(false);
    setImportDialogOpen(false);
    setImportStep(1);
    setImportSpecialistUid("");
    setImportSpecialistPercentage("");
    setImportRecommenders([]);
    setImportSummaryOpen(true);
  }

  function handleImportRewardSkip() {
    setImportDialogOpen(false);
    setImportStep(1);
    setImportSpecialistUid("");
    setImportSpecialistPercentage("");
    setImportRecommenders([]);
    setImportSummaryOpen(true);
  }

  const importDialog = (
    <>
    <Dialog open={importDialogOpen} onOpenChange={(open) => {
      setImportDialogOpen(open);
      if (!open) { setImportFile(null); setImportResult(null); setImportStep(1); setImportSpecialistUid(""); setImportSpecialistPercentage(""); setImportRecommenders([]); }
    }}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle data-testid="text-import-title">
            {importStep === 1 ? "Hromadný import zmlúv" : `Získatelia + Rozdelenie odmien (${importCreatedIds.length} zmlúv)`}
          </DialogTitle>
          {importStep === 2 && (
            <p className="text-xs text-muted-foreground">
              Krok 2 z 2 — Priradte špecialistu a odporúčateľov pre všetkých {importCreatedIds.length} importovaných zmlúv.
            </p>
          )}
        </DialogHeader>
        <DialogScrollContent>

        {importStep === 1 && (
        <div className="space-y-2 text-justify">
          <p className="text-xs text-muted-foreground">
            Nahrajte Excel (.xlsx) alebo CSV súbor so stĺpcami A–S. Mapovanie 1:1 — systém stĺpce neprehadzuje.
          </p>

          <div className="border rounded overflow-hidden">
            <div className="bg-muted/50 px-2 py-0.5 text-[10px] font-medium border-b grid grid-cols-3">
              <span>Krok 1: Partner &amp; zmluva (A–F)</span>
              <span>Krok 2: Klient / subjekt (G–M)</span>
              <span>Krok 3: Získateľ (N–S)</span>
            </div>
            <div className="grid grid-cols-3 text-[10px]">
              <div className="border-r">
                <div className="flex border-b px-1.5 py-px"><span className="font-mono w-5">A</span><span>partner</span><span className="ml-auto text-red-400">*</span></div>
                <div className="flex border-b px-1.5 py-px bg-muted/10"><span className="font-mono w-5">B</span><span>produkt</span><span className="ml-auto text-red-400">*</span></div>
                <div className="flex border-b px-1.5 py-px"><span className="font-mono w-5">C</span><span>typ_zmluvy</span><span className="ml-auto text-muted-foreground">—</span></div>
                <div className="flex border-b px-1.5 py-px bg-muted/10"><span className="font-mono w-5">D</span><span>datum_uzatvorenia</span><span className="ml-auto text-muted-foreground">—</span></div>
                <div className="flex border-b px-1.5 py-px"><span className="font-mono w-5">E</span><span>cislo_navrhu</span><span className="ml-auto text-amber-400">***</span></div>
                <div className="flex px-1.5 py-px bg-muted/10"><span className="font-mono w-5">F</span><span>cislo_zmluvy</span><span className="ml-auto text-amber-400">***</span></div>
              </div>
              <div className="border-r">
                <div className="flex border-b px-1.5 py-px"><span className="font-mono w-5">G</span><span>typ_subjektu</span><span className="ml-auto text-red-400">*</span></div>
                <div className="flex border-b px-1.5 py-px bg-muted/10"><span className="font-mono w-5">H</span><span>rc_ico</span><span className="ml-auto text-amber-400">**</span></div>
                <div className="flex border-b px-1.5 py-px"><span className="font-mono w-5">I</span><span>nazov_firmy</span><span className="ml-auto text-amber-400">**</span></div>
                <div className="flex border-b px-1.5 py-px bg-muted/10"><span className="font-mono w-5">J</span><span>titul_pred</span><span className="ml-auto text-muted-foreground">—</span></div>
                <div className="flex border-b px-1.5 py-px"><span className="font-mono w-5">K</span><span>meno</span><span className="ml-auto text-amber-400">**</span></div>
                <div className="flex border-b px-1.5 py-px bg-muted/10"><span className="font-mono w-5">L</span><span>priezvisko</span><span className="ml-auto text-amber-400">**</span></div>
                <div className="flex px-1.5 py-px"><span className="font-mono w-5">M</span><span>titul_za</span><span className="ml-auto text-muted-foreground">—</span></div>
              </div>
              <div>
                <div className="flex border-b px-1.5 py-px"><span className="font-mono w-5">N</span><span>specialista_uid</span><span className="ml-auto text-red-400">*</span></div>
                <div className="flex border-b px-1.5 py-px bg-muted/10"><span className="font-mono w-5">O</span><span>specialista_%</span><span className="ml-auto text-red-400">*</span></div>
                <div className="flex border-b px-1.5 py-px"><span className="font-mono w-5">P</span><span>odporucitel1_uid</span><span className="ml-auto text-muted-foreground">—</span></div>
                <div className="flex border-b px-1.5 py-px bg-muted/10"><span className="font-mono w-5">Q</span><span>odporucitel1_%</span><span className="ml-auto text-muted-foreground">—</span></div>
                <div className="flex border-b px-1.5 py-px"><span className="font-mono w-5">R</span><span>odporucitel2_uid</span><span className="ml-auto text-muted-foreground">—</span></div>
                <div className="flex px-1.5 py-px bg-muted/10"><span className="font-mono w-5">S</span><span>odporucitel2_%</span><span className="ml-auto text-muted-foreground">—</span></div>
              </div>
            </div>
          </div>

          <div className="text-[9px] text-muted-foreground leading-tight">
            <span className="text-red-400 font-semibold">*</span> povinné &nbsp; <span className="text-amber-400 font-semibold">**</span> podľa typu &nbsp; <span className="text-amber-400 font-semibold">***</span> buď E alebo F &nbsp;·&nbsp; <span className="font-semibold">FO</span>: rc_ico+meno+priezvisko &nbsp; <span className="font-semibold">PO</span>: ico+firma &nbsp; <span className="font-semibold">SZCO</span>: rc_ico+firma+meno+priezvisko
          </div>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded px-3 py-2 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-red-500 font-bold text-xs mt-px">1.</span>
              <p className="text-[11px] text-red-500 leading-snug">Ak nie su zadani odporucitelia, specialista bude automaticky pridany ako odporucitel s 0%.</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-500 font-bold text-xs mt-px">2.</span>
              <p className="text-[11px] text-red-500 leading-snug">Ak specialista nema 100% a odporucitel nie je vypisany, zmluva bude nahrata ale oznacena ako chybna.</p>
            </div>
          </div>

          <div className="bg-muted/30 rounded px-2 py-1 font-mono text-[9px] text-muted-foreground">
            <span className="text-foreground/60">Ukážka:</span> Allianz | PZP Auto | Nova | 10.03.2026 | N-2024-001 | | person | 850101/1234 | | | Jan | Novak | | 421000000000002 | 100 | | | |
          </div>

          <div className="flex items-center gap-2 flex-wrap">
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
            <Button variant="outline" size="sm" onClick={() => importFileRef.current?.click()} data-testid="button-choose-file">
              <Upload className="w-3.5 h-3.5 mr-1" />
              Vybrať súbor
            </Button>
            <span className="text-xs text-muted-foreground truncate max-w-[250px]" data-testid="text-selected-file">
              {importFile ? importFile.name : "Žiadny súbor"}
            </span>
          </div>

        </div>
        )}

        {importStep === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Priradenie získateľov a rozdelenie odmien pre všetkých {importCreatedIds.length} importovaných zmlúv.
            </p>

            <div className="space-y-3 border rounded-md p-4" data-testid="section-import-reward-distributions">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Získatelia a odmeny</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={importRewardTotal > 100 ? "destructive" : importRewardTotal === 100 ? "default" : "outline"} className="text-[10px] font-mono" data-testid="badge-import-reward-total">
                    {importRewardTotal}% / 100%
                  </Badge>
                  <span className="text-[10px] text-muted-foreground" style={{ visibility: importRewardRemaining > 0 && importRewardTotal <= 100 ? 'visible' : 'hidden' }}>
                    Zostava: {importRewardRemaining}%
                  </span>
                </div>
              </div>

              <div className={`rounded-md p-2 ${importRewardTotal === 100 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                <p className={`text-xs font-medium ${importRewardTotal === 100 ? 'text-emerald-600' : 'text-destructive'}`} data-testid="text-import-reward-status">
                  {importRewardTotal === 100
                    ? `Celkovy sucet odmien je 100,00 % - Ulozenie je povolene.`
                    : `Celkovy sucet odmien nie je 100,00 % (${importRewardTotal.toFixed(2).replace(".", ",")} %) - Ulozenie je zablokovane.`
                  }
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-md p-3 space-y-2" data-testid="panel-import-specialist">
                  <div className="flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Odmena pre specialistu</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Osoba zodpovedna za spravnost zmluvy</p>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-muted-foreground">UID specialistu</label>
                      <div className="relative">
                        <Input
                          ref={refImportSpecialistUid}
                          placeholder="UID alebo meno..."
                          value={importSpecialistUid}
                          onChange={e => {
                            setImportSpecialistUid(e.target.value);
                            setImportRewardSearchSpecialist(e.target.value);
                          }}
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val && /^\d+$/.test(val.replace(/\s/g, ''))) {
                              setImportSpecialistUid(expandUid(val));
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val && /^\d+$/.test(val.replace(/\s/g, ''))) {
                                setImportSpecialistUid(expandUid(val));
                              }
                              setImportRewardSearchSpecialist("");
                              refImportSpecialistPct.current?.focus();
                            }
                          }}
                          className="font-mono text-sm"
                          data-testid="input-import-specialist-uid"
                        />
                        {(() => {
                          const searchLower = importRewardSearchSpecialist.toLowerCase().trim();
                          const filtered = searchLower && searchLower.length >= 2
                            ? (appUsersAll || []).filter(u =>
                                (`${u.firstName || ""} ${u.lastName || ""} ${u.username || ""} ${u.uid || ""}`.toLowerCase().includes(searchLower))
                              )
                            : [];
                          return (
                            <div className="absolute top-full left-0 right-0 z-50 border rounded-md bg-popover max-h-[120px] overflow-y-auto" style={{ display: filtered.length > 0 ? 'block' : 'none' }} data-testid="list-import-specialist-suggestions">
                              {filtered.slice(0, 8).map(u => (
                                <div
                                  key={u.id}
                                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover-elevate text-sm"
                                  onClick={() => {
                                    setImportSpecialistUid(u.uid || "");
                                    setImportRewardSearchSpecialist("");
                                  }}
                                  data-testid={`row-import-specialist-${u.id}`}
                                >
                                  <span className="font-medium text-xs">{u.firstName || ""} {u.lastName || ""}</span>
                                  <span className="text-xs text-muted-foreground font-mono ml-auto">{formatUid(u.uid)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      {(() => {
                        const lookup = lookupSubjectByUid(importSpecialistUid);
                        if (!lookup.label) return null;
                        return <p className={`text-[11px] mt-0.5 font-medium ${lookup.found ? 'text-emerald-500' : 'text-destructive'}`} data-testid="text-import-specialist-lookup">{lookup.label}</p>;
                      })()}
                    </div>
                    <div className="w-[100px] space-y-1">
                      <label className="text-xs text-muted-foreground">Podiel (%)</label>
                      <div className="relative">
                        <Input
                          ref={refImportSpecialistPct}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0"
                          value={importSpecialistPercentage}
                          onChange={e => setImportSpecialistPercentage(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (parseFloat(importSpecialistPercentage) === 100) {
                                return;
                              }
                              setImportAddingRecommender(true);
                              setImportNewRecommenderUid("");
                              setImportNewRecommenderPercentage("");
                              setImportRewardSearchRecommender("");
                              setTimeout(() => {
                                const el = document.querySelector('[data-testid="input-import-new-recommender-uid"]') as HTMLInputElement;
                                el?.focus();
                              }, 100);
                            }
                          }}
                          className="pr-8 font-mono text-sm"
                          data-testid="input-import-specialist-percentage"
                        />
                        <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Ak nie su zadani odporucitelia, specialista bude automaticky pridany ako odporucitel s 0%.
                  </p>
                </div>

                <div className="border rounded-md p-3 space-y-2" data-testid="panel-import-recommenders">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Odporucitelia</span>
                      <Badge variant="outline" className="text-[10px]">{importRecommenders.length}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2"
                      onClick={() => {
                        setImportAddingRecommender(true);
                        setImportNewRecommenderUid("");
                        setImportNewRecommenderPercentage("");
                        setImportRewardSearchRecommender("");
                      }}
                      data-testid="button-import-add-recommender"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Pridat
                    </Button>
                  </div>

                  <div className="border rounded-md p-2 space-y-2" style={{ display: importAddingRecommender ? 'block' : 'none' }} data-testid="panel-import-add-recommender">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-muted-foreground">UID odporucitela</label>
                        <div className="relative">
                          <Input
                            placeholder="UID alebo meno..."
                            value={importNewRecommenderUid}
                            onChange={e => {
                              setImportNewRecommenderUid(e.target.value);
                              setImportRewardSearchRecommender(e.target.value);
                            }}
                            onBlur={e => {
                              const val = e.target.value.trim();
                              if (val && /^\d+$/.test(val.replace(/\s/g, ''))) {
                                setImportNewRecommenderUid(expandUid(val));
                              }
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = e.currentTarget.value.trim();
                                if (val && /^\d+$/.test(val.replace(/\s/g, ''))) {
                                  setImportNewRecommenderUid(expandUid(val));
                                }
                                setImportRewardSearchRecommender("");
                                const pctEl = document.querySelector('[data-testid="input-import-new-recommender-percentage"]') as HTMLInputElement;
                                pctEl?.focus();
                              }
                            }}
                            className="font-mono text-sm"
                            data-testid="input-import-new-recommender-uid"
                          />
                          {(() => {
                            const searchLower = importRewardSearchRecommender.toLowerCase().trim();
                            const filtered = searchLower && searchLower.length >= 2
                              ? (appUsersAll || []).filter(u =>
                                  (`${u.firstName || ""} ${u.lastName || ""} ${u.username || ""} ${u.uid || ""}`.toLowerCase().includes(searchLower))
                                )
                              : [];
                            return (
                              <div className="absolute top-full left-0 right-0 z-50 border rounded-md bg-popover max-h-[120px] overflow-y-auto" style={{ display: filtered.length > 0 ? 'block' : 'none' }} data-testid="list-import-recommender-suggestions">
                                {filtered.slice(0, 8).map(u => (
                                  <div
                                    key={u.id}
                                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover-elevate text-sm"
                                    onClick={() => {
                                      setImportNewRecommenderUid(u.uid || "");
                                      setImportRewardSearchRecommender("");
                                    }}
                                    data-testid={`row-import-recommender-${u.id}`}
                                  >
                                    <span className="font-medium text-xs">{u.firstName || ""} {u.lastName || ""}</span>
                                    <span className="text-xs text-muted-foreground font-mono ml-auto">{formatUid(u.uid)}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        {(() => {
                          const lookup = lookupSubjectByUid(importNewRecommenderUid);
                          if (!lookup.label) return null;
                          return <p className={`text-[11px] mt-0.5 font-medium ${lookup.found ? 'text-emerald-500' : 'text-destructive'}`} data-testid="text-import-recommender-lookup">{lookup.label}</p>;
                        })()}
                      </div>
                      <div className="w-[100px] space-y-1">
                        <label className="text-xs text-muted-foreground">Podiel (%)</label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="0"
                            value={importNewRecommenderPercentage}
                            onChange={e => setImportNewRecommenderPercentage(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const btn = document.querySelector('[data-testid="button-import-confirm-recommender"]') as HTMLButtonElement;
                                btn?.click();
                              }
                            }}
                            className="pr-8 font-mono text-sm"
                            data-testid="input-import-new-recommender-percentage"
                          />
                          <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setImportAddingRecommender(false)}
                        data-testid="button-import-cancel-recommender"
                      >
                        Zrusit
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!importNewRecommenderUid.trim()) {
                            toast({ title: "Chyba", description: "Zadajte UID odporucitela", variant: "destructive" });
                            return;
                          }
                          const newTotal = importRewardTotal + (parseFloat(importNewRecommenderPercentage) || 0);
                          if (newTotal > 100) {
                            toast({ title: "Chyba", description: `Sucet percent by presahoval 100% (${newTotal.toFixed(2)}%)`, variant: "destructive" });
                            return;
                          }
                          setImportRecommenders(prev => [...prev, { uid: importNewRecommenderUid.trim(), percentage: importNewRecommenderPercentage || "0" }]);
                          setImportNewRecommenderUid("");
                          setImportNewRecommenderPercentage("");
                          setImportRewardSearchRecommender("");
                          setImportAddingRecommender(false);
                        }}
                        data-testid="button-import-confirm-recommender"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Potvrdit
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1" data-testid="list-import-recommenders">
                    {importRecommenders.map((rec, idx) => {
                      const lookup = lookupSubjectByUid(rec.uid);
                      return (
                        <div key={`${rec.uid}-${idx}`} className="flex items-center gap-2 px-2 py-1 border rounded-md bg-muted/30 text-xs" data-testid={`row-import-recommender-${idx}`}>
                          <Users className="w-3 h-3 text-primary flex-shrink-0" />
                          <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">{formatUid(rec.uid)}</span>
                          <span className={`font-medium truncate ${lookup.found ? 'text-emerald-500' : 'text-destructive'}`}>{lookup.label}</span>
                          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={rec.percentage}
                              onChange={e => {
                                const val = e.target.value;
                                setImportRecommenders(prev => prev.map((r, i) => i === idx ? { ...r, percentage: val } : r));
                              }}
                              className="w-16 h-6 text-[11px] font-mono text-right"
                              data-testid={`input-import-recommender-percentage-${idx}`}
                            />
                            <span className="text-[10px] text-muted-foreground">%</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setImportRecommenders(prev => prev.filter((_, i) => i !== idx))}
                            data-testid={`button-import-remove-recommender-${idx}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                    <div style={{ display: importRecommenders.length === 0 && importSpecialistUid ? 'block' : 'none' }}>
                      <div className="flex items-center gap-2 px-2 py-1 border rounded-md bg-muted/20 border-dashed text-xs" data-testid="row-import-autofill-recommender">
                        <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground italic truncate">
                          {(() => {
                            const user = (appUsersAll || []).find(u => u.uid === importSpecialistUid);
                            return user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username : importSpecialistUid;
                          })()}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">0% (auto)</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Specialista bude automaticky pridany ako odporucitel s 0% pri ulozeni.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        </DialogScrollContent>
        <DialogFooter className="flex !justify-between">
          {importStep === 1 && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="mr-auto text-xs"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = "/api/import-contracts-template";
                  a.download = "sablona_import_zmluv.xlsx";
                  a.click();
                }}
                data-testid="button-download-template"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Stiahnuť šablónu
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setImportDialogOpen(false)} data-testid="button-import-cancel">
                  Zavrieť
                </Button>
                <Button onClick={() => setImportConfirmOpen(true)} disabled={!importFile || importLoading} data-testid="button-import-submit">
                  {importLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Importovať
                </Button>
              </div>
            </>
          )}
          {importStep === 2 && (
            <>
              <Button onClick={handleImportRewardSave} disabled={importRewardSaving || importRewardTotal !== 100 || !importSpecialistUid || importRecommenders.some(r => !lookupSubjectByUid(r.uid).found) || !lookupSubjectByUid(importSpecialistUid).found} data-testid="button-import-save-rewards">
                {importRewardSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Uložiť odmeny
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <AlertDialog open={importConfirmOpen} onOpenChange={setImportConfirmOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Potvrdiť hromadný import</AlertDialogTitle>
          <AlertDialogDescription className="text-justify">
            Hromadný import môže upraviť citlivé dáta (RČ/IČO, osobné údaje). Potvrdením súhlasíte s vytvorením auditného záznamu pre každý importovaný riadok.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-import-confirm-cancel">Zrušiť</AlertDialogCancel>
          <AlertDialogAction data-testid="button-import-confirm-ok" onClick={() => {
            setImportConfirmOpen(false);
            fetch("/api/click-log", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ module: "BULK_IMPORT_CONFIRM", action: "CONFIRM_IMPORT" }),
              credentials: "include",
            }).catch(() => {});
            handleExcelImport();
          }}>
            Potvrdiť import
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog open={nameConfirmOpen} onOpenChange={(open) => {
      setNameConfirmOpen(open);
      if (!open) setNameConfirmContract(null);
    }}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle data-testid="text-name-confirm-title">Potvrdenie mena</DialogTitle>
        </DialogHeader>
        {nameConfirmContract && (() => {
          const sub = subjects?.find((s: any) => s.id === nameConfirmContract.subjectId);
          if (!sub) return <p className="text-sm text-muted-foreground">Subjekt nenájdený</p>;
          return (
            <div className="space-y-4">
              <div className="border border-orange-500/30 rounded p-3 bg-orange-500/5">
                <p className="text-xs text-orange-400 flex items-center gap-1 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">Obe slová vyzerajú ako krstné meno</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Meno</p>
                    <p className="text-sm font-semibold" data-testid="text-confirm-firstname">{sub.firstName || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">Priezvisko</p>
                    <p className="text-sm font-semibold" data-testid="text-confirm-lastname">{sub.lastName || "—"}</p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground text-justify">
                Ak je poradie správne, kliknite „Potvrdiť". Ak chcete prehodiť meno a priezvisko, kliknite „Prehodiť".
              </p>
            </div>
          );
        })()}
        <DialogFooter className="flex justify-between gap-2">
          <Button variant="outline" size="sm" disabled={nameConfirmLoading} onClick={async () => {
            if (!nameConfirmContract) return;
            setNameConfirmLoading(true);
            try {
              await apiRequest("PATCH", `/api/contracts/${nameConfirmContract.id}/confirm-name`, { swap: true });
              queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
              queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
              toast({ title: "Úspech", description: "Meno a priezvisko prehodené a potvrdené" });
              setNameConfirmOpen(false);
              setNameConfirmContract(null);
            } catch (err: any) {
              toast({ title: "Chyba", description: err.message || "Nepodarilo sa prehodiť meno", variant: "destructive" });
            } finally {
              setNameConfirmLoading(false);
            }
          }} data-testid="button-swap-name">
            <ArrowLeftRight className="w-3.5 h-3.5 mr-1" />
            Prehodiť
          </Button>
          <Button size="sm" disabled={nameConfirmLoading} onClick={async () => {
            if (!nameConfirmContract) return;
            setNameConfirmLoading(true);
            try {
              await apiRequest("PATCH", `/api/contracts/${nameConfirmContract.id}/confirm-name`, { swap: false });
              queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
              toast({ title: "Úspech", description: "Meno potvrdené" });
              setNameConfirmOpen(false);
              setNameConfirmContract(null);
            } catch (err: any) {
              toast({ title: "Chyba", description: err.message || "Nepodarilo sa potvrdiť meno", variant: "destructive" });
            } finally {
              setNameConfirmLoading(false);
            }
          }} data-testid="button-confirm-name">
            <Check className="w-3.5 h-3.5 mr-1" />
            Potvrdiť
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={importSummaryOpen} onOpenChange={(open) => {
      setImportSummaryOpen(open);
      if (!open) setImportResult(null);
    }}>
      <DialogContent size="xl" className="max-w-[98vw] w-full">
        <DialogHeader>
          <DialogTitle data-testid="text-import-summary-title">Výsledok importu</DialogTitle>
        </DialogHeader>
        {importResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 justify-center flex-wrap">
              <div className="text-center px-4 py-2 rounded border border-green-500/30 bg-green-500/5">
                <p className="text-2xl font-bold text-green-500" data-testid="text-summary-ok">{(importResult.success || 0) - (importResult.incomplete || 0)}</p>
                <p className="text-[11px] text-muted-foreground">Úspešne</p>
              </div>
              {(importResult.incomplete || 0) > 0 && (
                <div className="text-center px-4 py-2 rounded border border-red-500/30 bg-red-500/5">
                  <p className="text-2xl font-bold text-red-500" data-testid="text-summary-incomplete">{importResult.incomplete}</p>
                  <p className="text-[11px] text-muted-foreground">Vyžaduje opravu</p>
                </div>
              )}
              {(importResult.errors || 0) > 0 && (
                <div className="text-center px-4 py-2 rounded border border-destructive/30 bg-destructive/5">
                  <p className="text-2xl font-bold text-destructive" data-testid="text-summary-errors">{importResult.errors}</p>
                  <p className="text-[11px] text-muted-foreground">Odmietnutých</p>
                </div>
              )}
              {(importResult.duplicates || 0) > 0 && (
                <div className="text-center px-4 py-2 rounded border border-yellow-500/30 bg-yellow-500/5">
                  <p className="text-2xl font-bold text-yellow-500" data-testid="text-summary-duplicates">{importResult.duplicates}</p>
                  <p className="text-[11px] text-muted-foreground">Duplikátov</p>
                </div>
              )}
              {(importResult.nameConfirmationNeeded || 0) > 0 && (
                <div className="text-center px-4 py-2 rounded border border-orange-500/30 bg-orange-500/5">
                  <p className="text-2xl font-bold text-orange-500" data-testid="text-summary-name-confirm">{importResult.nameConfirmationNeeded}</p>
                  <p className="text-[11px] text-muted-foreground">Sporné mená</p>
                </div>
              )}
              <div className="text-center px-4 py-2 rounded border border-border bg-muted/20">
                <p className="text-2xl font-bold">{importResult.total}</p>
                <p className="text-[11px] text-muted-foreground">Celkom</p>
              </div>
            </div>

            {(importResult.errors || 0) > 0 && (
              <div className="border border-red-500/30 rounded p-2 bg-red-500/5">
                <p className="text-xs text-red-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">Odmietnuté riadky — chýbajú povinné údaje. Opravte Excel a importujte znova.</span>
                </p>
              </div>
            )}
            {(importResult.duplicates || 0) > 0 && (
              <div className="border border-yellow-500/30 rounded p-2 bg-yellow-500/5">
                <p className="text-xs text-yellow-500 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">Duplikáty preskočené — zmluvy s týmito číslami návrhu/zmluvy už existujú v systéme.</span>
                </p>
              </div>
            )}

            {(importResult.nameConfirmationNeeded || 0) > 0 && (
              <div className="border border-orange-500/30 rounded p-2 bg-orange-500/5">
                <p className="text-xs text-orange-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span className="font-semibold">Sporné mená — meno a priezvisko mohli byť zamenené. Kliknite na riadok pre potvrdenie.</span>
                </p>
              </div>
            )}

            {importResult.details && importResult.details.length > 0 && (
              <div className="overflow-auto max-h-[55vh] border border-border rounded">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="text-xs w-8 sticky left-0 bg-card z-20">#</TableHead>
                      <TableHead className="text-xs w-8 sticky left-8 bg-card z-20">!</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">A: Partner</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">B: Produkt</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">C: Č. návrhu</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">D: Č. zmluvy</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">E: Typ subjektu</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">F: RČ / IČO</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">G: Názov firmy</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">H: Klient</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">L: Špecialist UID</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">M: Špecialist %</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">N: Odporúčateľ 1 UID</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">O: Odporúčateľ 1 %</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">P: Odporúčateľ 2 UID</TableHead>
                      <TableHead className="text-xs whitespace-nowrap">Q: Odporúčateľ 2 %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importResult.details.map((row: any, i: number) => {
                      const rd = row.rawData || {};
                      const isErr = row.status === "error";
                      const isInc = row.status === "incomplete";
                      const isDup = row.status === "duplicate";
                      const hasRcError = !!row.rcCritical;
                      const hasIcoError = !!row.icoCritical;
                      return (
                        <TableRow key={i} className={isErr ? "bg-destructive/5" : (hasRcError || hasIcoError) ? "bg-red-500/10" : isInc ? "bg-red-500/5" : isDup ? "bg-yellow-500/5" : ""} data-testid={`row-import-result-${i}`}>
                          <TableCell className="text-xs text-muted-foreground sticky left-0 bg-inherit">{row.row ?? i + 2}</TableCell>
                          <TableCell className="sticky left-8 bg-inherit">
                            {isErr ? (
                              <span title={row.error}><XCircle className="w-4 h-4 text-destructive" /></span>
                            ) : hasRcError ? (
                              <span className="flex items-center gap-1" title={row.rcValidationError || row.incompleteFields?.join(", ")}>
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <span className="text-[9px] text-red-500 font-semibold whitespace-nowrap">Kritická chyba RČ</span>
                              </span>
                            ) : hasIcoError ? (
                              <span className="flex items-center gap-1" title={row.icoValidationError || row.incompleteFields?.join(", ")}>
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <span className="text-[9px] text-red-500 font-semibold whitespace-nowrap">Kritická chyba IČO</span>
                              </span>
                            ) : isInc ? (
                              <span title={row.incompleteFields?.join(", ")}><AlertTriangle className="w-4 h-4 text-red-500" /></span>
                            ) : isDup ? (
                              <span title={`Duplikát: ${row.duplicateNumber}`}><AlertTriangle className="w-4 h-4 text-yellow-500" /></span>
                            ) : (
                              <Check className="w-4 h-4 text-green-500" />
                            )}
                          </TableCell>
                          <TableCell className="text-xs">{rd.partner || <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs">{rd.produkt || <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs font-mono">{rd.cislo_navrhu || <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs font-mono">{rd.cislo_zmluvy || <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs">{rd.typ_subjektu || <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs font-mono">{rd.rc_ico || <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs max-w-[120px] truncate" title={rd.nazov_firmy || ""}>{rd.nazov_firmy || <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap max-w-[200px] truncate" title={[rd.titul_pred, rd.meno, rd.priezvisko, rd.titul_za ? `, ${rd.titul_za}` : ""].filter(Boolean).join(" ") || "—"}>
                            {(rd.meno || rd.priezvisko) ? (
                              <span>{[rd.titul_pred, rd.meno, rd.priezvisko].filter(Boolean).join(" ")}{rd.titul_za ? <span className="text-muted-foreground">, {rd.titul_za}</span> : null}</span>
                            ) : <span className="text-muted-foreground/30">—</span>}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{rd.specialista ? formatUid(rd.specialista) : <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs text-right">{rd.specialista_podiel != null ? `${rd.specialista_podiel}%` : <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{rd.odporucitel ? formatUid(rd.odporucitel) : <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs text-right">{rd.odporucitel_podiel != null ? `${rd.odporucitel_podiel}%` : <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">{rd.odporucitel2 ? formatUid(rd.odporucitel2) : <span className="text-muted-foreground/30">—</span>}</TableCell>
                          <TableCell className="text-xs text-right">{rd.odporucitel2_podiel != null ? `${rd.odporucitel2_podiel}%` : <span className="text-muted-foreground/30">—</span>}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Celkom spracovaných: {importResult.total}
              {(importResult.created || 0) > 0 && <> · Nových klientov: {importResult.created}</>}
              {(importResult.updated || 0) > 0 && <> · Aktualizovaných: {importResult.updated}</>}
            </p>
          </div>
        )}
        <DialogFooter>
          <Button onClick={() => { setImportSummaryOpen(false); setImportResult(null); }} data-testid="button-import-summary-close">
            Rozumiem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );

  const preSelectFilteredProducts = (() => {
    if (!products) return [];
    if (!preSelectPartnerId) return products.filter(p => !p.isDeleted);
    return products.filter(p => !p.isDeleted && p.partnerId === parseInt(preSelectPartnerId));
  })();

  const handlePreSelectStep1Next = async () => {
    const cnVal = preSelectNumberType === "contract" ? preSelectNumberValue.trim() : preSelectNumberType === "both" ? preSelectNumberValue2.trim() : "";
    const pnVal = preSelectNumberType === "proposal" || preSelectNumberType === "both" ? preSelectNumberValue.trim() : "";
    if (cnVal || pnVal) {
      setPreSelectCheckingDuplicates(true);
      try {
        const params = new URLSearchParams();
        if (cnVal) params.set("contractNumber", cnVal);
        if (pnVal) params.set("proposalNumber", pnVal);
        const res = await fetch(`/api/contracts/check-number-duplicates?${params.toString()}`, { credentials: "include" });
        const dupes = await res.json();
        if (Array.isArray(dupes) && dupes.length > 0) {
          setPreSelectNumberDuplicates(dupes);
          setPreSelectCheckingDuplicates(false);
          return;
        }
      } catch {}
      setPreSelectCheckingDuplicates(false);
    }
    setPreSelectNumberDuplicates([]);
    setPreSelectStep(2);
    setPreSelectSubjectSearch("");
    setPreSelectSubjectId("");
  };

  useEffect(() => {
    if (preSelectStep === 2) {
      const t = setTimeout(() => {
        const activeRadio = document.querySelector('[data-testid="toggle-subject-type"] button[aria-checked="true"]') as HTMLElement;
        if (activeRadio) { activeRadio.focus(); } else { refSearchInput.current?.focus(); }
      }, 150);
      return () => clearTimeout(t);
    }
  }, [preSelectStep]);

  useEffect(() => {
    const d = preSelectSignedDay;
    const m = preSelectSignedMonth;
    let y = preSelectSignedYear;
    if (y.length === 2 && /^\d{2}$/.test(y)) y = "20" + y;
    if (d && m && y.length === 4) {
      setPreSelectSignedDate(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
    } else {
      setPreSelectSignedDate("");
    }
  }, [preSelectSignedDay, preSelectSignedMonth, preSelectSignedYear]);

  useEffect(() => {
    if (!preSelectOpen || preSelectStep !== 1) return;
    const handleShiftEnter = (e: KeyboardEvent) => {
      if (!e.shiftKey || e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      const fields: HTMLElement[] = [
        refPartnerTrigger.current,
        refProductTrigger.current,
        refContractTypeTrigger.current,
        refSignedDay.current,
        refSignedMonth.current,
        refSignedYear.current,
        refTimeBtnNone.current,
        ...(preSelectWithTime && refSignedTimeInput.current ? [refSignedTimeInput.current] : []),
        (preSelectNumberType === "contract" ? refNumberToggleContract.current : refNumberToggleProposal.current),
        refNumberInput.current,
      ].filter(Boolean) as HTMLElement[];
      const active = document.activeElement;
      const idx = fields.findIndex(el => el === active || el.contains(active as Node));
      if (idx > 0) fields[idx - 1].focus();
    };
    document.addEventListener("keydown", handleShiftEnter, true);
    return () => document.removeEventListener("keydown", handleShiftEnter, true);
  }, [preSelectOpen, preSelectStep, preSelectWithTime, preSelectNumberType]);

  useEffect(() => {
    if (preSelectOpen && preSelectStep === 2) {
      setTimeout(() => refSearchInput.current?.focus(), 150);
    }
  }, [preSelectOpen, preSelectStep]);

  const handlePreSelectStep1ForceNext = () => {
    setPreSelectNumberDuplicates([]);
    setPreSelectStep(2);
    setPreSelectSubjectSearch("");
    setPreSelectSubjectId("");
  };

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
    setPreSelectSearchHint(null);
    setPreSelectShowNameFields(false);
    setPreSelectIcoLookup(null);
    setPreSelectIcoLookupLoading(false);
    setPreSelectIcoError(null);
  };

  const triggerIcoLookup = () => {
    const val = preSelectIco.trim() || preSelectSubjectSearch.trim();
    if (!val) { setPreSelectIcoError(null); setPreSelectIcoLookup(null); return; }
    const result = validateSlovakICO(val);
    if (!result.valid) { setPreSelectIcoError(result.error || "Neplatné IČO"); setPreSelectIcoLookup(null); return; }
    setPreSelectIcoError(null);
    if (result.normalized) setPreSelectIco(result.normalized);

    if (preSelectSubjectType === "szco" || preSelectSubjectType === "organization") {
      setPreSelectIcoLookup(null);
      setPreSelectShowNameFields(true);
      return;
    }

    setPreSelectIcoLookupLoading(true);
    setPreSelectIcoLookup(null);
    const stateParam = activeStateId ? `&stateId=${activeStateId}` : "";
    fetch(`/api/lookup/ico/${encodeURIComponent(result.normalized || val)}?type=company${stateParam}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data.found) {
          setPreSelectIcoLookup(data);
          if (data.name) setPreSelectBusinessName(data.name);
          setPreSelectShowNameFields(true);
        } else {
          setPreSelectIcoLookup({ found: false, message: data.message || "Subjekt nenájdený v štátnych registroch" });
          setPreSelectShowNameFields(true);
        }
      })
      .catch(() => setPreSelectIcoLookup({ found: false, message: "Chyba pri vyhľadávaní v registroch" }))
      .finally(() => setPreSelectIcoLookupLoading(false));
  };

  const resetPreSelectDialog = () => {
    setPreSelectOpen(false);
    setPreSelectStep(1);
    setPreSelectContractType("Nova");
    setPreSelectPartnerId("");
    setPreSelectProductId("");
    setPreSelectSubjectSearch("");
    setPreSelectSubjectId("");
    setPreSelectClientTypeId("");
    setPreSelectNumberType("proposal");
    setPreSelectNumberValue("");
    setPreSelectNumberValue2("");
    setPreSelectNumberDuplicates([]);
    setPreSelectCheckingDuplicates(false);
    setPreSelectTitleBefore("");
    setPreSelectFirstName("");
    setPreSelectLastName("");
    setPreSelectTitleAfter("");
    setPreSelectSubjectType("person");
    setPreSelectIco("");
    setPreSelectBusinessName("");
    setPreSelectBirthNumber("");
    setPreSelectSearchHint(null);
    setPreSelectShowNameFields(false);
    setPreSelectIcoLookup(null);
    setPreSelectIcoLookupLoading(false);
    setPreSelectIcoError(null);
    setPreSelectIcoConfirmed(false);
    setPreSelectEditingContractId(null);
    setPreSelectFiles([]);
    setPreSelectCreatedContractId(null);
    setPreSelectUploading(false);
    setPreSelectSignedDate("");
    setPreSelectSignedDay("");
    setPreSelectSignedMonth("");
    setPreSelectSignedYear("");
    setPreSelectWithTime(false);
    setPreSelectSignedTime("");
    setPreSelectFileError(null);
    setPreSelectUploadedCount(0);
    setPreSelectSpecialistUid("");
    setPreSelectSpecialistPercentage("");
    setPreSelectRecommenders([]);
    setPreSelectRewardSearchSpecialist("");
    setPreSelectRewardSearchRecommender("");
    setPreSelectAddingRecommender(false);
    setPreSelectNewRecommenderUid("");
    setPreSelectNewRecommenderPercentage("");
  };

  const getFileExt = (name: string) => {
    const dot = name.lastIndexOf(".");
    return dot >= 0 ? name.substring(dot).toLowerCase() : "";
  };

  const validateAndAddFiles = (newFiles: File[]) => {
    setPreSelectFileError(null);

    if (!userCanUploadVideo) {
      const videoFiles = newFiles.filter(f => VIDEO_EXTENSIONS.has(getFileExt(f.name)));
      if (videoFiles.length > 0) {
        setPreSelectFileError(`Nahrávanie video súborov nie je povolené pre váš typ účtu.`);
        newFiles = newFiles.filter(f => !VIDEO_EXTENSIONS.has(getFileExt(f.name)));
      }
    }

    const tooLarge = newFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (tooLarge.length > 0) {
      setPreSelectFileError(`Súbor "${tooLarge[0].name}" je príliš veľký. Maximálny limit je 25 MB.`);
      newFiles = newFiles.filter(f => f.size <= MAX_FILE_SIZE);
    }
    if (newFiles.length === 0) return;
    setPreSelectFiles(prev => {
      const combined = [...prev, ...newFiles];
      if (combined.length > MAX_BATCH_FILES) {
        setPreSelectFileError(`Maximálny počet súborov v jednej dávke je ${MAX_BATCH_FILES}. Nadbytočné súbory boli odstránené.`);
        return combined.slice(0, MAX_BATCH_FILES);
      }
      const videoCount = combined.filter(f => VIDEO_EXTENSIONS.has(getFileExt(f.name))).length;
      if (videoCount > MAX_VIDEOS_PER_CONTRACT) {
        setPreSelectFileError(`Maximálny počet video súborov na zmluvu je ${MAX_VIDEOS_PER_CONTRACT}. Máte ich ${videoCount}.`);
      }
      const nonVideoCount = combined.length - videoCount;
      if (nonVideoCount > 95) {
        setPreSelectFileError(`Maximálny počet dokumentov (bez videí) na zmluvu je 95. Máte ich ${nonVideoCount}.`);
      }
      if (combined.length > MAX_DOCS_PER_CONTRACT) {
        setPreSelectFileError(`Maximálny celkový počet súborov na zmluvu je ${MAX_DOCS_PER_CONTRACT}. Máte ich ${combined.length}.`);
      }
      const totalSize = combined.reduce((sum, f) => sum + f.size, 0);
      if (totalSize > MAX_BATCH_SIZE) {
        setPreSelectFileError(`Celková veľkosť dávky presahuje 100 MB. Odstráňte niektoré súbory.`);
      }
      return combined;
    });
  };

  const handlePreSelectUploadAndFinish = async () => {
    if (!preSelectCreatedContractId) { resetPreSelectDialog(); return; }
    if (preSelectFiles.length === 0) { resetPreSelectDialog(); return; }
    const totalSize = preSelectFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_BATCH_SIZE) {
      setPreSelectFileError("Celková veľkosť dávky presahuje 100 MB. Odstráňte niektoré súbory.");
      return;
    }
    setPreSelectUploading(true);
    setPreSelectFileError(null);
    try {
      const formData = new FormData();
      preSelectFiles.forEach(f => formData.append("documents", f));
      const resp = await fetch(`/api/contracts/${preSelectCreatedContractId}/upload-documents`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.message || "Nepodarilo sa nahrať dokumenty");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      setPreSelectUploadedCount(prev => prev + preSelectFiles.length);
      toast({ title: "Úspech", description: `${preSelectFiles.length} dokument(ov) nahraných` });
      setPreSelectFiles([]);
      setPreSelectFileError(null);
      setPreSelectUploading(false);
    } catch (err: any) {
      setPreSelectUploading(false);
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa nahrať dokumenty", variant: "destructive" });
    }
  };

  const handlePreSelectSkipUpload = () => {
    resetPreSelectDialog();
  };

  const preSelectIsValid = (() => {
    if (preSelectSubjectId) return true;
    if (preSelectSubjectType === "person") return !!(preSelectFirstName.trim() && preSelectLastName.trim());
    if (preSelectSubjectType === "szco") return !!(preSelectBusinessName.trim() && preSelectFirstName.trim() && preSelectLastName.trim());
    if (preSelectSubjectType === "company" || preSelectSubjectType === "organization") return !!preSelectBusinessName.trim();
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
        if (preSelectSubjectType === "szco" || preSelectSubjectType === "company" || preSelectSubjectType === "organization") {
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
        contractType: preSelectContractType || "Nova",
      };
      if (preSelectPartnerId) contractData.partnerId = parseInt(preSelectPartnerId);
      if (preSelectProductId) contractData.productId = parseInt(preSelectProductId);
      if (preSelectSignedDate) {
        const dateStr = preSelectWithTime && preSelectSignedTime
          ? `${preSelectSignedDate}T${preSelectSignedTime}`
          : preSelectSignedDate;
        contractData.signedDate = new Date(dateStr).toISOString();
      }
      if (preSelectNumberType === "proposal" && preSelectNumberValue.trim()) {
        contractData.proposalNumber = preSelectNumberValue.trim();
      } else if (preSelectNumberType === "contract" && preSelectNumberValue.trim()) {
        contractData.contractNumber = preSelectNumberValue.trim();
      } else if (preSelectNumberType === "both") {
        if (preSelectNumberValue.trim()) contractData.proposalNumber = preSelectNumberValue.trim();
        if (preSelectNumberValue2.trim()) contractData.contractNumber = preSelectNumberValue2.trim();
      }

      let savedContractId: number | null = null;
      if (preSelectEditingContractId) {
        await apiRequest("PATCH", `/api/contracts/${preSelectEditingContractId}`, contractData);
        savedContractId = preSelectEditingContractId;
        toast({ title: "Úspech", description: "Zmluva bola doplnená" });
      } else {
        const createRes = await apiRequest("POST", "/api/contracts", contractData);
        const created = await createRes.json();
        savedContractId = created.id;
        toast({ title: "Úspech", description: "Zmluva zapísaná" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });

      if (savedContractId && (preSelectSpecialistUid || preSelectRecommenders.length > 0)) {
        const distributions: { type: string; uid: string; percentage: string; sortOrder: number }[] = [];
        if (preSelectSpecialistUid) {
          distributions.push({ type: "specialist", uid: preSelectSpecialistUid, percentage: preSelectSpecialistPercentage || "0", sortOrder: 0 });
          if (preSelectRecommenders.length === 0) {
            distributions.push({ type: "recommender", uid: preSelectSpecialistUid, percentage: "0", sortOrder: 1 });
          }
        }
        preSelectRecommenders.forEach((r, i) => {
          distributions.push({ type: "recommender", uid: r.uid, percentage: r.percentage || "0", sortOrder: i + 1 });
        });
        try {
          await apiRequest("POST", `/api/contracts/${savedContractId}/reward-distributions`, { distributions });
        } catch {}
      }

      setPreSelectCreatedContractId(savedContractId);
      setPreSelectStep(4);
      setPreSelectSaving(false);
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
    setPreSelectNumberValue2("");
    setPreSelectTitleBefore("");
    setPreSelectFirstName("");
    setPreSelectLastName("");
    setPreSelectTitleAfter("");
    setPreSelectSaving(false);
    setPreSelectSubjectType("person");
    setPreSelectIco("");
    setPreSelectBusinessName("");
    setPreSelectBirthNumber("");
    setPreSelectShowNameFields(false);
    setPreSelectEditingContractId(null);
    setPreSelectSpecialistUid("");
    setPreSelectSpecialistPercentage("");
    setPreSelectRecommenders([]);
    setPreSelectRewardSearchSpecialist("");
    setPreSelectRewardSearchRecommender("");
    setPreSelectAddingRecommender(false);
    setPreSelectNewRecommenderUid("");
    setPreSelectNewRecommenderPercentage("");
    setPreSelectSignedDate("");
    setPreSelectOpen(true);
  };

  const openQuickFix = (contract: Contract) => {
    setQuickFixContract(contract);
    setQuickFixPartnerId(contract.partnerId ? String(contract.partnerId) : "");
    setQuickFixProductId(contract.productId ? String(contract.productId) : "");
    const hasProposal = !!(contract.proposalNumber || "").trim();
    const hasContract2 = !!(contract.contractNumber || "").trim();
    if (hasProposal && hasContract2) {
      setQuickFixNumberType("both");
      setQuickFixNumberValue(contract.proposalNumber || "");
      setQuickFixNumberValue2(contract.contractNumber || "");
    } else if (hasContract2) {
      setQuickFixNumberType("contract");
      setQuickFixNumberValue(contract.contractNumber || "");
      setQuickFixNumberValue2("");
    } else {
      setQuickFixNumberType("proposal");
      setQuickFixNumberValue(contract.proposalNumber || "");
      setQuickFixNumberValue2("");
    }
    setQuickFixSubjectId(contract.subjectId ? String(contract.subjectId) : "");
    setQuickFixSubjectSearch("");
    setQuickFixOpen(true);
  };

  const handleQuickFixSave = async () => {
    setQuickFixSaving(true);
    try {
      const contractData: Record<string, any> = {};
      if (quickFixPartnerId) contractData.partnerId = parseInt(quickFixPartnerId);
      if (quickFixProductId) contractData.productId = parseInt(quickFixProductId);
      if (quickFixSubjectId) contractData.subjectId = parseInt(quickFixSubjectId);
      if (quickFixNumberType === "proposal" && quickFixNumberValue.trim()) {
        contractData.proposalNumber = quickFixNumberValue.trim();
      } else if (quickFixNumberType === "contract" && quickFixNumberValue.trim()) {
        contractData.contractNumber = quickFixNumberValue.trim();
      } else if (quickFixNumberType === "both") {
        if (quickFixNumberValue.trim()) contractData.proposalNumber = quickFixNumberValue.trim();
        if (quickFixNumberValue2.trim()) contractData.contractNumber = quickFixNumberValue2.trim();
      }
      await apiRequest("PATCH", `/api/contracts/${quickFixContract!.id}`, contractData);
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Uložené", description: "Zmluva bola aktualizovaná" });
      setQuickFixOpen(false);
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa uložiť", variant: "destructive" });
    } finally {
      setQuickFixSaving(false);
    }
  };

  const openIncompleteEdit = (contract: Contract, forceStep?: 1 | 2 | 3 | 4) => {
    setPreSelectEditingContractId(contract.id);

    const step1Ok = !!(contract.partnerId) && !!(contract.productId) && !!(((contract.proposalNumber || "").trim()) || ((contract.contractNumber || "").trim()));
    const step2Ok = !!(contract.subjectId);
    const startStep: 1 | 2 | 3 | 4 = forceStep ?? (!step1Ok ? 1 : !step2Ok ? 2 : 3);
    setPreSelectStep(startStep);
    setPreSelectSaving(false);
    setPreSelectShowNameFields(false);

    setPreSelectPartnerId(contract.partnerId ? String(contract.partnerId) : "");
    setPreSelectProductId(contract.productId ? String(contract.productId) : "");

    const hasProposal = !!(contract.proposalNumber || "").trim();
    const hasContract = !!(contract.contractNumber || "").trim();
    if (hasProposal && hasContract) {
      setPreSelectNumberType("both");
      setPreSelectNumberValue(contract.proposalNumber || "");
      setPreSelectNumberValue2(contract.contractNumber || "");
    } else if (hasContract) {
      setPreSelectNumberType("contract");
      setPreSelectNumberValue(contract.contractNumber || "");
      setPreSelectNumberValue2("");
    } else {
      setPreSelectNumberType("proposal");
      setPreSelectNumberValue(contract.proposalNumber || "");
      setPreSelectNumberValue2("");
    }

    const sub = subjects?.find(s => s.id === contract.subjectId);
    if (sub) {
      setPreSelectSubjectId(String(sub.id));
      setPreSelectSubjectType(sub.type as "person" | "company" | "szco" | "organization");
      setPreSelectFirstName(sub.firstName || "");
      setPreSelectLastName(sub.lastName || "");
      setPreSelectTitleBefore(sub.titleBefore || "");
      setPreSelectTitleAfter(sub.titleAfter || "");
      setPreSelectBirthNumber(sub.birthNumber || "");
      setPreSelectBusinessName(sub.companyName || "");
      setPreSelectIco((sub.details as any)?.ico || "");
    } else {
      setPreSelectSubjectId("");
      setPreSelectSubjectType("person");
      setPreSelectFirstName("");
      setPreSelectLastName("");
      setPreSelectTitleBefore("");
      setPreSelectTitleAfter("");
      setPreSelectBirthNumber("");
      setPreSelectBusinessName("");
      setPreSelectIco("");
    }

    setPreSelectSubjectSearch("");
    setPreSelectClientTypeId("");
    setPreSelectOpen(true);
  };

  const preSelectFilteredSubjects = (() => {
    if (!subjects || !preSelectSubjectSearch.trim()) return [];
    const q = preSelectSubjectSearch.toLowerCase().trim();
    return subjects.filter(s => {
      if (s.deletedAt) return false;
      const fullName = s.type === "company" || s.type === "organization"
        ? (s.companyName || "")
        : s.type === "szco"
        ? `${s.companyName || ""} ${s.firstName || ""} ${s.lastName || ""}`.trim()
        : `${s.firstName || ""} ${s.lastName || ""}`.trim();
      const birthNum = s.birthNumber || "";
      const icoFromDetails = (s.details as any)?.ico || (s.details as any)?.dynamicFields?.ico || "";
      const icoFromTop = (s as any).ico || "";
      const email = (s as any).email || "";
      const phone = (s as any).phone || "";
      return fullName.toLowerCase().includes(q)
        || birthNum.includes(q)
        || icoFromDetails.includes(q)
        || icoFromTop.includes(q)
        || email.toLowerCase().includes(q)
        || phone.includes(q)
        || (s.uid || "").replace(/\s/g, "").includes(q.replace(/\s/g, ""));
    });
  })();

  const rcBirthInfo = useMemo(() => {
    const rc = (preSelectBirthNumber || "").replace(/\//g, "").trim();
    if (!rc || rc.length < 9) return null;
    const rr = parseInt(rc.substring(0, 2), 10);
    let mm = parseInt(rc.substring(2, 4), 10);
    const dd = parseInt(rc.substring(4, 6), 10);
    if (isNaN(rr) || isNaN(mm) || isNaN(dd)) return null;
    let gender: string;
    if (mm > 70) { gender = "Žena"; mm -= 70; }
    else if (mm > 50) { gender = "Žena"; mm -= 50; }
    else if (mm > 20) { gender = "Muž"; mm -= 20; }
    else { gender = "Muž"; }
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    const currentYear = new Date().getFullYear();
    let year: number;
    if (rc.length === 9) {
      year = 1900 + rr;
    } else {
      year = rr >= 54 ? 1900 + rr : 2000 + rr;
      if (year > currentYear) year -= 100;
    }
    const dob = new Date(year, mm - 1, dd);
    if (isNaN(dob.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    if (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate())) age--;
    const formattedDate = `${String(dd).padStart(2, "0")}.${String(mm).padStart(2, "0")}.${year}`;
    return { dob: formattedDate, age, gender };
  }, [preSelectBirthNumber]);

  const preSelectDialog = (
    <Dialog open={preSelectOpen} onOpenChange={(open) => { if (!open) resetPreSelectDialog(); else setPreSelectOpen(true); }}>
      <DialogContent size="xl" onCloseAutoFocus={(e) => e.preventDefault()} data-testid="dialog-pre-select-contract">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle data-testid="text-preselect-title">
            {preSelectStep === 4 ? "Krok 4: Nahrať dokumenty" : preSelectStep === 3 ? (preSelectEditingContractId ? "Doplniť zmluvu — Krok 3: Získatelia" : "Krok 3: Získatelia a rozdelenie odmien") : preSelectEditingContractId ? (
              preSelectStep === 1 ? "Doplniť zmluvu — Krok 1: Partner a produkt" : "Doplniť zmluvu — Krok 2: Klient"
            ) : (
              preSelectStep === 1 ? "Krok 1: Vyber partnera a produktu" : "Krok 2: Vyber klienta (subjektu)"
            )}
          </DialogTitle>
        </DialogHeader>

        <DialogScrollContent>
        <div className="flex items-center gap-2 mb-2">
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${preSelectStep === 1 ? "bg-primary text-primary-foreground" : preSelectStep > 1 ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`} data-testid="step-indicator-1">1</div>
          <div className="flex-1 h-px bg-border" />
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${preSelectStep === 2 ? "bg-primary text-primary-foreground" : preSelectStep > 2 ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`} data-testid="step-indicator-2">2</div>
          <div className="flex-1 h-px bg-border" />
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${preSelectStep === 3 ? "bg-primary text-primary-foreground" : preSelectStep > 3 ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"}`} data-testid="step-indicator-3">3</div>
          <div className="flex-1 h-px bg-border" />
          <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${preSelectStep === 4 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} data-testid="step-indicator-4">4</div>
        </div>

        <div style={{ display: preSelectStep === 1 ? 'block' : 'none' }}>
          <div className="space-y-2">

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Vyberte partnera</label>
                <Select value={preSelectPartnerId} onValueChange={(v) => { setPreSelectPartnerId(v); setPreSelectProductId(""); setTimeout(() => refProductTrigger.current?.focus(), 50); }}>
                  <SelectTrigger ref={refPartnerTrigger} className={isFieldMissing("partner") ? "border-red-500 ring-red-500/30" : ""} data-testid="select-preselect-partner">
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
                <label className="text-xs font-medium">Vyberte produkt</label>
                <Select value={preSelectProductId} onValueChange={(v) => { setPreSelectProductId(v); setTimeout(() => refContractTypeTrigger.current?.focus(), 50); }} open={preSelectProductOpen} onOpenChange={setPreSelectProductOpen} disabled={!preSelectPartnerId}>
                  <SelectTrigger ref={refProductTrigger} data-testid="select-preselect-product" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); setPreSelectProductOpen(prev => !prev); } }}>
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
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium">Typ zmluvy *</label>
                <Select value={preSelectContractType} onValueChange={setPreSelectContractType} open={preSelectContractTypeOpen} onOpenChange={(open) => { setPreSelectContractTypeOpen(open); if (!open) setTimeout(() => refSignedDay.current?.focus(), 80); }}>
                  <SelectTrigger ref={refContractTypeTrigger} data-testid="select-preselect-contract-type" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); setPreSelectContractTypeOpen(prev => !prev); } }}>
                    <SelectValue placeholder="Vyberte typ zmluvy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nova">🟢 Nová zmluva</SelectItem>
                    <SelectItem value="Prestupova">🔵 Prestupová zmluva</SelectItem>
                    <SelectItem value="Zmenova">🟡 Zmenová zmluva</SelectItem>
                    <SelectItem value="Dodatok">🟠 Dodatok k zmluve</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Dátum uzatvorenia</label>
                <div className="flex items-center border border-input rounded-md bg-background h-9 overflow-hidden">
                  <input
                    ref={refSignedDay}
                    value={preSelectSignedDay}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setPreSelectSignedDay(v);
                      if (v.length === 2) setTimeout(() => refSignedMonth.current?.focus(), 0);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const n = parseInt(preSelectSignedDay);
                        if (preSelectSignedDay.length === 1 && n >= 1 && n <= 9) setPreSelectSignedDay(preSelectSignedDay.padStart(2, "0"));
                        setTimeout(() => refSignedMonth.current?.focus(), 30);
                      } else if (e.key === "ArrowRight" && (e.currentTarget.selectionStart ?? 0) >= preSelectSignedDay.length) {
                        e.preventDefault();
                        refSignedMonth.current?.focus();
                        setTimeout(() => refSignedMonth.current?.setSelectionRange(0, 0), 0);
                      }
                    }}
                    placeholder="DD"
                    className="w-9 text-center text-sm bg-transparent border-0 outline-none h-full pl-2 pr-0"
                    maxLength={2}
                    data-testid="input-preselect-signed-day"
                  />
                  <span className="text-muted-foreground text-sm select-none px-0.5">.</span>
                  <input
                    ref={refSignedMonth}
                    value={preSelectSignedMonth}
                    onChange={e => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                      setPreSelectSignedMonth(v);
                      if (v.length === 2) setTimeout(() => refSignedYear.current?.focus(), 0);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const n = parseInt(preSelectSignedMonth);
                        if (preSelectSignedMonth.length === 1 && n >= 1 && n <= 9) setPreSelectSignedMonth(preSelectSignedMonth.padStart(2, "0"));
                        setTimeout(() => refSignedYear.current?.focus(), 30);
                      } else if (e.key === "ArrowLeft" && (e.currentTarget.selectionStart ?? 0) === 0) {
                        e.preventDefault();
                        refSignedDay.current?.focus();
                        setTimeout(() => refSignedDay.current?.setSelectionRange(preSelectSignedDay.length, preSelectSignedDay.length), 0);
                      } else if (e.key === "ArrowRight" && (e.currentTarget.selectionStart ?? 0) >= preSelectSignedMonth.length) {
                        e.preventDefault();
                        refSignedYear.current?.focus();
                        setTimeout(() => refSignedYear.current?.setSelectionRange(0, 0), 0);
                      }
                    }}
                    placeholder="MM"
                    className="w-9 text-center text-sm bg-transparent border-0 outline-none h-full px-0"
                    maxLength={2}
                    data-testid="input-preselect-signed-month"
                  />
                  <span className="text-muted-foreground text-sm select-none px-0.5">.</span>
                  <input
                    ref={refSignedYear}
                    value={preSelectSignedYear}
                    onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPreSelectSignedYear(v); }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        let y = preSelectSignedYear.trim();
                        if (/^\d{2}$/.test(y)) { y = "20" + y; setPreSelectSignedYear(y); }
                        setTimeout(() => refTimeBtnNone.current?.focus(), 50);
                      } else if (e.key === "ArrowLeft" && (e.currentTarget.selectionStart ?? 0) === 0) {
                        e.preventDefault();
                        refSignedMonth.current?.focus();
                        setTimeout(() => refSignedMonth.current?.setSelectionRange(preSelectSignedMonth.length, preSelectSignedMonth.length), 0);
                      }
                    }}
                    placeholder="RRRR"
                    className="w-12 text-center text-sm bg-transparent border-0 outline-none h-full px-0"
                    maxLength={4}
                    data-testid="input-preselect-signed-year"
                  />
                  <span className="w-px self-stretch bg-border/60 mx-1.5 shrink-0" />
                  <div className="relative flex items-center bg-muted/50 rounded-md my-1 shrink-0" role="radiogroup" aria-label="Čas" data-testid="toggle-time-type">
                    <div className="absolute top-0 bottom-0 rounded-md bg-background shadow-sm border border-border/60 transition-all duration-200 ease-out w-1/2"
                      style={{ left: preSelectWithTime ? "50%" : "0%" }} />
                    <button
                      ref={refTimeBtnNone}
                      type="button"
                      role="radio"
                      aria-checked={!preSelectWithTime}
                      tabIndex={!preSelectWithTime ? 0 : -1}
                      onClick={() => setPreSelectWithTime(false)}
                      onKeyDown={e => {
                        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                          e.preventDefault();
                          setPreSelectWithTime(true);
                          if (!preSelectSignedTime) {
                            const now = new Date();
                            setPreSelectSignedTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`);
                          }
                          const btns = (e.currentTarget.closest('[role="radiogroup"]') as HTMLElement)?.querySelectorAll('button[role="radio"]');
                          (btns?.[1] as HTMLElement)?.focus();
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const ref = preSelectNumberType === "proposal" ? refNumberToggleProposal : refNumberToggleContract;
                          setTimeout(() => ref.current?.focus(), 50);
                        }
                      }}
                      className={`relative z-10 px-2.5 text-xs h-full py-0.5 rounded-md transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${!preSelectWithTime ? "text-foreground font-medium" : "text-muted-foreground"}`}
                      data-testid="button-preselect-no-time"
                    >Čas nie</button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={preSelectWithTime}
                      tabIndex={preSelectWithTime ? 0 : -1}
                      onClick={() => {
                        setPreSelectWithTime(true);
                        if (!preSelectSignedTime) {
                          const now = new Date();
                          setPreSelectSignedTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`);
                        }
                      }}
                      onKeyDown={e => {
                        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                          e.preventDefault();
                          setPreSelectWithTime(false);
                          const btns = (e.currentTarget.closest('[role="radiogroup"]') as HTMLElement)?.querySelectorAll('button[role="radio"]');
                          (btns?.[0] as HTMLElement)?.focus();
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          setPreSelectWithTime(true);
                          if (!preSelectSignedTime) {
                            const now = new Date();
                            setPreSelectSignedTime(`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}:${String(now.getSeconds()).padStart(2,"0")}`);
                          }
                          setTimeout(() => refSignedTimeInput.current?.focus(), 50);
                        }
                      }}
                      className={`relative z-10 px-2.5 text-xs h-full py-0.5 rounded-md transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${preSelectWithTime ? "text-foreground font-medium" : "text-muted-foreground"}`}
                      data-testid="button-preselect-with-time"
                    >Čas áno</button>
                  </div>
                  {preSelectWithTime && (
                    <>
                      <span className="w-px self-stretch bg-border/60 mx-1.5 shrink-0" />
                      <input
                        ref={refSignedTimeInput}
                        type="time"
                        step="1"
                        value={preSelectSignedTime}
                        onChange={e => setPreSelectSignedTime(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const ref = preSelectNumberType === "proposal" ? refNumberToggleProposal : refNumberToggleContract;
                            setTimeout(() => ref.current?.focus(), 50);
                          }
                        }}
                        className="text-sm bg-transparent border-0 outline-none h-full pr-2 w-28"
                        data-testid="input-preselect-signed-time"
                      />
                    </>
                  )}
                </div>
                {preSelectSignedDate && new Date(preSelectSignedDate) > new Date() && (
                  <p className="text-[10px] text-orange-400 mt-0.5">Dátum je v budúcnosti</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium">Typ čísla</label>
              {(() => {
                const numOpts: Array<{val: "proposal"|"contract"|"both", label: string, icon: typeof FileText}> = [
                  {val:"proposal", label:NAVRH_LABEL_FULL, icon: FileText},
                  {val:"contract", label:"Číslo zmluvy", icon: FileCheck},
                  {val:"both", label:"Návrh + Zmluva", icon: Files},
                ];
                const activeIdx = numOpts.findIndex(o => o.val === preSelectNumberType);
                const handleNumKey = (e: React.KeyboardEvent, idx: number) => {
                  if (e.key === "Enter") { e.preventDefault(); setTimeout(() => refNumberInput.current?.focus(), 50); return; }
                  let next = -1;
                  if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next = (idx + 1) % 3; }
                  else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); next = (idx + 2) % 3; }
                  if (next >= 0) {
                    setPreSelectNumberType(numOpts[next].val);
                    const btns = (e.currentTarget.closest('[role="radiogroup"]') as HTMLElement)?.querySelectorAll('button[role="radio"]');
                    (btns?.[next] as HTMLElement)?.focus();
                  }
                };
                return (
                  <div className="relative w-full flex p-1 bg-muted/50 rounded-lg border border-border/80" role="radiogroup" aria-label="Typ čísla" data-testid="toggle-number-type">
                    <div className="absolute top-1 bottom-1 rounded-md bg-background shadow-md border border-border/60 transition-all duration-200 ease-out" style={{ width: `calc((100% - 8px) / 3)`, left: `calc(4px + ${activeIdx} * (100% - 8px) / 3)` }} />
                    {numOpts.map((opt, idx) => {
                      const Icon = opt.icon;
                      const isActive = preSelectNumberType === opt.val;
                      return (
                        <button key={opt.val} ref={idx===0?refNumberToggleProposal:idx===1?refNumberToggleContract:undefined} type="button" role="radio" aria-checked={isActive} tabIndex={isActive?0:-1}
                          className={`relative z-10 flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-md transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${isActive ? "text-foreground scale-[1.02]" : "text-muted-foreground hover:text-foreground/80"}`}
                          onClick={() => setPreSelectNumberType(opt.val)} onKeyDown={(e) => handleNumKey(e, idx)} data-testid={`toggle-number-type-${opt.val}`}
                        ><Icon className="w-3.5 h-3.5" />{opt.label}</button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {preSelectNumberType === "both" ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium">{NAVRH_LABEL_FULL}</label>
                  <Input
                    ref={refNumberInput}
                    value={preSelectNumberValue}
                    onChange={(e) => { setPreSelectNumberValue(e.target.value); setPreSelectNumberDuplicates([]); }}
                    placeholder="Číslo návrhu..."
                    className={isFieldMissing("number") ? "border-red-500 ring-red-500/30" : ""}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); focusNextEmptyRequired("number"); }
                    }}
                    data-testid="input-preselect-proposal-number"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Číslo zmluvy</label>
                  <Input
                    value={preSelectNumberValue2}
                    onChange={(e) => { setPreSelectNumberValue2(e.target.value); setPreSelectNumberDuplicates([]); }}
                    placeholder="Číslo zmluvy..."
                    className={isFieldMissing("number2") ? "border-red-500 ring-red-500/30" : ""}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); focusNextEmptyRequired("number2"); }
                    }}
                    data-testid="input-preselect-contract-number"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs font-medium">{preSelectNumberType === "proposal" ? NAVRH_LABEL_FULL : "Číslo zmluvy"}</label>
                <Input
                  ref={refNumberInput}
                  value={preSelectNumberValue}
                  onChange={(e) => { setPreSelectNumberValue(e.target.value); setPreSelectNumberDuplicates([]); }}
                  placeholder={preSelectNumberType === "proposal" ? "Zadajte číslo návrhu..." : "Zadajte číslo zmluvy..."}
                  className={isFieldMissing("number") ? "border-red-500 ring-red-500/30" : ""}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); focusNextEmptyRequired("number"); }
                  }}
                  data-testid="input-preselect-number"
                />
              </div>
            )}

            {preSelectNumberDuplicates.length > 0 && (
              <div className="rounded-md border border-orange-500/40 bg-orange-500/5 dark:bg-orange-900/10 p-3 space-y-2" data-testid="panel-number-duplicates">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                  <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                    Zmluva s týmto číslom sa v systéme už nachádza ako reálna zmluva
                  </span>
                </div>
                <div className="space-y-1">
                  {preSelectNumberDuplicates.map(d => (
                    <div key={d.id} className="flex items-center gap-2 py-1 px-2 text-xs rounded bg-orange-500/5 border border-orange-500/20" data-testid={`row-duplicate-${d.id}`}>
                      <span className="font-mono text-orange-700 dark:text-orange-300 shrink-0">
                        {d.contractNumber || d.proposalNumber || "—"}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span className="font-medium truncate">{d.subjectName}</span>
                      {d.sameState && (
                        <span className="ml-1 shrink-0 text-[10px] text-orange-600 dark:text-orange-400 font-semibold border border-orange-400/40 rounded px-1 py-0">
                          tento štát
                        </span>
                      )}
                      {d.lifecyclePhase !== null && (
                        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground border border-border rounded px-1 py-0">
                          {({ 1: "Nahratie", 2: "Odoslané", 3: "Výhrady", 4: "Archív", 5: "Prijaté CK", 6: "V spracovaní", 7: "Intervencia", 8: "Pripravené", 9: "Odoslané OP", 10: "Prijaté OP" } as Record<number, string>)[d.lifecyclePhase] || `Fáza ${d.lifecyclePhase}`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">Chcete napriek tomu zmluvu nahrať?</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10" onClick={handlePreSelectStep1ForceNext} data-testid="button-duplicate-confirm-upload">
                    Nahrať zmluvu
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setPreSelectNumberDuplicates([]); resetPreSelectDialog(); }} data-testid="button-duplicate-cancel">
                    Nie
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button ref={refStep1Next} onClick={handlePreSelectStep1Next} disabled={!preSelectPartnerId || !preSelectContractType || preSelectCheckingDuplicates} style={{ display: preSelectNumberDuplicates.length > 0 ? 'none' : undefined }} data-testid="button-preselect-next">
                {preSelectCheckingDuplicates && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
                Dalej
              </Button>
            </div>
          </div>
        </div>

        <div style={{ display: preSelectStep === 2 ? 'block' : 'none' }}>
          <div className="space-y-2">

            {/* SEARCH FIRST */}
            <div className="space-y-1">
              <label className="text-xs font-medium">Vyhľadávanie</label>
              <div className="flex gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={refSearchInput}
                  placeholder="Rodné číslo, IČO alebo meno..."
                  value={preSelectSubjectSearch}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPreSelectSubjectSearch(val);
                    setPreSelectSubjectId("");
                    setPreSelectSearchHint(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (preSelectSubjectSearch.trim() && preSelectFilteredSubjects.length === 1) {
                        const s = preSelectFilteredSubjects[0];
                        setPreSelectSubjectId(s.id.toString());
                        setPreSelectSubjectType(s.type as "person" | "company" | "szco" | "organization");
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
                          if (sType === "szco" || sType === "company" || sType === "organization") {
                            const el = document.querySelector('[data-testid="input-preselect-business-name"]') as HTMLElement;
                            if (el) { el.focus(); return; }
                          }
                          const el = document.querySelector('[data-testid="input-preselect-title-before"]') as HTMLElement;
                          if (el) { el.focus(); return; }
                          refStep2Confirm.current?.focus();
                        }, 80);
                      } else if (preSelectSubjectSearch.trim() && preSelectFilteredSubjects.length > 1) {
                        const firstRow = document.querySelector('[data-testid^="row-preselect-subject-"]') as HTMLElement;
                        if (firstRow) firstRow.focus();
                      } else if (preSelectSubjectSearch.trim() && preSelectFilteredSubjects.length === 0) {
                        const trimmed = preSelectSubjectSearch.trim();
                        setPreSelectShowNameFields(true);
                        if (/^\d{8}$/.test(trimmed)) {
                          setPreSelectIco(trimmed);
                          setPreSelectSearchHint("szco_or_po");
                          setPreSelectSubjectType("szco");
                          setTimeout(() => {
                            const el = document.querySelector('[data-testid="input-preselect-business-name"]') as HTMLElement;
                            if (el) { el.focus(); return; }
                            refStep2Confirm.current?.focus();
                          }, 80);
                        } else if (/^\d{9,10}$/.test(trimmed)) {
                          setPreSelectBirthNumber(trimmed);
                          setPreSelectSearchHint("possible_rc");
                          setPreSelectSubjectType("person");
                          setPreSelectShowNameFields(true);
                        } else {
                          if ((preSelectSubjectType === "szco" || preSelectSubjectType === "company" || preSelectSubjectType === "organization") && /^\d+$/.test(trimmed)) {
                            setPreSelectIco(trimmed);
                          }
                          setTimeout(() => {
                            if (preSelectSubjectType === "company" && refRegisterButton.current && !refRegisterButton.current.disabled) {
                              refRegisterButton.current.focus(); return;
                            }
                            if (preSelectSubjectType === "szco" || preSelectSubjectType === "company" || preSelectSubjectType === "organization") {
                              const el = document.querySelector('[data-testid="input-preselect-business-name"]') as HTMLElement;
                              if (el) { el.focus(); return; }
                            }
                            const el = document.querySelector('[data-testid="input-preselect-title-before"]') as HTMLElement;
                            if (el) { el.focus(); return; }
                            refStep2Confirm.current?.focus();
                          }, 80);
                        }
                      }
                    } else if (e.key === "Tab" && preSelectSubjectSearch.trim() && preSelectFilteredSubjects.length > 0) {
                      e.preventDefault();
                      const firstRow = document.querySelector('[data-testid^="row-preselect-subject-"]') as HTMLElement;
                      if (firstRow) firstRow.focus();
                    }
                  }}
                  className="pl-9"
                  data-testid="input-preselect-subject-search"
                />
              </div>
              {preSelectSubjectType === "company" && !preSelectSubjectId && (
                <button
                  ref={refRegisterButton}
                  type="button"
                  disabled={preSelectIcoLookupLoading || !preSelectSubjectSearch.trim()}
                  onClick={() => triggerIcoLookup()}
                  className="shrink-0 flex items-center justify-center gap-1.5 min-w-[100px] py-1.5 text-xs font-bold rounded border-2 border-green-500 bg-green-500 hover:bg-green-400 text-black disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  data-testid="button-preselect-ico-lookup"
                >
                  {preSelectIcoLookupLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  Register
                </button>
              )}
              </div>
              {/* RČ detekcia — auto-badge */}
              {preSelectSearchHint === "possible_rc" && (
                <div className="flex items-center gap-2 px-2 py-1.5 rounded border border-blue-500/30 bg-blue-500/5 text-xs text-blue-400" data-testid="hint-search-possible-rc">
                  <User className="w-3.5 h-3.5 shrink-0" />
                  <span>Detegovaný formát RČ → <strong>Fyzická osoba</strong></span>
                  <CheckCircle2 className="w-3.5 h-3.5 ml-auto" />
                </div>
              )}
            </div>

            <div style={{ display: preSelectSubjectSearch.trim() && preSelectFilteredSubjects.length > 0 ? 'block' : 'none' }}>
              <div className="border rounded-md max-h-[200px] overflow-y-auto" data-testid="list-preselect-subjects">
                {preSelectFilteredSubjects.map(s => {
                  const displayName = s.type === "company"
                    ? (s.companyName || "Bez nazvu")
                    : s.type === "szco"
                    ? `${s.companyName || ""} - ${s.firstName || ""} ${s.lastName || ""}`.trim()
                    : `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Bez mena";
                  const typeLabel = s.type === "person" ? "FO" : s.type === "company" ? "PO" : s.type === "szco" ? "SZČO" : s.type === "organization" ? "ORG" : s.type;
                  const identifier = s.type === "company" ? ((s as any).ico || "") : s.type === "szco" ? ((s.details as any)?.ico || s.birthNumber || "") : (s.birthNumber || "");
                  const isSelected = preSelectSubjectId === s.id.toString();
                  return (
                    <div
                      key={s.id}
                      tabIndex={0}
                      className={`flex items-center gap-3 px-3 py-2 cursor-pointer border-b last:border-b-0 hover-elevate ${isSelected ? "bg-primary/10" : ""} focus:bg-primary/10 focus:outline-none`}
                      onClick={() => {
                        setPreSelectSubjectId(s.id.toString());
                        setPreSelectSubjectType(s.type as "person" | "company" | "szco" | "organization");
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
                          setPreSelectSubjectType(s.type as "person" | "company" | "szco" | "organization");
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
                            if (sType === "szco" || sType === "company" || sType === "organization") {
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
                          <span style={{ display: identifier ? 'inline' : 'none' }}>{s.type === "company" || s.type === "szco" ? "ICO" : "RC"}: {identifier}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* TYP SUBJEKTU — sekundárny override */}
            {!preSelectSubjectId && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Typ subjektu</label>
                {(() => {
                  const subOpts: Array<{val: "person"|"szco"|"organization"|"company", label: string, icon: typeof User}> = [
                    {val:"person", label:"FO", icon: User},
                    {val:"szco", label:"SZČO", icon: Briefcase},
                    {val:"organization", label:"Org/Nad", icon: Building},
                    {val:"company", label:"PO", icon: Building2},
                  ];
                  const activeSubIdx = subOpts.findIndex(o => o.val === preSelectSubjectType);
                  const n = subOpts.length;
                  const handleSubKey = (e: React.KeyboardEvent, idx: number) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const selVal = subOpts[idx].val;
                      setTimeout(() => {
                        if (selVal === "company" && refRegisterButton.current && !refRegisterButton.current.disabled) {
                          refRegisterButton.current.focus();
                        } else {
                          refSearchInput.current?.focus();
                        }
                      }, 50);
                      return;
                    }
                    let next = -1;
                    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next = (idx+1)%n; }
                    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); next = (idx+n-1)%n; }
                    if (next >= 0) {
                      const val = subOpts[next].val;
                      setPreSelectSubjectType(val);
                      if (val === "person") { setPreSelectBusinessName(""); setPreSelectIco(""); }
                      setPreSelectShowNameFields(false); setPreSelectBirthNumber(""); setPreSelectSearchHint(null);
                      const btns = (e.currentTarget.closest('[role="radiogroup"]') as HTMLElement)?.querySelectorAll('button[role="radio"]');
                      (btns?.[next] as HTMLElement)?.focus();
                    }
                  };
                  return (
                    <div className="relative w-full flex p-0.5 bg-muted/40 rounded border border-border/60" role="radiogroup" aria-label="Typ subjektu" data-testid="toggle-subject-type">
                      <div className="absolute top-0.5 bottom-0.5 rounded bg-background shadow border border-border/50 transition-all duration-200 ease-out" style={{ width: `calc((100% - 4px) / ${n})`, left: `calc(2px + ${activeSubIdx >= 0 ? activeSubIdx : 0} * (100% - 4px) / ${n})` }} />
                      {subOpts.map((opt, idx) => {
                        const Icon = opt.icon;
                        const isActive = preSelectSubjectType === opt.val;
                        return (
                          <button key={opt.val} type="button" role="radio" aria-checked={isActive} tabIndex={isActive?0:-1}
                            className={`relative z-10 flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs font-medium rounded transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}
                            onClick={() => { setPreSelectSubjectType(opt.val); if (opt.val === "person") { setPreSelectBusinessName(""); setPreSelectIco(""); } setPreSelectShowNameFields(opt.val === "szco" || opt.val === "organization"); setPreSelectBirthNumber(""); setPreSelectSearchHint(null); setPreSelectIcoLookup(null); }}
                            onKeyDown={(e) => handleSubKey(e, idx)} data-testid={`toggle-subject-type-${opt.val === "person" ? "fo" : opt.val === "szco" ? "szco" : opt.val === "organization" ? "org" : "po"}`}
                          ><Icon className="w-3 h-3" />{opt.label}</button>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            <div style={{ display: preSelectSubjectSearch.trim() && preSelectFilteredSubjects.length === 0 && !preSelectSearchHint ? 'block' : 'none' }}>
              <p className="text-xs text-muted-foreground mb-2" data-testid="text-no-subjects">Klient nenájdený — vyplňte údaje nového klienta</p>
            </div>

            {(preSelectSubjectType === "szco" || preSelectSubjectType === "company" || preSelectSubjectType === "organization") && !preSelectSubjectId && (
              <>
              {!preSelectIcoLookup?.found && (
              <div className="space-y-1">
                <label className="text-xs font-medium">{preSelectSubjectType === "szco" ? "Nazov zivnosti" : preSelectSubjectType === "organization" ? "Názov organizácie/nadácie" : "Nazov spolocnosti"} *</label>
                <Input
                  ref={refBusinessNameInput}
                  value={preSelectBusinessName}
                  onChange={(e) => setPreSelectBusinessName(e.target.value)}
                  placeholder={preSelectSubjectType === "szco" ? "Nazov zivnosti" : preSelectSubjectType === "organization" ? "Názov organizácie/nadácie" : "Nazov spolocnosti"}
                  readOnly={!!preSelectSubjectId}
                  className={isFieldMissing("business-name") ? "border-red-500 ring-red-500/30" : ""}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      focusNextEmptyRequired("business-name");
                    }
                  }}
                  data-testid="input-preselect-business-name"
                />
                {preSelectIcoError && <p className="text-[10px] text-red-500 leading-tight" data-testid="text-preselect-ico-error">{preSelectIcoError}</p>}
                {preSelectIcoLookupLoading && (
                  <div className="flex items-center gap-2 mt-1" data-testid="text-preselect-ico-loading">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                    <span className="text-xs text-blue-400">Preberám údaje z registra...</span>
                  </div>
                )}
              </div>
              )}
              {preSelectIcoLookup?.found && (
                <div
                  className={`border rounded-md p-3 flex items-stretch gap-3 transition-colors duration-300 ${preSelectIcoConfirmed ? "bg-green-500/10 border-green-500/40" : "bg-blue-500/10 border-blue-500/30"}`}
                  data-testid="panel-preselect-ico-lookup"
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Building2 className={`w-3.5 h-3.5 shrink-0 ${preSelectIcoConfirmed ? "text-green-400" : "text-blue-400"}`} />
                      <span className={`text-[11px] font-semibold ${preSelectIcoConfirmed ? "text-green-400" : "text-blue-400"}`}>
                        {preSelectIcoLookup.source === "ORSR" ? "Obchodný register SR" : "ARES Register"}
                      </span>
                    </div>
                    {preSelectIcoLookup.name && (
                      <p className="text-sm font-semibold text-foreground leading-tight" data-testid="text-preselect-ico-lookup-name">
                        {preSelectIcoLookup.name}
                      </p>
                    )}
                    {(preSelectIcoLookup.street || preSelectIcoLookup.city) && (
                      <p className="text-xs text-foreground/75 leading-tight">
                        {[preSelectIcoLookup.street, preSelectIcoLookup.streetNumber].filter(Boolean).join(" ")}
                        {(preSelectIcoLookup.street || preSelectIcoLookup.streetNumber) && (preSelectIcoLookup.zip || preSelectIcoLookup.city) ? ", " : ""}
                        {[preSelectIcoLookup.zip, preSelectIcoLookup.city].filter(Boolean).join(" ")}
                      </p>
                    )}
                    {preSelectIcoLookup.legalForm && (
                      <p className="text-[11px] text-foreground/60">
                        {preSelectIcoLookup.legalForm}{preSelectIcoLookup.dic ? ` | DIČ: ${preSelectIcoLookup.dic}` : ""}
                      </p>
                    )}
                    <div className={`flex items-center gap-1.5 text-[11px] font-medium ${preSelectIcoConfirmed ? "text-green-400" : "text-foreground/50"}`}>
                      <CheckCircle2 className="w-3 h-3 shrink-0" />
                      <span>{preSelectIcoConfirmed ? "Údaje potvrdené ✓" : "Čakám na potvrdenie..."}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={preSelectIcoConfirmed}
                    onClick={() => {
                      setPreSelectIcoConfirmed(true);
                      setPreSelectShowNameFields(true);
                      setTimeout(() => refStep2Confirm.current?.focus(), 50);
                    }}
                    className={`shrink-0 self-stretch p-3 rounded border-2 flex flex-col items-center justify-center gap-1.5 transition-colors duration-200 ${
                      preSelectIcoConfirmed
                        ? "border-green-500 bg-green-500/20 text-green-300 cursor-default"
                        : "border-blue-500 bg-blue-500/15 hover:bg-blue-500/30 text-blue-300 hover:text-blue-100 cursor-pointer"
                    }`}
                    data-testid="button-preselect-ico-confirm"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="text-[10px] font-bold text-center leading-tight whitespace-nowrap">
                      Údaje<br/>sedia
                    </span>
                  </button>
                </div>
              )}
              {preSelectIcoLookup && !preSelectIcoLookup.found && (
                <div
                  className="rounded text-xs leading-snug bg-muted/50 border border-border text-muted-foreground"
                  data-testid="text-preselect-ico-not-found"
                >
                  <div className="flex items-start gap-2 px-2.5 py-2">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{preSelectIcoLookup.message}</span>
                  </div>
                </div>
              )}
              </>
            )}


            {(preSelectShowNameFields || (preSelectSubjectType === "person" && !preSelectSubjectId)) && (
              <div className="space-y-2">
                {/* Riadok 1: tituly + meno + priezvisko */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Titul pred</label>
                    <Input
                      ref={refTitleBeforeInput}
                      value={preSelectTitleBefore}
                      onChange={(e) => setPreSelectTitleBefore(e.target.value)}
                      placeholder="napr. Ing."
                      readOnly={!!preSelectSubjectId}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextEmptyRequired("title-before"); } }}
                      data-testid="input-preselect-title-before"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Meno {(preSelectSubjectType === "person" || preSelectSubjectType === "szco") && <span className="text-red-400">*</span>}</label>
                    <Input
                      ref={refFirstNameInput}
                      value={preSelectFirstName}
                      onChange={(e) => setPreSelectFirstName(e.target.value)}
                      placeholder="Meno"
                      readOnly={!!preSelectSubjectId}
                      className={isFieldMissing("first-name") ? "border-red-500 ring-red-500/30" : ""}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextEmptyRequired("first-name"); } }}
                      data-testid="input-preselect-first-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Priezvisko {(preSelectSubjectType === "person" || preSelectSubjectType === "szco") && <span className="text-red-400">*</span>}</label>
                    <Input
                      ref={refLastNameInput}
                      value={preSelectLastName}
                      onChange={(e) => setPreSelectLastName(e.target.value)}
                      placeholder="Priezvisko"
                      readOnly={!!preSelectSubjectId}
                      className={isFieldMissing("last-name") ? "border-red-500 ring-red-500/30" : ""}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextEmptyRequired("last-name"); } }}
                      data-testid="input-preselect-last-name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Titul za</label>
                    <Input
                      ref={refTitleAfterInput}
                      value={preSelectTitleAfter}
                      onChange={(e) => setPreSelectTitleAfter(e.target.value)}
                      placeholder="napr. PhD."
                      readOnly={!!preSelectSubjectId}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); focusNextEmptyRequired("title-after"); } }}
                      data-testid="input-preselect-title-after"
                    />
                  </div>
                </div>
                {/* Riadok 2: auto-údaje z RČ — len pre FO */}
                {preSelectSubjectType === "person" && rcBirthInfo && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Dátum narodenia</label>
                      <div className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border/50 bg-muted/30 text-sm font-mono text-muted-foreground" data-testid="text-preselect-dob">
                        {rcBirthInfo.dob}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Vek</label>
                      <div className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border/50 bg-muted/30 text-sm text-muted-foreground" data-testid="text-preselect-age">
                        {rcBirthInfo.age} rokov
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Pohlavie</label>
                      <div className={`flex items-center gap-1.5 h-9 px-3 rounded-md border border-border/50 bg-muted/30 text-sm text-muted-foreground`} data-testid="text-preselect-gender">
                        {rcBirthInfo.gender === "Žena" ? <span className="text-pink-400 font-medium">♀ Žena</span> : <span className="text-blue-400 font-medium">♂ Muž</span>}
                      </div>
                    </div>
                  </div>
                )}
                {preSelectSubjectType === "person" && !rcBirthInfo && preSelectBirthNumber.trim().length >= 9 && (
                  <p className="text-[10px] text-amber-500" data-testid="text-preselect-rc-invalid">Nepodarilo sa extrahovať údaje z rodného čísla</p>
                )}
              </div>
            )}

            {preSelectSubjectId && (
              <p className="text-xs text-muted-foreground">Vybrany existujuci klient ({preSelectSubjectType === "person" ? "FO" : preSelectSubjectType === "szco" ? "SZČO" : preSelectSubjectType === "organization" ? "ORG" : "PO"}) — polia su len na citanie. <button type="button" className="text-primary underline" onClick={() => { setPreSelectSubjectId(""); setPreSelectSubjectType("person"); setPreSelectTitleBefore(""); setPreSelectFirstName(""); setPreSelectLastName(""); setPreSelectTitleAfter(""); setPreSelectBusinessName(""); setPreSelectIco(""); setPreSelectBirthNumber(""); setPreSelectShowNameFields(false); }} data-testid="button-deselect-subject">Zrusit vyber</button></p>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" tabIndex={2} onClick={handlePreSelectStep2Back} data-testid="button-preselect-back">
                Spat
              </Button>
              <Button ref={refStep2Confirm} tabIndex={0} onClick={() => { if (preSelectIsValid) setPreSelectStep(3); }} disabled={!preSelectIsValid} data-testid="button-preselect-step2-next">
                Dalej
              </Button>
            </div>
          </div>
        </div>

        {preSelectStep === 3 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Priradenie získateľov a rozdelenie odmien za zmluvu.
            </p>

            <div className="space-y-3 border rounded-md p-4" data-testid="section-preselect-reward-distributions">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Získatelia a odmeny</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={preSelectRewardTotal > 100 ? "destructive" : preSelectRewardTotal === 100 ? "default" : "outline"} className="text-[10px] font-mono" data-testid="badge-preselect-reward-total">
                    {preSelectRewardTotal}% / 100%
                  </Badge>
                  <span className="text-[10px] text-muted-foreground" style={{ visibility: preSelectRewardRemaining > 0 && preSelectRewardTotal <= 100 ? 'visible' : 'hidden' }}>
                    Zostava: {preSelectRewardRemaining}%
                  </span>
                </div>
              </div>

              <div className={`rounded-md p-2 ${preSelectRewardTotal === 100 ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-destructive/10 border border-destructive/30'}`}>
                <p className={`text-xs font-medium ${preSelectRewardTotal === 100 ? 'text-emerald-600' : 'text-destructive'}`} data-testid="text-preselect-reward-status">
                  {preSelectRewardTotal === 100
                    ? `Celkovy sucet odmien je 100,00 % - Ulozenie je povolene.`
                    : `Celkovy sucet odmien nie je 100,00 % (${preSelectRewardTotal.toFixed(2).replace(".", ",")} %) - Ulozenie je zablokovane.`
                  }
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="border rounded-md p-3 space-y-2" data-testid="panel-preselect-specialist">
                  <div className="flex items-center gap-2">
                    <Award className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide">Odmena pre specialistu</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Osoba zodpovedna za spravnost zmluvy</p>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 space-y-1">
                      <label className="text-xs text-muted-foreground">UID specialistu</label>
                      <div className="relative">
                        <Input
                          ref={refPreSelectSpecialistUid}
                          placeholder="UID alebo meno..."
                          value={preSelectSpecialistUid}
                          onChange={e => {
                            setPreSelectSpecialistUid(e.target.value);
                            setPreSelectRewardSearchSpecialist(e.target.value);
                          }}
                          onBlur={e => {
                            const val = e.target.value.trim();
                            if (val && /^\d+$/.test(val.replace(/\s/g, ''))) {
                              setPreSelectSpecialistUid(expandUid(val));
                            }
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const val = e.currentTarget.value.trim();
                              if (val && /^\d+$/.test(val.replace(/\s/g, ''))) {
                                setPreSelectSpecialistUid(expandUid(val));
                              }
                              setPreSelectRewardSearchSpecialist("");
                              refPreSelectSpecialistPct.current?.focus();
                            }
                          }}
                          className="font-mono text-sm"
                          data-testid="input-preselect-specialist-uid"
                        />
                        {(() => {
                          const searchLower = preSelectRewardSearchSpecialist.toLowerCase().trim();
                          const filtered = searchLower && searchLower.length >= 2
                            ? (appUsersAll || []).filter(u =>
                                (`${u.firstName || ""} ${u.lastName || ""} ${u.username || ""} ${u.uid || ""}`.toLowerCase().includes(searchLower))
                              )
                            : [];
                          return (
                            <div className="absolute top-full left-0 right-0 z-50 border rounded-md bg-popover max-h-[120px] overflow-y-auto" style={{ display: filtered.length > 0 ? 'block' : 'none' }} data-testid="list-preselect-specialist-suggestions">
                              {filtered.slice(0, 8).map(u => (
                                <div
                                  key={u.id}
                                  className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover-elevate text-sm"
                                  onClick={() => {
                                    setPreSelectSpecialistUid(u.uid || "");
                                    setPreSelectRewardSearchSpecialist("");
                                  }}
                                  data-testid={`row-preselect-specialist-${u.id}`}
                                >
                                  <span className="font-medium text-xs">{u.firstName || ""} {u.lastName || ""}</span>
                                  <span className="text-xs text-muted-foreground font-mono ml-auto">{formatUid(u.uid)}</span>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      {(() => {
                        const lookup = lookupSubjectByUid(preSelectSpecialistUid);
                        if (!lookup.label) return null;
                        return <p className={`text-[11px] mt-0.5 font-medium ${lookup.found ? 'text-emerald-500' : 'text-destructive'}`} data-testid="text-preselect-specialist-lookup">{lookup.label}</p>;
                      })()}
                    </div>
                    <div className="w-[100px] space-y-1">
                      <label className="text-xs text-muted-foreground">Podiel (%)</label>
                      <div className="relative">
                        <Input
                          ref={refPreSelectSpecialistPct}
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="0"
                          value={preSelectSpecialistPercentage}
                          onChange={e => setPreSelectSpecialistPercentage(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (parseFloat(preSelectSpecialistPercentage) >= 100) {
                                (document.querySelector('[data-testid="button-preselect-confirm-rewards"]') as HTMLButtonElement)?.focus();
                              } else {
                                (document.querySelector('[data-testid="button-preselect-add-recommender"]') as HTMLButtonElement)?.focus();
                              }
                            }
                          }}
                          className="pr-8 font-mono text-sm"
                          data-testid="input-preselect-specialist-percentage"
                        />
                        <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Ak nie su zadani odporucitelia, specialista bude automaticky pridany ako odporucitel s 0%.
                  </p>
                </div>

                <div className="border rounded-md p-3 space-y-2" data-testid="panel-preselect-recommenders">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Odporucitelia</span>
                      <Badge variant="outline" className="text-[10px]">{preSelectRecommenders.length}</Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] px-2"
                      onClick={() => {
                        setPreSelectAddingRecommender(true);
                        setPreSelectNewRecommenderUid("");
                        setPreSelectNewRecommenderPercentage("");
                        setPreSelectRewardSearchRecommender("");
                        setTimeout(() => {
                          (document.querySelector('[data-testid="input-preselect-new-recommender-uid"]') as HTMLInputElement)?.focus();
                        }, 50);
                      }}
                      data-testid="button-preselect-add-recommender"
                    >
                      <Plus className="w-3 h-3 mr-1" /> Pridat
                    </Button>
                  </div>

                  <div className="border rounded-md p-2 space-y-2" style={{ display: preSelectAddingRecommender ? 'block' : 'none' }} data-testid="panel-preselect-add-recommender">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <label className="text-xs text-muted-foreground">UID odporucitela</label>
                        <div className="relative">
                          <Input
                            placeholder="UID alebo meno..."
                            value={preSelectNewRecommenderUid}
                            onChange={e => {
                              setPreSelectNewRecommenderUid(e.target.value);
                              setPreSelectRewardSearchRecommender(e.target.value);
                            }}
                            onBlur={e => {
                              const val = e.target.value.trim();
                              if (val && /^\d+$/.test(val.replace(/\s/g, ''))) {
                                setPreSelectNewRecommenderUid(expandUid(val));
                              }
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const val = e.currentTarget.value.trim();
                                if (val && /^\d+$/.test(val.replace(/\s/g, ''))) {
                                  setPreSelectNewRecommenderUid(expandUid(val));
                                }
                                setPreSelectRewardSearchRecommender("");
                                const pctEl = document.querySelector('[data-testid="input-preselect-new-recommender-percentage"]') as HTMLInputElement;
                                pctEl?.focus();
                              }
                            }}
                            className="font-mono text-sm"
                            data-testid="input-preselect-new-recommender-uid"
                          />
                          {(() => {
                            const searchLower = preSelectRewardSearchRecommender.toLowerCase().trim();
                            const filtered = searchLower && searchLower.length >= 2
                              ? (appUsersAll || []).filter(u =>
                                  (`${u.firstName || ""} ${u.lastName || ""} ${u.username || ""} ${u.uid || ""}`.toLowerCase().includes(searchLower))
                                )
                              : [];
                            return (
                              <div className="absolute top-full left-0 right-0 z-50 border rounded-md bg-popover max-h-[120px] overflow-y-auto" style={{ display: filtered.length > 0 ? 'block' : 'none' }} data-testid="list-preselect-recommender-suggestions">
                                {filtered.slice(0, 8).map(u => (
                                  <div
                                    key={u.id}
                                    className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover-elevate text-sm"
                                    onClick={() => {
                                      setPreSelectNewRecommenderUid(u.uid || "");
                                      setPreSelectRewardSearchRecommender("");
                                    }}
                                    data-testid={`row-preselect-recommender-${u.id}`}
                                  >
                                    <span className="font-medium text-xs">{u.firstName || ""} {u.lastName || ""}</span>
                                    <span className="text-xs text-muted-foreground font-mono ml-auto">{formatUid(u.uid)}</span>
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                        {(() => {
                          const lookup = lookupSubjectByUid(preSelectNewRecommenderUid);
                          if (!lookup.label) return null;
                          return <p className={`text-[11px] mt-0.5 font-medium ${lookup.found ? 'text-emerald-500' : 'text-destructive'}`} data-testid="text-preselect-recommender-lookup">{lookup.label}</p>;
                        })()}
                      </div>
                      <div className="w-[100px] space-y-1">
                        <label className="text-xs text-muted-foreground">Podiel (%)</label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            placeholder="0"
                            value={preSelectNewRecommenderPercentage}
                            onChange={e => setPreSelectNewRecommenderPercentage(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const newPct = parseFloat(preSelectNewRecommenderPercentage) || 0;
                                const newTotal = preSelectRewardTotal + newPct;
                                const btn = document.querySelector('[data-testid="button-preselect-confirm-recommender"]') as HTMLButtonElement;
                                btn?.click();
                                setTimeout(() => {
                                  if (newTotal >= 100) {
                                    (document.querySelector('[data-testid="button-preselect-confirm-rewards"]') as HTMLButtonElement)?.focus();
                                  } else {
                                    (document.querySelector('[data-testid="button-preselect-add-recommender"]') as HTMLButtonElement)?.focus();
                                  }
                                }, 80);
                              }
                            }}
                            className="pr-8 font-mono text-sm"
                            data-testid="input-preselect-new-recommender-percentage"
                          />
                          <Percent className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPreSelectAddingRecommender(false)}
                        data-testid="button-preselect-cancel-recommender"
                      >
                        Zrusit
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!preSelectNewRecommenderUid.trim()) {
                            toast({ title: "Chyba", description: "Zadajte UID odporucitela", variant: "destructive" });
                            return;
                          }
                          const newTotal = preSelectRewardTotal + (parseFloat(preSelectNewRecommenderPercentage) || 0);
                          if (newTotal > 100) {
                            toast({ title: "Chyba", description: `Sucet percent by presahoval 100% (${newTotal.toFixed(2)}%)`, variant: "destructive" });
                            return;
                          }
                          setPreSelectRecommenders(prev => [...prev, { uid: preSelectNewRecommenderUid.trim(), percentage: preSelectNewRecommenderPercentage || "0" }]);
                          setPreSelectNewRecommenderUid("");
                          setPreSelectNewRecommenderPercentage("");
                          setPreSelectRewardSearchRecommender("");
                          setPreSelectAddingRecommender(false);
                        }}
                        data-testid="button-preselect-confirm-recommender"
                      >
                        <Check className="w-3.5 h-3.5 mr-1" /> Potvrdit
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1" data-testid="list-preselect-recommenders">
                    {preSelectRecommenders.map((rec, idx) => {
                      const lookup = lookupSubjectByUid(rec.uid);
                      return (
                        <div key={`${rec.uid}-${idx}`} className="flex items-center gap-2 px-2 py-1 border rounded-md bg-muted/30 text-xs" data-testid={`row-preselect-recommender-${idx}`}>
                          <Users className="w-3 h-3 text-primary flex-shrink-0" />
                          <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">{formatUid(rec.uid)}</span>
                          <span className={`font-medium truncate ${lookup.found ? 'text-emerald-500' : 'text-destructive'}`}>{lookup.label}</span>
                          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={rec.percentage}
                              onChange={e => {
                                const val = e.target.value;
                                setPreSelectRecommenders(prev => prev.map((r, i) => i === idx ? { ...r, percentage: val } : r));
                              }}
                              className="w-16 h-6 text-[11px] font-mono text-right"
                              data-testid={`input-preselect-recommender-percentage-${idx}`}
                            />
                            <span className="text-[10px] text-muted-foreground">%</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => setPreSelectRecommenders(prev => prev.filter((_, i) => i !== idx))}
                            data-testid={`button-preselect-remove-recommender-${idx}`}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      );
                    })}
                    <div style={{ display: preSelectRecommenders.length === 0 && preSelectSpecialistUid ? 'block' : 'none' }}>
                      <div className="flex items-center gap-2 px-2 py-1 border rounded-md bg-muted/20 border-dashed text-xs" data-testid="row-preselect-autofill-recommender">
                        <Users className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground italic truncate">
                          {(() => {
                            const user = (appUsersAll || []).find(u => u.uid === preSelectSpecialistUid);
                            return user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username : preSelectSpecialistUid;
                          })()}
                        </span>
                        <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">0% (auto)</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Specialista bude automaticky pridany ako odporucitel s 0% pri ulozeni.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setPreSelectStep(2)} data-testid="button-preselect-step3-back">
                Spat
              </Button>
              <Button onClick={handlePreSelectConfirm} disabled={preSelectSaving || preSelectRewardTotal !== 100 || !preSelectSpecialistUid || !lookupSubjectByUid(preSelectSpecialistUid).found || preSelectRecommenders.some(r => !lookupSubjectByUid(r.uid).found)} data-testid="button-preselect-confirm-rewards">
                {preSelectSaving ? "Zapisujem..." : preSelectEditingContractId ? "Uložiť zmeny" : "Zapísať zmluvu"}
              </Button>
            </div>
          </div>
        )}

        {preSelectStep === 4 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Zmluva bola úspešne zapísaná. Teraz môžete nahrať dokumenty (PDF, obrázky, skeny občianskeho preukazu a pod.).
            </p>
            {(() => {
              const allContracts = contractsPage?.data || [];
              const targetContract = preSelectCreatedContractId ? allContracts.find((c: any) => c.id === preSelectCreatedContractId) : null;
              const dbDocsCount = targetContract && Array.isArray(targetContract.documents) ? targetContract.documents.length : 0;
              const existingDocsCount = Math.max(dbDocsCount, preSelectUploadedCount);
              const remainingSlots = MAX_DOCS_PER_CONTRACT - existingDocsCount;
              return (
                <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground" data-testid="text-contract-doc-limits">
                  <span className="px-1.5 py-0.5 rounded bg-muted/50 border border-border">Aktuálne: {existingDocsCount}/{MAX_DOCS_PER_CONTRACT} dok. (zostáva {remainingSlots})</span>
                  <span className="px-1.5 py-0.5 rounded bg-muted/50 border border-border">Max. {MAX_BATCH_FILES} súborov/dávka</span>
                  <span className="px-1.5 py-0.5 rounded bg-muted/50 border border-border">95 dok. + 5 videí</span>
                  {userCanUploadVideo && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">Video povolené</span>}
                </div>
              );
            })()}

            <input
              ref={refFileInput}
              type="file"
              multiple
              accept={userCanUploadVideo ? ".pdf,.jpg,.jpeg,.png,.webp,.tiff,.tif,.bmp,.mp4,.mov,.avi,.mkv,.webm" : ".pdf,.jpg,.jpeg,.png,.webp,.tiff,.tif,.bmp"}
              className="hidden"
              onChange={(e) => {
                if (e.target.files) {
                  validateAndAddFiles(Array.from(e.target.files));
                }
                e.target.value = "";
              }}
              data-testid="input-preselect-file-upload"
            />

            <div
              className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => refFileInput.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files) {
                  validateAndAddFiles(Array.from(e.dataTransfer.files));
                }
              }}
              data-testid="dropzone-preselect-upload"
            >
              <div className="flex flex-col items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <p className="text-sm font-medium">Kliknite alebo pretiahnite súbory sem</p>
                <p className="text-xs text-muted-foreground">
                  {userCanUploadVideo ? "PDF, JPG, PNG, WebP, TIFF, BMP, MP4, MOV, AVI, MKV, WebM" : "PDF, JPG, PNG, WebP, TIFF, BMP"} (max. 25 MB/súbor, max. {MAX_BATCH_FILES} súborov/dávka)
                </p>
              </div>
            </div>

            {preSelectFileError && (
              <div className="flex items-center gap-2 p-3 rounded border border-red-500/50 bg-red-500/10 text-red-400 text-sm" data-testid="text-preselect-file-error">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{preSelectFileError}</span>
              </div>
            )}

            {preSelectFiles.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium">{preSelectFiles.length}/{MAX_BATCH_FILES} súbor(ov) vybraných ({(preSelectFiles.reduce((s, f) => s + f.size, 0) / (1024 * 1024)).toFixed(1)} MB z max. 100 MB):</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {preSelectFiles.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs bg-muted/50 rounded px-2 py-1">
                      <span className="truncate flex-1 mr-2">{f.name}</span>
                      <span className="text-muted-foreground whitespace-nowrap mr-2">{(f.size / 1024).toFixed(0)} KB</span>
                      <button
                        type="button"
                        className="text-destructive hover:text-destructive/80"
                        onClick={() => {
                          setPreSelectFiles(prev => {
                            const updated = prev.filter((_, i) => i !== idx);
                            const totalSize = updated.reduce((s, f) => s + f.size, 0);
                            if (totalSize <= MAX_BATCH_SIZE) setPreSelectFileError(null);
                            return updated;
                          });
                        }}
                        data-testid={`button-remove-file-${idx}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={handlePreSelectSkipUpload} data-testid="button-preselect-skip-upload">
                Preskočiť
              </Button>
              <Button
                onClick={handlePreSelectUploadAndFinish}
                disabled={preSelectFiles.length === 0 || preSelectUploading || preSelectFiles.reduce((s, f) => s + f.size, 0) > MAX_BATCH_SIZE || preSelectFiles.length > MAX_BATCH_FILES || preSelectFiles.filter(f => VIDEO_EXTENSIONS.has(getFileExt(f.name))).length > MAX_VIDEOS_PER_CONTRACT || preSelectFiles.length > MAX_DOCS_PER_CONTRACT}
                data-testid="button-preselect-upload-confirm"
              >
                {preSelectUploading ? "Nahrávam..." : `Nahrať ${preSelectFiles.length} dokument(ov)`}
              </Button>
            </div>
          </div>
        )}

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

  const quickFixMissingFields = (quickFixContract?.incompleteDataReason || "").replace(/^Chýba:\s*/, "").split(",").map((f: string) => f.trim().toLowerCase());
  const qfMissing = (field: string) => quickFixMissingFields.some((f: string) => f.includes(field));
  const quickFixFilteredSubjects = !subjects ? [] : subjects.filter(s => {
    const q = quickFixSubjectSearch.toLowerCase().trim();
    if (!q) return true;
    const fullName = s.type === "company" ? (s.companyName || "") : `${s.firstName || ""} ${s.lastName || ""}`.trim();
    return fullName.toLowerCase().includes(q) || (s.birthNumber || "").includes(q) || ((s.details as any)?.ico || "").includes(q) || (s.uid || "").toLowerCase().includes(q);
  }).slice(0, 8);
  const quickFixSelectedSubject = quickFixSubjectId ? subjects?.find(s => String(s.id) === quickFixSubjectId) : null;
  const quickFixPartnerProducts = quickFixPartnerId ? (products || []).filter(p => p.partnerId === parseInt(quickFixPartnerId)) : (products || []);

  const quickFixDialog = (
      <Dialog open={quickFixOpen} onOpenChange={(open) => { if (!open) setQuickFixOpen(false); }}>
        <DialogContent size="md" data-testid="dialog-quick-fix-contract">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              Doplniť neúplnú zmluvu
            </DialogTitle>
            {quickFixContract?.incompleteDataReason && (
              <p className="text-xs text-red-400 mt-1">{quickFixContract.incompleteDataReason}</p>
            )}
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className={`space-y-1 ${qfMissing("partner") ? "ring-1 ring-red-500/50 rounded p-2 -m-2" : ""}`}>
                <label className="text-xs font-medium text-muted-foreground">Partner {qfMissing("partner") && <span className="text-red-400">*</span>}</label>
                <Select value={quickFixPartnerId} onValueChange={v => { setQuickFixPartnerId(v); setQuickFixProductId(""); }}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-qf-partner">
                    <SelectValue placeholder="Vyber partnera" />
                  </SelectTrigger>
                  <SelectContent>
                    {(partners || []).map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className={`space-y-1 ${qfMissing("produkt") ? "ring-1 ring-red-500/50 rounded p-2 -m-2" : ""}`}>
                <label className="text-xs font-medium text-muted-foreground">Produkt {qfMissing("produkt") && <span className="text-red-400">*</span>}</label>
                <Select value={quickFixProductId} onValueChange={setQuickFixProductId}>
                  <SelectTrigger className="h-8 text-sm" data-testid="select-qf-product">
                    <SelectValue placeholder="Vyber produkt" />
                  </SelectTrigger>
                  <SelectContent>
                    {quickFixPartnerProducts.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className={`space-y-2 ${qfMissing("číslo") ? "ring-1 ring-red-500/50 rounded p-2 -m-2" : ""}`}>
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-muted-foreground">Typ čísla {qfMissing("číslo") && <span className="text-red-400">*</span>}</label>
                <div className="flex gap-3 text-xs">
                  {(["proposal", "contract", "both"] as const).map(t => (
                    <label key={t} className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name="qf-numtype" checked={quickFixNumberType === t} onChange={() => setQuickFixNumberType(t)} className="accent-primary" />
                      {t === "proposal" ? "Návrhu" : t === "contract" ? "Zmluvy" : "Obe"}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Input
                  className="h-8 text-sm font-mono"
                  placeholder={quickFixNumberType === "contract" ? "Číslo zmluvy" : NAVRH_LABEL_SHORT}
                  value={quickFixNumberValue}
                  onChange={e => setQuickFixNumberValue(e.target.value)}
                  data-testid="input-qf-number1"
                />
                {quickFixNumberType === "both" && (
                  <Input
                    className="h-8 text-sm font-mono"
                    placeholder="Číslo zmluvy"
                    value={quickFixNumberValue2}
                    onChange={e => setQuickFixNumberValue2(e.target.value)}
                    data-testid="input-qf-number2"
                  />
                )}
              </div>
            </div>

            <div className={`space-y-2 ${qfMissing("klient") ? "ring-1 ring-red-500/50 rounded p-2 -m-2" : ""}`}>
              <label className="text-xs font-medium text-muted-foreground">Klient {qfMissing("klient") && <span className="text-red-400">*</span>}</label>
              {quickFixSelectedSubject && (
                <div className="flex items-center gap-2 p-2 rounded border bg-muted/30 text-sm">
                  <span className="flex-1">{quickFixSelectedSubject.type === "company" ? quickFixSelectedSubject.companyName : `${quickFixSelectedSubject.firstName || ""} ${quickFixSelectedSubject.lastName || ""}`.trim()}</span>
                  <button onClick={() => { setQuickFixSubjectId(""); setQuickFixSubjectSearch(""); }} className="text-muted-foreground hover:text-foreground text-xs" data-testid="button-qf-clear-subject">✕</button>
                </div>
              )}
              {!quickFixSelectedSubject && (
                <>
                  <Input
                    className="h-8 text-sm"
                    placeholder="Hľadaj podľa mena, RČ, IČO..."
                    value={quickFixSubjectSearch}
                    onChange={e => setQuickFixSubjectSearch(e.target.value)}
                    data-testid="input-qf-subject-search"
                  />
                  {quickFixSubjectSearch.trim() && (
                    <div className="border rounded divide-y max-h-40 overflow-y-auto">
                      {quickFixFilteredSubjects.length === 0 ? (
                        <p className="text-xs text-muted-foreground px-2 py-2">Žiadne výsledky</p>
                      ) : quickFixFilteredSubjects.map(s => {
                        const name = s.type === "company" ? (s.companyName || "—") : `${s.firstName || ""} ${s.lastName || ""}`.trim() || "—";
                        return (
                          <button key={s.id} className="w-full text-left px-2 py-1.5 text-sm hover:bg-muted/50 flex items-center gap-2" onClick={() => { setQuickFixSubjectId(String(s.id)); setQuickFixSubjectSearch(""); }} data-testid={`button-qf-subject-${s.id}`}>
                            <Badge variant="outline" className="text-[9px] shrink-0">{s.type === "person" ? "FO" : s.type === "szco" ? "SZČO" : "PO"}</Badge>
                            <span>{name}</span>
                            <span className="text-muted-foreground text-xs ml-auto">{s.birthNumber || (s.details as any)?.ico || ""}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="outline" size="sm" onClick={() => setQuickFixOpen(false)} data-testid="button-qf-cancel">Zrušiť</Button>
              <Button size="sm" onClick={handleQuickFixSave} disabled={quickFixSaving} data-testid="button-qf-save">
                {quickFixSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1.5" />}
                Uložiť zmeny
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
  );

  if (isEvidencia) {
    return (
      <div className="p-6 space-y-4">
        {quickFixDialog}
        {preSelectDialog}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Spracovanie papierových zmlúv</h1>
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

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Hladať zmluvy (číslo, klient, partner, produkt...)"
              className="pl-9"
              data-testid="input-search-contracts"
            />
          </div>
          <SmartFilterBar filter={evidenciaFilter} />
          <ColumnManager columnVisibility={evidenciaColumnVisibility} />
          <ColumnManager columnVisibility={sprievodkaColumnVisibility} />
        </div>

        <WorkflowDiagram
          folderDefs={folderDefs}
          row2FolderDefs={row2FolderDefs}
          activeFolder={activeFolder}
          onFolderClick={(id: number) => { setActiveFolder(id); setRerouteSelectedIds([]); }}
        />

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
                  {renderContractTable(sortedNahravanie, { showCheckbox: true, showOrder: true, checkboxOnly: true, earlyPhase: true, sortState: { sortKey: skNahr, sortDirection: sdNahr, requestSort: rsNahr } })}
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
                  {dispatchedBySprievodka.map(group => ({ ...group, contracts: filterBySearch(group.contracts) })).filter(g => g.contracts.length > 0).map(group => {
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
                            <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                              {group.inventory?.createdAt && (<>Vytvorená: {formatDateSlovak(group.inventory.createdAt)}</>)}
                              {(group.inventory as any)?.dispatchedAt && (<> · Odoslaná: {formatDateSlovak((group.inventory as any).dispatchedAt)}</>)}
                            </span>
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
                                  {sprievodkaColumnVisibility.isVisible("partnerId") && <TableHead>Partner</TableHead>}
                                  {sprievodkaColumnVisibility.isVisible("productId") && <TableHead>Produkt</TableHead>}
                                  {sprievodkaColumnVisibility.isVisible("proposalNumber") && <TableHead title={NAVRH_LABEL_FULL}>{NAVRH_LABEL_SHORT}</TableHead>}
                                  {sprievodkaColumnVisibility.isVisible("contractNumber") && <TableHead>Číslo zmluvy</TableHead>}
                                  <TableHead>Typ subjektu</TableHead>
                                  {sprievodkaColumnVisibility.isVisible("subjectId") && <TableHead>Klient</TableHead>}
                                  <TableHead className="text-center w-[60px]">🗂️</TableHead>
                                  <TableHead className="text-right">Akcie</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.contracts.map(contract => (
                                  <TableRow key={contract.id} data-testid={`row-cakajuce-${contract.id}`}>
                                    <TableCell className="text-center text-xs text-muted-foreground">
                                      <InlineSortOrderEdit contractId={contract.id} currentOrder={contract.sortOrderInInventory} />
                                    </TableCell>
                                    {sprievodkaColumnVisibility.isVisible("partnerId") && <TableCell className="text-sm">{getPartnerName(contract)}</TableCell>}
                                    {sprievodkaColumnVisibility.isVisible("productId") && <TableCell className="text-sm">{getProductName(contract)}</TableCell>}
                                    {sprievodkaColumnVisibility.isVisible("proposalNumber") && <TableCell className="text-sm font-mono">{contract.proposalNumber || "-"}</TableCell>}
                                    {sprievodkaColumnVisibility.isVisible("contractNumber") && <TableCell className="font-mono text-sm" data-testid={`text-dispatched-number-${contract.id}`}>
                                      <span className="flex items-center gap-1">
                                        <Lock className="w-3 h-3 text-amber-500 shrink-0" style={{ display: contract.isLocked ? 'block' : 'none' }} />
                                        {contract.insuranceContractNumber || "-"}
                                      </span>
                                    </TableCell>}
                                    <TableCell className="text-sm">
                                      {(() => {
                                        const sub2 = subjects?.find(s => s.id === contract.subjectId);
                                        const st = sub2?.type === "person" ? "FO" : sub2?.type === "szco" ? "SZČO" : sub2?.type === "company" ? "PO" : "—";
                                        return <Badge variant="outline" className={`text-[10px] ${st === "FO" ? "border-blue-500/50 text-blue-400" : st === "SZČO" ? "border-amber-500/50 text-amber-400" : st === "PO" ? "border-purple-500/50 text-purple-400" : "border-muted text-muted-foreground"}`}>{st}</Badge>;
                                      })()}
                                    </TableCell>
                                    {sprievodkaColumnVisibility.isVisible("subjectId") && <TableCell className="text-sm">
                                      <span className="flex items-center gap-1 flex-wrap">
                                        <span>{getSubjectDisplay(contract.subjectId)}</span>
                                        {(() => {
                                          const sub2 = subjects?.find(s => s.id === contract.subjectId);
                                          const rcIco = sub2 ? (sub2.type === "person" ? sub2.birthNumber : sub2.type === "szco" ? ((contract as any).szcoIco || sub2.birthNumber) : (sub2 as any).ico) : null;
                                          return rcIco ? <span className="text-[10px] font-mono text-muted-foreground">{rcIco}</span> : null;
                                        })()}
                                      </span>
                                    </TableCell>}
                                    <TableCell className="py-1 text-center">
                                      {Array.isArray(contract.documents) && contract.documents.length > 0 ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold whitespace-nowrap">
                                              🗂️ {contract.documents.length}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent className="text-xs">
                                            {contract.documents.length} {contract.documents.length === 1 ? "nahraný dokument" : contract.documents.length < 5 ? "nahrané dokumenty" : "nahraných dokumentov"}
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : null}
                                    </TableCell>
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
                  {acceptedBySprievodka.map(group => ({ ...group, contracts: filterBySearch(group.contracts) })).filter(g => g.contracts.length > 0).map(group => {
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
            const phaseContracts = filterBySearch(phaseId === 6 ? phase6Contracts : phaseId === 7 ? phase7Contracts : phaseId === 8 ? phase8Contracts : phaseId === 9 ? phase9Contracts : phase10Contracts);
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
                                            <th className="p-2 text-left font-medium text-muted-foreground" title={NAVRH_LABEL_FULL}>{NAVRH_LABEL_SHORT}</th>
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
                                                  <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => manualCompletePhase6Mutation.mutate(contract.id)} disabled={manualCompletePhase6Mutation.isPending} data-testid={`button-manual-complete-${contract.id}`}>
                                                    <Upload className="w-3 h-3 mr-1" />Manuálne dokončiť
                                                  </Button>
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
                                            {evidenciaColumnVisibility.isVisible("proposalNumber") && <TableHead title={NAVRH_LABEL_FULL}>{NAVRH_LABEL_SHORT}</TableHead>}
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
      {quickFixDialog}
      {preSelectDialog}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">{contractView ? VIEW_TITLES[contractView] || "Evidencia zmlúv" : "Evidencia zmlúv"}</h1>
          <HelpIcon text={contractView === "moje" ? "Zmluvy, kde ste klientom (poistený, majiteľ, nájomca)." : contractView === "portfolio" ? "Zmluvy klientov, ktoré spravujete ako sprostredkovateľ alebo špecialista." : "Prehled vsetkych zmluv v systeme. Zmluvy sa viazu na klientov, produkty a partnerov."} side="right" />
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

      {contractView && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" data-testid="badge-view-filter">
            {VIEW_TITLES[contractView]} — {activeContracts.length} {activeContracts.length === 1 ? "zmluva" : activeContracts.length < 5 ? "zmluvy" : "zmlúv"}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => {
            const params = new URLSearchParams(searchString);
            params.delete("view");
            const qs = params.toString();
            navigate(qs ? `/contracts?${qs}` : "/contracts");
          }} data-testid="button-clear-view">
            <X className="w-3.5 h-3.5 mr-1" /> Zobraziť všetky
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : activeContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12" data-testid="text-no-contracts">
              {contractView ? `Žiadne zmluvy v sekcii "${VIEW_TITLES[contractView]}"` : "Ziadne zmluvy"}
            </p>
          ) : (
            <div className="relative overflow-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
            <Table stickyHeader>
              <TableHeader>
                <TableRow>
                  {columnVisibility.isVisible("contractNumber") && <TableHead sortKey="contractNumber" sortDirection={skMain === "contractNumber" ? sdMain : null} onSort={rsMain}>Cislo zmluvy</TableHead>}
                  {columnVisibility.isVisible("status") && <TableHead style={{ minWidth: 140 }}>Stav</TableHead>}
                  {columnVisibility.isVisible("proposalNumber") && <TableHead sortKey="proposalNumber" sortDirection={skMain === "proposalNumber" ? sdMain : null} onSort={rsMain} title={NAVRH_LABEL_FULL}>{NAVRH_LABEL_SHORT}</TableHead>}
                  {columnVisibility.isVisible("globalNumber") && <TableHead sortKey="globalNumber" sortDirection={skMain === "globalNumber" ? sdMain : null} onSort={rsMain}>Poradove cislo</TableHead>}
                  {columnVisibility.isVisible("partnerId") && <TableHead sortKey="partnerId" sortDirection={skMain === "partnerId" ? sdMain : null} onSort={rsMain}>Partner</TableHead>}
                  {columnVisibility.isVisible("subjectId") && <TableHead sortKey="subjectId" sortDirection={skMain === "subjectId" ? sdMain : null} onSort={rsMain}>Klient</TableHead>}
                  {columnVisibility.isVisible("productId") && <TableHead sortKey="productId" sortDirection={skMain === "productId" ? sdMain : null} onSort={rsMain}>Produkt</TableHead>}
                  {columnVisibility.isVisible("inventoryId") && <TableHead sortKey="inventoryId" sortDirection={skMain === "inventoryId" ? sdMain : null} onSort={rsMain}>Sprievodka</TableHead>}
                  {columnVisibility.isVisible("annualPremium") && <TableHead sortKey="annualPremium" sortDirection={skMain === "annualPremium" ? sdMain : null} onSort={rsMain}>Rocne poistne</TableHead>}
                  {columnVisibility.isVisible("signedDate") && <TableHead sortKey="signedDate" sortDirection={skMain === "signedDate" ? sdMain : null} onSort={rsMain}>Vytvorenie zmluvy</TableHead>}
                  {columnVisibility.isVisible("premiumAmount") && <TableHead sortKey="premiumAmount" sortDirection={skMain === "premiumAmount" ? sdMain : null} onSort={rsMain}>Lehotne poistne</TableHead>}
                  {columnVisibility.isVisible("freshness") && <TableHead>Čerstvosť</TableHead>}
                  <TableHead className="text-center w-[60px]">🗂️</TableHead>
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
                      <TableCell className="py-1 text-center" data-testid={`text-docs-count-${contract.id}`}>
                        {Array.isArray(contract.documents) && contract.documents.length > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold whitespace-nowrap">
                                  🗂️ {contract.documents.length}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">
                                {contract.documents.length} {contract.documents.length === 1 ? "nahraný dokument" : contract.documents.length < 5 ? "nahrané dokumenty" : "nahraných dokumentov"}
                              </TooltipContent>
                            </Tooltip>
                            {contract.documents.length >= 30 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" data-testid={`icon-high-docs-${contract.id}`} />
                                </TooltipTrigger>
                                <TooltipContent className="text-xs max-w-[220px]">
                                  Táto zmluva obsahuje vysoký počet dokumentov. Skontrolujte, či nie sú duplicitné.
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                        ) : null}
                      </TableCell>
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
