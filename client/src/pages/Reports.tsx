import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppUser } from "@/hooks/use-app-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, TrendingUp, Banknote, AlertTriangle, FileText, ShieldAlert, Search, Plus, X, Users, ShoppingCart, ChevronDown, ChevronUp } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { Partner, ContractStatus } from "@shared/schema";
import jsPDF from "jspdf";

interface KPI {
  totalPremium: number;
  stornoCount: number;
  stornoAmount: number;
  actualCashflow: number;
  netProduction: number;
  crossSellPotential: number;
  redListCount: number;
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
  expiryDate: string | null;
  partnerName: string;
  contractType: string;
  paymentFrequency: string;
  subjectType: string;
  listStatus: string | null;
}

interface PartnerBreakdown {
  partnerName: string;
  totalPremium: number;
  count: number;
}

interface MonthlyTrend {
  month: string;
  totalPremium: number;
}

interface ReportData {
  kpi: KPI;
  records: ReportRecord[];
  totalRecords: number;
  partnerBreakdown: PartnerBreakdown[];
  monthlyTrend: MonthlyTrend[];
  contractTypes: string[];
}

interface DynamicFilter {
  id: string;
  field: string;
  label: string;
  module: "A" | "B" | "C";
  value: string;
  value2?: string;
  type: "select" | "text" | "range" | "dateRange";
}

const CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1",
  "#14b8a6", "#e11d48",
];

const DYNAMIC_FILTER_OPTIONS = [
  { field: "subjectType", label: "Typ subjektu (FO/PO/SZČO)", module: "A" as const, type: "select" as const },
  { field: "listStatus", label: "Reputačný status", module: "A" as const, type: "select" as const },
  { field: "psc", label: "PSČ", module: "A" as const, type: "text" as const },
  { field: "premium", label: "Lehotné poistné (rozsah)", module: "B" as const, type: "range" as const },
  { field: "paymentFrequency", label: "Frekvencia platenia", module: "B" as const, type: "select" as const },
  { field: "expiry", label: "Dátum expirácie (rozsah)", module: "B" as const, type: "dateRange" as const },
];

const MODULE_COLORS: Record<string, string> = { A: "bg-emerald-600", B: "bg-blue-600", C: "bg-orange-600" };
const MODULE_LABELS: Record<string, string> = { A: "Klientsky kmeň", B: "Zmluvy & Produkcia", C: "Technické detaily" };

function formatCurrency(val: number): string {
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  try { return new Date(d).toLocaleDateString("sk-SK"); } catch { return "-"; }
}

function formatMonthLabel(m: string): string {
  const [year, month] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "Máj", "Jún", "Júl", "Aug", "Sep", "Okt", "Nov", "Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year.slice(2)}`;
}

function getFilterDisplayValue(f: DynamicFilter): string {
  if (f.type === "range") return `${f.value || "..."} - ${f.value2 || "..."}`;
  if (f.type === "dateRange") return `${f.value || "..."} - ${f.value2 || "..."}`;
  if (f.field === "subjectType") {
    const map: Record<string, string> = { person: "Fyzická osoba", company: "Právnická osoba", szco: "SZČO" };
    return map[f.value] || f.value;
  }
  if (f.field === "listStatus") {
    const map: Record<string, string> = { cerveny: "Červený zoznam", cierny: "Čierny zoznam", clean: "Čistý" };
    return map[f.value] || f.value;
  }
  if (f.field === "paymentFrequency") {
    const map: Record<string, string> = { mesačne: "Mesačne", štvrťročne: "Štvrťročne", polročne: "Polročne", ročne: "Ročne", jednorazovo: "Jednorazovo" };
    return map[f.value] || f.value;
  }
  return f.value;
}

export default function Reports() {
  const { data: appUser } = useAppUser();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [status, setStatus] = useState("");
  const [contractType, setContractType] = useState("");
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dynamicFilters, setDynamicFilters] = useState<DynamicFilter[]>([]);
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [deepDiveOpen, setDeepDiveOpen] = useState(true);
  const [autoRefreshKey, setAutoRefreshKey] = useState(0);

  const addDynamicFilter = useCallback((opt: typeof DYNAMIC_FILTER_OPTIONS[0]) => {
    const already = dynamicFilters.find(f => f.field === opt.field);
    if (already) return;
    setDynamicFilters(prev => [...prev, { id: `${opt.field}-${Date.now()}`, field: opt.field, label: opt.label, module: opt.module, value: "", value2: "", type: opt.type }]);
    setShowAddFilter(false);
  }, [dynamicFilters]);

  const removeDynamicFilter = useCallback((id: string) => {
    setDynamicFilters(prev => prev.filter(f => f.id !== id));
  }, []);

  const updateDynamicFilter = useCallback((id: string, key: "value" | "value2", val: string) => {
    setDynamicFilters(prev => prev.map(f => f.id === id ? { ...f, [key]: val } : f));
  }, []);

  const getDynFilterValue = (field: string) => dynamicFilters.find(f => f.field === field)?.value || "";
  const getDynFilterValue2 = (field: string) => dynamicFilters.find(f => f.field === field)?.value2 || "";

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (partnerId && partnerId !== "all") p.set("partnerId", partnerId);
    if (agentId && agentId !== "all") p.set("agentId", agentId);
    if (status && status !== "all") p.set("status", status);
    if (contractType && contractType !== "all") p.set("contractType", contractType);
    const st = getDynFilterValue("subjectType");
    if (st) p.set("subjectType", st);
    const ls = getDynFilterValue("listStatus");
    if (ls) p.set("listStatus", ls);
    const psc = getDynFilterValue("psc");
    if (psc) p.set("psc", psc);
    const pMin = getDynFilterValue("premium");
    const pMax = getDynFilterValue2("premium");
    if (pMin) p.set("premiumMin", pMin);
    if (pMax) p.set("premiumMax", pMax);
    const pf = getDynFilterValue("paymentFrequency");
    if (pf) p.set("paymentFrequency", pf);
    const ef = getDynFilterValue("expiry");
    const et = getDynFilterValue2("expiry");
    if (ef) p.set("expiryFrom", ef);
    if (et) p.set("expiryTo", et);
    return p;
  }, [from, to, partnerId, agentId, status, contractType, dynamicFilters, autoRefreshKey]);

  useEffect(() => {
    if (filtersApplied) {
      setAutoRefreshKey(k => k + 1);
    }
  }, [dynamicFilters, partnerId, agentId, status, contractType]);

  const { data: reportData, isLoading, isError } = useQuery<ReportData>({
    queryKey: ["/api/reports/production", queryParams.toString(), filtersApplied, autoRefreshKey],
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

  const handleGenerate = () => setFiltersApplied(true);

  const handleReset = () => {
    setFrom(""); setTo(""); setPartnerId(""); setAgentId("");
    setStatus(""); setContractType(""); setFiltersApplied(false);
    setSearchText(""); setDynamicFilters([]); setAutoRefreshKey(0);
  };

  const kpi = reportData?.kpi;
  const records = reportData?.records || [];
  const partnerBreakdown = reportData?.partnerBreakdown || [];
  const monthlyTrend = reportData?.monthlyTrend || [];
  const availableContractTypes = reportData?.contractTypes || [];

  const filteredRecords = useMemo(() => {
    if (!searchText.trim()) return records;
    const q = searchText.toLowerCase().trim();
    return records.filter(r =>
      (r.clientName || "").toLowerCase().includes(q) ||
      (r.licensePlate || "").toLowerCase().includes(q) ||
      (r.contractUid || "").toLowerCase().includes(q) ||
      (r.globalNumber && String(r.globalNumber).includes(q)) ||
      (r.contractType || "").toLowerCase().includes(q) ||
      (r.paymentFrequency || "").toLowerCase().includes(q)
    );
  }, [records, searchText]);

  const tableSum = filteredRecords.reduce((acc, r) => acc + r.premiumAmount, 0);

  const pieData = useMemo(() => {
    const totalAll = partnerBreakdown.reduce((s, p) => s + p.totalPremium, 0);
    return partnerBreakdown.map(p => ({
      name: p.partnerName,
      value: p.totalPremium,
      percent: totalAll > 0 ? ((p.totalPremium / totalAll) * 100).toFixed(1) : "0",
    }));
  }, [partnerBreakdown]);

  const barData = useMemo(() =>
    monthlyTrend.map(m => ({ name: formatMonthLabel(m.month), value: m.totalPremium })),
    [monthlyTrend]
  );

  const activeFiltersSummary = useMemo(() => {
    const items: { label: string; value: string; module: string }[] = [];
    if (from || to) items.push({ label: "Obdobie", value: `${from || "..."} - ${to || "..."}`, module: "B" });
    if (partnerId && partnerId !== "all") items.push({ label: "Partner", value: partners?.find(p => String(p.id) === partnerId)?.name || partnerId, module: "B" });
    if (agentId && agentId !== "all") items.push({ label: "Získateľ", value: agents?.find(a => String(a.id) === agentId)?.username || agentId, module: "B" });
    if (status && status !== "all") items.push({ label: "Status", value: statuses?.find(s => String(s.id) === status)?.name || status, module: "B" });
    if (contractType && contractType !== "all") items.push({ label: "Typ zmluvy", value: contractType, module: "B" });
    for (const f of dynamicFilters) {
      if (f.value) items.push({ label: f.label, value: getFilterDisplayValue(f), module: f.module });
    }
    return items;
  }, [from, to, partnerId, agentId, status, contractType, dynamicFilters, partners, agents, statuses]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20">
        <ShieldAlert className="w-8 h-8 text-destructive mr-3" />
        <span className="text-lg font-semibold">Prístup zamietnutý</span>
      </div>
    );
  }

  const generatePDF = () => {
    if (!reportData || !appUser) return;
    const doc = new jsPDF();
    const now = new Date();
    const timestamp = now.toLocaleString("sk-SK");
    const userEmail = appUser.email || appUser.username || "unknown";
    const watermarkText = `${userEmail} | ${timestamp}`;

    const addWatermark = () => {
      doc.saveGraphicsState();
      doc.setGState(new (doc as any).GState({ opacity: 0.15 }));
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      for (let y = 40; y < 280; y += 50) {
        doc.text(watermarkText, 105, y, { angle: 45, align: "center" });
      }
      doc.restoreGraphicsState();
      doc.setTextColor(0, 0, 0);
    };

    addWatermark();
    doc.setFontSize(16);
    doc.text("ArutsoK - Manager Summary", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generovane: ${timestamp}`, 14, 28);
    if (from || to) doc.text(`Obdobie: ${from || "..."} - ${to || "..."}`, 14, 34);

    let yPos = 46;

    if (activeFiltersSummary.length > 0) {
      doc.setFontSize(11);
      doc.text("Aktivne filtre:", 14, yPos);
      yPos += 6;
      doc.setFontSize(8);
      for (const f of activeFiltersSummary) {
        doc.text(`[${f.module}] ${f.label}: ${f.value}`, 16, yPos);
        yPos += 5;
      }
      yPos += 4;
    }

    doc.setFontSize(12);
    doc.text("KPI Prehlad", 14, yPos);
    yPos += 8;

    const kpiItems = [
      { label: "Celkova produkcia", value: formatCurrency(reportData.kpi.totalPremium) },
      { label: "Cista produkcia", value: formatCurrency(reportData.kpi.netProduction) },
      { label: "Skutocny cashflow", value: formatCurrency(reportData.kpi.actualCashflow) },
      { label: "Storno - pocet", value: String(reportData.kpi.stornoCount) },
      { label: "Storno - objem", value: formatCurrency(reportData.kpi.stornoAmount) },
      { label: "Cross-sell potencial", value: `${reportData.kpi.crossSellPotential} klientov` },
      { label: "Cerveny zoznam", value: `${reportData.kpi.redListCount} subjektov` },
    ];

    for (const item of kpiItems) {
      doc.setFontSize(10);
      doc.text(`${item.label}:`, 14, yPos);
      doc.setFontSize(11);
      doc.text(item.value, 80, yPos);
      yPos += 8;
    }

    yPos += 6;
    if (partnerBreakdown.length > 0) {
      if (yPos > 240) { doc.addPage(); yPos = 20; addWatermark(); }
      doc.setFontSize(12);
      doc.text("Podiel partnerov", 14, yPos);
      yPos += 8;
      const totalAll = partnerBreakdown.reduce((s, p) => s + p.totalPremium, 0);
      for (const p of partnerBreakdown) {
        if (yPos > 270) { doc.addPage(); yPos = 20; addWatermark(); }
        const pct = totalAll > 0 ? ((p.totalPremium / totalAll) * 100).toFixed(1) : "0";
        doc.setFontSize(9);
        doc.text(p.partnerName, 14, yPos);
        doc.text(`${formatCurrency(p.totalPremium)}  (${pct}%)`, 80, yPos);
        doc.text(`${p.count} zmluv`, 150, yPos);
        yPos += 6;
      }
    }

    yPos += 6;
    if (monthlyTrend.length > 0) {
      if (yPos > 240) { doc.addPage(); yPos = 20; addWatermark(); }
      doc.setFontSize(12);
      doc.text("Mesacny trend produkcie", 14, yPos);
      yPos += 8;
      for (const m of monthlyTrend) {
        if (yPos > 275) { doc.addPage(); yPos = 20; addWatermark(); }
        doc.setFontSize(9);
        doc.text(formatMonthLabel(m.month), 14, yPos);
        doc.text(formatCurrency(m.totalPremium), 80, yPos);
        yPos += 6;
      }
    }

    yPos += 10;
    if (yPos > 270) { doc.addPage(); yPos = 20; addWatermark(); }
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Celkovy pocet zaznamov: ${reportData.totalRecords}`, 14, yPos);
    yPos += 6;
    doc.text("Poznamka: Detailna tabulka nie je sucastou tohto reportu z bezpecnostnych dovodov.", 14, yPos);

    doc.save(`ArutsoK_Report_${now.toISOString().slice(0, 10)}.pdf`);
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded px-3 py-2 shadow-lg text-sm">
        <p className="font-medium">{payload[0].name || payload[0].payload?.name}</p>
        <p className="tabular-nums">{formatCurrency(payload[0].value)}</p>
      </div>
    );
  };

  const PieLabelRenderer = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const availableToAdd = DYNAMIC_FILTER_OPTIONS.filter(o => !dynamicFilters.find(f => f.field === o.field));

  return (
    <div className="flex flex-col gap-4 p-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold" data-testid="text-reports-title">Analytika a Reporty</h1>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
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
            <div>
              <Label className="text-xs">Typ zmluvy</Label>
              <Select value={contractType} onValueChange={setContractType}>
                <SelectTrigger data-testid="select-contract-type"><SelectValue placeholder="Všetky" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky</SelectItem>
                  {(availableContractTypes.length > 0
                    ? availableContractTypes
                    : ["Nova", "PZP", "KASKO", "Život", "Majetok", "Úraz", "Cestovné"]
                  ).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {dynamicFilters.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {dynamicFilters.map(f => (
                <div key={f.id} className="flex items-center gap-1.5 bg-muted/50 border border-border rounded-md px-2 py-1.5" data-testid={`dynamic-filter-${f.field}`}>
                  <Badge variant="outline" className={`${MODULE_COLORS[f.module]} text-white text-[9px] px-1 py-0`}>{f.module}</Badge>
                  <span className="text-xs font-medium">{f.label}:</span>
                  {f.type === "select" && f.field === "subjectType" && (
                    <Select value={f.value} onValueChange={v => updateDynamicFilter(f.id, "value", v)}>
                      <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Vybrať" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="person">Fyzická osoba</SelectItem>
                        <SelectItem value="company">Právnická osoba</SelectItem>
                        <SelectItem value="szco">SZČO</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {f.type === "select" && f.field === "listStatus" && (
                    <Select value={f.value} onValueChange={v => updateDynamicFilter(f.id, "value", v)}>
                      <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Vybrať" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cerveny">Červený zoznam</SelectItem>
                        <SelectItem value="cierny">Čierny zoznam</SelectItem>
                        <SelectItem value="clean">Čistý</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {f.type === "select" && f.field === "paymentFrequency" && (
                    <Select value={f.value} onValueChange={v => updateDynamicFilter(f.id, "value", v)}>
                      <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Vybrať" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mesačne">Mesačne</SelectItem>
                        <SelectItem value="štvrťročne">Štvrťročne</SelectItem>
                        <SelectItem value="polročne">Polročne</SelectItem>
                        <SelectItem value="ročne">Ročne</SelectItem>
                        <SelectItem value="jednorazovo">Jednorazovo</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                  {f.type === "text" && (
                    <Input className="h-7 w-24 text-xs" value={f.value} onChange={e => updateDynamicFilter(f.id, "value", e.target.value)} placeholder="Zadajte..." />
                  )}
                  {f.type === "range" && (
                    <div className="flex items-center gap-1">
                      <Input className="h-7 w-20 text-xs" type="number" value={f.value} onChange={e => updateDynamicFilter(f.id, "value", e.target.value)} placeholder="Min" />
                      <span className="text-xs text-muted-foreground">-</span>
                      <Input className="h-7 w-20 text-xs" type="number" value={f.value2 || ""} onChange={e => updateDynamicFilter(f.id, "value2", e.target.value)} placeholder="Max" />
                    </div>
                  )}
                  {f.type === "dateRange" && (
                    <div className="flex items-center gap-1">
                      <Input className="h-7 w-28 text-xs" type="date" value={f.value} onChange={e => updateDynamicFilter(f.id, "value", e.target.value)} />
                      <span className="text-xs text-muted-foreground">-</span>
                      <Input className="h-7 w-28 text-xs" type="date" value={f.value2 || ""} onChange={e => updateDynamicFilter(f.id, "value2", e.target.value)} />
                    </div>
                  )}
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeDynamicFilter(f.id)} data-testid={`remove-filter-${f.field}`}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 mt-3 flex-wrap">
            <Button onClick={handleGenerate} data-testid="button-generate-report">
              <BarChart3 className="w-4 h-4 mr-1" />
              Generovať report
            </Button>
            <Button variant="outline" onClick={handleReset} data-testid="button-reset-filters">Resetovať</Button>

            <div className="relative">
              <Button variant="outline" onClick={() => setShowAddFilter(!showAddFilter)} data-testid="button-add-filter" disabled={availableToAdd.length === 0}>
                <Plus className="w-4 h-4 mr-1" />
                Pridať filter
              </Button>
              {showAddFilter && availableToAdd.length > 0 && (
                <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-md shadow-lg w-64 py-1" data-testid="filter-dropdown">
                  {(["A", "B", "C"] as const).map(mod => {
                    const items = availableToAdd.filter(o => o.module === mod);
                    if (items.length === 0) return null;
                    return (
                      <div key={mod}>
                        <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                          <span className={`inline-block w-2 h-2 rounded-full ${MODULE_COLORS[mod]}`} />
                          {MODULE_LABELS[mod]}
                        </div>
                        {items.map(opt => (
                          <button key={opt.field} className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors" onClick={() => addDynamicFilter(opt)} data-testid={`add-filter-${opt.field}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <Card data-testid="kpi-total-premium">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Celková produkcia</span>
                </div>
                <div className="text-xl font-black tabular-nums" data-testid="text-total-premium">{formatCurrency(kpi.totalPremium)}</div>
              </CardContent>
            </Card>
            <Card data-testid="kpi-net-production">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Banknote className="w-4 h-4 text-blue-500" />
                  <span className="text-xs text-muted-foreground">Čistá produkcia</span>
                </div>
                <div className="text-xl font-black tabular-nums" data-testid="text-net-production">{formatCurrency(kpi.netProduction)}</div>
              </CardContent>
            </Card>
            <Card data-testid="kpi-cashflow">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  <span className="text-xs text-muted-foreground">Skutočný cashflow</span>
                </div>
                <div className="text-xl font-black tabular-nums" data-testid="text-cashflow">{formatCurrency(kpi.actualCashflow)}</div>
              </CardContent>
            </Card>
            <Card className="border-red-600 bg-red-950/30" data-testid="kpi-storno">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-xs text-red-400">Storno Analýza</span>
                </div>
                <div className="text-xl font-black tabular-nums text-red-400" data-testid="text-storno-amount">{formatCurrency(kpi.stornoAmount)}</div>
                <div className="text-xs text-red-400/70 mt-0.5" data-testid="text-storno-count">{kpi.stornoCount} storno zmlúv</div>
              </CardContent>
            </Card>
            <Card className="border-emerald-600/50" data-testid="kpi-cross-sell">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingCart className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs text-muted-foreground">Cross-sell potenciál</span>
                </div>
                <div className="text-xl font-black tabular-nums text-emerald-400" data-testid="text-cross-sell">{kpi.crossSellPotential}</div>
                <div className="text-xs text-muted-foreground mt-0.5">3+ zmluvy bez života</div>
              </CardContent>
            </Card>
            <Card className="border-orange-600/50" data-testid="kpi-red-list">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="w-4 h-4 text-orange-500" />
                  <span className="text-xs text-muted-foreground">Červený zoznam</span>
                </div>
                <div className="text-xl font-black tabular-nums text-orange-400" data-testid="text-red-list">{kpi.redListCount}</div>
                <div className="text-xs text-muted-foreground mt-0.5">subjektov v kmeňi</div>
              </CardContent>
            </Card>
          </div>

          {(pieData.length > 0 || barData.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="charts-section">
              {pieData.length > 0 && (
                <Card data-testid="chart-partner-share">
                  <CardContent className="pt-4 pb-3">
                    <h3 className="text-sm font-semibold mb-3">Podiel partnerov</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={PieLabelRenderer}>
                          {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                        </Pie>
                        <ReTooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ fontSize: "11px" }} formatter={(value: string) => <span className="text-foreground text-xs">{value}</span>} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
              {barData.length > 0 && (
                <Card data-testid="chart-monthly-trend">
                  <CardContent className="pt-4 pb-3">
                    <h3 className="text-sm font-semibold mb-3">Trend produkcie</h3>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={barData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                        <ReTooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeFiltersSummary.length > 0 && (
            <Card data-testid="deep-dive-section">
              <CardContent className="pt-3 pb-2">
                <button className="flex items-center gap-2 w-full text-left" onClick={() => setDeepDiveOpen(!deepDiveOpen)} data-testid="button-toggle-deep-dive">
                  <Search className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Hĺbkový prieskum</span>
                  <span className="text-xs text-muted-foreground ml-1">({activeFiltersSummary.length} aktívnych filtrov)</span>
                  {deepDiveOpen ? <ChevronUp className="w-4 h-4 ml-auto text-muted-foreground" /> : <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" />}
                </button>
                {deepDiveOpen && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeFiltersSummary.map((f, i) => (
                      <Badge key={i} variant="outline" className="text-xs gap-1">
                        <span className={`inline-block w-2 h-2 rounded-full ${MODULE_COLORS[f.module] || "bg-gray-500"}`} />
                        {f.label}: {f.value}
                      </Badge>
                    ))}
                    {dynamicFilters.some(f => f.module === "C") && (
                      <Badge variant="outline" className="text-xs bg-orange-950/30 border-orange-600/50 text-orange-400">
                        Modul C: Prístup auditovaný
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {records.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground" data-testid="text-no-data">Žiadne dáta pre zvolené kritériá</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="px-3 pt-3 pb-2">
                  <div className="relative max-w-xs">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Hľadať meno, ŠPZ, číslo zmluvy..." value={searchText} onChange={e => setSearchText(e.target.value)} className="pl-9 h-9 text-sm" data-testid="input-fulltext-search" />
                  </div>
                </div>
                <div className="overflow-auto max-h-[600px]">
                  <table className="w-full text-sm report-table">
                    <thead className="sticky top-0 bg-card z-10 border-b">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Zmluva</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Klient</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Typ</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">ŠPZ</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-muted-foreground">Poistné</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Frekvencia</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Dátum</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground">Expirácia</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRecords.map((r, i) => (
                        <tr key={i} className="border-b border-border/50" data-testid={`row-report-${i}`}>
                          <td className="px-3 py-2 font-mono text-xs">{r.globalNumber || r.contractUid}</td>
                          <td className="px-3 py-2">
                            {r.clientName}
                            {r.listStatus === "cerveny" && <Badge variant="outline" className="ml-1 text-[9px] border-red-500 text-red-400">ČZ</Badge>}
                          </td>
                          <td className="px-3 py-2 text-xs">{r.contractType || "-"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{r.licensePlate || "-"}</td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{formatCurrency(r.premiumAmount)}</td>
                          <td className="px-3 py-2 text-xs">{r.paymentFrequency || "-"}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-[10px]" style={r.statusColor ? { borderColor: r.statusColor, color: r.statusColor } : {}}>
                              {r.statusName || "-"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(r.signedDate)}</td>
                          <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(r.expiryDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="sticky bottom-0 bg-card border-t-2 border-primary/30">
                      <tr>
                        <td className="px-3 py-2 text-xs font-bold" colSpan={4}>
                          Celkom ({filteredRecords.length}{searchText ? ` z ${records.length}` : ""} záznamov)
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-black" data-testid="text-table-sum">
                          {formatCurrency(tableSum)}
                        </td>
                        <td colSpan={4}></td>
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
