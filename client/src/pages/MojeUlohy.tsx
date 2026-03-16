import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDateTimeSlovak } from "@/lib/utils";
import { Loader2, Check, X, ClipboardCheck, FileText, Download, AlertTriangle, ExternalLink, XCircle, Archive, CalendarDays, FileBarChart, Building2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

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

interface ContractItem {
  id: number;
  uid: string | null;
  contractNumber: string | null;
  statusId: number | null;
  lifecyclePhase?: number | null;
  klientUid: string | null;
  specialistaUid: string | null;
  partnerId: number | null;
  productId?: number | null;
  incompleteData: boolean | null;
  incompleteDataReason: string | null;
  lastStatusUpdate: string | null;
  updatedAt?: string | null;
  createdAt: string | null;
}

interface InterventionStatus {
  id: number;
  name: string;
}

interface SubjectInfo {
  id: number;
  uid: string;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
  type: string;
}

interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  allDay: boolean;
  color: string | null;
}

interface NbsReportTask {
  period: string;
  periodLabel: string;
  year: number;
  status: string;
  deadline: string;
  daysLeft: number;
}

interface CompanyWithoutOfficers {
  id: number;
  name: string;
  uid: string | null;
}

interface MyTasksResponse {
  tasks: TransferTask[];
  subjects: SubjectInfo[];
  interventions: ContractItem[];
  interventionStatuses: InterventionStatus[];
  internalInterventions: ContractItem[];
  rejectedContracts: ContractItem[];
  archivedContracts: ContractItem[];
  upcomingEvents: CalendarEvent[];
  nbsReportTasks?: NbsReportTask[];
  companiesWithoutOfficers?: CompanyWithoutOfficers[];
}

function getSubjectName(sub: SubjectInfo | undefined): string {
  if (!sub) return "—";
  if (sub.type === "company") return sub.companyName || "—";
  return `${sub.firstName || ""} ${sub.lastName || ""}`.trim() || "—";
}

function ContractSection({ title, icon, contracts, borderColor, badgeClass, badgeLabel, statusMap, navigate, testIdPrefix }: {
  title: string;
  icon: React.ReactNode;
  contracts: ContractItem[];
  borderColor: string;
  badgeClass: string;
  badgeLabel: string;
  statusMap?: Map<number, string>;
  navigate: (path: string) => void;
  testIdPrefix: string;
}) {
  if (contracts.length === 0) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="outline" className={badgeClass} data-testid={`${testIdPrefix}-count`}>{contracts.length}</Badge>
      </div>
      <div className="space-y-3">
        {contracts.map(contract => (
          <Card
            key={`${testIdPrefix}-${contract.id}`}
            className={`border-l-4 ${borderColor} cursor-pointer hover:bg-muted/30 transition-colors`}
            onClick={() => navigate(`/contracts/${contract.id}/edit`)}
            data-testid={`${testIdPrefix}-card-${contract.id}`}
          >
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate" data-testid={`${testIdPrefix}-number-${contract.id}`}>
                      Zmluva č. {contract.contractNumber || contract.uid || `${contract.id}`}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      {statusMap && contract.statusId ? (
                        <span>Stav: {statusMap.get(contract.statusId) || `${contract.statusId}`}</span>
                      ) : null}
                      {contract.incompleteDataReason && (
                        <span className="text-orange-400 truncate max-w-[300px]">Dôvod: {contract.incompleteDataReason}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={`${badgeClass} text-[10px]`}>
                    {badgeLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {contract.lastStatusUpdate ? formatDateTimeSlovak(contract.lastStatusUpdate) : contract.createdAt ? formatDateTimeSlovak(contract.createdAt) : "—"}
                  </span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
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

function NbsReportSection({ tasks, title, isUrgent, minDays, blinkActive, navigate }: {
  tasks: NbsReportTask[];
  title: string;
  isUrgent: boolean;
  minDays: number;
  blinkActive: boolean;
  navigate: (path: string) => void;
}) {
  if (tasks.length === 0) return null;

  function getNbsBorderColor(daysLeft: number): string {
    if (daysLeft <= 7) return "border-l-red-500";
    if (daysLeft <= 14) return "border-l-orange-500";
    return "border-l-blue-500";
  }

  function getNbsStatusLabel(status: string): string {
    switch (status) {
      case "sent": return "Odoslané";
      case "checked": return "Skontrolované";
      default: return "Neodoslané";
    }
  }

  function formatDeadline(deadline: string): string {
    const d = new Date(deadline);
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    return `${day}.${month}.${d.getFullYear()}`;
  }

  const shouldBlink = (daysLeft: number) => {
    if (daysLeft <= 3) return blinkActive ? "animate-pulse" : "";
    if (daysLeft <= 7) return "animate-pulse";
    return "";
  };

  return (
    <div className="space-y-4" data-testid={isUrgent ? "nbs-urgent-section" : "nbs-normal-section"}>
      <div className="flex items-center gap-2">
        <FileBarChart className={`w-5 h-5 ${isUrgent ? "text-red-500" : "text-blue-500"}`} />
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="outline" className={isUrgent ? "border-red-500 text-red-400" : "border-blue-500 text-blue-400"} data-testid="nbs-task-count">{tasks.length}</Badge>
      </div>
      <div className="space-y-3">
        {tasks.map(task => {
          const blinkClass = shouldBlink(task.daysLeft);
          const borderColor = getNbsBorderColor(task.daysLeft);
          const daysColor = task.daysLeft <= 7 ? "bg-red-600 text-white" : task.daysLeft <= 14 ? "bg-orange-500 text-white" : "bg-blue-600 text-white";

          return (
            <Card
              key={`${task.period}-${task.year}`}
              className={`border-l-4 ${borderColor} cursor-pointer hover:bg-muted/50 transition-colors ${blinkClass}`}
              onClick={() => navigate("/reporty-nbs")}
              data-testid={`nbs-task-${task.period}-${task.year}`}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileBarChart className={`w-4 h-4 shrink-0 ${task.daysLeft <= 7 ? "text-red-400" : task.daysLeft <= 14 ? "text-orange-400" : "text-blue-400"}`} />
                    <div className="min-w-0">
                      <span className="font-medium text-sm" data-testid={`nbs-task-title-${task.period}-${task.year}`}>
                        NBS Report — {task.periodLabel} {task.year}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Termín: {formatDeadline(task.deadline)} • Stav: {getNbsStatusLabel(task.status)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${daysColor}`} data-testid={`nbs-days-left-${task.period}-${task.year}`}>
                      {task.daysLeft >= 0 ? `${task.daysLeft} dní` : `${Math.abs(task.daysLeft)} dní po termíne`}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default function MojeUlohy() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [rejectNote, setRejectNote] = useState<Record<number, string>>({});
  const [showReject, setShowReject] = useState<Record<number, boolean>>({});
  const [nbsBlinkActive, setNbsBlinkActive] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setNbsBlinkActive(false), 10000);
    return () => clearTimeout(timer);
  }, []);

  const { data, isLoading } = useQuery<MyTasksResponse>({
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
  const interventions = data?.interventions || [];
  const interventionStatuses = data?.interventionStatuses || [];
  const internalInterventions = data?.internalInterventions || [];
  const rejectedContracts = data?.rejectedContracts || [];
  const archivedContracts = data?.archivedContracts || [];
  const upcomingEvents = data?.upcomingEvents || [];
  const nbsReportTasks = data?.nbsReportTasks || [];
  const companiesWithoutOfficers = data?.companiesWithoutOfficers || [];
  const subjectMap = new Map((data?.subjects || []).map(s => [s.id, s]));
  const statusMap = new Map(interventionStatuses.map(s => [s.id, s.name]));
  const nonCalendarCount = tasks.length + interventions.length + internalInterventions.length + rejectedContracts.length + archivedContracts.length + nbsReportTasks.length + companiesWithoutOfficers.length;
  const totalCount = nonCalendarCount + upcomingEvents.length;

  const urgentNbs = nbsReportTasks.filter(t => t.daysLeft <= 14);
  const normalNbs = nbsReportTasks.filter(t => t.daysLeft > 14);
  const hasUrgentNbs = urgentNbs.length > 0;
  const minNbsDays = nbsReportTasks.length > 0 ? Math.min(...nbsReportTasks.map(t => t.daysLeft)) : Infinity;

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
        {totalCount > 0 && (
          <Badge variant="destructive" data-testid="total-task-count">{totalCount}</Badge>
        )}
      </div>

      {totalCount === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Nemáte žiadne čakajúce úlohy</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8" data-testid="tasks-container">
          {companiesWithoutOfficers.length > 0 && (
            <div className="space-y-4" data-testid="companies-without-officers-section">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
                <h2 className="text-lg font-semibold">Firmy bez zapísaných štatutárov</h2>
                <Badge variant="outline" className="border-red-500 text-red-400" data-testid="companies-without-officers-count">
                  {companiesWithoutOfficers.length}
                </Badge>
              </div>
              <div className="space-y-3">
                {companiesWithoutOfficers.map(company => (
                  <Card
                    key={company.id}
                    className="border-l-4 border-l-red-600 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/companies`)}
                    data-testid={`company-without-officers-card-${company.id}`}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <Building2 className="w-4 h-4 shrink-0 text-red-400" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm" data-testid={`company-without-officers-name-${company.id}`}>
                              {company.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Potrebné zapísať štatutárov do systému
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="border-red-500 text-red-400 text-[10px]">
                            Chýba štatutár
                          </Badge>
                          <ExternalLink className="w-3 h-3 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {hasUrgentNbs && (
            <NbsReportSection
              tasks={urgentNbs}
              title="NBS Reporty — URGENTNÉ"
              isUrgent={true}
              minDays={minNbsDays}
              blinkActive={nbsBlinkActive}
              navigate={navigate}
            />
          )}

          <ContractSection
            title="Intervencie"
            icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
            contracts={interventions}
            borderColor="border-l-orange-500"
            badgeClass="border-orange-500 text-orange-400"
            badgeLabel="Intervencia"
            statusMap={statusMap}
            navigate={navigate}
            testIdPrefix="intervention"
          />

          <ContractSection
            title="Interné intervencie"
            icon={<AlertTriangle className="w-5 h-5 text-amber-500" />}
            contracts={internalInterventions}
            borderColor="border-l-amber-500"
            badgeClass="border-amber-500 text-amber-400"
            badgeLabel="Interná intervencia"
            navigate={navigate}
            testIdPrefix="internal-intervention"
          />

          <ContractSection
            title="Neprijaté zmluvy – výhrady"
            icon={<XCircle className="w-5 h-5 text-red-500" />}
            contracts={rejectedContracts}
            borderColor="border-l-red-500"
            badgeClass="border-red-500 text-red-400"
            badgeLabel="Výhrady"
            navigate={navigate}
            testIdPrefix="rejected"
          />

          <ContractSection
            title="Archív zmlúv (s výhradami)"
            icon={<Archive className="w-5 h-5 text-muted-foreground" />}
            contracts={archivedContracts}
            borderColor="border-l-muted-foreground"
            badgeClass="border-muted-foreground text-muted-foreground"
            badgeLabel="Archív"
            navigate={navigate}
            testIdPrefix="archived"
          />

          {normalNbs.length > 0 && (
            <NbsReportSection
              tasks={normalNbs}
              title="NBS Reporty"
              isUrgent={false}
              minDays={minNbsDays}
              blinkActive={false}
              navigate={navigate}
            />
          )}

          {tasks.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-amber-500" />
                <h2 className="text-lg font-semibold">Prestupové protokoly</h2>
                <Badge variant="outline" className="border-amber-500 text-amber-400" data-testid="transfer-count">{tasks.length}</Badge>
              </div>
              <div className="space-y-4">
                {tasks.map(task => (
                  <Card key={task.id} className="border-l-4 border-l-amber-400" data-testid={`task-card-${task.id}`}>
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
            </div>
          )}

          {upcomingEvents.length > 0 && (
            <div className="space-y-4" data-testid="upcoming-events-section">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-blue-500" />
                <h2 className="text-lg font-semibold">Najbližšie udalosti</h2>
                <Badge variant="outline" className="border-blue-500 text-blue-400" data-testid="upcoming-events-count">{upcomingEvents.length}</Badge>
              </div>
              <div className="space-y-3">
                {upcomingEvents.map(event => (
                  <Card key={event.id} className="border-l-4 border-l-blue-500" data-testid={`event-card-${event.id}`}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <CalendarDays className="w-4 h-4 text-blue-400 shrink-0" />
                          <div className="min-w-0">
                            <span className="font-medium text-sm" data-testid={`event-title-${event.id}`}>{event.title}</span>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate" data-testid={`event-desc-${event.id}`}>{event.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="border-blue-500 text-blue-400 text-[10px]">
                            {event.allDay ? "Celodenná" : "Udalosť"}
                          </Badge>
                          <span className="text-xs text-muted-foreground" data-testid={`event-date-${event.id}`}>
                            {formatDateTimeSlovak(event.startDate)}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
