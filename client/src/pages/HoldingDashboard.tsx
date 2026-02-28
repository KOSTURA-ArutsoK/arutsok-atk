import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAppUser } from "@/hooks/use-app-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Loader2, Users, FileText, TrendingUp, AlertTriangle, ShieldAlert,
  Download, FileSpreadsheet, ArrowRightLeft, Globe, Building,
  BarChart3, Lock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Cell,
} from "recharts";
import jsPDF from "jspdf";

interface KPIData {
  totalSubjects: number;
  totalContracts: number;
  gwp: number;
  crossSellIndex: number;
  stornoRate: number;
  stornoCount: number;
  isHoldingView: boolean;
}

interface CrossSellSector {
  sectorId: number;
  sectorName: string;
  emoji: string;
  covered: number;
  gaps: number;
  coveragePercent: number;
}

interface CrossSellData {
  totalSubjectsWithContracts: number;
  sectors: CrossSellSector[];
}

interface DivisionHeatmapEntry {
  divisionId: number;
  divisionName: string;
  emoji: string;
  production: number;
  contractCount: number;
  stornoCount: number;
  stornoRate: number;
}

interface ExchangeRateData {
  eurCzk: number;
  czkEur: number;
  cachedAt: string | null;
  source: string;
}

function formatCurrency(amount: number, currency: string = "EUR"): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getHeatColor(value: number, max: number): string {
  if (max === 0) return "bg-muted/30";
  const ratio = value / max;
  if (ratio >= 0.8) return "bg-emerald-500/20 dark:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300";
  if (ratio >= 0.5) return "bg-yellow-500/20 dark:bg-yellow-500/30 text-yellow-700 dark:text-yellow-300";
  if (ratio >= 0.2) return "bg-orange-500/20 dark:bg-orange-500/30 text-orange-700 dark:text-orange-300";
  return "bg-red-500/20 dark:bg-red-500/30 text-red-700 dark:text-red-300";
}

function getStornoColor(rate: number): string {
  if (rate <= 5) return "text-emerald-500";
  if (rate <= 15) return "text-yellow-500";
  if (rate <= 25) return "text-orange-500";
  return "text-red-500";
}

export default function HoldingDashboard() {
  const { data: appUser, isLoading: userLoading } = useAppUser();
  const { toast } = useToast();
  const [allCompanies, setAllCompanies] = useState(false);
  const [displayCurrency, setDisplayCurrency] = useState<"EUR" | "CZK">("EUR");
  const chartRef = useRef<HTMLDivElement>(null);

  const sentinelLevel = (appUser as any)?.sentinelLevel ?? 0;
  const canViewHolding = sentinelLevel >= 7 && sentinelLevel !== 9;
  const canToggleHolding = sentinelLevel >= 8 && sentinelLevel !== 9;

  const queryParams = allCompanies && canToggleHolding ? "?allCompanies=true" : "";

  const { data: kpi, isLoading: kpiLoading } = useQuery<KPIData>({
    queryKey: ["/api/holding-dashboard/kpi", queryParams],
    queryFn: () => fetch(`/api/holding-dashboard/kpi${queryParams}`, { credentials: "include" }).then(r => r.json()),
    enabled: canViewHolding,
    refetchInterval: 60000,
  });

  const { data: crossSell, isLoading: crossSellLoading } = useQuery<CrossSellData>({
    queryKey: ["/api/holding-dashboard/crosssell", queryParams],
    queryFn: () => fetch(`/api/holding-dashboard/crosssell${queryParams}`, { credentials: "include" }).then(r => r.json()),
    enabled: canViewHolding,
  });

  const { data: divisionData, isLoading: divisionLoading } = useQuery<{ divisions: DivisionHeatmapEntry[] }>({
    queryKey: ["/api/holding-dashboard/divisions", queryParams],
    queryFn: () => fetch(`/api/holding-dashboard/divisions${queryParams}`, { credentials: "include" }).then(r => r.json()),
    enabled: canViewHolding,
  });

  const { data: exchangeRate } = useQuery<ExchangeRateData>({
    queryKey: ["/api/holding-dashboard/exchange-rate"],
    enabled: canViewHolding,
    refetchInterval: 3600000,
  });

  const exportMutation = useMutation({
    mutationFn: async (params: { exportType: string; reportName: string }) => {
      const res = await apiRequest("POST", "/api/holding-dashboard/export-log", params);
      return res.json();
    },
    onError: (err: any) => {
      toast({
        title: "Export zablokovaný",
        description: err?.message || "Prekročený limit exportov",
        variant: "destructive",
      });
    },
  });

  const convertAmount = useCallback((amount: number): number => {
    if (displayCurrency === "CZK" && exchangeRate) {
      return Math.round(amount * exchangeRate.eurCzk);
    }
    return amount;
  }, [displayCurrency, exchangeRate]);

  const maxProduction = useMemo(() => {
    if (!divisionData?.divisions) return 0;
    return Math.max(...divisionData.divisions.map(d => d.production), 1);
  }, [divisionData]);

  const divisionChartData = useMemo(() => {
    if (!divisionData?.divisions) return [];
    return divisionData.divisions.map(d => ({
      name: `${d.emoji} ${d.divisionName}`,
      production: convertAmount(d.production),
      contracts: d.contractCount,
      storno: d.stornoCount,
    }));
  }, [divisionData, convertAmount]);

  const handleExportPDF = useCallback(async () => {
    const result = await exportMutation.mutateAsync({ exportType: "pdf", reportName: "Holding Dashboard KPI" });
    if (!result?.success) return;

    const doc = new jsPDF();
    const now = new Date().toLocaleString("sk-SK", { timeZone: "Europe/Bratislava" });
    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    doc.text(`${appUser?.username || "system"} | ${now}`, 10, 290);

    doc.setTextColor(0);
    doc.setFontSize(18);
    doc.text("Holding Dashboard — Modul C", 10, 20);
    doc.setFontSize(10);
    doc.text(`Generované: ${now}`, 10, 28);
    doc.text(`Režim: ${allCompanies ? "Holdingový pohľad" : "Aktívna spoločnosť"}`, 10, 34);
    doc.text(`Mena: ${displayCurrency}`, 10, 40);

    doc.setFontSize(14);
    doc.text("KPI Prehľad", 10, 52);
    doc.setFontSize(11);
    if (kpi) {
      doc.text(`Celkový Kmeň: ${kpi.totalSubjects ?? 0} subjektov, ${kpi.totalContracts ?? 0} zmlúv`, 14, 60);
      doc.text(`Produkcia (GWP): ${formatCurrency(convertAmount(kpi.gwp ?? 0), displayCurrency)}`, 14, 67);
      doc.text(`Cross-sell Index: ${(kpi.crossSellIndex ?? 0).toFixed(2)}`, 14, 74);
      doc.text(`Storno Rate: ${(kpi.stornoRate ?? 0).toFixed(2)}% (${kpi.stornoCount ?? 0} storno)`, 14, 81);
    }

    if (crossSell?.sectors?.length) {
      doc.setFontSize(14);
      doc.text("Cross-sell Heatmapa", 10, 95);
      doc.setFontSize(9);
      let y = 103;
      for (const sec of crossSell.sectors) {
        doc.text(`${sec.emoji} ${sec.sectorName}: ${sec.coveragePercent}% pokrytie (${sec.covered} kryté / ${sec.gaps} príležitostí)`, 14, y);
        y += 7;
        if (y > 270) { doc.addPage(); y = 20; }
      }
    }

    if (divisionData?.divisions?.length) {
      doc.addPage();
      doc.setFontSize(14);
      doc.text("Divízna výkonnosť", 10, 20);
      doc.setFontSize(9);
      let y = 28;
      for (const div of divisionData.divisions) {
        doc.text(`${div.emoji} ${div.divisionName}: ${formatCurrency(convertAmount(div.production), displayCurrency)} | ${div.contractCount} zmlúv | Storno: ${div.stornoRate.toFixed(1)}%`, 14, y);
        y += 7;
        if (y > 270) { doc.addPage(); y = 20; }
      }
    }

    doc.save(`holding-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast({ title: "PDF exportovaný", description: "Report bol stiahnutý." });
  }, [kpi, crossSell, divisionData, allCompanies, displayCurrency, convertAmount, appUser, exportMutation, toast]);

  const handleExportExcel = useCallback(async () => {
    const result = await exportMutation.mutateAsync({ exportType: "excel", reportName: "Holding Dashboard Data" });
    if (!result?.success) return;

    let csv = "Sekcia;Metrika;Hodnota\n";
    if (kpi) {
      csv += `KPI;Celkový Kmeň (Subjekty);${kpi.totalSubjects ?? 0}\n`;
      csv += `KPI;Celkový Kmeň (Zmluvy);${kpi.totalContracts ?? 0}\n`;
      csv += `KPI;Produkcia GWP (${displayCurrency});${convertAmount(kpi.gwp ?? 0)}\n`;
      csv += `KPI;Cross-sell Index;${kpi.crossSellIndex ?? 0}\n`;
      csv += `KPI;Storno Rate (%);${kpi.stornoRate ?? 0}\n`;
    }
    if (crossSell?.sectors) {
      csv += "\nSektor;Emoji;Pokrytie %;Kryté;Príležitosti\n";
      for (const sec of crossSell.sectors) {
        csv += `${sec.sectorName};${sec.emoji};${sec.coveragePercent};${sec.covered};${sec.gaps}\n`;
      }
    }
    if (divisionData?.divisions) {
      csv += `\nDivízia;Emoji;Produkcia (${displayCurrency});Zmluvy;Storno;Storno Rate %\n`;
      for (const div of divisionData.divisions) {
        csv += `${div.divisionName};${div.emoji};${convertAmount(div.production)};${div.contractCount};${div.stornoCount};${div.stornoRate}\n`;
      }
    }

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `holding-dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Excel/CSV exportovaný", description: "Dáta boli stiahnuté." });
  }, [kpi, crossSell, divisionData, displayCurrency, convertAmount, exportMutation, toast]);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canViewHolding) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4" data-testid="holding-access-denied">
        <Lock className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-lg font-semibold">Prístup zamietnutý</h2>
        <p className="text-muted-foreground text-sm">Modul C vyžaduje minimálne Sentinel úroveň L7 (Backoffice)</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6 max-w-[1400px] mx-auto" data-testid="holding-dashboard">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2" data-testid="heading-module-c">
            <BarChart3 className="w-5 h-5" />
            Modul C — Holding Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Analytický prehľad {kpi?.isHoldingView ? "celého holdingu" : "aktívnej spoločnosti"}
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {canToggleHolding && (
            <div className="flex items-center gap-2" data-testid="holding-toggle">
              <Building className="w-4 h-4 text-muted-foreground" />
              <Label htmlFor="holding-switch" className="text-xs cursor-pointer">Holdingový pohľad</Label>
              <Switch
                id="holding-switch"
                checked={allCompanies}
                onCheckedChange={setAllCompanies}
                data-testid="switch-holding-view"
              />
            </div>
          )}

          {canToggleHolding && exchangeRate && (
            <div className="flex items-center gap-2" data-testid="currency-switcher">
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
              <Button
                size="sm"
                variant={displayCurrency === "EUR" ? "default" : "outline"}
                onClick={() => setDisplayCurrency("EUR")}
                data-testid="button-currency-eur"
                className="h-7 text-xs px-2"
              >
                EUR
              </Button>
              <Button
                size="sm"
                variant={displayCurrency === "CZK" ? "default" : "outline"}
                onClick={() => setDisplayCurrency("CZK")}
                data-testid="button-currency-czk"
                className="h-7 text-xs px-2"
              >
                CZK
              </Button>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-[10px] h-5" data-testid="text-exchange-rate">
                    1 EUR = {exchangeRate.eurCzk.toFixed(3)} CZK
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Zdroj: {exchangeRate.source}</p>
                  <p>Aktualizované: {exchangeRate.cachedAt ? new Date(exchangeRate.cachedAt).toLocaleString("sk-SK") : "N/A"}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportPDF}
              disabled={exportMutation.isPending}
              data-testid="button-export-pdf"
              className="h-8 text-xs gap-1"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              disabled={exportMutation.isPending}
              data-testid="button-export-excel"
              className="h-8 text-xs gap-1"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </Button>
          </div>
        </div>
      </div>

      {kpiLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : kpi ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-border/60" data-testid="card-kpi-kmen">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                Celkový Kmeň
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold" data-testid="text-kpi-subjects">{(kpi.totalSubjects ?? 0).toLocaleString("sk-SK")}</div>
              <div className="text-xs text-muted-foreground">
                subjektov · <span className="font-medium text-foreground" data-testid="text-kpi-contracts">{(kpi.totalContracts ?? 0).toLocaleString("sk-SK")}</span> zmlúv
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60" data-testid="card-kpi-gwp">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" />
                Produkcia (GWP)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold" data-testid="text-kpi-gwp">
                {formatCurrency(convertAmount(kpi.gwp ?? 0), displayCurrency)}
              </div>
              <div className="text-xs text-muted-foreground">predpísané poistné/investície</div>
            </CardContent>
          </Card>

          <Card className="border-border/60" data-testid="card-kpi-crosssell">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                Cross-sell Index
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="text-2xl font-bold" data-testid="text-kpi-crosssell">{(kpi.crossSellIndex ?? 0).toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">
                produktov/klient ·
                <span className={(kpi.crossSellIndex ?? 0) >= 2.5 ? "text-emerald-500" : (kpi.crossSellIndex ?? 0) >= 1.5 ? "text-yellow-500" : "text-red-500"}>
                  {" "}cieľ: 2.50
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60" data-testid="card-kpi-storno">
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Storno Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className={`text-2xl font-bold ${getStornoColor(kpi.stornoRate ?? 0)}`} data-testid="text-kpi-storno">
                {(kpi.stornoRate ?? 0).toFixed(2)}%
              </div>
              <div className="text-xs text-muted-foreground">
                {kpi.stornoCount ?? 0} zrušených zmlúv
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60" data-testid="card-crosssell-heatmap">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Cross-sell Heatmapa (GAP Analýza)
            </CardTitle>
            {crossSell && (
              <p className="text-xs text-muted-foreground">
                {crossSell.totalSubjectsWithContracts} subjektov so zmluvami
              </p>
            )}
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {crossSellLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : crossSell?.sectors?.length ? (
              <div className="space-y-1.5">
                {crossSell.sectors.map(sec => (
                  <div
                    key={sec.sectorId}
                    className="flex items-center gap-2 py-1.5 px-2 rounded-sm hover:bg-muted/40 transition-colors"
                    data-testid={`row-crosssell-sector-${sec.sectorId}`}
                  >
                    <span className="text-lg w-7 text-center flex-shrink-0">{sec.emoji}</span>
                    <span className="text-xs font-medium flex-1 min-w-0 truncate">{sec.sectorName}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="w-24 bg-muted/40 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            sec.coveragePercent >= 60 ? "bg-emerald-500" :
                            sec.coveragePercent >= 30 ? "bg-yellow-500" :
                            sec.coveragePercent >= 10 ? "bg-orange-500" :
                            "bg-red-500"
                          }`}
                          style={{ width: `${Math.min(sec.coveragePercent, 100)}%` }}
                        />
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] w-12 justify-center ${
                          sec.coveragePercent >= 60 ? "border-emerald-500/40 text-emerald-600" :
                          sec.coveragePercent >= 30 ? "border-yellow-500/40 text-yellow-600" :
                          "border-red-500/40 text-red-600"
                        }`}
                        data-testid={`text-crosssell-percent-${sec.sectorId}`}
                      >
                        {sec.coveragePercent}%
                      </Badge>
                      <Tooltip>
                        <TooltipTrigger>
                          <span className={`text-[10px] font-mono ${sec.gaps > 0 ? "text-white bg-white/10 dark:bg-white/5 border border-dashed border-muted-foreground/30 px-1 rounded" : "text-muted-foreground"}`}>
                            {sec.gaps > 0 ? `${sec.gaps} GAP` : "✓"}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{sec.covered} kryté · {sec.gaps} príležitostí</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">Žiadne sektory</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60" data-testid="card-division-heatmap">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              Divízna výkonnosť
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            {divisionLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : divisionData?.divisions?.length ? (
              <div className="space-y-2">
                {divisionData.divisions.map(div => (
                  <div
                    key={div.divisionId}
                    className={`flex items-center gap-3 py-2 px-3 rounded-md border border-border/40 ${getHeatColor(div.production, maxProduction)}`}
                    data-testid={`row-division-${div.divisionId}`}
                  >
                    <span className="text-lg w-7 text-center flex-shrink-0">{div.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold truncate">{div.divisionName}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {div.contractCount} zmlúv · {formatCurrency(convertAmount(div.production), displayCurrency)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <span className="text-sm font-bold" data-testid={`text-division-production-${div.divisionId}`}>
                        {formatCurrency(convertAmount(div.production), displayCurrency)}
                      </span>
                      <span className={`text-[10px] ${getStornoColor(div.stornoRate)}`}>
                        Storno: {div.stornoRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}

                <div ref={chartRef} className="mt-3 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={divisionChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <ReTooltip
                        contentStyle={{ fontSize: 11, borderRadius: 6 }}
                        formatter={(value: number) => formatCurrency(value, displayCurrency)}
                      />
                      <Bar dataKey="production" name="Produkcia" radius={[4, 4, 0, 0]}>
                        {divisionChartData.map((_, index) => (
                          <Cell
                            key={index}
                            fill={index % 2 === 0 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.7)"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-4">Žiadne divízie</p>
            )}
          </CardContent>
        </Card>
      </div>

      {exchangeRate && (
        <Card className="border-border/60" data-testid="card-exchange-info">
          <CardContent className="px-4 py-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <ArrowRightLeft className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Menový kurz ECB: 1 EUR = {exchangeRate.eurCzk.toFixed(4)} CZK</span>
              <span className="text-[10px]">·</span>
              <span>1 CZK = {exchangeRate.czkEur.toFixed(6)} EUR</span>
              <span className="text-[10px]">·</span>
              <span>Posledná aktualizácia: {exchangeRate.cachedAt ? new Date(exchangeRate.cachedAt).toLocaleString("sk-SK") : "N/A"}</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}