import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AuditLog } from "@shared/schema";
import { History as HistoryIcon, Search, Filter, ChevronLeft, ChevronRight, Clock, User, Database } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const MODULE_LABELS: Record<string, string> = {
  spolocnosti: "Spolocnosti",
  partneri: "Partneri",
  subjekty: "Subjekty",
  produkty: "Produkty",
  provizie: "Provizie",
  pouzivatelia: "Pouzivatelia",
  skupiny_pravomoci: "Skupiny pravomoci",
  nastavenia: "Nastavenia",
  dashboard: "Prehlad",
  historia: "Historia",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Vytvorenie",
  UPDATE: "Uprava",
  DELETE: "Vymazanie",
  ARCHIVE: "Archivacia",
  SYNC: "Synchronizacia",
};

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  CREATE: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  ARCHIVE: "outline",
  SYNC: "outline",
};

const PAGE_SIZE = 25;

export default function History() {
  const [filterModule, setFilterModule] = useState<string>("all");
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const [detailLog, setDetailLog] = useState<AuditLog | null>(null);

  const queryParams = new URLSearchParams();
  if (filterModule !== "all") queryParams.set("module", filterModule);
  if (filterAction !== "all") queryParams.set("action", filterAction);
  if (filterUserId !== "all") queryParams.set("userId", filterUserId);
  if (filterDateFrom) queryParams.set("dateFrom", filterDateFrom);
  if (filterDateTo) queryParams.set("dateTo", filterDateTo);
  queryParams.set("limit", String(PAGE_SIZE));
  queryParams.set("offset", String(page * PAGE_SIZE));

  const { data, isLoading } = useQuery<{ logs: AuditLog[]; total: number }>({
    queryKey: ["/api/audit-logs", filterModule, filterAction, filterUserId, filterDateFrom, filterDateTo, page],
    queryFn: async () => {
      const res = await fetch(`/api/audit-logs?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const { data: users } = useQuery<{ id: number; username: string; firstName: string | null; lastName: string | null }[]>({
    queryKey: ["/api/audit-logs/users"],
  });

  const logs = data?.logs || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function formatDate(dateStr: string | Date | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function resetFilters() {
    setFilterModule("all");
    setFilterAction("all");
    setFilterUserId("all");
    setFilterDateFrom("");
    setFilterDateTo("");
    setPage(0);
  }

  function renderJsonDiff(oldData: any, newData: any) {
    if (!oldData && !newData) return <p className="text-sm text-muted-foreground">Ziadne data</p>;

    const allKeys = new Set([
      ...Object.keys(oldData || {}),
      ...Object.keys(newData || {}),
    ]);

    return (
      <div className="space-y-1 max-h-96 overflow-y-auto">
        {Array.from(allKeys).map(key => {
          const oldVal = oldData?.[key];
          const newVal = newData?.[key];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
          if (key === "processingTimeSec" || key === "createdAt" || key === "updatedAt") return null;

          return (
            <div key={key} className={`flex gap-2 text-xs font-mono py-0.5 px-2 rounded ${changed ? "bg-primary/5" : ""}`}>
              <span className="text-muted-foreground min-w-[140px] shrink-0">{key}:</span>
              {oldData && newData && changed ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-destructive line-through">{formatValue(oldVal)}</span>
                  <span className="text-green-600 dark:text-green-400">{formatValue(newVal)}</span>
                </div>
              ) : (
                <span>{formatValue(newVal ?? oldVal)}</span>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function formatValue(val: any): string {
    if (val === null || val === undefined) return "null";
    if (typeof val === "object") return JSON.stringify(val, null, 0);
    return String(val);
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <HistoryIcon className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold" data-testid="text-history-title">Historia a logy</h1>
            <p className="text-xs text-muted-foreground">Audit trail vsetkych zmien v systeme</p>
          </div>
        </div>
        <Badge variant="outline" data-testid="text-total-logs">
          {total} zaznamov
        </Badge>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtre
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={resetFilters} data-testid="button-reset-filters">
              Zrusit filtre
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Modul</label>
              <Select value={filterModule} onValueChange={(v) => { setFilterModule(v); setPage(0); }}>
                <SelectTrigger data-testid="select-filter-module">
                  <SelectValue placeholder="Vsetky moduly" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetky moduly</SelectItem>
                  {Object.entries(MODULE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Akcia</label>
              <Select value={filterAction} onValueChange={(v) => { setFilterAction(v); setPage(0); }}>
                <SelectTrigger data-testid="select-filter-action">
                  <SelectValue placeholder="Vsetky akcie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetky akcie</SelectItem>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Pouzivatel</label>
              <Select value={filterUserId} onValueChange={(v) => { setFilterUserId(v); setPage(0); }}>
                <SelectTrigger data-testid="select-filter-user">
                  <SelectValue placeholder="Vsetci pouzivatelia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetci pouzivatelia</SelectItem>
                  {(users || []).map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Datum od</label>
              <Input
                type="date"
                value={filterDateFrom}
                onChange={(e) => { setFilterDateFrom(e.target.value); setPage(0); }}
                data-testid="input-filter-date-from"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Datum do</label>
              <Input
                type="date"
                value={filterDateTo}
                onChange={(e) => { setFilterDateTo(e.target.value); setPage(0); }}
                data-testid="input-filter-date-to"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Database className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm">Ziadne zaznamy</p>
              <p className="text-xs">Audit logy sa zaznamenavaju pri kazdej zmene v systeme</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">ID</TableHead>
                    <TableHead className="w-[160px]">Cas</TableHead>
                    <TableHead className="w-[120px]">Pouzivatel</TableHead>
                    <TableHead className="w-[90px]">Akcia</TableHead>
                    <TableHead className="w-[120px]">Modul</TableHead>
                    <TableHead>Entita</TableHead>
                    <TableHead className="w-[80px] text-right">WAME (s)</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id} className="hover-elevate cursor-pointer" onClick={() => setDetailLog(log)} data-testid={`row-audit-log-${log.id}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.id}</TableCell>
                      <TableCell className="text-xs">{formatDate(log.createdAt)}</TableCell>
                      <TableCell className="text-xs font-medium">{log.username || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={ACTION_VARIANTS[log.action] || "outline"} className="text-[10px]">
                          {ACTION_LABELS[log.action] || log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {MODULE_LABELS[log.module] || log.module}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">
                        {log.entityName || (log.entityId ? `#${log.entityId}` : "-")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <span className="flex items-center justify-end gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          {log.processingTimeSec ?? 0}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); setDetailLog(log); }}
                          data-testid={`button-view-log-${log.id}`}
                        >
                          <Search className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between px-4 py-3 border-t">
                <p className="text-xs text-muted-foreground">
                  Strana {page + 1} z {totalPages || 1} ({total} zaznamov)
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    data-testid="button-prev-page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                    data-testid="button-next-page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!detailLog} onOpenChange={(open) => { if (!open) setDetailLog(null); }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HistoryIcon className="w-5 h-5" />
              Detail zaznamu #{detailLog?.id}
            </DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Cas</label>
                  <p className="text-sm font-medium">{formatDate(detailLog.createdAt)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Pouzivatel</label>
                  <p className="text-sm font-medium flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {detailLog.username || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Akcia</label>
                  <div>
                    <Badge variant={ACTION_VARIANTS[detailLog.action] || "outline"}>
                      {ACTION_LABELS[detailLog.action] || detailLog.action}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Modul</label>
                  <div>
                    <Badge variant="outline">
                      {MODULE_LABELS[detailLog.module] || detailLog.module}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Entita</label>
                  <p className="text-sm">{detailLog.entityName || "-"} {detailLog.entityId ? `(ID: ${detailLog.entityId})` : ""}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">WAME cas spracovania</label>
                  <p className="text-sm font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {detailLog.processingTimeSec ?? 0} sekund
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-muted-foreground">IP adresa</label>
                  <p className="text-sm font-mono">{detailLog.ipAddress || "-"}</p>
                </div>
              </div>

              {(detailLog.oldData !== null || detailLog.newData !== null) ? (
                <div>
                  <label className="text-xs text-muted-foreground mb-2 block">Zmeny dat</label>
                  <Card>
                    <CardContent className="pt-3">
                      {renderJsonDiff(detailLog.oldData as Record<string, unknown>, detailLog.newData as Record<string, unknown>)}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
