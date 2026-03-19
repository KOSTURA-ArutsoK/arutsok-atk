import { useState } from "react";
import { Globe } from "lucide-react";

interface AddStateButtonProps {
  onClick: () => void;
}

export function AddStateButton({ onClick }: AddStateButtonProps) {
  const [pressed, setPressed] = useState(false);

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
          background: "linear-gradient(145deg, #232323, #3a3a3a)",
          boxShadow: pressed
            ? "inset 5px 5px 10px #151515, inset -3px -3px 8px #3e3e3e"
            : "10px 10px 20px #1a1a1a, -10px -10px 20px #3e3e3e",
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
              filter: "drop-shadow(0 0 6px rgba(255,191,0,0.45))",
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
            fontWeight: 500,
            color: "#b0b0b0",
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
