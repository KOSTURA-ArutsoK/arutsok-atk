import { useQuery } from "@tanstack/react-query";
import { formatDateTimeSlovak } from "@/lib/utils";
import { Loader2, FileInput, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

function statusBadge(status: string) {
  switch (status) {
    case "pending_all_approvals":
      return <Badge variant="outline" className="text-orange-400 border-orange-400" data-testid="badge-pending">Čaká na schválenie</Badge>;
    case "approved":
      return <Badge variant="outline" className="text-green-400 border-green-400" data-testid="badge-approved">Schválená</Badge>;
    case "rejected":
      return <Badge variant="outline" className="text-red-400 border-red-400" data-testid="badge-rejected">Zamietnutá</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function Ziadosti() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery<{ requests: TransferRequest[]; subjects: SubjectInfo[] }>({
    queryKey: ["/api/network/transfer-requests", statusFilter],
    queryFn: () => fetch(`/api/network/transfer-requests?status=${statusFilter}`, { credentials: "include" }).then(r => r.json()),
  });

  const requests = data?.requests || [];
  const subjectMap = new Map((data?.subjects || []).map(s => [s.id, s]));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6" data-testid="page-ziadosti">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileInput className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Žiadosti</h1>
          <Badge variant="secondary">{requests.length}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky</SelectItem>
              <SelectItem value="pending_all_approvals">Čakajúce</SelectItem>
              <SelectItem value="approved">Schválené</SelectItem>
              <SelectItem value="rejected">Zamietnuté</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileInput className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Žiadne žiadosti</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm" data-testid="table-ziadosti">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left p-3 font-medium">#</th>
                <th className="text-left p-3 font-medium">Subjekt</th>
                <th className="text-left p-3 font-medium">Pôvodný garant</th>
                <th className="text-left p-3 font-medium">Nový garant</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Krok</th>
                <th className="text-left p-3 font-medium">Vytvorené</th>
              </tr>
            </thead>
            <tbody>
              {requests.map(req => (
                <tr key={req.id} className="border-b hover:bg-muted/30 transition-colors" data-testid={`row-request-${req.id}`}>
                  <td className="p-3 font-mono text-xs">{req.id}</td>
                  <td className="p-3">{getSubjectName(subjectMap.get(req.subjectId))}</td>
                  <td className="p-3">{getSubjectName(subjectMap.get(req.currentGuarantorId))}</td>
                  <td className="p-3">{getSubjectName(subjectMap.get(req.requestedGuarantorId))}</td>
                  <td className="p-3">{statusBadge(req.status)}</td>
                  <td className="p-3">
                    <span className="text-xs">
                      {req.status === "approved" ? "Dokončené" : req.status === "rejected" ? "Zamietnuté" : `${req.currentStep.step}/4 — ${req.currentStep.stepName}`}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDateTimeSlovak(req.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
