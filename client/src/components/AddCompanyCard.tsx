import { useState, useEffect } from "react";
import { Building2 } from "lucide-react";

interface AddCompanyCardProps {
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

export function AddCompanyCard({ onClick }: AddCompanyCardProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const isDark = useDarkMode();

  const theme = isDark
    ? {
        bg: "linear-gradient(145deg, #0a1f3d, #1a3f80)",
        shadowRest: "10px 10px 20px #060f20, -10px -10px 20px #204898",
        shadowActive: "inset 5px 5px 10px #060f20, inset -3px -3px 8px #204898",
        textColor: "#b8d0f0",
        globeOpacity: 0.65,
      }
    : {
        bg: "linear-gradient(145deg, #aac8e8, #d8eafa)",
        shadowRest: "10px 10px 20px #88a8cc, -10px -10px 20px #ffffff",
        shadowActive: "inset 5px 5px 10px #88a8cc, inset -3px -3px 8px #ffffff",
        textColor: "#1a3f70",
        globeOpacity: 0.6,
      };

  const isActive = hovered || pressed;

  return (
    <div className="flex items-center justify-center w-full py-4">
      <button
        type="button"
        data-testid="button-add-company-card"
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => { setHovered(false); setPressed(false); }}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={{
          width: 160,
          minHeight: 120,
          background: theme.bg,
          border: "none",
          borderRadius: 14,
          boxShadow: isActive ? theme.shadowActive : theme.shadowRest,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "20px 16px 18px",
          transition: "box-shadow 0.12s ease",
          outline: "none",
          userSelect: "none",
        }}
      >
        <div style={{ position: "relative", display: "inline-flex" }}>
          <Building2
            style={{
              width: 36,
              height: 36,
              color: "#FFBF00",
              filter: `drop-shadow(0 0 6px rgba(255,191,0,${theme.globeOpacity}))`,
            }}
          />
          <span
            style={{
              position: "absolute",
              top: -6,
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
            fontSize: 11,
            fontWeight: 800,
            color: theme.textColor,
            letterSpacing: "0.04em",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          Pridať spoločnosť
        </span>
      </button>
    </div>
  );
}
