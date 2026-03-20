import { useState } from "react";
import { Plus } from "lucide-react";

interface AddProductCardProps {
  onClick: () => void;
}

// Flat-top octagon: horná aj spodná strana sú vodorovné
const OCTAGON_PATH = "M 101,20 L 130,49 L 130,91 L 101,120 L 59,120 L 30,91 L 30,49 L 59,20 Z";

export function AddProductCard({ onClick }: AddProductCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isActive = hovered || pressed;

  return (
    <div className="flex items-center justify-center w-full" style={{ marginTop: -28, paddingBottom: 4 }}>
      <button
        type="button"
        data-testid="button-add-product-card"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={{
          position: "relative",
          width: 222,
          height: 254,
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
          width="222"
          height="194"
          viewBox="0 0 160 140"
          fill="none"
          style={{ position: "absolute", top: 10, left: 0, overflow: "visible" }}
        >
          <defs>
            <filter id="productGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="16" result="blur" />
            </filter>
            <linearGradient id="octGradProduct" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0a1f3d" />
              <stop offset="100%" stopColor="#1a3f80" />
            </linearGradient>
          </defs>
          {/* Podsvietenie */}
          <path
            d={OCTAGON_PATH}
            fill={isActive ? "rgba(57,255,20,1.0)" : "rgba(56,189,248,0.50)"}
            filter="url(#productGlow)"
            style={{ transition: "fill 0.2s ease" }}
          />
          {/* Hlavný osemuholník */}
          <path
            d={OCTAGON_PATH}
            fill="url(#octGradProduct)"
            stroke={isActive ? "rgba(245,158,11,0.70)" : "rgba(245,158,11,0.35)"}
            strokeWidth="2"
            style={{ transition: "stroke 0.15s ease" }}
          />
        </svg>

        <div style={{
          position: "absolute",
          top: 38, left: 0, right: 0,
          height: 139,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
        }}>
          <div style={{ position: "relative", display: "inline-flex" }}>
            <span style={{
              fontSize: 38,
              lineHeight: 1,
              position: "relative",
              top: -6,
              filter: `sepia(1) saturate(8) hue-rotate(8deg) brightness(1.2) drop-shadow(0 0 8px rgba(255,191,0,${isActive ? 0.95 : 0.55}))`,
              transition: "filter 0.15s ease",
              display: "block",
            }}>🌀</span>
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
            Pridať produkt
          </span>
        </div>
      </button>
    </div>
  );
}
