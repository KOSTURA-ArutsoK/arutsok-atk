import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateTimeSlovak } from "@/lib/utils";
import { Loader2, Check, X, ClipboardCheck, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";

interface TransferStep {
  step: number;
  stepName: string;
  waitingFor: string;
}

interface TransferTask {
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
  pdfPath: string | null;
  createdAt: string;
  currentStep: TransferStep;
  taskRole: string;
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

function ApprovalStepper({ task }: { task: TransferTask }) {
  const steps = [
    { label: "Žiadateľ", name: task.requestedByName, time: task.requesterApprovedAt },
    { label: "Prijímajúci garant", name: task.receivingGuarantorName, time: task.receivingGuarantorApprovedAt },
    { label: "Odchádzajúci garant", name: task.leavingGuarantorName, time: task.leavingGuarantorApprovedAt },
    { label: "Administrátor", name: task.reviewedByName, time: task.adminApprovedAt },
  ];

  return (
    <div className="flex items-center gap-1 mt-3" data-testid={`stepper-task-${task.id}`}>
      {steps.map((s, i) => {
        const isCompleted = !!s.time;
        const isActive = task.currentStep.step === i + 1;
        return (
          <div key={i} className="flex items-center gap-1">
            {i > 0 && <div className={`w-6 h-0.5 ${isCompleted ? "bg-green-500" : isActive ? "bg-orange-400" : "bg-muted-foreground/20"}`} />}
            <div className="flex flex-col items-center min-w-[80px]">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                isCompleted ? "bg-green-500/20 border-green-500 text-green-400" :
                isActive ? "bg-orange-400/20 border-orange-400 text-orange-300 animate-pulse" :
                "bg-muted border-muted-foreground/30 text-muted-foreground/50"
              }`}>
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className={`text-[10px] mt-1 text-center leading-tight ${isCompleted ? "text-green-400" : isActive ? "text-orange-300" : "text-muted-foreground/50"}`}>
                {s.label}
              </span>
              {s.name && (
                <span className="text-[9px] text-muted-foreground/70 truncate max-w-[80px]">{s.name}</span>
              )}
              {s.time && (
                <span className="text-[9px] text-muted-foreground/50">{formatDateTimeSlovak(s.time)}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function MojeUlohy() {
  const { toast } = useToast();
  const [rejectNote, setRejectNote] = useState<Record<number, string>>({});
  const [showReject, setShowReject] = useState<Record<number, boolean>>({});

  const { data, isLoading } = useQuery<{ tasks: TransferTask[]; subjects: SubjectInfo[] }>({
    queryKey: ["/api/my-tasks"],
    refetchInterval: 15000,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/network/transfer-requests/${id}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/transfer-requests"] });
      toast({ title: "Schválené", description: "Krok bol úspešne schválený" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa schváliť", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reviewNote }: { id: number; reviewNote: string }) => {
      await apiRequest("PATCH", `/api/network/transfer-requests/${id}/reject`, { reviewNote });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-tasks/count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/transfer-requests"] });
      toast({ title: "Zamietnuté", description: "Žiadosť bola zamietnutá" });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message || "Nepodarilo sa zamietnuť", variant: "destructive" });
    },
  });

  const tasks = data?.tasks || [];
  const subjectMap = new Map((data?.subjects || []).map(s => [s.id, s]));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="page-moje-ulohy">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Moje úlohy</h1>
        {tasks.length > 0 && (
          <Badge variant="destructive" data-testid="total-task-count">{tasks.length}</Badge>
        )}
      </div>

      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nemáte žiadne čakajúce úlohy</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <Card key={task.id} className="border-l-4 border-l-orange-400" data-testid={`task-card-${task.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    Prestupový protokol #{task.id}
                  </CardTitle>
                  <Badge variant="outline" className="text-orange-400 border-orange-400" data-testid={`badge-role-${task.id}`}>
                    {task.taskRole}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Subjekt:</span>
                    <p className="font-medium" data-testid={`subject-name-${task.id}`}>{getSubjectName(subjectMap.get(task.subjectId))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Pôvodný garant:</span>
                    <p className="font-medium">{getSubjectName(subjectMap.get(task.currentGuarantorId))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Nový garant:</span>
                    <p className="font-medium">{getSubjectName(subjectMap.get(task.requestedGuarantorId))}</p>
                  </div>
                </div>

                {task.reason && (
                  <div className="text-sm">
                    <span className="text-muted-foreground text-xs">Dôvod:</span>
                    <p>{task.reason}</p>
                  </div>
                )}

                <ApprovalStepper task={task} />

                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(task.id)}
                    disabled={approveMutation.isPending}
                    data-testid={`btn-approve-${task.id}`}
                  >
                    {approveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                    Schváliť
                  </Button>
                  {!showReject[task.id] ? (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setShowReject(prev => ({ ...prev, [task.id]: true }))}
                      data-testid={`btn-show-reject-${task.id}`}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Zamietnuť
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 flex-1">
                      <Textarea
                        value={rejectNote[task.id] || ""}
                        onChange={e => setRejectNote(prev => ({ ...prev, [task.id]: e.target.value }))}
                        placeholder="Dôvod zamietnutia..."
                        className="h-8 text-sm"
                        data-testid={`input-reject-note-${task.id}`}
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => rejectMutation.mutate({ id: task.id, reviewNote: rejectNote[task.id] || "" })}
                        disabled={rejectMutation.isPending}
                        data-testid={`btn-confirm-reject-${task.id}`}
                      >
                        {rejectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Potvrdiť"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowReject(prev => ({ ...prev, [task.id]: false }))}
                      >
                        Zrušiť
                      </Button>
                    </div>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {formatDateTimeSlovak(task.createdAt)}
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
