import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useStates } from "@/hooks/use-hierarchy";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { Contract, ContractStatus, ContractTemplate, ContractInventory, Subject, Partner, Product, MyCompany, Sector, Section, SectorProduct } from "@shared/schema";
import { Plus, Pencil, Trash2, Eye, FileText, Loader2, Lock, LayoutGrid, Send, Upload, Inbox, CheckCircle2, ChevronDown, ChevronRight, Printer, Search, Archive, AlertTriangle, Calendar, XCircle, MessageSquare, Paperclip } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
        setContractSectorId("");
        setContractSectionId("");
      }
    }
  }, [open, editingContract, activeStateId, allSPForEdit, allSectionsForEdit]);

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
              {duplicateWarning && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 mt-1" data-testid="text-duplicate-warning">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">{duplicateWarning}</p>
                </div>
              )}
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

          {sectorProductId && productPanels && productPanels.length > 0 && (
            <div className="space-y-3 border rounded-md p-4" data-testid="section-contract-panels">
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
          {sectorProductId && panelsLoading && (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Nacitavam panely...
            </div>
          )}

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
  sectorProducts,
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
  sectorProducts: SectorProduct[];
  statuses: ContractStatus[];
  templates: ContractTemplate[];
  inventories: ContractInventory[];
  companies: MyCompany[];
  states: { id: number; name: string; code: string }[];
}) {
  const subjectName = subjects?.find(s => s.id === contract.subjectId);
  const partnerName = partners?.find(p => p.id === contract.partnerId)?.name || "-";
  const sectorProduct = sectorProducts?.find(p => p.id === contract.sectorProductId);
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
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const isEvidencia = location === "/evidencia-zmluv";

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContract, setDeletingContract] = useState<Contract | null>(null);
  const [viewingContract, setViewingContract] = useState<Contract | null>(null);

  const [filterStatusId, setFilterStatusId] = useState<string>("all");
  const [filterInventoryId, setFilterInventoryId] = useState<string>("all");

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [sprievodkaDialogOpen, setSprievodkaDialogOpen] = useState(false);
  const [sprievodkaName, setSprievodkaName] = useState("");

  const [acceptedSprievodkaIds, setAcceptedSprievodkaIds] = useState<Record<number, Set<number>>>({});
  const [expandedSprievodky, setExpandedSprievodky] = useState<Set<number>>(new Set());
  const [activeFolder, setActiveFolder] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [duplicateModal, setDuplicateModal] = useState<{ open: boolean; subjectName?: string }>({ open: false });

  const { data: statuses } = useQuery<ContractStatus[]>({
    queryKey: ["/api/contract-statuses"],
  });

  const { data: inventories } = useQuery<ContractInventory[]>({
    queryKey: ["/api/contract-inventories"],
  });

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

  const activeContracts = contracts?.filter(c => !c.isDeleted) || [];
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
      setSprievodkaName("");
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
    if (!sprievodkaName.trim()) {
      toast({ title: "Chyba", description: "Nazov sprievodky je povinny", variant: "destructive" });
      return;
    }
    dispatchMutation.mutate({
      name: sprievodkaName.trim(),
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
    return s.type === "person" ? `${s.firstName} ${s.lastName}` : (s.companyName || "-");
  }

  function openCreate() {
    navigate("/contracts/new");
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
    { id: 1, label: "Nahravanie zmluv", icon: Upload, color: "text-blue-500", bgColor: "bg-blue-500/15", count: activeContracts.length },
    { id: 2, label: "Cakajuce na prijatie", icon: Inbox, color: "text-amber-500", bgColor: "bg-amber-500/15", count: activeDispatched.length },
    { id: 3, label: "Neprijate zmluvy \u2013 vyhrady", icon: XCircle, color: "text-red-500", bgColor: "bg-red-500/15", count: activeRejected.length },
    { id: 4, label: "Archiv zmluv z neprijatymi zmluvami - vyhrady", icon: Archive, color: "text-muted-foreground", bgColor: "bg-muted/30", count: activeArchived.length },
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

  function renderContractTable(list: Contract[], options?: { showCheckbox?: boolean; showOrder?: boolean; showStatus?: boolean; showRegistration?: boolean; showActions?: boolean }) {
    const { showCheckbox, showOrder, showStatus, showRegistration, showActions = true } = options || {};
    return (
      <Table>
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
            <TableHead>Cislo zmluvy</TableHead>
            {showRegistration && <TableHead>Poradove cislo</TableHead>}
            <TableHead>Klient</TableHead>
            <TableHead>Partner</TableHead>
            <TableHead>Produkt</TableHead>
            {showStatus && <TableHead>Stav</TableHead>}
            <TableHead>Suma</TableHead>
            <TableHead>Datum podpisu</TableHead>
            {showActions && <TableHead className="text-right">Akcie</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map(contract => {
            const status = statuses?.find(s => s.id === contract.statusId);
            return (
              <TableRow key={contract.id} data-testid={`row-evidencia-${contract.id}`}>
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
                <TableCell className="font-mono text-sm" data-testid={`text-contract-number-${contract.id}`}>
                  <span className="flex items-center gap-1">
                    {contract.isLocked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                    {contract.contractNumber || "-"}
                  </span>
                </TableCell>
                {showRegistration && (
                  <TableCell className="font-mono text-sm" data-testid={`text-contract-registration-${contract.id}`}>
                    {contract.globalNumber ? (
                      <span className="font-semibold">{contract.globalNumber}</span>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">V procese</Badge>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-sm">{getSubjectDisplay(contract.subjectId)}</TableCell>
                <TableCell className="text-sm">{getPartnerName(contract)}</TableCell>
                <TableCell className="text-sm">{getProductName(contract)}</TableCell>
                {showStatus && (
                  <TableCell data-testid={`text-contract-status-${contract.id}`}>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {status ? (
                        <Badge variant="outline" style={{ borderColor: status.color, color: status.color }}>{status.name}</Badge>
                      ) : "-"}
                      {statusChangeMeta?.[contract.id]?.hasNote && (
                        <MessageSquare className="w-3.5 h-3.5 text-blue-400 shrink-0" data-testid={`icon-note-${contract.id}`} />
                      )}
                      {statusChangeMeta?.[contract.id]?.hasDocs && (
                        <Paperclip className="w-3.5 h-3.5 text-amber-400 shrink-0" data-testid={`icon-docs-${contract.id}`} />
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell className="text-sm font-mono">{formatAmount(contract.premiumAmount, contract.currency)}</TableCell>
                <TableCell className="text-sm">{formatDate(contract.signedDate)}</TableCell>
                {showActions && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 flex-wrap">
                      <Button size="icon" variant="ghost" onClick={() => openView(contract)} data-testid={`button-view-contract-${contract.id}`}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(contract)} data-testid={`button-edit-contract-${contract.id}`}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openDelete(contract)} data-testid={`button-delete-contract-${contract.id}`}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    );
  }

  if (isEvidencia) {
    const filteredNahravanie = filterBySearch(activeContracts);
    const filteredRejected = filterBySearch(activeRejected);
    const filteredArchived = filterBySearch(activeArchived);

    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Evidencia zmluv</h1>
          <Button onClick={openCreate} data-testid="button-create-contract">
            <Plus className="w-4 h-4 mr-2" />
            Pridat zmluvu
          </Button>
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

        <div className="relative" data-testid="search-bar">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Hladat zmluvy (cislo, klient, partner, produkt...)"
            className="pl-9"
            data-testid="input-search-contracts"
          />
        </div>

        {activeFolder === 1 && (
          <Card data-testid="folder-nahravanie">
            <div className="flex items-center gap-3 p-3 border-b flex-wrap">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground italic" data-testid="text-ordering-note">Poznamka: Zmluvy budu na sprievodke zoradene podla poradia, v akom ich oznacite.</p>
              </div>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm text-muted-foreground">Vybranych: <span className="font-semibold text-foreground">{selectedIds.length}</span></span>
                  <Button size="sm" onClick={() => setSprievodkaDialogOpen(true)} data-testid="button-dispatch">
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Odoslat
                  </Button>
                </div>
              )}
            </div>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredNahravanie.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-nahravanie">Ziadne zmluvy na nahravanie</p>
              ) : renderContractTable(filteredNahravanie, { showCheckbox: true, showOrder: true })}
            </CardContent>
          </Card>
        )}

        {activeFolder === 2 && (
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
                          {checkedIds.size > 0 && (
                            <Button size="sm" onClick={(e) => { e.stopPropagation(); handleAccept(group.inventoryId); }} disabled={isAccepting} data-testid={`button-accept-${group.inventoryId}`}>
                              {isAccepting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
                              Schvalit a prijat ({checkedIds.size})
                            </Button>
                          )}
                        </div>
                        {isExpanded && (
                          <div className="border-t">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[40px]">
                                    <Checkbox checked={allChecked} onCheckedChange={() => toggleAcceptAll(group.inventoryId, group.contracts)} data-testid={`checkbox-accept-all-${group.inventoryId}`} />
                                  </TableHead>
                                  <TableHead className="w-[40px] text-center">#</TableHead>
                                  <TableHead>Cislo zmluvy</TableHead>
                                  <TableHead>Klient</TableHead>
                                  <TableHead>Partner</TableHead>
                                  <TableHead>Produkt</TableHead>
                                  <TableHead>Suma</TableHead>
                                  <TableHead>Datum podpisu</TableHead>
                                  <TableHead className="text-right">Akcie</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.contracts.map(contract => (
                                  <TableRow key={contract.id} data-testid={`row-cakajuce-${contract.id}`}>
                                    <TableCell>
                                      <Checkbox checked={checkedIds.has(contract.id)} onCheckedChange={() => toggleAcceptContract(group.inventoryId, contract.id)} data-testid={`checkbox-accept-${contract.id}`} />
                                    </TableCell>
                                    <TableCell className="text-center text-xs text-muted-foreground">{contract.sortOrderInInventory || "-"}</TableCell>
                                    <TableCell className="font-mono text-sm" data-testid={`text-dispatched-number-${contract.id}`}>
                                      <span className="flex items-center gap-1">
                                        {contract.isLocked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                                        {contract.contractNumber || "-"}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-sm">{getSubjectDisplay(contract.subjectId)}</TableCell>
                                    <TableCell className="text-sm">{getPartnerName(contract)}</TableCell>
                                    <TableCell className="text-sm">{getProductName(contract)}</TableCell>
                                    <TableCell className="text-sm font-mono">{formatAmount(contract.premiumAmount, contract.currency)}</TableCell>
                                    <TableCell className="text-sm">{formatDate(contract.signedDate)}</TableCell>
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
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {activeFolder === 3 && (
          <Card data-testid="folder-neprijate">
            <div className="flex items-center gap-3 p-3 border-b">
              <XCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-muted-foreground">Zmluvy, ktore neboli schvalene pocas prijatia sprievodky. Tieto zmluvy neziskaju globalne poradove cislo.</p>
            </div>
            <CardContent className="p-0">
              {isLoadingRejected ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredRejected.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-neprijate">Ziadne neprijate zmluvy</p>
              ) : renderContractTable(filteredRejected, { showStatus: true, showRegistration: false, showActions: false })}
            </CardContent>
          </Card>
        )}

        {activeFolder === 4 && (
          <Card data-testid="folder-archiv">
            <div className="flex items-center gap-3 p-3 border-b">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-xs text-muted-foreground">Zmluvy starsie ako 1 rok su automaticky presunuty do archivu</p>
            </div>
            <CardContent className="p-0">
              {isLoadingArchived ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filteredArchived.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-archiv">Ziadne archivovane zmluvy</p>
              ) : renderContractTable(filteredArchived, { showStatus: true, showRegistration: true, showActions: false })}
            </CardContent>
          </Card>
        )}

        <Dialog open={sprievodkaDialogOpen} onOpenChange={setSprievodkaDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle data-testid="text-sprievodka-dialog-title">Odoslat zmluvy</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Vybranych zmluv: <span className="font-semibold text-foreground">{selectedIds.length}</span>. Zmluvy budu odoslane na schvalenie Centralnej kancelarii cez novu sprievodku.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nazov sprievodky *</label>
                <Input
                  value={sprievodkaName}
                  onChange={e => setSprievodkaName(e.target.value)}
                  placeholder="Napr. Sprievodka 2026-02"
                  data-testid="input-sprievodka-name"
                />
              </div>
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
          <DialogContent className="sm:max-w-[450px]">
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
            sectorProducts={allSectorProducts || []}
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
                  <TableHead>Poradove cislo</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Sprievodka</TableHead>
                  <TableHead>Suma</TableHead>
                  <TableHead>Datum podpisu</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeContracts.map(contract => {
                  const status = statuses?.find(s => s.id === contract.statusId);
                  const inventoryName = inventories?.find(i => i.id === contract.inventoryId)?.name || "-";

                  return (
                    <TableRow key={contract.id} data-testid={`row-contract-${contract.id}`}>
                      <TableCell className="font-mono text-sm" data-testid={`text-contract-number-${contract.id}`}>
                        <span className="flex items-center gap-1">
                          {contract.isLocked && <Lock className="w-3 h-3 text-amber-500 shrink-0" />}
                          {contract.contractNumber || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-contract-registration-${contract.id}`}>
                        {contract.globalNumber ? (
                          <span className="font-semibold">{contract.globalNumber}</span>
                        ) : (
                          <Badge variant="outline" className="text-xs text-amber-500 border-amber-500/50">V procese</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-contract-subject-${contract.id}`}>
                        {getSubjectDisplay(contract.subjectId)}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-contract-partner-${contract.id}`}>
                        {getPartnerName(contract)}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-contract-product-${contract.id}`}>
                        {getProductName(contract)}
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
                          <Button size="icon" variant="ghost" onClick={() => openView(contract)} data-testid={`button-view-contract-${contract.id}`}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openEdit(contract)} data-testid={`button-edit-contract-${contract.id}`}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openDelete(contract)} data-testid={`button-delete-contract-${contract.id}`}>
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
          sectorProducts={allSectorProducts || []}
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
