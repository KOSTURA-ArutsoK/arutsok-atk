import { useSubjects } from "@/hooks/use-subjects";
import { useMyCompanies } from "@/hooks/use-companies";
import { ShieldAlert, Users, Building, TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid 
} from 'recharts';

export default function Dashboard() {
  const { data: subjects } = useSubjects();
  const { data: companies } = useMyCompanies();

  const stats = [
    {
      title: "Total Subjects",
      value: subjects?.length || 0,
      icon: Users,
      trend: "+2.5%",
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      title: "Active Companies",
      value: companies?.length || 0,
      icon: Building,
      trend: "Stable",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      title: "Security Alerts",
      value: "0",
      icon: ShieldAlert,
      trend: "Clear",
      color: "text-amber-500",
      bg: "bg-amber-500/10"
    },
    {
      title: "Commission Volume",
      value: "€24.5k",
      icon: TrendingUp,
      trend: "+12%",
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    }
  ];

  const chartData = [
    { name: 'Mon', value: 400 },
    { name: 'Tue', value: 300 },
    { name: 'Wed', value: 500 },
    { name: 'Thu', value: 280 },
    { name: 'Fri', value: 590 },
    { name: 'Sat', value: 320 },
    { name: 'Sun', value: 450 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-display font-bold">Mission Control</h2>
          <p className="text-muted-foreground mt-1">System status and key metrics overview.</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-card px-3 py-1 rounded border border-border">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          SYSTEM OPERATIONAL
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index} className="dashboard-card border-l-4 border-l-primary/50">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium font-mono text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-md ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">
                <span className={stat.color}>{stat.trend}</span> from last period
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-7">
        <Card className="col-span-4 dashboard-card">
          <CardHeader>
            <CardTitle>Activity Overview</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <YAxis 
                    stroke="#94a3b8" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `€${value}`} 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }}
                    itemStyle={{ color: '#e2e8f0' }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 dashboard-card">
          <CardHeader>
            <CardTitle>Recent Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {subjects?.slice(0, 5).map((subject) => (
                <div key={subject.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-border/50">
                  <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
                    {subject.type === 'person' ? 'P' : 'C'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {subject.type === 'person' ? `${subject.lastName}, ${subject.firstName}` : subject.companyName}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{subject.uid}</p>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${subject.isActive ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </div>
              ))}
              {!subjects?.length && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No activity recorded
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
