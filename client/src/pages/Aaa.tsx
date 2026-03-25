import { useState } from "react";
import { UserPlus, User, Briefcase, Building2, Building, Landmark, Network, Library } from "lucide-react";

type SubjectType = "person" | "szco" | "company" | "organization" | "state" | "os";

const SUBJECT_TYPE_OPTS: Array<{ val: SubjectType; label: string; shortLabel: string; icon: typeof User }> = [
  { val: "person",       label: "Fyzické osoby (FO)",         shortLabel: "FO",   icon: User },
  { val: "szco",         label: "Živnostníci (SZČO)",         shortLabel: "SZČO", icon: Briefcase },
  { val: "company",      label: "Súkromný sektor (PO)",       shortLabel: "PO",   icon: Building2 },
  { val: "organization", label: "Tretí sektor (TS)",          shortLabel: "TS",   icon: Network },
  { val: "state",        label: "Verejný sektor (VS)",        shortLabel: "VS",   icon: Landmark },
  { val: "os",           label: "Ostatné subjekty (OS)",      shortLabel: "OS",   icon: Library },
];

function SubjectTypeSlider({
  value,
  onChange,
}: {
  value: SubjectType;
  onChange: (v: SubjectType) => void;
}) {
  const n = SUBJECT_TYPE_OPTS.length;
  const activeIdx = SUBJECT_TYPE_OPTS.findIndex(o => o.val === value);

  const handleKey = (e: React.KeyboardEvent, idx: number) => {
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); next = (idx + 1) % n; }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); next = (idx + n - 1) % n; }
    if (next >= 0) {
      onChange(SUBJECT_TYPE_OPTS[next].val);
      const btns = (e.currentTarget.closest('[role="radiogroup"]') as HTMLElement)?.querySelectorAll('button[role="radio"]');
      (btns?.[next] as HTMLElement)?.focus();
    }
  };

  return (
    <div
      className="relative w-full flex p-0.5 bg-muted/40 rounded border border-border/60"
      role="radiogroup"
      aria-label="Typ subjektu"
      data-testid="toggle-subject-type-aaa"
    >
      <div
        className="absolute top-0.5 bottom-0.5 rounded bg-background shadow border border-border/50 transition-all duration-200 ease-out"
        style={{
          width: `calc((100% - 4px) / ${n})`,
          left: `calc(2px + ${activeIdx >= 0 ? activeIdx : 0} * (100% - 4px) / ${n})`,
        }}
      />
      {SUBJECT_TYPE_OPTS.map((opt, idx) => {
        const Icon = opt.icon;
        const isActive = value === opt.val;
        return (
          <button
            key={opt.val}
            type="button"
            role="radio"
            aria-checked={isActive}
            tabIndex={isActive ? 0 : -1}
            title={opt.label}
            className={`relative z-10 flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-medium rounded transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground/80"}`}
            onClick={() => onChange(opt.val)}
            onKeyDown={(e) => handleKey(e, idx)}
            data-testid={`toggle-subject-type-aaa-${opt.val}`}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span className="text-center leading-tight">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function AddPartnerHexButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isActive = hovered || pressed;

  return (
    <div className="flex items-center justify-center w-full" style={{ marginTop: -18, paddingBottom: 4 }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        data-testid="button-add-partner-aaa"
        title="Pridať nový subjekt"
        style={{
          position: "relative",
          width: 280,
          height: 80,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          outline: "none",
          userSelect: "none",
          transition: "transform 0.15s ease, filter 0.25s ease",
          transform: pressed ? "scale(0.96)" : hovered ? "scale(1.05)" : "scale(1)",
          filter: isActive
            ? "drop-shadow(0 0 10px rgba(0,220,60,0.55)) drop-shadow(0 0 22px rgba(0,220,60,0.25))"
            : "drop-shadow(0 0 10px rgba(56,189,248,0.50))",
        }}
      >
        <svg
          width="280"
          height="80"
          viewBox="0 0 280 80"
          fill="none"
          style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
        >
          <defs>
            <filter id="glowAaaRest" x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="10" result="blur" />
            </filter>
            <filter id="glowAaaHover" x="-40%" y="-80%" width="180%" height="260%">
              <feGaussianBlur stdDeviation="14" result="blur" />
            </filter>
            <linearGradient id="hexGradAaa" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          {/* Glow */}
          <rect
            x="8" y="8" width="264" height="64" rx="24"
            fill={isActive ? "rgba(0,255,60,1.0)" : "rgba(56,189,248,0.45)"}
            filter={isActive ? "url(#glowAaaHover)" : "url(#glowAaaRest)"}
            style={{ transition: "fill 0.2s ease" }}
          />
          {isActive && (
            <rect
              x="8" y="8" width="264" height="64" rx="24"
              fill="rgba(0,220,60,0.25)"
              filter="url(#glowAaaHover)"
            />
          )}
          {/* Tabletka */}
          <rect
            x="1" y="1" width="278" height="78" rx="28"
            fill="url(#hexGradAaa)"
            stroke={isActive ? "rgba(245,158,11,0.70)" : "rgba(245,158,11,0.35)"}
            strokeWidth="2"
            style={{ transition: "stroke 0.15s ease" }}
          />
        </svg>

        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: "stretch",
        }}>
          {/* Ľavá 1/3 (93px) — ikona vycentrovaná */}
          <div style={{ width: 93, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <UserPlus
              size={28}
              strokeWidth={1.4}
              style={{
                color: "#FFBF00",
                filter: `drop-shadow(0 0 7px rgba(255,191,0,${isActive ? 0.95 : 0.55}))`,
                transition: "filter 0.15s ease",
              }}
            />
          </div>
          {/* Zvislá čiarka */}
          <div style={{
            width: 3,
            margin: "12px 0",
            borderRadius: 2,
            background: isActive ? "rgba(245,158,11,0.70)" : "rgba(245,158,11,0.35)",
            transition: "background 0.15s ease",
            flexShrink: 0,
          }} />
          {/* Pravá 2/3 (184px) — text vycentrovaný */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{
              fontFamily: "sans-serif",
              fontSize: 12,
              fontWeight: 800,
              color: "#b8d0f0",
              letterSpacing: "0.05em",
              whiteSpace: "nowrap",
            }}>
              Pridať subjekt
            </span>
          </div>
        </div>
      </button>
    </div>
  );
}

export default function Aaa() {
  const [subjectType, setSubjectType] = useState<SubjectType>("person");

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2" data-testid="text-aaa-title">
        Pridať subjekt
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Toto okno slúži na registráciu nového subjektu.
      </p>

      <AddPartnerHexButton onClick={() => {}} />

      <div className="mt-6">
        <SubjectTypeSlider value={subjectType} onChange={setSubjectType} />
      </div>
    </div>
  );
}
