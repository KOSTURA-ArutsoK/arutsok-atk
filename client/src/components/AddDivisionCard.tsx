import { useState } from "react";
import { Plus } from "lucide-react";

interface AddDivisionCardProps {
  onClick: () => void;
}

const TRIANGLE_PATH = "M 92,28 L 141,112 Q 154,134 129,134 L 31,134 Q 6,134 19,112 L 68,28 Q 80,6 92,28 Z";

export function AddDivisionCard({ onClick }: AddDivisionCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isActive = hovered || pressed;

  return (
    <div className="flex items-center justify-center w-full" style={{ marginTop: -10, paddingBottom: 4 }}>
      <button
        type="button"
        data-testid="button-add-division-card"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={{
          position: "relative",
          width: 200,
          height: 230,
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
          width="200"
          height="175"
          viewBox="0 0 160 140"
          fill="none"
          style={{ position: "absolute", top: 10, left: 0, overflow: "visible" }}
        >
          <defs>
            <filter id="divisionGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="16" result="blur" />
            </filter>
            <linearGradient id="triGradDivision" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          {/* Podsvietenie */}
          <path
            d={TRIANGLE_PATH}
            fill={isActive ? "rgba(255,210,0,1.0)" : "rgba(56,189,248,0.50)"}
            filter="url(#divisionGlow)"
            style={{ transition: "fill 0.2s ease" }}
          />
          {/* Hlavný trojuholník */}
          <path
            d={TRIANGLE_PATH}
            fill="url(#triGradDivision)"
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
          paddingTop: 15,
          gap: 9,
        }}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <span style={{
              fontSize: 38,
              lineHeight: 1,
              filter: `sepia(1) saturate(6) hue-rotate(8deg) brightness(1.15) drop-shadow(0 0 8px rgba(255,191,0,${isActive ? 0.95 : 0.55}))`,
              transition: "filter 0.15s ease",
              display: "block",
            }}>
              🌲
            </span>
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
            Pridať divíziu
          </span>
        </div>
      </button>
    </div>
  );
}
