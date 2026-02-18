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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Briefcase, Package, RotateCcw, Lock, Loader2, Trash2, FileText, Database } from "lucide-react";

interface SoftDeletedEntity {
  id: number;
  entityType: string;
  name: string;
  deletedAt: string;
}

export default function Archive() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const isAdmin = appUser?.role === "admin" || appUser?.role === "superadmin";

  const [restoreTarget, setRestoreTarget] = useState<{ entityType: string; id: number; name: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ entityType: string; id: number; name: string } | null>(null);
  const [password, setPassword] = useState("");

  const { data, isLoading } = useQuery<{
    companies: any[];
    partners: any[];
    products: any[];
    contracts: any[];
    softDeleted: SoftDeletedEntity[];
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
      queryClient.invalidateQueries({ queryKey: ["/api/contracts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sectors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sections"] });
      queryClient.invalidateQueries({ queryKey: ["/api/panels"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-folders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-statuses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contract-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/permission-groups"] });
      setRestoreTarget(null);
      setPassword("");
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa obnovit zaznam.", variant: "destructive" });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async ({ entityType, id, password: pw }: { entityType: string; id: number; password: string }) => {
      await apiRequest("POST", `/api/archive/permanent-delete/${entityType}/${id}`, { password: pw });
    },
    onSuccess: () => {
      toast({ title: "Vymazane", description: "Zaznam bol definitvne vymazany." });
      queryClient.invalidateQueries({ queryKey: ["/api/archive/deleted"] });
      setDeleteTarget(null);
      setPassword("");
    },
    onError: () => {
      toast({ title: "Chyba", description: "Nepodarilo sa vymazat zaznam.", variant: "destructive" });
    },
  });

  function handleRestoreClick(entityType: string, id: number, name: string) {
    setRestoreTarget({ entityType, id, name });
    setDeleteTarget(null);
    setPassword("");
  }

  function handleDeleteClick(entityType: string, id: number, name: string) {
    setDeleteTarget({ entityType, id, name });
    setRestoreTarget(null);
    setPassword("");
  }

  function handleRestoreConfirm() {
    if (!restoreTarget || !password) return;
    restoreMutation.mutate({ entityType: restoreTarget.entityType, id: restoreTarget.id, password });
  }

  function handleDeleteConfirm() {
    if (!deleteTarget || !password) return;
    permanentDeleteMutation.mutate({ entityType: deleteTarget.entityType, id: deleteTarget.id, password });
  }

  function formatDate(d: string | null | undefined) {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  const companies = data?.companies || [];
  const partners = data?.partners || [];
  const products = data?.products || [];
  const contracts = data?.contracts || [];
  const softDeleted = data?.softDeleted || [];
  const totalDeleted = companies.length + partners.length + products.length + contracts.length + softDeleted.length;

  const { sortedData: sortedCompanies, sortKey: sortKeyCompanies, sortDirection: sortDirCompanies, requestSort: requestSortCompanies } = useTableSort(companies);
  const { sortedData: sortedPartners, sortKey: sortKeyPartners, sortDirection: sortDirPartners, requestSort: requestSortPartners } = useTableSort(partners);
  const { sortedData: sortedProducts, sortKey: sortKeyProducts, sortDirection: sortDirProducts, requestSort: requestSortProducts } = useTableSort(products);
  const { sortedData: sortedContracts, sortKey: sortKeyContracts, sortDirection: sortDirContracts, requestSort: requestSortContracts } = useTableSort(contracts);
  const { sortedData: sortedSoftDeleted, sortKey: sortKeySoft, sortDirection: sortDirSoft, requestSort: requestSortSoft } = useTableSort(softDeleted);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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

      <Tabs defaultValue="all">
        <TabsList data-testid="tabs-archive" className="flex-wrap gap-1">
          <TabsTrigger value="all" data-testid="tab-archive-all">
            <Database className="w-4 h-4 mr-1" />
            Vsetky ({totalDeleted})
          </TabsTrigger>
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
          <TabsTrigger value="contracts" data-testid="tab-archive-contracts">
            <FileText className="w-4 h-4 mr-1" />
            Zmluvy ({contracts.length})
          </TabsTrigger>
          <TabsTrigger value="entities" data-testid="tab-archive-entities">
            <Database className="w-4 h-4 mr-1" />
            Ostatne ({softDeleted.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vsetky vymazane zaznamy</CardTitle>
            </CardHeader>
            <CardContent>
              {totalDeleted === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-deleted-all">Kos je prazdny</p>
              ) : (
                <div style={{ maxHeight: "calc(100vh - 320px)", overflow: "auto" }}>
                  <Table stickyHeader>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Typ</TableHead>
                        <TableHead>Nazov</TableHead>
                        <TableHead>Datum vymazania</TableHead>
                        {isAdmin && <TableHead className="text-right">Akcie</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.map((c: any) => (
                        <TableRow key={`company-${c.id}`} data-testid={`row-archive-all-company-${c.id}`}>
                          <TableCell><Badge variant="secondary">Spolocnost</Badge></TableCell>
                          <TableCell className="font-medium">{c.name}</TableCell>
                          <TableCell>{formatDate(c.deletedAt)}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleRestoreClick("company", c.id, c.name)} data-testid={`button-restore-all-company-${c.id}`}>
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Obnovit
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {partners.map((p: any) => (
                        <TableRow key={`partner-${p.id}`} data-testid={`row-archive-all-partner-${p.id}`}>
                          <TableCell><Badge variant="secondary">Partner</Badge></TableCell>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{formatDate(p.deletedAt)}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleRestoreClick("partner", p.id, p.name)} data-testid={`button-restore-all-partner-${p.id}`}>
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Obnovit
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {products.map((p: any) => (
                        <TableRow key={`product-${p.id}`} data-testid={`row-archive-all-product-${p.id}`}>
                          <TableCell><Badge variant="secondary">Produkt</Badge></TableCell>
                          <TableCell className="font-medium">{p.displayName || p.name}</TableCell>
                          <TableCell>{formatDate(p.deletedAt)}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleRestoreClick("product", p.id, p.displayName || p.name)} data-testid={`button-restore-all-product-${p.id}`}>
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Obnovit
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {contracts.map((c: any) => (
                        <TableRow key={`contract-${c.id}`} data-testid={`row-archive-all-contract-${c.id}`}>
                          <TableCell><Badge variant="secondary">Zmluva</Badge></TableCell>
                          <TableCell className="font-medium">{c.contractNumber || c.uid || `#${c.id}`}</TableCell>
                          <TableCell>{formatDate(c.deletedAt)}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleRestoreClick("contract", c.id, c.contractNumber || c.uid || `#${c.id}`)} data-testid={`button-restore-all-contract-${c.id}`}>
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Obnovit
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                      {softDeleted.map((e: SoftDeletedEntity) => (
                        <TableRow key={`${e.entityType}-${e.id}`} data-testid={`row-archive-all-${e.entityType}-${e.id}`}>
                          <TableCell><Badge variant="secondary">{e.entityType}</Badge></TableCell>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell>{formatDate(e.deletedAt)}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleRestoreClick(e.entityType, e.id, e.name)} data-testid={`button-restore-all-${e.entityType}-${e.id}`}>
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Obnovit
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(e.entityType, e.id, e.name)} data-testid={`button-permdelete-all-${e.entityType}-${e.id}`}>
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Zmazat
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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

        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vymazane zmluvy</CardTitle>
            </CardHeader>
            <CardContent>
              {contracts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-deleted-contracts">Ziadne vymazane zmluvy</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead sortKey="contractNumber" sortDirection={sortKeyContracts === "contractNumber" ? sortDirContracts : null} onSort={requestSortContracts}>Cislo zmluvy</TableHead>
                      <TableHead sortKey="uid" sortDirection={sortKeyContracts === "uid" ? sortDirContracts : null} onSort={requestSortContracts}>UID</TableHead>
                      <TableHead sortKey="deletedAt" sortDirection={sortKeyContracts === "deletedAt" ? sortDirContracts : null} onSort={requestSortContracts}>Datum vymazania</TableHead>
                      {isAdmin && <TableHead className="text-right">Akcia</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedContracts.map((c: any) => (
                      <TableRow key={c.id} data-testid={`row-archive-contract-${c.id}`}>
                        <TableCell className="font-medium">{c.contractNumber || "-"}</TableCell>
                        <TableCell>{c.uid || "-"}</TableCell>
                        <TableCell>{formatDate(c.deletedAt)}</TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => handleRestoreClick("contract", c.id, c.contractNumber || c.uid || `#${c.id}`)} data-testid={`button-restore-contract-${c.id}`}>
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

        <TabsContent value="entities">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ostatne vymazane zaznamy</CardTitle>
            </CardHeader>
            <CardContent>
              {softDeleted.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-deleted-entities">Ziadne vymazane zaznamy</p>
              ) : (
                <div style={{ maxHeight: "calc(100vh - 320px)", overflow: "auto" }}>
                  <Table stickyHeader>
                    <TableHeader>
                      <TableRow>
                        <TableHead sortKey="entityType" sortDirection={sortKeySoft === "entityType" ? sortDirSoft : null} onSort={requestSortSoft}>Typ</TableHead>
                        <TableHead sortKey="name" sortDirection={sortKeySoft === "name" ? sortDirSoft : null} onSort={requestSortSoft}>Nazov</TableHead>
                        <TableHead sortKey="deletedAt" sortDirection={sortKeySoft === "deletedAt" ? sortDirSoft : null} onSort={requestSortSoft}>Datum vymazania</TableHead>
                        {isAdmin && <TableHead className="text-right">Akcie</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSoftDeleted.map((e: SoftDeletedEntity) => (
                        <TableRow key={`${e.entityType}-${e.id}`} data-testid={`row-archive-entity-${e.entityType}-${e.id}`}>
                          <TableCell><Badge variant="secondary">{e.entityType}</Badge></TableCell>
                          <TableCell className="font-medium">{e.name}</TableCell>
                          <TableCell>{formatDate(e.deletedAt)}</TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => handleRestoreClick(e.entityType, e.id, e.name)} data-testid={`button-restore-entity-${e.entityType}-${e.id}`}>
                                  <RotateCcw className="w-3 h-3 mr-1" />
                                  Obnovit
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(e.entityType, e.id, e.name)} data-testid={`button-permdelete-entity-${e.entityType}-${e.id}`}>
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Zmazat
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
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
            <DialogDescription>
              Pre obnovenie zaznamu je potrebna autorizacia administratorom alebo superadminom.
            </DialogDescription>
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

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setPassword(""); } }}>
        <DialogContent className="sm:max-w-[800px] h-[600px] overflow-y-auto flex flex-col items-start justify-start">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Definitivne vymazanie
            </DialogTitle>
            <DialogDescription>
              Tato akcia je nevratna. Zaznam bude trvalo odstraneny z databazy.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 w-full">
            <p className="text-sm text-destructive font-medium">
              Naozaj chcete definitvne vymazat zaznam <span className="font-semibold">{deleteTarget?.name}</span>? Tuto akciu nie je mozne vratit.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Bezpecnostne heslo administratora</label>
              <Input
                type="password"
                placeholder="Zadajte heslo administratora"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleDeleteConfirm()}
                data-testid="input-permdelete-password"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Kazda operacia definitivneho vymazania je zaznamenana v audit logu.
            </p>
          </div>
          <DialogFooter className="gap-2 w-full">
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setPassword(""); }} data-testid="button-cancel-permdelete">
              Zrusit
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm} disabled={permanentDeleteMutation.isPending || !password} data-testid="button-confirm-permdelete">
              {permanentDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
              Definitvne vymazat
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
