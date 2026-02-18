import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useTableSort } from "@/hooks/use-table-sort";
import { useSmartFilter } from "@/hooks/use-smart-filter";
import type { SmartColumnDef } from "@/hooks/use-smart-filter";
import { SmartFilterBar } from "@/components/smart-filter-bar";
import { Timer, Loader2 } from "lucide-react";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
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

const COLUMNS: ColumnDef[] = [
  { key: "name", label: "Skupina" },
  { key: "description", label: "Popis" },
  { key: "sessionTimeoutSeconds", label: "Timeout (sek)" },
  { key: "time", label: "Cas" },
];

const FILTER_COLUMNS: SmartColumnDef[] = [
  { key: "name", label: "Skupina", type: "text" },
  { key: "description", label: "Popis", type: "text" },
  { key: "sessionTimeoutSeconds", label: "Timeout (sek)", type: "number" },
];

export default function DobaPrihlasenia() {
  const { data: appUser } = useAppUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const { data: groups, isLoading } = useQuery<PermissionGroup[]>({
    queryKey: ["/api/permission-groups"],
  });

  const tableFilter = useSmartFilter(groups || [], FILTER_COLUMNS, "doba-prihlasenia");
  const { sortedData: sortedGroups, sortKey, sortDirection, requestSort } = useTableSort(tableFilter.filteredData);
  const columnVisibility = useColumnVisibility("doba-prihlasenia", COLUMNS);

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Timer className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Doba prihlasenia</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SmartFilterBar filter={tableFilter} />
          <ColumnManager columnVisibility={columnVisibility} />
        </div>
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
                  {columnVisibility.isVisible("name") && <TableHead sortKey="name" sortDirection={sortKey === "name" ? sortDirection : null} onSort={requestSort}>Skupina</TableHead>}
                  {columnVisibility.isVisible("description") && <TableHead sortKey="description" sortDirection={sortKey === "description" ? sortDirection : null} onSort={requestSort}>Popis</TableHead>}
                  {columnVisibility.isVisible("sessionTimeoutSeconds") && <TableHead className="w-36" sortKey="sessionTimeoutSeconds" sortDirection={sortKey === "sessionTimeoutSeconds" ? sortDirection : null} onSort={requestSort}>Timeout (sek)</TableHead>}
                  {columnVisibility.isVisible("time") && <TableHead className="w-32">Cas</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedGroups && sortedGroups.length > 0 ? (
                  sortedGroups.map(group => (
                    <TableRow key={group.id} data-testid={`timeout-row-${group.id}`}>
                      {columnVisibility.isVisible("name") && <TableCell className="font-medium" data-testid={`text-group-name-${group.id}`}>
                        {group.name}
                      </TableCell>}
                      {columnVisibility.isVisible("description") && <TableCell className="text-muted-foreground text-sm">
                        {group.description || "-"}
                      </TableCell>}
                      {columnVisibility.isVisible("sessionTimeoutSeconds") && <TableCell>
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
                      </TableCell>}
                      {columnVisibility.isVisible("time") && <TableCell className="text-sm text-muted-foreground" data-testid={`text-timeout-display-${group.id}`}>
                        {formatTime(group.sessionTimeoutSeconds ?? 180)}
                      </TableCell>}
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
