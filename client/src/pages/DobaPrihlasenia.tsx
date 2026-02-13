import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Timer, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAppUser } from "@/hooks/use-app-user";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PermissionGroup } from "@shared/schema";

export default function DobaPrihlasenia() {
  const { data: appUser } = useAppUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const { data: groups, isLoading } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
  });

  const updateTimeoutMutation = useMutation({
    mutationFn: async ({ id, sessionTimeoutSeconds }: { id: number; sessionTimeoutSeconds: number }) => {
      await apiRequest("PUT", `/api/permission-groups/${id}`, { sessionTimeoutSeconds });
    },
    onSuccess: () => {
      toast({ title: "Ulozene", description: "Doba prihlasenia bola aktualizovana." });
      queryClient.invalidateQueries({ queryKey: ["/api/permission-groups"] });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa aktualizovat dobu prihlasenia.", variant: "destructive" });
    },
  });

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m} min ${s} sek`;
  };

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
            <CardTitle className="text-base">Nastavenie doby prihlasenia podla skupin</CardTitle>
            <div className="p-2 rounded-md bg-cyan-500/10 text-cyan-500">
              <Timer className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Nastavte cas automatickeho odhlasenia (v sekundach) pre kazdu skupinu pravomoci. Minimalna hodnota je 60 sekund. Zmeny sa prejavuju na oboch miestach (tu aj v Pravomoci skupiny).
            </p>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Skupina</TableHead>
                  <TableHead>Popis</TableHead>
                  <TableHead className="w-36">Timeout (sek)</TableHead>
                  <TableHead className="w-32">Cas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups && groups.length > 0 ? (
                  groups.map(group => (
                    <TableRow key={group.id} data-testid={`timeout-row-${group.id}`}>
                      <TableCell className="font-medium" data-testid={`text-group-name-${group.id}`}>
                        {group.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {group.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={60}
                          className="w-28"
                          defaultValue={group.sessionTimeoutSeconds ?? 180}
                          onBlur={(e) => {
                            const val = parseInt(e.target.value);
                            if (!val || val < 60) {
                              e.target.value = String(group.sessionTimeoutSeconds ?? 180);
                              toast({ title: "Chyba", description: "Minimalna doba prihlasenia je 60 sekund.", variant: "destructive" });
                              return;
                            }
                            if (val !== (group.sessionTimeoutSeconds ?? 180)) {
                              updateTimeoutMutation.mutate({ id: group.id, sessionTimeoutSeconds: val });
                            }
                          }}
                          data-testid={`input-timeout-${group.id}`}
                        />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-timeout-display-${group.id}`}>
                        {formatTime(group.sessionTimeoutSeconds ?? 180)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Ziadne skupiny pravomoci. Vytvorte ich v sekcii Pravomoci skupiny.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
