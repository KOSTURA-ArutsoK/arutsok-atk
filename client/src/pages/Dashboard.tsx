import { useState, useCallback, useMemo, useEffect } from "react";
import { useMyCompanies } from "@/hooks/use-companies";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Building2, ShieldAlert, TrendingUp, Briefcase, Package, History, Calendar, Clock, GripVertical, Pencil, Save, X, FileText, FileCheck, AlertCircle, Banknote, AlertTriangle, ArrowRight, CheckCircle2, Loader2, Ban, BarChart3, PieChart as PieChartIcon, Activity, Send, Filter, CalendarDays, ChevronDown, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppUser } from "@/hooks/use-app-user";
import type { Subject, Partner, Product, AuditLog, DashboardPreference, CalendarEvent, UserDashboardLayout } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn, formatUid } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
  BarChart, Bar,
} from "recharts";

const WIDGET_KEYS = ["stats", "recent_subjects", "my_companies", "recent_partners", "recent_products", "audit_activity", "upcoming_events", "red_list_recent", "black_list_recent"];

const LIFECYCLE_PHASES: Record<number, string> = {
  1: "Čakajúce na odoslanie",
  2: "Odoslané na sprievodke",
  3: "Neprijaté – výhrady",
  4: "Archív (z výhradami)",
  5: "Prijaté do centrály",
  6: "Kontrakt v spracovaní",
  7: "Interná intervencia",
  8: "Pripravené na odoslanie",
  9: "Odoslané partnerovi",
  10: "Prijaté partnerom",
};

const TIME_PRESETS = [
  { label: "Dnes", value: "today" },
  { label: "7 dní", value: "7d" },
  { label: "30 dní", value: "30d" },
  { label: "Kvartál", value: "quarter" },
  { label: "Rok", value: "year" },
  { label: "Všetko", value: "all" },
  { label: "Vlastný", value: "custom" },
];

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  switch (preset) {
    case "today": return { from: to, to };
    case "7d": { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: d.toISOString().slice(0, 10), to }; }
    case "30d": { const d = new Date(now); d.setDate(d.getDate() - 30); return { from: d.toISOString().slice(0, 10), to }; }
    case "quarter": { const d = new Date(now); d.setMonth(d.getMonth() - 3); return { from: d.toISOString().slice(0, 10), to }; }
    case "year": { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return { from: d.toISOString().slice(0, 10), to }; }
    default: return { from: "", to: "" };
  }
}

function formatMonthLabel(m: string): string {
  const [year, month] = m.split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "Máj", "Jún", "Júl", "Aug", "Sep", "Okt", "Nov", "Dec"];
  return `${months[parseInt(month, 10) - 1]} ${year?.slice(2)}`;
}

interface AnalyticsData {
  quickStats: { totalContracts: number; pendingObjections: number; sprievodkyCount: number };
  scanTrend: { date: string; cumulative: number }[];
  phaseDistribution: { phase: number; count: number; label: string; color: string }[];
  qualityProcess: { period: string; accepted: number; objections: number }[];
  protocolActivity: { month: string; count: number }[];
  inventories: { id: number; name: string }[];
}

function SortableWidget({ id, isEditing, children }: { id: string; isEditing: boolean; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !isEditing });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        isEditing && "ring-1 ring-dashed ring-muted-foreground/40 rounded-md",
        id === "stats" ? "col-span-1 lg:col-span-2" : ""
      )}
      data-testid={`sortable-widget-${id}`}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 left-2 z-20 cursor-grab active:cursor-grabbing p-1 rounded-md bg-muted/80"
        style={{ display: isEditing ? 'block' : 'none' }}
        data-testid={`drag-handle-${id}`}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}

interface ContractStats {
  totalContracts: number;
  activeContractsCount: number;
  interventionCount: number;
  totalAnnualPremium: number;
  activeStatusIds: number[];
  interventionStatusIds: number[];
}

function EmptyChartState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
      <p className="text-sm">{message || "Žiadne dáta pre zvolené filtre"}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data: appUser } = useAppUser();
  const [, navigate] = useLocation();
  const { data: companies } = useMyCompanies();
  const { data: subjects } = useQuery<Subject[]>({ queryKey: ["/api/subjects"] });
  const { data: partners } = useQuery<Partner[]>({ queryKey: ["/api/partners"] });
  const { data: products } = useQuery<Product[]>({ queryKey: ["/api/products"] });
  const { data: auditLogsData } = useQuery<{ logs: AuditLog[]; total: number }>({ queryKey: ["/api/audit-logs"] });
  const auditLogs = auditLogsData?.logs || [];
  const { data: upcomingEvents } = useQuery<CalendarEvent[]>({ queryKey: ["/api/calendar-events/upcoming"] });
  const { data: dashboardPrefs } = useQuery<DashboardPreference[]>({ queryKey: ["/api/dashboard-preferences"] });
  const { data: savedLayout } = useQuery<UserDashboardLayout | null>({ queryKey: ["/api/dashboard-layout"] });
  const { data: contractStats } = useQuery<ContractStats>({ queryKey: ["/api/dashboard-contract-stats"] });

  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editOrder, setEditOrder] = useState<string[]>([]);
  const [redListDialogOpen, setRedListDialogOpen] = useState(false);

  const [timePreset, setTimePreset] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState("");

  const analyticsParams = useMemo(() => {
    const p = new URLSearchParams();
    if (timePreset === "custom") {
      if (customFrom) p.set("dateFrom", customFrom);
      if (customTo) p.set("dateTo", customTo);
    } else if (timePreset !== "all") {
      const range = getDateRange(timePreset);
      if (range.from) p.set("dateFrom", range.from);
      if (range.to) p.set("dateTo", range.to);
    }
    if (phaseFilter && phaseFilter !== "all") p.set("phase", phaseFilter);
    if (inventoryFilter && inventoryFilter !== "all") p.set("inventoryId", inventoryFilter);
    return p;
  }, [timePreset, customFrom, customTo, phaseFilter, inventoryFilter]);

  const { data: analytics, isLoading: analyticsLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/dashboard/analytics", analyticsParams.toString()],
    queryFn: async () => {
      const r = await fetch(`/api/dashboard/analytics?${analyticsParams.toString()}`, { credentials: "include" });
      if (r.status === 401) { window.location.href = "/"; throw new Error("Session expired"); }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    retry: 1,
    placeholderData: (prev: any) => prev,
  });

  const isAdminUser = useMemo(() => {
    const role = appUser?.role || "";
    const pgName = ((appUser as any)?.permissionGroup?.name || "").toLowerCase();
    return role === "admin" || role === "superadmin" || role === "prezident" || pgName.includes("admin") || pgName.includes("superadmin") || pgName.includes("prezident");
  }, [appUser]);

  const { data: redListAlerts, refetch: refetchAlerts } = useQuery<any[]>({
    queryKey: ["/api/red-list-alerts/pending"],
    enabled: isAdminUser,
  });

  const { data: recentRedListConfirmed } = useQuery<any[]>({
    queryKey: ["/api/red-list-alerts/recent-confirmed"],
    enabled: isAdminUser,
  });

  const { data: recentBlackList } = useQuery<any[]>({
    queryKey: ["/api/black-list/recent"],
    enabled: isAdminUser,
  });

  useEffect(() => {
    if (redListAlerts && redListAlerts.length > 0 && isAdminUser) {
      setRedListDialogOpen(true);
    }
  }, [redListAlerts, isAdminUser]);

  const dismissAlertMutation = useMutation({
    mutationFn: async (alertId: number) => {
      return apiRequest("POST", `/api/red-list-alerts/${alertId}/dismiss`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/red-list-alerts/pending"] });
    },
  });

  const confirmAlertMutation = useMutation({
    mutationFn: async (alertId: number) => {
      return apiRequest("POST", `/api/red-list-alerts/${alertId}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/red-list-alerts/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/red-list-alerts/recent-confirmed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      toast({ title: "Subjekt presunutý na červený zoznam" });
    },
  });

  const hasPrefs = dashboardPrefs && dashboardPrefs.length > 0;
  const enabledWidgets = new Set(
    hasPrefs
      ? dashboardPrefs.filter(p => p.enabled).map(p => p.widgetKey)
      : WIDGET_KEYS
  );
  const isVisible = (key: string) => enabledWidgets.has(key);

  const defaultOrder = WIDGET_KEYS.filter(k => isVisible(k));
  const currentOrder = useMemo(() => {
    if (savedLayout?.widgetOrder) {
      const saved = savedLayout.widgetOrder.filter(k => isVisible(k));
      const missing = defaultOrder.filter(k => !saved.includes(k));
      return [...saved, ...missing];
    }
    return defaultOrder;
  }, [savedLayout, enabledWidgets]);

  const displayOrder = isEditing ? editOrder : currentOrder;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const saveLayoutMutation = useMutation({
    mutationFn: async (widgetOrder: string[]) => {
      await apiRequest("POST", "/api/dashboard-layout", { widgetOrder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-layout"] });
      toast({ title: "Rozlozenie ulozene", description: "Vase rozlozenie bolo uspesne ulozene." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa ulozit rozlozenie.", variant: "destructive" });
    },
  });

  const handleStartEdit = useCallback(() => {
    setEditOrder([...currentOrder]);
    setIsEditing(true);
  }, [currentOrder]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditOrder([]);
  }, []);

  const handleSave = useCallback(() => {
    saveLayoutMutation.mutate(editOrder);
    setIsEditing(false);
    setEditOrder([]);
  }, [editOrder, saveLayoutMutation]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setEditOrder(prev => {
      const oldIndex = prev.indexOf(active.id as string);
      const newIndex = prev.indexOf(over.id as string);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const formatEur = (amount: number) => {
    const val = amount.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${val} EUR`;
  };

  const contractStatsTiles = [
    {
      title: "Celkovy pocet zmluv",
      value: contractStats?.totalContracts ?? 0,
      icon: FileText,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      clickable: false,
    },
    {
      title: "Aktivne zmluvy",
      value: contractStats?.activeContractsCount ?? 0,
      icon: FileCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      clickable: true,
      onClick: () => {
        const ids = contractStats?.activeStatusIds;
        if (ids && ids.length > 0) {
          navigate(`/contracts?statusIds=${ids.join(",")}`);
        } else {
          navigate("/contracts");
        }
      },
    },
    {
      title: "Intervencie",
      value: contractStats?.interventionCount ?? 0,
      icon: AlertCircle,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      clickable: true,
      onClick: () => {
        const ids = contractStats?.interventionStatusIds;
        if (ids && ids.length > 0) {
          navigate(`/contracts?statusIds=${ids.join(",")}`);
        } else {
          navigate("/contracts");
        }
      },
    },
    {
      title: "Celkove poistne",
      value: formatEur(contractStats?.totalAnnualPremium ?? 0),
      icon: Banknote,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
      clickable: false,
    },
  ];

  const recentLogs = auditLogs.slice(0, 5);

  const qs = analytics?.quickStats;
  const scanTrend = analytics?.scanTrend || [];
  const phaseDistribution = analytics?.phaseDistribution || [];
  const qualityProcess = analytics?.qualityProcess || [];
  const protocolActivity = analytics?.protocolActivity || [];
  const inventories = analytics?.inventories || [];

  const widgetRenderers: Record<string, () => React.ReactNode> = {
    stats: () => (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" data-testid="widget-stats">
        {contractStatsTiles.map((stat, i) => (
          <Card
            key={i}
            className={stat.clickable ? "cursor-pointer hover-elevate" : ""}
            onClick={stat.clickable && stat.onClick ? stat.onClick : undefined}
            data-testid={`card-contract-stat-${i}`}
          >
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-md ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`text-stat-${i}`}>{stat.value}</div>
              <div style={{ display: stat.clickable ? 'block' : 'none' }}>
                <p className="text-xs text-muted-foreground mt-1">Kliknite pre zobrazenie</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    ),
    recent_subjects: () => (
      <Card data-testid="widget-recent-subjects">
        <CardHeader>
          <CardTitle className="text-base">Posledne subjekty</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: subjects && subjects.length > 0 ? 'block' : 'none' }}>
            <div className="space-y-3">
              {(subjects || []).slice(0, 5).map(s => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                    {s.type === "person" ? "O" : "F"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {s.type === "person" ? `${s.lastName}, ${s.firstName}` : s.companyName}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{formatUid(s.uid)}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${s.isActive ? "bg-emerald-500" : "bg-red-500"}`} data-testid={`status-subject-${s.id}`} />
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground py-6 text-center" style={{ display: subjects && subjects.length > 0 ? 'none' : 'block' }}>Ziadne subjekty</p>
        </CardContent>
      </Card>
    ),
    my_companies: () => (
      <Card data-testid="widget-my-companies">
        <CardHeader>
          <CardTitle className="text-base">Moje spolocnosti</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: companies && companies.length > 0 ? 'block' : 'none' }}>
            <div className="space-y-3">
              {(companies || []).map(c => (
                <div key={c.id} className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded-md bg-emerald-500/10 flex items-center justify-center text-emerald-500 text-xs font-bold">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.specialization} | Kod: {c.code}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${!c.isDeleted ? "bg-emerald-500" : "bg-red-500"}`} data-testid={`status-company-${c.id}`} />
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground py-6 text-center" style={{ display: companies && companies.length > 0 ? 'none' : 'block' }}>Ziadne spolocnosti</p>
        </CardContent>
      </Card>
    ),
    recent_partners: () => (
      <Card data-testid="widget-recent-partners">
        <CardHeader>
          <CardTitle className="text-base">Posledni partneri</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: partners && partners.length > 0 ? 'block' : 'none' }}>
            <div className="space-y-3">
              {(partners || []).filter(p => !p.isDeleted).slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center text-orange-500 text-xs font-bold">
                    <Briefcase className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.specialization || "Partner"}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${!p.isDeleted ? "bg-emerald-500" : "bg-red-500"}`} data-testid={`status-partner-${p.id}`} />
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground py-6 text-center" style={{ display: partners && partners.length > 0 ? 'none' : 'block' }}>Ziadni partneri</p>
        </CardContent>
      </Card>
    ),
    recent_products: () => (
      <Card data-testid="widget-recent-products">
        <CardHeader>
          <CardTitle className="text-base">Posledne produkty</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: products && products.length > 0 ? 'block' : 'none' }}>
            <div className="space-y-3">
              {(products || []).filter(p => !p.isDeleted).slice(0, 5).map(p => (
                <div key={p.id} className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded-md bg-violet-500/10 flex items-center justify-center text-violet-500 text-xs font-bold">
                    <Package className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{p.code}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${!p.isDeleted ? "bg-emerald-500" : "bg-red-500"}`} data-testid={`status-product-${p.id}`} />
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground py-6 text-center" style={{ display: products && products.length > 0 ? 'none' : 'block' }}>Ziadne produkty</p>
        </CardContent>
      </Card>
    ),
    audit_activity: () => (
      <Card data-testid="widget-audit-activity">
        <CardHeader>
          <CardTitle className="text-base">Posledna aktivita</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ display: recentLogs.length > 0 ? 'block' : 'none' }}>
            <div className="space-y-3">
              {recentLogs.map(log => (
                <div key={log.id} className="flex items-center gap-3 text-sm">
                  <div className="w-7 h-7 rounded-md bg-slate-500/10 flex items-center justify-center text-slate-500 text-xs font-bold">
                    <History className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{log.action} - {log.module}</p>
                    <p className="text-xs text-muted-foreground">{log.username} | {log.entityName || ""}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground py-6 text-center" style={{ display: recentLogs.length > 0 ? 'none' : 'block' }}>Ziadna aktivita</p>
        </CardContent>
      </Card>
    ),
    upcoming_events: () => (
      <Card data-testid="widget-upcoming-events">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="text-base">Nadchadzajuce udalosti</CardTitle>
          <Calendar className="w-4 h-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div style={{ display: upcomingEvents && upcomingEvents.length > 0 ? 'block' : 'none' }}>
            <div className="space-y-3">
              {(upcomingEvents || []).slice(0, 5).map(ev => {
                const sd = new Date(ev.startDate);
                const dayStr = `${sd.getDate()}.${sd.getMonth() + 1}.${sd.getFullYear()}`;
                const timeStr = ev.allDay ? "Celodenni" : `${String(sd.getHours()).padStart(2, "0")}:${String(sd.getMinutes()).padStart(2, "0")}`;
                return (
                  <div key={ev.id} className="flex items-center gap-3 text-sm" data-testid={`upcoming-event-${ev.id}`}>
                    <div className="w-3 h-8 rounded-sm flex-shrink-0" style={{ backgroundColor: ev.color || "#3b82f6" }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{ev.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {dayStr} {timeStr}
                      </p>
                    </div>
                    <span style={{ display: ev.allDay ? 'inline' : 'none' }}><Badge variant="secondary" className="text-[10px]">Celodenni</Badge></span>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-sm text-muted-foreground py-6 text-center" style={{ display: upcomingEvents && upcomingEvents.length > 0 ? 'none' : 'block' }} data-testid="text-no-upcoming">Ziadne nadchadzajuce udalosti</p>
        </CardContent>
      </Card>
    ),
    red_list_recent: () => isAdminUser ? (
      <Card data-testid="widget-red-list-recent">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            Posledné presuny na červený zoznam
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentRedListConfirmed && recentRedListConfirmed.length > 0 ? (
            <div className="space-y-3">
              {recentRedListConfirmed.map((item: any) => (
                <div key={item.id} className="flex items-center gap-3 text-sm border-l-2 border-orange-500 pl-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-orange-300">{item.subjectName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{formatUid(item.subjectUid)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.resolvedAt ? new Date(item.resolvedAt).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      {item.resolvedByName ? ` — ${item.resolvedByName}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-orange-700 text-orange-400 text-[10px]">
                    {item.bonitaPoints} bodov
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Žiadne posledné presuny</p>
          )}
        </CardContent>
      </Card>
    ) : null,

    black_list_recent: () => isAdminUser ? (
      <Card data-testid="widget-black-list-recent">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="w-4 h-4 text-red-500" />
            Čierny zoznam — posledné presuny
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentBlackList && recentBlackList.length > 0 ? (
            <div className="space-y-3">
              {recentBlackList.map((item: any) => (
                <div key={item.id} className="flex items-start gap-3 text-sm border-l-2 border-red-700 pl-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-red-300">{item.subjectName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{formatUid(item.subjectUid)}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.addedAt ? new Date(item.addedAt).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                      {item.addedByName ? ` — ${item.addedByName}` : ""}
                    </p>
                    {item.reason && (
                      <p className="text-xs text-red-400/80 mt-1 truncate" title={item.reason}>{item.reason}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="border-red-800 text-red-400 text-[10px] shrink-0">
                    <Ban className="w-3 h-3 mr-1" />
                    Blokovaný
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">Žiadne posledné presuny</p>
          )}
        </CardContent>
      </Card>
    ) : null,
  };

  const customTooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "6px",
    fontSize: "12px",
    color: "hsl(var(--foreground))",
  };

  return (
    <div className="space-y-6">
      <Dialog open={redListDialogOpen} onOpenChange={setRedListDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="w-5 h-5" />
              Upozornenie — Červený zoznam
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              Nasledujúce subjekty dosiahli bonita skóre ≤ -5 bodov a čakajú na vaše rozhodnutie o zaradení na červený zoznam.
            </p>
            {(redListAlerts || []).map((alert: any) => (
              <div key={alert.id} className="rounded border border-orange-800 bg-orange-950/50 p-4 space-y-3" data-testid={`red-list-alert-card-${alert.id}`}>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-orange-300">{alert.subjectName}</p>
                  <p className="text-xs font-mono text-muted-foreground">{formatUid(alert.subjectUid)}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Bonita: <span className="text-orange-400 font-semibold">{alert.bonitaPoints} bodov</span></span>
                    <span>Odložené: <span className="font-semibold">{alert.dismissCount}×</span></span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => dismissAlertMutation.mutate(alert.id)}
                    disabled={dismissAlertMutation.isPending}
                    data-testid={`btn-dismiss-alert-${alert.id}`}
                  >
                    {dismissAlertMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
                    OK, ideme ďalej
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 text-xs bg-orange-700 hover:bg-orange-600"
                    onClick={() => confirmAlertMutation.mutate(alert.id)}
                    disabled={confirmAlertMutation.isPending}
                    data-testid={`btn-confirm-redlist-${alert.id}`}
                  >
                    {confirmAlertMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5 mr-1" />}
                    Presunúť do červeného zoznamu
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-dashboard-title">Prehľad</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Vitajte, {appUser?.firstName || "Admin"}. Celkový prehľad systému.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? <>
            <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-layout">
              <X className="w-4 h-4 mr-1" />
              Zrušiť úpravy
            </Button>
            <Button onClick={handleSave} disabled={saveLayoutMutation.isPending} data-testid="button-save-layout">
              <Save className="w-4 h-4 mr-1" />
              Uložiť rozloženie
            </Button>
          </> : <>
            <Button variant="outline" onClick={handleStartEdit} data-testid="button-edit-layout">
              <Pencil className="w-4 h-4 mr-1" />
              Upraviť rozloženie
            </Button>
          </>}
        </div>
      </div>

      {/* === SMART FILTER BAR === */}
      <Card data-testid="card-filter-bar">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Filtre analytiky</span>
            {analyticsLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground ml-auto" />}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 items-end">
            <div>
              <Label className="text-xs">Časové obdobie</Label>
              <Select value={timePreset} onValueChange={setTimePreset}>
                <SelectTrigger data-testid="select-time-preset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_PRESETS.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {timePreset === "custom" && (
              <>
                <div>
                  <Label className="text-xs">Od</Label>
                  <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} data-testid="input-custom-from" />
                </div>
                <div>
                  <Label className="text-xs">Do</Label>
                  <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} data-testid="input-custom-to" />
                </div>
              </>
            )}

            <div>
              <Label className="text-xs">Fáza životného cyklu</Label>
              <Select value={phaseFilter} onValueChange={setPhaseFilter}>
                <SelectTrigger data-testid="select-phase-filter">
                  <SelectValue placeholder="Všetky fázy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky fázy</SelectItem>
                  {Object.entries(LIFECYCLE_PHASES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{`F${k}: ${v}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Sprievodka</Label>
              <Select value={inventoryFilter} onValueChange={setInventoryFilter}>
                <SelectTrigger data-testid="select-inventory-filter">
                  <SelectValue placeholder="Všetky" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetky sprievodky</SelectItem>
                  {inventories.map(inv => (
                    <SelectItem key={inv.id} value={String(inv.id)}>{inv.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* === QUICK STATS === */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3" data-testid="quick-stats">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Celkový počet zmlúv</CardTitle>
            <div className="p-2 rounded-md bg-blue-500/10 text-blue-500">
              <FileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-qs-total">{qs?.totalContracts ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">vo filtrovanom období</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Nevybavené výhrady</CardTitle>
            <div className="p-2 rounded-md bg-red-500/10 text-red-500">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400" data-testid="text-qs-objections">{qs?.pendingObjections ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">zmluvy vo fáze 3</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Počet sprievodiek</CardTitle>
            <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500">
              <Send className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold" data-testid="text-qs-sprievodky">{qs?.sprievodkyCount ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">aktívnych protokolov</p>
          </CardContent>
        </Card>
      </div>

      {/* === ANALYTICS CHARTS === */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        {/* Trend Skenovania - Area Chart */}
        <Card className="lg:col-span-2" data-testid="chart-scan-trend">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Trend skenovania zmlúv
            </CardTitle>
            <p className="text-xs text-muted-foreground">Kumulatívny prírastok nahraných zmlúv v čase</p>
          </CardHeader>
          <CardContent>
            {scanTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={scanTrend}>
                  <defs>
                    <linearGradient id="gradientBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={d => { const parts = d.split("-"); return `${parts[2]}.${parts[1]}`; }} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={customTooltipStyle} labelFormatter={d => `Dátum: ${d}`} formatter={(v: number) => [`${v} zmlúv`, "Kumulatívne"]} />
                  <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" fill="url(#gradientBlue)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </CardContent>
        </Card>

        {/* Distribúcia Fáz - Donut Chart */}
        <Card data-testid="chart-phase-distribution">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-emerald-500" />
              Distribúcia fáz
            </CardTitle>
            <p className="text-xs text-muted-foreground">Rozdelenie zmlúv podľa životného cyklu</p>
          </CardHeader>
          <CardContent>
            {phaseDistribution.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={phaseDistribution}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      label={({ label, count }) => `${count}`}
                    >
                      {phaseDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={customTooltipStyle} formatter={(v: number, name: string) => [`${v} zmlúv`, name]} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                  {phaseDistribution.map((entry, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted-foreground">F{entry.phase}: {entry.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChartState />
            )}
          </CardContent>
        </Card>

        {/* Kvalita Procesu - Stacked Bar Chart */}
        <Card data-testid="chart-quality-process">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Kvalita procesu
            </CardTitle>
            <p className="text-xs text-muted-foreground">Prijaté vs. výhrady v čase</p>
          </CardHeader>
          <CardContent>
            {qualityProcess.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={qualityProcess}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={formatMonthLabel} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={customTooltipStyle} labelFormatter={formatMonthLabel} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="accepted" name="Prijaté" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="objections" name="Výhrady" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </CardContent>
        </Card>

        {/* Aktivita Protokolov - Bar Chart */}
        <Card className="lg:col-span-2" data-testid="chart-protocol-activity">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-violet-500" />
              Aktivita sprievodiek
            </CardTitle>
            <p className="text-xs text-muted-foreground">Počet vytvorených odovzdávacích protokolov po mesiacoch</p>
          </CardHeader>
          <CardContent>
            {protocolActivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={protocolActivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickFormatter={formatMonthLabel} />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                  <Tooltip contentStyle={customTooltipStyle} labelFormatter={formatMonthLabel} formatter={(v: number) => [`${v} sprievodiek`, "Počet"]} />
                  <Bar dataKey="count" name="Sprievodky" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChartState />
            )}
          </CardContent>
        </Card>
      </div>

      {/* === EXISTING WIDGETS === */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={displayOrder} strategy={rectSortingStrategy}>
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {displayOrder.map(key => {
              const renderer = widgetRenderers[key];
              if (!renderer) return null;
              return (
                <SortableWidget key={key} id={key} isEditing={isEditing}>
                  {renderer()}
                </SortableWidget>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
