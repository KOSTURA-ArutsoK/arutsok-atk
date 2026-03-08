import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronLeft, FileBarChart, Archive, ChevronDown, ChevronUp } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface NbsReport {
  id: number;
  year: number;
  period: string;
  status: string;
  sentDate: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

const PERIODS = [
  { key: "1q", label: "1Q" },
  { key: "2q", label: "2Q" },
  { key: "3q", label: "3Q" },
  { key: "4q", label: "4Q" },
  { key: "annual", label: "Ročný report" },
];

function getDeadline(period: string, year: number): Date {
  switch (period) {
    case "1q": return new Date(year, 4, 31);
    case "2q": return new Date(year, 7, 31);
    case "3q": return new Date(year, 10, 30);
    case "4q": return new Date(year + 1, 1, 28);
    case "annual": return new Date(year + 1, 2, 31);
    default: return new Date(year, 11, 31);
  }
}

function getDaysRemaining(deadline: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = deadline.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getColorByDeadline(deadline: Date, status: string): string {
  if (status === "sent") return "border-green-600 bg-green-100 dark:bg-green-950/30";
  const days = getDaysRemaining(deadline);
  if (days <= 14) return "border-red-500 bg-red-100 dark:bg-red-950/30";
  if (days <= 30) return "border-orange-500 bg-orange-100 dark:bg-orange-950/30";
  return "border-blue-500 bg-blue-100 dark:bg-blue-950/30";
}

function getYearColor(reports: NbsReport[], year: number): string {
  if (reports.length === 0) return "border-blue-500 bg-blue-100 dark:bg-blue-950/30";
  const allSent = reports.length === 5 && reports.every(r => r.status === "sent");
  if (allSent) return "border-green-700 bg-green-100 dark:bg-green-950/50";

  let closestDays = Infinity;
  for (const r of reports) {
    if (r.status !== "sent") {
      const deadline = getDeadline(r.period, year);
      const days = getDaysRemaining(deadline);
      if (days < closestDays) closestDays = days;
    }
  }
  if (closestDays <= 14) return "border-red-500 bg-red-100 dark:bg-red-950/40";
  if (closestDays <= 30) return "border-orange-500 bg-orange-100 dark:bg-orange-950/40";
  return "border-blue-500 bg-blue-100 dark:bg-blue-950/30";
}

function getStatusButtonColor(status: string): string {
  switch (status) {
    case "sent": return "bg-green-600 hover:bg-green-700 text-white";
    case "checked": return "bg-orange-500 hover:bg-orange-600 text-white";
    default: return "bg-red-600 hover:bg-red-700 text-white";
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case "sent": return "Odoslané";
    case "checked": return "Skontrolované";
    default: return "Neodoslané";
  }
}

function formatDeadlineSlovak(deadline: Date): string {
  const d = deadline.getDate().toString().padStart(2, "0");
  const m = (deadline.getMonth() + 1).toString().padStart(2, "0");
  const y = deadline.getFullYear();
  return `${d}.${m}.${y}`;
}

export default function ReportyNBS() {
  const { toast } = useToast();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const showNextYear = currentMonth >= 11;
  const mainYears = showNextYear ? [currentYear + 1, currentYear, currentYear - 1, currentYear - 2] : [currentYear, currentYear - 1, currentYear - 2];
  const archiveYears: number[] = [];
  for (let y = currentYear - 3; y >= currentYear - 12 && y >= 2013; y--) {
    archiveYears.push(y);
  }
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [sentDateInput, setSentDateInput] = useState("");
  const [sentDateDialogReport, setSentDateDialogReport] = useState<NbsReport | null>(null);
  const [confirmUnsendReport, setConfirmUnsendReport] = useState<NbsReport | null>(null);

  const { data: reports, isLoading } = useQuery<NbsReport[]>({
    queryKey: ["/api/nbs-reports", selectedYear],
    queryFn: async () => {
      if (!selectedYear) return [];
      const res = await fetch(`/api/nbs-reports?year=${selectedYear}`, { credentials: "include" });
      if (!res.ok) throw new Error("Chyba pri načítaní");
      return res.json();
    },
    enabled: !!selectedYear,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status, sentDate }: { id: number; status: string; sentDate?: string | null }) => {
      await apiRequest("PUT", `/api/nbs-reports/${id}`, { status, sentDate });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nbs-reports", selectedYear] });
      toast({ title: "Status aktualizovaný" });
    },
    onError: () => {
      toast({ title: "Chyba pri aktualizácii", variant: "destructive" });
    },
  });

  function handleStatusClick(report: NbsReport) {
    if (report.status === "not_sent") {
      updateMutation.mutate({ id: report.id, status: "checked" });
    } else if (report.status === "checked") {
      setSentDateInput("");
      setSentDateDialogReport(report);
    } else if (report.status === "sent") {
      setConfirmUnsendReport(report);
    }
  }

  function handleConfirmSentDate() {
    if (!sentDateDialogReport) return;
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(sentDateInput)) {
      toast({ title: "Neplatný formát dátumu. Použite DD.MM.RRRR", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ id: sentDateDialogReport.id, status: "sent", sentDate: sentDateInput });
    setSentDateDialogReport(null);
  }

  function handleConfirmUnsend() {
    if (!confirmUnsendReport) return;
    updateMutation.mutate({ id: confirmUnsendReport.id, status: "not_sent", sentDate: null });
    setConfirmUnsendReport(null);
  }

  const reportMap = new Map((reports || []).map(r => [r.period, r]));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="page-reporty-nbs">
      <div className="flex items-center gap-3">
        <FileBarChart className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Reporty pre NBS</h1>
        <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/50">Špecial</Badge>
      </div>

      {!selectedYear ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Vyberte rok:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {mainYears.map(year => (
              <YearBubble key={year} year={year} currentYear={currentYear} onSelect={setSelectedYear} />
            ))}
            <Card
              className="cursor-pointer border-2 border-yellow-600 bg-yellow-100 dark:bg-yellow-950/30 transition-all hover:scale-105"
              onClick={() => setArchiveOpen(!archiveOpen)}
              data-testid="btn-archive"
            >
              <CardContent className="py-8 text-center">
                <Archive className="w-8 h-8 mx-auto mb-2 text-yellow-600 dark:text-yellow-500" />
                <span className="text-xl font-bold text-yellow-700 dark:text-yellow-400">ARCHÍV</span>
                <div className="mt-1">
                  {archiveOpen ? <ChevronUp className="w-4 h-4 mx-auto text-yellow-500" /> : <ChevronDown className="w-4 h-4 mx-auto text-yellow-500" />}
                </div>
              </CardContent>
            </Card>
          </div>
          {archiveOpen && (
            <div className="space-y-2 mt-4" data-testid="archive-list">
              {archiveYears.map(year => (
                <Card
                  key={year}
                  className="cursor-pointer border border-yellow-600/40 bg-yellow-50 dark:bg-yellow-950/10 hover:bg-yellow-100 dark:hover:bg-yellow-950/30 transition-all"
                  onClick={() => setSelectedYear(year)}
                  data-testid={`archive-year-${year}`}
                >
                  <CardContent className="py-3 px-5 flex items-center justify-between">
                    <span className="text-lg font-bold text-yellow-700 dark:text-yellow-300">{year}</span>
                    <Archive className="w-4 h-4 text-yellow-600 dark:text-yellow-600/60" />
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <Button
            variant="ghost"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => setSelectedYear(null)}
            data-testid="btn-back-years"
          >
            <ChevronLeft className="w-4 h-4" />
            Späť na výber rokov
          </Button>

          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-xl font-bold">{selectedYear}</h2>
            {reports && (
              <Badge variant="outline" className={
                reports.length === 5 && reports.every(r => r.status === "sent")
                  ? "border-green-500 text-green-400"
                  : "border-blue-500 text-blue-400"
              }>
                {reports.filter(r => r.status === "sent").length}/5 odoslaných
              </Badge>
            )}
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {PERIODS.map(p => {
                const report = reportMap.get(p.key);
                if (!report) return null;
                const deadline = getDeadline(p.key, selectedYear);
                const daysLeft = getDaysRemaining(deadline);
                const colorClass = getColorByDeadline(deadline, report.status);
                const statusBtnColor = getStatusButtonColor(report.status);

                return (
                  <Card key={p.key} className={`relative border-2 ${colorClass}`} data-testid={`period-card-${p.key}`}>
                    <CardContent className="py-6 px-5">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-lg font-bold">{p.label}</h3>
                          <p className="text-xs text-muted-foreground mt-1">
                            Termín: {formatDeadlineSlovak(deadline)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            size="sm"
                            className={`text-xs px-3 py-1 h-7 ${statusBtnColor}`}
                            onClick={() => handleStatusClick(report)}
                            disabled={updateMutation.isPending}
                            data-testid={`btn-status-${p.key}`}
                          >
                            {updateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : getStatusLabel(report.status)}
                          </Button>
                          {report.status !== "sent" && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              daysLeft <= 14 ? "bg-red-600 text-white" : daysLeft <= 30 ? "bg-orange-500 text-white" : "bg-blue-600 text-white"
                            }`} data-testid={`days-left-${p.key}`}>
                              {daysLeft > 0 ? `${daysLeft} dní` : `${Math.abs(daysLeft)} dní po termíne`}
                            </span>
                          )}
                        </div>
                      </div>

                      {report.status === "sent" && report.sentDate && (
                        <p className="text-xs text-green-400">
                          Odoslané: {report.sentDate}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={!!sentDateDialogReport} onOpenChange={(open) => { if (!open) setSentDateDialogReport(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dátum odoslania reportu</DialogTitle>
            <DialogDescription>Zadajte dátum, kedy bol report odoslaný na NBS.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="DD.MM.RRRR"
              value={sentDateInput}
              onChange={e => setSentDateInput(e.target.value)}
              data-testid="input-sent-date"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSentDateDialogReport(null)}>Zrušiť</Button>
            <Button onClick={handleConfirmSentDate} data-testid="btn-confirm-sent">Potvrdiť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmUnsendReport} onOpenChange={(open) => { if (!open) setConfirmUnsendReport(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zrušiť odoslanie?</DialogTitle>
            <DialogDescription>Naozaj chcete prepnúť tento report späť na "Neodoslané"?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmUnsendReport(null)} data-testid="btn-cancel-unsend">Nie</Button>
            <Button variant="destructive" onClick={handleConfirmUnsend} data-testid="btn-confirm-unsend">Áno</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function YearBubble({ year, currentYear, onSelect }: { year: number; currentYear: number; onSelect: (y: number) => void }) {
  const { data: yearReports } = useQuery<NbsReport[]>({
    queryKey: ["/api/nbs-reports", year],
    queryFn: async () => {
      const res = await fetch(`/api/nbs-reports?year=${year}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
  const reports = yearReports || [];
  const colorClass = getYearColor(reports, year);
  const allSent = reports.length === 5 && reports.every(r => r.status === "sent");
  const label = year === currentYear ? "Aktuálny rok" : year === currentYear - 1 ? "Pred 1 rokom" : year === currentYear - 2 ? "Pred 2 rokmi" : "Nasledujúci rok";

  return (
    <Card
      className={`cursor-pointer border-2 transition-all hover:scale-105 ${colorClass}`}
      onClick={() => onSelect(year)}
      data-testid={`year-card-${year}`}
    >
      <CardContent className="py-8 text-center">
        <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
        <span className="text-3xl font-bold">{year}</span>
        {allSent && <p className="text-xs text-green-400 mt-2">Všetky odoslané</p>}
      </CardContent>
    </Card>
  );
}
