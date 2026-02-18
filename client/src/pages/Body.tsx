import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useTableSort } from "@/hooks/use-table-sort";
import { useAppUser } from "@/hooks/use-app-user";
import { useMyCompanies } from "@/hooks/use-companies";
import { useToast } from "@/hooks/use-toast";
import type { CareerLevel, ProductPointRate, CircleConfig } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, TrendingUp, Award, Loader2 } from "lucide-react";
import { HelpIcon } from "@/components/help-icon";
import { RankBadge } from "@/components/rank-badge";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";

function formatDecimalN(value: string | number | null | undefined, places: number): string {
  const num = parseFloat(String(value || '0').replace(',', '.'));
  if (isNaN(num)) return `0,${'0'.repeat(places)}`;
  return num.toFixed(places).replace('.', ',');
}
function formatDecimal8(value: string | number | null | undefined): string { return formatDecimalN(value, 8); }
function formatDecimal6(value: string | number | null | undefined): string { return formatDecimalN(value, 6); }
function formatDecimal4(value: string | number | null | undefined): string { return formatDecimalN(value, 4); }

function getZoneRowClass(zone: string, positionCode: string): string {
  switch (zone) {
    case 'blue':
      return 'bg-blue-950/40';
    case 'gray': {
      const num = parseInt(positionCode.replace('P', ''));
      if (num >= 13 && num <= 26) return 'bg-muted/20';
      return '';
    }
    case 'yellow':
      return '';
    default:
      return '';
  }
}

function getZoneTextClass(zone: string): string {
  if (zone === 'gray') return 'text-red-400';
  return '';
}

function getYellowCellClass(zone: string): string {
  if (zone === 'yellow') return 'bg-amber-900/30 text-amber-300 font-semibold';
  return '';
}

function CareerLevelEditDialog({
  level,
  onClose,
}: {
  level: CareerLevel | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isNew = !level;
  const defaultCircles: CircleConfig[] = [
    { visible: true, filled: false },
    { visible: true, filled: false },
    { visible: true, filled: false },
    { visible: false, filled: false },
    { visible: false, filled: false },
    { visible: false, filled: false },
  ];
  const [form, setForm] = useState({
    positionCode: level?.positionCode || '',
    sortOrder: level?.sortOrder?.toString() || '0',
    pointsFrom: formatDecimal8(level?.pointsFrom),
    pointsTo: formatDecimal8(level?.pointsTo),
    pricePerPoint: formatDecimal4(level?.pricePerPoint),
    positionName: level?.positionName || '',
    rewardPercent: formatDecimal6(level?.rewardPercent),
    coefficient: formatDecimal8(level?.coefficient),
    colorZone: level?.colorZone || 'white',
    frameType: level?.frameType || 'none',
    circleConfig: (level?.circleConfig as CircleConfig[] || defaultCircles),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        sortOrder: Number(form.sortOrder),
        pointsFrom: formatDecimal8(form.pointsFrom),
        pointsTo: formatDecimal8(form.pointsTo),
        pricePerPoint: formatDecimal4(form.pricePerPoint),
        rewardPercent: formatDecimal6(form.rewardPercent),
        coefficient: formatDecimal8(form.coefficient),
        frameType: form.frameType,
        circleConfig: form.circleConfig,
      };
      if (isNew) {
        await apiRequest("POST", "/api/career-levels", payload);
      } else {
        await apiRequest("PUT", `/api/career-levels/${level.id}`, payload);
      }
    },
    onSuccess: () => {
      toast({ title: isNew ? "Uroven vytvorena" : "Uroven aktualizovana" });
      queryClient.invalidateQueries({ queryKey: ["/api/career-levels"] });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <DialogHeader>
          <DialogTitle>{isNew ? "Nova karierna uroven" : `Upravit ${level.positionCode}`}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Kod pozicie</Label>
            <Input value={form.positionCode} onChange={(e) => setForm({...form, positionCode: e.target.value})} data-testid="input-position-code" />
          </div>
          <div>
            <Label>Poradie</Label>
            <Input type="number" value={form.sortOrder} onChange={(e) => setForm({...form, sortOrder: e.target.value})} data-testid="input-sort-order" />
          </div>
          <div>
            <Label>Body OD</Label>
            <Input value={form.pointsFrom} onChange={(e) => setForm({...form, pointsFrom: e.target.value})} data-testid="input-points-from" />
          </div>
          <div>
            <Label>Body DO</Label>
            <Input value={form.pointsTo} onChange={(e) => setForm({...form, pointsTo: e.target.value})} data-testid="input-points-to" />
          </div>
          <div>
            <Label>Cena za bod (€)</Label>
            <Input value={form.pricePerPoint} onChange={(e) => setForm({...form, pricePerPoint: e.target.value})} data-testid="input-price-per-point" />
          </div>
          <div>
            <Label>Nazov pozicie</Label>
            <Input value={form.positionName} onChange={(e) => setForm({...form, positionName: e.target.value})} data-testid="input-position-name" />
          </div>
          <div>
            <Label>Odmena %</Label>
            <Input value={form.rewardPercent} onChange={(e) => setForm({...form, rewardPercent: e.target.value})} data-testid="input-reward-percent" />
          </div>
          <div>
            <Label>Koeficient (modry)</Label>
            <Input value={form.coefficient} onChange={(e) => setForm({...form, coefficient: e.target.value})} data-testid="input-coefficient" />
          </div>
          <div>
            <Label>Farebna zona</Label>
            <select
              value={form.colorZone}
              onChange={(e) => setForm({...form, colorZone: e.target.value})}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              data-testid="select-color-zone"
            >
              <option value="blue">Modra (PZ-P3)</option>
              <option value="white">Biela (P4-P12)</option>
              <option value="gray">Seda/Cervena (P13-P26)</option>
              <option value="yellow">Zlta (P27-P39)</option>
            </select>
          </div>
          <div>
            <Label>Ramovanie</Label>
            <select
              value={form.frameType}
              onChange={(e) => setForm({...form, frameType: e.target.value})}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              data-testid="select-frame-type"
            >
              <option value="none">Ziadne</option>
              <option value="single">1 obdlznik</option>
              <option value="double">2 obdlzniky</option>
            </select>
          </div>
          <div className="col-span-2">
            <Label className="mb-2 block">Konfiguracia kruhov (1-6)</Label>
            <div className="grid grid-cols-6 gap-2">
              {form.circleConfig.map((circle, idx) => (
                <div key={idx} className="flex flex-col items-center gap-1 p-2 rounded-md border border-border">
                  <span className="text-[10px] text-muted-foreground font-medium">{idx + 1}</span>
                  <div
                    className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-colors ${circle.visible ? (circle.filled ? 'bg-primary border-primary' : 'bg-transparent border-primary') : 'bg-muted/20 border-muted-foreground/20'}`}
                    onClick={() => {
                      const updated = [...form.circleConfig];
                      if (!circle.visible) {
                        updated[idx] = { visible: true, filled: false };
                      } else if (!circle.filled) {
                        updated[idx] = { visible: true, filled: true };
                      } else {
                        updated[idx] = { visible: false, filled: false };
                      }
                      setForm({ ...form, circleConfig: updated });
                    }}
                    data-testid={`circle-config-${idx}`}
                  />
                  <span className="text-[9px] text-muted-foreground">
                    {!circle.visible ? 'Skryty' : circle.filled ? 'Plny' : 'Prazdny'}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Kliknutim prepinajte: Prazdny → Plny → Skryty</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>Zrusit</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-save-career-level">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isNew ? "Vytvorit" : "Ulozit")}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProductRateEditDialog({
  rate,
  onClose,
}: {
  rate: ProductPointRate | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isNew = !rate;
  const [form, setForm] = useState({
    partnerName: rate?.partnerName || '',
    productName: rate?.productName || '',
    basePoints: formatDecimal8(rate?.basePoints),
    commissionCoefficient: formatDecimal8(rate?.commissionCoefficient),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        basePoints: formatDecimal8(form.basePoints),
        commissionCoefficient: formatDecimal8(form.commissionCoefficient),
      };
      if (isNew) {
        await apiRequest("POST", "/api/product-point-rates", payload);
      } else {
        await apiRequest("PUT", `/api/product-point-rates/${rate.id}`, payload);
      }
    },
    onSuccess: () => {
      toast({ title: isNew ? "Sadzba vytvorena" : "Sadzba aktualizovana" });
      queryClient.invalidateQueries({ queryKey: ["/api/product-point-rates"] });
      onClose();
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}>
        <DialogHeader>
          <DialogTitle>{isNew ? "Nova sadzba produktu" : "Upravit sadzbu"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Partner / Institucia</Label>
            <Input value={form.partnerName} onChange={(e) => setForm({...form, partnerName: e.target.value})} data-testid="input-rate-partner" />
          </div>
          <div>
            <Label>Produkt</Label>
            <Input value={form.productName} onChange={(e) => setForm({...form, productName: e.target.value})} data-testid="input-rate-product" />
          </div>
          <div>
            <Label>Zakladne body</Label>
            <Input value={form.basePoints} onChange={(e) => setForm({...form, basePoints: e.target.value})} data-testid="input-rate-base-points" />
          </div>
          <div>
            <Label>Provizny koeficient</Label>
            <Input value={form.commissionCoefficient} onChange={(e) => setForm({...form, commissionCoefficient: e.target.value})} data-testid="input-rate-coefficient" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onClose}>Zrusit</Button>
          <Button type="submit" disabled={mutation.isPending} data-testid="button-save-rate">
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : (isNew ? "Vytvorit" : "Ulozit")}
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const CAREER_LEVEL_COLUMNS: ColumnDef[] = [
  { key: "positionCode", label: "Pozicia" },
  { key: "pointsFrom", label: "Body OD" },
  { key: "pointsTo", label: "Body DO" },
  { key: "pricePerPoint", label: "Cena za bod (€)" },
  { key: "positionName", label: "Nazov pozicie" },
  { key: "rewardPercent", label: "Odmena %" },
  { key: "hodnost", label: "Hodnosť" },
];

const PRODUCT_RATE_COLUMNS: ColumnDef[] = [
  { key: "partnerName", label: "Partner / Institucia" },
  { key: "productName", label: "Produkt" },
  { key: "basePoints", label: "Zakladne body" },
  { key: "commissionCoefficient", label: "Provizny koeficient" },
];

export default function Body() {
  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();
  const { toast } = useToast();
  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin' || appUser?.role === 'prezident';

  const { data: careerLevels, isLoading: levelsLoading } = useQuery<CareerLevel[]>({
    queryKey: ["/api/career-levels"],
  });

  const { data: productRates, isLoading: ratesLoading } = useQuery<ProductPointRate[]>({
    queryKey: ["/api/product-point-rates"],
  });

  const { sortedData: sortedLevels, sortKey: levelSortKey, sortDirection: levelSortDirection, requestSort: levelRequestSort } = useTableSort(careerLevels || []);
  const { sortedData: sortedRates, sortKey: rateSortKey, sortDirection: rateSortDirection, requestSort: rateRequestSort } = useTableSort(productRates || []);
  const careerColumnVisibility = useColumnVisibility("body-career-levels", CAREER_LEVEL_COLUMNS);
  const rateColumnVisibility = useColumnVisibility("body-product-rates", PRODUCT_RATE_COLUMNS);

  const [editLevel, setEditLevel] = useState<CareerLevel | null | 'new'>(null);
  const [editRate, setEditRate] = useState<ProductPointRate | null | 'new'>(null);

  const deleteLevelMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/career-levels/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Uroven vymazana" });
      queryClient.invalidateQueries({ queryKey: ["/api/career-levels"] });
    },
  });

  const deleteRateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/product-point-rates/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Sadzba vymazana" });
      queryClient.invalidateQueries({ queryKey: ["/api/product-point-rates"] });
    },
  });

  const userLevel = careerLevels?.find(l => l.sortOrder === (appUser?.commissionLevel ?? 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2" data-testid="text-body-title">
            Body
            <HelpIcon text="Karierne urovne a bodovy system pre vypocet provizii" />
          </h1>
          <p className="text-sm text-muted-foreground">Karierne urovne, bodove sadzby a prepocitacie koeficienty.</p>
        </div>
        <div style={{ visibility: userLevel ? 'visible' : 'hidden' }}>
          <Badge variant="outline" className="text-sm px-3 py-1.5" data-testid="badge-user-rank">
            <Award className="w-4 h-4 mr-2 text-primary" />
            {userLevel?.positionCode} - {userLevel?.positionName}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center" data-testid="company-logos-bar">
        {companies?.map((c) => (
          <div key={c.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-muted/30" data-testid={`company-logo-${c.id}`}>
            <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
            <span className="text-xs font-medium truncate max-w-[120px]">{c.name}</span>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold" data-testid="text-career-table-title">Karierne urovne</h2>
            </div>
            <div className="flex items-center gap-2">
              <ColumnManager columnVisibility={careerColumnVisibility} />
              <div style={{ visibility: isAdmin ? 'visible' : 'hidden' }}>
                <Button size="sm" onClick={() => setEditLevel('new')} data-testid="button-add-career-level">
                  <Plus className="w-4 h-4 mr-1" /> Pridat uroven
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table stickyHeader>
              <TableHeader>
                <TableRow>
                  {careerColumnVisibility.isVisible("positionCode") && <TableHead className="w-[80px]" resizable={false} sortKey="positionCode" sortDirection={levelSortKey === "positionCode" ? levelSortDirection : null} onSort={levelRequestSort}>Pozicia</TableHead>}
                  {careerColumnVisibility.isVisible("pointsFrom") && <TableHead sortKey="pointsFrom" sortDirection={levelSortKey === "pointsFrom" ? levelSortDirection : null} onSort={levelRequestSort}>Body OD</TableHead>}
                  {careerColumnVisibility.isVisible("pointsTo") && <TableHead sortKey="pointsTo" sortDirection={levelSortKey === "pointsTo" ? levelSortDirection : null} onSort={levelRequestSort}>Body DO</TableHead>}
                  {careerColumnVisibility.isVisible("pricePerPoint") && <TableHead sortKey="pricePerPoint" sortDirection={levelSortKey === "pricePerPoint" ? levelSortDirection : null} onSort={levelRequestSort}>Cena za bod (€)</TableHead>}
                  {careerColumnVisibility.isVisible("positionName") && <TableHead sortKey="positionName" sortDirection={levelSortKey === "positionName" ? levelSortDirection : null} onSort={levelRequestSort}>Nazov pozicie</TableHead>}
                  {careerColumnVisibility.isVisible("rewardPercent") && <TableHead sortKey="rewardPercent" sortDirection={levelSortKey === "rewardPercent" ? levelSortDirection : null} onSort={levelRequestSort}>Odmena %</TableHead>}
                  {careerColumnVisibility.isVisible("hodnost") && <TableHead
                    className="text-center text-white"
                    style={{ backgroundColor: 'hsl(217, 91%, 40%)' }}
                    resizable={false}
                  >
                    Hodnosť
                  </TableHead>}
                  <TableHead className="w-[80px]" resizable={false}>Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {levelsLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {sortedLevels.map((level) => {
                  const isCurrentLevel = userLevel?.id === level.id;
                  return (
                    <TableRow
                      key={level.id}
                      className={`${getZoneRowClass(level.colorZone, level.positionCode)} ${isCurrentLevel ? 'ring-1 ring-primary ring-inset' : ''}`}
                      data-testid={`row-career-${level.positionCode}`}
                    >
                      {careerColumnVisibility.isVisible("positionCode") && <TableCell className="font-bold text-sm">
                        {level.positionCode}
                      </TableCell>}
                      {careerColumnVisibility.isVisible("pointsFrom") && <TableCell className={getYellowCellClass(level.colorZone)}>
                        {formatDecimal8(level.pointsFrom)}
                      </TableCell>}
                      {careerColumnVisibility.isVisible("pointsTo") && <TableCell className={getYellowCellClass(level.colorZone)}>
                        {formatDecimal8(level.pointsTo)}
                      </TableCell>}
                      {careerColumnVisibility.isVisible("pricePerPoint") && <TableCell className={getZoneTextClass(level.colorZone)}>
                        {formatDecimal4(level.pricePerPoint)} €
                      </TableCell>}
                      {careerColumnVisibility.isVisible("positionName") && <TableCell className={`font-medium ${getZoneTextClass(level.colorZone)}`}>
                        {level.positionName}
                      </TableCell>}
                      {careerColumnVisibility.isVisible("rewardPercent") && <TableCell className={getZoneTextClass(level.colorZone)}>
                        {formatDecimal6(level.rewardPercent)} %
                      </TableCell>}
                      {careerColumnVisibility.isVisible("hodnost") && <TableCell
                        className="text-center"
                        style={{ backgroundColor: 'hsl(217, 91%, 35%)' }}
                      >
                        <div className="flex items-center justify-center">
                          <RankBadge
                            frameType={level.frameType || 'none'}
                            circleConfig={level.circleConfig as CircleConfig[]}
                          />
                        </div>
                      </TableCell>}
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => setEditLevel(level)} data-testid={`button-edit-level-${level.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <div style={{ visibility: isAdmin ? 'visible' : 'hidden' }}>
                            <Button size="icon" variant="ghost" onClick={() => deleteLevelMutation.mutate(level.id)} data-testid={`button-delete-level-${level.id}`}>
                              <Trash2 className="w-3.5 h-3.5 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-blue-800/50">
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b" style={{ borderColor: 'hsl(217, 60%, 30%)', backgroundColor: 'hsl(217, 60%, 15%)' }}>
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-blue-200" data-testid="text-rates-table-title">Sadzby produktov</h2>
            </div>
            <div className="flex items-center gap-2">
              <ColumnManager columnVisibility={rateColumnVisibility} />
              <div style={{ visibility: isAdmin ? 'visible' : 'hidden' }}>
                <Button size="sm" variant="outline" className="border-blue-600 text-blue-300" onClick={() => setEditRate('new')} data-testid="button-add-rate">
                  <Plus className="w-4 h-4 mr-1" /> Pridat sadzbu
                </Button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto" style={{ backgroundColor: 'hsl(217, 40%, 10%)' }}>
            <Table>
              <TableHeader>
                <TableRow>
                  {rateColumnVisibility.isVisible("partnerName") && <TableHead style={{ backgroundColor: 'hsl(217, 60%, 18%)' }} className="text-blue-200" sortKey="partnerName" sortDirection={rateSortKey === "partnerName" ? rateSortDirection : null} onSort={rateRequestSort}>Partner / Institucia</TableHead>}
                  {rateColumnVisibility.isVisible("productName") && <TableHead style={{ backgroundColor: 'hsl(217, 60%, 18%)' }} className="text-blue-200" sortKey="productName" sortDirection={rateSortKey === "productName" ? rateSortDirection : null} onSort={rateRequestSort}>Produkt</TableHead>}
                  {rateColumnVisibility.isVisible("basePoints") && <TableHead style={{ backgroundColor: 'hsl(217, 60%, 18%)' }} className="text-blue-200" sortKey="basePoints" sortDirection={rateSortKey === "basePoints" ? rateSortDirection : null} onSort={rateRequestSort}>Zakladne body</TableHead>}
                  {rateColumnVisibility.isVisible("commissionCoefficient") && <TableHead style={{ backgroundColor: 'hsl(217, 60%, 18%)' }} className="text-blue-200" sortKey="commissionCoefficient" sortDirection={rateSortKey === "commissionCoefficient" ? rateSortDirection : null} onSort={rateRequestSort}>Provizny koeficient</TableHead>}
                  <TableHead style={{ backgroundColor: 'hsl(217, 60%, 18%)', visibility: isAdmin ? 'visible' : 'hidden' }} className="text-blue-200 w-[80px]">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratesLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-blue-300">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                )}
                {!ratesLoading && (!productRates || productRates.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-blue-400/60" data-testid="text-empty-rates">
                      Ziadne bodove sadzby
                    </TableCell>
                  </TableRow>
                )}
                {sortedRates.map((rate) => (
                  <TableRow key={rate.id} className="border-blue-800/30" data-testid={`row-rate-${rate.id}`}>
                    {rateColumnVisibility.isVisible("partnerName") && <TableCell className="text-blue-100 font-medium">{rate.partnerName || '-'}</TableCell>}
                    {rateColumnVisibility.isVisible("productName") && <TableCell className="text-blue-200">{rate.productName || '-'}</TableCell>}
                    {rateColumnVisibility.isVisible("basePoints") && <TableCell className="text-blue-100 font-semibold">{formatDecimal8(rate.basePoints)}</TableCell>}
                    {rateColumnVisibility.isVisible("commissionCoefficient") && <TableCell className="text-blue-100 font-bold">{formatDecimal8(rate.commissionCoefficient)}</TableCell>}
                    <TableCell style={{ visibility: isAdmin ? 'visible' : 'hidden' }}>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditRate(rate)} data-testid={`button-edit-rate-${rate.id}`}>
                          <Pencil className="w-3.5 h-3.5 text-blue-300" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteRateMutation.mutate(rate.id)} data-testid={`button-delete-rate-${rate.id}`}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editLevel !== null && (
        <CareerLevelEditDialog
          level={editLevel === 'new' ? null : editLevel}
          onClose={() => setEditLevel(null)}
        />
      )}
      {editRate !== null && (
        <ProductRateEditDialog
          rate={editRate === 'new' ? null : editRate}
          onClose={() => setEditRate(null)}
        />
      )}
    </div>
  );
}
