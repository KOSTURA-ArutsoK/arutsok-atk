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
          height: 50,
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
          height="50"
          viewBox="0 0 250 50"
          fill="none"
          style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
        >
          <defs>
            <filter id="subjectGlow" x="-40%" y="-120%" width="180%" height="340%">
              <feGaussianBlur stdDeviation="10" result="blur" />
            </filter>
            <linearGradient id="pillGradSubject" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          {/* Glow pod pilulkou */}
          <rect
            x="8" y="8" width="234" height="34" rx="17"
            fill={isActive ? "rgba(57,255,20,0.85)" : "rgba(56,189,248,0.45)"}
            filter="url(#subjectGlow)"
            style={{ transition: "fill 0.2s ease" }}
          />
          {/* Hlavná pilulka */}
          <rect
            x="1" y="1" width="248" height="48" rx="24"
            fill="url(#pillGradSubject)"
            stroke={isActive ? "rgba(245,158,11,0.75)" : "rgba(245,158,11,0.35)"}
            strokeWidth="1.5"
            style={{ transition: "stroke 0.15s ease" }}
          />
        </svg>

        {/* Obsah: ikona + text */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}>
          <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
            <span style={{
              fontSize: 22,
              lineHeight: 1,
              filter: `drop-shadow(0 0 6px rgba(255,191,0,${isActive ? 0.95 : 0.5}))`,
              transition: "filter 0.15s ease",
            }}>👤</span>
            <Plus
              size={11}
              strokeWidth={3}
              style={{
                position: "absolute",
                top: -2,
                right: -7,
                color: "#FFBF00",
                filter: "drop-shadow(0 0 4px #FFBF00)",
              }}
            />
          </div>
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
