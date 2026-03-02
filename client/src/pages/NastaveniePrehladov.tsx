import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Eye, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { DashboardPreference } from "@shared/schema";

const DASHBOARD_WIDGETS = [
  { key: "stats", label: "Statistiky (pocet subjektov, spolocnosti, upozornenia, provizie)" },
  { key: "recent_subjects", label: "Posledne subjekty" },
  { key: "my_companies", label: "Moje spolocnosti" },
  { key: "recent_partners", label: "Posledni partneri" },
  { key: "recent_products", label: "Posledne produkty" },
  { key: "audit_activity", label: "Posledna aktivita (audit log)" },
  { key: "upcoming_events", label: "Nadchadzajuce udalosti (kalendar)" },
  { key: "my_tasks", label: "Moje úlohy (čakajúce schválenia)" },
];

export default function NastaveniePrehladov() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dashboardPrefs, isLoading } = useQuery<DashboardPreference[]>({
    queryKey: ["/api/dashboard-preferences"],
  });

  const enabledWidgets = new Set(
    dashboardPrefs
      ? dashboardPrefs.filter(p => p.enabled).map(p => p.widgetKey)
      : DASHBOARD_WIDGETS.map(w => w.key)
  );
  const hasPrefs = dashboardPrefs && dashboardPrefs.length > 0;

  const saveDashPrefsMutation = useMutation({
    mutationFn: async (preferences: { widgetKey: string; enabled: boolean }[]) => {
      await apiRequest("POST", "/api/dashboard-preferences", { preferences });
    },
    onSuccess: () => {
      toast({ title: "Ulozene", description: "Prehlad bol aktualizovany." });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-preferences"] });
    },
    onError: () => {
      toast({ title: "Chyba", variant: "destructive" });
    },
  });

  const handleWidgetToggle = (widgetKey: string, checked: boolean) => {
    const newPrefs = DASHBOARD_WIDGETS.map(w => ({
      widgetKey: w.key,
      enabled: w.key === widgetKey ? checked : (hasPrefs ? enabledWidgets.has(w.key) : true),
    }));
    saveDashPrefsMutation.mutate(newPrefs);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Eye className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Nastavenie prehladov</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Nastavenie prehladov</CardTitle>
            <div className="p-2 rounded-md bg-indigo-500/10 text-indigo-500">
              <Eye className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Vyberte, ktore widgety chcete zobrazit na hlavnom prehladu (Dashboard).
            </p>
            <div className="space-y-3">
              {DASHBOARD_WIDGETS.map(w => {
                const isEnabled = hasPrefs ? enabledWidgets.has(w.key) : true;
                return (
                  <div key={w.key} className="flex items-center gap-3" data-testid={`pref-widget-${w.key}`}>
                    <Checkbox
                      id={`widget-${w.key}`}
                      checked={isEnabled}
                      onCheckedChange={(checked) => handleWidgetToggle(w.key, !!checked)}
                      data-testid={`checkbox-widget-${w.key}`}
                    />
                    <Label htmlFor={`widget-${w.key}`} className="text-sm cursor-pointer flex-1">
                      {w.label}
                    </Label>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
