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
        bg: "#1a1a1a",
        border: "1px solid #2e2e2e",
        shadowRest: "0 2px 8px rgba(0,0,0,0.5)",
        shadowHover: "0 8px 24px rgba(0,0,0,0.7)",
        shadowPressed: "0 1px 4px rgba(0,0,0,0.6)",
        iconBg: "#262626",
        iconColor: "#9ca3af",
        plusColor: "#d1d5db",
        textColor: "#e5e7eb",
        subTextColor: "#6b7280",
      }
    : {
        bg: "#f0f2f5",
        border: "1px solid #d1d9e0",
        shadowRest: "0 2px 8px rgba(0,0,0,0.08)",
        shadowHover: "0 8px 24px rgba(0,0,0,0.15)",
        shadowPressed: "0 1px 4px rgba(0,0,0,0.12)",
        iconBg: "#e2e8f0",
        iconColor: "#64748b",
        plusColor: "#374151",
        textColor: "#1e293b",
        subTextColor: "#64748b",
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
        <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: 20,
              lineHeight: 1,
              color: theme.plusColor,
            }}
          >
            +
          </span>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              background: theme.iconBg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2
              style={{
                width: 28,
                height: 28,
                color: theme.iconColor,
              }}
            />
          </div>
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
