interface TripleRingStatusProps {
  phase?: 1 | 2 | 3;
  size?: number;
  pulsing?: boolean;
  color?: string;
}

const PHASE_COLORS: Record<1 | 2 | 3, { ring: string; glow: string; label: string }> = {
  1: { ring: "#1e40af", glow: "rgba(30,64,175,0.7)", label: "Príchod" },
  2: { ring: "#7c3aed", glow: "rgba(124,58,237,0.7)", label: "Rozdelenie" },
  3: { ring: "#059669", glow: "rgba(5,150,105,0.7)", label: "Vybavené" },
};

export function TripleRingStatus({ phase, size = 24, pulsing = false, color }: TripleRingStatusProps) {
  const cfg = phase ? PHASE_COLORS[phase] : { ring: color ?? "#dc2626", glow: `${color ?? "#dc2626"}b3`, label: "" };
  const cx = size / 2;
  const r1 = size * 0.46;
  const r2 = size * 0.33;
  const r3 = size * 0.20;
  const sw = size * 0.06;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      style={{
        display: "inline-block",
        flexShrink: 0,
        animation: pulsing ? "kokpitPulse 1.4s ease-in-out infinite" : undefined,
        filter: pulsing ? `drop-shadow(0 0 ${size * 0.2}px ${cfg.glow})` : undefined,
      }}
    >
      <style>{`
        @keyframes kokpitPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
      `}</style>
      <circle
        cx={cx} cy={cx} r={r1}
        stroke={cfg.ring}
        strokeWidth={sw}
        fill="none"
        opacity={0.35}
      />
      <circle
        cx={cx} cy={cx} r={r2}
        stroke={cfg.ring}
        strokeWidth={sw}
        fill="none"
        opacity={0.65}
      />
      <circle
        cx={cx} cy={cx} r={r3}
        stroke={cfg.ring}
        strokeWidth={sw}
        fill={cfg.ring}
        opacity={1}
      />
    </svg>
  );
}

export function TripleRingLabel({ phase }: { phase: 1 | 2 | 3 }) {
  return (
    <span style={{ color: PHASE_COLORS[phase].ring, fontWeight: 600, fontSize: 12 }}>
      {PHASE_COLORS[phase].label}
    </span>
  );
}
