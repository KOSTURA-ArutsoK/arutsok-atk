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
        bg: "linear-gradient(145deg, #0e2a4a, #1c4278)",
        shadowRest: "10px 10px 20px #091d35, -10px -10px 20px #1e4a8e",
        shadowPressed: "inset 5px 5px 10px #091d35, inset -3px -3px 8px #1e4a8e",
        textColor: "#a0bcd8",
        globeOpacity: 0.6,
      }
    : {
        bg: "linear-gradient(145deg, #c8d8ed, #e8f2fc)",
        shadowRest: "10px 10px 20px #a5b8d0, -10px -10px 20px #ffffff",
        shadowPressed: "inset 5px 5px 10px #a5b8d0, inset -3px -3px 8px #ffffff",
        textColor: "#2a5080",
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
              color: "#FFBF00",
              filter: `drop-shadow(0 0 6px rgba(255,191,0,${theme.globeOpacity}))`,
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
            fontWeight: 700,
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
