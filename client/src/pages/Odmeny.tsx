import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTableSort } from "@/hooks/use-table-sort";
import { ArrowUpRight, Filter, Loader2, Search } from "lucide-react";
import { HelpIcon } from "@/components/help-icon";
import { useColumnVisibility, type ColumnDef } from "@/hooks/use-column-visibility";
import { ColumnManager } from "@/components/column-manager";
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

const COLUMNS: ColumnDef[] = [
  { key: "cn", label: "Cislo zmluvy" },
  { key: "client_name", label: "Klient" },
  { key: "partner_name", label: "Partner" },
  { key: "product_name", label: "Produkt" },
  { key: "agent_name", label: "Spolupracovnik" },
  { key: "agent_level", label: "Uroven" },
  { key: "premium_amount", label: "Poistne" },
  { key: "base_commission", label: "Zakladna provzia" },
  { key: "differential_commission", label: "Rozdielova" },
  { key: "total_commission", label: "Celkova odmena" },
  { key: "points_earned", label: "Body" },
  { key: "created_at", label: "Datum" },
];

export default function Odmeny() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAgent, setFilterAgent] = useState<string>("all");

  const { data: odmenyData, isLoading } = useQuery<any[]>({
    queryKey: ["/api/odmeny"],
  });

  const agents = useMemo(() => {
    if (!odmenyData) return [];
    const set = new Set<string>();
    odmenyData.forEach((r: any) => {
      const name = r.agent_first_name && r.agent_last_name
        ? `${r.agent_first_name} ${r.agent_last_name}`
        : r.agent_name;
      if (name) set.add(name);
    });
    return Array.from(set).sort();
  }, [odmenyData]);

  const filtered = useMemo(() => {
    if (!odmenyData) return [];
    return odmenyData.filter((r: any) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const agentFullName = r.agent_first_name && r.agent_last_name
          ? `${r.agent_first_name} ${r.agent_last_name}`
          : r.agent_name || "";
        const match = agentFullName.toLowerCase().includes(term) ||
          (r.contract_number || "").toLowerCase().includes(term) ||
          (r.cn || "").toLowerCase().includes(term) ||
          (r.partner_name || "").toLowerCase().includes(term) ||
          (r.product_name || "").toLowerCase().includes(term) ||
          (r.client_name || "").toLowerCase().includes(term);
        if (!match) return false;
      }
      if (filterAgent !== "all") {
        const agentFullName = r.agent_first_name && r.agent_last_name
          ? `${r.agent_first_name} ${r.agent_last_name}`
          : r.agent_name;
        if (agentFullName !== filterAgent) return false;
      }
      return true;
    });
  }, [odmenyData, searchTerm, filterAgent]);

  const { sortedData: sortedFiltered, sortKey, sortDirection, requestSort } = useTableSort(filtered);
  const columnVisibility = useColumnVisibility("odmeny", COLUMNS);

  const totalOdmeny = useMemo(() => {
    return filtered.reduce((sum: number, r: any) => sum + (parseFloat(r.total_commission) || 0), 0);
  }, [filtered]);

  const totalDifferential = useMemo(() => {
    return filtered.reduce((sum: number, r: any) => sum + (parseFloat(r.differential_commission) || 0), 0);
  }, [filtered]);

  function formatDate(dateStr: string | Date | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric" });
  }

  function formatAmount(val: any) {
    const num = parseFloat(val);
    if (isNaN(num)) return "-";
    return num.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " EUR";
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <ArrowUpRight className="w-6 h-6 text-orange-500" />
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold" data-testid="text-page-title">Odmeny</h1>
            <HelpIcon text="Peniaze vyplacane spolupracovnikom. Zobrazuje prehled vsetkych odmien, ktore su vyplacane agentom a manazerom na zaklade ich proviznej triedy a rozdielovej provizie." side="right" />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ColumnManager columnVisibility={columnVisibility} />
          <Badge variant="outline" className="border-orange-500/30 text-orange-500" data-testid="text-total-odmeny">
            Spolu: {formatAmount(totalOdmeny)}
          </Badge>
          {totalDifferential > 0 && (
            <Badge variant="outline" className="border-red-500/30 text-red-500" data-testid="text-total-differential">
              Rozdielova: {formatAmount(totalDifferential)}
            </Badge>
          )}
          <Badge variant="outline" data-testid="text-count">
            {filtered.length} zaznamov
          </Badge>
        </div>
      </div>

      <Card className="border-orange-500/10">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtre
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setFilterAgent("all"); }} data-testid="button-reset-filters">
              Zrusit filtre
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Vyhladavanie</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Agent, zmluva, klient..."
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Spolupracovnik</label>
              <Select value={filterAgent} onValueChange={setFilterAgent}>
                <SelectTrigger data-testid="select-filter-agent">
                  <SelectValue placeholder="Vsetci spolupracovnici" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetci spolupracovnici</SelectItem>
                  {agents.map(a => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-orange-500/10">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" data-testid="loader" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ArrowUpRight className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm" data-testid="text-empty">Ziadne odmeny</p>
              <p className="text-xs">Neboli najdene ziadne zaznamy zodpovedajuce filtrom</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  {columnVisibility.isVisible("cn") && <TableHead sortKey="cn" sortDirection={sortKey === "cn" ? sortDirection : null} onSort={requestSort}>Cislo zmluvy</TableHead>}
                  {columnVisibility.isVisible("client_name") && <TableHead sortKey="client_name" sortDirection={sortKey === "client_name" ? sortDirection : null} onSort={requestSort}>Klient</TableHead>}
                  {columnVisibility.isVisible("partner_name") && <TableHead sortKey="partner_name" sortDirection={sortKey === "partner_name" ? sortDirection : null} onSort={requestSort}>Partner</TableHead>}
                  {columnVisibility.isVisible("product_name") && <TableHead sortKey="product_name" sortDirection={sortKey === "product_name" ? sortDirection : null} onSort={requestSort}>Produkt</TableHead>}
                  {columnVisibility.isVisible("agent_name") && <TableHead sortKey="agent_name" sortDirection={sortKey === "agent_name" ? sortDirection : null} onSort={requestSort}>Spolupracovnik</TableHead>}
                  {columnVisibility.isVisible("agent_level") && <TableHead sortKey="agent_level" className="text-center" sortDirection={sortKey === "agent_level" ? sortDirection : null} onSort={requestSort}>Uroven</TableHead>}
                  {columnVisibility.isVisible("premium_amount") && <TableHead sortKey="premium_amount" className="text-right" sortDirection={sortKey === "premium_amount" ? sortDirection : null} onSort={requestSort}>Poistne</TableHead>}
                  {columnVisibility.isVisible("base_commission") && <TableHead sortKey="base_commission" className="text-right" sortDirection={sortKey === "base_commission" ? sortDirection : null} onSort={requestSort}>Zakladna provzia</TableHead>}
                  {columnVisibility.isVisible("differential_commission") && <TableHead sortKey="differential_commission" className="text-right" sortDirection={sortKey === "differential_commission" ? sortDirection : null} onSort={requestSort}>Rozdielova</TableHead>}
                  {columnVisibility.isVisible("total_commission") && <TableHead sortKey="total_commission" className="text-right" sortDirection={sortKey === "total_commission" ? sortDirection : null} onSort={requestSort}>Celkova odmena</TableHead>}
                  {columnVisibility.isVisible("points_earned") && <TableHead sortKey="points_earned" className="text-right" sortDirection={sortKey === "points_earned" ? sortDirection : null} onSort={requestSort}>Body</TableHead>}
                  {columnVisibility.isVisible("created_at") && <TableHead sortKey="created_at" sortDirection={sortKey === "created_at" ? sortDirection : null} onSort={requestSort}>Datum</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedFiltered.map((r: any, idx: number) => {
                  const agentFullName = r.agent_first_name && r.agent_last_name
                    ? `${r.agent_first_name} ${r.agent_last_name}`
                    : r.agent_name || "-";
                  const managerFullName = r.manager_first_name && r.manager_last_name
                    ? `${r.manager_first_name} ${r.manager_last_name}`
                    : r.manager_name || null;
                  return (
                    <TableRow key={r.id || idx} data-testid={`row-odmena-${r.id || idx}`}>
                      {columnVisibility.isVisible("cn") && <TableCell className="font-mono text-xs">{r.cn || r.contract_number || "-"}</TableCell>}
                      {columnVisibility.isVisible("client_name") && <TableCell>{r.client_name || "-"}</TableCell>}
                      {columnVisibility.isVisible("partner_name") && <TableCell>{r.partner_name || "-"}</TableCell>}
                      {columnVisibility.isVisible("product_name") && <TableCell>{r.product_name || "-"}</TableCell>}
                      {columnVisibility.isVisible("agent_name") && <TableCell>
                        <div>
                          <span className="text-sm">{agentFullName}</span>
                          {managerFullName && (
                            <span className="text-[10px] text-muted-foreground block">
                              Manazer: {managerFullName} (L{r.manager_level})
                            </span>
                          )}
                        </div>
                      </TableCell>}
                      {columnVisibility.isVisible("agent_level") && <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px]">L{r.agent_level || "?"}</Badge>
                      </TableCell>}
                      {columnVisibility.isVisible("premium_amount") && <TableCell className="text-right font-mono text-xs">{r.premium_amount ? formatAmount(r.premium_amount) : "-"}</TableCell>}
                      {columnVisibility.isVisible("base_commission") && <TableCell className="text-right font-mono text-xs">{r.base_commission ? formatAmount(r.base_commission) : "-"}</TableCell>}
                      {columnVisibility.isVisible("differential_commission") && <TableCell className="text-right font-mono text-xs text-red-500">
                        {parseFloat(r.differential_commission) > 0 ? formatAmount(r.differential_commission) : "-"}
                      </TableCell>}
                      {columnVisibility.isVisible("total_commission") && <TableCell className="text-right font-mono text-xs text-orange-500 font-medium">
                        {r.total_commission ? formatAmount(r.total_commission) : "-"}
                      </TableCell>}
                      {columnVisibility.isVisible("points_earned") && <TableCell className="text-right font-mono text-xs">{r.points_earned ? parseFloat(r.points_earned).toFixed(2) : "-"}</TableCell>}
                      {columnVisibility.isVisible("created_at") && <TableCell className="text-xs">{formatDate(r.created_at)}</TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
