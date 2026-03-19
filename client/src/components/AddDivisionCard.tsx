import { useState, useEffect } from "react";

interface AddDivisionCardProps {
  onClick: () => void;
}

function useDarkMode() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark")
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains("dark"));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

// Equilateral triangle: P1=(80,6) top, P2=(6,134) bottom-left, P3=(154,134) bottom-right
// Quadratic bezier corners with tangent distance t=25 for smooth rounded vertices
// M 92,28 → L 141,112 → Q P3 → L 31,134 → Q P2 → L 68,28 → Q P1 → Z
const TRIANGLE_PATH = "M 92,28 L 141,112 Q 154,134 129,134 L 31,134 Q 6,134 19,112 L 68,28 Q 80,6 92,28 Z";

export function AddDivisionCard({ onClick }: AddDivisionCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isDark = useDarkMode();

  const isActive = hovered || pressed;

  const theme = isDark
    ? {
        gradFrom: isActive ? "#061225" : "#0a1f3d",
        gradTo: isActive ? "#112860" : "#1a3f80",
        shadowRest: "drop-shadow(6px 6px 12px #060f20) drop-shadow(-4px -4px 10px #204898)",
        shadowActive: "drop-shadow(1px 1px 3px #060f20)",
        textColor: "#b8d0f0",
        emojiOpacity: 0.8,
      }
    : {
        gradFrom: isActive ? "#88a8cc" : "#aac8e8",
        gradTo: isActive ? "#b0cee8" : "#d8eafa",
        shadowRest: "drop-shadow(6px 6px 12px #88a8cc) drop-shadow(-4px -4px 10px #ffffff)",
        shadowActive: "drop-shadow(1px 1px 3px #88a8cc)",
        textColor: "#1a3f70",
        emojiOpacity: 0.7,
      };

  return (
    <div className="flex flex-col items-center justify-center w-full py-4">
      <div
        role="button"
        tabIndex={0}
        aria-label="Pridať divíziu"
        data-testid="button-add-division-card"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
        style={{
          position: "relative",
          width: 160,
          height: 140,
          cursor: "pointer",
          userSelect: "none",
          outline: "none",
          filter: isActive ? theme.shadowActive : theme.shadowRest,
          transform: isActive ? "scale(0.95)" : "scale(1)",
          transition: "filter 0.12s ease, transform 0.12s ease",
        }}
      >
        <svg
          width="160"
          height="140"
          viewBox="0 0 160 140"
          style={{ position: "absolute", top: 0, left: 0, display: "block" }}
        >
          <defs>
            <linearGradient id="addDivGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={theme.gradFrom} />
              <stop offset="100%" stopColor={theme.gradTo} />
            </linearGradient>
          </defs>
          <path d={TRIANGLE_PATH} fill="url(#addDivGrad)" />
        </svg>

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            paddingTop: 30,
            gap: 6,
          }}
        >
          <div style={{ position: "relative", display: "inline-flex" }}>
            <span
              style={{
                fontSize: 30,
                lineHeight: 1,
                filter: `drop-shadow(0 0 8px rgba(255,191,0,${theme.emojiOpacity}))`,
              }}
            >
              🌲
            </span>
            <span
              style={{
                position: "absolute",
                top: -8,
                right: -10,
                fontWeight: 800,
                fontSize: 18,
                lineHeight: 1,
                color: "#FFBF00",
                filter: "drop-shadow(0 0 5px #FFBF00)",
              }}
            >
              +
            </span>
          </div>
          <span
            style={{
              fontFamily: "sans-serif",
              fontSize: 10,
              fontWeight: 800,
              color: theme.textColor,
              letterSpacing: "0.04em",
              textAlign: "center",
              lineHeight: 1.2,
            }}
          >
            Pridať divíziu
          </span>
        </div>
      </div>
    </div>
  );
}
