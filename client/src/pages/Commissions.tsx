import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { CommissionRate, Partner, Product } from "@shared/schema";
import { Percent, Filter, Loader2, Search, Plus, Pencil } from "lucide-react";
import { ConditionalDelete } from "@/components/conditional-delete";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { HelpIcon, AdminNote } from "@/components/help-icon";

function ProcessingTimer({ startTime }: { startTime: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const seconds = Math.floor((now - startTime) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return <span className="text-xs text-muted-foreground font-mono">{`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`}</span>;
}

export default function Commissions() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPartner, setFilterPartner] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRate, setEditingRate] = useState<CommissionRate | null>(null);
  const formStartRef = useRef<number>(0);

  const [formPartnerId, setFormPartnerId] = useState("");
  const [formProductId, setFormProductId] = useState("");
  const [formRateType, setFormRateType] = useState("percent");
  const [formRateValue, setFormRateValue] = useState("");
  const [formPointsFactor, setFormPointsFactor] = useState("1");
  const [formCurrency, setFormCurrency] = useState("EUR");
  const [formValidFrom, setFormValidFrom] = useState("");
  const [formValidTo, setFormValidTo] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNotes, setFormNotes] = useState("");

  const { data: rates, isLoading } = useQuery<CommissionRate[]>({
    queryKey: ["/api/commission-rates"],
  });
  const { data: allPartners } = useQuery<Partner[]>({ queryKey: ["/api/partners"] });
  const { data: allProducts } = useQuery<Product[]>({ queryKey: ["/api/products"] });

  const partnerMap = useMemo(() => {
    const map = new Map<number, string>();
    allPartners?.forEach(p => map.set(p.id, p.name));
    return map;
  }, [allPartners]);

  const productMap = useMemo(() => {
    const map = new Map<number, string>();
    allProducts?.forEach(p => map.set(p.id, p.name));
    return map;
  }, [allProducts]);

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/commission-rates", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rates"] });
      toast({ title: "Sadzba vytvorena" });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest("PUT", `/api/commission-rates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rates"] });
      toast({ title: "Sadzba aktualizovana" });
      closeDialog();
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/commission-rates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/commission-rates"] });
      toast({ title: "Sadzba vymazana" });
    },
    onError: (err: any) => toast({ title: "Chyba", description: err.message, variant: "destructive" }),
  });

  function openCreate() {
    setEditingRate(null);
    setFormPartnerId("");
    setFormProductId("");
    setFormRateType("percent");
    setFormRateValue("");
    setFormPointsFactor("1");
    setFormCurrency("EUR");
    setFormValidFrom("");
    setFormValidTo("");
    setFormIsActive(true);
    setFormNotes("");
    formStartRef.current = Date.now();
    setDialogOpen(true);
  }

  function openEdit(rate: CommissionRate) {
    setEditingRate(rate);
    setFormPartnerId(String(rate.partnerId));
    setFormProductId(String(rate.productId));
    setFormRateType(rate.rateType);
    setFormRateValue(rate.rateValue);
    setFormPointsFactor(rate.pointsFactor || "1");
    setFormCurrency(rate.currency || "EUR");
    setFormValidFrom(rate.validFrom ? new Date(rate.validFrom).toISOString().split("T")[0] : "");
    setFormValidTo(rate.validTo ? new Date(rate.validTo).toISOString().split("T")[0] : "");
    setFormIsActive(rate.isActive ?? true);
    setFormNotes(rate.notes || "");
    formStartRef.current = Date.now();
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingRate(null);
  }

  function handleSave() {
    if (!formPartnerId || !formProductId || !formRateValue) {
      toast({ title: "Chyba", description: "Vyplnte vsetky povinne polia", variant: "destructive" });
      return;
    }
    const processingTimeSec = Math.round((Date.now() - formStartRef.current) / 1000);
    const data: any = {
      partnerId: parseInt(formPartnerId),
      productId: parseInt(formProductId),
      rateType: formRateType,
      rateValue: formRateValue,
      pointsFactor: formPointsFactor,
      currency: formCurrency,
      validFrom: formValidFrom ? new Date(formValidFrom) : new Date(),
      validTo: formValidTo ? new Date(formValidTo) : null,
      isActive: formIsActive,
      notes: formNotes || null,
      processingTimeSec,
    };
    if (editingRate) {
      updateMutation.mutate({ id: editingRate.id, data });
    } else {
      createMutation.mutate(data);
    }
  }

  function getStatus(rate: CommissionRate): "active" | "expired" | "inactive" {
    if (!rate.isActive) return "inactive";
    if (rate.validTo && new Date(rate.validTo) < new Date()) return "expired";
    return "active";
  }

  const partnerOptions = useMemo(() => {
    if (!rates) return [];
    const set = new Set<number>();
    rates.forEach(r => set.add(r.partnerId));
    return Array.from(set);
  }, [rates]);

  const filtered = useMemo(() => {
    if (!rates) return [];
    return rates.filter(r => {
      if (searchTerm) {
        const partnerName = partnerMap.get(r.partnerId) || "";
        const productName = productMap.get(r.productId) || "";
        const term = searchTerm.toLowerCase();
        if (!partnerName.toLowerCase().includes(term) && !productName.toLowerCase().includes(term)) return false;
      }
      if (filterPartner !== "all" && String(r.partnerId) !== filterPartner) return false;
      if (filterType !== "all" && r.rateType !== filterType) return false;
      if (filterStatus !== "all" && getStatus(r) !== filterStatus) return false;
      return true;
    });
  }, [rates, searchTerm, filterPartner, filterType, filterStatus, partnerMap, productMap]);

  function formatDate(dateStr: string | Date | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  const activeCount = rates?.filter(r => getStatus(r) === "active").length || 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Percent className="w-6 h-6 text-primary" />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-xl font-bold" data-testid="text-page-title">Sadzby (Matica provizii)</h1>
              <HelpIcon text="Nastavenie proviznych sadzieb pre jednotlive produkty a urovne spolupracovnikov." side="right" />
            </div>
            <p className="text-xs text-muted-foreground">Mapovanie Partner + Produkt na provizne sadzby a body</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="text-active-count">{activeCount} aktivnych</Badge>
          <Badge variant="outline" data-testid="text-total-count">{rates?.length || 0} celkom</Badge>
          <Button size="sm" onClick={openCreate} data-testid="button-create-rate">
            <Plus className="w-4 h-4 mr-1" />
            Nova sadzba
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtre
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setFilterPartner("all"); setFilterType("all"); setFilterStatus("all"); }} data-testid="button-reset-filters">
              Zrusit filtre
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vyhladavanie</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Partner, produkt..." className="pl-9" data-testid="input-search" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Partner</label>
              <Select value={filterPartner} onValueChange={setFilterPartner}>
                <SelectTrigger data-testid="select-filter-partner">
                  <SelectValue placeholder="Vsetci" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetci partneri</SelectItem>
                  {partnerOptions.map(id => (
                    <SelectItem key={id} value={String(id)}>{partnerMap.get(id) || `#${id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Typ</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger data-testid="select-filter-type">
                  <SelectValue placeholder="Vsetky" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetky typy</SelectItem>
                  <SelectItem value="percent">Percenta</SelectItem>
                  <SelectItem value="fixed">Fixna</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stav</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger data-testid="select-filter-status">
                  <SelectValue placeholder="Vsetky" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetky stavy</SelectItem>
                  <SelectItem value="active">Aktivna</SelectItem>
                  <SelectItem value="expired">Expirovala</SelectItem>
                  <SelectItem value="inactive">Neaktivna</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" data-testid="loader" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Percent className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm" data-testid="text-empty">Ziadne sadzby</p>
              <p className="text-xs">Pridajte prvou sadzbu kliknutim na "Nova sadzba"</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="text-right">Hodnota</TableHead>
                  <TableHead className="text-right">Body faktor</TableHead>
                  <TableHead>Mena</TableHead>
                  <TableHead>Platnost od</TableHead>
                  <TableHead>Platnost do</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(r => {
                  const status = getStatus(r);
                  return (
                    <TableRow key={r.id} data-testid={`row-rate-${r.id}`}>
                      <TableCell className="font-medium">{partnerMap.get(r.partnerId) || `#${r.partnerId}`}</TableCell>
                      <TableCell>{productMap.get(r.productId) || `#${r.productId}`}</TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px]">{r.rateType === "percent" ? "%" : "Fix"}</Badge></TableCell>
                      <TableCell className="text-right font-mono">{r.rateType === "percent" ? `${r.rateValue}%` : `${r.rateValue} ${r.currency}`}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{r.pointsFactor}</TableCell>
                      <TableCell className="text-xs">{r.currency}</TableCell>
                      <TableCell className="text-xs">{formatDate(r.validFrom)}</TableCell>
                      <TableCell className="text-xs">{formatDate(r.validTo)}</TableCell>
                      <TableCell>
                        {status === "active" ? (
                          <Badge variant="default" className="bg-green-600 text-white no-default-hover-elevate text-[10px]">Aktivna</Badge>
                        ) : status === "expired" ? (
                          <Badge variant="destructive" className="text-[10px]">Expirovala</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">Neaktivna</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => openEdit(r)} data-testid={`button-edit-rate-${r.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <ConditionalDelete canDelete={true} onClick={() => { if (confirm("Naozaj vymazat sadzbu?")) deleteMutation.mutate(r.id); }} testId={`button-delete-rate-${r.id}`} />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto" data-testid="dialog-rate">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
              <span>{editingRate ? "Upravit sadzbu" : "Nova sadzba"}</span>
              {formStartRef.current > 0 && <ProcessingTimer startTime={formStartRef.current} />}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Partner *</Label>
                <Select value={formPartnerId} onValueChange={setFormPartnerId}>
                  <SelectTrigger data-testid="select-partner">
                    <SelectValue placeholder="Vyberte partnera" />
                  </SelectTrigger>
                  <SelectContent>
                    {allPartners?.filter(p => !p.isDeleted).map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Produkt *</Label>
                <Select value={formProductId} onValueChange={setFormProductId}>
                  <SelectTrigger data-testid="select-product">
                    <SelectValue placeholder="Vyberte produkt" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProducts?.filter(p => !p.isDeleted).map(p => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Typ sadzby</Label>
                <Select value={formRateType} onValueChange={setFormRateType}>
                  <SelectTrigger data-testid="select-rate-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percenta (%)</SelectItem>
                    <SelectItem value="fixed">Fixna suma</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Hodnota sadzby *</Label>
                  <AdminNote text="Zmena sadzby ovplyvni vypocet provizii pre vsetky nove zmluvy. Existujuce zmluvy nie su ovplyvnene." isAdmin={true} side="right" />
                </div>
                <Input type="number" step="0.01" value={formRateValue} onChange={e => setFormRateValue(e.target.value)} placeholder={formRateType === "percent" ? "napr. 15.5" : "napr. 250"} data-testid="input-rate-value" />
              </div>
              <div>
                <Label className="text-xs">Body faktor</Label>
                <Input type="number" step="0.01" value={formPointsFactor} onChange={e => setFormPointsFactor(e.target.value)} placeholder="napr. 1.0" data-testid="input-points-factor" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Mena</Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger data-testid="select-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CZK">CZK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Platnost od</Label>
                <Input type="date" value={formValidFrom} onChange={e => setFormValidFrom(e.target.value)} data-testid="input-valid-from" />
              </div>
              <div>
                <Label className="text-xs">Platnost do</Label>
                <Input type="date" value={formValidTo} onChange={e => setFormValidTo(e.target.value)} data-testid="input-valid-to" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} data-testid="switch-active" />
              <Label className="text-xs">Aktivna sadzba</Label>
            </div>

            <div>
              <Label className="text-xs">Poznamky</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={3} data-testid="textarea-notes" />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={closeDialog} data-testid="button-cancel">Zrusit</Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-processing"
              >
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editingRate ? "Ulozit zmeny" : "Vytvorit sadzbu"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
