import { useState } from "react";
import { useAppUser } from "@/hooks/use-app-user";
import { useMyCompanies } from "@/hooks/use-companies";
import { useStates } from "@/hooks/use-hierarchy";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Settings as SettingsIcon, Shield, Database, Info, Building2, Globe, Lock, Phone, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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

  const [supportPhone, setSupportPhone] = useState<string | null>(null);
  const displayPhone = supportPhone ?? supportPhoneData?.value ?? "";

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

  const activeCompany = companies?.find(c => c.id === appUser?.activeCompanyId);
  const activeState = states?.find(s => s.id === appUser?.activeStateId);

  const mfaLabel = appUser?.mfaType === "none" ? "Neaktivne" : appUser?.mfaType === "totp" ? "TOTP" : appUser?.mfaType || "Neaktivne";

  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" data-testid="text-settings-title">Nastavenia</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Konfiguracny panel systemu ArutsoK CRM.
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
                <span className="text-sm font-medium font-mono" data-testid="text-app-version">ArutsoK CRM v1.0</span>
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
                <span className="text-sm font-medium" data-testid="text-user-email">{appUser?.email || "—"}</span>
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
                <span className="text-sm text-muted-foreground">Rola</span>
                <Badge variant="secondary" data-testid="badge-security-role">{appUser?.role || "user"}</Badge>
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
