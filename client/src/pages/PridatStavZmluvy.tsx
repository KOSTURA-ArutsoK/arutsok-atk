import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { TripleRingStatus } from "@/components/TripleRingStatus";
import { KokpitDialog } from "@/components/KokpitDialog";
import { formatRemainingHHMM, isOverdue, isAdminAlert } from "@/lib/workingHours";
import type { KokpitItem, ContractStatus } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type KokpitItemExt = KokpitItem & { contractUid?: string | null; statusName?: string | null };

// ── Kokpit Button ──────────────────────────────────────────────────────────────

function KokpitCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isActive = hovered || pressed;

  return (
    <button
      type="button"
      data-testid="button-kokpit-card"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        outline: "none",
        userSelect: "none",
        transition: "transform 0.15s ease",
        transform: pressed ? "scale(0.96)" : hovered ? "scale(1.04)" : "scale(1)",
      }}
    >
      <svg width="180" height="180" viewBox="0 0 180 180" fill="none" style={{ overflow: "visible" }}>
        <defs>
          <filter id="kokpitGlow1" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="22" result="blur" />
          </filter>
          <filter id="kokpitGlow2" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="12" result="blur" />
          </filter>
          <radialGradient id="outerGrad" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#1e3a6e" />
            <stop offset="100%" stopColor="#0a1628" />
          </radialGradient>
          <radialGradient id="midGrad" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#162d58" />
            <stop offset="100%" stopColor="#070f1e" />
          </radialGradient>
          <radialGradient id="innerGrad" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#0e2244" />
            <stop offset="100%" stopColor="#040a14" />
          </radialGradient>
        </defs>

        {/* Glow: modrý v pokoji, zelený pri hoveri */}
        <circle
          cx="90" cy="90" r="95"
          fill={isActive ? "rgba(57,255,20,1.0)" : "rgba(56,189,248,1.0)"}
          filter="url(#kokpitGlow1)"
          style={{ transition: "fill 0.2s ease", opacity: isActive ? 1 : 0.85 }}
        />
        <circle
          cx="90" cy="90" r="85"
          fill={isActive ? "rgba(57,255,20,0.7)" : "rgba(56,189,248,0.7)"}
          filter="url(#kokpitGlow2)"
          style={{ transition: "fill 0.2s ease", opacity: isActive ? 1 : 0.75 }}
        />

        <circle cx="90" cy="90" r="82" fill="url(#outerGrad)"
          stroke={isActive ? "rgba(245,158,11,0.95)" : "rgba(245,158,11,0.65)"}
          strokeWidth="2.5" style={{ transition: "stroke 0.15s ease" }} />
        <circle cx="90" cy="90" r="82" fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="6" style={{ filter: "blur(3px)" }} />

        <circle cx="90" cy="90" r="60" fill="url(#midGrad)"
          stroke={isActive ? "rgba(245,158,11,0.90)" : "rgba(245,158,11,0.55)"}
          strokeWidth="2" style={{ transition: "stroke 0.15s ease" }} />
        <circle cx="90" cy="90" r="60" fill="none" stroke="rgba(0,0,0,0.50)" strokeWidth="5" style={{ filter: "blur(2.5px)" }} />

        <circle cx="90" cy="90" r="38" fill="url(#innerGrad)"
          stroke={isActive ? "rgba(245,158,11,0.90)" : "rgba(245,158,11,0.55)"}
          strokeWidth="2" style={{ transition: "stroke 0.15s ease" }} />
        <circle cx="90" cy="90" r="38" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="4" style={{ filter: "blur(2px)" }} />

        <text x="90" y="90" textAnchor="middle" dominantBaseline="middle"
          fontSize="10.5" fontWeight="800" fontFamily="sans-serif" letterSpacing="2.5" fill="#b8d0f0"
          style={{ filter: `drop-shadow(0 0 5px rgba(255,191,0,${isActive ? 0.95 : 0.55}))`, transition: "filter 0.15s ease" }}>
          KOKPIT
        </text>
      </svg>
    </button>
  );
}

// ── Mini Calendar Popover ─────────────────────────────────────────────────────

function MiniCalendar({ onSelectDate }: { onSelectDate: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: activeDays = [] } = useQuery<string[]>({
    queryKey: ["/api/kokpit/calendar", calMonth],
    queryFn: async () => {
      const res = await fetch(`/api/kokpit/calendar?month=${calMonth}`, { credentials: "include" });
      return res.json();
    },
    enabled: open,
  });

  const [year, month] = calMonth.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const offset = firstDay === 0 ? 6 : firstDay - 1;

  function prevMonth() {
    const d = new Date(year, month - 2, 1);
    setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  function nextMonth() {
    const d = new Date(year, month, 1);
    setCalMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthNames = ["Január","Február","Marec","Apríl","Máj","Jún","Júl","August","September","Október","November","December"];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="button-historia" className="gap-1.5">
          <Calendar size={14} />
          História
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-muted"><ChevronLeft size={14} /></button>
          <span className="text-xs font-semibold">{monthNames[month - 1]} {year}</span>
          <button onClick={nextMonth} className="p-1 rounded hover:bg-muted"><ChevronRight size={14} /></button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {["Po","Ut","St","Št","Pi","So","Ne"].map(d => (
            <div key={d} className="text-[10px] text-muted-foreground font-medium py-0.5">{d}</div>
          ))}
          {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const ymd = `${calMonth}-${String(day).padStart(2, "0")}`;
            const hasActivity = activeDays.includes(ymd);
            const isToday = ymd === new Date().toISOString().slice(0, 10);
            return (
              <button
                key={day}
                data-testid={`cal-day-${ymd}`}
                onClick={() => {
                  onSelectDate(ymd);
                  setOpen(false);
                }}
                className="relative text-xs rounded py-0.5 hover:bg-muted transition-colors"
                style={{ fontWeight: isToday ? 700 : undefined, color: isToday ? "var(--primary)" : undefined }}
              >
                {day}
                {hasActivity && (
                  <span style={{
                    position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)",
                    width: 4, height: 4, borderRadius: "50%", background: "#059669", display: "block",
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── New Item Form ─────────────────────────────────────────────────────────────

function NewItemForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");

  const mutation = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/kokpit/items", { title: title.trim(), source: source.trim() })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kokpit/items"] });
      toast({ title: "Položka pridaná" });
      setTitle("");
      setSource("");
      onCreated();
    },
  });

  return (
    <div className="flex gap-2 items-end">
      <div className="flex-1 space-y-1">
        <label className="text-xs text-muted-foreground">Názov položky</label>
        <Input
          data-testid="input-new-item-title"
          placeholder="Napr. Výpoveď od klienta Mrkvička"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
      </div>
      <div className="w-36 space-y-1">
        <label className="text-xs text-muted-foreground">Zdroj</label>
        <Input
          data-testid="input-new-item-source"
          placeholder="Napr. Allianz"
          value={source}
          onChange={e => setSource(e.target.value)}
        />
      </div>
      <Button
        data-testid="button-add-item"
        onClick={() => mutation.mutate()}
        disabled={!title.trim() || mutation.isPending}
        size="sm"
      >
        + Pridať
      </Button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PridatStavZmluvy() {
  const [kokpitOpen, setKokpitOpen] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [historyDate, setHistoryDate] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const { data: items = [], isLoading } = useQuery<KokpitItemExt[]>({
    queryKey: ["/api/kokpit/items", historyDate ? "history" : "today", historyDate],
    queryFn: async () => {
      const url = historyDate
        ? `/api/kokpit/items?mode=history&date=${historyDate}`
        : `/api/kokpit/items?mode=today`;
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const phase1Count = items.filter(i => i.phase === 1).length;
  const phase2Count = items.filter(i => i.phase === 2).length;
  const phase3Count = items.filter(i => i.phase === 3).length;

  function handleRowClick(item: KokpitItemExt) {
    setSelectedItemId(item.id);
    setKokpitOpen(true);
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Spracovanie stavov</h1>
        <p className="text-sm text-muted-foreground">
          Centrálne miesto pre správu stavov zmlúv — všetko, čo príde ku akejkoľvek zmluve, sa tu bude dopĺňať a spracovávať.
        </p>
      </div>

      {/* Top row: KOKPIT button + Phase summary + History button */}
      <div className="flex items-start gap-8">
        {/* KOKPIT button + phase summary */}
        <div className="flex flex-col items-center gap-3">
          <KokpitCard onClick={() => { setSelectedItemId(null); setKokpitOpen(true); }} />

          {/* Phase summary */}
          <div className="space-y-1.5 w-full">
            {[
              { phase: 1 as const, count: phase1Count, label: "Príchod" },
              { phase: 2 as const, count: phase2Count, label: "Rozdelenie" },
              { phase: 3 as const, count: phase3Count, label: "Vybavené dnes" },
            ].map(row => (
              <div key={row.phase} className="flex items-center gap-2">
                <TripleRingStatus phase={row.phase} size={18} />
                <span className="text-sm font-semibold w-5 text-right">{row.count}</span>
                <span className="text-sm text-muted-foreground">{row.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: History button + new item form */}
        <div className="flex-1 pt-4 space-y-3">
          <div className="flex items-center gap-3">
            <MiniCalendar onSelectDate={date => setHistoryDate(date)} />
            {historyDate && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  História: <strong>{historyDate.split("-").reverse().join(".")}</strong>
                </span>
                <button
                  onClick={() => setHistoryDate(null)}
                  className="text-muted-foreground hover:text-foreground"
                  data-testid="button-back-today"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          {!historyDate && <NewItemForm onCreated={() => {}} />}
        </div>
      </div>

      {/* Live table */}
      <div>
        {historyDate && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            História: {historyDate.split("-").reverse().join(".")}
          </p>
        )}
        {!historyDate && (
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Dnešné aktivity + prenesené nevyriešené
          </p>
        )}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 font-semibold w-8"></th>
              <th className="text-left py-2 px-2 font-semibold">Názov</th>
              <th className="text-left py-2 px-2 font-semibold">Zdroj</th>
              <th className="text-left py-2 px-2 font-semibold">Zmluva</th>
              <th className="text-left py-2 px-2 font-semibold">⏱ SLA</th>
              <th className="text-left py-2 px-2 font-semibold">Aging</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="py-4 text-center text-muted-foreground text-sm">Načítavam...</td></tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr><td colSpan={6} className="py-4 text-center text-muted-foreground text-sm">Žiadne položky.</td></tr>
            )}
            {items.map(item => {
              const created = new Date(item.createdAt!);
              const overdue = !item.resolvedAt && isOverdue(created);
              const pulse = !item.resolvedAt && isAdminAlert(created);
              const carryOver = item.dayCreated < today && !item.resolvedAt;
              return (
                <tr
                  key={item.id}
                  data-testid={`row-item-${item.id}`}
                  className="border-b border-border/50 hover:bg-muted/40 transition-colors cursor-pointer"
                  style={{ background: overdue ? "rgba(234,88,12,0.05)" : carryOver ? "rgba(245,158,11,0.05)" : undefined }}
                  onClick={() => handleRowClick(item)}
                >
                  <td className="py-2 px-2">
                    <TripleRingStatus phase={item.phase as 1 | 2 | 3} size={18} pulsing={pulse} />
                  </td>
                  <td className="py-2 px-2 font-medium">{item.title}</td>
                  <td className="py-2 px-2 text-muted-foreground">{item.source || "—"}</td>
                  <td className="py-2 px-2 text-muted-foreground font-mono text-xs">{item.contractUid || "—"}</td>
                  <td className="py-2 px-2">
                    {item.resolvedAt ? (
                      <span className="text-xs text-green-600 font-semibold">Vybavené</span>
                    ) : (
                      <span className="text-xs font-bold" style={{ color: overdue ? "#dc2626" : "#f59e0b" }}>
                        {formatRemainingHHMM(created)}
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    {(() => {
                      const diff = Math.floor((new Date(today).getTime() - new Date(item.dayCreated).getTime()) / 86400000);
                      if (diff <= 0) return <span className="text-xs text-muted-foreground">dnes</span>;
                      return (
                        <span className="text-xs font-bold" style={{ color: diff >= 3 ? "#ea580c" : "#f59e0b" }}>
                          +{diff}d
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <KokpitDialog
        open={kokpitOpen}
        onOpenChange={setKokpitOpen}
        initialItemId={selectedItemId}
      />
    </div>
  );
}
