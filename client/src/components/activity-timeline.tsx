import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { formatDateTimeSlovak } from "@/lib/utils";
import {
  Clock, UserPlus, Eye, Edit3, MessageSquare, Reply, Send, CheckCheck, BookOpen,
  Monitor, Smartphone, Tablet, ArrowRight, Loader2
} from "lucide-react";
import type { ActivityEvent } from "@shared/schema";

const EVENT_TYPE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  registration: { label: "Registrácia", icon: UserPlus, color: "text-green-500" },
  card_open: { label: "Otvorenie karty", icon: Eye, color: "text-blue-500" },
  field_change: { label: "Zmena údajov", icon: Edit3, color: "text-amber-500" },
  communication: { label: "Komunikácia", icon: MessageSquare, color: "text-purple-500" },
  client_response: { label: "Odpoveď klienta", icon: Reply, color: "text-cyan-500" },
  status_change: { label: "Zmena statusu", icon: ArrowRight, color: "text-orange-500" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; variant: "outline" | "secondary" | "default" }> = {
  odoslane: { label: "Odoslané", icon: Send, variant: "outline" },
  dorucene: { label: "Doručené", icon: CheckCheck, variant: "secondary" },
  precitane: { label: "Prečítané", icon: BookOpen, variant: "default" },
};


function DeviceIcon({ type }: { type: string | null }) {
  if (type === 'mobile') return <Smartphone className="w-3 h-3" />;
  if (type === 'tablet') return <Tablet className="w-3 h-3" />;
  return <Monitor className="w-3 h-3" />;
}

interface ActivityTimelineProps {
  subjectId?: number;
  contractId?: number;
  compact?: boolean;
}

export function ActivityTimeline({ subjectId, contractId, compact = false }: ActivityTimelineProps) {
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");

  const params = new URLSearchParams();
  if (subjectId) params.set("subjectId", String(subjectId));
  if (contractId) params.set("contractId", String(contractId));
  params.set("limit", "100");

  const { data, isLoading } = useQuery<{ events: ActivityEvent[]; total: number }>({
    queryKey: ["/api/activity-events", subjectId, contractId],
    queryFn: async () => {
      const res = await fetch(`/api/activity-events?${params.toString()}`, { credentials: "include" });
      if (!res.ok) {
        if (res.status === 403) return { events: [], total: 0 };
        throw new Error("Failed");
      }
      return res.json();
    },
  });

  const createEvent = useMutation({
    mutationFn: async (eventData: any) => {
      const res = await apiRequest("POST", "/api/activity-events", eventData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-events"] });
      setNewMessage("");
      toast({ title: "Správa odoslaná" });
    },
  });

  const statusChange = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; messageStatus?: string; responseText?: string }) => {
      const res = await apiRequest("POST", `/api/activity-events/${id}/status-change`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/activity-events"] });
      setReplyingTo(null);
      setReplyText("");
    },
  });

  const events = data?.events || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="activity-timeline">
      {contractId && (
        <div className="flex gap-2" data-testid="timeline-new-message">
          <Textarea
            placeholder="Napísať správu ku zmluve..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="min-h-[60px] text-sm"
            data-testid="input-timeline-message"
          />
          <Button
            size="sm"
            disabled={!newMessage.trim() || createEvent.isPending}
            onClick={() => {
              createEvent.mutate({
                subjectId,
                contractId,
                eventType: "communication",
                messageText: newMessage.trim(),
                messageStatus: "odoslane",
              });
            }}
            data-testid="button-send-message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      )}

      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8" data-testid="text-no-activity">
          Žiadne záznamy aktivity
        </p>
      ) : (
        <div className="relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

          {events.map((event) => {
            const config = EVENT_TYPE_CONFIG[event.eventType] || EVENT_TYPE_CONFIG.card_open;
            const IconComponent = config.icon;
            const statusConfig = event.messageStatus ? STATUS_CONFIG[event.messageStatus] : null;

            return (
              <div key={event.id} className="relative pl-10 pb-4" data-testid={`activity-event-${event.id}`}>
                <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-background ${config.color} bg-current`}
                  style={{ top: '6px' }}
                />

                <div className="rounded-md border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <IconComponent className={`w-4 h-4 ${config.color}`} />
                    <Badge variant="outline" className="text-[10px]" data-testid={`badge-event-type-${event.id}`}>
                      {config.label}
                    </Badge>
                    {statusConfig && (
                      <Badge variant={statusConfig.variant} className="text-[10px]" data-testid={`badge-msg-status-${event.id}`}>
                        {statusConfig.label}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDateTimeSlovak(event.createdAt)}
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>{event.username || "-"}</span>
                    {event.ipAddress && (
                      <span className="font-mono text-[10px]">{event.ipAddress}</span>
                    )}
                    {event.deviceType && (
                      <span className="flex items-center gap-0.5">
                        <DeviceIcon type={event.deviceType} />
                        <span className="text-[10px]">{event.deviceType}</span>
                      </span>
                    )}
                  </div>

                  {event.eventType === "field_change" && event.fieldName && (
                    <div className="text-sm space-y-1" data-testid={`field-change-${event.id}`}>
                      <span className="text-xs font-medium text-muted-foreground">{event.fieldName}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-mono line-through">
                          {event.oldValue || "(prázdne)"}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                        <span className="bg-green-500/10 text-green-600 dark:text-green-400 px-1.5 py-0.5 rounded font-mono">
                          {event.newValue || "(prázdne)"}
                        </span>
                      </div>
                    </div>
                  )}

                  {event.messageText && (
                    <p className="text-sm" data-testid={`msg-text-${event.id}`}>{event.messageText}</p>
                  )}

                  {event.responseText && (
                    <div className="border-l-2 border-cyan-500 pl-3 mt-2" data-testid={`response-${event.id}`}>
                      <div className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400 mb-1">
                        <Reply className="w-3 h-3" />
                        Odpoveď klienta
                      </div>
                      <p className="text-sm">{event.responseText}</p>
                    </div>
                  )}

                  {event.eventType === "communication" && !event.responseText && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {event.messageStatus === "odoslane" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px]"
                          onClick={() => statusChange.mutate({ id: event.id, messageStatus: "dorucene" })}
                          data-testid={`button-mark-delivered-${event.id}`}
                        >
                          <CheckCheck className="w-3 h-3 mr-1" /> Doručené
                        </Button>
                      )}
                      {(event.messageStatus === "odoslane" || event.messageStatus === "dorucene") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px]"
                          onClick={() => statusChange.mutate({ id: event.id, messageStatus: "precitane" })}
                          data-testid={`button-mark-read-${event.id}`}
                        >
                          <BookOpen className="w-3 h-3 mr-1" /> Prečítané
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => setReplyingTo(replyingTo === event.id ? null : event.id)}
                        data-testid={`button-reply-${event.id}`}
                      >
                        <Reply className="w-3 h-3 mr-1" /> Odpoveď
                      </Button>
                    </div>
                  )}

                  {replyingTo === event.id && (
                    <div className="flex gap-2 mt-2" data-testid={`reply-form-${event.id}`}>
                      <Textarea
                        placeholder="Odpoveď klienta..."
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="min-h-[50px] text-sm"
                        data-testid={`input-reply-${event.id}`}
                      />
                      <Button
                        size="sm"
                        disabled={!replyText.trim() || statusChange.isPending}
                        onClick={() => {
                          statusChange.mutate({ id: event.id, responseText: replyText.trim() });
                          if (subjectId && contractId) {
                            createEvent.mutate({
                              subjectId,
                              contractId,
                              eventType: "client_response",
                              messageText: replyText.trim(),
                            });
                          }
                        }}
                        data-testid={`button-submit-reply-${event.id}`}
                      >
                        <Send className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
