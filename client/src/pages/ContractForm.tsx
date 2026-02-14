import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useParams } from "wouter";
import type { Contract, ContractStatus, ContractTemplate, ContractInventory, Subject, Partner, MyCompany, Sector, Section, SectorProduct, ContractPassword } from "@shared/schema";
import { ArrowLeft, Save, Loader2, LayoutGrid, KeyRound, Plus, Trash2, FileText, Users, ClipboardList, FolderOpen, DollarSign, BarChart3, ListChecks, PieChart } from "lucide-react";
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

const TABS = [
  { key: "vseobecne", label: "Vseobecne", icon: FileText },
  { key: "udaje-klient", label: "Udaje o klientovi", icon: Users },
  { key: "udaje-zmluva", label: "Udaje o zmluve", icon: ClipboardList },
  { key: "dokumenty", label: "Dokumenty", icon: FolderOpen },
  { key: "odmeny", label: "Odmeny", icon: DollarSign },
  { key: "stavy", label: "Stavy zmluv", icon: BarChart3 },
  { key: "zhrnutie", label: "Zhrnutie", icon: ListChecks },
  { key: "provizne", label: "Provizne zostavy", icon: PieChart },
] as const;

type TabKey = typeof TABS[number]["key"];

const PAYMENT_FREQUENCIES = [
  { value: "mesacne", label: "Mesacne" },
  { value: "stvrtrocne", label: "Stvrtrocne" },
  { value: "polrocne", label: "Polrocne" },
  { value: "rocne", label: "Rocne" },
  { value: "dvojrocne", label: "Dvojrocne" },
  { value: "trojrocne", label: "Trojrocne" },
  { value: "jednorazove", label: "Jednorazove" },
  { value: "bez-platobneho-obdobia", label: "Bez platobneho obdobia" },
];

const CONTRACT_TYPES = [
  { value: "Nova", label: "Nova" },
  { value: "Prestupova", label: "Prestupova" },
  { value: "Zmenova", label: "Zmenova" },
];

function PasswordsModal({
  open,
  onOpenChange,
  contractId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId: number | null;
}) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [newNote, setNewNote] = useState("");

  const { data: passwords, isLoading } = useQuery<ContractPassword[]>({
    queryKey: ["/api/contracts", contractId, "passwords"],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}/passwords`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!contractId && open,
  });

  const createMutation = useMutation({
    mutationFn: (data: { password: string; note: string }) =>
      apiRequest("POST", `/api/contracts/${contractId}/passwords`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "passwords"] });
      setNewPassword("");
      setNewNote("");
      toast({ title: "Uspech", description: "Heslo pridane" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa pridat heslo", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/contract-passwords/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts", contractId, "passwords"] });
      toast({ title: "Uspech", description: "Heslo vymazane" });
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat heslo", variant: "destructive" }),
  });

  function handleAdd() {
    if (!newPassword.trim()) {
      toast({ title: "Chyba", description: "Heslo je povinne", variant: "destructive" });
      return;
    }
    createMutation.mutate({ password: newPassword, note: newNote });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle data-testid="text-passwords-title">
            <span className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Hesla k zmluve
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">Heslo *</label>
              <Input
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Zadajte heslo"
                data-testid="input-new-password"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Poznamka k heslu</label>
              <div className="flex items-center gap-2">
                <Input
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Poznamka"
                  data-testid="input-new-password-note"
                />
                <Button
                  size="icon"
                  onClick={handleAdd}
                  disabled={createMutation.isPending}
                  data-testid="button-add-password"
                >
                  {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : passwords && passwords.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Heslo</TableHead>
                  <TableHead>Poznamka</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passwords.map(pw => (
                  <TableRow key={pw.id} data-testid={`row-password-${pw.id}`}>
                    <TableCell className="font-mono text-sm" data-testid={`text-password-${pw.id}`}>{pw.password}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{pw.note || "-"}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => deleteMutation.mutate(pw.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-password-${pw.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-passwords">
              Ziadne hesla k zmluve
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ContractForm() {
  const { data: appUser } = useAppUser();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const contractId = params?.id ? parseInt(params.id) : null;
  const isEditing = !!contractId;

  const [activeTab, setActiveTab] = useState<TabKey>("vseobecne");
  const [passwordsOpen, setPasswordsOpen] = useState(false);
  const timerRef = useRef<number>(0);

  const [contractNumber, setContractNumber] = useState("");
  const [proposalNumber, setProposalNumber] = useState("");
  const [kik, setKik] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [partnerId, setPartnerId] = useState<string>("");
  const [statusId, setStatusId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [inventoryId, setInventoryId] = useState<string>("");
  const [stateId, setStateId] = useState<string>("");
  const [companyId, setCompanyId] = useState<string>("");
  const [signingPlace, setSigningPlace] = useState("");
  const [contractType, setContractType] = useState("Nova");
  const [paymentFrequency, setPaymentFrequency] = useState<string>("");
  const [signedDate, setSignedDate] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [annualPremium, setAnnualPremium] = useState("");
  const [commissionAmount, setCommissionAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [notes, setNotes] = useState("");

  const [contractSectorId, setContractSectorId] = useState<string>("");
  const [contractSectionId, setContractSectionId] = useState<string>("");
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

  const { data: existingContract, isLoading: contractLoading } = useQuery<Contract>({
    queryKey: ["/api/contracts", contractId],
    queryFn: async () => {
      const res = await fetch(`/api/contracts/${contractId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: isEditing,
  });

  const { data: allStates } = useStates();
  const { data: subjects } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: partners } = useQuery<Partner[]>({ queryKey: ["/api/partners"] });
  const { data: companies } = useQuery<MyCompany[]>({ queryKey: ["/api/my-companies"] });
  const { data: statuses } = useQuery<ContractStatus[]>({ queryKey: ["/api/contract-statuses"] });
  const { data: templates } = useQuery<ContractTemplate[]>({ queryKey: ["/api/contract-templates"] });
  const { data: inventories } = useQuery<ContractInventory[]>({ queryKey: ["/api/contract-inventories"] });
  const { data: contractSectors } = useQuery<Sector[]>({ queryKey: ["/api/sectors"] });

  const { data: allSPForEdit } = useQuery<SectorProduct[]>({ queryKey: ["/api/sector-products"] });
  const { data: allSectionsForEdit } = useQuery<Section[]>({
    queryKey: ["/api/sections"],
    queryFn: async () => {
      const res = await fetch("/api/sections", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

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

  const { data: productPanels, isLoading: panelsLoading } = useQuery<PanelWithParams[]>({
    queryKey: ["/api/sector-products", sectorProductId, "panels-with-parameters"],
    queryFn: async () => {
      const res = await fetch(`/api/sector-products/${sectorProductId}/panels-with-parameters`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!sectorProductId,
  });

  useEffect(() => {
    timerRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (existingContract && allSPForEdit && allSectionsForEdit) {
      setContractNumber(existingContract.contractNumber || "");
      setProposalNumber(existingContract.proposalNumber || "");
      setKik(existingContract.kik || "");
      setSubjectId(existingContract.subjectId?.toString() || "");
      setPartnerId(existingContract.partnerId?.toString() || "");
      setSectorProductIdRaw(existingContract.sectorProductId?.toString() || "");
      setPanelValues(existingContract.dynamicPanelValues || {});
      setStatusId(existingContract.statusId?.toString() || "");
      setTemplateId(existingContract.templateId?.toString() || "");
      setInventoryId(existingContract.inventoryId?.toString() || "");
      setStateId(existingContract.stateId?.toString() || "");
      setCompanyId(existingContract.companyId?.toString() || "");
      setSigningPlace(existingContract.signingPlace || "");
      setContractType(existingContract.contractType || "Nova");
      setPaymentFrequency(existingContract.paymentFrequency || "");
      setSignedDate(existingContract.signedDate ? new Date(existingContract.signedDate).toISOString().split("T")[0] : "");
      setEffectiveDate(existingContract.effectiveDate ? new Date(existingContract.effectiveDate).toISOString().split("T")[0] : "");
      setExpiryDate(existingContract.expiryDate ? new Date(existingContract.expiryDate).toISOString().split("T")[0] : "");
      setPremiumAmount(existingContract.premiumAmount?.toString() || "");
      setAnnualPremium(existingContract.annualPremium?.toString() || "");
      setCommissionAmount(existingContract.commissionAmount?.toString() || "");
      setCurrency(existingContract.currency || "EUR");
      setNotes(existingContract.notes || "");

      const spId = existingContract.sectorProductId;
      if (spId) {
        const sp = allSPForEdit.find(p => p.id === spId);
        if (sp) {
          const sec = allSectionsForEdit.find(s => s.id === sp.sectionId);
          if (sec) {
            setContractSectorId(sec.sectorId.toString());
            setContractSectionId(sec.id.toString());
          }
        }
      }
    }
  }, [existingContract, allSPForEdit, allSectionsForEdit]);

  useEffect(() => {
    if (!isEditing && appUser) {
      setStateId(appUser.activeStateId?.toString() || "");
      setCompanyId(appUser.activeCompanyId?.toString() || "");
    }
  }, [isEditing, appUser]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contracts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Uspech", description: "Zmluva vytvorena" });
      navigate("/contracts");
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit zmluvu", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contracts/${contractId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Uspech", description: "Zmluva aktualizovana" });
      navigate("/contracts");
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat zmluvu", variant: "destructive" }),
  });

  function handleSubmit() {
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const payload = {
      contractNumber: contractNumber || null,
      proposalNumber: proposalNumber || null,
      kik: kik || null,
      subjectId: subjectId ? parseInt(subjectId) : null,
      partnerId: partnerId ? parseInt(partnerId) : null,
      productId: null,
      sectorProductId: sectorProductId ? parseInt(sectorProductId) : null,
      statusId: statusId ? parseInt(statusId) : null,
      templateId: templateId ? parseInt(templateId) : null,
      inventoryId: inventoryId ? parseInt(inventoryId) : null,
      stateId: stateId ? parseInt(stateId) : null,
      companyId: companyId ? parseInt(companyId) : null,
      signingPlace: signingPlace || null,
      contractType: contractType || "Nova",
      paymentFrequency: paymentFrequency || null,
      signedDate: signedDate ? new Date(signedDate).toISOString() : null,
      effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : null,
      expiryDate: expiryDate ? new Date(expiryDate).toISOString() : null,
      premiumAmount: premiumAmount ? parseInt(premiumAmount) : null,
      annualPremium: annualPremium ? parseInt(annualPremium) : null,
      commissionAmount: commissionAmount ? parseInt(commissionAmount) : null,
      currency,
      notes: notes || null,
      processingTimeSec,
      dynamicPanelValues: Object.keys(panelValues).length > 0 ? panelValues : undefined,
    };

    if (isEditing) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (isEditing && contractLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentCompany = companies?.find(c => c.id === (companyId ? parseInt(companyId) : appUser?.activeCompanyId));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 p-4 border-b border-border flex-wrap">
        <Button
          variant="ghost"
          onClick={() => navigate("/contracts")}
          data-testid="button-back-to-list"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Spat na zoznam
        </Button>
        <h1 className="text-xl font-bold" data-testid="text-form-title">
          {isEditing ? "Upravit zmluvu" : "Nova zmluva"}
        </h1>
        {existingContract?.uid && (
          <Badge variant="outline" data-testid="badge-contract-uid">{existingContract.uid}</Badge>
        )}
      </div>

      <div className="border-b border-border bg-card/50">
        <div className="flex items-center gap-1 px-4 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
                data-testid={`tab-${tab.key}`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "vseobecne" && (
          <div className="max-w-4xl space-y-4" data-testid="section-vseobecne">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Spolocnost</label>
                <Input
                  value={currentCompany?.name || ""}
                  disabled
                  className="bg-muted"
                  data-testid="input-company-context"
                />
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
                <label className="text-sm font-medium">Kalkulacka</label>
                <Select value="" onValueChange={() => {}}>
                  <SelectTrigger data-testid="select-contract-calculator">
                    <SelectValue placeholder="Vyberte kalkulacku" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ziadna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sablona zmluvy</label>
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">KIK</label>
                <Input value={kik} onChange={e => setKik(e.target.value)} data-testid="input-contract-kik" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cislo navrhu</label>
                <Input value={proposalNumber} onChange={e => setProposalNumber(e.target.value)} data-testid="input-contract-proposal" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Cislo zmluvy</label>
                <Input value={contractNumber} onChange={e => setContractNumber(e.target.value)} data-testid="input-contract-number" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Miesto podpisu *</label>
                <Input value={signingPlace} onChange={e => setSigningPlace(e.target.value)} data-testid="input-signing-place" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Typ zmluvy *</label>
                <Select value={contractType} onValueChange={setContractType}>
                  <SelectTrigger data-testid="select-contract-type">
                    <SelectValue placeholder="Vyberte typ" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Datum podpisu *</label>
                <Input type="date" value={signedDate} onChange={e => setSignedDate(e.target.value)} data-testid="input-signed-date" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Ucinnost od *</label>
                <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} data-testid="input-effective-date" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Koniec zmluvy</label>
                <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} data-testid="input-expiry-date" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Frekvencia platenia *</label>
                <Select value={paymentFrequency} onValueChange={setPaymentFrequency}>
                  <SelectTrigger data-testid="select-payment-frequency">
                    <SelectValue placeholder="Vyberte frekvenciu" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_FREQUENCIES.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Lehotne poistne *</label>
                <Input type="number" value={premiumAmount} onChange={e => setPremiumAmount(e.target.value)} className="font-mono" data-testid="input-premium-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Rocne poistne</label>
                <Input type="number" value={annualPremium} onChange={e => setAnnualPremium(e.target.value)} className="font-mono" data-testid="input-annual-premium" />
              </div>
              <div className="space-y-2 flex flex-col justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (isEditing) {
                      setPasswordsOpen(true);
                    } else {
                      toast({ title: "Info", description: "Najprv ulozte zmluvu, potom mozete pridat hesla" });
                    }
                  }}
                  data-testid="button-contract-passwords"
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  Hesla k zmluve
                </Button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "udaje-klient" && (
          <div className="max-w-4xl space-y-4" data-testid="section-udaje-klient">
            <h2 className="text-lg font-semibold">Udaje o klientovi</h2>
            <div className="grid grid-cols-2 gap-4">
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

            {subjectId && (() => {
              const selectedSubject = subjects?.find(s => s.id === parseInt(subjectId));
              if (!selectedSubject) return null;
              return (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <h3 className="text-sm font-semibold">Detail klienta</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Meno: </span>
                        <span data-testid="text-subject-name">
                          {selectedSubject.type === "person"
                            ? `${selectedSubject.firstName} ${selectedSubject.lastName}`
                            : selectedSubject.companyName}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">UID: </span>
                        <span className="font-mono" data-testid="text-subject-uid">{selectedSubject.uid}</span>
                      </div>
                      {selectedSubject.email && (
                        <div>
                          <span className="text-muted-foreground">Email: </span>
                          <span>{selectedSubject.email}</span>
                        </div>
                      )}
                      {selectedSubject.phone && (
                        <div>
                          <span className="text-muted-foreground">Telefon: </span>
                          <span>{selectedSubject.phone}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        )}

        {activeTab === "udaje-zmluva" && (
          <div className="max-w-4xl space-y-4" data-testid="section-udaje-zmluva">
            <h2 className="text-lg font-semibold">Udaje o zmluve - Produkt a parametre</h2>

            <div className="grid grid-cols-3 gap-4">
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

            {sectorProductId && panelsLoading && (
              <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Nacitavam panely...
              </div>
            )}

            {sectorProductId && productPanels && productPanels.length > 0 && (
              <div className="space-y-3" data-testid="section-contract-panels">
                <div className="flex items-center gap-2 mb-2">
                  <LayoutGrid className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Parametre produktu</span>
                </div>
                {productPanels.map(panel => (
                  <Card key={panel.id} className="p-3" data-testid={`panel-section-${panel.id}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold">{panel.name}</span>
                      {panel.description && (
                        <span className="text-xs text-muted-foreground">({panel.description})</span>
                      )}
                    </div>
                    {panel.parameters.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3">
                        {panel.parameters.map(param => (
                          <div key={param.id} className="space-y-1">
                            <label className="text-xs font-medium">
                              {param.name}
                              {param.isRequired && <span className="text-destructive ml-1">*</span>}
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
                            ) : param.paramType === "combobox" && param.options?.length > 0 ? (
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
                            ) : (
                              <Input
                                type={param.paramType === "number" || param.paramType === "currency" || param.paramType === "percent" ? "number" : param.paramType === "date" ? "date" : param.paramType === "datetime" ? "datetime-local" : param.paramType === "email" ? "email" : param.paramType === "url" ? "url" : "text"}
                                value={panelValues[`${panel.id}_${param.id}`] || param.defaultValue || ""}
                                onChange={e => setPanelValues(prev => ({ ...prev, [`${panel.id}_${param.id}`]: e.target.value }))}
                                data-testid={`input-panel-param-${panel.id}-${param.id}`}
                              />
                            )}
                            {param.helpText && (
                              <p className="text-xs text-muted-foreground">{param.helpText}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Ziadne parametre</p>
                    )}
                  </Card>
                ))}
              </div>
            )}

            {sectorProductId && productPanels && productPanels.length === 0 && (
              <p className="text-sm text-muted-foreground" data-testid="text-no-panels">
                Vybrany produkt nema priradene panely s parametrami.
              </p>
            )}
          </div>
        )}

        {activeTab === "dokumenty" && (
          <div className="max-w-4xl space-y-4" data-testid="section-dokumenty">
            <h2 className="text-lg font-semibold">Dokumenty</h2>
            <Card>
              <CardContent className="p-6 text-center">
                <FolderOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground" data-testid="text-dokumenty-placeholder">
                  Modul dokumentov bude dostupny v dalsej verzii.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "odmeny" && (
          <div className="max-w-4xl space-y-4" data-testid="section-odmeny">
            <h2 className="text-lg font-semibold">Odmeny</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Suma provizie</label>
                <Input type="number" value={commissionAmount} onChange={e => setCommissionAmount(e.target.value)} className="font-mono" data-testid="input-commission-amount" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Mena</label>
                <Input value={currency} onChange={e => setCurrency(e.target.value)} data-testid="input-currency" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Poznamky</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} data-testid="input-notes" />
            </div>
          </div>
        )}

        {activeTab === "stavy" && (
          <div className="max-w-4xl space-y-4" data-testid="section-stavy">
            <h2 className="text-lg font-semibold">Stavy zmluv</h2>
            <div className="space-y-2">
              <label className="text-sm font-medium">Aktualny stav</label>
              <Select value={statusId} onValueChange={setStatusId}>
                <SelectTrigger data-testid="select-status-section">
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
            {statuses && statuses.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Dostupne stavy</h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    {statuses.map(s => (
                      <Badge
                        key={s.id}
                        variant={statusId === s.id.toString() ? "default" : "outline"}
                        style={statusId === s.id.toString() ? { backgroundColor: s.color } : { borderColor: s.color, color: s.color }}
                        className="cursor-pointer"
                        onClick={() => setStatusId(s.id.toString())}
                        data-testid={`badge-status-${s.id}`}
                      >
                        {s.name}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === "zhrnutie" && (
          <div className="max-w-4xl space-y-4" data-testid="section-zhrnutie">
            <h2 className="text-lg font-semibold">Zhrnutie zmluvy</h2>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <SummaryField label="Cislo zmluvy" value={contractNumber || "-"} testId="summary-contract-number" />
                  <SummaryField label="Cislo navrhu" value={proposalNumber || "-"} testId="summary-proposal" />
                  <SummaryField label="KIK" value={kik || "-"} testId="summary-kik" />
                  <SummaryField label="Typ zmluvy" value={contractType || "-"} testId="summary-type" />
                  <SummaryField label="Miesto podpisu" value={signingPlace || "-"} testId="summary-signing-place" />
                  <SummaryField label="Klient" value={(() => {
                    const s = subjects?.find(sub => sub.id === (subjectId ? parseInt(subjectId) : -1));
                    if (!s) return "-";
                    return s.type === "person" ? `${s.firstName} ${s.lastName}` : (s.companyName || "-");
                  })()} testId="summary-subject" />
                  <SummaryField label="Partner" value={partners?.find(p => p.id === (partnerId ? parseInt(partnerId) : -1))?.name || "-"} testId="summary-partner" />
                  <SummaryField label="Produkt" value={(() => {
                    const sp = allSPForEdit?.find(p => p.id === (sectorProductId ? parseInt(sectorProductId) : -1));
                    return sp ? `${sp.name}${sp.abbreviation ? ` (${sp.abbreviation})` : ''}` : "-";
                  })()} testId="summary-product" />
                  <SummaryField label="Stav" value={statuses?.find(s => s.id === (statusId ? parseInt(statusId) : -1))?.name || "-"} testId="summary-status" />
                  <SummaryField label="Sablona" value={templates?.find(t => t.id === (templateId ? parseInt(templateId) : -1))?.name || "-"} testId="summary-template" />
                  <SummaryField label="Frekvencia platenia" value={PAYMENT_FREQUENCIES.find(f => f.value === paymentFrequency)?.label || "-"} testId="summary-frequency" />
                  <SummaryField label="Lehotne poistne" value={premiumAmount ? `${premiumAmount} ${currency}` : "-"} testId="summary-premium" mono />
                  <SummaryField label="Rocne poistne" value={annualPremium ? `${annualPremium} ${currency}` : "-"} testId="summary-annual" mono />
                  <SummaryField label="Suma provizie" value={commissionAmount ? `${commissionAmount} ${currency}` : "-"} testId="summary-commission" mono />
                  <SummaryField label="Datum podpisu" value={signedDate || "-"} testId="summary-signed" />
                  <SummaryField label="Ucinnost od" value={effectiveDate || "-"} testId="summary-effective" />
                  <SummaryField label="Koniec zmluvy" value={expiryDate || "-"} testId="summary-expiry" />
                  <SummaryField label="Spolocnost" value={currentCompany?.name || "-"} testId="summary-company" />
                  <SummaryField label="Stat" value={allStates?.find(s => s.id === (stateId ? parseInt(stateId) : -1))?.name || "-"} testId="summary-state" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "provizne" && (
          <div className="max-w-4xl space-y-4" data-testid="section-provizne">
            <h2 className="text-lg font-semibold">Provizne zostavy</h2>
            <Card>
              <CardContent className="p-6 text-center">
                <PieChart className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground" data-testid="text-provizne-placeholder">
                  Provizne zostavy budu dostupne v dalsej verzii.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 z-50 bg-background/95 backdrop-blur border-t border-border p-3 flex items-center justify-between gap-4 flex-wrap">
        <Button variant="ghost" onClick={() => navigate("/contracts")} data-testid="button-footer-back">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Spat na zoznam
        </Button>
        <Button onClick={handleSubmit} disabled={isPending} data-testid="button-save-contract">
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Ukladam...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Ulozit zmeny
            </>
          )}
        </Button>
      </div>

      {isEditing && (
        <PasswordsModal
          open={passwordsOpen}
          onOpenChange={setPasswordsOpen}
          contractId={contractId}
        />
      )}
    </div>
  );
}

function SummaryField({ label, value, testId, mono }: { label: string; value: string; testId: string; mono?: boolean }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`text-sm ${mono ? "font-mono" : ""}`} data-testid={testId}>{value}</p>
    </div>
  );
}
