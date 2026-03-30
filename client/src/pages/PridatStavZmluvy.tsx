import { useState } from "react";

function KokpitCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const isActive = hovered || pressed;

  return (
    <button
      type="button"
      data-testid="button-kokpit-card"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        outline: "none",
        userSelect: "none",
        transition: "transform 0.15s ease",
        transform: pressed ? "scale(0.96)" : hovered ? "scale(1.04)" : "scale(1)",
      }}
    >
      <svg
        width="180"
        height="180"
        viewBox="0 0 180 180"
        fill="none"
        style={{ overflow: "visible" }}
      >
        <defs>
          <filter id="kokpitGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="18" result="blur" />
          </filter>
          <filter id="kokpitGlow2" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="10" result="blur" />
          </filter>
          <radialGradient id="outerGrad" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#1e3a6e" />
            <stop offset="100%" stopColor="#0a1628" />
          </radialGradient>
          <radialGradient id="midGrad" cx="50%" cy="35%" r="60%">
            <stop offset="0%" stopColor="#162d58" />
            <stop offset="100%" stopColor="#070f1e" />
          </radialGradient>
          <radialGradient id="innerGrad" cx="50%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#0e2244" />
            <stop offset="100%" stopColor="#040a14" />
          </radialGradient>
        </defs>

        {/* Zelené podsvietenie — dvojvrstvové pre silnejší efekt */}
        <circle
          cx="90" cy="90" r="90"
          fill={isActive ? "rgba(57,255,20,1.0)" : "rgba(57,255,20,0.65)"}
          filter="url(#kokpitGlow)"
          style={{ transition: "fill 0.2s ease" }}
        />
        <circle
          cx="90" cy="90" r="84"
          fill={isActive ? "rgba(57,255,20,0.6)" : "rgba(56,189,248,0.30)"}
          filter="url(#kokpitGlow2)"
          style={{ transition: "fill 0.2s ease" }}
        />

        {/* Vonkajší kruh */}
        <circle
          cx="90" cy="90" r="82"
          fill="url(#outerGrad)"
          stroke={isActive ? "rgba(245,158,11,0.90)" : "rgba(245,158,11,0.55)"}
          strokeWidth="3.5"
          style={{ transition: "stroke 0.15s ease" }}
        />
        <circle cx="90" cy="90" r="82" fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="6" style={{ filter: "blur(3px)" }} />

        {/* Stredný kruh */}
        <circle
          cx="90" cy="90" r="60"
          fill="url(#midGrad)"
          stroke={isActive ? "rgba(245,158,11,0.80)" : "rgba(245,158,11,0.45)"}
          strokeWidth="3.5"
          style={{ transition: "stroke 0.15s ease" }}
        />
        <circle cx="90" cy="90" r="60" fill="none" stroke="rgba(0,0,0,0.50)" strokeWidth="5" style={{ filter: "blur(2.5px)" }} />

        {/* Vnútorný kruh */}
        <circle
          cx="90" cy="90" r="38"
          fill="url(#innerGrad)"
          stroke={isActive ? "rgba(245,158,11,0.85)" : "rgba(245,158,11,0.50)"}
          strokeWidth="3.5"
          style={{ transition: "stroke 0.15s ease" }}
        />
        <circle cx="90" cy="90" r="38" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="4" style={{ filter: "blur(2px)" }} />

        {/* KOKPIT text v strednom kruhu */}
        <text
          x="90"
          y="90"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="13"
          fontWeight="800"
          fontFamily="sans-serif"
          letterSpacing="3"
          fill="#b8d0f0"
          style={{
            filter: `drop-shadow(0 0 6px rgba(255,191,0,${isActive ? 0.95 : 0.50}))`,
            transition: "filter 0.15s ease",
          }}
        >
          KOKPIT
        </text>
      </svg>
    </button>
  );
}

export default function PridatStavZmluvy() {
  return (
    <div className="p-6 space-y-1">
      <h1 className="text-2xl font-bold">Spracovanie stavov</h1>
      <p className="text-sm text-muted-foreground">
        Centrálne miesto pre správu stavov zmlúv — všetko, čo príde ku akejkoľvek zmluve, sa tu bude dopĺňať a spracovávať.
      </p>
      <div className="flex items-center justify-center pt-8">
        <KokpitCard onClick={() => {}} />
      </div>
    </div>
  );
}
