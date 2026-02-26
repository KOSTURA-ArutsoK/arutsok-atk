import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { formatUid } from "@/lib/utils";

interface RedListNotification {
  id: number;
  notificationType: string;
  title: string;
  message: string;
  readAt: string | null;
}

export function RedListNotificationPopup() {
  const [currentNotif, setCurrentNotif] = useState<RedListNotification | null>(null);

  const { data: notifications } = useQuery<RedListNotification[]>({
    queryKey: ["/api/notifications/my"],
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!notifications) return;
    const unread = notifications.find(
      (n: any) => n.notificationType === "red_list_confirmed" && !n.readAt
    );
    if (unread && (!currentNotif || currentNotif.id !== unread.id)) {
      setCurrentNotif(unread);
    }
  }, [notifications]);

  const markReadMutation = useMutation({
    mutationFn: async (notifId: number) => {
      return apiRequest("POST", `/api/notifications/${notifId}/read`);
    },
    onSuccess: () => {
      setCurrentNotif(null);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  if (!currentNotif) return null;

  let parsed: any = {};
  try {
    parsed = JSON.parse(currentNotif.message);
  } catch {}

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-400">
            <AlertTriangle className="w-5 h-5" />
            Subjekt na červenom zozname
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded border border-orange-800 bg-orange-950/50 p-4 space-y-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">ID kód:</span>
                <span className="font-mono text-sm text-orange-300 font-semibold">{parsed.subjectUid || ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Subjekt:</span>
                <span className="text-sm font-semibold text-orange-300">{parsed.subjectName || ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Dátum a čas presunu:</span>
                <span className="text-sm">{parsed.confirmedAt || ""}</span>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Dôvod:</span>
                <p className="text-sm mt-1 text-orange-200">{parsed.reason || ""}</p>
              </div>
            </div>
          </div>
          <Button
            className="w-full bg-orange-700 hover:bg-orange-600"
            onClick={() => markReadMutation.mutate(currentNotif.id)}
            disabled={markReadMutation.isPending}
            data-testid={`btn-ack-redlist-notif-${currentNotif.id}`}
          >
            {markReadMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Rozumiem
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
