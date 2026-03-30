import { useState } from "react";
import { Building2, Plus } from "lucide-react";

function KokpitCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isActive = hovered || pressed;

  return (
    <div className="flex items-center justify-center w-full" style={{ marginTop: -15, paddingBottom: 4 }}>
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
          position: "relative",
          width: 150,
          height: 173,
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
          width="150"
          height="173"
          viewBox="0 0 160 180"
          fill="none"
          style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
        >
          <defs>
            <filter id="companyGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="16" result="blur" />
            </filter>
            <linearGradient id="rectGradCompany" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          <rect
            x="16" y="16" width="128" height="148" rx="22"
            fill={isActive ? "rgba(57,255,20,1.0)" : "rgba(56,189,248,0.50)"}
            filter="url(#companyGlow)"
            style={{ transition: "fill 0.2s ease" }}
          />
          <rect
            x="16" y="16" width="128" height="148" rx="22"
            fill="url(#rectGradCompany)"
            stroke={isActive ? "rgba(245,158,11,0.70)" : "rgba(245,158,11,0.35)"}
            strokeWidth="1.8"
            style={{ transition: "stroke 0.15s ease" }}
          />
        </svg>

        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
        }}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <Building2
              size={46}
              strokeWidth={1.4}
              style={{
                color: "#FFBF00",
                filter: `drop-shadow(0 0 8px rgba(255,191,0,${isActive ? 0.95 : 0.55}))`,
                transition: "filter 0.15s ease",
                display: "block",
              }}
            />
            <Plus
              size={14}
              strokeWidth={2.5}
              style={{
                position: "absolute",
                top: -6,
                right: -9,
                color: "#FFBF00",
                filter: "drop-shadow(0 0 5px #FFBF00)",
              }}
            />
          </div>
          <span style={{
            fontFamily: "sans-serif",
            fontSize: 11,
            fontWeight: 800,
            color: "#b8d0f0",
            letterSpacing: "0.04em",
            textAlign: "center",
            lineHeight: 1.2,
            display: "block",
            width: "100%",
          }}>
            KOKPIT
          </span>
        </div>
      </button>
    </div>
  );
}

export default function PridatStavZmluvy() {
  return (
    <div className="p-6 space-y-1">
      <h1 className="text-2xl font-bold">Spracovanie stavov</h1>
      <p className="text-sm text-muted-foreground">
        Centrálne miesto pre správu stavov zmlúv — všetko, čo príde ku akejkoľvek zmluve, sa tu bude dopĺňať a spracovávať.
      </p>
      <div className="flex items-center justify-center pt-16">
        <KokpitCard onClick={() => {}} />
      </div>
    </div>
  );
}
