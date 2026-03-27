import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link2, CheckCircle, Clock, ShieldX, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatDateTimeSlovak } from "@/lib/utils";

interface SubjectLinkRow {
  linkId: number;
  userId: number;
  userName: string;
  userEmail: string | null;
  subjectId: number;
  subjectName: string;
  subjectType: string | null;
  status: string;
  isActive: boolean;
  createdAt: string;
  verifiedAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
}

function statusLabel(status: string, isActive: boolean): { label: string; color: string; Icon: typeof CheckCircle } {
  if (status === "verified" && isActive) return { label: "Aktívne", color: "text-emerald-600 dark:text-emerald-400", Icon: CheckCircle };
  if (status === "pending_confirmation") return { label: "Čaká na potvrdenie", color: "text-orange-600 dark:text-orange-400", Icon: Clock };
  if (status === "revoked") return { label: "Zrušené", color: "text-muted-foreground", Icon: ShieldX };
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

export default function SystemLinks() {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery<SubjectLinkRow[]>({
    queryKey: ["/api/admin/subject-links"],
  });

  const filtered = (data ?? []).filter((row) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      row.userName.toLowerCase().includes(q) ||
      (row.userEmail ?? "").toLowerCase().includes(q) ||
      row.subjectName.toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
          <Link2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Prepojenia účtov so subjektmi</h1>
          <p className="text-xs text-muted-foreground">Prehľad všetkých existujúcich prepojení v systéme</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Hľadať podľa mena, emailu, subjektu..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-system-links-search"
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
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Používateľ</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Subjekt</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Stav</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Vytvorené</th>
                <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground uppercase tracking-wide">Overené</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const st = statusLabel(row.status, row.isActive);
                return (
                  <tr key={row.linkId} className="border-t border-border hover:bg-muted/20 transition-colors" data-testid={`system-link-row-${row.linkId}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.userName}</p>
                      <p className="text-xs text-muted-foreground">{row.userEmail ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{row.subjectName}</p>
                      <p className="text-xs text-muted-foreground">{subjectTypeLabel(row.subjectType)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1.5 ${st.color}`}>
                        <st.Icon className="w-3.5 h-3.5" />
                        <span className="text-xs font-medium">{st.label}</span>
                      </div>
                      {row.revokedReason && (
                        <p className="text-xs text-muted-foreground mt-0.5">{row.revokedReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.createdAt ? formatDateTimeSlovak(new Date(row.createdAt)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {row.verifiedAt ? formatDateTimeSlovak(new Date(row.verifiedAt)) : row.revokedAt ? `Zrušené: ${formatDateTimeSlovak(new Date(row.revokedAt))}` : "—"}
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
