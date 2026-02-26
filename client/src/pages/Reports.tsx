import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppUser } from "@/hooks/use-app-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, TrendingUp, TrendingDown, Banknote, AlertTriangle, FileText, ShieldAlert } from "lucide-react";
import type { Partner, ContractStatus } from "@shared/schema";
import jsPDF from "jspdf";

interface KPI {
  totalPremium: number;
  stornoCount: number;
  stornoAmount: number;
  actualCashflow: number;
  netProduction: number;
}

interface ReportRecord {
  contractUid: string;
  globalNumber: number | null;
  clientName: string;
  licensePlate: string;
  premiumAmount: number;
  statusName: string;
  statusColor: string | null;
  signedDate: string | null;
  partnerName: string;
}

interface ReportData {
  kpi: KPI;
  records: ReportRecord[];
  totalRecords: number;
}

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("sk-SK");
  } catch { return "-"; }
}

export default function Reports() {
  const { data: appUser } = useAppUser();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState("");
  const [filtersApplied, setFiltersApplied] = useState(false);

  const queryParams = new URLSearchParams();
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);
  if (partnerId && partnerId !== "all") queryParams.set("partnerId", partnerId);
  if (agentId && agentId !== "all") queryParams.set("agentId", agentId);
  if (status && status !== "all") queryParams.set("status", status);

  const { data: reportData, isLoading, isError } = useQuery<ReportData>({
    queryKey: ["/api/reports/production", from, to, partnerId, agentId, status, filtersApplied],
    queryFn: async () => {
      const r = await fetch(`/api/reports/production?${queryParams.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: isAdmin && filtersApplied,
    retry: false,
  });

  const { data: partners } = useQuery<Partner[]>({ queryKey: ["/api/partners"] });
  const { data: statuses } = useQuery<ContractStatus[]>({ queryKey: ["/api/contract-statuses"] });
  const { data: agents } = useQuery<any[]>({ queryKey: ["/api/app-users"] });

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <ShieldAlert className="w-8 h-8 text-destructive mr-3" />
        <span className="text-lg font-semibold">Prístup zamietnutý</span>
      </div>
    );
  }

  const handleGenerate = () => {
    setFiltersApplied(true);
  };

  const handleReset = () => {
    setFrom("");
    setTo("");
    setPartnerId("");
    setAgentId("");
    setStatus("");
    setFiltersApplied(false);
  };

  const generatePDF = () => {
    if (!reportData || !appUser) return;

    const doc = new jsPDF();
    const now = new Date();
    const timestamp = now.toLocaleString("sk-SK");
    const userEmail = appUser.email || appUser.username || "unknown";

    doc.setFontSize(8);
    doc.setTextColor(200, 200, 200);
    const watermarkText = `${userEmail} | ${timestamp}`;
    doc.saveGraphicsState();
    doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
    for (let y = 40; y < 280; y += 50) {
      doc.text(watermarkText, 105, y, { angle: 45, align: "center" });
    }
    doc.restoreGraphicsState();

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("ArutsoK - Manager Summary", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generované: ${timestamp}`, 14, 28);
    if (from || to) doc.text(`Obdobie: ${from || "..."} - ${to || "..."}`, 14, 34);

    let yPos = 48;

    const kpiItems = [
      { label: "Celková produkcia", value: formatCurrency(reportData.kpi.totalPremium) },
      { label: "Čistá produkcia", value: formatCurrency(reportData.kpi.netProduction) },
      { label: "Skutočný cashflow", value: formatCurrency(reportData.kpi.actualCashflow) },
      { label: "Storno - počet", value: String(reportData.kpi.stornoCount) },
      { label: "Storno - objem", value: formatCurrency(reportData.kpi.stornoAmount) },
    ];

    doc.setFontSize(12);
    doc.text("KPI Prehľad", 14, yPos);
    yPos += 8;

    for (const item of kpiItems) {
      doc.setFontSize(10);
      doc.text(`${item.label}:`, 14, yPos);
      doc.setFontSize(11);
      doc.text(item.value, 80, yPos);
      yPos += 8;
    }

    yPos += 10;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Celkový počet záznamov: ${reportData.totalRecords}`, 14, yPos);
    yPos += 6;
    doc.text("Poznámka: Detailná tabuľka nie je súčasťou tohto reportu z bezpečnostných dôvodov.", 14, yPos);

    doc.save(`ArutsoK_Report_${now.toISOString().slice(0, 10)}.pdf`);
  };

  const kpi = reportData?.kpi;
  const records = reportData?.records || [];

  const tableSum = records.reduce((acc, r) => acc + r.premiumAmount, 0);

  return (
    <div className="flex flex-col gap-4 p-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold" data-testid="text-reports-title">Analytika a Reporty</h1>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div>
              <Label className="text-xs">Od</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} data-testid="input-date-from" />
            </div>
            <div>
              <Label className="text-xs">Do</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} data-testid="input-date-to" />
            </div>
            <div>
              <Label className="text-xs">Partner</Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger data-testid="select-partner"><SelectValue placeholder="Všetci" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetci</SelectItem>
                  {partners?.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Získateľ</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger data-testid="select-agent"><SelectValue placeholder="Všetci" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetci</SelectItem>
                  {agents?.filter(a => a.role !== 'klient').map(a => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {[a.firstName, a.lastName].filter(Boolean).join(" ") || a.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-status"><SelectValue placeholder="Všetky" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky</SelectItem>
                  {statuses?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button onClick={handleGenerate} data-testid="button-generate-report">
              <BarChart3 className="w-4 h-4 mr-1" />
              Generovať report
            </Button>
            <Button variant="outline" onClick={handleReset} data-testid="button-reset-filters">Resetovať</Button>
            {reportData && (
              <Button variant="outline" onClick={generatePDF} className="ml-auto" data-testid="button-pdf-export">
                <FileText className="w-4 h-4 mr-1" />
                Manager Summary PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center justify-center py-12" data-testid="loading-spinner">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Generujem report...</span>
        </div>
      )}

      {isError && filtersApplied && !isLoading && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
            <p className="text-destructive font-semibold">Chyba pri načítaní reportu</p>
            <p className="text-xs text-muted-foreground mt-1">Skúste to znova alebo zmeňte filtre</p>
          </CardContent>
        </Card>
      )}

      {filtersApplied && !isLoading && kpi && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card data-testid="kpi-total-premium">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Celková produkcia</span>
                </div>
                <div className="text-2xl font-black tabular-nums" data-testid="text-total-premium">{formatCurrency(kpi.totalPremium)}</div>
              </CardContent>
            </Card>
            <Card data-testid="kpi-net-production">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Čistá produkcia</span>
                </div>
                <div className="text-2xl font-black tabular-nums" data-testid="text-net-production">{formatCurrency(kpi.netProduction)}</div>
              </CardContent>
            </Card>
            <Card data-testid="kpi-cashflow">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Skutočný cashflow</span>
                </div>
                <div className="text-2xl font-black tabular-nums" data-testid="text-cashflow">{formatCurrency(kpi.actualCashflow)}</div>
              </CardContent>
            </Card>
            <Card className="border-red-600 bg-red-950/30" data-testid="kpi-storno">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-400">Storno Analýza</span>
                </div>
                <div className="text-2xl font-black tabular-nums text-red-400" data-testid="text-storno-amount">{formatCurrency(kpi.stornoAmount)}</div>
                <div className="text-xs text-red-400/70 mt-0.5" data-testid="text-storno-count">{kpi.stornoCount} storno zmlúv</div>
              </CardContent>
            </Card>
          </div>

          {records.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground" data-testid="text-no-data">Žiadne dáta pre zvolené kritériá</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[600px]">
                  <table className="w-full text-sm report-table">
                    <thead className="sticky top-0 bg-card z-10 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Zmluva</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Klient</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">ŠPZ</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Poistné</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Dátum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={i} className="border-b border-border/50" data-testid={`row-report-${i}`}>
                          <td className="px-3 py-2 font-mono text-xs">{r.globalNumber || r.contractUid}</td>
                          <td className="px-3 py-2">{r.clientName}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.licensePlate || "-"}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(r.premiumAmount)}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px]" style={r.statusColor ? { borderColor: r.statusColor, color: r.statusColor } : {}}>
                              {r.statusName || "-"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(r.signedDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-card border-t-2 border-primary/30">
                      <tr>
                        <td className="px-3 py-2 text-xs font-bold" colSpan={3}>
                          Celkom ({records.length} záznamov)
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-black" data-testid="text-table-sum">
                          {formatCurrency(tableSum)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!filtersApplied && !isLoading && (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Zvoľte filtre a kliknite "Generovať report"</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
