import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataLinkaIcon } from "@/components/icons/data-linka-icon";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Upload, FileText, CheckCircle, AlertTriangle, XCircle, Clock, Play, Trash2, RefreshCw, Eye, Check } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

interface OcrJob {
  id: number;
  fileName: string;
  originalName: string;
  status: string;
  extractedText?: string;
  extractedFields?: any[];
  pageCount?: number;
  error?: string;
  uploadedByUsername?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

interface ExtractedField {
  parameterId: number;
  fieldKey: string;
  label: string;
  matchedValue: string | null;
  matchType: string;
  confidence: number;
  needsConfirmation: boolean;
  synonymId?: number;
  synonymStatus?: string;
  synonymConfirmationCount?: number;
  isProposal?: boolean;
}

function getStatusIcon(status: string) {
  switch (status) {
    case "queued": return <Clock className="h-4 w-4 text-muted-foreground" />;
    case "processing": return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
    case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed": return <XCircle className="h-4 w-4 text-red-500" />;
    case "interrupted": return <AlertTriangle className="h-4 w-4 text-orange-500" />;
    default: return <Clock className="h-4 w-4" />;
  }
}

function getStatusBadge(status: string) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    queued: "secondary",
    processing: "default",
    completed: "default",
    failed: "destructive",
    interrupted: "outline",
  };
  const labels: Record<string, string> = {
    queued: "Vo fronte",
    processing: "Spracúva sa",
    completed: "Dokončené",
    failed: "Chyba",
    interrupted: "Prerušené",
  };
  return <Badge variant={variants[status] || "secondary"}>{labels[status] || status}</Badge>;
}

function getFieldColor(field: ExtractedField): string {
  if (field.synonymStatus === "confirmed" && !field.needsConfirmation) {
    return "border-green-500/50 bg-green-500/5";
  }
  if (field.isProposal || field.needsConfirmation) {
    return "border-orange-500/50 bg-orange-500/5";
  }
  if (field.matchType === "label") {
    return "border-sky-500/50 bg-sky-500/5";
  }
  return "border-red-500/50 bg-red-500/5";
}

function getFieldIndicator(field: ExtractedField): { color: string; label: string } {
  if (field.synonymStatus === "confirmed" && !field.needsConfirmation) {
    return { color: "bg-green-500", label: "Potvrdené" };
  }
  if (field.isProposal || field.needsConfirmation) {
    return { color: "bg-orange-500", label: `Učí sa (${field.synonymConfirmationCount || 0}/5)` };
  }
  if (field.matchType === "label") {
    return { color: "bg-sky-500", label: "Priame" };
  }
  return { color: "bg-red-500", label: "Neznáme" };
}

export default function DatatovaLinka() {
  const { toast } = useToast();
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<OcrJob | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: jobs = [], isLoading } = useQuery<OcrJob[]>({
    queryKey: ["/api/datova-linka/jobs"],
    refetchInterval: 5000,
  });

  const processMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest("POST", `/api/datova-linka/process/${jobId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datova-linka/jobs"] });
      toast({ title: "Spracovanie dokončené" });
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/datova-linka/jobs"] });
      toast({ title: "Chyba spracovania", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: number) => apiRequest("DELETE", `/api/datova-linka/jobs/${jobId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/datova-linka/jobs"] });
      toast({ title: "Job vymazaný" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/datova-linka/resume"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/datova-linka/jobs"] });
      toast({ title: "Joby obnovené", description: `${data.resumed || 0} jobov` });
    },
  });

  const processAllMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/datova-linka/process-all"),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/datova-linka/jobs"] });
      toast({ title: "Hromadné spracovanie", description: data.message });
    },
  });

  const confirmFieldMutation = useMutation({
    mutationFn: (params: { synonymId: number; jobId?: number; documentName?: string }) =>
      apiRequest("POST", "/api/datova-linka/confirm-field", params),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/datova-linka/jobs"] });
      toast({ title: "Potvrdené", description: data.message });
    },
  });

  const handleUpload = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    for (const file of fileArray) {
      formData.append("documents", file);
    }

    try {
      const res = await fetch("/api/datova-linka/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/datova-linka/jobs"] });
      toast({ title: "Úspech", description: `Nahratých ${data.totalUploaded} súborov` });
    } catch (err: any) {
      toast({ title: "Chyba nahrávania", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files) handleUpload(e.dataTransfer.files);
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragActive(false), []);

  const openDetail = async (job: OcrJob) => {
    try {
      const res = await fetch(`/api/datova-linka/jobs/${job.id}`, { credentials: "include" });
      const data = await res.json();
      setSelectedJob(data);
      setDetailOpen(true);
    } catch {
      setSelectedJob(job);
      setDetailOpen(true);
    }
  };

  const completedCount = jobs.filter(j => j.status === "completed").length;
  const queuedCount = jobs.filter(j => j.status === "queued").length;
  const failedCount = jobs.filter(j => j.status === "failed").length;
  const processingCount = jobs.filter(j => j.status === "processing").length;
  const interruptedCount = jobs.filter(j => j.status === "interrupted").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <DataLinkaIcon className="w-7 h-7 text-[#6c757d]" />
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-datova-linka-title">Dátová linka</h1>
            <p className="text-sm text-muted-foreground">OCR spracovanie dokumentov • Azure Document Intelligence (Frankfurt) • Automatické spracovanie každých 10s</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {queuedCount > 0 && (
            <Button variant="default" size="sm" onClick={() => processAllMutation.mutate()} disabled={processAllMutation.isPending} data-testid="button-process-all">
              <Play className="h-4 w-4 mr-1" /> Spustiť všetko ({queuedCount})
            </Button>
          )}
          {interruptedCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => resumeMutation.mutate()} disabled={resumeMutation.isPending} data-testid="button-resume-jobs">
              <RefreshCw className="h-4 w-4 mr-1" /> Obnoviť ({interruptedCount})
            </Button>
          )}
          <Badge variant="outline" className="text-xs">
            SK Root: 421 000 000 000 000
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold" data-testid="text-total-jobs">{jobs.length}</div><div className="text-xs text-muted-foreground">Celkom</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-yellow-500" data-testid="text-queued-jobs">{queuedCount}</div><div className="text-xs text-muted-foreground">Vo fronte</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-500" data-testid="text-processing-jobs">{processingCount}</div><div className="text-xs text-muted-foreground">Spracúva sa</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-500" data-testid="text-completed-jobs">{completedCount}</div><div className="text-xs text-muted-foreground">Dokončené</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-red-500" data-testid="text-failed-jobs">{failedCount}</div><div className="text-xs text-muted-foreground">Chyby</div></CardContent></Card>
      </div>

      {jobs.length > 0 && (
        <Progress value={jobs.length > 0 ? (completedCount / jobs.length) * 100 : 0} className="h-2" />
      )}

      <Card>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragActive ? "border-sky-500 bg-sky-500/10" : "border-muted-foreground/25 hover:border-muted-foreground/50"
            } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.multiple = true;
              input.accept = ".pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp";
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) handleUpload(files);
              };
              input.click();
            }}
            data-testid="dropzone-upload"
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium">
              {uploading ? "Nahrávanie..." : "Pretiahnite súbory alebo kliknite pre výber"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              PDF, PNG, JPG, TIFF • Max 100 MB na súbor • Hromadný upload
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Zoznam dokumentov ({jobs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Načítavam...</p>
          ) : jobs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Žiadne dokumenty. Nahrajte prvý dokument vyššie.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Názov</TableHead>
                  <TableHead>Stav</TableHead>
                  <TableHead>Strany</TableHead>
                  <TableHead>Polia</TableHead>
                  <TableHead>Nahral</TableHead>
                  <TableHead>Dátum</TableHead>
                  <TableHead className="text-right">Akcie</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const fields = typeof job.extractedFields === "string" ? JSON.parse(job.extractedFields) : (job.extractedFields || []);
                  return (
                    <TableRow key={job.id} data-testid={`row-job-${job.id}`}>
                      <TableCell className="font-medium max-w-[200px] truncate" data-testid={`text-job-name-${job.id}`}>
                        {job.originalName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(job.status)}
                          {getStatusBadge(job.status)}
                        </div>
                      </TableCell>
                      <TableCell>{job.pageCount ?? "-"}</TableCell>
                      <TableCell>{fields.length > 0 ? fields.length : "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{job.uploadedByUsername || "-"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(job.createdAt).toLocaleDateString("sk-SK")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {job.status === "queued" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => processMutation.mutate(job.id)}
                              disabled={processMutation.isPending}
                              data-testid={`button-process-${job.id}`}
                              title="Spracovať"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {job.status === "completed" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDetail(job)}
                              data-testid={`button-view-${job.id}`}
                              title="Zobraziť výsledky"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(job.id)}
                            disabled={deleteMutation.isPending}
                            data-testid={`button-delete-${job.id}`}
                            title="Vymazať"
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedJob?.originalName || "Detail dokumentu"}
            </DialogTitle>
          </DialogHeader>
          {selectedJob && <JobDetailView job={selectedJob} onConfirm={(synonymId) => confirmFieldMutation.mutate({ synonymId, jobId: selectedJob.id, documentName: selectedJob.originalName })} confirmPending={confirmFieldMutation.isPending} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function JobDetailView({ job, onConfirm, confirmPending }: { job: OcrJob; onConfirm: (synonymId: number) => void; confirmPending: boolean }) {
  const fields: ExtractedField[] = Array.isArray(job.extractedFields) ? job.extractedFields : [];
  const confirmedFields = fields.filter(f => f.synonymStatus === "confirmed" && !f.needsConfirmation);
  const learningFields = fields.filter(f => f.isProposal || f.needsConfirmation);
  const directFields = fields.filter(f => !f.isProposal && !f.needsConfirmation && f.matchType === "label");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[70vh]">
      <div className="border rounded-lg overflow-hidden">
        <div className="p-3 bg-muted/50 border-b">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Originálny text ({job.pageCount || 0} strán)
          </h3>
        </div>
        <ScrollArea className="h-[calc(70vh-60px)]">
          <pre className="p-4 text-xs font-mono whitespace-pre-wrap text-muted-foreground" data-testid="text-extracted-content">
            {job.extractedText || "Žiadny extrahovaný text"}
          </pre>
        </ScrollArea>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="p-3 bg-muted/50 border-b">
          <h3 className="font-medium text-sm flex items-center gap-2">
            Extrahované polia ({fields.length})
          </h3>
          <div className="flex gap-2 mt-1.5">
            <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/50">
              <div className="w-2 h-2 rounded-full bg-green-500 mr-1" /> Potvrdené ({confirmedFields.length})
            </Badge>
            <Badge variant="outline" className="text-xs bg-orange-500/10 border-orange-500/50">
              <div className="w-2 h-2 rounded-full bg-orange-500 mr-1" /> Učí sa ({learningFields.length})
            </Badge>
            <Badge variant="outline" className="text-xs bg-sky-500/10 border-sky-500/50">
              <div className="w-2 h-2 rounded-full bg-sky-500 mr-1" /> Priame ({directFields.length})
            </Badge>
          </div>
        </div>
        <ScrollArea className="h-[calc(70vh-90px)]">
          <div className="p-3 space-y-2">
            {fields.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Žiadne extrahované polia</p>
            ) : (
              fields.map((field, idx) => {
                const indicator = getFieldIndicator(field);
                return (
                  <div
                    key={idx}
                    className={`p-3 border rounded-lg ${getFieldColor(field)}`}
                    data-testid={`field-result-${field.fieldKey}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${indicator.color}`} />
                        <span className="text-sm font-medium">{field.label}</span>
                        <Badge variant="outline" className="text-[10px]">{field.fieldKey}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px]">{field.confidence}%</Badge>
                        <Badge variant="outline" className="text-[10px]">{indicator.label}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        defaultValue={field.matchedValue || ""}
                        className="text-sm h-8"
                        readOnly
                        data-testid={`input-field-value-${field.fieldKey}`}
                      />
                      {field.needsConfirmation && field.synonymId && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 shrink-0 border-orange-500/50 hover:bg-orange-500/10"
                          onClick={() => onConfirm(field.synonymId!)}
                          disabled={confirmPending}
                          data-testid={`button-confirm-${field.fieldKey}`}
                        >
                          <Check className="h-3 w-3 mr-1" /> Potvrdiť
                        </Button>
                      )}
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      Typ zhody: {field.matchType} {field.synonymId ? `• Synonymum #${field.synonymId}` : ""}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
