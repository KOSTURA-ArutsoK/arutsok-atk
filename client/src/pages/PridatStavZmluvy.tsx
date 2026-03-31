import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { CalendarDays, Star, Server } from "lucide-react";
import { KokpitHub, type KokpitFunctionId } from "@/components/KokpitHub";
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
    <div className="p-5 space-y-5">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold">KOKPIT</h1>
        <p className="text-sm text-muted-foreground">
          Kokpit je centrálne miesto pre správu stavov zmlúv a zmlúv.
        </p>
      </div>

      {/* KOKPIT button */}
      <div className="flex justify-center pt-2">
        <KokpitCard onClick={() => setHubOpen(true)} />
      </div>

      {/* Backoffice info chip row */}
      <InfoChipRow variant="backoffice" chips={boChips} />

      <KokpitHub
        open={hubOpen}
        onOpenChange={setHubOpen}
        onSelectFunction={handleHubSelectFunction}
        scanFiles={scanFiles}
        onRemoveScanFile={removeScanFile}
        onAddFiles={uploadFiles}
      />
    </div>
  );
}
