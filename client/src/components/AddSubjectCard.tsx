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
          width: 250,
          height: 150,
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
          width="250"
          height="150"
          viewBox="0 0 250 150"
          fill="none"
          style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
        >
          <defs>
            <filter id="subjectGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="12" result="blur" />
            </filter>
            <linearGradient id="pillGradSubject" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#071a0f" />
              <stop offset="100%" stopColor="#0f3d1a" />
            </linearGradient>
          </defs>
          {/* Zelené podsvietenie (glow) */}
          <rect
            x="10" y="10" width="230" height="130" rx="28"
            fill={isActive ? "rgba(57,255,20,0.90)" : "rgba(34,197,94,0.55)"}
            filter="url(#subjectGlow)"
            style={{ transition: "fill 0.2s ease" }}
          />
          {/* Hlavná pilulka */}
          <rect
            x="1" y="1" width="248" height="148" rx="30"
            fill="url(#pillGradSubject)"
            stroke={isActive ? "rgba(34,197,94,0.85)" : "rgba(34,197,94,0.40)"}
            strokeWidth="1.5"
            style={{ transition: "stroke 0.15s ease" }}
          />
          {/* Vertikálne delítko */}
          <line
            x1="100" y1="28" x2="100" y2="122"
            stroke={isActive ? "rgba(34,197,94,0.70)" : "rgba(34,197,94,0.30)"}
            strokeWidth="1"
            style={{ transition: "stroke 0.15s ease" }}
          />
        </svg>

        {/* Ľavá časť: ikona 👤 + plus */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, width: 100, bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <span style={{
              fontSize: 34,
              lineHeight: 1,
              filter: `drop-shadow(0 0 8px rgba(57,255,20,${isActive ? 1.0 : 0.55}))`,
              transition: "filter 0.15s ease",
            }}>👤</span>
            <Plus
              size={13}
              strokeWidth={3}
              style={{
                position: "absolute",
                top: -4,
                right: -9,
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
            Pridať subjekt
          </span>
        </div>
      </button>
    </div>
  );
}
