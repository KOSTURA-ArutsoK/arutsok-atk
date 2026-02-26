import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Ban, Loader2, ShieldAlert } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect, useCallback, useRef } from "react";

interface BlackListNotification {
  id: number;
  notificationType: string;
  title: string;
  message: string;
  readAt: string | null;
}

const STORAGE_PREFIX = "blacklist_notif_views_";
const MIN_VIEWS = 3;

function getViewCount(notifId: number): number {
  try {
    return parseInt(localStorage.getItem(`${STORAGE_PREFIX}${notifId}`) || "0", 10);
  } catch { return 0; }
}

function incrementViewCount(notifId: number): number {
  const next = getViewCount(notifId) + 1;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${notifId}`, String(next));
  } catch {}
  return next;
}

function clearViewCount(notifId: number) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${notifId}`);
  } catch {}
}

export function BlackListNotificationPopup() {
  const [currentNotif, setCurrentNotif] = useState<BlackListNotification | null>(null);
  const [viewCount, setViewCount] = useState(0);
  const dismissedThisSession = useRef<Set<number>>(new Set());

  const { data: notifications } = useQuery<BlackListNotification[]>({
    queryKey: ["/api/notifications/my"],
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!notifications || currentNotif) return;
    const unread = notifications.find(
      (n: any) => n.notificationType === "black_list_confirmed" && !n.readAt && !dismissedThisSession.current.has(n.id)
    );
    if (unread) {
      const count = incrementViewCount(unread.id);
      setViewCount(count);
      setCurrentNotif(unread);
    }
  }, [notifications, currentNotif]);

  const markReadMutation = useMutation({
    mutationFn: async (notifId: number) => {
      return apiRequest("POST", `/api/notifications/${notifId}/read`);
    },
    onSuccess: () => {
      if (currentNotif) clearViewCount(currentNotif.id);
      setCurrentNotif(null);
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  const handleAcknowledge = useCallback(() => {
    if (!currentNotif) return;
    if (viewCount >= MIN_VIEWS) {
      markReadMutation.mutate(currentNotif.id);
    } else {
      dismissedThisSession.current.add(currentNotif.id);
      setCurrentNotif(null);
    }
  }, [currentNotif, viewCount]);

  if (!currentNotif) return null;

  let parsed: any = {};
  try {
    parsed = JSON.parse(currentNotif.message);
  } catch {}

  const remaining = Math.max(0, MIN_VIEWS - viewCount);
  const canFinalAck = viewCount >= MIN_VIEWS;

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-lg border-2 border-red-600 bg-gradient-to-b from-red-950 to-background"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-red-400 text-xl">
            <div className="p-2 rounded-full bg-red-900/80">
              <Ban className="w-7 h-7" />
            </div>
            <div>
              <div className="text-lg font-black tracking-wider" data-testid="text-blacklist-title">ČIERNY ZOZNAM</div>
              <div className="text-xs font-normal text-red-300/80 mt-0.5">Doživotné ukončenie spolupráce</div>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="rounded border-2 border-red-700 bg-red-950/60 p-5 space-y-3">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-300/70 w-28 shrink-0">ID kód:</span>
                <span className="font-mono text-sm text-red-200 font-semibold" data-testid="text-blacklist-uid">{parsed.subjectUid || ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-300/70 w-28 shrink-0">Subjekt:</span>
                <span className="text-base font-bold text-red-200" data-testid="text-blacklist-name">{parsed.subjectName || ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-300/70 w-28 shrink-0">Dátum a čas:</span>
                <span className="text-sm text-red-200">{parsed.confirmedAt || ""}</span>
              </div>
              {parsed.addedBy && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-300/70 w-28 shrink-0">Zaradil:</span>
                  <span className="text-sm text-red-200">{parsed.addedBy}</span>
                </div>
              )}
              <div>
                <span className="text-xs text-red-300/70">Dôvod:</span>
                <p className="text-sm mt-1 text-red-100 font-medium">{parsed.reason || ""}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded bg-red-900/40 border border-red-800">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm text-red-200 font-semibold">
              Spoločnosť s daným subjektom už neuzavrie žiadnu zmluvu.
            </p>
          </div>

          <Button
            variant="destructive"
            className="w-full font-bold text-base py-5"
            onClick={handleAcknowledge}
            disabled={markReadMutation.isPending}
            data-testid={`btn-ack-blacklist-notif-${currentNotif.id}`}
          >
            {markReadMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            {canFinalAck ? "Rozumiem" : `Rozumiem (zostáva ${remaining}×)`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
