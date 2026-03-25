import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useAppUser } from "@/hooks/use-app-user";

interface PopupItem {
  type: string;
  label: string;
  detail?: string;
}

interface HomePopupData {
  urgent: PopupItem[];
  info: PopupItem[];
  good: PopupItem[];
  unreadNotifIds: number[];
  hasAnyData: boolean;
}

function Section({
  title,
  items,
  colorClass,
  borderClass,
  glowRgb,
}: {
  title: string;
  items: PopupItem[];
  colorClass: string;
  borderClass: string;
  glowRgb: string;
}) {
  return (
    <div
      className={`rounded-lg border ${borderClass} p-3`}
      style={{ boxShadow: `0 0 28px rgba(${glowRgb}, 0.25)` }}
    >
      <p className={`text-xs font-bold uppercase tracking-wider ${colorClass} mb-2`}>{title}</p>
      {items.length === 0 ? (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <span className="text-xs">Všetko v poriadku ✓</span>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <span className="text-sm text-foreground leading-snug">{item.label}</span>
              {item.detail && (
                <span className="text-xs text-muted-foreground leading-snug">{item.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RedListNotificationPopup() {
  const { data: appUser } = useAppUser();
  const [visible, setVisible] = useState(false);

  const sessionKey = appUser?.id ? `homePopup_shown_${appUser.id}` : null;

  const { data, isLoading } = useQuery<HomePopupData>({
    queryKey: ["/api/home-popup-data"],
    enabled: !!appUser?.id,
    refetchOnWindowFocus: false,
    staleTime: 1000 * 60 * 2,
  });

  useEffect(() => {
    if (!sessionKey) return;
    if (!data) return;
    if (!data.hasAnyData && data.unreadNotifIds.length === 0) return;
    const already = sessionStorage.getItem(sessionKey);
    if (!already) {
      setVisible(true);
    }
  }, [data, sessionKey]);

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/notifications/mark-all-read");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
  });

  function handleClose() {
    if (sessionKey) sessionStorage.setItem(sessionKey, "1");
    setVisible(false);
    markAllReadMutation.mutate();
  }

  if (!visible || !data || isLoading) return null;

  const { urgent, info, good } = data;
  const firstName = appUser?.firstName || appUser?.username || "";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md mx-4 rounded-xl border border-border bg-background/95 shadow-2xl overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Prehľad — dobrý deň{firstName ? `, ${firstName}` : ""}
          </h2>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-3" style={{ maxHeight: "calc(90vh - 116px)" }}>
          <Section
            title="Urgentné"
            items={urgent}
            colorClass="text-red-400"
            borderClass="border-red-700 bg-red-950/20"
            glowRgb="220, 38, 38"
          />
          <Section
            title="Informácie"
            items={info}
            colorClass="text-blue-400"
            borderClass="border-blue-700 bg-blue-950/20"
            glowRgb="37, 99, 235"
          />
          <Section
            title="Pozitívne a novinky"
            items={good}
            colorClass="text-green-400"
            borderClass="border-green-700 bg-green-950/20"
            glowRgb="22, 163, 74"
          />
        </div>

        <div className="px-5 py-3 border-t border-border">
          <Button
            className="w-full"
            variant="default"
            onClick={handleClose}
            disabled={markAllReadMutation.isPending}
            data-testid="btn-confirm-home-popup"
          >
            {markAllReadMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Zavrieť
          </Button>
        </div>
      </div>
    </div>
  );
}
