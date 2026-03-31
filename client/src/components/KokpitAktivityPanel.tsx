import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TripleRingStatus } from "@/components/TripleRingStatus";
import { KokpitDialog } from "@/components/KokpitDialog";
import { formatRemainingHHMM, isOverdue, isAdminAlert } from "@/lib/workingHours";
import { getSlovakNameDay } from "@/lib/slovakNameDays";
import {
  ChevronLeft, ChevronRight, X, FileText, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import type { KokpitItem } from "@shared/schema";
import type { ScanFile } from "@/pages/PridatStavZmluvy";

type KokpitItemExt = KokpitItem & { contractUid?: string | null; statusName?: string | null };

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// ── InlineCalendar ────────────────────────────────────────────────────────────

const MONTH_NAMES_SK = ["Január","Február","Marec","Apríl","Máj","Jún","Júl","August","September","Október","November","December"];
const DAY_NAMES_SK = ["Po","Ut","St","Št","Pi","So","Ne"];

interface InlineCalendarProps {
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

function InlineCalendar({ selectedDate, onSelectDate }: InlineCalendarProps) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [calMonth, setCalMonth] = useState(() => todayStr.slice(0, 7));

  const { data: activeDays = [] } = useQuery<string[]>({
    queryKey: ["/api/kokpit/calendar", calMonth],
    queryFn: async () => {
      const res = await fetch(`/api/kokpit/calendar?month=${calMonth}`, { credentials: "include" });
      return res.json();
    },
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

  return (
    <div className="select-none">
      <div className="flex items-center justify-between mb-1.5">
        <button onClick={prevMonth} className="p-0.5 rounded hover:bg-muted text-muted-foreground" data-testid="cal-prev-panel">
          <ChevronLeft size={13} />
        </button>
        <span className="text-[11px] font-semibold text-foreground">{MONTH_NAMES_SK[month - 1]} {year}</span>
        <button onClick={nextMonth} className="p-0.5 rounded hover:bg-muted text-muted-foreground" data-testid="cal-next-panel">
          <ChevronRight size={13} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0 text-center">
        {DAY_NAMES_SK.map(d => (
          <div key={d} className="text-[9px] text-muted-foreground font-medium py-0.5">{d}</div>
        ))}
        {Array.from({ length: offset }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const ymd = `${calMonth}-${String(day).padStart(2, "0")}`;
          const hasActivity = activeDays.includes(ymd);
          const isToday = ymd === todayStr;
          const isSelected = ymd === selectedDate;
          return (
            <button
              key={day}
              data-testid={`cal-day-panel-${ymd}`}
              onClick={() => {
                if (isToday) {
                  onSelectDate(null);
                } else {
                  onSelectDate(isSelected ? null : ymd);
                }
              }}
              className="relative text-[11px] rounded py-0.5 hover:bg-muted/60 transition-colors"
              style={{
                fontWeight: isToday ? 800 : isSelected ? 700 : undefined,
                color: isSelected ? "#fff" : isToday ? "var(--primary)" : undefined,
                background: isSelected ? "#1e40af" : undefined,
                borderRadius: 3,
              }}
            >
              {day}
              {hasActivity && !isSelected && (
                <span style={{
                  position: "absolute", bottom: 1, left: "50%", transform: "translateX(-50%)",
                  width: 3, height: 3, borderRadius: "50%", background: "#059669", display: "block",
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── KokpitAktivityPanel ───────────────────────────────────────────────────────

interface KokpitAktivityPanelProps {
  scanFiles: ScanFile[];
  onRemoveScanFile: (id: string, reason?: string) => void;
  onAddFiles: (files: File[]) => void;
}

export function KokpitAktivityPanel({ scanFiles, onRemoveScanFile, onAddFiles }: KokpitAktivityPanelProps) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [viewDate, setViewDate] = useState(todayStr);
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [kokpitOpen, setKokpitOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery<KokpitItemExt[]>({
    queryKey: ["/api/kokpit/items", viewMode, viewDate],
    queryFn: async () => {
      let url: string;
      if (viewMode === 'week') {
        url = `/api/kokpit/items?mode=week&date=${viewDate}`;
      } else if (viewMode === 'month') {
        url = `/api/kokpit/items?mode=month&month=${viewDate.slice(0, 7)}`;
      } else if (viewDate !== todayStr) {
        url = `/api/kokpit/items?mode=history&date=${viewDate}`;
      } else {
        url = `/api/kokpit/items?mode=today`;
      }
      const res = await fetch(url, { credentials: "include" });
      return res.json();
    },
  });

  const phase1Count = items.filter(i => i.phase === 1).length;
  const phase2Count = items.filter(i => i.phase === 2).length;
  const phase3Count = items.filter(i => i.phase === 3).length;
  const overdueCount = items.filter(i => i.dayCreated < todayStr && !i.resolvedAt).length;

  function prevDay() {
    const [y, m, d] = viewDate.split('-').map(Number);
    setViewDate(new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10));
  }
  function nextDay() {
    const [y, m, d] = viewDate.split('-').map(Number);
    setViewDate(new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10));
  }

  const phaseSummaryRows = [
    { phase: 1 as const, count: phase1Count, label: "2. Príchod", color: "#1e40af" },
    { phase: 2 as const, count: phase2Count, label: "3. Rozdelenie", color: "#7c3aed" },
    { phase: null, count: overdueCount, label: "1. Nedokončené z minulosti", color: "#dc2626" },
    { phase: 3 as const, count: phase3Count, label: "4. Vybavené dnes", color: "#059669" },
  ].filter(row => row.count > 0);

  return (
    <div className="flex flex-1 gap-4 overflow-hidden min-h-0">

      {/* ─── LEFT: NAHRATÉ SKENY ─────────────────────────────────────────── */}
      <div
        className="flex flex-col overflow-hidden shrink-0"
        style={{ width: scanFiles.length > 0 ? 360 : 0, transition: "width 0.25s ease", minWidth: 0 }}
      >
        {scanFiles.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 shrink-0">
              Nahraté skeny ({scanFiles.length})
            </p>
            <div className="border rounded-md overflow-auto flex-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground">Súbor</th>
                    <th className="text-right py-1.5 px-3 font-medium text-muted-foreground">Veľkosť</th>
                    <th className="text-left py-1.5 px-3 font-medium text-muted-foreground w-36">Stav</th>
                    <th className="text-right py-1.5 px-3 font-medium text-muted-foreground">Čas</th>
                    <th className="py-1.5 px-2 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {scanFiles.map(file => (
                    <tr
                      key={file.id}
                      data-testid={`row-scan-panel-${file.id}`}
                      className="border-b border-border/40 last:border-0"
                      style={{ background: file.error ? "rgba(220,38,38,0.04)" : file.done ? "rgba(5,150,105,0.03)" : undefined }}
                    >
                      <td className="py-1.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <FileText size={13} className="text-muted-foreground shrink-0" />
                          <span className="truncate max-w-[160px] font-medium" title={file.name}>{file.name}</span>
                        </div>
                      </td>
                      <td className="py-1.5 px-3 text-right text-muted-foreground">{fmtSize(file.size)}</td>
                      <td className="py-1.5 px-3">
                        {file.error ? (
                          <span className="flex items-center gap-1 text-red-600 font-medium">
                            <AlertCircle size={11} />
                            {file.error.slice(0, 30)}
                          </span>
                        ) : file.done ? (
                          <span className="flex items-center gap-1 text-emerald-600 font-medium">
                            <CheckCircle2 size={11} />
                            Nahraté
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <Loader2 size={11} className="animate-spin text-blue-600" />
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-20">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all"
                                style={{ width: `${file.progress}%` }}
                              />
                            </div>
                            <span className="text-muted-foreground">{file.progress}%</span>
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-right text-muted-foreground">{fmtTime(file.uploadedAt)}</td>
                      <td className="py-1.5 px-2">
                        <button
                          data-testid={`button-remove-scan-panel-${file.id}`}
                          onClick={() => onRemoveScanFile(file.id)}
                          className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ─── Divider (only when scan files present) ──────────────────────── */}
      {scanFiles.length > 0 && (
        <div style={{ width: 1, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
      )}

      {/* ─── RIGHT: Calendar + DNEŠNÉ AKTIVITY ───────────────────────────── */}
      <div className="flex flex-1 gap-4 min-w-0 overflow-hidden">

        {/* Calendar column */}
        <div className="flex flex-col gap-2 shrink-0" style={{ width: 200 }}>
          {/* Date chip with ← → navigation */}
          <div className="flex items-center gap-1">
            <button
              data-testid="button-prev-day-panel"
              onClick={prevDay}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              data-testid="button-date-chip-panel"
              onClick={() => setCalendarVisible(v => !v)}
              className={`flex-1 text-center rounded-md border px-2 py-1 text-xs font-semibold transition-colors hover:bg-muted/60 ${
                calendarVisible ? "bg-muted border-blue-500/50" : "bg-muted/30 border-border"
              } ${viewDate !== todayStr ? "border-amber-400/60 text-amber-700 dark:text-amber-400" : "text-foreground"}`}
            >
              {(() => {
                const vd = new Date(viewDate + "T00:00:00Z");
                return <>
                  <span className="text-muted-foreground font-normal mr-1">
                    {["Ne","Po","Ut","St","Št","Pi","So"][vd.getUTCDay()]}
                  </span>
                  {vd.getUTCDate()}.{vd.getUTCMonth() + 1}.{vd.getUTCFullYear()}
                </>;
              })()}
            </button>
            <button
              data-testid="button-next-day-panel"
              onClick={nextDay}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Meniny */}
          {(() => {
            const nd = getSlovakNameDay(new Date(viewDate + "T12:00:00"));
            return nd ? (
              <div className="text-[11px] text-muted-foreground border-l-2 border-amber-400/60 pl-2 leading-tight">
                <span className="font-medium text-foreground/70">Meniny:</span>{" "}
                <span className="font-semibold">{nd}</span>
              </div>
            ) : null;
          })()}

          {/* Day / Week / Month toggle */}
          <div className="flex rounded-md border overflow-hidden text-[11px] font-medium">
            {(["day", "week", "month"] as const).map((m) => {
              const labels = { day: "Deň", week: "Týždeň", month: "Mesiac" };
              return (
                <button
                  key={m}
                  data-testid={`button-viewmode-panel-${m}`}
                  onClick={() => setViewMode(m)}
                  className={`flex-1 py-0.5 transition-colors ${
                    viewMode === m
                      ? "bg-blue-700 text-white"
                      : "hover:bg-muted/60 text-muted-foreground"
                  }`}
                >
                  {labels[m]}
                </button>
              );
            })}
          </div>

          {/* Collapsible calendar */}
          {calendarVisible && (
            <div className="border rounded-md p-2 bg-muted/20">
              <InlineCalendar
                selectedDate={viewDate !== todayStr ? viewDate : null}
                onSelectDate={(d) => {
                  setViewDate(d ?? todayStr);
                  setCalendarVisible(false);
                }}
              />
            </div>
          )}

          {/* Back to today */}
          {viewDate !== todayStr && (
            <button
              onClick={() => setViewDate(todayStr)}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              data-testid="button-back-today-panel"
            >
              <X size={10} />
              Späť na dnes
            </button>
          )}
        </div>

        {/* Items table column */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Table title + phase summary */}
          <div className="flex items-center mb-2 shrink-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {viewMode === 'week'
                ? (() => {
                    const [y, mo, d] = viewDate.split('-').map(Number);
                    const dt = new Date(Date.UTC(y, mo - 1, d));
                    const dow = dt.getUTCDay();
                    const mon = new Date(Date.UTC(y, mo - 1, d - (dow === 0 ? 6 : dow - 1)));
                    const sun = new Date(Date.UTC(mon.getUTCFullYear(), mon.getUTCMonth(), mon.getUTCDate() + 6));
                    const fmt = (x: Date) => `${x.getUTCDate()}.${x.getUTCMonth() + 1}.`;
                    return `Týždeň: ${fmt(mon)} – ${fmt(sun)}${sun.getUTCFullYear()}`;
                  })()
                : viewMode === 'month'
                ? `Mesiac: ${new Date(viewDate + "T00:00:00Z").toLocaleString("sk-SK", { month: "long", year: "numeric", timeZone: "UTC" })}`
                : viewDate !== todayStr
                ? `História: ${viewDate.split("-").reverse().join(".")}`
                : "Dnešné aktivity + prenesené nevyriešené"}
            </p>

            {phaseSummaryRows.length > 0 && (
              <div className="ml-auto flex items-center gap-4 shrink-0">
                {phaseSummaryRows.map((row, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    {row.phase ? (
                      <TripleRingStatus phase={row.phase} size={14} />
                    ) : (
                      <TripleRingStatus color={row.color} size={14} />
                    )}
                    <span className="text-xs text-muted-foreground break-words whitespace-normal max-w-[120px]">{row.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto min-h-0">
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
                  const carryOver = item.dayCreated < todayStr && !item.resolvedAt;
                  return (
                    <tr
                      key={item.id}
                      data-testid={`row-item-panel-${item.id}`}
                      className="border-b border-border/50 hover:bg-muted/40 transition-colors cursor-pointer"
                      style={{ background: overdue ? "rgba(220,38,38,0.05)" : carryOver ? "rgba(245,158,11,0.05)" : undefined }}
                      onClick={() => setKokpitOpen(true)}
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
                          const diff = Math.floor((new Date(todayStr).getTime() - new Date(item.dayCreated).getTime()) / 86400000);
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
        </div>
      </div>

      {/* Local KokpitDialog for row clicks */}
      <KokpitDialog
        open={kokpitOpen}
        onOpenChange={setKokpitOpen}
        scanFiles={scanFiles}
        onRemoveScanFile={onRemoveScanFile}
        onAddFiles={onAddFiles}
      />
    </div>
  );
}
