import { useState } from "react";
import { Plus } from "lucide-react";

interface AddSubjectCardProps {
  onClick: () => void;
}

export function AddSubjectCard({ onClick }: AddSubjectCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isActive = hovered || pressed;

  return (
    <div className="flex items-center justify-center w-full" style={{ marginTop: 12, paddingBottom: 4 }}>
      <button
        type="button"
        data-testid="button-add-subject-card"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
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
            <filter id="subjectGlow" x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="10" result="blur" />
            </filter>
            <linearGradient id="pillGradSubject" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          {/* Podsvietenie (glow) */}
          <rect
            x="8" y="8" width="264" height="64" rx="20"
            fill={hovered ? "rgba(57,255,20,0.85)" : "rgba(56,189,248,0.45)"}
            filter="url(#subjectGlow)"
            style={{ transition: "fill 0.25s ease" }}
          />
          {/* Hlavná pilulka */}
          <rect
            x="1" y="1" width="278" height="78" rx="24"
            fill="url(#pillGradSubject)"
            stroke={hovered ? "rgba(245,158,11,0.70)" : "rgba(245,158,11,0.35)"}
            strokeWidth="1.5"
            style={{ transition: "stroke 0.15s ease" }}
          />
          {/* Vertikálne delítko */}
          <line
            x1="100" y1="14" x2="100" y2="66"
            stroke="rgba(245,158,11,0.25)"
            strokeWidth="1"
          />
        </svg>

        {/* Ľavá časť: ikona 👤 zlatá + plus */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, width: 100, bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <span style={{
              fontSize: 28,
              lineHeight: 1,
              filter: "sepia(1) saturate(4) hue-rotate(5deg) brightness(1.15) drop-shadow(0 0 6px rgba(255,191,0,0.8))",
              display: "block",
            }}>👤</span>
            <Plus
              size={12}
              strokeWidth={3}
              style={{
                position: "absolute",
                top: -3,
                right: -8,
                color: "#FFBF00",
                filter: "drop-shadow(0 0 4px #FFBF00)",
              }}
            />
          </div>
        </div>

        {/* Pravá časť: text */}
        <div style={{
          position: "absolute",
          top: 0, left: 100, right: 0, bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingLeft: 8,
        }}>
          <span style={{
            fontFamily: "sans-serif",
            fontSize: 13,
            fontWeight: 700,
            color: "#b8d0f0",
            letterSpacing: "0.05em",
            whiteSpace: "nowrap",
          }}>
            Pridať partnera
          </span>
        </div>
      </button>
    </div>
  );
}
