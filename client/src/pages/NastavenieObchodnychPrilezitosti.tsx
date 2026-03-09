import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Target } from "lucide-react";

export default function NastavenieObchodnychPrilezitosti() {
  const { toast } = useToast();
  const [text, setText] = useState("");

  const { data: setting, isLoading } = useQuery<{ value: string | null }>({
    queryKey: ["/api/system-settings/obchodne_prilezitosti_text"],
  });

  useEffect(() => {
    if (setting?.value) {
      setText(setting.value);
    }
  }, [setting]);

  const saveMutation = useMutation({
    mutationFn: async (value: string) => {
      await apiRequest("POST", "/api/system-settings", {
        key: "obchodne_prilezitosti_text",
        value,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings/obchodne_prilezitosti_text"] });
      toast({ title: "Ulozene", description: "Nastavenie obchodnych prilezitosti bolo ulozene." });
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
                Tento text sa zobrazi na stranke Obchodne prilezitosti.
              </p>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Zadajte text obchodnych prilezitosti..."
                className="min-h-[300px] font-mono text-sm"
                data-testid="textarea-prilezitosti"
              />
              <div className="flex justify-end">
                <Button
                  onClick={() => saveMutation.mutate(text)}
                  disabled={saveMutation.isPending}
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
