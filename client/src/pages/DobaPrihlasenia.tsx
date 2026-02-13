import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Timer, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAppUser } from "@/hooks/use-app-user";
import type { CategoryTimeout } from "@shared/schema";

export default function DobaPrihlasenia() {
  const { data: appUser } = useAppUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const { data: categoryTimeouts, isLoading } = useQuery<CategoryTimeout[]>({
    queryKey: ["/api/category-timeouts"],
  });

  const [newCatName, setNewCatName] = useState("");
  const [newCatSeconds, setNewCatSeconds] = useState("180");

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

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Timer className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Doba prihlasenia</h1>
      </div>

      {!isAdmin ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">Pristup iba pre administratorov.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-base">Nastavenie doby prihlasenia</CardTitle>
            <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-500">
              <Timer className="h-4 w-4" />
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
              {(!categoryTimeouts || categoryTimeouts.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">Ziadne kategorie nastavene.</p>
              )}
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
    </div>
  );
}
