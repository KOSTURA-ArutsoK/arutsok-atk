import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppUser } from "@/hooks/use-app-user";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Loader2, Mail, ShieldAlert, Download, FileSpreadsheet,
  Send, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { ContractStatus } from "@shared/schema";
import jsPDF from "jspdf";
import { formatDateTimeSlovak, formatTimestampForFile } from "@/lib/utils";

interface NotifKPI {
  total: number;
  sent: number;
  failed: number;
  pending: number;
}

interface DailyEntry {
  date: string;
  sent: number;
  failed: number;
  pending: number;
}

interface MonthlyEntry {
  month: string;
  sent: number;
  failed: number;
  pending: number;
}

interface FailedEntry {
  id: number;
  recipientEmail: string;
  recipientName: string | null;
  notificationType: string;
  errorDetails: string | null;
  contractNumber: string | null;
  contractStatusName: string | null;
  createdAt: string;
}

interface NotifReportData {
  kpi: NotifKPI;
  dailyTimeline: DailyEntry[];
  monthlyOverview: MonthlyEntry[];
  failedList: FailedEntry[];
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("sk-SK");
  } catch {
    return "-";
  }
}

function formatDateTime(d: string | null | undefined): string {
  if (!d) return "-";
  try {
    const date = new Date(d);
    return `${date.toLocaleDateString("sk-SK")} ${date.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return "-";
  }
}

export default function ReportyOdosielanie() {
  const { data: appUser } = useAppUser();
  const isAdmin = ["admin", "superadmin", "prezident", "architekt"].includes(appUser?.role || "");

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [statusId, setStatusId] = useState("");
  const [filtersApplied, setFiltersApplied] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const queryParams = useMemo(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (statusId && statusId !== "all") p.set("statusId", statusId);
    return p.toString();
  }, [from, to, statusId]);

  const { data: reportData, isLoading } = useQuery<NotifReportData>({
    queryKey: ["/api/reports/notifications", queryParams, filtersApplied],
    queryFn: async () => {
      const r = await fetch(`/api/reports/notifications?${queryParams}`, { credentials: "include" });
      if (r.status === 401) {
        window.location.href = "/";
        throw new Error("Session expired");
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    enabled: isAdmin && filtersApplied,
    retry: 1,
    placeholderData: (prev: any) => prev,
  });

  const { data: statuses } = useQuery<ContractStatus[]>({ queryKey: ["/api/contract-statuses"] });

  const handleGenerate = () => setFiltersApplied(true);
  const handleReset = () => {
    setFrom("");
    setTo("");
    setStatusId("");
    setFiltersApplied(false);
  };

  const kpi = reportData?.kpi;
  const dailyTimeline = reportData?.dailyTimeline || [];
  const failedList = reportData?.failedList || [];

  const barData = useMemo(() =>
    dailyTimeline.map(d => ({
      name: formatDate(d.date),
      sent: d.sent,
      failed: d.failed,
      pending: d.pending,
    })),
    [dailyTimeline]
  );

  const generatePDF = useCallback(async () => {
    if (!reportData || !appUser) return;
    const doc = new jsPDF();
    const now = new Date();
    const timestamp = formatDateTimeSlovak(now);
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
    doc.text("ArutsoK - Report Odosielania Notifikacii", 14, 20);
    doc.setFontSize(10);
    doc.text(`Generovane: ${timestamp}`, 14, 28);
    if (from || to) doc.text(`Obdobie: ${from || "..."} - ${to || "..."}`, 14, 34);

    let yPos = 44;

    doc.setFontSize(12);
    doc.text("KPI Prehlad", 14, yPos);
    yPos += 8;

    const kpiItems = [
      { label: "Celkom odoslanych", value: String(reportData.kpi.total) },
      { label: "Uspesnych", value: String(reportData.kpi.sent) },
      { label: "Chybovych", value: String(reportData.kpi.failed) },
      { label: "Cakajucich", value: String(reportData.kpi.pending) },
    ];

    for (const item of kpiItems) {
      doc.setFontSize(10);
      doc.text(`${item.label}:`, 14, yPos);
      doc.setFontSize(11);
      doc.text(item.value, 80, yPos);
      yPos += 8;
    }

    yPos += 6;
    if (reportData.failedList.length > 0) {
      doc.setFontSize(12);
      doc.text("Chybove notifikacie", 14, yPos);
      yPos += 8;
      doc.setFontSize(8);

      doc.text("Prijemca", 14, yPos);
      doc.text("Typ", 70, yPos);
      doc.text("Dovod chyby", 100, yPos);
      doc.text("Datum", 170, yPos);
      yPos += 6;

      for (const f of reportData.failedList.slice(0, 50)) {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
          addWatermark();
        }
        doc.text((f.recipientEmail || "").substring(0, 30), 14, yPos);
        doc.text((f.notificationType || "").substring(0, 15), 70, yPos);
        doc.text((f.errorDetails || "-").substring(0, 35), 100, yPos);
        doc.text(formatDate(f.createdAt), 170, yPos);
        yPos += 5;
      }
    }

    doc.save(`ArutsoK_Odosielanie_${formatTimestampForFile(now)}.pdf`);
  }, [reportData, appUser, from, to]);

  const generateExcel = useCallback(async () => {
    if (!reportData) return;
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.Workbook();

    const wsKPI = workbook.addWorksheet("KPI");
    wsKPI.addRow(["Metrika", "Hodnota"]);
    wsKPI.addRow(["Celkom odoslanych", reportData.kpi.total]);
    wsKPI.addRow(["Uspesnych", reportData.kpi.sent]);
    wsKPI.addRow(["Chybovych", reportData.kpi.failed]);
    wsKPI.addRow(["Cakajucich", reportData.kpi.pending]);

    if (reportData.dailyTimeline.length > 0) {
      const wsDaily = workbook.addWorksheet("Denny prehlad");
      wsDaily.addRow(["Datum", "Odoslane", "Chybove", "Cakajuce"]);
      for (const d of reportData.dailyTimeline) {
        wsDaily.addRow([d.date, d.sent, d.failed, d.pending]);
      }
    }

    if (reportData.failedList.length > 0) {
      const wsFailed = workbook.addWorksheet("Chybove notifikacie");
      wsFailed.addRow(["Prijemca", "Meno", "Typ", "Dovod chyby", "Zmluva", "Datum"]);
      for (const f of reportData.failedList) {
        wsFailed.addRow([
          f.recipientEmail,
          f.recipientName || "-",
          f.notificationType,
          f.errorDetails || "-",
          f.contractNumber || "-",
          formatDateTime(f.createdAt),
        ]);
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ArutsoK_Odosielanie_${formatTimestampForFile()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [reportData]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="access-denied">
        <ShieldAlert className="w-8 h-8 text-destructive mr-3" />
        <span className="text-lg font-semibold">Pristup zamietnuty</span>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border rounded-md px-3 py-2 shadow-lg text-sm">
        <p className="font-medium mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.dataKey} style={{ color: p.color }} className="tabular-nums">
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <Mail className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-bold" data-testid="text-reporty-odosielanie-title">
          Reporty &gt; Odosielanie
        </h1>
      </div>

      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <Label className="text-xs">Od</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} data-testid="input-notif-date-from" />
            </div>
            <div>
              <Label className="text-xs">Do</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} data-testid="input-notif-date-to" />
            </div>
            <div>
              <Label className="text-xs">Stav zmluvy</Label>
              <Select value={statusId} onValueChange={setStatusId}>
                <SelectTrigger data-testid="select-notif-status">
                  <SelectValue placeholder="Vsetky" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetky</SelectItem>
                  {statuses?.map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} data-testid="button-generate-notif-report">
                Generovat
              </Button>
              <Button variant="outline" onClick={handleReset} data-testid="button-reset-notif-report">
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {filtersApplied && kpi && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card data-testid="card-kpi-total">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5" />
                  Celkom odoslanych
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-2xl font-bold" data-testid="text-kpi-total">{kpi.total.toLocaleString("sk-SK")}</div>
              </CardContent>
            </Card>

            <Card data-testid="card-kpi-sent">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Uspesnych
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="text-kpi-sent">
                  {kpi.sent.toLocaleString("sk-SK")}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-kpi-failed">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  Chybovych
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-kpi-failed">
                  {kpi.failed.toLocaleString("sk-SK")}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-kpi-pending">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs text-muted-foreground font-normal flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-yellow-500" />
                  Cakajucich
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400" data-testid="text-kpi-pending">
                  {kpi.pending.toLocaleString("sk-SK")}
                </div>
              </CardContent>
            </Card>
          </div>

          {barData.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  Denny prehlad odoslanych notifikacii
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div ref={chartRef} data-testid="chart-daily-notifications">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                      <ReTooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="sent" name="Odoslane" fill="#10b981" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="failed" name="Chybove" fill="#ef4444" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="pending" name="Cakajuce" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {failedList.length > 0 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4 flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-red-500" />
                  Chybove notifikacie ({failedList.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Prijemca</TableHead>
                        <TableHead>Typ</TableHead>
                        <TableHead>Dovod chyby</TableHead>
                        <TableHead>Zmluva</TableHead>
                        <TableHead>Datum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failedList.map(f => (
                        <TableRow key={f.id} data-testid={`row-failed-notif-${f.id}`}>
                          <TableCell className="text-xs">
                            <div>{f.recipientEmail}</div>
                            {f.recipientName && (
                              <div className="text-muted-foreground">{f.recipientName}</div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {f.notificationType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate">
                            {f.errorDetails || "-"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {f.contractNumber || "-"}
                            {f.contractStatusName && (
                              <div className="text-muted-foreground text-[10px]">{f.contractStatusName}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {formatDateTime(f.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={generatePDF} data-testid="button-export-notif-pdf" className="gap-1">
              <Download className="w-3.5 h-3.5" />
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={generateExcel} data-testid="button-export-notif-excel" className="gap-1">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </Button>
          </div>
        </>
      )}

      {filtersApplied && !isLoading && !kpi && (
        <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-no-data">
          Ziadne data pre zvolene filtre
        </div>
      )}
    </div>
  );
}
