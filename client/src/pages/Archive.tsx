import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useToast } from "@/hooks/use-toast";
import { useTableSort } from "@/hooks/use-table-sort";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Briefcase, Package, RotateCcw, Lock, Loader2 } from "lucide-react";

export default function Archive() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const [restoreTarget, setRestoreTarget] = useState<{ entityType: string; id: number; name: string } | null>(null);
  const [password, setPassword] = useState("");

  const { data, isLoading } = useQuery<{
    companies: any[];
    partners: any[];
    products: any[];
  }>({
    queryKey: ["/api/archive/deleted"],
  });

  const restoreMutation = useMutation({
    mutationFn: async ({ entityType, id, password: pw }: { entityType: string; id: number; password: string }) => {
      await apiRequest("POST", `/api/archive/restore/${entityType}/${id}`, { password: pw });
    },
    onSuccess: () => {
      toast({ title: "Obnovene", description: "Zaznam bol uspesne obnoveny." });
      queryClient.invalidateQueries({ queryKey: ["/api/archive/deleted"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/partners"] });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setRestoreTarget(null);
      setPassword("");
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa obnovit zaznam.", variant: "destructive" });
    },
  });

  function handleRestoreClick(entityType: string, id: number, name: string) {
    setRestoreTarget({ entityType, id, name });
    setPassword("");
  }

  function handleRestoreConfirm() {
    if (!restoreTarget || !password) return;
    restoreMutation.mutate({ entityType: restoreTarget.entityType, id: restoreTarget.id, password });
  }

  function formatDate(d: string | null | undefined) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const companies = data?.companies || [];
  const partners = data?.partners || [];
  const products = data?.products || [];
  const totalDeleted = companies.length + partners.length + products.length;

  const { sortedData: sortedCompanies, sortKey: sortKeyCompanies, sortDirection: sortDirCompanies, requestSort: requestSortCompanies } = useTableSort(companies);
  const { sortedData: sortedPartners, sortKey: sortKeyPartners, sortDirection: sortDirPartners, requestSort: requestSortPartners } = useTableSort(partners);
  const { sortedData: sortedProducts, sortKey: sortKeyProducts, sortDirection: sortDirProducts, requestSort: requestSortProducts } = useTableSort(products);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-archive-title">Kos</h1>
          <p className="text-sm text-muted-foreground" data-testid="text-archive-count">
            Celkovo {totalDeleted} vymazanych zaznamov
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Lock className="w-3 h-3" />
          Chranene heslom
        </Badge>
      </div>

      <Tabs defaultValue="companies">
        <TabsList data-testid="tabs-archive">
          <TabsTrigger value="companies" data-testid="tab-archive-companies">
            <Building2 className="w-4 h-4 mr-1" />
            Spolocnosti ({companies.length})
          </TabsTrigger>
          <TabsTrigger value="partners" data-testid="tab-archive-partners">
            <Briefcase className="w-4 h-4 mr-1" />
            Partneri ({partners.length})
          </TabsTrigger>
          <TabsTrigger value="products" data-testid="tab-archive-products">
            <Package className="w-4 h-4 mr-1" />
            Produkty ({products.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="companies">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vymazane spolocnosti</CardTitle>
            </CardHeader>
            <CardContent>
              {companies.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-deleted-companies">Ziadne vymazane spolocnosti</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead sortKey="name" sortDirection={sortKeyCompanies === "name" ? sortDirCompanies : null} onSort={requestSortCompanies}>Nazov</TableHead>
                      <TableHead sortKey="code" sortDirection={sortKeyCompanies === "code" ? sortDirCompanies : null} onSort={requestSortCompanies}>Kod</TableHead>
                      <TableHead sortKey="deletedBy" sortDirection={sortKeyCompanies === "deletedBy" ? sortDirCompanies : null} onSort={requestSortCompanies}>Vymazal</TableHead>
                      <TableHead sortKey="deletedAt" sortDirection={sortKeyCompanies === "deletedAt" ? sortDirCompanies : null} onSort={requestSortCompanies}>Datum vymazania</TableHead>
                      <TableHead sortKey="deletedFromIp" sortDirection={sortKeyCompanies === "deletedFromIp" ? sortDirCompanies : null} onSort={requestSortCompanies}>IP</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcia</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedCompanies.map((c: any) => (
                      <TableRow key={c.id} data-testid={`row-archive-company-${c.id}`}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell>{c.code}</TableCell>
                        <TableCell>{c.deletedBy || "-"}</TableCell>
                        <TableCell>{formatDate(c.deletedAt)}</TableCell>
                        <TableCell className="text-xs font-mono">{c.deletedFromIp || "-"}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleRestoreClick("company", c.id, c.name)} data-testid={`button-restore-company-${c.id}`}>
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Obnovit
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="partners">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vymazani partneri</CardTitle>
            </CardHeader>
            <CardContent>
              {partners.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-deleted-partners">Ziadni vymazani partneri</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead sortKey="name" sortDirection={sortKeyPartners === "name" ? sortDirPartners : null} onSort={requestSortPartners}>Nazov</TableHead>
                      <TableHead sortKey="code" sortDirection={sortKeyPartners === "code" ? sortDirPartners : null} onSort={requestSortPartners}>Kod</TableHead>
                      <TableHead sortKey="deletedBy" sortDirection={sortKeyPartners === "deletedBy" ? sortDirPartners : null} onSort={requestSortPartners}>Vymazal</TableHead>
                      <TableHead sortKey="deletedAt" sortDirection={sortKeyPartners === "deletedAt" ? sortDirPartners : null} onSort={requestSortPartners}>Datum vymazania</TableHead>
                      <TableHead sortKey="deletedFromIp" sortDirection={sortKeyPartners === "deletedFromIp" ? sortDirPartners : null} onSort={requestSortPartners}>IP</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcia</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedPartners.map((p: any) => (
                      <TableRow key={p.id} data-testid={`row-archive-partner-${p.id}`}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell>{p.code || "-"}</TableCell>
                        <TableCell>{p.deletedBy || "-"}</TableCell>
                        <TableCell>{formatDate(p.deletedAt)}</TableCell>
                        <TableCell className="text-xs font-mono">{p.deletedFromIp || "-"}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleRestoreClick("partner", p.id, p.name)} data-testid={`button-restore-partner-${p.id}`}>
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Obnovit
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vymazane produkty</CardTitle>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-deleted-products">Ziadne vymazane produkty</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead sortKey="name" sortDirection={sortKeyProducts === "name" ? sortDirProducts : null} onSort={requestSortProducts}>Nazov</TableHead>
                      <TableHead sortKey="partnerId" sortDirection={sortKeyProducts === "partnerId" ? sortDirProducts : null} onSort={requestSortProducts}>Partner</TableHead>
                      <TableHead sortKey="deletedBy" sortDirection={sortKeyProducts === "deletedBy" ? sortDirProducts : null} onSort={requestSortProducts}>Vymazal</TableHead>
                      <TableHead sortKey="deletedAt" sortDirection={sortKeyProducts === "deletedAt" ? sortDirProducts : null} onSort={requestSortProducts}>Datum vymazania</TableHead>
                      <TableHead sortKey="deletedFromIp" sortDirection={sortKeyProducts === "deletedFromIp" ? sortDirProducts : null} onSort={requestSortProducts}>IP</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcia</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProducts.map((p: any) => (
                      <TableRow key={p.id} data-testid={`row-archive-product-${p.id}`}>
                        <TableCell className="font-medium">{p.displayName || p.name}</TableCell>
                        <TableCell>{p.partnerId || "-"}</TableCell>
                        <TableCell>{p.deletedBy || "-"}</TableCell>
                        <TableCell>{formatDate(p.deletedAt)}</TableCell>
                        <TableCell className="text-xs font-mono">{p.deletedFromIp || "-"}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleRestoreClick("product", p.id, p.displayName || p.name)} data-testid={`button-restore-product-${p.id}`}>
                              <RotateCcw className="w-3 h-3 mr-1" />
                              Obnovit
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!restoreTarget} onOpenChange={(open) => { if (!open) { setRestoreTarget(null); setPassword(""); } }}>
        <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto flex flex-col items-start justify-start">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-destructive" />
              Autorizacia administratorom
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 w-full">
            <p className="text-sm text-muted-foreground">
              Pre obnovenie zaznamu <span className="font-semibold text-foreground">{restoreTarget?.name}</span> je potrebna autorizacia administratorom alebo superadminom.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Bezpecnostne heslo administratora</label>
              <Input
                type="password"
                placeholder="Zadajte heslo administratora"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRestoreConfirm()}
                data-testid="input-restore-password"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Kazda operacia obnovy je zaznamenana v audit logu spolu s ID autorizujuceho administratora.
            </p>
          </div>
          <DialogFooter className="gap-2 w-full">
            <Button variant="outline" onClick={() => { setRestoreTarget(null); setPassword(""); }} data-testid="button-cancel-restore">
              Zrusit
            </Button>
            <Button onClick={handleRestoreConfirm} disabled={restoreMutation.isPending || !password} data-testid="button-confirm-restore">
              {restoreMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
              Obnovit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
