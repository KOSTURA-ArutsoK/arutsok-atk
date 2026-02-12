import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useHelp } from "@/contexts/help-context";
import { ArrowDownLeft, Filter, Loader2, Search, Info } from "lucide-react";
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

export default function Provizie() {
  const { helpEnabled } = useHelp();
  const [showHelp, setShowHelp] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPartner, setFilterPartner] = useState<string>("all");

  const { data: provizieData, isLoading } = useQuery<any[]>({
    queryKey: ["/api/provizie"],
  });

  useEffect(() => {
    if (helpEnabled) {
      const timer = setTimeout(() => setShowHelp(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setShowHelp(false);
    }
  }, [helpEnabled]);

  const partners = useMemo(() => {
    if (!provizieData) return [];
    const set = new Set<string>();
    provizieData.forEach((r: any) => { if (r.partner_name) set.add(r.partner_name); });
    return Array.from(set).sort();
  }, [provizieData]);

  const filtered = useMemo(() => {
    if (!provizieData) return [];
    return provizieData.filter((r: any) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const match = (r.client_name || "").toLowerCase().includes(term) ||
          (r.contract_number || "").toLowerCase().includes(term) ||
          (r.partner_name || "").toLowerCase().includes(term) ||
          (r.product_name || "").toLowerCase().includes(term);
        if (!match) return false;
      }
      if (filterPartner !== "all" && r.partner_name !== filterPartner) return false;
      return true;
    });
  }, [provizieData, searchTerm, filterPartner]);

  const totalCommission = useMemo(() => {
    return filtered.reduce((sum: number, r: any) => sum + (parseFloat(r.calculated_commission) || 0), 0);
  }, [filtered]);

  const totalPoints = useMemo(() => {
    return filtered.reduce((sum: number, r: any) => sum + (parseFloat(r.points_earned) || 0), 0);
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
          <ArrowDownLeft className="w-6 h-6 text-emerald-500" />
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">Provizie</h1>
            <p className="text-xs text-muted-foreground">Prehled prijatych provizii od partnerov</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className="border-emerald-500/30 text-emerald-500" data-testid="text-total-commission">
            Spolu: {formatAmount(totalCommission)}
          </Badge>
          <Badge variant="outline" data-testid="text-total-points">
            Body: {totalPoints.toFixed(2)}
          </Badge>
          <Badge variant="outline" data-testid="text-count">
            {filtered.length} zaznamov
          </Badge>
        </div>
      </div>

      {showHelp && (
        <Card className="border-emerald-500/30 bg-emerald-500/5" data-testid="help-provizie">
          <CardContent className="p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              Peniaze prijate od partnerov. Tato stranka zobrazuje prehled vsetkych provizii, ktore spolocnost prijima od obchodnych partnerov na zaklade uzatvorenych zmluv a nastavenych sadzieb.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtre
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => { setSearchTerm(""); setFilterPartner("all"); }} data-testid="button-reset-filters">
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
                  placeholder="Klient, zmluva, partner..."
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Partner</label>
              <Select value={filterPartner} onValueChange={setFilterPartner}>
                <SelectTrigger data-testid="select-filter-partner">
                  <SelectValue placeholder="Vsetci partneri" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetci partneri</SelectItem>
                  {partners.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" data-testid="loader" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ArrowDownLeft className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm" data-testid="text-empty">Ziadne provizie</p>
              <p className="text-xs">Neboli najdene ziadne zaznamy zodpovedajuce filtrom</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cislo zmluvy</TableHead>
                  <TableHead>KIK ID</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Partner</TableHead>
                  <TableHead>Produkt</TableHead>
                  <TableHead className="text-right">Poistne</TableHead>
                  <TableHead>Typ sadzby</TableHead>
                  <TableHead className="text-right">Sadzba</TableHead>
                  <TableHead className="text-right">Provzia</TableHead>
                  <TableHead className="text-right">Body</TableHead>
                  <TableHead>Datum podpisu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any, idx: number) => (
                  <TableRow key={r.contract_id || idx} data-testid={`row-provzia-${r.contract_id || idx}`}>
                    <TableCell className="font-mono text-xs">{r.contract_number || "-"}</TableCell>
                    <TableCell className="text-xs">{r.kik_id || "-"}</TableCell>
                    <TableCell>{r.client_name || "-"}</TableCell>
                    <TableCell>{r.partner_name || "-"}</TableCell>
                    <TableCell>{r.product_name || "-"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.premium_amount ? formatAmount(r.premium_amount) : "-"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {r.rate_type === "percent" ? "%" : r.rate_type === "fixed" ? "Fix" : r.rate_type || "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {r.rate_value ? (r.rate_type === "percent" ? `${r.rate_value}%` : formatAmount(r.rate_value)) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-500 font-medium">
                      {r.calculated_commission ? formatAmount(r.calculated_commission) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.points_earned ? parseFloat(r.points_earned).toFixed(2) : "-"}</TableCell>
                    <TableCell className="text-xs">{formatDate(r.signed_date)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
