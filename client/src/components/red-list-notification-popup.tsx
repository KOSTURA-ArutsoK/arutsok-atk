import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, CheckCircle2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  news: PopupItem[];
  unreadNotifIds: number[];
  hasAnyData: boolean;
}

function SideGlow({ rect, rgb }: { rect: DOMRect; rgb: string }) {
  return createPortal(
    <>
      <div
        style={{
          position: "fixed",
          top: rect.top,
          left: 0,
          width: rect.left,
          height: rect.height,
          background: `radial-gradient(ellipse at right, rgba(${rgb}, 0.55) 0%, transparent 75%)`,
          pointerEvents: "none",
          zIndex: 201,
          transition: "opacity 0.25s ease",
        }}
      />
      <div
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.right,
          right: 0,
          height: rect.height,
          background: `radial-gradient(ellipse at left, rgba(${rgb}, 0.55) 0%, transparent 75%)`,
          pointerEvents: "none",
          zIndex: 201,
          transition: "opacity 0.25s ease",
        }}
      />
    </>,
    document.body
  );
}

function Section({
  title,
  items,
  colorClass,
  rgb,
}: {
  title: string;
  items: PopupItem[];
  colorClass: string;
  rgb: string;
}) {
  const [hovered, setHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseEnter() {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setHovered(true);
  }
  function handleMouseLeave() {
    setHovered(false);
  }

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          background: hovered ? `rgba(${rgb}, 0.10)` : "transparent",
          transition: "background 0.2s ease",
        }}
        className="px-4 py-3"
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
      {hovered && rect && <SideGlow rect={rect} rgb={rgb} />}
    </>
  );
}

function CloseSection({ onClose, isPending }: { onClose: () => void; isPending: boolean }) {
  const rgb = "22, 163, 74";
  const [hovered, setHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseEnter() {
    if (ref.current) setRect(ref.current.getBoundingClientRect());
    setHovered(true);
  }

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
        onClick={!isPending ? onClose : undefined}
        data-testid="btn-confirm-home-popup"
        style={{
          background: hovered ? `rgba(${rgb}, 0.14)` : "transparent",
          borderTop: `1px solid rgba(${rgb}, 0.30)`,
          cursor: isPending ? "default" : "pointer",
          transition: "background 0.2s ease",
        }}
        className="px-4 py-3 flex items-center justify-center gap-2"
      >
        {isPending
          ? <Loader2 className="w-4 h-4 animate-spin text-green-400" />
          : null}
        <span className="text-sm font-semibold text-green-400 uppercase tracking-wider">Zavrieť</span>
      </div>
      {hovered && rect && <SideGlow rect={rect} rgb={rgb} />}
    </>
  );
}

export function RedListNotificationPopup() {
  const { data: appUser } = useAppUser();
  const [visible, setVisible] = useState(false);

  const sessionKey = appUser?.id ? `homePopup_v2_${appUser.id}` : null;

  const { data, isLoading } = useQuery<HomePopupData>({
    queryKey: ["/api/home-popup-data"],
    enabled: !!appUser?.id,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!sessionKey) return;
    if (!data) return;
    if (!data.hasAnyData && data.unreadNotifIds.length === 0) return;
    const loginStamp = (appUser as any)?.lastLoginAt ?? "unknown";
    const stored = sessionStorage.getItem(sessionKey);
    if (stored !== loginStamp) {
      setVisible(true);
    }
  }, [data, sessionKey, appUser]);

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
    if (sessionKey) {
      const loginStamp = (appUser as any)?.lastLoginAt ?? "unknown";
      sessionStorage.setItem(sessionKey, loginStamp);
    }
    setVisible(false);
    markAllReadMutation.mutate();
  }

  if (!visible || !data || isLoading) return null;

  const { urgent, info, good, news = [] } = data;
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

        <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 116px)" }}>
          <Section title="Urgentné"   items={urgent} colorClass="text-red-400"   rgb="220, 38, 38" />
          <Section title="Informácie" items={info}   colorClass="text-blue-400"  rgb="37, 99, 235" />
          <Section title="Novinky"    items={news}   colorClass="text-amber-400" rgb="217, 119, 6" />
          <Section title="Pozitívne"  items={good}   colorClass="text-green-400" rgb="22, 163, 74" />
        </div>

        <CloseSection onClose={handleClose} isPending={markAllReadMutation.isPending} />
      </div>
    </div>
  );
}
