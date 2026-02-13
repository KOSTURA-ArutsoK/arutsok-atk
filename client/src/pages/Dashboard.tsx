import { useMyCompanies } from "@/hooks/use-companies";
import { useQuery } from "@tanstack/react-query";
import { Users, Building2, ShieldAlert, TrendingUp, Briefcase, Package, History, Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppUser } from "@/hooks/use-app-user";
import type { Subject, Partner, Product, AuditLog, DashboardPreference, CalendarEvent } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

const WIDGET_KEYS = ["stats", "recent_subjects", "my_companies", "recent_partners", "recent_products", "audit_activity", "upcoming_events"];

export default function Dashboard() {
  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();
  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
  });
  const { data: partners } = useQuery<Partner[]>({
    queryKey: ["/api/partners"],
  });
  const { data: products } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });
  const { data: auditLogsData } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/audit-logs"],
  });
  const auditLogs = auditLogsData?.logs || [];
  const { data: upcomingEvents } = useQuery<CalendarEvent[]>({
    queryKey: ["/api/calendar-events/upcoming"],
  });
  const { data: dashboardPrefs } = useQuery<DashboardPreference[]>({
    queryKey: ["/api/dashboard-preferences"],
  });

  const hasPrefs = dashboardPrefs && dashboardPrefs.length > 0;
  const enabledWidgets = new Set(
    hasPrefs
      ? dashboardPrefs.filter(p => p.enabled).map(p => p.widgetKey)
      : WIDGET_KEYS
  );

  const isVisible = (key: string) => enabledWidgets.has(key);

  const stats = [
    { title: "Subjekty", value: subjects?.length || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Spolocnosti", value: companies?.length || 0, icon: Building2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Bezpecnostne upozornenia", value: 0, icon: ShieldAlert, color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Provizie", value: "0 EUR", icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  const recentLogs = auditLogs.slice(0, 5);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-dashboard-title">Prehlad</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vitajte, {appUser?.firstName || "Admin"}. Celkovy prehlad systemu.
        </p>
      </div>

      {isVisible("stats") && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" data-testid="widget-stats">
          {stats.map((stat, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <div className={`p-2 rounded-md ${stat.bg} ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid={`text-stat-${i}`}>{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {isVisible("recent_subjects") && (
          <Card data-testid="widget-recent-subjects">
            <CardHeader>
              <CardTitle className="text-base">Posledne subjekty</CardTitle>
            </CardHeader>
            <CardContent>
              {subjects && subjects.length > 0 ? (
                <div className="space-y-3">
                  {subjects.slice(0, 5).map(s => (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                        {s.type === "person" ? "O" : "F"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {s.type === "person" ? `${s.lastName}, ${s.firstName}` : s.companyName}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate">{s.uid}</p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${s.isActive ? "bg-emerald-500" : "bg-red-500"}`} data-testid={`status-subject-${s.id}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Ziadne subjekty</p>
              )}
            </CardContent>
          </Card>
        )}

        {isVisible("my_companies") && (
          <Card data-testid="widget-my-companies">
            <CardHeader>
              <CardTitle className="text-base">Moje spolocnosti</CardTitle>
            </CardHeader>
            <CardContent>
              {companies && companies.length > 0 ? (
                <div className="space-y-3">
                  {companies.map(c => (
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
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Ziadne spolocnosti</p>
              )}
            </CardContent>
          </Card>
        )}

        {isVisible("recent_partners") && (
          <Card data-testid="widget-recent-partners">
            <CardHeader>
              <CardTitle className="text-base">Posledni partneri</CardTitle>
            </CardHeader>
            <CardContent>
              {partners && partners.length > 0 ? (
                <div className="space-y-3">
                  {partners.filter(p => !p.isDeleted).slice(0, 5).map(p => (
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
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Ziadni partneri</p>
              )}
            </CardContent>
          </Card>
        )}

        {isVisible("recent_products") && (
          <Card data-testid="widget-recent-products">
            <CardHeader>
              <CardTitle className="text-base">Posledne produkty</CardTitle>
            </CardHeader>
            <CardContent>
              {products && products.length > 0 ? (
                <div className="space-y-3">
                  {products.filter(p => !p.isDeleted).slice(0, 5).map(p => (
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
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Ziadne produkty</p>
              )}
            </CardContent>
          </Card>
        )}

        {isVisible("audit_activity") && (
          <Card data-testid="widget-audit-activity">
            <CardHeader>
              <CardTitle className="text-base">Posledna aktivita</CardTitle>
            </CardHeader>
            <CardContent>
              {recentLogs.length > 0 ? (
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
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center">Ziadna aktivita</p>
              )}
            </CardContent>
          </Card>
        )}

        {isVisible("upcoming_events") && (
          <Card data-testid="widget-upcoming-events">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <CardTitle className="text-base">Nadchadzajuce udalosti</CardTitle>
              <Calendar className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {upcomingEvents && upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.slice(0, 5).map(ev => {
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
                        {ev.allDay && <Badge variant="secondary" className="text-[10px]">Celodenni</Badge>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-6 text-center" data-testid="text-no-upcoming">Ziadne nadchadzajuce udalosti</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
