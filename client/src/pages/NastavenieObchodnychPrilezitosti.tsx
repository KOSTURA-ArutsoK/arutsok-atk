import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Target } from "lucide-react";
import { useAppUser } from "@/hooks/use-app-user";

interface Division {
  id: number;
  companyId: number;
  divisionId: number;
  division: {
    id: number;
    name: string;
    emoji: string;
    isActive: boolean;
  };
}

export default function NastavenieObchodnychPrilezitosti() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const [text, setText] = useState("");
  const [selectedDivisionId, setSelectedDivisionId] = useState<number | null>(null);
  const lastCompanyIdRef = useRef<number | null>(null);

  const activeCompanyId = appUser?.activeCompanyId;

  const { data: companyDivisions } = useQuery<Division[]>({
    queryKey: ["/api/companies", activeCompanyId, "divisions"],
    queryFn: async () => {
      const res = await fetch(`/api/companies/${activeCompanyId}/divisions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!activeCompanyId,
  });

  useEffect(() => {
    if (!activeCompanyId || !companyDivisions) return;

    if (lastCompanyIdRef.current !== activeCompanyId) {
      lastCompanyIdRef.current = activeCompanyId;
      setSelectedDivisionId(null);
    }

    if (selectedDivisionId) {
      const stillValid = companyDivisions.some(d => d.divisionId === selectedDivisionId);
      if (!stillValid) {
        setSelectedDivisionId(null);
      }
    }

    if (!selectedDivisionId && companyDivisions.length > 0) {
      if (appUser?.activeDivisionId) {
        const found = companyDivisions.find(d => d.divisionId === appUser.activeDivisionId);
        if (found) {
          setSelectedDivisionId(found.divisionId);
          return;
        }
      }
      setSelectedDivisionId(companyDivisions[0].divisionId);
    }
  }, [companyDivisions, activeCompanyId, appUser?.activeDivisionId]);

  const settingsKey = selectedDivisionId ? `obchodne_prilezitosti_div_${selectedDivisionId}` : null;

  const { data: setting, isLoading } = useQuery<{ value: string | null }>({
    queryKey: ["/api/system-settings", settingsKey],
    queryFn: async () => {
      const res = await fetch(`/api/system-settings/${settingsKey}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!settingsKey,
  });

  useEffect(() => {
    setText(setting?.value || "");
  }, [setting]);

  const saveMutation = useMutation({
    mutationFn: async (value: string) => {
      if (!settingsKey) throw new Error("Nie je vybrana divizia");
      await apiRequest("POST", "/api/system-settings", {
        key: settingsKey,
        value,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings", settingsKey] });
      toast({ title: "Ulozene", description: "Obchodne prilezitosti boli ulozene pre vybranu diviziu." });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa ulozit", variant: "destructive" });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Target className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Nastavenie obchodnych prilezitosti</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg" data-testid="text-card-title">Text obchodnych prilezitosti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Kazda divizia ma vlastny text obchodnych prilezitosti. Vyberte diviziu a nastavte text.
              </p>

              <div className="space-y-2">
                <label className="text-sm font-medium">Divizia</label>
                <Select
                  value={selectedDivisionId ? String(selectedDivisionId) : ""}
                  onValueChange={(val) => setSelectedDivisionId(parseInt(val))}
                >
                  <SelectTrigger data-testid="select-division-trigger">
                    <SelectValue placeholder="Vyberte diviziu..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companyDivisions?.map((cd) => (
                      <SelectItem
                        key={cd.divisionId}
                        value={String(cd.divisionId)}
                        data-testid={`select-division-${cd.divisionId}`}
                      >
                        {cd.division.emoji} {cd.division.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Zadajte text obchodnych prilezitosti pre vybranu diviziu..."
                className="min-h-[300px] font-mono text-sm"
                data-testid="textarea-prilezitosti"
                disabled={!selectedDivisionId}
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate(text)}
                  disabled={saveMutation.isPending || !selectedDivisionId}
                  data-testid="button-save-prilezitosti"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Ulozit
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
