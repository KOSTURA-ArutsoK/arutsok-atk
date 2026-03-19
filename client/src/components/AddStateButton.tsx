import { useState, useEffect } from "react";
import { Globe } from "lucide-react";

interface AddStateButtonProps {
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

export function AddStateButton({ onClick }: AddStateButtonProps) {
  const [pressed, setPressed] = useState(false);
  const isDark = useDarkMode();

  const theme = isDark
    ? {
        bg: "linear-gradient(145deg, #232323, #3a3a3a)",
        shadowRest: "10px 10px 20px #1a1a1a, -10px -10px 20px #3e3e3e",
        shadowPressed: "inset 5px 5px 10px #151515, inset -3px -3px 8px #3e3e3e",
        textColor: "#b0b0b0",
        globeOpacity: 0.45,
      }
    : {
        bg: "linear-gradient(145deg, #e2e2e2, #f8f8f8)",
        shadowRest: "10px 10px 20px #bebebe, -10px -10px 20px #ffffff",
        shadowPressed: "inset 5px 5px 10px #bebebe, inset -3px -3px 8px #ffffff",
        textColor: "#555555",
        globeOpacity: 0.55,
      };

  return (
    <div className="flex flex-col items-center justify-center w-full py-6">
      <button
        type="button"
        data-testid="button-add-state"
        onClick={onClick}
        onMouseDown={() => setPressed(true)}
        onMouseUp={() => setPressed(false)}
        onMouseLeave={() => setPressed(false)}
        onTouchStart={() => setPressed(true)}
        onTouchEnd={() => setPressed(false)}
        style={{
          width: 140,
          height: 140,
          borderRadius: "50%",
          background: theme.bg,
          boxShadow: pressed ? theme.shadowPressed : theme.shadowRest,
          border: "none",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "box-shadow 0.12s ease",
          outline: "none",
          userSelect: "none",
        }}
      >
        <div style={{ position: "relative", display: "inline-flex" }}>
          <Globe
            style={{
              width: 36,
              height: 36,
              color: "#3b9ede",
              filter: `drop-shadow(0 0 6px rgba(59,158,222,${theme.globeOpacity}))`,
            }}
          />
          <span
            style={{
              position: "absolute",
              top: -6,
              right: -8,
              fontWeight: 800,
              fontSize: 18,
              lineHeight: 1,
              color: "#3b9ede",
              filter: "drop-shadow(0 0 5px #3b9ede)",
            }}
          >
            +
          </span>
        </div>
        <span
          style={{
            fontFamily: "sans-serif",
            fontSize: 11,
            fontWeight: 500,
            color: theme.textColor,
            letterSpacing: "0.04em",
            textAlign: "center",
            lineHeight: 1.2,
          }}
        >
          Pridať Štát
        </span>
      </button>
    </div>
  );
}
