import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Target } from "lucide-react";
import { useAppUser } from "@/hooks/use-app-user";

export default function ObchodnePrilezitosti() {
  const { data: appUser } = useAppUser();
  const divisionId = appUser?.activeDivisionId;
  const settingsKey = divisionId ? `obchodne_prilezitosti_div_${divisionId}` : null;

  const { data: setting, isLoading } = useQuery<{ value: string | null }>({
    queryKey: ["/api/system-settings", settingsKey],
    queryFn: async () => {
      const res = await fetch(`/api/system-settings/${settingsKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!settingsKey,
  });

  const content = setting?.value || "";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Target className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Obchodne prilezitosti</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg" data-testid="text-card-title">Aktualne obchodne prilezitosti</CardTitle>
        </CardHeader>
        <CardContent>
          {!divisionId ? (
            <p className="text-muted-foreground text-sm" data-testid="text-no-division">
              Vyberte diviziu pre zobrazenie obchodnych prilezitosti.
            </p>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : content ? (
            <div
              className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap"
              data-testid="text-prilezitosti-content"
            >
              {content}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm" data-testid="text-no-content">
              Ziadne obchodne prilezitosti nie su momentalne nastavene pre tuto diviziu.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
