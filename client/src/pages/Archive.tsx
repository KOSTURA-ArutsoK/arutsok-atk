import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAppUser } from "@/hooks/use-app-user";
import { useToast } from "@/hooks/use-toast";
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
                      <TableHead>Nazov</TableHead>
                      <TableHead>Kod</TableHead>
                      <TableHead>Vymazal</TableHead>
                      <TableHead>Datum vymazania</TableHead>
                      <TableHead>IP</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcia</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((c: any) => (
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
                      <TableHead>Nazov</TableHead>
                      <TableHead>Kod</TableHead>
                      <TableHead>Vymazal</TableHead>
                      <TableHead>Datum vymazania</TableHead>
                      <TableHead>IP</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcia</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {partners.map((p: any) => (
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
                      <TableHead>Nazov</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Vymazal</TableHead>
                      <TableHead>Datum vymazania</TableHead>
                      <TableHead>IP</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcia</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((p: any) => (
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Potvrdenie obnovy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Pre obnovenie zaznamu <span className="font-semibold text-foreground">{restoreTarget?.name}</span> zadajte bezpecnostne heslo:
            </p>
            <Input
              type="password"
              placeholder="Bezpecnostne heslo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRestoreConfirm()}
              data-testid="input-restore-password"
            />
          </div>
          <DialogFooter className="gap-2">
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
