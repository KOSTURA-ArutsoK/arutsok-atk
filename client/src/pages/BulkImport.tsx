import { useState, useCallback, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, FileSpreadsheet, ArrowRight, ArrowLeft, Check, AlertTriangle, XCircle, Loader2, ChevronDown, ChevronUp, Info, Download } from "lucide-react";

type Step = "upload" | "mapping" | "validation" | "complete";

const MAPPING_FIELDS = [
  { key: "contractNumber", label: "Číslo zmluvy", required: true },
  { key: "status", label: "Stav zmluvy", required: true },
  { key: "agent", label: "Sprostredkovateľ", required: false },
  { key: "commission", label: "Suma provízie", required: false },
  { key: "note", label: "Poznámka", required: false },
];

export default function BulkImport() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [parsedData, setParsedData] = useState<{
    headers: string[];
    sampleRows: Record<string, any>[];
    allRows: Record<string, any>[];
    totalRows: number;
    fileName: string;
  } | null>(null);

  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [validationResults, setValidationResults] = useState<any>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [importResult, setImportResult] = useState<any>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls)$/i)) {
      toast({ title: "Neplatný formát", description: "Nahrajte súbor vo formáte .xlsx alebo .xls", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/bulk-import/parse", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Chyba pri nahrávaní");
      }
      const data = await res.json();
      setParsedData(data);
      setMapping({});
      setStep("mapping");
      toast({ title: "Súbor načítaný", description: `${data.totalRows} riadkov, ${data.headers.length} stĺpcov` });
    } catch (err: any) {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleValidate = useCallback(async () => {
    if (!parsedData) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/bulk-import/validate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedData.allRows, mapping }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      const data = await res.json();
      setValidationResults(data);
      setStep("validation");
    } catch (err: any) {
      toast({ title: "Chyba validácie", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [parsedData, mapping, toast]);

  const handleExecute = useCallback(async () => {
    if (!validationResults || !parsedData) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/bulk-import/execute", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: parsedData.allRows,
          mapping,
          fileName: parsedData.fileName,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message);
      }
      const data = await res.json();
      setImportResult(data);
      setStep("complete");
      toast({ title: "Import dokončený", description: `${data.successCount} zmlúv spracovaných` });
    } catch (err: any) {
      toast({ title: "Import zlyhal", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [validationResults, parsedData, mapping, toast]);

  const handleReset = () => {
    setStep("upload");
    setParsedData(null);
    setMapping({});
    setValidationResults(null);
    setExpandedRow(null);
    setImportResult(null);
  };

  const requiredMapped = MAPPING_FIELDS.filter(f => f.required).every(f => mapping[f.key]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg font-bold" data-testid="text-page-title">Hromadný import stavov</h1>
          <p className="text-xs text-muted-foreground">Import stavov zmlúv z Excel súboru</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["upload", "mapping", "validation", "complete"].map((s, i) => (
            <div key={s} className="flex items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s ? "bg-primary text-primary-foreground" :
                ["upload", "mapping", "validation", "complete"].indexOf(step) > i ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              }`} data-testid={`step-indicator-${s}`}>
                {i + 1}
              </div>
              <span className={`text-xs ${step === s ? "font-semibold" : "text-muted-foreground"}`}>
                {s === "upload" ? "Nahratie" : s === "mapping" ? "Mapovanie" : s === "validation" ? "Kontrola" : "Hotovo"}
              </span>
              {i < 3 && <ArrowRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {step === "upload" && (
          <Card>
            <CardContent className="p-8">
              <div
                className={`border-2 border-dashed rounded-md p-12 text-center transition-colors ${
                  isDragOver ? "border-primary bg-primary/5" : "border-border"
                }`}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                data-testid="dropzone-upload"
              >
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Načítavam súbor...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="w-10 h-10 text-muted-foreground" />
                    <p className="text-sm font-medium">Presuňte Excel súbor sem</p>
                    <p className="text-xs text-muted-foreground">alebo</p>
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="button-choose-file"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Vybrať súbor
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFileUpload(f);
                      }}
                      data-testid="input-file-upload"
                    />
                    <p className="text-xs text-muted-foreground">Podporované formáty: .xlsx, .xls</p>
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = "/api/bulk-import/template";
                    a.download = "sablona_import_zmluv.xlsx";
                    a.click();
                  }}
                  data-testid="button-download-template"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Stiahnuť Excel šablónu
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === "mapping" && parsedData && (
          <div className="space-y-4">
            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm flex items-center gap-2 flex-wrap">
                  <FileSpreadsheet className="w-4 h-4" />
                  {parsedData.fileName} — {parsedData.totalRows} riadkov
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-xs text-muted-foreground mb-3">
                  Priraďte stĺpce z Excelu k poliam systému. Povinné polia sú označené hviezdičkou.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MAPPING_FIELDS.map(field => (
                    <div key={field.key} className="space-y-1" data-testid={`mapping-field-${field.key}`}>
                      <label className="text-xs font-medium">
                        {field.label} {field.required && <span className="text-destructive">*</span>}
                      </label>
                      <Select
                        value={mapping[field.key] || ""}
                        onValueChange={(v) => setMapping(prev => ({ ...prev, [field.key]: v === "__none__" ? "" : v }))}
                      >
                        <SelectTrigger className="h-8 text-xs" data-testid={`select-mapping-${field.key}`}>
                          <SelectValue placeholder="Vyberte stĺpec..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Nepriradiť —</SelectItem>
                          {parsedData.headers.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="p-3">
                <CardTitle className="text-sm">Náhľad dát (prvých 5 riadkov)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-10">#</TableHead>
                        {parsedData.headers.map(h => (
                          <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.sampleRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                          {parsedData.headers.map(h => (
                            <TableCell key={h} className="text-xs whitespace-nowrap max-w-[200px] truncate">
                              {row[h] || ""}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" onClick={handleReset} data-testid="button-back-upload">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Späť
              </Button>
              <Button
                onClick={handleValidate}
                disabled={!requiredMapped || isLoading}
                data-testid="button-validate"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Skontrolovať dáta
              </Button>
            </div>
          </div>
        )}

        {step === "validation" && validationResults && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-3">
                <div className="overflow-auto max-h-[calc(100vh-300px)]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-card z-10">
                      <TableRow>
                        <TableHead className="text-xs w-10">#</TableHead>
                        <TableHead className="text-xs w-10">Stav</TableHead>
                        <TableHead className="text-xs">Č. zmluvy</TableHead>
                        <TableHead className="text-xs">Stav zmluvy</TableHead>
                        <TableHead className="text-xs">Sprostredkovateľ</TableHead>
                        <TableHead className="text-xs text-right">Provízia</TableHead>
                        <TableHead className="text-xs">Poznámka</TableHead>
                        <TableHead className="text-xs w-10"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResults.results.map((row: any, i: number) => {
                        const hasErrors = row.errors.length > 0;
                        const hasWarnings = row.warnings.length > 0;
                        const isExpanded = expandedRow === i;
                        const unmappedKeys = parsedData ? parsedData.headers.filter(h =>
                          !Object.values(mapping).includes(h)
                        ) : [];

                        return (
                          <TableRow
                            key={i}
                            className={hasErrors ? "bg-destructive/5" : hasWarnings ? "bg-yellow-500/5" : ""}
                            data-testid={`row-validation-${i}`}
                          >
                            <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                            <TableCell>
                              {hasErrors ? (
                                <XCircle className="w-4 h-4 text-destructive" data-testid={`icon-error-${i}`} />
                              ) : hasWarnings ? (
                                <AlertTriangle className="w-4 h-4 text-yellow-500" data-testid={`icon-warning-${i}`} />
                              ) : (
                                <Check className="w-4 h-4 text-green-500" data-testid={`icon-ok-${i}`} />
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{row.contractNumber || "-"}</TableCell>
                            <TableCell className="text-xs">
                              {row.statusId && row.statusColor ? (
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.statusColor }} />
                                  <span>{row.statusName}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">{row.statusName || "-"}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-xs">{row.agentName || "-"}</TableCell>
                            <TableCell className="text-xs text-right font-mono">
                              {row.commissionAmount ? `${row.commissionAmount.toFixed(2)} €` : "-"}
                            </TableCell>
                            <TableCell className="text-xs max-w-[150px] truncate">{row.note || "-"}</TableCell>
                            <TableCell>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => setExpandedRow(isExpanded ? null : i)}
                                data-testid={`button-expand-${i}`}
                              >
                                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                              </Button>
                            </TableCell>
                            {isExpanded && (
                              <TableCell colSpan={8} className="p-0">
                                <div className="p-3 bg-muted/50 border-t space-y-2">
                                  {row.errors.length > 0 && (
                                    <div className="space-y-1">
                                      {row.errors.map((e: string, ei: number) => (
                                        <div key={ei} className="flex items-center gap-1 text-xs text-destructive">
                                          <XCircle className="w-3 h-3 shrink-0" />
                                          {e}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {row.warnings.length > 0 && (
                                    <div className="space-y-1">
                                      {row.warnings.map((w: string, wi: number) => (
                                        <div key={wi} className="flex items-center gap-1 text-xs text-yellow-600">
                                          <AlertTriangle className="w-3 h-3 shrink-0" />
                                          {w}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {unmappedKeys.length > 0 && (
                                    <div className="space-y-1">
                                      <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                        <Info className="w-3 h-3" /> Nenamapované stĺpce:
                                      </p>
                                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                        {unmappedKeys.map(k => (
                                          <div key={k} className="text-xs">
                                            <span className="text-muted-foreground">{k}:</span>{" "}
                                            <span>{row.originalData[k] || "-"}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button variant="outline" onClick={() => setStep("mapping")} data-testid="button-back-mapping">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Späť na mapovanie
              </Button>
              <Button
                onClick={handleExecute}
                disabled={validationResults.errorCount > 0 || isLoading}
                data-testid="button-execute-import"
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                Potvrdiť import ({validationResults.successCount} riadkov)
              </Button>
            </div>
          </div>
        )}

        {step === "complete" && importResult && (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <h2 className="text-lg font-bold" data-testid="text-import-complete">Import dokončený</h2>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-500" data-testid="text-success-count">{importResult.successCount}</p>
                  <p className="text-xs text-muted-foreground">Úspešných</p>
                </div>
                {importResult.errorCount > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold text-destructive" data-testid="text-error-count">{importResult.errorCount}</p>
                    <p className="text-xs text-muted-foreground">Chybných</p>
                  </div>
                )}
                {importResult.totalCommission > 0 && (
                  <div className="text-center">
                    <p className="text-2xl font-bold" data-testid="text-total-commission">{importResult.totalCommission.toFixed(2)} €</p>
                    <p className="text-xs text-muted-foreground">Celkom provízie</p>
                  </div>
                )}
              </div>
              <Button onClick={handleReset} data-testid="button-new-import">
                Nový import
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {step === "validation" && validationResults && (
        <div className="border-t bg-card p-3 flex items-center justify-between gap-2 flex-wrap" data-testid="summary-bar">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-muted-foreground">
              Počet riadkov: <span className="font-bold text-foreground">{validationResults.totalRows}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Celkom provízie: <span className="font-bold text-foreground">{validationResults.totalCommission.toFixed(2)} €</span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="text-xs" data-testid="badge-success-count">
              <Check className="w-3 h-3 mr-1 text-green-500" />
              {validationResults.successCount} OK
            </Badge>
            {validationResults.warningCount > 0 && (
              <Badge variant="secondary" className="text-xs" data-testid="badge-warning-count">
                <AlertTriangle className="w-3 h-3 mr-1 text-yellow-500" />
                {validationResults.warningCount} varovanie
              </Badge>
            )}
            {validationResults.errorCount > 0 && (
              <Badge variant="destructive" className="text-xs" data-testid="badge-error-count">
                <XCircle className="w-3 h-3 mr-1" />
                {validationResults.errorCount} chyba
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
