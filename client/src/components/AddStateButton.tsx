import { useState } from "react";
import { Globe, Plus } from "lucide-react";

interface AddStateButtonProps {
  onClick: () => void;
}

export function AddStateButton({ onClick }: AddStateButtonProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isActive = hovered || pressed;

  return (
    <div className="flex items-center justify-center w-full" style={{ marginTop: 0, paddingBottom: 4 }}>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        data-testid="button-add-state"
        title="Pridať nový štát"
        style={{
          position: "relative",
          width: 160,
          height: 160,
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
          width="160"
          height="160"
          viewBox="0 0 160 160"
          fill="none"
          style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
        >
          <defs>
            <filter id="stateGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="16" result="blur" />
            </filter>
            <linearGradient id="circleGradState" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          {/* Podsvietenie — sky-modrá v kľude, krikľavo zelená pri hoveri */}
          <circle
            cx="80"
            cy="80"
            r="68"
            fill={isActive ? "rgba(57,255,20,1.0)" : "rgba(56,189,248,0.50)"}
            filter="url(#stateGlow)"
            style={{ transition: "fill 0.2s ease" }}
          />
          {/* Hlavný kruh */}
          <circle
            cx="80"
            cy="80"
            r="68"
            fill="url(#circleGradState)"
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
            <Globe
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
          }}>
            Pridať štát
          </span>
        </div>
      </button>
    </div>
  );
}
