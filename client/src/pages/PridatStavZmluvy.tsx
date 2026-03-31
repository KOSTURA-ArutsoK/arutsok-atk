import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import {
  CalendarDays, Star, Server, ChevronLeft, ChevronRight, X,
  AlertTriangle, ArrowDownToLine, GitBranch, CheckCircle2 as CheckCircle2Icon,
  ScanLine, ListTodo,
} from "lucide-react";
import { KokpitHub, type KokpitFunctionId } from "@/components/KokpitHub";
import { InlineCalendar } from "@/components/KokpitAktivityPanel";
import type { KokpitStagedScan } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { InfoChipRow, getWeatherLucideIcon } from "@/components/InfoChipRow";
import { useWeather, getWeatherDesc, getWeatherIcon } from "@/hooks/use-weather";
import { getSlovakNameDay, getSlovakHoliday } from "@/lib/slovakNameDays";

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
      <svg width="240" height="240" viewBox="0 0 180 180" fill="none" style={{ overflow: "visible" }}>
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PridatStavZmluvy() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [hubOpen, setHubOpen] = useState(false);
  const [scanFiles, setScanFiles] = useState<ScanFile[]>([]);
  const dbInitializedRef = useRef(false);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Stats queries ─────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);

  type KokpitItemStat = { phase: number; dayCreated: string; resolvedAt: string | null };
  const { data: kokpitItems = [] } = useQuery<KokpitItemStat[]>({
    queryKey: ["/api/kokpit/items", "today-stats"],
    queryFn: async () => {
      const res = await fetch("/api/kokpit/items?mode=today", { credentials: "include" });
      return res.json();
    },
    refetchInterval: 60_000,
  });

  type TasksCount = { count: number; nonCalendarCount: number; unprocessedAcceptedSprievodkyCount: number };
  const { data: tasksCount } = useQuery<TasksCount>({
    queryKey: ["/api/my-tasks/count"],
  });

  const statPhase1 = kokpitItems.filter(i => i.phase === 1).length;
  const statPhase2 = kokpitItems.filter(i => i.phase === 2).length;
  const statPhase3 = kokpitItems.filter(i => i.phase === 3).length;
  const statOverdue = kokpitItems.filter(i => i.dayCreated < todayStr && !i.resolvedAt).length;
  const statScans   = scanFiles.length;
  const statTasks   = tasksCount?.nonCalendarCount ?? 0;

  // ── Lifted viewMode + viewDate (shared with KokpitHub Layer 2) ────────────
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [viewDate, setViewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [calendarVisible, setCalendarVisible] = useState(false);

  function prevDay() {
    const [y, m, d] = viewDate.split('-').map(Number);
    setViewDate(new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10));
  }
  function nextDay() {
    const [y, m, d] = viewDate.split('-').map(Number);
    setViewDate(new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10));
  }

  const presovWeather = useWeather(49.0016, 21.2396);

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

  function handleHubSelectFunction(fn: KokpitFunctionId) {
    if (fn === "dokumenty-na-stiahnutie") {
      setHubOpen(false);
      setLocation("/dokumenty-na-stiahnutie");
    } else if (fn === "hromadny-import-stavov") {
      setHubOpen(false);
      setLocation("/hromadne-stavy");
    }
    // roztriedenie-stavov → Hub Layer 2 (KokpitAktivityPanel)
    // zadavanie-provizii, vypocet-odmien → Hub zobrazuje Layer 2 (skeleton)
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


  // ── Render ───────────────────────────────────────────────────────────────────

  const dateStr = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const nameDay = getSlovakNameDay(now);
  const holiday = getSlovakHoliday(now);
  const weatherIcon = presovWeather.data ? getWeatherLucideIcon(getWeatherIcon(presovWeather.data.weatherCode)) : CalendarDays;
  const weatherValue = presovWeather.loading
    ? "Načítavam..."
    : presovWeather.error || !presovWeather.data
    ? "Nedostupné"
    : `${presovWeather.data.temperature}°C · ${getWeatherDesc(presovWeather.data.weatherCode)}`;

  const boChips = [
    {
      icon: CalendarDays,
      label: "Dátum / Čas",
      value: `${dateStr} | ${timeStr}`,
      testId: "chip-bo-datetime",
    },
    {
      icon: Star,
      label: holiday ? "Meniny / Sviatok" : "Meniny",
      value: holiday
        ? `${nameDay || "—"} | ${holiday}`
        : nameDay || "—",
      testId: "chip-bo-nameday",
    },
    {
      icon: weatherIcon,
      label: "Prešov",
      value: weatherValue,
      testId: "chip-bo-weather",
    },
    {
      icon: Server,
      label: "Systém",
      value: "Trezor: Online | Spojení: —",
      testId: "chip-bo-system",
    },
  ];

  return (
    <div className="p-5 space-y-4">

      {/* ── Backoffice info chip row ────────────────────────────────────────── */}
      <InfoChipRow variant="backoffice" chips={boChips} />

      {/* ── Date navigation row (← viewDate →, collapsible calendar) ─────── */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            data-testid="button-prev-day-layer1"
            onClick={prevDay}
            className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0 transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            data-testid="button-date-chip-layer1"
            onClick={() => setCalendarVisible(v => !v)}
            className={`flex-1 max-w-[180px] text-center rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted/60 ${
              calendarVisible ? "bg-muted border-blue-500/50" : "bg-muted/30 border-border"
            } ${viewDate !== todayStr ? "border-amber-400/60 text-amber-700 dark:text-amber-400" : "text-foreground"}`}
          >
            {(() => {
              const vd = new Date(viewDate + "T00:00:00Z");
              return (
                <>
                  <span className="text-muted-foreground font-normal mr-1">
                    {["Ne","Po","Ut","St","Št","Pi","So"][vd.getUTCDay()]}
                  </span>
                  {vd.getUTCDate()}.{vd.getUTCMonth() + 1}.{vd.getUTCFullYear()}
                </>
              );
            })()}
          </button>
          <button
            type="button"
            data-testid="button-next-day-layer1"
            onClick={nextDay}
            className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0 transition-colors"
          >
            <ChevronRight size={14} />
          </button>
          {viewDate !== todayStr && (
            <button
              type="button"
              data-testid="button-back-today-layer1"
              onClick={() => { setViewDate(todayStr); setCalendarVisible(false); }}
              className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline ml-1"
            >
              <X size={10} />
              Späť na dnes
            </button>
          )}
        </div>
        {calendarVisible && (
          <div className="border rounded-md p-2 bg-muted/20" style={{ maxWidth: 220 }}>
            <InlineCalendar
              selectedDate={viewDate !== todayStr ? viewDate : null}
              onSelectDate={(d) => {
                setViewDate(d ?? todayStr);
                setCalendarVisible(false);
              }}
            />
          </div>
        )}
      </div>

      {/* ── KOKPIT button (centered, 1.5× size) ───────────────────────────── */}
      <div className="flex justify-center py-2">
        <KokpitCard onClick={() => setHubOpen(true)} />
      </div>

      {/* ── Dashboard statistics ───────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {/* Prenesené / nedokončené */}
        <div
          data-testid="stat-overdue"
          className="flex flex-col items-center gap-1 rounded-xl p-3 border"
          style={{
            background: "linear-gradient(135deg, rgba(220,38,38,0.08) 0%, rgba(127,29,29,0.04) 100%)",
            borderColor: "rgba(220,38,38,0.25)",
          }}
        >
          <AlertTriangle size={18} color="#dc2626" />
          <span className="text-2xl font-black" style={{ color: "#dc2626", lineHeight: 1 }}>{statOverdue}</span>
          <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight uppercase tracking-wide">Prenesené</span>
        </div>

        {/* Príchod — fáza 1 */}
        <div
          data-testid="stat-phase1"
          className="flex flex-col items-center gap-1 rounded-xl p-3 border"
          style={{
            background: "linear-gradient(135deg, rgba(30,64,175,0.10) 0%, rgba(30,64,175,0.03) 100%)",
            borderColor: "rgba(59,130,246,0.25)",
          }}
        >
          <ArrowDownToLine size={18} color="#3b82f6" />
          <span className="text-2xl font-black" style={{ color: "#3b82f6", lineHeight: 1 }}>{statPhase1}</span>
          <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight uppercase tracking-wide">Príchod</span>
        </div>

        {/* Rozdelenie — fáza 2 */}
        <div
          data-testid="stat-phase2"
          className="flex flex-col items-center gap-1 rounded-xl p-3 border"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.10) 0%, rgba(124,58,237,0.03) 100%)",
            borderColor: "rgba(139,92,246,0.25)",
          }}
        >
          <GitBranch size={18} color="#8b5cf6" />
          <span className="text-2xl font-black" style={{ color: "#8b5cf6", lineHeight: 1 }}>{statPhase2}</span>
          <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight uppercase tracking-wide">Rozdelenie</span>
        </div>

        {/* Vybavené dnes */}
        <div
          data-testid="stat-phase3"
          className="flex flex-col items-center gap-1 rounded-xl p-3 border"
          style={{
            background: "linear-gradient(135deg, rgba(5,150,105,0.10) 0%, rgba(5,150,105,0.03) 100%)",
            borderColor: "rgba(16,185,129,0.25)",
          }}
        >
          <CheckCircle2Icon size={18} color="#10b981" />
          <span className="text-2xl font-black" style={{ color: "#10b981", lineHeight: 1 }}>{statPhase3}</span>
          <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight uppercase tracking-wide">Vybavené</span>
        </div>

        {/* Nahraté skeny */}
        <div
          data-testid="stat-scans"
          className="flex flex-col items-center gap-1 rounded-xl p-3 border"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0.03) 100%)",
            borderColor: "rgba(245,158,11,0.25)",
          }}
        >
          <ScanLine size={18} color="#f59e0b" />
          <span className="text-2xl font-black" style={{ color: "#f59e0b", lineHeight: 1 }}>{statScans}</span>
          <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight uppercase tracking-wide">Skeny</span>
        </div>

        {/* Moje úlohy */}
        <div
          data-testid="stat-tasks"
          className="flex flex-col items-center gap-1 rounded-xl p-3 border"
          style={{
            background: "linear-gradient(135deg, rgba(6,182,212,0.10) 0%, rgba(6,182,212,0.03) 100%)",
            borderColor: "rgba(6,182,212,0.25)",
          }}
        >
          <ListTodo size={18} color="#06b6d4" />
          <span className="text-2xl font-black" style={{ color: "#06b6d4", lineHeight: 1 }}>{statTasks}</span>
          <span className="text-[10px] font-semibold text-muted-foreground text-center leading-tight uppercase tracking-wide">Moje úlohy</span>
        </div>
      </div>

      <KokpitHub
        open={hubOpen}
        onOpenChange={setHubOpen}
        onSelectFunction={handleHubSelectFunction}
        scanFiles={scanFiles}
        onRemoveScanFile={removeScanFile}
        onAddFiles={uploadFiles}
        viewMode={viewMode}
        setViewMode={setViewMode}
        viewDate={viewDate}
      />
    </div>
  );
}
