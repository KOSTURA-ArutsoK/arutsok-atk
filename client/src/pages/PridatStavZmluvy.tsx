import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ChevronLeft, ChevronRight, X, Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { TripleRingStatus } from "@/components/TripleRingStatus";
import { KokpitDialog } from "@/components/KokpitDialog";
import { KokpitHub } from "@/components/KokpitHub";
import { formatRemainingHHMM, isOverdue, isAdminAlert } from "@/lib/workingHours";
import { getSlovakNameDay } from "@/lib/slovakNameDays";
import type { KokpitItem, KokpitStagedScan } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

type KokpitItemExt = KokpitItem & { contractUid?: string | null; statusName?: string | null };

export type ScanFile = {
  id: string;
  name: string;
  size: number;
  progress: number;
  done: boolean;
  error?: string;
  uploadedAt: number;
  url?: string;
  dbId?: number;
};

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
      <svg width="160" height="160" viewBox="0 0 180 180" fill="none" style={{ overflow: "visible" }}>
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
        <circle cx="90" cy="90" r="95"
          fill={isActive ? "rgba(57,255,20,1.0)" : "rgba(56,189,248,1.0)"}
          filter="url(#kokpitGlow1)"
          style={{ transition: "fill 0.2s ease", opacity: isActive ? 1 : 0.85 }}
        />
        <circle cx="90" cy="90" r="85"
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

// ── Inline Calendar (always visible) ─────────────────────────────────────────

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
        <button onClick={prevMonth} className="p-0.5 rounded hover:bg-muted text-muted-foreground" data-testid="cal-prev">
          <ChevronLeft size={13} />
        </button>
        <span className="text-[11px] font-semibold text-foreground">{MONTH_NAMES_SK[month - 1]} {year}</span>
        <button onClick={nextMonth} className="p-0.5 rounded hover:bg-muted text-muted-foreground" data-testid="cal-next">
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
              data-testid={`cal-day-${ymd}`}
              onClick={() => {
                if (isToday && isSelected) {
                  onSelectDate(null);
                } else if (isToday) {
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

// ── Helper: format file size ───────────────────────────────────────────────────

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PridatStavZmluvy() {
  const { toast } = useToast();
  const [hubOpen, setHubOpen] = useState(false);
  const [kokpitOpen, setKokpitOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [viewDate, setViewDate] = useState(new Date().toISOString().slice(0, 10));
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [scanFiles, setScanFiles] = useState<ScanFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dbInitializedRef = useRef(false);

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);


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

  const { data: stagedScans = [], isSuccess: stagedScansLoaded } = useQuery<KokpitStagedScan[]>({
    queryKey: ["/api/kokpit/staged-scans"],
    queryFn: async () => {
      const res = await fetch("/api/kokpit/staged-scans", { credentials: "include" });
      return res.json();
    },
  });

  useEffect(() => {
    if (stagedScansLoaded && !dbInitializedRef.current) {
      dbInitializedRef.current = true;
      if (stagedScans.length > 0) {
        setScanFiles(stagedScans.map(s => ({
          id: `db-${s.id}`,
          name: s.name,
          size: s.size ?? 0,
          progress: 100,
          done: true,
          uploadedAt: new Date(s.uploadedAt!).getTime(),
          url: s.url,
          dbId: s.id,
        })));
      }
    }
  }, [stagedScansLoaded, stagedScans]);

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

  function handleRowClick(_item: KokpitItemExt) {
    setKokpitOpen(true);
  }

  function handleHubSelectFunction(fn: "roztriedenie-stavov") {
    setHubOpen(false);
    if (fn === "roztriedenie-stavov") {
      setKokpitOpen(true);
    }
  }

  // ── File upload ──────────────────────────────────────────────────────────────

  const MAX_SCAN_FILES = 150;

  function uploadFiles(files: File[]) {
    if (!files.length) return;

    const remaining = MAX_SCAN_FILES - scanFiles.length;
    if (remaining <= 0) {
      toast({ title: "Limit dosiahnutý", description: `Môžete nahrať najviac ${MAX_SCAN_FILES} súborov naraz.`, variant: "destructive" });
      return;
    }
    if (files.length > remaining) {
      toast({ title: "Limit súborov", description: `Pridáva sa len prvých ${remaining} súborov (limit: ${MAX_SCAN_FILES}).`, variant: "destructive" });
      files = files.slice(0, remaining);
    }

    const newEntries: ScanFile[] = files.map(f => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: f.name,
      size: f.size,
      progress: 0,
      done: false,
      uploadedAt: Date.now(),
    }));

    setScanFiles(prev => [...newEntries, ...prev]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const entry = newEntries[i];
      const fileId = entry.id;
      const formData = new FormData();
      formData.append("files", file);

      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          setScanFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: pct } : f));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          let url: string | undefined;
          try {
            const resp = JSON.parse(xhr.responseText);
            url = resp?.files?.[0]?.url ?? resp?.url ?? undefined;
          } catch {}
          setScanFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: 100, done: true, url } : f));
          if (url) {
            fetch("/api/kokpit/staged-scans", {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: entry.name, url, size: file.size }),
            })
              .then(r => r.ok ? r.json() : Promise.reject(r))
              .then(saved => {
                if (saved?.id) {
                  setScanFiles(prev => prev.map(f => f.id === fileId ? { ...f, dbId: saved.id } : f));
                  queryClient.invalidateQueries({ queryKey: ["/api/kokpit/staged-scans"] });
                }
              })
              .catch(() => {
                toast({ title: "Upozornenie", description: "Sken sa nahrával, ale nepodarilo sa ho uložiť do zoznamu (bude stratený po obnovení stránky).", variant: "destructive" });
              });
          }
        } else {
          let msg = "Chyba nahrávania";
          try { msg = JSON.parse(xhr.responseText)?.message || msg; } catch {}
          setScanFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: 0, error: msg } : f));
          toast({ title: "Chyba nahrávania", description: msg, variant: "destructive" });
        }
      };
      xhr.onerror = () => {
        setScanFiles(prev => prev.map(f => f.id === fileId ? { ...f, progress: 0, error: "Sieťová chyba" } : f));
      };
      xhr.open("POST", "/api/scan-commander/stage-upload");
      xhr.withCredentials = true;
      xhr.send(formData);
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.size > 0);
    uploadFiles(files);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter(f => f.size > 0);
    uploadFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeScanFile(id: string, reason: string = 'user') {
    const file = scanFiles.find(f => f.id === id);
    if (file?.dbId) {
      fetch(`/api/kokpit/staged-scans/${file.dbId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
        .then(r => { if (r.ok) queryClient.invalidateQueries({ queryKey: ["/api/kokpit/staged-scans"] }); })
        .catch(() => {
          toast({ title: "Upozornenie", description: "Nepodarilo sa odstrániť sken z databázy.", variant: "destructive" });
        });
    }
    setScanFiles(prev => prev.filter(f => f.id !== id));
  }

  // Phase summary rows (only non-zero), order: Príchod, Rozdelenie, Nedokončené, Vybavené
  const phaseSummaryRows = [
    { phase: 1 as const, count: phase1Count, label: "2. Príchod", color: "#1e40af" },
    { phase: 2 as const, count: phase2Count, label: "3. Rozdelenie", color: "#7c3aed" },
    { phase: null, count: overdueCount, label: "1. Nedokončené z minulosti", color: "#dc2626" },
    { phase: 3 as const, count: phase3Count, label: "4. Vybavené dnes", color: "#059669" },
  ].filter(row => row.count > 0);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-5 space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold">KOKPIT</h1>
        <p className="text-sm text-muted-foreground">
          Kokpit je centrálne miesto pre správu stavov zmlúv a zmlúv.
        </p>
      </div>

      {/* 3-column top section */}
      <div className="flex gap-4 items-start">

        {/* LEFT: date chip + meniny + toggle + calendar */}
        <div className="min-w-[160px] flex-1 max-w-[220px] space-y-2">
          {/* Date chip with ← → navigation */}
          <div className="flex items-center gap-1">
            <button
              data-testid="button-prev-day"
              onClick={prevDay}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground shrink-0"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              data-testid="button-date-chip"
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
              data-testid="button-next-day"
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
                  data-testid={`button-viewmode-${m}`}
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

          {/* Collapsible inline calendar */}
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
              data-testid="button-back-today"
            >
              <X size={10} />
              Späť na dnes
            </button>
          )}
        </div>

        {/* CENTER: KOKPIT button */}
        <div className="flex-1 flex flex-col items-center gap-3 pt-2">
          <KokpitCard onClick={() => setHubOpen(true)} />
        </div>

        {/* RIGHT: Scan drop zone */}
        <div className="min-w-[200px] flex-1 max-w-[320px] pt-2">
          <div
            data-testid="drop-zone-scans"
            onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
            style={{
              borderColor: isDragOver ? "#1e40af" : "var(--border)",
              background: isDragOver ? "rgba(30,64,175,0.05)" : "var(--muted)/5",
              minHeight: 140,
            }}
          >
            <Upload size={28} className="text-muted-foreground/60" />
            <p className="text-xs text-center text-muted-foreground leading-snug">
              Pretiahnite skeny sem<br />
              <span className="text-muted-foreground/60">alebo kliknite na výber</span>
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            data-testid="input-file-scans"
            onChange={handleFileInput}
          />
        </div>
      </div>

      {/* Uploaded scans table (auto-hide when empty) */}
      {scanFiles.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
            Nahraté skeny ({scanFiles.length})
          </p>
          <div className="border rounded-md overflow-hidden">
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
                    data-testid={`row-scan-${file.id}`}
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
                        data-testid={`button-remove-scan-${file.id}`}
                        onClick={() => removeScanFile(file.id)}
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
        </div>
      )}

      {/* Kokpit items table */}
      <div>
        {/* Table header with phase summary on the right */}
        <div className="flex items-center mb-2">
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
            <div className="ml-auto flex items-center gap-4">
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
                  data-testid={`row-item-${item.id}`}
                  className="border-b border-border/50 hover:bg-muted/40 transition-colors cursor-pointer"
                  style={{ background: overdue ? "rgba(220,38,38,0.05)" : carryOver ? "rgba(245,158,11,0.05)" : undefined }}
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

      <KokpitHub
        open={hubOpen}
        onOpenChange={setHubOpen}
        onSelectFunction={handleHubSelectFunction}
      />

      <KokpitDialog
        open={kokpitOpen}
        onOpenChange={setKokpitOpen}
        scanFiles={scanFiles}
        onRemoveScanFile={removeScanFile}
        onAddFiles={uploadFiles}
      />
    </div>
  );
}
