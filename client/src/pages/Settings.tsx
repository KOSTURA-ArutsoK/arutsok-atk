import { useState, useEffect } from "react";
import { useAppUser } from "@/hooks/use-app-user";
import { useMyCompanies } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Settings as SettingsIcon, Shield, Database, Info, Building2, Globe,
  Lock, Phone, Save, Clock, LayoutDashboard, Plus, Trash2, Eye
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { CategoryTimeout, DashboardPreference } from "@shared/schema";

const DASHBOARD_WIDGETS = [
  { key: "stats", label: "Statistiky (pocet subjektov, spolocnosti, upozornenia, provizie)" },
  { key: "recent_subjects", label: "Posledne subjekty" },
  { key: "my_companies", label: "Moje spolocnosti" },
  { key: "recent_partners", label: "Posledni partneri" },
  { key: "recent_products", label: "Posledne produkty" },
  { key: "audit_activity", label: "Posledna aktivita (audit log)" },
];

export default function Settings() {
  const { data: appUser } = useAppUser();
  const { data: companies } = useMyCompanies();
  const { data: states } = useStates();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: supportPhoneData } = useQuery<{ value: string | null }>({
    queryKey: ["/api/system-settings", "support_phone"],
    queryFn: async () => {
      const res = await fetch("/api/system-settings/support_phone");
      return res.json();
    },
  });

  const { data: categoryTimeouts } = useQuery<CategoryTimeout[]>({
    queryKey: ["/api/category-timeouts"],
  });

  const { data: dashboardPrefs } = useQuery<DashboardPreference[]>({
    queryKey: ["/api/dashboard-preferences"],
  });

  const [supportPhone, setSupportPhone] = useState<string | null>(null);
  const displayPhone = supportPhone ?? supportPhoneData?.value ?? "";

  const [newCatName, setNewCatName] = useState("");
  const [newCatSeconds, setNewCatSeconds] = useState("180");

  const enabledWidgets = new Set(
    dashboardPrefs
      ? dashboardPrefs.filter(p => p.enabled).map(p => p.widgetKey)
      : DASHBOARD_WIDGETS.map(w => w.key)
  );
  const hasPrefs = dashboardPrefs && dashboardPrefs.length > 0;

  const savePhoneMutation = useMutation({
    mutationFn: async (value: string) => {
      await apiRequest("POST", "/api/system-settings", { key: "support_phone", value });
    },
    onSuccess: () => {
      toast({ title: "Ulozene", description: "Telefonne cislo podpory bolo ulozene." });
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings", "support_phone"] });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa ulozit nastavenie.", variant: "destructive" });
    },
  });

  const createTimeoutMutation = useMutation({
    mutationFn: async (data: { categoryName: string; timeoutSeconds: number }) => {
      await apiRequest("POST", "/api/category-timeouts", data);
    },
    onSuccess: () => {
      toast({ title: "Ulozene", description: "Doba prihlasenia bola vytvorena." });
      queryClient.invalidateQueries({ queryKey: ["/api/category-timeouts"] });
      setNewCatName("");
      setNewCatSeconds("180");
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vytvorit timeout.", variant: "destructive" });
    },
  });

  const updateTimeoutMutation = useMutation({
    mutationFn: async ({ id, timeoutSeconds }: { id: number; timeoutSeconds: number }) => {
      await apiRequest("PATCH", `/api/category-timeouts/${id}`, { timeoutSeconds });
    },
    onSuccess: () => {
      toast({ title: "Ulozene", description: "Doba prihlasenia bola aktualizovana." });
      queryClient.invalidateQueries({ queryKey: ["/api/category-timeouts"] });
    },
    onError: () => {
      toast({ title: "Chyba", variant: "destructive" });
    },
  });

  const deleteTimeoutMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/category-timeouts/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Odstranene" });
      queryClient.invalidateQueries({ queryKey: ["/api/category-timeouts"] });
    },
    onError: () => {
      toast({ title: "Chyba", variant: "destructive" });
    },
  });

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

  const activeCompany = companies?.find(c => c.id === appUser?.activeCompanyId);
  const activeState = states?.find(s => s.id === appUser?.activeStateId);
  const mfaLabel = appUser?.mfaType === "none" ? "Neaktivne" : appUser?.mfaType === "totp" ? "TOTP" : appUser?.mfaType || "Neaktivne";
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-settings-title">Nastavenia</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Konfiguracny panel systemu ArutsoK.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Systemove informacie</CardTitle>
            <div className="p-2 rounded-md bg-blue-500/10 text-blue-500">
              <Info className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Verzia aplikacie</span>
                <span className="text-sm font-medium font-mono" data-testid="text-app-version">ArutsoK v1.0</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Pouzivatel</span>
                <span className="text-sm font-medium" data-testid="text-user-name">
                  {appUser?.firstName} {appUser?.lastName}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Prihlasovacie meno</span>
                <span className="text-sm font-medium font-mono" data-testid="text-username">{appUser?.username}</span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm font-medium" data-testid="text-user-email">{appUser?.email || "\u2014"}</span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Rola</span>
                <Badge variant="secondary" data-testid="badge-user-role">{appUser?.role || "user"}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Kontextove nastavenia</CardTitle>
            <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-500">
              <Building2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Aktivna spolocnost</span>
                <span className="text-sm font-medium" data-testid="text-active-company">
                  {activeCompany?.name || "Nezvolena"}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Aktivny stat</span>
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium" data-testid="text-active-state">
                    {activeState?.name || "Nezvoleny"}
                  </span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Pocet spolocnosti</span>
                <Badge variant="outline" data-testid="badge-company-count">{companies?.length || 0}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Pocet statov</span>
                <Badge variant="outline" data-testid="badge-state-count">{states?.length || 0}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Bezpecnostne nastavenia</CardTitle>
            <div className="p-2 rounded-md bg-amber-500/10 text-amber-500">
              <Shield className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">MFA status</span>
                <Badge
                  variant={appUser?.mfaType === "none" ? "destructive" : "default"}
                  data-testid="badge-mfa-status"
                >
                  <Lock className="h-3 w-3 mr-1" />
                  {mfaLabel}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Bezpecnostna uroven</span>
                <span className="text-sm font-bold font-mono" data-testid="text-security-level">
                  {appUser?.securityLevel || 1}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Skupina opravneni</span>
                <span className="text-sm font-medium" data-testid="text-permission-group">
                  {appUser?.permissionGroupId ? `Skupina #${appUser.permissionGroupId}` : "Nepriradena"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-base">Podpora a registracia</CardTitle>
              <div className="p-2 rounded-md bg-orange-500/10 text-orange-500">
                <Phone className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Telefonne cislo zobrazene klientom pri neuspesnej registracii.
                </p>
                <div>
                  <Label htmlFor="support-phone" className="text-xs">Telefon podpory</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      id="support-phone"
                      type="tel"
                      placeholder="+421 900 000 000"
                      value={displayPhone}
                      onChange={(e) => setSupportPhone(e.target.value)}
                      data-testid="input-support-phone"
                    />
                    <Button
                      size="icon"
                      onClick={() => savePhoneMutation.mutate(supportPhone ?? displayPhone)}
                      disabled={savePhoneMutation.isPending}
                      data-testid="button-save-support-phone"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {isAdmin && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-base">Doba prihlasenia</CardTitle>
              <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-500">
                <Clock className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Nastavte cas automatickeho odhlasenia (v sekundach) pre kazdu kategoriu klientov.
              </p>

              <div className="space-y-2">
                {categoryTimeouts?.map(ct => (
                  <div key={ct.id} className="flex items-center gap-2" data-testid={`timeout-row-${ct.id}`}>
                    <span className="text-sm flex-1 truncate">{ct.categoryName}</span>
                    <Input
                      type="number"
                      className="w-24"
                      defaultValue={ct.timeoutSeconds}
                      onBlur={(e) => {
                        const val = parseInt(e.target.value);
                        if (val && val !== ct.timeoutSeconds) {
                          updateTimeoutMutation.mutate({ id: ct.id, timeoutSeconds: val });
                        }
                      }}
                      data-testid={`input-timeout-${ct.id}`}
                    />
                    <span className="text-xs text-muted-foreground w-6">sek</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteTimeoutMutation.mutate(ct.id)}
                      data-testid={`button-delete-timeout-${ct.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="space-y-2">
                <Label className="text-xs">Pridat novu kategoriu</Label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nazov kategorie"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    className="flex-1"
                    data-testid="input-new-timeout-name"
                  />
                  <Input
                    type="number"
                    placeholder="180"
                    value={newCatSeconds}
                    onChange={(e) => setNewCatSeconds(e.target.value)}
                    className="w-24"
                    data-testid="input-new-timeout-seconds"
                  />
                  <Button
                    size="icon"
                    onClick={() => {
                      if (newCatName.trim()) {
                        createTimeoutMutation.mutate({
                          categoryName: newCatName.trim(),
                          timeoutSeconds: parseInt(newCatSeconds) || 180,
                        });
                      }
                    }}
                    disabled={createTimeoutMutation.isPending || !newCatName.trim()}
                    data-testid="button-add-timeout"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">O systeme</CardTitle>
            <div className="p-2 rounded-md bg-purple-500/10 text-purple-500">
              <SettingsIcon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Stav databazy</span>
                <div className="flex items-center gap-2" data-testid="status-database">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium">Online</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Verzia</span>
                <span className="text-sm font-medium font-mono" data-testid="text-system-version">v1.0.0</span>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Databaza</span>
                <div className="flex items-center gap-2">
                  <Database className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium" data-testid="text-db-tech">PostgreSQL</span>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Technologicky stack</span>
                <span className="text-sm font-medium" data-testid="text-tech-stack">React + Express + Drizzle</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
