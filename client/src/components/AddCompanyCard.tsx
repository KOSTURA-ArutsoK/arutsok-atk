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
        border: "1px solid #1e3a6e",
        shadowRest: "0 4px 12px rgba(0,0,0,0.6)",
        shadowHover: "0 10px 28px rgba(0,20,60,0.8)",
        shadowPressed: "0 1px 6px rgba(0,0,0,0.7)",
        textColor: "#b8d0f0",
      }
    : {
        bg: "linear-gradient(145deg, #aac8e8, #d8eafa)",
        border: "1px solid #88a8cc",
        shadowRest: "0 4px 12px rgba(100,140,200,0.25)",
        shadowHover: "0 10px 28px rgba(80,120,180,0.35)",
        shadowPressed: "0 1px 6px rgba(80,120,180,0.2)",
        textColor: "#1a3f70",
      };

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
          background: theme.bg,
          border: theme.border,
          borderRadius: 12,
          boxShadow: pressed ? theme.shadowPressed : hovered ? theme.shadowHover : theme.shadowRest,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "20px 16px 18px",
          transition: "box-shadow 0.18s ease, transform 0.18s ease",
          transform: pressed ? "translateY(1px)" : hovered ? "translateY(-4px)" : "translateY(0)",
          outline: "none",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span
            style={{
              fontWeight: 900,
              fontSize: 20,
              lineHeight: 1,
              color: "#FFBF00",
              filter: "drop-shadow(0 0 5px #FFBF00)",
            }}
          >
            +
          </span>
          <Building2
            style={{
              width: 34,
              height: 34,
              color: "#FFBF00",
              filter: "drop-shadow(0 0 6px rgba(255,191,0,0.55))",
            }}
          />
        </div>
        <span
          style={{
            fontFamily: "sans-serif",
            fontSize: 12,
            fontWeight: 800,
            color: theme.textColor,
            letterSpacing: "0.02em",
            textAlign: "center",
            lineHeight: 1.3,
          }}
        >
          Pridať spoločnosť
        </span>
      </button>
    </div>
  );
}
