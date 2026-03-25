import { useState } from "react";
import { UserPlus } from "lucide-react";

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
          transition: "transform 0.15s ease",
          transform: pressed ? "scale(0.96)" : hovered ? "scale(1.05)" : "scale(1)",
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
            <filter id="amberGlowAaa" x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="12" result="blur" />
            </filter>
            <linearGradient id="hexGradAaa" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          {/* Glow */}
          <rect
            x="8" y="8" width="264" height="64" rx="24"
            fill={isActive ? "rgba(0,255,80,1.0)" : "rgba(56,189,248,0.50)"}
            filter="url(#amberGlowAaa)"
            style={{ transition: "fill 0.2s ease" }}
          />
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
          {/* Ľavá 1/3 — ikona vycentrovaná */}
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
          {/* Pravá 2/3 — text vycentrovaný */}
          <div style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
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
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2" data-testid="text-aaa-title">
        Pridať subjekt
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Toto okno slúži na registráciu nového subjektu.
      </p>

      <AddPartnerHexButton onClick={() => {}} />
    </div>
  );
}
