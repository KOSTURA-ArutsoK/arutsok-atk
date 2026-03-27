import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link2, CheckCircle, Clock, ShieldX, Search, Users, User, Shield, RefreshCw, CalendarClock, Save, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTimeSlovak, formatDateSlovak, isAdmin as checkIsAdmin } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppUser } from "@/hooks/use-app-user";

type LinkCategory = "subject" | "guardian" | "same_person";

interface LinkRow {
  rowId: string;
  linkId: number;
  linkCategory: LinkCategory;
  linkType: string;
  userId: number;
  userName: string;
  userEmail: string | null;
  primaryUserName: string;
  primaryUserEmail: string | null;
  linkedUserName: string | null;
  linkedUserEmail: string | null;
  subjectId: number | null;
  subjectName: string | null;
  subjectType: string | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  verifiedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  validFrom: string | null;
  validUntil: string | null;
}

function statusLabel(status: string, isActive: boolean): { label: string; color: string; Icon: typeof CheckCircle } {
  if ((status === "verified" || status === "active") && isActive) return { label: "Aktívne", color: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle };
  if (status === "pending_confirmation" || status === "pending_target" || status === "pending") return { label: "Čaká na potvrdenie", color: "text-orange-600 dark:text-orange-400", Icon: Clock };
  if (status === "rejected") return { label: "Odmietnuté", color: "text-destructive", Icon: ShieldX };
  if (status === "revoked") return { label: "Zrušené", color: "text-muted-foreground", Icon: ShieldX };
  if (status === "expired") return { label: "Vypršané", color: "text-amber-600 dark:text-amber-400", Icon: CalendarClock };
  return { label: status, color: "text-muted-foreground", Icon: Clock };
}

function subjectTypeLabel(type: string | null): string {
  switch (type) {
    case "person": return "FO";
    case "szco": return "SZČO";
    case "company": return "PO";
    case "organization": return "TS";
    case "state": return "VS";
    case "os": return "OS";
    default: return type ?? "—";
  }
}

function categoryBadge(cat: LinkCategory) {
  switch (cat) {
    case "subject": return <Badge variant="outline" className="text-xs border-orange-400 text-orange-600 dark:text-orange-400">Subjekt</Badge>;
    case "guardian": return <Badge variant="outline" className="text-xs border-blue-400 text-blue-600 dark:text-blue-400">Opatrovník</Badge>;
    case "same_person": return <Badge variant="outline" className="text-xs border-violet-400 text-violet-600 dark:text-violet-400">Tá istá osoba</Badge>;
  }
}

export default function SystemLinks() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<LinkCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "pending" | "revoked" | "expired">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingValidUntil, setEditingValidUntil] = useState<Record<string, string>>({});
  const [savingValidUntil, setSavingValidUntil] = useState<string | null>(null);
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<LinkRow[]>({
    queryKey: ["/api/admin/all-links"],
  });

  const revokeMutation = useMutation({
    mutationFn: async ({ linkId, category }: { linkId: number; category: LinkCategory }) => {
      const endpoint = category === "subject"
        ? `/api/subject-link/${linkId}/revoke`
        : `/api/account-link/${linkId}/revoke`;
      return apiRequest("POST", endpoint, { reason: "Admin revoke" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-links"] });
      toast({ title: "Prepojenie zrušené", description: "Prepojenie bolo úspešne zrušené." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa zrušiť prepojenie.", variant: "destructive" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async (linkId: number) => {
      return apiRequest("POST", `/api/subject-link/${linkId}/reactivate`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-links"] });
      toast({ title: "Prepojenie reaktivované", description: "Prepojenie bolo úspešne reaktivované." });
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa reaktivovať prepojenie.", variant: "destructive" });
    },
  });

  if (appUser && !checkIsAdmin(appUser)) {
    navigate("/");
    return null;
  }

  async function handleSaveValidUntil(row: LinkRow) {
    if (row.linkCategory !== "subject") return;
    setSavingValidUntil(row.rowId);
    try {
      const rawVal = editingValidUntil[row.rowId];
      const validUntil = rawVal ? new Date(rawVal).toISOString() : null;
      await apiRequest("PATCH", `/api/subject-link/${row.linkId}/validity`, {
        validFrom: row.validFrom ?? null,
        validUntil,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/all-links"] });
      setEditingValidUntil(prev => { const n = { ...prev }; delete n[row.rowId]; return n; });
      toast({ title: "Platnosť uložená", description: "Dátum platnosti prepojenia bol aktualizovaný." });
    } catch {
      toast({ title: "Chyba", description: "Nepodarilo sa uložiť dátum platnosti.", variant: "destructive" });
    } finally {
      setSavingValidUntil(null);
    }
  }

  const filtered = (data ?? []).filter((row) => {
    if (categoryFilter !== "all" && row.linkCategory !== categoryFilter) return false;
    if (statusFilter === "active" && !(row.isActive && (row.status === "verified" || row.status === "active"))) return false;
    if (statusFilter === "pending" && !(row.status === "pending_confirmation" || row.status === "pending_target" || row.status === "pending")) return false;
    if (statusFilter === "revoked" && row.status !== "revoked" && row.status !== "rejected") return false;
    if (statusFilter === "expired" && row.status !== "expired") return false;
    if (dateFrom) {
      const from = new Date(dateFrom);
      if (!row.createdAt || new Date(row.createdAt) < from) return false;
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setDate(to.getDate() + 1);
      if (!row.createdAt || new Date(row.createdAt) > to) return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.primaryUserName.toLowerCase().includes(q) ||
      (row.primaryUserEmail ?? "").toLowerCase().includes(q) ||
      (row.linkedUserName ?? "").toLowerCase().includes(q) ||
      (row.subjectName ?? "").toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q)
    );
  });

  const counts = {
    all: (data ?? []).length,
    subject: (data ?? []).filter(r => r.linkCategory === "subject").length,
    guardian: (data ?? []).filter(r => r.linkCategory === "guardian").length,
    same_person: (data ?? []).filter(r => r.linkCategory === "same_person").length,
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Prepojenia v systéme</h1>
          <p className="text-xs text-muted-foreground">Prehľad všetkých prepojení — subjektové, opatrovnícke aj totožné osoby</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {([["all", "Všetky", null], ["subject", "Subjekt", Shield], ["guardian", "Opatrovník", Users], ["same_person", "Tá istá osoba", User]] as const).map(([key, label]) => (
          <button
            key={key}
            data-testid={`filter-${key}`}
            onClick={() => setCategoryFilter(key as LinkCategory | "all")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              categoryFilter === key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {label} ({counts[key as keyof typeof counts] ?? 0})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Hľadať podľa mena, emailu, subjektu..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-system-links-search"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="h-9 px-3 rounded-md border border-border bg-background text-sm text-foreground"
          data-testid="select-status-filter"
        >
          <option value="all">Všetky stavy</option>
          <option value="active">Aktívne</option>
          <option value="pending">Čakajúce</option>
          <option value="expired">Vypršané</option>
          <option value="revoked">Zrušené</option>
        </select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 w-36 text-sm"
          data-testid="input-date-from"
          title="Od dátumu"
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 w-36 text-sm"
          data-testid="input-date-to"
          title="Do dátumu"
        />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Načítavam...</div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          Chyba pri načítavaní dát
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground" data-testid="system-links-empty">
          <Link2 className="w-4 h-4 flex-shrink-0" />
          <span>Žiadne prepojenia nenájdené.</span>
        </div>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Typ</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Primárny používateľ</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Cieľ</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Stav</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Dátumy</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Platnosť</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Akcie</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const st = statusLabel(row.status, row.isActive);
                const isSubject = row.linkCategory === "subject";
                const isExpired = row.status === "expired";
                const editVal = editingValidUntil[row.rowId];
                const isEditingThis = editVal !== undefined;
                return (
                  <tr key={row.rowId} className={`border-t border-border hover:bg-muted/20 transition-colors ${isExpired ? "opacity-75" : ""}`} data-testid={`system-link-row-${row.rowId}`}>
                    <td className="px-4 py-3">
                      {categoryBadge(row.linkCategory)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.primaryUserName}</p>
                      <p className="text-xs text-muted-foreground">{row.primaryUserEmail ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      {row.linkCategory === "subject" ? (
                        <>
                          <p className="font-medium text-foreground">{row.subjectName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{subjectTypeLabel(row.subjectType)}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-foreground">{row.linkedUserName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">{row.linkedUserEmail ?? "—"}</p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1.5 ${st.color}`}>
                        <st.Icon className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{st.label}</span>
                      </div>
                      {row.revokedReason && row.revokedReason !== "auto_expired_validity" && (
                        <p className="text-xs text-muted-foreground mt-0.5">{row.revokedReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>{row.createdAt ? formatDateTimeSlovak(new Date(row.createdAt)) : "—"}</div>
                      {row.verifiedAt && <div className="text-emerald-600 dark:text-emerald-400">Overené: {formatDateTimeSlovak(new Date(row.verifiedAt))}</div>}
                      {row.revokedAt && <div className="text-amber-600 dark:text-amber-400">Ukončené: {formatDateTimeSlovak(new Date(row.revokedAt))}</div>}
                    </td>
                    <td className="px-4 py-3">
                      {isSubject ? (
                        <div className="space-y-1.5">
                          {row.validFrom && (
                            <p className="text-xs text-muted-foreground">Od: {formatDateSlovak(row.validFrom)}</p>
                          )}
                          {isEditingThis ? (
                            <div className="flex items-center gap-1">
                              <Input
                                type="date"
                                value={editVal}
                                onChange={(e) => setEditingValidUntil(prev => ({ ...prev, [row.rowId]: e.target.value }))}
                                className="h-7 text-xs w-32"
                                data-testid={`input-valid-until-${row.rowId}`}
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                disabled={savingValidUntil === row.rowId}
                                onClick={() => handleSaveValidUntil(row)}
                                data-testid={`button-save-valid-until-${row.rowId}`}
                              >
                                <Save className="w-3.5 h-3.5 text-emerald-600" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => setEditingValidUntil(prev => { const n = { ...prev }; delete n[row.rowId]; return n; })}
                                data-testid={`button-cancel-valid-until-${row.rowId}`}
                              >
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          ) : (
                            <button
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                              onClick={() => setEditingValidUntil(prev => ({
                                ...prev,
                                [row.rowId]: row.validUntil ? new Date(row.validUntil).toISOString().split("T")[0] : ""
                              }))}
                              data-testid={`button-edit-valid-until-${row.rowId}`}
                            >
                              <CalendarClock className="w-3 h-3" />
                              <span>{row.validUntil ? `Do: ${formatDateSlovak(row.validUntil)}` : "Neobmedzená"}</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1.5">
                        {isSubject && isExpired && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            data-testid={`button-reactivate-${row.rowId}`}
                            disabled={reactivateMutation.isPending}
                            onClick={() => reactivateMutation.mutate(row.linkId)}
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Reaktivovať
                          </Button>
                        )}
                        {row.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                            data-testid={`button-revoke-${row.rowId}`}
                            disabled={revokeMutation.isPending}
                            onClick={() => revokeMutation.mutate({ linkId: row.linkId, category: row.linkCategory })}
                          >
                            Zrušiť
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
