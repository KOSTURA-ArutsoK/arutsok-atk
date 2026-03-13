import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAppUser } from "@/hooks/use-app-user";
import { isAdmin as checkIsAdmin, formatDateTimeSlovak, formatUid } from "@/lib/utils";
import { Loader2, ArrowRightLeft, Check, X, Download, Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

interface TransferStep {
  step: number;
  stepName: string;
  waitingFor: string;
}

interface TransferRequest {
  id: number;
  subjectId: number;
  currentGuarantorId: number;
  requestedGuarantorId: number;
  status: string;
  reason: string;
  requestedByName: string | null;
  requesterApprovedAt: string | null;
  receivingGuarantorName: string | null;
  receivingGuarantorApprovedAt: string | null;
  leavingGuarantorName: string | null;
  leavingGuarantorApprovedAt: string | null;
  reviewedByName: string | null;
  adminApprovedAt: string | null;
  reviewNote: string | null;
  pdfPath: string | null;
  pdfAuditCode: string | null;
  createdAt: string;
  currentStep: TransferStep;
}

interface SubjectInfo {
  id: number;
  uid: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  type: string;
}

function getSubjectName(sub: SubjectInfo | undefined): string {
  if (!sub) return "—";
  if (sub.type === "company") return sub.companyName || "—";
  return `${sub.firstName || ""} ${sub.lastName || ""}`.trim() || "—";
}

function ApprovalStepper({ request }: { request: TransferRequest }) {
  const steps = [
    { label: "Žiadateľ", name: request.requestedByName, time: request.requesterApprovedAt },
    { label: "Prijímajúci garant", name: request.receivingGuarantorName, time: request.receivingGuarantorApprovedAt },
    { label: "Odchádzajúci garant", name: request.leavingGuarantorName, time: request.leavingGuarantorApprovedAt },
    { label: "Administrátor", name: request.reviewedByName, time: request.adminApprovedAt },
  ];

  return (
    <div className="flex items-center gap-1" data-testid={`stepper-${request.id}`}>
      {steps.map((s, i) => {
        const isCompleted = !!s.time;
        const isActive = request.status === "pending_all_approvals" && request.currentStep.step === i + 1;
        const isRejected = request.status === "rejected";
        return (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <div className={`w-8 h-0.5 ${isCompleted ? "bg-green-500" : isActive ? "bg-orange-400" : isRejected ? "bg-red-500/30" : "bg-muted-foreground/20"}`} />}
            <div className="flex flex-col items-center min-w-[90px]">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                isCompleted ? "bg-green-500/20 border-green-500 text-green-400" :
                isActive ? "bg-orange-400/20 border-orange-400 text-orange-300 animate-pulse" :
                isRejected ? "bg-red-500/20 border-red-500/50 text-red-400" :
                "bg-muted border-muted-foreground/30 text-muted-foreground/50"
              }`}>
                {isCompleted ? <Check className="w-4 h-4" /> : isRejected && !isCompleted ? <X className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-[10px] mt-1 text-center leading-tight ${
                isCompleted ? "text-green-400" : isActive ? "text-orange-300" : "text-muted-foreground/50"
              }`}>
                {s.label}
              </span>
              {s.name && <span className="text-[9px] text-muted-foreground/70 truncate max-w-[90px]">{s.name}</span>}
              {s.time && <span className="text-[9px] text-muted-foreground/50">{formatDateTimeSlovak(s.time)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NewTransferDialog({ subjects }: { subjects: SubjectInfo[] }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [currentGuarantorId, setCurrentGuarantorId] = useState("");
  const [requestedGuarantorId, setRequestedGuarantorId] = useState("");
  const [reason, setReason] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/network/transfer-requests", {
        subjectId: parseInt(subjectId),
        currentGuarantorId: parseInt(currentGuarantorId),
        requestedGuarantorId: parseInt(requestedGuarantorId),
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/network/transfer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks/count"] });
      toast({ title: "Vytvorené", description: "Žiadosť o prestup bola vytvorená" });
      setOpen(false);
      setSubjectId(""); setCurrentGuarantorId(""); setRequestedGuarantorId(""); setReason("");
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa vytvoriť žiadosť", variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="btn-new-transfer">
          <Plus className="w-4 h-4 mr-1" />
          Nová žiadosť
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md" data-testid="dialog-new-transfer">
        <DialogHeader>
          <DialogTitle>Nový prestupový protokol</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Subjekt</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger data-testid="select-subject"><SelectValue placeholder="Vybrať subjekt" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{getSubjectName(s)} ({formatUid(s.uid)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pôvodný garant</Label>
            <Select value={currentGuarantorId} onValueChange={setCurrentGuarantorId}>
              <SelectTrigger data-testid="select-current-guarantor"><SelectValue placeholder="Vybrať garanta" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{getSubjectName(s)} ({formatUid(s.uid)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nový garant</Label>
            <Select value={requestedGuarantorId} onValueChange={setRequestedGuarantorId}>
              <SelectTrigger data-testid="select-requested-guarantor"><SelectValue placeholder="Vybrať garanta" /></SelectTrigger>
              <SelectContent>
                {subjects.map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>{getSubjectName(s)} ({formatUid(s.uid)})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dôvod</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Dôvod prestupového protokolu..." data-testid="input-transfer-reason" />
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!subjectId || !currentGuarantorId || !requestedGuarantorId || !reason || createMutation.isPending}
            className="w-full"
            data-testid="btn-submit-transfer"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Vytvoriť žiadosť
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Prestup() {
  const { toast } = useToast();
  const { data: appUser } = useAppUser();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery<{ requests: TransferRequest[]; subjects: SubjectInfo[] }>({
    queryKey: ["/api/network/transfer-requests", statusFilter],
    queryFn: () => fetch(`/api/network/transfer-requests?status=${statusFilter}`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: allSubjects } = useQuery<SubjectInfo[]>({
    queryKey: ["/api/subjects/list-brief"],
    queryFn: () => fetch("/api/subjects?brief=true", { credentials: "include" }).then(r => r.json()).then(d => Array.isArray(d) ? d : d.subjects || []),
  });

  const requests = data?.requests || [];
  const subjectMap = new Map((data?.subjects || []).map(s => [s.id, s]));

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/network/transfer-requests/${id}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/network/transfer-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks/count"] });
      toast({ title: "Schválené", description: "Krok bol úspešne schválený" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa schváliť", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6" data-testid="page-prestup">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Prestupové protokoly</h1>
          <Badge variant="secondary">{requests.length}</Badge>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-prestup-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky</SelectItem>
              <SelectItem value="pending_all_approvals">Čakajúce</SelectItem>
              <SelectItem value="approved">Schválené</SelectItem>
              <SelectItem value="rejected">Zamietnuté</SelectItem>
            </SelectContent>
          </Select>
          <NewTransferDialog subjects={allSubjects || []} />
        </div>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ArrowRightLeft className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Žiadne prestupové protokoly</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <Card key={req.id} className={`border-l-4 ${
              req.status === "approved" ? "border-l-green-500" :
              req.status === "rejected" ? "border-l-red-500" : "border-l-orange-400"
            }`} data-testid={`prestup-card-${req.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    Protokol #{req.id}
                    {req.pdfAuditCode && (
                      <span className="text-xs font-mono text-muted-foreground ml-2">{req.pdfAuditCode}</span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {req.status === "approved" && (
                      <Badge variant="outline" className="text-green-400 border-green-400">Schválený</Badge>
                    )}
                    {req.status === "rejected" && (
                      <Badge variant="outline" className="text-red-400 border-red-400">Zamietnutý</Badge>
                    )}
                    {req.status === "pending_all_approvals" && (
                      <Badge variant="outline" className="text-orange-400 border-orange-400">
                        Krok {req.currentStep.step}/4
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Subjekt:</span>
                    <p className="font-medium">{getSubjectName(subjectMap.get(req.subjectId))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Pôvodný garant:</span>
                    <p className="font-medium">{getSubjectName(subjectMap.get(req.currentGuarantorId))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Nový garant:</span>
                    <p className="font-medium">{getSubjectName(subjectMap.get(req.requestedGuarantorId))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Dôvod:</span>
                    <p className="text-sm">{req.reason}</p>
                  </div>
                </div>

                <ApprovalStepper request={req} />

                {req.reviewNote && (
                  <div className="text-sm bg-muted/30 p-2 rounded">
                    <span className="text-xs text-muted-foreground">Poznámka:</span> {req.reviewNote}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  {req.status === "pending_all_approvals" && checkIsAdmin(appUser) && req.currentStep.waitingFor === "admin" && (
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(req.id)}
                      disabled={approveMutation.isPending}
                      data-testid={`btn-admin-approve-${req.id}`}
                    >
                      <Check className="w-3 h-3 mr-1" /> Schváliť (Admin)
                    </Button>
                  )}
                  {req.pdfPath && (
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      data-testid={`btn-download-pdf-${req.id}`}
                    >
                      <a href={`/api/network/transfer-requests/${req.id}/pdf`} target="_blank" rel="noopener noreferrer">
                        <Download className="w-3 h-3 mr-1" /> Stiahnuť PDF
                      </a>
                    </Button>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    Vytvorené: {formatDateTimeSlovak(req.createdAt)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
