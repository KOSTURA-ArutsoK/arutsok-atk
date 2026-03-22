import { useState, useCallback, useMemo, useEffect } from "react";
import { useMyCompanies } from "@/hooks/use-companies";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Users, Building2, ShieldAlert, TrendingUp, Briefcase, Package, History, Calendar, Clock, GripVertical, Pencil, Save, X, FileText, FileCheck, AlertCircle, Banknote, AlertTriangle, ArrowRight, Loader2, Ban, ClipboardCheck } from "lucide-react";
import { ExpiryBadge, getExpiryStatus } from "@/components/expiry-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAppUser } from "@/hooks/use-app-user";
import type { Subject, Partner, Product, AuditLog, DashboardPreference, CalendarEvent, UserDashboardLayout } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { cn, formatDateTimeSlovak, formatUid } from "@/lib/utils";

const WIDGET_KEYS = ["stats", "recent_subjects", "my_companies", "recent_partners", "recent_products", "audit_activity", "upcoming_events", "my_tasks", "red_list_recent", "black_list_recent"];

const DOCUMENT_EXPIRY_KEYS = [
  "op_platnost",
  "pas_platnost",
  "vodic_platnost",
  "pobyt_platnost",
  "povolenie_platnost",
  "prukaz_platnost",
];

function getNearestDocExpiry(subject: Subject): string | null {
  const dyn = (subject as any)?.details?.dynamicFields as Record<string, string> | undefined;
  if (!dyn) return null;
  let nearest: string | null = null;
  let nearestDays: number | null = null;
  for (const key of DOCUMENT_EXPIRY_KEYS) {
    const val = dyn[key];
    if (!val) continue;
    const status = getExpiryStatus(val);
    if (!status) continue;
    const d = new Date(val);
    if (isNaN(d.getTime())) continue;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (nearestDays === null || days < nearestDays) {
      nearestDays = days;
      nearest = val;
    }
  }
  return nearest;
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
  hasManualVerification: boolean;
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
  const { data: myTasksData } = useQuery<{ tasks: any[]; subjects: any[]; interventions: any[]; interventionStatuses: any[]; internalInterventions: any[]; rejectedContracts: any[]; archivedContracts: any[] }>({ queryKey: ["/api/my-tasks"] });
  const myTasks = myTasksData?.tasks || [];
  const myInterventions = myTasksData?.interventions || [];
  const myInternalInterventions = myTasksData?.internalInterventions || [];
  const myRejectedContracts = myTasksData?.rejectedContracts || [];
  const myArchivedContracts = myTasksData?.archivedContracts || [];
  const myTotalTasks = myTasks.length + myInterventions.length + myInternalInterventions.length + myRejectedContracts.length + myArchivedContracts.length;

  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editOrder, setEditOrder] = useState<string[]>([]);
  const [redListDialogOpen, setRedListDialogOpen] = useState(false);
  const [loginHistoryOpen, setLoginHistoryOpen] = useState(false);

  const { data: loginHistory } = useQuery<{ id: number; appUserId: number; loginAt: string; logoutAt: string | null; ipAddress: string | null }[]>({
    queryKey: ["/api/app-user/login-history"],
    enabled: loginHistoryOpen,
  });

  const formatDuration = (loginAt: string, logoutAt: string | null): string => {
    if (!logoutAt) return "—";
    const ms = new Date(logoutAt).getTime() - new Date(loginAt).getTime();
    if (ms < 0) return "—";
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

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
        const hasManual = contractStats?.hasManualVerification;
        const parts: string[] = [];
        if (ids && ids.length > 0) parts.push(`statusIds=${ids.join(",")}`);
        if (hasManual) parts.push("needsManualVerification=true");
        navigate(parts.length > 0 ? `/contracts?${parts.join("&")}` : "/contracts");
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
              {(subjects || []).slice(0, 5).map(s => {
                const docExpiry = getNearestDocExpiry(s);
                return (
                  <div key={s.id} className="flex items-center gap-3 text-sm" data-testid={`subject-row-${s.id}`}>
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                      {s.type === "person" ? "O" : "F"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {s.type === "person" ? `${s.lastName}, ${s.firstName}` : s.companyName}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono whitespace-nowrap">{formatUid(s.uid)}</p>
                    </div>
                    {docExpiry && (
                      <ExpiryBadge date={docExpiry} compact showIcon={false} className="text-[10px] shrink-0" />
                    )}
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.isActive ? "bg-emerald-500" : "bg-red-500"}`} data-testid={`status-subject-${s.id}`} />
                  </div>
                );
              })}
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
    my_tasks: () => {
      const subjectsMap = new Map((myTasksData?.subjects || []).map((s: any) => [s.id, s]));
      const intStatusMap = new Map((myTasksData?.interventionStatuses || []).map((s: any) => [s.id, s.name]));
      const getSubjectLabel = (id: number) => {
        const s = subjectsMap.get(id);
        if (!s) return `${id}`;
        if (s.firstName || s.lastName) return `${s.firstName || ""} ${s.lastName || ""}`.trim();
        if (s.companyName) return s.companyName;
        return s.uid || `${id}`;
      };
      return (
        <Card data-testid="widget-my-tasks">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-amber-500" />
              Moje úlohy
              {myTotalTasks > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white px-1">
                  {myTotalTasks}
                </span>
              )}
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate("/moje-ulohy")} data-testid="btn-widget-my-tasks-detail">
              Zobraziť všetky
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {myTotalTasks > 0 ? (
              <div className="space-y-2">
                {myInterventions.slice(0, 2).map((c: any) => (
                  <div key={`int-${c.id}`} className="flex items-center gap-3 text-sm border-l-2 border-orange-500 pl-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-r" onClick={() => navigate(`/contracts/${c.id}/edit`)} data-testid={`widget-intervention-${c.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Zmluva č. {c.contractNumber || c.uid || `${c.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.statusId ? (intStatusMap.get(c.statusId) || "Intervencia") : "Intervencia"}</p>
                    </div>
                    <Badge variant="outline" className="border-orange-600 text-orange-400 text-[10px] shrink-0">Intervencia</Badge>
                  </div>
                ))}
                {myInternalInterventions.slice(0, 2).map((c: any) => (
                  <div key={`iint-${c.id}`} className="flex items-center gap-3 text-sm border-l-2 border-amber-500 pl-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-r" onClick={() => navigate(`/contracts/${c.id}/edit`)} data-testid={`widget-internal-intervention-${c.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Zmluva č. {c.contractNumber || c.uid || `${c.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">Interná intervencia</p>
                    </div>
                    <Badge variant="outline" className="border-amber-600 text-amber-400 text-[10px] shrink-0">Interná</Badge>
                  </div>
                ))}
                {myRejectedContracts.slice(0, 2).map((c: any) => (
                  <div key={`rej-${c.id}`} className="flex items-center gap-3 text-sm border-l-2 border-red-500 pl-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-r" onClick={() => navigate(`/contracts/${c.id}/edit`)} data-testid={`widget-rejected-${c.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Zmluva č. {c.contractNumber || c.uid || `${c.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">Neprijaté – výhrady</p>
                    </div>
                    <Badge variant="outline" className="border-red-600 text-red-400 text-[10px] shrink-0">Výhrady</Badge>
                  </div>
                ))}
                {myArchivedContracts.slice(0, 2).map((c: any) => (
                  <div key={`arch-${c.id}`} className="flex items-center gap-3 text-sm border-l-2 border-muted-foreground pl-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-r" onClick={() => navigate(`/contracts/${c.id}/edit`)} data-testid={`widget-archived-${c.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Zmluva č. {c.contractNumber || c.uid || `${c.id}`}</p>
                      <p className="text-xs text-muted-foreground truncate">Archív s výhradami</p>
                    </div>
                    <Badge variant="outline" className="border-muted-foreground text-muted-foreground text-[10px] shrink-0">Archív</Badge>
                  </div>
                ))}
                {myTasks.slice(0, 2).map((task: any) => (
                  <div key={task.id} className="flex items-center gap-3 text-sm border-l-2 border-amber-500 pl-3" data-testid={`my-task-item-${task.id}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">Prestup #{task.id} — {getSubjectLabel(task.subjectId)}</p>
                      <p className="text-xs text-muted-foreground truncate">{task.taskRole}</p>
                    </div>
                    <Badge variant="outline" className="border-amber-700 text-amber-400 text-[10px] shrink-0">Čaká</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-no-tasks">Nemáte žiadne čakajúce úlohy</p>
            )}
          </CardContent>
        </Card>
      );
    },
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
                      {item.resolvedAt ? formatDateTimeSlovak(item.resolvedAt) : ""}
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
                      {item.addedAt ? formatDateTimeSlovak(item.addedAt) : ""}
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

  return (
    <div className="space-y-6">
      <Dialog open={redListDialogOpen} onOpenChange={setRedListDialogOpen}>
        <DialogContent className="max-w-lg">
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

      <Dialog open={loginHistoryOpen} onOpenChange={setLoginHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Archív prihlásení
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-96 overflow-y-auto pr-1" data-testid="login-history-list">
            {!loginHistory ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Načítava sa...
              </div>
            ) : loginHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 italic">Žiadne záznamy o prihláseniach.</p>
            ) : (
              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">#</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Dátum a čas</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trvanie</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">IP adresa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.map((entry, i) => {
                      const d = new Date(entry.loginAt);
                      return (
                        <tr key={entry.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20" data-testid={`login-history-row-${entry.id}`}>
                          <td className="px-3 py-2 text-muted-foreground text-xs">{loginHistory.length - i}</td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {formatDateTimeSlovak(d)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-xs tabular-nums">
                            {formatDuration(entry.loginAt, entry.logoutAt)}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground font-mono text-xs">{entry.ipAddress || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-dashboard-title">Prehľad</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Vitajte, {appUser?.firstName || "Admin"}. Celkový prehľad systému.
          </p>
          {(() => {
            const raw = (appUser as any)?.lastLoginAt;
            const lastLoginAt = raw ? new Date(raw) : null;
            function fmtRelative(date: Date) {
              const diffMs = new Date().getTime() - date.getTime();
              const m = Math.floor(diffMs / 60000), h = Math.floor(diffMs / 3600000), d = Math.floor(diffMs / 86400000);
              if (d >= 1) return `pred ${d} dňami`;
              if (h >= 1) return `pred ${h} hodinami`;
              if (m >= 1) return `pred ${m} minútami`;
              return "pred menej ako minútou";
            }
            return (
              <button
                type="button"
                onClick={() => setLoginHistoryOpen(true)}
                className="flex items-center gap-2 mt-2 group cursor-pointer hover:opacity-80 transition-opacity text-left"
                data-testid="banner-admin-login-status"
              >
                <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                  <span className="font-semibold uppercase tracking-wide text-[10px]">Login Status</span>
                  {" — "}
                  {lastLoginAt ? (
                    <>
                      {lastLoginAt.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" }).replace(/\s/g, "")}
                      {" "}{lastLoginAt.toLocaleTimeString("sk-SK", { hour: "2-digit", minute: "2-digit" })}
                      {" "}
                      <span className="opacity-70">({fmtRelative(lastLoginAt)})</span>
                    </>
                  ) : (
                    <span className="italic opacity-60">prvé prihlásenie</span>
                  )}
                  <span className="ml-1.5 opacity-40 text-[10px]">▸ archív</span>
                </span>
              </button>
            );
          })()}
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
