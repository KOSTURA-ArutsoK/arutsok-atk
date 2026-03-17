import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronLeft, FileBarChart, Archive, ChevronDown, ChevronUp, FileText, HelpCircle, Save, BarChart3, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePartners } from "@/hooks/use-partners";
import { useAppUser } from "@/hooks/use-app-user";

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

const DEFAULT_REPORT_DATA = {
  newContracts: { life: 0, nonLife: 0, reinsurance: 0 },
  amendments: { life: 0, nonLife: 0 },
  groupContracts: { life: 0, nonLife: 0 },
  takenContracts: { life: 0, nonLife: 0 },
  premiumNew: { life: 0, nonLife: 0, reinsurance: 0 },
  premiumGroup: { life: 0, nonLife: 0 },
  premiumTaken: { life: 0, nonLife: 0 },
  cancelledNotice: { life: 0, nonLife: 0, reinsurance: 0 },
  cancelledNonPayment: { life: 0, nonLife: 0, reinsurance: 0 },
  cancelledWithdrawal: { count: 0 },
  commissionPositive: 0,
  commissionNegative: 0,
  commissionOffsetPositive: 0,
  commissionOffsetNegative: 0,
  pfaByPerformance: { zero: 0, low: 0, high: 0 },
  employeesByPerformance: { zero: 0, low: 0, high: 0 },
};

const NBS_TOOLTIPS: Record<string, string> = {
  newContracts: "Uvádza sa počet poistných zmlúv a návrhov poistných zmlúv, ktoré boli uzavreté alebo klientom podpísané počas príslušného kalendárneho štvrťroka. Dodatkové poistenie k životnému poisteniu sa vykazuje v rámci životného poistenia.",
  amendments: "Uvádza sa počet dodatkov k už existujúcej poistnej zmluve, ktoré boli uzavreté alebo podpísané počas štvrťroka. Za dodatok sa považuje iba taká zmena zmluvy, ktorá má vplyv na poistné krytie alebo rozsah plnenia (napr. zmena adresy sa nepovažuje za dodatok).",
  groupContracts: "Počet poistných zmlúv uzavretých medzi finančnou inštitúciou a poistníkom, ku ktorým majú právo pristupovať ďalšie osoby ako poistené formou prihlášky. Neuvádzajú sa flotilové zmluvy (zmena súboru majetku jednej osoby).",
  takenContracts: "Počet zmlúv, ktoré boli prevedené do správy samostatného finančného agenta od iného agenta alebo finančnej inštitúcie počas príslušného štvrťroka.",
  premiumNew: "Objem poistného za nové zmluvy. Ak sa platí bežne, uvedie sa poistné za 12 mesiacov. Ak trvá kratšie ako rok, ročné poistné je zhodné s celkovým. Pri jednorazovom poistnom sa uvedie celá suma. Zahŕňa sa celá suma vrátane dane z poistenia a odvodu.",
  premiumGroup: "Uvádza sa objem ročného poistného skupinových zmlúv ku koncu príslušného kalendárneho štvrťroka. Zahŕňa celú sumu vrátane daní a odvodov.",
  premiumTaken: "Objem ročného poistného pre zmluvy prevedené od iného agenta alebo inštitúcie počas štvrťroka. Zahŕňa celú sumu vrátane daní a odvodov.",
  cancelledNotice: "Celkový počet zmlúv, u ktorých došlo k zániku poistenia podľa § 800 Občianskeho zákonníka do troch rokov od uzavretia zmluvy.",
  cancelledNonPayment: "Počet zmlúv zrušených nezaplatením poistného do troch mesiacov odo dňa splatnosti poistného podľa § 801 Občianskeho zákonníka.",
  cancelledWithdrawal: "Počet zmlúv zrušených na základe odstúpenia poistníka od poistnej zmluvy podľa § 802a Občianskeho zákonníka.",
  commissionPositive: "Objem všetkých finančných odmien, ktoré boli vyplatené agentovi počas štvrťroka finančnými inštitúciami bez ohľadu na to, ku ktorému obdobiu prislúchajú.",
  commissionNegative: "Objem všetkých finančných odmien, ktoré boli odpísané z účtu agenta a vrátené inštitúciám, na ktoré nárok zanikol alebo nevznikol.",
  commissionOffsetPositive: "Objem finančných odmien, ktoré neboli vykázané v 'kladných tokoch' z dôvodu započítania v rámci záporných finančných tokov.",
  commissionOffsetNegative: "Objem vrátených odmien, ktoré neboli vykázané v 'záporných tokoch' z dôvodu započítania v rámci kladných finančných tokov.",
  pfaByPerformance: "Počty podriadených finančných agentov k poslednému dňu štvrťroka v členení podľa počtu zmlúv, ktoré sprostredkovali.",
  employeesByPerformance: "Počty zamestnancov k poslednému dňu štvrťroka v členení podľa počtu zmlúv, ktoré sprostredkovali.",
};

function NbsTooltip({ tooltipKey }: { tooltipKey: string }) {
  const text = NBS_TOOLTIPS[tooltipKey];
  if (!text) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-help inline-block ml-1" data-testid={`tooltip-${tooltipKey}`} />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm text-xs">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function NumField({ label, value, onChange, testId }: { label: string; value: number; onChange: (v: number) => void; testId?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-muted-foreground font-medium">{label}</label>
      <Input
        type="number"
        min={0}
        value={value || ""}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="h-8 text-sm"
        data-testid={testId}
      />
    </div>
  );
}

function getPartnerCategory(partner: any): "PaZ" | "SDS" {
  const spec = (partner.specialization || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (spec === "dochodok" || spec === "sds") return "SDS";
  return "PaZ";
}

function PartnerReportDialog({ open, onOpenChange, year, period, periodLabel, initialPartnerId }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  period: string;
  periodLabel: string;
  initialPartnerId?: number | null;
}) {
  const { toast } = useToast();
  const { data: partners, isLoading: partnersLoading } = usePartners();
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>({ ...DEFAULT_REPORT_DATA });

  useEffect(() => {
    if (open && initialPartnerId) {
      setSelectedPartnerId(initialPartnerId);
    }
  }, [open, initialPartnerId]);

  const activePartners = (partners || []).filter((p: any) => !p.isDeleted);
  const pazPartners = activePartners.filter((p: any) => getPartnerCategory(p) === "PaZ");
  const sdsPartners = activePartners.filter((p: any) => getPartnerCategory(p) === "SDS");
  const partnerName = activePartners.find((p: any) => p.id === selectedPartnerId)?.name || "";

  const { data: allPeriodReports } = useQuery<any[]>({
    queryKey: ["/api/nbs-partner-reports", "list", year, period],
    queryFn: async () => {
      const r = await fetch(`/api/nbs-partner-reports?year=${year}&period=${period}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: open,
  });
  const savedPartnerIds = new Set((allPeriodReports || []).map((r: any) => r.partnerId));

  const { data: existingReport, isLoading: loadingReport } = useQuery({
    queryKey: ["/api/nbs-partner-reports", selectedPartnerId, year, period],
    queryFn: async () => {
      if (!selectedPartnerId) return null;
      const res = await fetch(`/api/nbs-partner-reports/${selectedPartnerId}?year=${year}&period=${period}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedPartnerId,
  });

  useEffect(() => {
    if (existingReport?.data) {
      setFormData({ ...DEFAULT_REPORT_DATA, ...existingReport.data });
    } else if (selectedPartnerId) {
      setFormData({ ...DEFAULT_REPORT_DATA });
    }
  }, [existingReport, selectedPartnerId]);

  useEffect(() => {
    if (!open) {
      setSelectedPartnerId(null);
      setFormData({ ...DEFAULT_REPORT_DATA });
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPartnerId) throw new Error("Vyberte partnera");
      await apiRequest("PUT", `/api/nbs-partner-reports/${selectedPartnerId}`, { year, period, data: formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nbs-partner-reports"] });
      toast({ title: "Výkaz uložený" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba pri ukladaní", description: err.message, variant: "destructive" });
    },
  });

  function updateNested(section: string, field: string, value: number) {
    setFormData((prev: any) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  }

  function updateFlat(field: string, value: number) {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  }

  function renderPartnerList(groupLabel: string, groupPartners: any[], groupTestId: string) {
    if (groupPartners.length === 0) return null;
    return (
      <div className="space-y-2" data-testid={groupTestId}>
        <h3 className="text-sm font-bold text-muted-foreground">{groupLabel}</h3>
        <div className="space-y-1">
          {groupPartners.map((p: any) => {
            const hasSaved = savedPartnerIds.has(p.id);
            return (
              <div
                key={p.id}
                className={`flex items-center justify-between px-3 py-2 rounded border cursor-pointer transition-all hover:bg-accent ${hasSaved ? "border-green-500/50 bg-green-50 dark:bg-green-950/20" : "border-border"}`}
                onClick={() => setSelectedPartnerId(p.id)}
                data-testid={`partner-row-${p.id}`}
              >
                <span className="text-sm font-medium">{p.name}</span>
                {hasSaved && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-green-600 text-white">Vyplnené</Badge>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderForm() {
    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => setSelectedPartnerId(null)}
          data-testid="btn-back-to-list"
        >
          <ChevronLeft className="w-4 h-4" />
          Späť na zoznam partnerov
        </Button>

        <div className="border rounded-md p-4 space-y-3" data-testid="section-1">
          <h3 className="font-bold text-sm">I. POČET ZMLÚV (ks)</h3>
          <div>
            <p className="text-xs font-medium mb-2">Nové zmluvy <NbsTooltip tooltipKey="newContracts" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Životné" value={formData.newContracts.life} onChange={v => updateNested("newContracts", "life", v)} testId="input-new-life" />
              <NumField label="Neživotné" value={formData.newContracts.nonLife} onChange={v => updateNested("newContracts", "nonLife", v)} testId="input-new-nonlife" />
              <NumField label="Zaistenie" value={formData.newContracts.reinsurance} onChange={v => updateNested("newContracts", "reinsurance", v)} testId="input-new-reinsurance" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Dodatky k zmluvám <NbsTooltip tooltipKey="amendments" /></p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Životné" value={formData.amendments.life} onChange={v => updateNested("amendments", "life", v)} testId="input-amend-life" />
              <NumField label="Neživotné" value={formData.amendments.nonLife} onChange={v => updateNested("amendments", "nonLife", v)} testId="input-amend-nonlife" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Skupinové zmluvy <NbsTooltip tooltipKey="groupContracts" /></p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Životné" value={formData.groupContracts.life} onChange={v => updateNested("groupContracts", "life", v)} testId="input-group-life" />
              <NumField label="Neživotné" value={formData.groupContracts.nonLife} onChange={v => updateNested("groupContracts", "nonLife", v)} testId="input-group-nonlife" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Prevzaté zmluvy <NbsTooltip tooltipKey="takenContracts" /></p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Životné" value={formData.takenContracts.life} onChange={v => updateNested("takenContracts", "life", v)} testId="input-taken-life" />
              <NumField label="Neživotné" value={formData.takenContracts.nonLife} onChange={v => updateNested("takenContracts", "nonLife", v)} testId="input-taken-nonlife" />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-4 space-y-3" data-testid="section-2">
          <h3 className="font-bold text-sm">II. OBJEM ROČNÉHO POISTNÉHO (v EUR s daňou/odvodom)</h3>
          <div>
            <p className="text-xs font-medium mb-2">Nové zmluvy <NbsTooltip tooltipKey="premiumNew" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Životné" value={formData.premiumNew.life} onChange={v => updateNested("premiumNew", "life", v)} testId="input-prem-new-life" />
              <NumField label="Neživotné" value={formData.premiumNew.nonLife} onChange={v => updateNested("premiumNew", "nonLife", v)} testId="input-prem-new-nonlife" />
              <NumField label="Zaistenie" value={formData.premiumNew.reinsurance} onChange={v => updateNested("premiumNew", "reinsurance", v)} testId="input-prem-new-reinsurance" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Skupinové zmluvy <NbsTooltip tooltipKey="premiumGroup" /></p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Životné" value={formData.premiumGroup.life} onChange={v => updateNested("premiumGroup", "life", v)} testId="input-prem-group-life" />
              <NumField label="Neživotné" value={formData.premiumGroup.nonLife} onChange={v => updateNested("premiumGroup", "nonLife", v)} testId="input-prem-group-nonlife" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Prevzaté zmluvy <NbsTooltip tooltipKey="premiumTaken" /></p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Životné" value={formData.premiumTaken.life} onChange={v => updateNested("premiumTaken", "life", v)} testId="input-prem-taken-life" />
              <NumField label="Neživotné" value={formData.premiumTaken.nonLife} onChange={v => updateNested("premiumTaken", "nonLife", v)} testId="input-prem-taken-nonlife" />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-4 space-y-3" data-testid="section-3">
          <h3 className="font-bold text-sm">III. ZRUŠENÉ ZMLUVY (ks)</h3>
          <div>
            <p className="text-xs font-medium mb-2">Výpoveďou do 3 rokov (§ 800) <NbsTooltip tooltipKey="cancelledNotice" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Životné" value={formData.cancelledNotice.life} onChange={v => updateNested("cancelledNotice", "life", v)} testId="input-cancel-notice-life" />
              <NumField label="Neživotné" value={formData.cancelledNotice.nonLife} onChange={v => updateNested("cancelledNotice", "nonLife", v)} testId="input-cancel-notice-nonlife" />
              <NumField label="Zaistenie" value={formData.cancelledNotice.reinsurance} onChange={v => updateNested("cancelledNotice", "reinsurance", v)} testId="input-cancel-notice-reinsurance" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Nezaplatením do 3 mesiacov (§ 801) <NbsTooltip tooltipKey="cancelledNonPayment" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Životné" value={formData.cancelledNonPayment.life} onChange={v => updateNested("cancelledNonPayment", "life", v)} testId="input-cancel-nonpay-life" />
              <NumField label="Neživotné" value={formData.cancelledNonPayment.nonLife} onChange={v => updateNested("cancelledNonPayment", "nonLife", v)} testId="input-cancel-nonpay-nonlife" />
              <NumField label="Zaistenie" value={formData.cancelledNonPayment.reinsurance} onChange={v => updateNested("cancelledNonPayment", "reinsurance", v)} testId="input-cancel-nonpay-reinsurance" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Odstúpením do 30 dní (§ 802a) <NbsTooltip tooltipKey="cancelledWithdrawal" /></p>
            <div className="grid grid-cols-1 gap-3 max-w-xs">
              <NumField label="Počet" value={formData.cancelledWithdrawal.count} onChange={v => updateNested("cancelledWithdrawal", "count", v)} testId="input-cancel-withdrawal" />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-4 space-y-3" data-testid="section-4">
          <h3 className="font-bold text-sm">IV. FINANČNÉ TOKY - PROVÍZIE (v EUR)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium mb-2">Kladné finančné toky <NbsTooltip tooltipKey="commissionPositive" /></p>
              <NumField label="Suma" value={formData.commissionPositive} onChange={v => updateFlat("commissionPositive", v)} testId="input-comm-positive" />
            </div>
            <div>
              <p className="text-xs font-medium mb-2">Záporné finančné toky <NbsTooltip tooltipKey="commissionNegative" /></p>
              <NumField label="Suma" value={formData.commissionNegative} onChange={v => updateFlat("commissionNegative", v)} testId="input-comm-negative" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium mb-2">Započítané KLADNÉ toky <NbsTooltip tooltipKey="commissionOffsetPositive" /></p>
              <NumField label="Suma" value={formData.commissionOffsetPositive} onChange={v => updateFlat("commissionOffsetPositive", v)} testId="input-comm-offset-pos" />
            </div>
            <div>
              <p className="text-xs font-medium mb-2">Započítané ZÁPORNÉ toky <NbsTooltip tooltipKey="commissionOffsetNegative" /></p>
              <NumField label="Suma" value={formData.commissionOffsetNegative} onChange={v => updateFlat("commissionOffsetNegative", v)} testId="input-comm-offset-neg" />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-4 space-y-3" data-testid="section-5">
          <h3 className="font-bold text-sm">V. PERSONÁLNE ČLENENIE (k poslednému dňu štvrťroka)</h3>
          <div>
            <p className="text-xs font-medium mb-2">Počet PFA podľa výkonu <NbsTooltip tooltipKey="pfaByPerformance" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="0 zmlúv" value={formData.pfaByPerformance.zero} onChange={v => updateNested("pfaByPerformance", "zero", v)} testId="input-pfa-zero" />
              <NumField label="1-10 zmlúv" value={formData.pfaByPerformance.low} onChange={v => updateNested("pfaByPerformance", "low", v)} testId="input-pfa-low" />
              <NumField label="11 a viac" value={formData.pfaByPerformance.high} onChange={v => updateNested("pfaByPerformance", "high", v)} testId="input-pfa-high" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Počet zamestnancov podľa výkonu <NbsTooltip tooltipKey="employeesByPerformance" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="0 zmlúv" value={formData.employeesByPerformance.zero} onChange={v => updateNested("employeesByPerformance", "zero", v)} testId="input-emp-zero" />
              <NumField label="1-10 zmlúv" value={formData.employeesByPerformance.low} onChange={v => updateNested("employeesByPerformance", "low", v)} testId="input-emp-low" />
              <NumField label="11 a viac" value={formData.employeesByPerformance.high} onChange={v => updateNested("employeesByPerformance", "high", v)} testId="input-emp-high" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" data-testid="dialog-partner-report">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Výkaz partnerov — {periodLabel} {year}
          </DialogTitle>
          <DialogDescription>
            {selectedPartnerId ? `Partner: ${partnerName}` : "Vyberte partnera zo zoznamu"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!selectedPartnerId ? (
            <div className="space-y-4">
              {partnersLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {renderPartnerList("PaZ — Poistenie a zaistenie", pazPartners, "group-paz")}
                  {renderPartnerList("SDS — Starobné dôchodkové sporenie", sdsPartners, "group-sds")}
                  {pazPartners.length === 0 && sdsPartners.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">Žiadni aktívni partneri</p>
                  )}
                </>
              )}
            </div>
          ) : loadingReport ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            renderForm()
          )}
        </div>

        <DialogFooter>
          {!selectedPartnerId ? (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Zatvoriť</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setSelectedPartnerId(null)}>Späť</Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="btn-save-partner-report"
              >
                {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Uložiť
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
  const [partnerReportOpen, setPartnerReportOpen] = useState(false);
  const [partnerReportPeriod, setPartnerReportPeriod] = useState<{ key: string; label: string }>({ key: "", label: "" });
  const [partnerReportInitialId, setPartnerReportInitialId] = useState<number | null>(null);
  const [expandedPeriod, setExpandedPeriod] = useState<string | null>(null);

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
              className="cursor-pointer border-2 border-yellow-600 bg-yellow-100 dark:bg-yellow-950/30 transition-all hover:scale-105 h-full"
              onClick={() => setArchiveOpen(!archiveOpen)}
              data-testid="btn-archive"
            >
              <CardContent className="py-5 text-center flex flex-col items-center">
                <Archive className="w-8 h-8 mb-2 text-yellow-600 dark:text-yellow-500" />
                <span className="text-xl font-bold text-yellow-700 dark:text-yellow-400">ARCHÍV</span>
                <div className="mt-1">
                  {archiveOpen ? <ChevronUp className="w-4 h-4 text-yellow-500" /> : <ChevronDown className="w-4 h-4 text-yellow-500" />}
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
            <div className="space-y-3">
              {PERIODS.map(p => {
                const report = reportMap.get(p.key);
                if (!report) return null;
                const isExpanded = expandedPeriod === p.key;

                return (
                  <PeriodBubble
                    key={p.key}
                    period={p}
                    report={report}
                    year={selectedYear}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedPeriod(isExpanded ? null : p.key)}
                    onStatusClick={() => handleStatusClick(report)}
                    statusPending={updateMutation.isPending}
                    onOpenPartnerForm={(partnerId) => {
                      setPartnerReportPeriod({ key: p.key, label: p.label });
                      setPartnerReportInitialId(partnerId);
                      setPartnerReportOpen(true);
                    }}
                  />
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

      {selectedYear && (
        <PartnerReportDialog
          open={partnerReportOpen}
          onOpenChange={(o) => { setPartnerReportOpen(o); if (!o) setPartnerReportInitialId(null); }}
          year={selectedYear}
          period={partnerReportPeriod.key}
          periodLabel={partnerReportPeriod.label}
          initialPartnerId={partnerReportInitialId}
        />
      )}

      <NbsAnalyticsChart />
    </div>
  );
}

function PeriodBubble({ period, report, year, isExpanded, onToggle, onStatusClick, statusPending, onOpenPartnerForm }: {
  period: { key: string; label: string };
  report: NbsReport;
  year: number;
  isExpanded: boolean;
  onToggle: () => void;
  onStatusClick: () => void;
  statusPending: boolean;
  onOpenPartnerForm: (partnerId: number) => void;
}) {
  const { data: partners, isLoading: partnersLoading } = usePartners();
  const activePartners = (partners || []).filter((p: any) => !p.isDeleted);
  const pazPartners = activePartners.filter((p: any) => getPartnerCategory(p) === "PaZ");
  const sdsPartners = activePartners.filter((p: any) => getPartnerCategory(p) === "SDS");

  const { data: periodReports } = useQuery<any[]>({
    queryKey: ["/api/nbs-partner-reports", "list", year, period.key],
    queryFn: async () => {
      const r = await fetch(`/api/nbs-partner-reports?year=${year}&period=${period.key}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: isExpanded,
  });
  const savedPartnerIds = new Set((periodReports || []).map((r: any) => r.partnerId));
  const savedCount = savedPartnerIds.size;

  const { data: totalsData } = useQuery<{ totals: any; partnerCount: number }>({
    queryKey: ["/api/nbs-partner-reports", "totals", year, period.key],
    queryFn: async () => {
      const r = await fetch(`/api/nbs-partner-reports/totals?year=${year}&period=${period.key}`, { credentials: "include" });
      return r.ok ? r.json() : { totals: null, partnerCount: 0 };
    },
    enabled: isExpanded,
  });

  const deadline = getDeadline(period.key, year);
  const daysLeft = getDaysRemaining(deadline);
  const colorClass = getColorByDeadline(deadline, report.status);
  const statusBtnColor = getStatusButtonColor(report.status);

  function renderPartnerGroup(label: string, groupPartners: any[], testId: string) {
    if (groupPartners.length === 0) return null;
    return (
      <div className="space-y-1" data-testid={testId}>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        {groupPartners.map((p: any) => {
          const hasSaved = savedPartnerIds.has(p.id);
          return (
            <div
              key={p.id}
              className={`flex items-center justify-between px-3 py-1.5 rounded border cursor-pointer transition-all hover:bg-accent ${hasSaved ? "border-green-500/50 bg-green-50 dark:bg-green-950/20" : "border-border"}`}
              onClick={(e) => { e.stopPropagation(); onOpenPartnerForm(p.id); }}
              data-testid={`period-partner-${period.key}-${p.id}`}
            >
              <span className="text-xs font-medium">{p.name}</span>
              {hasSaved && (
                <Badge variant="secondary" className="text-[8px] px-1 h-3.5 bg-green-600 text-white">Vyplnené</Badge>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function TotalVal({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[9px] text-muted-foreground">{label}</span>
        <span className="text-xs font-bold">{suffix ? `${value.toLocaleString("sk-SK")} ${suffix}` : value.toLocaleString("sk-SK")}</span>
      </div>
    );
  }

  function renderTotals() {
    if (!totalsData?.totals || totalsData.partnerCount === 0) return null;
    const t = totalsData.totals;

    return (
      <div className="border-t border-dashed pt-3 mt-3 space-y-3" data-testid={`totals-${period.key}`}>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Celkom pre NBS ({totalsData.partnerCount} výkazov)</p>

        <div className="border rounded p-3 space-y-2 bg-muted/30">
          <p className="text-[10px] font-bold">I. POČET ZMLÚV (ks)</p>
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted-foreground">Nové zmluvy</p>
            <div className="grid grid-cols-3 gap-2">
              <TotalVal label="Životné" value={t.newContracts?.life || 0} />
              <TotalVal label="Neživotné" value={t.newContracts?.nonLife || 0} />
              <TotalVal label="Zaistenie" value={t.newContracts?.reinsurance || 0} />
            </div>
            <p className="text-[9px] text-muted-foreground">Dodatky k zmluvám</p>
            <div className="grid grid-cols-2 gap-2">
              <TotalVal label="Životné" value={t.amendments?.life || 0} />
              <TotalVal label="Neživotné" value={t.amendments?.nonLife || 0} />
            </div>
            <p className="text-[9px] text-muted-foreground">Skupinové zmluvy</p>
            <div className="grid grid-cols-2 gap-2">
              <TotalVal label="Životné" value={t.groupContracts?.life || 0} />
              <TotalVal label="Neživotné" value={t.groupContracts?.nonLife || 0} />
            </div>
            <p className="text-[9px] text-muted-foreground">Prevzaté zmluvy</p>
            <div className="grid grid-cols-2 gap-2">
              <TotalVal label="Životné" value={t.takenContracts?.life || 0} />
              <TotalVal label="Neživotné" value={t.takenContracts?.nonLife || 0} />
            </div>
          </div>
        </div>

        <div className="border rounded p-3 space-y-2 bg-muted/30">
          <p className="text-[10px] font-bold">II. OBJEM ROČNÉHO POISTNÉHO (EUR s daňou/odvodom)</p>
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted-foreground">Nové zmluvy</p>
            <div className="grid grid-cols-3 gap-2">
              <TotalVal label="Životné" value={t.premiumNew?.life || 0} suffix="€" />
              <TotalVal label="Neživotné" value={t.premiumNew?.nonLife || 0} suffix="€" />
              <TotalVal label="Zaistenie" value={t.premiumNew?.reinsurance || 0} suffix="€" />
            </div>
            <p className="text-[9px] text-muted-foreground">Skupinové zmluvy</p>
            <div className="grid grid-cols-2 gap-2">
              <TotalVal label="Životné" value={t.premiumGroup?.life || 0} suffix="€" />
              <TotalVal label="Neživotné" value={t.premiumGroup?.nonLife || 0} suffix="€" />
            </div>
            <p className="text-[9px] text-muted-foreground">Prevzaté zmluvy</p>
            <div className="grid grid-cols-2 gap-2">
              <TotalVal label="Životné" value={t.premiumTaken?.life || 0} suffix="€" />
              <TotalVal label="Neživotné" value={t.premiumTaken?.nonLife || 0} suffix="€" />
            </div>
          </div>
        </div>

        <div className="border rounded p-3 space-y-2 bg-muted/30">
          <p className="text-[10px] font-bold">III. ZRUŠENÉ ZMLUVY (ks)</p>
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted-foreground">Výpoveďou do 3 rokov (§ 800)</p>
            <div className="grid grid-cols-3 gap-2">
              <TotalVal label="Životné" value={t.cancelledNotice?.life || 0} />
              <TotalVal label="Neživotné" value={t.cancelledNotice?.nonLife || 0} />
              <TotalVal label="Zaistenie" value={t.cancelledNotice?.reinsurance || 0} />
            </div>
            <p className="text-[9px] text-muted-foreground">Nezaplatením do 3 mesiacov (§ 801)</p>
            <div className="grid grid-cols-3 gap-2">
              <TotalVal label="Životné" value={t.cancelledNonPayment?.life || 0} />
              <TotalVal label="Neživotné" value={t.cancelledNonPayment?.nonLife || 0} />
              <TotalVal label="Zaistenie" value={t.cancelledNonPayment?.reinsurance || 0} />
            </div>
            <p className="text-[9px] text-muted-foreground">Odstúpením do 30 dní (§ 802a)</p>
            <div className="grid grid-cols-1 gap-2 max-w-[120px]">
              <TotalVal label="Počet" value={t.cancelledWithdrawal?.count || 0} />
            </div>
          </div>
        </div>

        <div className="border rounded p-3 space-y-2 bg-muted/30">
          <p className="text-[10px] font-bold">IV. FINANČNÉ TOKY — PROVÍZIE (EUR)</p>
          <div className="grid grid-cols-2 gap-2">
            <TotalVal label="Kladné finančné toky" value={t.commissionPositive || 0} suffix="€" />
            <TotalVal label="Záporné finančné toky" value={t.commissionNegative || 0} suffix="€" />
            <TotalVal label="Započítané KLADNÉ" value={t.commissionOffsetPositive || 0} suffix="€" />
            <TotalVal label="Započítané ZÁPORNÉ" value={t.commissionOffsetNegative || 0} suffix="€" />
          </div>
        </div>

        <div className="border rounded p-3 space-y-2 bg-muted/30">
          <p className="text-[10px] font-bold">V. PERSONÁLNE ČLENENIE</p>
          <div className="space-y-1.5">
            <p className="text-[9px] text-muted-foreground">Počet PFA podľa výkonu</p>
            <div className="grid grid-cols-3 gap-2">
              <TotalVal label="0 zmlúv" value={t.pfaByPerformance?.zero || 0} />
              <TotalVal label="1-10 zmlúv" value={t.pfaByPerformance?.low || 0} />
              <TotalVal label="11 a viac" value={t.pfaByPerformance?.high || 0} />
            </div>
            <p className="text-[9px] text-muted-foreground">Počet zamestnancov podľa výkonu</p>
            <div className="grid grid-cols-3 gap-2">
              <TotalVal label="0 zmlúv" value={t.employeesByPerformance?.zero || 0} />
              <TotalVal label="1-10 zmlúv" value={t.employeesByPerformance?.low || 0} />
              <TotalVal label="11 a viac" value={t.employeesByPerformance?.high || 0} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={`border-2 transition-all ${colorClass}`} data-testid={`period-card-${period.key}`}>
      <CardContent className="py-0 px-0">
        <div
          className="flex items-center justify-between px-5 py-3 cursor-pointer"
          onClick={onToggle}
          data-testid={`period-toggle-${period.key}`}
        >
          <div className="flex items-center gap-3">
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            <div>
              <h3 className="text-base font-bold">{period.label}</h3>
              <p className="text-[10px] text-muted-foreground">
                Termín: {formatDeadlineSlovak(deadline)}
                {report.status === "sent" && report.sentDate && ` · Odoslané: ${report.sentDate}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {savedCount > 0 && (
              <Badge variant="secondary" className="text-[9px] px-1.5 h-4 bg-green-600 text-white">{savedCount} výkazov</Badge>
            )}
            {report.status !== "sent" && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                daysLeft <= 14 ? "bg-red-600 text-white" : daysLeft <= 30 ? "bg-orange-500 text-white" : "bg-blue-600 text-white"
              }`} data-testid={`days-left-${period.key}`}>
                {daysLeft > 0 ? `${daysLeft} dní` : `${Math.abs(daysLeft)} dní po termíne`}
              </span>
            )}
            <Button
              size="sm"
              className={`text-xs px-3 py-1 h-7 ${statusBtnColor}`}
              onClick={(e) => { e.stopPropagation(); onStatusClick(); }}
              disabled={statusPending}
              data-testid={`btn-status-${period.key}`}
            >
              {statusPending ? <Loader2 className="w-3 h-3 animate-spin" /> : getStatusLabel(report.status)}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="px-5 pb-4 pt-1 border-t space-y-3">
            {partnersLoading ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {renderPartnerGroup("PaZ — Poistenie a zaistenie", pazPartners, `period-group-paz-${period.key}`)}
                {renderPartnerGroup("SDS — Starobné dôchodkové sporenie", sdsPartners, `period-group-sds-${period.key}`)}
                {pazPartners.length === 0 && sdsPartners.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">Žiadni aktívni partneri</p>
                )}
                {renderTotals()}
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const NBS_CHART_PARAMS: { key: string; label: string; section: string; path: string }[] = [
  { key: "newContracts_life", label: "Nové zmluvy — Životné", section: "I", path: "newContracts.life" },
  { key: "newContracts_nonLife", label: "Nové zmluvy — Neživotné", section: "I", path: "newContracts.nonLife" },
  { key: "newContracts_reinsurance", label: "Nové zmluvy — Zaistenie", section: "I", path: "newContracts.reinsurance" },
  { key: "amendments_life", label: "Dodatky — Životné", section: "I", path: "amendments.life" },
  { key: "amendments_nonLife", label: "Dodatky — Neživotné", section: "I", path: "amendments.nonLife" },
  { key: "groupContracts_life", label: "Skupinové — Životné", section: "I", path: "groupContracts.life" },
  { key: "groupContracts_nonLife", label: "Skupinové — Neživotné", section: "I", path: "groupContracts.nonLife" },
  { key: "takenContracts_life", label: "Prevzaté — Životné", section: "I", path: "takenContracts.life" },
  { key: "takenContracts_nonLife", label: "Prevzaté — Neživotné", section: "I", path: "takenContracts.nonLife" },
  { key: "premiumNew_life", label: "Poistné nové — Životné (€)", section: "II", path: "premiumNew.life" },
  { key: "premiumNew_nonLife", label: "Poistné nové — Neživotné (€)", section: "II", path: "premiumNew.nonLife" },
  { key: "premiumNew_reinsurance", label: "Poistné nové — Zaistenie (€)", section: "II", path: "premiumNew.reinsurance" },
  { key: "premiumGroup_life", label: "Poistné skupinové — Životné (€)", section: "II", path: "premiumGroup.life" },
  { key: "premiumGroup_nonLife", label: "Poistné skupinové — Neživotné (€)", section: "II", path: "premiumGroup.nonLife" },
  { key: "premiumTaken_life", label: "Poistné prevzaté — Životné (€)", section: "II", path: "premiumTaken.life" },
  { key: "premiumTaken_nonLife", label: "Poistné prevzaté — Neživotné (€)", section: "II", path: "premiumTaken.nonLife" },
  { key: "cancelledNotice_life", label: "Zrušené §800 — Životné", section: "III", path: "cancelledNotice.life" },
  { key: "cancelledNotice_nonLife", label: "Zrušené §800 — Neživotné", section: "III", path: "cancelledNotice.nonLife" },
  { key: "cancelledNotice_reinsurance", label: "Zrušené §800 — Zaistenie", section: "III", path: "cancelledNotice.reinsurance" },
  { key: "cancelledNonPayment_life", label: "Nezaplatené §801 — Životné", section: "III", path: "cancelledNonPayment.life" },
  { key: "cancelledNonPayment_nonLife", label: "Nezaplatené §801 — Neživotné", section: "III", path: "cancelledNonPayment.nonLife" },
  { key: "cancelledNonPayment_reinsurance", label: "Nezaplatené §801 — Zaistenie", section: "III", path: "cancelledNonPayment.reinsurance" },
  { key: "cancelledWithdrawal_count", label: "Odstúpenie §802a", section: "III", path: "cancelledWithdrawal.count" },
  { key: "commissionPositive", label: "Kladné finančné toky (€)", section: "IV", path: "commissionPositive" },
  { key: "commissionNegative", label: "Záporné finančné toky (€)", section: "IV", path: "commissionNegative" },
  { key: "commissionOffsetPositive", label: "Započítané kladné (€)", section: "IV", path: "commissionOffsetPositive" },
  { key: "commissionOffsetNegative", label: "Započítané záporné (€)", section: "IV", path: "commissionOffsetNegative" },
  { key: "pfaByPerformance_zero", label: "PFA — 0 zmlúv", section: "V", path: "pfaByPerformance.zero" },
  { key: "pfaByPerformance_low", label: "PFA — 1-10 zmlúv", section: "V", path: "pfaByPerformance.low" },
  { key: "pfaByPerformance_high", label: "PFA — 11+ zmlúv", section: "V", path: "pfaByPerformance.high" },
  { key: "employeesByPerformance_zero", label: "Zamestnanci — 0 zmlúv", section: "V", path: "employeesByPerformance.zero" },
  { key: "employeesByPerformance_low", label: "Zamestnanci — 1-10 zmlúv", section: "V", path: "employeesByPerformance.low" },
  { key: "employeesByPerformance_high", label: "Zamestnanci — 11+ zmlúv", section: "V", path: "employeesByPerformance.high" },
];

const CHART_COLORS = [
  "#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316",
  "#14b8a6", "#a855f7", "#6366f1", "#d946ef", "#84cc16", "#eab308", "#0ea5e9", "#e11d48",
];

const SECTION_LABELS: Record<string, string> = {
  "I": "I. Počet zmlúv",
  "II": "II. Objem poistného",
  "III": "III. Zrušené zmluvy",
  "IV": "IV. Finančné toky",
  "V": "V. Personálne",
};

const PERIOD_LABELS: Record<string, string> = {
  "1q": "1Q", "2q": "2Q", "3q": "3Q", "4q": "4Q", "annual": "Ročný",
};

function getValueFromPath(obj: any, path: string): number {
  const parts = path.split(".");
  let val = obj;
  for (const p of parts) {
    val = val?.[p];
  }
  return Number(val) || 0;
}

function NbsAnalyticsChart() {
  const currentYear = new Date().getFullYear();
  const YEAR_WINDOW = 5;
  const { data: appUser } = useAppUser();
  const companyId = (appUser as any)?.activeCompanyId || null;
  const divisionId = (appUser as any)?.activeDivisionId || null;
  const { data: yearBounds } = useQuery<{ minYear: number }>({
    queryKey: ["/api/nbs-chart-year-bounds", companyId, divisionId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (companyId) params.set("companyId", String(companyId));
      if (divisionId) params.set("divisionId", String(divisionId));
      const res = await fetch(`/api/nbs-chart-year-bounds?${params}`, { credentials: "include" });
      if (!res.ok) return { minYear: 2000 };
      return res.json();
    },
  });
  const MIN_YEAR = yearBounds?.minYear || 2000;
  const maxOffset = Math.max(0, currentYear - MIN_YEAR - YEAR_WINDOW + 1);
  const [yearOffset, setYearOffset] = useState(0);
  useEffect(() => {
    if (yearOffset > maxOffset) setYearOffset(maxOffset);
  }, [maxOffset, yearOffset]);
  useEffect(() => {
    setSelectedYears(prev => prev.filter(y => y >= MIN_YEAR));
  }, [MIN_YEAR]);
  const availableYears = Array.from({ length: YEAR_WINDOW }, (_, i) => currentYear - yearOffset - i).filter(y => y >= MIN_YEAR);
  const availablePeriods = [
    { key: "1q", label: "1Q" }, { key: "2q", label: "2Q" }, { key: "3q", label: "3Q" },
    { key: "4q", label: "4Q" }, { key: "annual", label: "Ročný" },
  ];

  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear]);
  const [selectedPeriods, setSelectedPeriods] = useState<string[]>(["1q", "2q", "3q", "4q"]);
  const [selectedParams, setSelectedParams] = useState<string[]>(["newContracts_life", "newContracts_nonLife"]);
  const [chartOpen, setChartOpen] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const periodOrder = ["1q", "2q", "3q", "4q", "annual"];
  const yearsStr = [...selectedYears].sort().join(",");
  const periodsStr = [...selectedPeriods].sort((a, b) => periodOrder.indexOf(a) - periodOrder.indexOf(b)).join(",");

  const { data: chartData, isLoading } = useQuery<any[]>({
    queryKey: ["/api/nbs-partner-reports/chart-data", yearsStr, periodsStr],
    queryFn: async () => {
      const res = await fetch(`/api/nbs-partner-reports/chart-data?years=${yearsStr}&periods=${periodsStr}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: chartOpen && selectedYears.length > 0 && selectedPeriods.length > 0,
  });

  function toggleYear(y: number) {
    setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]);
  }
  function togglePeriod(p: string) {
    setSelectedPeriods(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  }
  function toggleParam(k: string) {
    setSelectedParams(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
  }

  const barData = (chartData || []).map(item => {
    const label = `${PERIOD_LABELS[item.period] || item.period} ${item.year}`;
    const row: any = { name: label };
    for (const pk of selectedParams) {
      const param = NBS_CHART_PARAMS.find(p => p.key === pk);
      if (param) {
        row[pk] = getValueFromPath(item.totals, param.path);
      }
    }
    return row;
  });

  const sections = Object.entries(SECTION_LABELS);

  return (
    <Card className="border-2 border-blue-600/30" data-testid="nbs-analytics-chart">
      <CardContent className="py-4 space-y-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setChartOpen(!chartOpen)}
          data-testid="toggle-nbs-chart"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-500" />
            <h3 className="text-base font-bold">Analytika NBS</h3>
          </div>
          {chartOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>

        {chartOpen && (
          <div className="space-y-4 pt-2 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Roky</p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setYearOffset(prev => Math.max(0, prev - 1))}
                    disabled={yearOffset === 0}
                    className="text-xs px-1.5 py-1 rounded border bg-muted/50 text-muted-foreground border-border hover:bg-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    data-testid="chart-years-newer"
                  >
                    ◀
                  </button>
                  {availableYears.map(y => (
                    <button
                      key={y}
                      type="button"
                      onClick={() => toggleYear(y)}
                      className={`text-xs px-2.5 py-1 rounded border transition-all ${
                        selectedYears.includes(y) ? "bg-blue-600 text-white border-blue-600" : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      }`}
                      data-testid={`chart-year-${y}`}
                    >
                      {y}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setYearOffset(prev => Math.min(maxOffset, prev + 1))}
                    disabled={yearOffset >= maxOffset}
                    className="text-xs px-1.5 py-1 rounded border bg-muted/50 text-muted-foreground border-border hover:bg-muted transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    data-testid="chart-years-older"
                  >
                    ▶
                  </button>
                </div>
                {selectedYears.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {[...selectedYears].sort((a, b) => b - a).map(y => (
                      <span
                        key={y}
                        className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white"
                      >
                        {y}
                        <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => setSelectedYears(prev => prev.filter(x => x !== y))} />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Obdobia</p>
                <div className="flex flex-wrap gap-1">
                  {availablePeriods.map(p => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => togglePeriod(p.key)}
                      className={`text-xs px-2.5 py-1 rounded border transition-all ${
                        selectedPeriods.includes(p.key) ? "bg-blue-600 text-white border-blue-600" : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                      }`}
                      data-testid={`chart-period-${p.key}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border rounded bg-muted/20">
              <div
                className="flex items-center justify-between px-3 py-2 cursor-pointer"
                onClick={() => setParamsOpen(!paramsOpen)}
                data-testid="toggle-params-panel"
              >
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Výber parametrov</p>
                {paramsOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </div>
              {paramsOpen && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {sections.map(([sKey, sLabel]) => {
                      const sectionParams = NBS_CHART_PARAMS.filter(p => p.section === sKey);
                      const activeCount = sectionParams.filter(p => selectedParams.includes(p.key)).length;
                      return (
                        <button
                          key={sKey}
                          type="button"
                          onClick={() => setOpenSection(openSection === sKey ? null : sKey)}
                          className={`text-[9px] px-2.5 py-1 rounded border transition-all flex items-center gap-1 ${
                            openSection === sKey
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                          }`}
                          data-testid={`chart-section-${sKey}`}
                        >
                          {sLabel}
                          {activeCount > 0 && (
                            <span className={`text-[8px] px-1 rounded-full ${openSection === sKey ? "bg-white/30" : "bg-blue-600 text-white"}`}>
                              {activeCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {openSection && (
                    <div className="flex flex-wrap gap-1 pt-1 border-t">
                      {NBS_CHART_PARAMS.filter(p => p.section === openSection).map(p => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => toggleParam(p.key)}
                          className={`text-[9px] px-2 py-0.5 rounded border transition-all ${
                            selectedParams.includes(p.key)
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                          }`}
                          data-testid={`chart-param-${p.key}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {selectedParams.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Vybrané parametre ({selectedParams.length})
                </p>
                <div className="flex flex-wrap gap-1 justify-between">
                  {selectedParams.map((pk, i) => {
                    const param = NBS_CHART_PARAMS.find(p => p.key === pk);
                    return (
                      <span
                        key={pk}
                        className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full text-white flex-grow text-center justify-center"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      >
                        {param?.label || pk}
                        <X className="w-2.5 h-2.5 cursor-pointer" onClick={() => toggleParam(pk)} />
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : barData.length > 0 && selectedParams.length > 0 ? (
              <div className="w-full" style={{ height: Math.max(300, 40 * barData.length) }} data-testid="nbs-chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <RechartsTooltip
                      contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6 }}
                      labelStyle={{ fontWeight: "bold", marginBottom: 4 }}
                      formatter={(value: number, name: string) => {
                        const param = NBS_CHART_PARAMS.find(p => p.key === name);
                        return [value.toLocaleString("sk-SK"), param?.label || name];
                      }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 10 }}
                      formatter={(value: string) => {
                        const param = NBS_CHART_PARAMS.find(p => p.key === value);
                        return param?.label || value;
                      }}
                    />
                    {selectedParams.map((pk, i) => (
                      <Bar key={pk} dataKey={pk} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[2, 2, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm" data-testid="nbs-chart-empty">
                {selectedParams.length === 0 ? "Vyberte aspoň jeden parameter" : selectedYears.length === 0 ? "Vyberte aspoň jeden rok" : "Žiadne dáta pre vybrané obdobie"}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const MINI_PERIODS = [
  { key: "1q", label: "1Q" },
  { key: "2q", label: "2Q" },
  { key: "3q", label: "3Q" },
  { key: "4q", label: "4Q" },
  { key: "annual", label: "R" },
];

function getMiniStatusColor(status: string): string {
  switch (status) {
    case "sent": return "bg-green-600 text-white border-green-600";
    case "checked": return "bg-orange-500 text-white border-orange-500";
    default: return "bg-muted text-muted-foreground border-border";
  }
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
  const reportMap = new Map(reports.map(r => [r.period, r]));
  const colorClass = getYearColor(reports, year);
  const label = year === currentYear ? "Aktuálny rok" : year === currentYear - 1 ? "Pred 1 rokom" : year === currentYear - 2 ? "Pred 2 rokmi" : "Nasledujúci rok";

  return (
    <Card
      className={`cursor-pointer border-2 transition-all hover:scale-105 h-full ${colorClass}`}
      onClick={() => onSelect(year)}
      data-testid={`year-card-${year}`}
    >
      <CardContent className="py-5 text-center flex flex-col items-center">
        <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
        <span className="text-3xl font-bold">{year}</span>
        <div className="flex gap-1 mt-3" onClick={e => e.stopPropagation()}>
          {MINI_PERIODS.map(p => {
            const report = reportMap.get(p.key);
            const status = report?.status || "not_sent";
            return (
              <span
                key={p.key}
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border cursor-pointer ${getMiniStatusColor(status)}`}
                onClick={() => onSelect(year)}
                data-testid={`mini-${p.key}-${year}`}
                title={`${p.label}: ${status === "sent" ? "Odoslané" : status === "checked" ? "Skontrolované" : "Neodoslané"}`}
              >
                {p.label}
              </span>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
