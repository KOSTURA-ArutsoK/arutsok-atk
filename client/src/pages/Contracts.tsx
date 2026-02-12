import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import type { Contract, ContractStatus, ContractTemplate, ContractInventory, Subject, Partner, Product, MyCompany } from "@shared/schema";
import { Plus, Pencil, Trash2, Eye, FileText, Loader2, Lock } from "lucide-react";
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
import { ProcessingSaveButton } from "@/components/processing-save-button";

function formatProcessingTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "-";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

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

  const [contractNumber, setContractNumber] = useState("");
  const [subjectId, setSubjectId] = useState<string>("");
  const [partnerId, setPartnerId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
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

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/contracts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Uspech", description: "Zmluva vytvorena" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vytvorit zmluvu", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("PUT", `/api/contracts/${editingContract?.id}`, data),
    onSuccess: () => {
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
        setProductId(editingContract.productId?.toString() || "");
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
      } else {
        setContractNumber("");
        setSubjectId("");
        setPartnerId("");
        setProductId("");
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
      }
    }
  }, [open, editingContract, activeStateId]);

  const handleOpenChange = useCallback((isOpen: boolean) => {
    onOpenChange(isOpen);
  }, [onOpenChange]);

  function handleSubmit() {
    if (!contractNumber) {
      toast({ title: "Chyba", description: "Cislo zmluvy je povinne", variant: "destructive" });
      return;
    }
    const processingTimeSec = Math.round((performance.now() - timerRef.current) / 1000);
    const payload = {
      contractNumber,
      subjectId: subjectId ? parseInt(subjectId) : null,
      partnerId: partnerId ? parseInt(partnerId) : null,
      productId: productId ? parseInt(productId) : null,
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
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-contract-dialog-title">
            {editingContract ? "Upravit zmluvu" : "Pridat zmluvu"}
          </DialogTitle>
          {editingContract?.isLocked && (
            <div className="flex items-center gap-2 text-amber-500 text-sm mt-1">
              <Lock className="w-4 h-4" />
              <span>Zmluva je zamknuta v supiske. Iba admin moze upravovat.</span>
            </div>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Cislo zmluvy *</label>
              <Input value={contractNumber} onChange={e => setContractNumber(e.target.value)} data-testid="input-contract-number" />
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
            <div className="space-y-2">
              <label className="text-sm font-medium">Produkt</label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger data-testid="select-contract-product">
                  <SelectValue placeholder="Vyberte produkt" />
                </SelectTrigger>
                <SelectContent>
                  {products?.filter(p => !p.isDeleted).map(p => (
                    <SelectItem key={p.id} value={p.id.toString()}>{p.name} ({p.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
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

          <div className="grid grid-cols-3 gap-4">
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

          <div className="grid grid-cols-3 gap-4">
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
        <ProcessingSaveButton isPending={isPending} onClick={handleSubmit} type="button" />
      </DialogContent>
    </Dialog>
  );
}

function ContractDetailDialog({
  contract,
  onClose,
  subjects,
  partners,
  products,
  statuses,
  templates,
  inventories,
  companies,
  states,
}: {
  contract: Contract;
  onClose: () => void;
  subjects: Subject[];
  partners: Partner[];
  products: Product[];
  statuses: ContractStatus[];
  templates: ContractTemplate[];
  inventories: ContractInventory[];
  companies: MyCompany[];
  states: { id: number; name: string; code: string }[];
}) {
  const subjectName = subjects?.find(s => s.id === contract.subjectId);
  const partnerName = partners?.find(p => p.id === contract.partnerId)?.name || "-";
  const productName = products?.find(p => p.id === contract.productId);
  const status = statuses?.find(s => s.id === contract.statusId);
  const templateName = templates?.find(t => t.id === contract.templateId)?.name || "-";
  const inventoryName = inventories?.find(i => i.id === contract.inventoryId)?.name || "-";
  const companyName = companies?.find(c => c.id === contract.companyId)?.name || "-";
  const stateName = states?.find(s => s.id === contract.stateId)?.name || "-";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <DialogTitle data-testid="text-contract-detail-title">Zmluva {contract.contractNumber || contract.uid}</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {status && (
                  <Badge variant="outline" style={{ borderColor: status.color, color: status.color }} data-testid="badge-detail-status">
                    {status.name}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-3 gap-4">
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

          <div className="grid grid-cols-3 gap-4">
            <div>
              <span className="text-xs text-muted-foreground">Produkt</span>
              <p className="text-sm" data-testid="text-detail-product">{productName ? `${productName.name} (${productName.code})` : "-"}</p>
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

          <div className="grid grid-cols-3 gap-4">
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

          <div className="grid grid-cols-3 gap-4">
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

          {contract.notes && (
            <div>
              <span className="text-xs text-muted-foreground">Poznamky</span>
              <p className="text-sm mt-1" data-testid="text-detail-notes">{contract.notes}</p>
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
            <span>Cas spracovania: {formatProcessingTime(contract.processingTimeSec || 0)}</span>
            <span>Vytvorene: {contract.createdAt ? new Date(contract.createdAt).toLocaleDateString("sk-SK") : "-"}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeleteContractDialog({
  contract,
  open,
  onOpenChange,
}: {
  contract: Contract;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/contracts/${contract.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      toast({ title: "Uspech", description: "Zmluva vymazana" });
      onOpenChange(false);
    },
    onError: () => toast({ title: "Chyba", description: "Nepodarilo sa vymazat zmluvu", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle data-testid="text-delete-dialog-title">Vymazat zmluvu</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground" data-testid="text-delete-confirmation">
            Naozaj chcete vymazat zmluvu <span className="font-semibold text-foreground">{contract.contractNumber}</span>? Tuto akciu nie je mozne vratit.
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

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContract, setDeletingContract] = useState<Contract | null>(null);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  const [filterStatusId, setFilterStatusId] = useState<string>("all");
  const [filterInventoryId, setFilterInventoryId] = useState<string>("all");

  const { data: statuses } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
  });

  const { data: inventories } = useQuery<ContractInventory[]>({
    queryKey: ["/api/contract-inventories"],
  });

  const contractsUrl = (() => {
    const params = new URLSearchParams();
    if (filterStatusId && filterStatusId !== "all") params.append("statusId", filterStatusId);
    if (filterInventoryId && filterInventoryId !== "all") params.append("inventoryId", filterInventoryId);
    const qs = params.toString();
    return `/api/contracts${qs ? `?${qs}` : ""}`;
  })();

  const { data: contracts, isLoading } = useQuery<Contract[]>({
    queryKey: ["/api/contracts", filterStatusId, filterInventoryId],
    queryFn: async () => {
      const res = await fetch(contractsUrl, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const { data: subjects } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: partners } = useQuery<Partner[]>({ queryKey: ["/api/partners"] });
  const { data: products } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: companies } = useQuery<MyCompany[]>({ queryKey: ["/api/my-companies"] });
  const { data: templates } = useQuery<ContractTemplate[]>({
    queryKey: ["/api/contract-templates"],
  });
  const { data: allStates } = useStates();

  const activeContracts = contracts?.filter(c => !c.isDeleted) || [];

  function getSubjectDisplay(subjectId: number | null) {
    if (!subjectId) return "-";
    const s = subjects?.find(sub => sub.id === subjectId);
    if (!s) return "-";
    return s.type === "person" ? `${s.firstName} ${s.lastName}` : (s.companyName || "-");
  }

  function openCreate() {
    setEditingContract(null);
    setDialogOpen(true);
  }

  function openEdit(contract: Contract) {
    setEditingContract(contract);
    setDialogOpen(true);
  }

  function openDelete(contract: Contract) {
    setDeletingContract(contract);
    setDeleteDialogOpen(true);
  }

  function openView(contract: Contract) {
    setViewingContract(contract);
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Zmluvy</h1>
        <Button onClick={openCreate} data-testid="button-create-contract">
          <Plus className="w-4 h-4 mr-2" />
          Pridat zmluvu
        </Button>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cislo zmluvy</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Supiska</TableHead>
                  <TableHead>Suma</TableHead>
                  <TableHead>Datum podpisu</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeContracts.map(contract => {
                  const status = statuses?.find(s => s.id === contract.statusId);
                  const inventoryName = inventories?.find(i => i.id === contract.inventoryId)?.name || "-";
                  const productName = products?.find(p => p.id === contract.productId)?.name || "-";
                  const partnerName = partners?.find(p => p.id === contract.partnerId)?.name || "-";

                  return (
                    <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                      <TableCell className="font-mono text-sm" data-testid={`text-contract-number-${contract.id}`}>
                        <span className="flex items-center gap-1">
                          {contract.isLocked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                          {contract.contractNumber || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-contract-subject-${contract.id}`}>
                        {getSubjectDisplay(contract.subjectId)}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-contract-partner-${contract.id}`}>
                        {partnerName}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-contract-product-${contract.id}`}>
                        {productName}
                      </TableCell>
                      <TableCell data-testid={`text-contract-status-${contract.id}`}>
                        {status ? (
                          <Badge
                            variant="outline"
                            style={{ borderColor: status.color, color: status.color }}
                          >
                            {status.name}
                          </Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-contract-inventory-${contract.id}`}>
                        {inventoryName}
                      </TableCell>
                      <TableCell className="text-sm font-mono" data-testid={`text-contract-amount-${contract.id}`}>
                        {formatAmount(contract.premiumAmount, contract.currency)}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-contract-date-${contract.id}`}>
                        {formatDate(contract.signedDate)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openView(contract)}
                            data-testid={`button-view-contract-${contract.id}`}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(contract)}
                            data-testid={`button-edit-contract-${contract.id}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openDelete(contract)}
                            data-testid={`button-delete-contract-${contract.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ContractFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingContract={editingContract}
        activeStateId={activeStateId}
      />

      {deletingContract && (
        <DeleteContractDialog
          contract={deletingContract}
          open={deleteDialogOpen}
          onOpenChange={(isOpen) => {
            setDeleteDialogOpen(isOpen);
            if (!isOpen) setDeletingContract(null);
          }}
        />
      )}

      {viewingContract && (
        <ContractDetailDialog
          contract={viewingContract}
          onClose={() => setViewingContract(null)}
          subjects={subjects || []}
          partners={partners || []}
          products={products || []}
          statuses={statuses || []}
          templates={templates || []}
          inventories={inventories || []}
          companies={companies || []}
          states={allStates || []}
        />
      )}
    </div>
  );
}
