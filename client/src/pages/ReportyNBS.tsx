import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronLeft, FileBarChart, Archive, ChevronDown, ChevronUp, FileText, HelpCircle, Save, BarChart3, X, Settings2, Check } from "lucide-react";
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
  sector: string | null;
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

const DEFAULT_PAZ_DATA = {
  newContracts: { life: 0, nonLife: 0, reinsurance: 0 },
  amendments: { life: 0, nonLife: 0 },
  groupContracts: { life: 0, nonLife: 0 },
  takenContracts: { life: 0, nonLife: 0 },
  premiumNew: { life: 0, nonLife: 0, reinsurance: 0 },
  premiumGroup: { life: 0, nonLife: 0 },
  premiumTaken: { life: 0, nonLife: 0 },
  cancelledNotice: { life: 0, nonLife: 0, reinsurance: 0 },
  cancelledNonPayment: { life: 0, nonLife: 0, reinsurance: 0 },
  cancelledWithdrawal: { life: 0, nonLife: 0, reinsurance: 0 },
  commissionPositive: 0,
  commissionNegative: 0,
  commissionOffsetPositive: 0,
  commissionOffsetNegative: 0,
  pfaByPerformance: { zero: 0, low: 0, mid: 0, high: 0 },
  employeesByPerformance: { zero: 0, low: 0, mid: 0, high: 0 },
  sporitelsByPerformance: { zero: 0, low: 0, mid: 0, high: 0 },
};

const DEFAULT_PU_DATA = {
  byvanie: { count: 0, refinancing: 0 },
  spotrebitelske: { count: 0, refinancing: 0 },
  ostatne: { count: 0 },
  prevzate: { count: 0 },
  objem: { byvanie: 0, spotrebitelske: 0, ostatne: 0 },
  stornoTotal: 0,
  odstupenie14dni: 0,
  commissionPositive: 0,
  commissionNegative: 0,
  commissionOffsetPositive: 0,
  commissionOffsetNegative: 0,
  pfaByPerformance: { zero: 0, low: 0, high: 0 },
  employeesByPerformance: { zero: 0, low: 0, high: 0 },
};

const DEFAULT_PV_DATA = {
  bezne: { sprostredkovane: 0, prevzate: 0, zrusene: 0 },
  vkladove: { sprostredkovane: 0, prevzate: 0, zrusene: 0 },
  stavebne: { sprostredkovane: 0, prevzate: 0, zrusene: 0 },
  ine: { sprostredkovane: 0, prevzate: 0, zrusene: 0 },
  commissionPositive: 0,
  commissionNegative: 0,
  commissionOffsetPositive: 0,
  commissionOffsetNegative: 0,
  pfaByPerformance: { zero: 0, low: 0, high: 0 },
  employeesByPerformance: { zero: 0, low: 0, high: 0 },
};

const DEFAULT_KT_DATA = {
  poradenstvo: { count: 0 },
  ucits: { count: 0 },
  nonUcits: { count: 0 },
  ineNastroje: { count: 0 },
  prevzate: { count: 0 },
  zrusene: { count: 0 },
  pleniaOdKlientov: 0,
  commissionPositive: 0,
  commissionNegative: 0,
  commissionOffsetPositive: 0,
  commissionOffsetNegative: 0,
  pfaByPerformance: { zero: 0, low: 0, high: 0 },
  employeesByPerformance: { zero: 0, low: 0, high: 0 },
};

const DEFAULT_DDS_DATA = {
  sprostredkovane: 0,
  prevzate: 0,
  zrusene: 0,
  commissionPositive: 0,
  commissionNegative: 0,
  commissionOffsetPositive: 0,
  commissionOffsetNegative: 0,
  pfaByPerformance: { zero: 0, low: 0, high: 0 },
  employeesByPerformance: { zero: 0, low: 0, high: 0 },
};

const DEFAULT_SDS_DATA = { ...DEFAULT_DDS_DATA };

const DEFAULT_REPORT_DATA = DEFAULT_PAZ_DATA;

function getDefaultDataForSector(sector: string) {
  switch (sector) {
    case "PaZ": return { ...DEFAULT_PAZ_DATA };
    case "PU":  return { ...DEFAULT_PU_DATA };
    case "PV":  return { ...DEFAULT_PV_DATA };
    case "KT":  return { ...DEFAULT_KT_DATA };
    case "DDS": return { ...DEFAULT_DDS_DATA };
    case "SDS": return { ...DEFAULT_SDS_DATA };
    default:    return { ...DEFAULT_PAZ_DATA };
  }
}

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

const NBS_SECTORS = [
  { key: "PaZ", label: "Poistenie alebo zaistenie",       sublabel: "Poisťovacie činnosti",                     color: "text-blue-700 dark:text-blue-400",  bg: "bg-blue-500/10 border-blue-400/30" },
  { key: "PV",  label: "Prijímanie vkladov",              sublabel: "Bankové činnosti a vklady",                color: "text-sky-700 dark:text-sky-400",    bg: "bg-sky-500/10 border-sky-400/30" },
  { key: "PU",  label: "Poskytovanie úverov",             sublabel: "Úvery a úverové produkty",                 color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-500/10 border-indigo-400/30" },
  { key: "KT",  label: "Kapitálový trh",                  sublabel: "Investičné služby a cenné papiere",         color: "text-green-700 dark:text-green-400",bg: "bg-green-500/10 border-green-400/30" },
  { key: "DDS", label: "Doplnkové dôchodkové sporenie",   sublabel: "Tretí pilier",                             color: "text-amber-700 dark:text-amber-400",bg: "bg-amber-500/10 border-amber-400/30" },
  { key: "SDS", label: "Starobné dôchodkové sporenie",    sublabel: "Druhý pilier",                             color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-500/10 border-purple-400/30" },
] as const;

type NbsSectorKey = typeof NBS_SECTORS[number]["key"];

function NbsPartnerSettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const { data: partners, isLoading } = usePartners();
  const [localSectors, setLocalSectors] = useState<Record<number, string[]>>({});
  const [saving, setSaving] = useState<Set<number>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!open) {
      setInitialized(false);
      setLocalSectors({});
      return;
    }
    if (open && partners && !initialized) {
      const init: Record<number, string[]> = {};
      for (const p of partners) {
        if (!p.isDeleted) init[p.id] = (p as any).nbsSectors || [];
      }
      setLocalSectors(init);
      setInitialized(true);
    }
  }, [open, partners, initialized]);

  const activePartners = (partners || []).filter((p: any) => !p.isDeleted).sort((a: any, b: any) => a.name.localeCompare(b.name, "sk"));

  async function toggleSector(partnerId: number, sector: string) {
    const current = localSectors[partnerId] || [];
    const next = current.includes(sector) ? current.filter(s => s !== sector) : [...current, sector];
    setLocalSectors(prev => ({ ...prev, [partnerId]: next }));
    setSaving(prev => new Set([...prev, partnerId]));
    try {
      const res = await fetch(`/api/partners/${partnerId}/nbs-sectors`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ nbsSectors: next }),
      });
      if (!res.ok) throw new Error("Chyba");
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
    } catch {
      setLocalSectors(prev => ({ ...prev, [partnerId]: current }));
      toast({ title: "Chyba pri ukladaní", variant: "destructive" });
    } finally {
      setSaving(prev => { const n = new Set(prev); n.delete(partnerId); return n; });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="dialog-nbs-partner-settings">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-primary" />
            Nastavenie partnerov pre Výkaz NBS
          </DialogTitle>
        </DialogHeader>

        <div className="border rounded-lg p-3 bg-muted/30 shrink-0 mt-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-2 mb-3 border-b border-border/50">
            Kľúčové sektory finančného trhu pod dohľadom NBS:
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {NBS_SECTORS.map(s => (
              <div key={s.key} className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${s.bg} ${s.color}`}>{s.key}</span>
                <span className="text-[11px] text-muted-foreground leading-tight">
                  <span className="font-medium text-foreground">{s.label}:</span> {s.sublabel}.
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-auto flex-1 border rounded-lg">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : activePartners.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Žiadni partneri</p>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground border-b border-border">Názov partnera</th>
                  {NBS_SECTORS.map(s => (
                    <th key={s.key} className={`px-3 py-2.5 text-center text-xs font-bold border-b border-border ${s.color}`}>{s.key}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activePartners.map((p: any) => {
                  const sectors = localSectors[p.id] || [];
                  const isSaving = saving.has(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors" data-testid={`nbs-settings-row-${p.id}`}>
                      <td className="px-4 py-2 font-medium text-sm">
                        <div className="flex items-center gap-2">
                          {p.name}
                          {isSaving && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground shrink-0" />}
                        </div>
                      </td>
                      {NBS_SECTORS.map(sec => {
                        const active = sectors.includes(sec.key);
                        return (
                          <td key={sec.key} className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSector(p.id, sec.key)}
                              disabled={isSaving}
                              data-testid={`nbs-sector-toggle-${p.id}-${sec.key}`}
                              title={`${sec.label} — ${sec.sublabel}`}
                              className={`w-7 h-7 rounded border flex items-center justify-center mx-auto transition-all ${active ? `${sec.bg} ${sec.color}` : "border-border bg-transparent hover:bg-muted/40"}`}
                            >
                              {active && <Check className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} data-testid="btn-close-nbs-settings">Zatvoriť</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PartnerReportDialog({ open, onOpenChange, year, period, periodLabel, sector, initialPartnerId }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  year: number;
  period: string;
  periodLabel: string;
  sector: string;
  initialPartnerId?: number | null;
}) {
  const { toast } = useToast();
  const { data: partners, isLoading: partnersLoading } = usePartners();
  const [selectedPartnerId, setSelectedPartnerId] = useState<number | null>(null);
  const [formData, setFormData] = useState<any>(() => getDefaultDataForSector(sector));

  useEffect(() => {
    if (open && initialPartnerId) {
      setSelectedPartnerId(initialPartnerId);
    }
  }, [open, initialPartnerId]);

  const activePartners = (partners || []).filter((p: any) => !p.isDeleted);
  const sectorPartners = activePartners.filter((p: any) => (p.nbsSectors || []).includes(sector));
  const sectorMeta = NBS_SECTORS.find(s => s.key === sector);
  const partnerName = activePartners.find((p: any) => p.id === selectedPartnerId)?.name || "";

  const { data: allPeriodReports } = useQuery<any[]>({
    queryKey: ["/api/nbs-partner-reports", "list", year, period, sector],
    queryFn: async () => {
      const r = await fetch(`/api/nbs-partner-reports?year=${year}&period=${period}&sector=${sector}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: open,
  });
  const savedPartnerIds = new Set((allPeriodReports || []).map((r: any) => r.partnerId));

  const { data: existingReport, isLoading: loadingReport } = useQuery({
    queryKey: ["/api/nbs-partner-reports", selectedPartnerId, year, period, sector],
    queryFn: async () => {
      if (!selectedPartnerId) return null;
      const res = await fetch(`/api/nbs-partner-reports/${selectedPartnerId}?year=${year}&period=${period}&sector=${sector}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedPartnerId,
  });

  useEffect(() => {
    if (existingReport?.data) {
      setFormData({ ...getDefaultDataForSector(sector), ...existingReport.data });
    } else if (selectedPartnerId) {
      setFormData(getDefaultDataForSector(sector));
    }
  }, [existingReport, selectedPartnerId, sector]);

  useEffect(() => {
    if (!open) {
      setSelectedPartnerId(null);
      setFormData(getDefaultDataForSector(sector));
    }
  }, [open, sector]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPartnerId) throw new Error("Vyberte partnera");
      await apiRequest("PUT", `/api/nbs-partner-reports/${selectedPartnerId}`, { year, period, sector, data: formData });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nbs-partner-reports"] });
      toast({ title: "Výkaz uložený" });
      setSelectedPartnerId(null);
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

  function renderFinancialFlows() {
    return (
      <div className="border rounded-md p-4 space-y-3" data-testid="section-flows">
        <h3 className="font-bold text-sm">FINANČNÉ TOKY - PROVÍZIE (v EUR)</h3>
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
    );
  }

  function renderPerformance3({ pfaLabel, empLabel }: { pfaLabel?: string; empLabel?: string } = {}) {
    return (
      <div className="border rounded-md p-4 space-y-3" data-testid="section-performance">
        <h3 className="font-bold text-sm">PERSONÁLNE ČLENENIE (k poslednému dňu štvrťroka)</h3>
        <div>
          <p className="text-xs font-medium mb-2">{pfaLabel || "Počet PFA podľa výkonu"} <NbsTooltip tooltipKey="pfaByPerformance" /></p>
          <div className="grid grid-cols-3 gap-3">
            <NumField label="0 zmlúv" value={formData.pfaByPerformance?.zero ?? 0} onChange={v => updateNested("pfaByPerformance", "zero", v)} testId="input-pfa-zero" />
            <NumField label="1–10 zmlúv" value={formData.pfaByPerformance?.low ?? 0} onChange={v => updateNested("pfaByPerformance", "low", v)} testId="input-pfa-low" />
            <NumField label="11 a viac" value={formData.pfaByPerformance?.high ?? 0} onChange={v => updateNested("pfaByPerformance", "high", v)} testId="input-pfa-high" />
          </div>
        </div>
        <div>
          <p className="text-xs font-medium mb-2">{empLabel || "Počet zamestnancov podľa výkonu"} <NbsTooltip tooltipKey="employeesByPerformance" /></p>
          <div className="grid grid-cols-3 gap-3">
            <NumField label="0 zmlúv" value={formData.employeesByPerformance?.zero ?? 0} onChange={v => updateNested("employeesByPerformance", "zero", v)} testId="input-emp-zero" />
            <NumField label="1–10 zmlúv" value={formData.employeesByPerformance?.low ?? 0} onChange={v => updateNested("employeesByPerformance", "low", v)} testId="input-emp-low" />
            <NumField label="11 a viac" value={formData.employeesByPerformance?.high ?? 0} onChange={v => updateNested("employeesByPerformance", "high", v)} testId="input-emp-high" />
          </div>
        </div>
      </div>
    );
  }

  function renderPaZForm() {
    return (
      <div className="space-y-6">
        <div className="border rounded-md p-4 space-y-3" data-testid="section-1">
          <h3 className="font-bold text-sm">I. POČET ZMLÚV (ks)</h3>
          <div>
            <p className="text-xs font-medium mb-2">Nové zmluvy <NbsTooltip tooltipKey="newContracts" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Životné" value={formData.newContracts?.life ?? 0} onChange={v => updateNested("newContracts", "life", v)} testId="input-new-life" />
              <NumField label="Neživotné" value={formData.newContracts?.nonLife ?? 0} onChange={v => updateNested("newContracts", "nonLife", v)} testId="input-new-nonlife" />
              <NumField label="Zaistenie" value={formData.newContracts?.reinsurance ?? 0} onChange={v => updateNested("newContracts", "reinsurance", v)} testId="input-new-reinsurance" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Dodatky k zmluvám <NbsTooltip tooltipKey="amendments" /></p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Životné" value={formData.amendments?.life ?? 0} onChange={v => updateNested("amendments", "life", v)} testId="input-amend-life" />
              <NumField label="Neživotné" value={formData.amendments?.nonLife ?? 0} onChange={v => updateNested("amendments", "nonLife", v)} testId="input-amend-nonlife" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Skupinové zmluvy <NbsTooltip tooltipKey="groupContracts" /></p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Životné" value={formData.groupContracts?.life ?? 0} onChange={v => updateNested("groupContracts", "life", v)} testId="input-group-life" />
              <NumField label="Neživotné" value={formData.groupContracts?.nonLife ?? 0} onChange={v => updateNested("groupContracts", "nonLife", v)} testId="input-group-nonlife" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Prevzaté zmluvy <NbsTooltip tooltipKey="takenContracts" /></p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Životné" value={formData.takenContracts?.life ?? 0} onChange={v => updateNested("takenContracts", "life", v)} testId="input-taken-life" />
              <NumField label="Neživotné" value={formData.takenContracts?.nonLife ?? 0} onChange={v => updateNested("takenContracts", "nonLife", v)} testId="input-taken-nonlife" />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-4 space-y-3" data-testid="section-2">
          <h3 className="font-bold text-sm">II. OBJEM ROČNÉHO POISTNÉHO (v EUR s daňou/odvodom)</h3>
          <div>
            <p className="text-xs font-medium mb-2">Nové zmluvy <NbsTooltip tooltipKey="premiumNew" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Životné" value={formData.premiumNew?.life ?? 0} onChange={v => updateNested("premiumNew", "life", v)} testId="input-prem-new-life" />
              <NumField label="Neživotné" value={formData.premiumNew?.nonLife ?? 0} onChange={v => updateNested("premiumNew", "nonLife", v)} testId="input-prem-new-nonlife" />
              <NumField label="Zaistenie" value={formData.premiumNew?.reinsurance ?? 0} onChange={v => updateNested("premiumNew", "reinsurance", v)} testId="input-prem-new-reinsurance" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Skupinové zmluvy <NbsTooltip tooltipKey="premiumGroup" /></p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Životné" value={formData.premiumGroup?.life ?? 0} onChange={v => updateNested("premiumGroup", "life", v)} testId="input-prem-group-life" />
              <NumField label="Neživotné" value={formData.premiumGroup?.nonLife ?? 0} onChange={v => updateNested("premiumGroup", "nonLife", v)} testId="input-prem-group-nonlife" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Prevzaté zmluvy <NbsTooltip tooltipKey="premiumTaken" /></p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Životné" value={formData.premiumTaken?.life ?? 0} onChange={v => updateNested("premiumTaken", "life", v)} testId="input-prem-taken-life" />
              <NumField label="Neživotné" value={formData.premiumTaken?.nonLife ?? 0} onChange={v => updateNested("premiumTaken", "nonLife", v)} testId="input-prem-taken-nonlife" />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-4 space-y-3" data-testid="section-3">
          <h3 className="font-bold text-sm">III. ZRUŠENÉ ZMLUVY (ks)</h3>
          <div>
            <p className="text-xs font-medium mb-2">Výpoveďou do 3 rokov (§ 800) <NbsTooltip tooltipKey="cancelledNotice" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Životné" value={formData.cancelledNotice?.life ?? 0} onChange={v => updateNested("cancelledNotice", "life", v)} testId="input-cancel-notice-life" />
              <NumField label="Neživotné" value={formData.cancelledNotice?.nonLife ?? 0} onChange={v => updateNested("cancelledNotice", "nonLife", v)} testId="input-cancel-notice-nonlife" />
              <NumField label="Zaistenie" value={formData.cancelledNotice?.reinsurance ?? 0} onChange={v => updateNested("cancelledNotice", "reinsurance", v)} testId="input-cancel-notice-reinsurance" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Nezaplatením do 3 mesiacov (§ 801) <NbsTooltip tooltipKey="cancelledNonPayment" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Životné" value={formData.cancelledNonPayment?.life ?? 0} onChange={v => updateNested("cancelledNonPayment", "life", v)} testId="input-cancel-nonpay-life" />
              <NumField label="Neživotné" value={formData.cancelledNonPayment?.nonLife ?? 0} onChange={v => updateNested("cancelledNonPayment", "nonLife", v)} testId="input-cancel-nonpay-nonlife" />
              <NumField label="Zaistenie" value={formData.cancelledNonPayment?.reinsurance ?? 0} onChange={v => updateNested("cancelledNonPayment", "reinsurance", v)} testId="input-cancel-nonpay-reinsurance" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Odstúpením (§ 802a) <NbsTooltip tooltipKey="cancelledWithdrawal" /></p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="Životné" value={formData.cancelledWithdrawal?.life ?? 0} onChange={v => updateNested("cancelledWithdrawal", "life", v)} testId="input-cancel-withdrawal-life" />
              <NumField label="Neživotné" value={formData.cancelledWithdrawal?.nonLife ?? 0} onChange={v => updateNested("cancelledWithdrawal", "nonLife", v)} testId="input-cancel-withdrawal-nonlife" />
              <NumField label="Zaistenie" value={formData.cancelledWithdrawal?.reinsurance ?? 0} onChange={v => updateNested("cancelledWithdrawal", "reinsurance", v)} testId="input-cancel-withdrawal-reinsurance" />
            </div>
          </div>
        </div>

        {renderFinancialFlows()}

        <div className="border rounded-md p-4 space-y-3" data-testid="section-5">
          <h3 className="font-bold text-sm">V. PERSONÁLNE ČLENENIE (k poslednému dňu štvrťroka)</h3>
          <div>
            <p className="text-xs font-medium mb-2">Počet PFA podľa výkonu <NbsTooltip tooltipKey="pfaByPerformance" /></p>
            <div className="grid grid-cols-4 gap-3">
              <NumField label="0" value={formData.pfaByPerformance?.zero ?? 0} onChange={v => updateNested("pfaByPerformance", "zero", v)} testId="input-pfa-zero" />
              <NumField label="1–10" value={formData.pfaByPerformance?.low ?? 0} onChange={v => updateNested("pfaByPerformance", "low", v)} testId="input-pfa-low" />
              <NumField label="11–50" value={formData.pfaByPerformance?.mid ?? 0} onChange={v => updateNested("pfaByPerformance", "mid", v)} testId="input-pfa-mid" />
              <NumField label="Viac ako 50" value={formData.pfaByPerformance?.high ?? 0} onChange={v => updateNested("pfaByPerformance", "high", v)} testId="input-pfa-high" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Počet zamestnancov podľa výkonu <NbsTooltip tooltipKey="employeesByPerformance" /></p>
            <div className="grid grid-cols-4 gap-3">
              <NumField label="0" value={formData.employeesByPerformance?.zero ?? 0} onChange={v => updateNested("employeesByPerformance", "zero", v)} testId="input-emp-zero" />
              <NumField label="1–10" value={formData.employeesByPerformance?.low ?? 0} onChange={v => updateNested("employeesByPerformance", "low", v)} testId="input-emp-low" />
              <NumField label="11–50" value={formData.employeesByPerformance?.mid ?? 0} onChange={v => updateNested("employeesByPerformance", "mid", v)} testId="input-emp-mid" />
              <NumField label="Viac ako 50" value={formData.employeesByPerformance?.high ?? 0} onChange={v => updateNested("employeesByPerformance", "high", v)} testId="input-emp-high" />
            </div>
          </div>
          <div>
            <p className="text-xs font-medium mb-2">Počet sporiteľov dopl. poistenia podľa výkonu</p>
            <div className="grid grid-cols-4 gap-3">
              <NumField label="0" value={formData.sporitelsByPerformance?.zero ?? 0} onChange={v => updateNested("sporitelsByPerformance", "zero", v)} testId="input-spo-zero" />
              <NumField label="1–10" value={formData.sporitelsByPerformance?.low ?? 0} onChange={v => updateNested("sporitelsByPerformance", "low", v)} testId="input-spo-low" />
              <NumField label="11–50" value={formData.sporitelsByPerformance?.mid ?? 0} onChange={v => updateNested("sporitelsByPerformance", "mid", v)} testId="input-spo-mid" />
              <NumField label="Viac ako 50" value={formData.sporitelsByPerformance?.high ?? 0} onChange={v => updateNested("sporitelsByPerformance", "high", v)} testId="input-spo-high" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderPUForm() {
    return (
      <div className="space-y-6">
        <div className="border rounded-md p-4 space-y-4" data-testid="section-pu-contracts">
          <h3 className="font-bold text-sm">I. SPROSTREDKOVANÉ ZMLUVY (ks)</h3>

          <div>
            <p className="text-xs font-medium mb-2">Bývanie</p>
            <div className="grid grid-cols-2 gap-3 items-end">
              <NumField label="Počet" value={formData.byvanie?.count ?? 0} onChange={v => updateNested("byvanie", "count", v)} testId="input-pu-byvanie-count" />
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-muted-foreground font-medium">Refinančný príznak (ks)</label>
                <NumField label="z toho Refinančné" value={formData.byvanie?.refinancing ?? 0} onChange={v => updateNested("byvanie", "refinancing", v)} testId="input-pu-byvanie-ref" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Spotrebiteľské</p>
            <div className="grid grid-cols-2 gap-3 items-end">
              <NumField label="Počet" value={formData.spotrebitelske?.count ?? 0} onChange={v => updateNested("spotrebitelske", "count", v)} testId="input-pu-spot-count" />
              <NumField label="z toho Refinančné" value={formData.spotrebitelske?.refinancing ?? 0} onChange={v => updateNested("spotrebitelske", "refinancing", v)} testId="input-pu-spot-ref" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Ostatné</p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Počet" value={formData.ostatne?.count ?? 0} onChange={v => updateNested("ostatne", "count", v)} testId="input-pu-ostatne-count" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Prevzaté zmluvy od iného SFA</p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Počet" value={formData.prevzate?.count ?? 0} onChange={v => updateNested("prevzate", "count", v)} testId="input-pu-prevzate" />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-4 space-y-3" data-testid="section-pu-volume">
          <h3 className="font-bold text-sm">II. OBJEM ÚVERU (schválená výška brutto, v EUR)</h3>
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Bývanie" value={formData.objem?.byvanie ?? 0} onChange={v => updateNested("objem", "byvanie", v)} testId="input-pu-objem-byvanie" />
            <NumField label="Spotrebiteľské" value={formData.objem?.spotrebitelske ?? 0} onChange={v => updateNested("objem", "spotrebitelske", v)} testId="input-pu-objem-spot" />
            <NumField label="Ostatné" value={formData.objem?.ostatne ?? 0} onChange={v => updateNested("objem", "ostatne", v)} testId="input-pu-objem-ostatne" />
          </div>
        </div>

        <div className="border rounded-md p-4 space-y-3" data-testid="section-pu-storno">
          <h3 className="font-bold text-sm">III. STORNO (ks)</h3>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Celkový počet stornovaných" value={formData.stornoTotal ?? 0} onChange={v => updateFlat("stornoTotal", v)} testId="input-pu-storno-total" />
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-muted-foreground font-medium">Odstúpenie do 14 dní</label>
              <input
                type="number"
                min={0}
                value={formData.odstupenie14dni || ""}
                onChange={e => updateFlat("odstupenie14dni", Number(e.target.value) || 0)}
                className="h-8 text-sm w-full rounded-md border-2 border-red-500 bg-background px-3 focus:outline-none focus:ring-2 focus:ring-red-500"
                data-testid="input-pu-odstupenie14"
              />
            </div>
          </div>
        </div>

        {renderFinancialFlows()}
        {renderPerformance3()}
      </div>
    );
  }

  function renderPVForm() {
    const accountTypes = [
      { key: "bezne", label: "Bežné účty" },
      { key: "vkladove", label: "Vkladové účty" },
      { key: "stavebne", label: "Stavebné sporenie" },
      { key: "ine", label: "Iné vklady" },
    ] as const;

    return (
      <div className="space-y-6">
        <div className="border rounded-md p-4 space-y-3" data-testid="section-pv-contracts">
          <h3 className="font-bold text-sm">I. ZMLUVY PODĽA TYPU ÚČTU (ks)</h3>
          <div className="grid grid-cols-4 gap-x-3 gap-y-1 text-[10px] font-medium text-muted-foreground mb-1">
            <div></div>
            <div className="text-center">Spr.</div>
            <div className="text-center">Prev.</div>
            <div className="text-center">Zruš.</div>
          </div>
          {accountTypes.map(({ key, label }) => (
            <div key={key} className="grid grid-cols-4 gap-3 items-end">
              <label className="text-xs font-medium self-center">{label}</label>
              <NumField label="" value={(formData as any)[key]?.sprostredkovane ?? 0} onChange={v => updateNested(key, "sprostredkovane", v)} testId={`input-pv-${key}-spr`} />
              <NumField label="" value={(formData as any)[key]?.prevzate ?? 0} onChange={v => updateNested(key, "prevzate", v)} testId={`input-pv-${key}-prev`} />
              <NumField label="" value={(formData as any)[key]?.zrusene ?? 0} onChange={v => updateNested(key, "zrusene", v)} testId={`input-pv-${key}-zru`} />
            </div>
          ))}
        </div>

        {renderFinancialFlows()}
        {renderPerformance3()}
      </div>
    );
  }

  function renderKTForm() {
    return (
      <div className="space-y-6">
        <div className="border rounded-md p-4 space-y-4" data-testid="section-kt-contracts">
          <h3 className="font-bold text-sm">I. ZMLUVY / OBCHODY (ks)</h3>

          <div>
            <p className="text-xs font-medium mb-2">Investičné poradenstvo (priamo so SFA)</p>
            <div className="grid grid-cols-2 gap-3">
              <NumField label="Počet" value={formData.poradenstvo?.count ?? 0} onChange={v => updateNested("poradenstvo", "count", v)} testId="input-kt-poradenstvo" />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium mb-2">Sprostredkované</p>
            <div className="grid grid-cols-3 gap-3">
              <NumField label="UCITS" value={formData.ucits?.count ?? 0} onChange={v => updateNested("ucits", "count", v)} testId="input-kt-ucits" />
              <NumField label="Non-UCITS" value={formData.nonUcits?.count ?? 0} onChange={v => updateNested("nonUcits", "count", v)} testId="input-kt-nonucits" />
              <NumField label="Iné nástroje" value={formData.ineNastroje?.count ?? 0} onChange={v => updateNested("ineNastroje", "count", v)} testId="input-kt-ine" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium mb-2">Prevzaté od iného SFA</p>
              <NumField label="Počet" value={formData.prevzate?.count ?? 0} onChange={v => updateNested("prevzate", "count", v)} testId="input-kt-prevzate" />
            </div>
            <div>
              <p className="text-xs font-medium mb-2">Zrušené</p>
              <NumField label="Počet" value={formData.zrusene?.count ?? 0} onChange={v => updateNested("zrusene", "count", v)} testId="input-kt-zrusene" />
            </div>
          </div>
        </div>

        <div className="border rounded-md p-4 space-y-3" data-testid="section-kt-klient">
          <h3 className="font-bold text-sm">II. PLNENIA OD KLIENTOV (v EUR)</h3>
          <p className="text-[10px] text-muted-foreground">Priame poplatky za poradenstvo vyplatené klientmi priamo SFA</p>
          <NumField label="Suma (EUR)" value={formData.pleniaOdKlientov ?? 0} onChange={v => updateFlat("pleniaOdKlientov", v)} testId="input-kt-plenia" />
        </div>

        {renderFinancialFlows()}
        {renderPerformance3()}
      </div>
    );
  }

  function renderSimpleForm(contractLabel: string, sectorPrefix: string) {
    return (
      <div className="space-y-6">
        <div className="border rounded-md p-4 space-y-3" data-testid={`section-${sectorPrefix}-contracts`}>
          <h3 className="font-bold text-sm">I. ZMLUVY (ks)</h3>
          <div className="grid grid-cols-3 gap-3">
            <NumField label={`Sprostredkované (${contractLabel})`} value={formData.sprostredkovane ?? 0} onChange={v => updateFlat("sprostredkovane", v)} testId={`input-${sectorPrefix}-spr`} />
            <NumField label="Prevzaté od iného SFA" value={formData.prevzate ?? 0} onChange={v => updateFlat("prevzate", v)} testId={`input-${sectorPrefix}-prev`} />
            <NumField label="Zrušené" value={formData.zrusene ?? 0} onChange={v => updateFlat("zrusene", v)} testId={`input-${sectorPrefix}-zru`} />
          </div>
        </div>

        {renderFinancialFlows()}
        {renderPerformance3()}
      </div>
    );
  }

  function renderForm() {
    const backBtn = (
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
    );

    let formContent: JSX.Element | null = null;
    switch (sector) {
      case "PaZ": formContent = renderPaZForm(); break;
      case "PU":  formContent = renderPUForm();  break;
      case "PV":  formContent = renderPVForm();  break;
      case "KT":  formContent = renderKTForm();  break;
      case "DDS": formContent = renderSimpleForm("účastnícka zmluva DDS", "dds"); break;
      case "SDS": formContent = renderSimpleForm("zmluva SDS", "sds"); break;
      default:
        formContent = (
          <div className="border rounded-md p-6 text-center text-sm text-muted-foreground">
            Formulár pre sektor <strong>{sector}</strong> nie je dostupný.
          </div>
        );
    }

    return (
      <div className="space-y-6">
        {backBtn}
        {formContent}
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
            <div className="space-y-3">
              {sectorMeta && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs font-semibold ${sectorMeta.bg} ${sectorMeta.color}`}>
                  <span className="font-bold">{sectorMeta.key}</span>
                  <span>{sectorMeta.label}</span>
                  <span className="text-muted-foreground font-normal">— {sectorMeta.sublabel}</span>
                </div>
              )}
              {partnersLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : sectorPartners.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Žiadni partneri zaradení do sektora {sector}. Nastavte partnerov cez tlačidlo „Nastavenie NBS partnerov".</p>
              ) : (
                <div className="space-y-1">
                  {sectorPartners.map((p: any) => {
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
  const [nbsSettingsOpen, setNbsSettingsOpen] = useState(false);
  const [partnerReportSector, setPartnerReportSector] = useState<string>("");

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

  const reportMap = new Map((reports || []).map(r => [`${r.period}-${r.sector}`, r]));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="page-reporty-nbs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileBarChart className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Reporty pre NBS</h1>
          <Badge variant="outline" className="text-[10px] text-blue-400 border-blue-400/50">Špecial</Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={() => setNbsSettingsOpen(true)}
          data-testid="btn-nbs-settings"
        >
          <Settings2 className="w-4 h-4" />
          Nastavenie NBS partnerov
        </Button>
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
                reports.length > 0 && reports.every(r => r.status === "sent")
                  ? "border-green-500 text-green-400"
                  : "border-blue-500 text-blue-400"
              }>
                {reports.filter(r => r.status === "sent").length}/{reports.length} odoslaných
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
                const sectorReportsMap = new Map<string, NbsReport>(
                  NBS_SECTORS.map(s => {
                    const r = reportMap.get(`${p.key}-${s.key}`);
                    return [s.key, r!];
                  }).filter(([, r]) => !!r)
                );
                if (sectorReportsMap.size === 0) return null;
                const isExpanded = expandedPeriod === p.key;

                return (
                  <PeriodBubble
                    key={p.key}
                    period={p}
                    sectorReports={sectorReportsMap}
                    year={selectedYear}
                    isExpanded={isExpanded}
                    onToggle={() => setExpandedPeriod(isExpanded ? null : p.key)}
                    onSectorStatusClick={(report) => handleStatusClick(report)}
                    statusPending={updateMutation.isPending}
                    onOpenPartnerForm={(partnerId, sector) => {
                      setPartnerReportPeriod({ key: p.key, label: p.label });
                      setPartnerReportInitialId(partnerId);
                      setPartnerReportSector(sector);
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
          onOpenChange={(o) => { setPartnerReportOpen(o); if (!o) { setPartnerReportInitialId(null); setPartnerReportSector(""); } }}
          year={selectedYear}
          period={partnerReportPeriod.key}
          periodLabel={partnerReportPeriod.label}
          sector={partnerReportSector}
          initialPartnerId={partnerReportInitialId}
        />
      )}

      <NbsAnalyticsChart />

      <NbsPartnerSettingsDialog open={nbsSettingsOpen} onOpenChange={setNbsSettingsOpen} />
    </div>
  );
}

function PeriodBubble({ period, sectorReports, year, isExpanded, onToggle, onSectorStatusClick, statusPending, onOpenPartnerForm }: {
  period: { key: string; label: string };
  sectorReports: Map<string, NbsReport>;
  year: number;
  isExpanded: boolean;
  onToggle: () => void;
  onSectorStatusClick: (report: NbsReport) => void;
  statusPending: boolean;
  onOpenPartnerForm: (partnerId: number, sector: string) => void;
}) {
  const { data: partners, isLoading: partnersLoading } = usePartners();
  const activePartners = (partners || []).filter((p: any) => !p.isDeleted);

  const activeSectors = NBS_SECTORS.map(sec => ({
    sector: sec,
    report: sectorReports.get(sec.key),
    partners: activePartners.filter((p: any) => (p.nbsSectors || []).includes(sec.key)),
  })).filter(g => g.partners.length > 0 && g.report);

  const { data: periodReports } = useQuery<any[]>({
    queryKey: ["/api/nbs-partner-reports", "list", year, period.key],
    queryFn: async () => {
      const r = await fetch(`/api/nbs-partner-reports?year=${year}&period=${period.key}`, { credentials: "include" });
      return r.ok ? r.json() : [];
    },
    enabled: isExpanded,
  });

  const deadline = getDeadline(period.key, year);
  const daysLeft = getDaysRemaining(deadline);

  const sectorReportsList = Array.from(sectorReports.values());
  const sentCount = sectorReportsList.filter(r => r.status === "sent").length;
  const allSent = activeSectors.length > 0 && activeSectors.every(g => g.report?.status === "sent");
  const overallStatus = allSent ? "sent" : sectorReportsList.some(r => r.status === "checked") ? "checked" : "not_sent";
  const colorClass = getColorByDeadline(deadline, overallStatus);

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
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {sentCount > 0 && (
              <Badge variant="secondary" className={`text-[9px] px-1.5 h-4 ${allSent ? "bg-green-600 text-white" : "bg-blue-600 text-white"}`}>
                {sentCount}/{sectorReports.size} sekt. odoslaných
              </Badge>
            )}
            {!allSent && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                daysLeft <= 14 ? "bg-red-600 text-white" : daysLeft <= 30 ? "bg-orange-500 text-white" : "bg-blue-600 text-white"
              }`} data-testid={`days-left-${period.key}`}>
                {daysLeft > 0 ? `${daysLeft} dní` : `${Math.abs(daysLeft)} dní po termíne`}
              </span>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="px-5 pb-4 pt-1 border-t space-y-4">
            {partnersLoading ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : activeSectors.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Žiadni partneri zaradení do NBS reportu. Nastavte partnerov cez tlačidlo „Nastavenie NBS partnerov".</p>
            ) : (
              activeSectors.map(({ sector: sec, report: secReport, partners: secPartners }) => {
                if (!secReport) return null;
                const sectorSavedIds = new Set((periodReports || []).filter((r: any) => r.sector === sec.key).map((r: any) => r.partnerId));
                const secSavedCount = sectorSavedIds.size;
                const statusBtnColor = getStatusButtonColor(secReport.status);
                return (
                  <div key={sec.key} className={`rounded-lg border p-3 space-y-2 ${sec.bg}`} data-testid={`sector-section-${sec.key}-${period.key}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${sec.bg} ${sec.color}`}>{sec.key}</span>
                        <span className={`text-xs font-semibold ${sec.color}`}>{sec.label}</span>
                        {secSavedCount > 0 && (
                          <Badge variant="secondary" className="text-[8px] px-1 h-3.5 bg-green-600 text-white">{secSavedCount} výkazov</Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        className={`text-xs px-2.5 py-1 h-6 ${statusBtnColor}`}
                        onClick={(e) => { e.stopPropagation(); onSectorStatusClick(secReport); }}
                        disabled={statusPending}
                        data-testid={`btn-status-${period.key}-${sec.key}`}
                      >
                        {statusPending ? <Loader2 className="w-3 h-3 animate-spin" /> : getStatusLabel(secReport.status)}
                      </Button>
                    </div>
                    {secReport.status === "sent" && secReport.sentDate && (
                      <p className="text-[9px] text-muted-foreground">Odoslané: {secReport.sentDate}</p>
                    )}
                    <div className="space-y-1">
                      {secPartners.map((p: any) => {
                        const hasSaved = sectorSavedIds.has(p.id);
                        return (
                          <div
                            key={p.id}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded border cursor-pointer transition-all hover:bg-accent/50 ${hasSaved ? "border-green-500/50 bg-green-50/80 dark:bg-green-950/30" : "border-border/60 bg-background/60"}`}
                            onClick={(e) => { e.stopPropagation(); onOpenPartnerForm(p.id, sec.key); }}
                            data-testid={`period-partner-${period.key}-${sec.key}-${p.id}`}
                          >
                            <span className="text-xs font-medium">{p.name}</span>
                            {hasSaved && (
                              <Badge variant="secondary" className="text-[8px] px-1 h-3.5 bg-green-600 text-white">Vyplnené</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
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
