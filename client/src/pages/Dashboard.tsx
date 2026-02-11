import { useMyCompanies } from "@/hooks/use-companies";
import { useQuery } from "@tanstack/react-query";
import { Users, Building2, ShieldAlert, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppUser } from "@/hooks/use-app-user";
import type { Subject } from "@shared/schema";

export default function Dashboard() {
  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();
  const { data: subjects } = useQuery<Subject[]>({
    queryKey: ["/api/subjects"],
    queryFn: async () => {
      const res = await fetch("/api/subjects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const stats = [
    { title: "Subjekty", value: subjects?.length || 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { title: "Spolocnosti", value: companies?.length || 0, icon: Building2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { title: "Bezpecnostne upozornenia", value: 0, icon: ShieldAlert, color: "text-amber-500", bg: "bg-amber-500/10" },
    { title: "Provizie", value: "0 EUR", icon: TrendingUp, color: "text-purple-500", bg: "bg-purple-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-dashboard-title">Prehlad</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Vitajte, {appUser?.firstName || "Admin"}. Celkovy prehlad systemu.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
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
                    <div className={`w-2 h-2 rounded-full ${s.isActive ? "bg-emerald-500" : "bg-red-500"}`} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">Ziadne subjekty</p>
            )}
          </CardContent>
        </Card>

        <Card>
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
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-6 text-center">Ziadne spolocnosti</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
