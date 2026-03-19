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
        outerFilter: "drop-shadow(8px 8px 16px #060f20) drop-shadow(-5px -5px 12px #204898)",
        inner1Color: "#060f20",
        inner2Color: "#204898",
        inner2Opacity: "0.9",
        textColor: "#b8d0f0",
      }
    : {
        gradFrom: isActive ? "#88a8cc" : "#aac8e8",
        gradTo: isActive ? "#b0cee8" : "#d8eafa",
        outerFilter: "drop-shadow(8px 8px 14px #88a8cc) drop-shadow(-5px -5px 12px #ffffff)",
        inner1Color: "#88a8cc",
        inner2Color: "#ffffff",
        inner2Opacity: "0.85",
        textColor: "#1a3f70",
      };

  return (
    <div className="flex flex-col items-center justify-center w-full py-4">
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
          width: 160,
          height: 140,
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          outline: "none",
          userSelect: "none",
          filter: isActive ? undefined : theme.outerFilter,
          transition: "filter 0.12s ease",
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
            <filter id="addDivInner" x="-20%" y="-20%" width="140%" height="140%">
              <feFlood floodColor={theme.inner1Color} floodOpacity="1" result="s1color" />
              <feComposite in="s1color" in2="SourceAlpha" operator="out" result="s1inv" />
              <feGaussianBlur in="s1inv" stdDeviation="5" result="s1blur" />
              <feOffset in="s1blur" dx="5" dy="5" result="s1off" />
              <feComposite in="s1off" in2="SourceAlpha" operator="in" result="s1inner" />
              <feFlood floodColor={theme.inner2Color} floodOpacity={theme.inner2Opacity} result="s2color" />
              <feComposite in="s2color" in2="SourceAlpha" operator="out" result="s2inv" />
              <feGaussianBlur in="s2inv" stdDeviation="4" result="s2blur" />
              <feOffset in="s2blur" dx="-3" dy="-3" result="s2off" />
              <feComposite in="s2off" in2="SourceAlpha" operator="in" result="s2inner" />
              <feMerge>
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="s1inner" />
                <feMergeNode in="s2inner" />
              </feMerge>
            </filter>
          </defs>
          <path
            d={TRIANGLE_PATH}
            fill="url(#addDivGrad)"
            filter={isActive ? "url(#addDivInner)" : undefined}
          />
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
            <span style={{ fontSize: 30, lineHeight: 1, filter: "sepia(1) saturate(6) hue-rotate(8deg) brightness(1.15) drop-shadow(0 0 6px #FFBF00)" }}>
              🌲
            </span>
            <span
              style={{
                position: "absolute",
                top: -4,
                right: -2,
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
      </button>
    </div>
  );
}
