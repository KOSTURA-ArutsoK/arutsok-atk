import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Loader2, Send, Bell, Clock, CheckCircle, AlertTriangle, XCircle, RefreshCw, History, Users, Zap } from "lucide-react";
import { formatDateSlovak } from "@/lib/utils";

export default function BulkActions() {
  const { toast } = useToast();
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifType, setNotifType] = useState("info");
  const [notifPriority, setNotifPriority] = useState("normal");
  const [recipientMode, setRecipientMode] = useState("all");
  const [recipientIds, setRecipientIds] = useState("");
  const [pollingBatchId, setPollingBatchId] = useState<string | null>(null);

  const { data: batchJobs, isLoading: loadingJobs } = useQuery<any[]>({
    queryKey: ["/api/batch-jobs"],
  });

  const { data: maturityEvents } = useQuery<any[]>({
    queryKey: ["/api/maturity-events"],
  });

  const { data: pollingJob } = useQuery<any>({
    queryKey: ["/api/batch-jobs", pollingBatchId],
    queryFn: () => fetch(`/api/batch-jobs/${pollingBatchId}`, { credentials: "include" }).then(r => r.json()),
    enabled: !!pollingBatchId,
    refetchInterval: pollingBatchId ? 2000 : false,
  });

  const { data: subjectCount } = useQuery<{ count: number }>({
    queryKey: ["/api/subjects/count"],
    queryFn: () => fetch("/api/subjects/count", { credentials: "include" }).then(r => r.json()),
  });

  const sendBulkNotification = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/batch-notifications", data);
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "Hromadná notifikácia odoslaná", description: `Batch ${result.batchId}: ${result.totalItems} príjemcov` });
      setPollingBatchId(result.batchId);
      setShowSendDialog(false);
      setNotifTitle("");
      setNotifMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/batch-jobs"] });
    },
    onError: (err: any) => {
      toast({ title: "Chyba", description: err.message, variant: "destructive" });
    },
  });

  function handleSend() {
    if (!notifTitle || !notifMessage) {
      toast({ title: "Chyba", description: "Vyplňte názov a text notifikácie", variant: "destructive" });
      return;
    }

    const payload: any = {
      notificationType: notifType,
      title: notifTitle,
      message: notifMessage,
      priority: notifPriority,
    };

    if (recipientMode === "all") {
      payload.sendToAll = true;
    } else {
      payload.recipientSubjectIds = recipientIds.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      if (!payload.recipientSubjectIds.length) {
        toast({ title: "Chyba", description: "Žiadni príjemcovia", variant: "destructive" });
        return;
      }
    }

    sendBulkNotification.mutate(payload);
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-400",
      processing: "bg-blue-500/20 text-blue-400",
      completed: "bg-green-500/20 text-green-400",
      completed_with_errors: "bg-orange-500/20 text-orange-400",
      failed: "bg-red-500/20 text-red-400",
    };
    const icons: Record<string, any> = {
      pending: Clock, processing: Loader2, completed: CheckCircle,
      completed_with_errors: AlertTriangle, failed: XCircle,
    };
    const Icon = icons[status] || Clock;
    return (
      <Badge className={`${colors[status] || "bg-gray-500/20 text-gray-400"} border-0 gap-1`}>
        <Icon className={`w-3 h-3 ${status === "processing" ? "animate-spin" : ""}`} />
        {status === "pending" ? "Čaká" : status === "processing" ? "Spracováva sa" : status === "completed" ? "Dokončené" : status === "completed_with_errors" ? "S chybami" : "Zlyhanie"}
      </Badge>
    );
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-amber-400" />
          <h1 className="text-lg font-bold">Hromadné akcie</h1>
        </div>
        <Button size="sm" onClick={() => setShowSendDialog(true)} data-testid="btn-bulk-notify">
          <Send className="w-4 h-4 mr-1" /> Hromadná notifikácia
        </Button>
      </div>

      {pollingBatchId && pollingJob && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Loader2 className={`w-4 h-4 ${pollingJob.status === "processing" ? "animate-spin text-blue-400" : "text-green-400"}`} />
                <span className="text-sm font-medium">Batch: {pollingBatchId}</span>
              </div>
              {statusBadge(pollingJob.status)}
            </div>
            <Progress value={pollingJob.progress || 0} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{pollingJob.processedItems || 0} / {pollingJob.totalItems || 0} spracovaných</span>
              {pollingJob.failedItems > 0 && <span className="text-red-400">{pollingJob.failedItems} zlyhaní</span>}
              <span>{pollingJob.progress || 0}%</span>
            </div>
            {pollingJob.status !== "processing" && (
              <Button size="sm" variant="ghost" className="mt-2 text-xs" onClick={() => setPollingBatchId(null)} data-testid="btn-dismiss-progress">
                Zavrieť
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">História hromadných úloh</h2>
            <Button size="sm" variant="ghost" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/batch-jobs"] })} data-testid="btn-refresh-jobs">
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>

          {loadingJobs ? (
            <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Batch ID</TableHead>
                    <TableHead className="text-xs">Typ</TableHead>
                    <TableHead className="text-xs">Stav</TableHead>
                    <TableHead className="text-xs">Priebeh</TableHead>
                    <TableHead className="text-xs">Spracované</TableHead>
                    <TableHead className="text-xs">Zlyhania</TableHead>
                    <TableHead className="text-xs">Vytvorené</TableHead>
                    <TableHead className="text-xs">Autor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(batchJobs || []).map((job: any) => (
                    <TableRow key={job.id}>
                      <TableCell className="text-xs font-mono">{job.batchId}</TableCell>
                      <TableCell className="text-xs">{job.jobType === "bulk_notification" ? "Notifikácie" : job.jobType}</TableCell>
                      <TableCell>{statusBadge(job.status)}</TableCell>
                      <TableCell>
                        <div className="w-20"><Progress value={job.progress || 0} className="h-1.5" /></div>
                      </TableCell>
                      <TableCell className="text-xs">{job.processedItems}/{job.totalItems}</TableCell>
                      <TableCell className="text-xs text-red-400">{job.failedItems || 0}</TableCell>
                      <TableCell className="text-xs">{job.createdAt ? formatDateSlovak(job.createdAt) : "-"}</TableCell>
                      <TableCell className="text-xs">{job.createdByName || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {(!batchJobs || batchJobs.length === 0) && (
                    <TableRow><TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-4">Žiadne hromadné úlohy</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold">Automatické prechody dospelosti (18+)</h2>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Subjekt</TableHead>
                  <TableHead className="text-xs">Stav</TableHead>
                  <TableHead className="text-xs">Akcie</TableHead>
                  <TableHead className="text-xs">Notifikácie</TableHead>
                  <TableHead className="text-xs">Bloky</TableHead>
                  <TableHead className="text-xs">Dátum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(maturityEvents || []).map((ev: any) => (
                  <TableRow key={ev.id}>
                    <TableCell className="text-xs">
                      <span className="font-medium">{ev.subjectName || `#${ev.subjectId}`}</span>
                      {ev.subjectUid && <span className="ml-1 text-muted-foreground">{ev.subjectUid}</span>}
                    </TableCell>
                    <TableCell>{statusBadge(ev.status)}</TableCell>
                    <TableCell className="text-xs">{Array.isArray(ev.actionsPerformed) ? ev.actionsPerformed.length : 0}</TableCell>
                    <TableCell className="text-xs">{Array.isArray(ev.notificationsSent) ? ev.notificationsSent.length : 0}</TableCell>
                    <TableCell className="text-xs">{Array.isArray(ev.privacyBlocksCreated) ? ev.privacyBlocksCreated.length : 0}</TableCell>
                    <TableCell className="text-xs">{ev.completedAt ? formatDateSlovak(ev.completedAt) : ev.createdAt ? formatDateSlovak(ev.createdAt) : "-"}</TableCell>
                  </TableRow>
                ))}
                {(!maturityEvents || maturityEvents.length === 0) && (
                  <TableRow><TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-4">Žiadne automatické prechody</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bell className="w-4 h-4" /> Hromadná notifikácia</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Príjemcovia</Label>
              <Select value={recipientMode} onValueChange={setRecipientMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Všetci subjekty ({subjectCount?.count || 0})</SelectItem>
                  <SelectItem value="custom">Vlastný výber (ID)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {recipientMode === "custom" && (
              <div>
                <Label className="text-xs">ID subjektov (oddelené čiarkou)</Label>
                <Input value={recipientIds} onChange={e => setRecipientIds(e.target.value)} placeholder="1, 2, 3, 4" data-testid="input-recipient-ids" />
              </div>
            )}
            <div>
              <Label className="text-xs">Typ notifikácie</Label>
              <Select value={notifType} onValueChange={setNotifType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Informácia</SelectItem>
                  <SelectItem value="warning">Upozornenie</SelectItem>
                  <SelectItem value="urgent">Urgentné</SelectItem>
                  <SelectItem value="system">Systémové</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Priorita</Label>
              <Select value={notifPriority} onValueChange={setNotifPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Nízka</SelectItem>
                  <SelectItem value="normal">Normálna</SelectItem>
                  <SelectItem value="high">Vysoká</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Názov</Label>
              <Input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} placeholder="Názov notifikácie" data-testid="input-notif-title" />
            </div>
            <div>
              <Label className="text-xs">Správa</Label>
              <Textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)} placeholder="Text notifikácie..." rows={3} data-testid="input-notif-message" />
            </div>
            <Button className="w-full" onClick={handleSend} disabled={sendBulkNotification.isPending} data-testid="btn-send-bulk">
              {sendBulkNotification.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Odoslať ({recipientMode === "all" ? subjectCount?.count || 0 : recipientIds.split(",").filter(s => s.trim()).length} príjemcov)
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}