import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, Eye, ArrowLeft, Check, XCircle, Loader2 } from "lucide-react";
import { Link } from "wouter";
import type { ImportLog } from "@shared/schema";

type EnrichedImportLog = ImportLog & { userName: string };

function formatDateSk(d: string | Date | null) {
  if (!d) return "-";
  const date = new Date(d);
  return date.toLocaleDateString("sk-SK", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function ImportArchive() {
  const [detailId, setDetailId] = useState<number | null>(null);

  const { data: logs, isLoading } = useQuery<EnrichedImportLog[]>({
    queryKey: ["/api/bulk-import/logs"],
  });

  const { data: detail, isLoading: detailLoading } = useQuery<any>({
    queryKey: ["/api/bulk-import/logs", detailId],
    enabled: detailId !== null,
    queryFn: async () => {
      const res = await fetch(`/api/bulk-import/logs/${detailId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-bold" data-testid="text-archive-title">Archív importov</h1>
          <p className="text-xs text-muted-foreground">História všetkých hromadných importov stavov</p>
        </div>
        <Link href="/bulk-import">
          <Button variant="outline" data-testid="button-new-import">
            <FileSpreadsheet className="w-4 h-4 mr-1" />
            Nový import
          </Button>
        </Link>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !logs || logs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground" data-testid="text-no-imports">Zatiaľ nebol vykonaný žiadny import</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Dátum</TableHead>
                    <TableHead className="text-xs">Súbor</TableHead>
                    <TableHead className="text-xs">Používateľ</TableHead>
                    <TableHead className="text-xs text-center">Riadkov</TableHead>
                    <TableHead className="text-xs text-center">Úspešných</TableHead>
                    <TableHead className="text-xs text-center">Chybných</TableHead>
                    <TableHead className="text-xs text-right">Provízie</TableHead>
                    <TableHead className="text-xs w-16">Akcie</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id} data-testid={`row-import-${log.id}`}>
                      <TableCell className="text-xs">{formatDateSk(log.uploadedAt)}</TableCell>
                      <TableCell className="text-xs font-medium max-w-[200px] truncate">{log.fileName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{log.userName}</TableCell>
                      <TableCell className="text-xs text-center">{log.totalRows}</TableCell>
                      <TableCell className="text-xs text-center">
                        <Badge variant="secondary" className="text-xs">
                          <Check className="w-3 h-3 mr-0.5 text-green-500" />
                          {log.successCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center">
                        {(log.errorCount || 0) > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            <XCircle className="w-3 h-3 mr-0.5" />
                            {log.errorCount}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono">
                        {parseFloat(log.totalCommission || "0").toFixed(2)} €
                      </TableCell>
                      <TableCell>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setDetailId(log.id)}
                          data-testid={`button-view-import-${log.id}`}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={detailId !== null} onOpenChange={(open) => { if (!open) setDetailId(null); }}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2 flex-wrap">
              <FileSpreadsheet className="w-4 h-4" />
              {detail?.fileName || "Detail importu"}
              <span className="text-xs text-muted-foreground font-normal">
                {detail ? formatDateSk(detail.uploadedAt) : ""}
              </span>
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : detail ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap text-xs">
                <span>Používateľ: <strong>{detail.userName}</strong></span>
                <span>Riadkov: <strong>{detail.totalRows}</strong></span>
                <span>Úspešných: <strong className="text-green-500">{detail.successCount}</strong></span>
                <span>Chybných: <strong className="text-destructive">{detail.errorCount}</strong></span>
                <span>Provízie: <strong>{parseFloat(detail.totalCommission || "0").toFixed(2)} €</strong></span>
              </div>

              {detail.rawData && detail.rawData.length > 0 && (
                <div className="overflow-auto max-h-[50vh]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="text-xs w-10">#</TableHead>
                        {Object.keys(detail.rawData[0]).map((key: string) => (
                          <TableHead key={key} className="text-xs whitespace-nowrap">{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.rawData.map((row: Record<string, any>, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          {Object.values(row).map((val: any, vi: number) => (
                            <TableCell key={vi} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                              {String(val || "")}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {detail.commissions && detail.commissions.length > 0 && (
                <div>
                  <h3 className="text-xs font-medium mb-1">Provízie z tohto importu</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Zmluva ID</TableHead>
                        <TableHead className="text-xs text-right">Suma</TableHead>
                        <TableHead className="text-xs">Mena</TableHead>
                        <TableHead className="text-xs">Stav</TableHead>
                        <TableHead className="text-xs">Dátum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.commissions.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs font-mono">{c.contractId}</TableCell>
                          <TableCell className="text-xs text-right font-mono">{parseFloat(c.amount).toFixed(2)}</TableCell>
                          <TableCell className="text-xs">{c.currency}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant={c.status === "finalizovana" ? "default" : "secondary"} className="text-xs">
                              {c.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{formatDateSk(c.creditDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
