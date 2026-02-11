import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CommissionScheme, Product } from "@shared/schema";
import { Percent, Filter, Loader2, Search } from "lucide-react";
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

export default function Commissions() {
  const [searchProduct, setSearchProduct] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: commissions, isLoading: commissionsLoading } = useQuery<CommissionScheme[]>({
    queryKey: ["/api/commissions"],
  });

  const { data: products, isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const isLoading = commissionsLoading || productsLoading;

  const productMap = useMemo(() => {
    const map = new Map<number, string>();
    if (products) {
      for (const p of products) {
        map.set(p.id, p.name);
      }
    }
    return map;
  }, [products]);

  function getStatus(scheme: CommissionScheme): "active" | "expired" {
    if (!scheme.validTo) return "active";
    return new Date(scheme.validTo) > new Date() ? "active" : "expired";
  }

  const filtered = useMemo(() => {
    if (!commissions) return [];
    return commissions.filter((c) => {
      if (searchProduct) {
        const productName = (c.productId ? productMap.get(c.productId) : "") || "";
        if (!productName.toLowerCase().includes(searchProduct.toLowerCase())) {
          return false;
        }
      }
      if (filterType !== "all" && c.type !== filterType) {
        return false;
      }
      if (filterStatus !== "all") {
        const status = getStatus(c);
        if (status !== filterStatus) return false;
      }
      return true;
    });
  }, [commissions, searchProduct, filterType, filterStatus, productMap]);

  function formatDate(dateStr: string | Date | null) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("sk-SK", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function resetFilters() {
    setSearchProduct("");
    setFilterType("all");
    setFilterStatus("all");
  }

  const activeCount = commissions?.filter((c) => getStatus(c) === "active").length || 0;
  const totalCount = commissions?.length || 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Percent className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold" data-testid="text-commissions-title">Sadzobnik provizii</h1>
            <p className="text-xs text-muted-foreground">Prehlad vsetkych proviznych sadzobnikov napriec produktmi</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" data-testid="text-active-count">
            {activeCount} aktivnych
          </Badge>
          <Badge variant="outline" data-testid="text-total-count">
            {totalCount} celkom
          </Badge>
        </div>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nazov produktu</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  placeholder="Hladat produkt..."
                  className="pl-9"
                  data-testid="input-filter-product"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Typ provizie</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger data-testid="select-filter-type">
                  <SelectValue placeholder="Vsetky typy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetky typy</SelectItem>
                  <SelectItem value="Body">Body</SelectItem>
                  <SelectItem value="Percenta">Percenta</SelectItem>
                  <SelectItem value="Fixna">Fixna</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Stav</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger data-testid="select-filter-status">
                  <SelectValue placeholder="Vsetky stavy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vsetky stavy</SelectItem>
                  <SelectItem value="active">Aktivna</SelectItem>
                  <SelectItem value="expired">Expirovala</SelectItem>
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
              <Loader2 className="w-6 h-6 animate-spin text-primary" data-testid="loader-commissions" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Percent className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm" data-testid="text-no-commissions">Ziadne sadzby</p>
              <p className="text-xs">Neboli najdene ziadne provizne sadzby zodpovedajuce filtrom</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead data-testid="th-produkt">Produkt</TableHead>
                  <TableHead data-testid="th-typ">Typ</TableHead>
                  <TableHead data-testid="th-hodnota">Hodnota</TableHead>
                  <TableHead data-testid="th-koeficient">Koeficient</TableHead>
                  <TableHead data-testid="th-mena">Mena</TableHead>
                  <TableHead data-testid="th-platnost-od">Platnost od</TableHead>
                  <TableHead data-testid="th-platnost-do">Platnost do</TableHead>
                  <TableHead data-testid="th-stav">Stav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const status = getStatus(c);
                  const productName = c.productId ? productMap.get(c.productId) || `#${c.productId}` : "-";
                  return (
                    <TableRow key={c.id} data-testid={`row-commission-${c.id}`}>
                      <TableCell className="text-sm font-medium" data-testid={`text-product-${c.id}`}>
                        {productName}
                      </TableCell>
                      <TableCell data-testid={`text-type-${c.id}`}>
                        <Badge variant="secondary">{c.type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-value-${c.id}`}>
                        {c.value}
                      </TableCell>
                      <TableCell className="font-mono text-sm" data-testid={`text-coefficient-${c.id}`}>
                        {c.coefficient ?? "-"}
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-currency-${c.id}`}>
                        {c.currency}
                      </TableCell>
                      <TableCell className="text-xs" data-testid={`text-valid-from-${c.id}`}>
                        {formatDate(c.validFrom)}
                      </TableCell>
                      <TableCell className="text-xs" data-testid={`text-valid-to-${c.id}`}>
                        {formatDate(c.validTo)}
                      </TableCell>
                      <TableCell data-testid={`text-status-${c.id}`}>
                        {status === "active" ? (
                          <Badge variant="default" className="bg-green-600 text-white no-default-hover-elevate">Aktivna</Badge>
                        ) : (
                          <Badge variant="destructive">Expirovala</Badge>
                        )}
                      </TableCell>
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
