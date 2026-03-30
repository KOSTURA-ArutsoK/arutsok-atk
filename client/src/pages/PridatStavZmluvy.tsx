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
          <filter id="kokpitGlow1" x="-90%" y="-90%" width="280%" height="280%">
            <feGaussianBlur stdDeviation="22" result="blur" />
          </filter>
          <filter id="kokpitGlow2" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="12" result="blur" />
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

        {/* Zelené podsvietenie — dvojvrstvové, silné aj v pokoji */}
        <circle
          cx="90" cy="90" r="95"
          fill={isActive ? "rgba(57,255,20,1.0)" : "rgba(57,255,20,1.0)"}
          filter="url(#kokpitGlow1)"
          style={{ transition: "opacity 0.2s ease", opacity: isActive ? 1 : 0.85 }}
        />
        <circle
          cx="90" cy="90" r="85"
          fill="rgba(57,255,20,0.7)"
          filter="url(#kokpitGlow2)"
          style={{ transition: "opacity 0.2s ease", opacity: isActive ? 1 : 0.75 }}
        />

        {/* Vonkajší kruh — strokeWidth 2.5 */}
        <circle
          cx="90" cy="90" r="82"
          fill="url(#outerGrad)"
          stroke={isActive ? "rgba(245,158,11,0.95)" : "rgba(245,158,11,0.65)"}
          strokeWidth="2.5"
          style={{ transition: "stroke 0.15s ease" }}
        />
        <circle cx="90" cy="90" r="82" fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="6" style={{ filter: "blur(3px)" }} />

        {/* Stredný kruh — strokeWidth 2 */}
        <circle
          cx="90" cy="90" r="60"
          fill="url(#midGrad)"
          stroke={isActive ? "rgba(245,158,11,0.90)" : "rgba(245,158,11,0.55)"}
          strokeWidth="2"
          style={{ transition: "stroke 0.15s ease" }}
        />
        <circle cx="90" cy="90" r="60" fill="none" stroke="rgba(0,0,0,0.50)" strokeWidth="5" style={{ filter: "blur(2.5px)" }} />

        {/* Vnútorný kruh — strokeWidth 2 */}
        <circle
          cx="90" cy="90" r="38"
          fill="url(#innerGrad)"
          stroke={isActive ? "rgba(245,158,11,0.90)" : "rgba(245,158,11,0.55)"}
          strokeWidth="2"
          style={{ transition: "stroke 0.15s ease" }}
        />
        <circle cx="90" cy="90" r="38" fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="4" style={{ filter: "blur(2px)" }} />

        {/* KOKPIT text — vycentrovaný v strednom kruhu (r=60), fontSize malý aby nepresahoval */}
        <text
          x="90"
          y="90"
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="10.5"
          fontWeight="800"
          fontFamily="sans-serif"
          letterSpacing="2.5"
          fill="#b8d0f0"
          style={{
            filter: `drop-shadow(0 0 5px rgba(255,191,0,${isActive ? 0.95 : 0.55}))`,
            transition: "filter 0.15s ease",
          }}
        >
          KOKPIT
        </text>
      </svg>
    </button>
  );
}

const AKTIVITA_ITEMS = [
  { id: 1, nazov: "Pridávanie stavov ku zmluvám" },
  { id: 2, nazov: "Výpovede od klientov" },
  { id: 3, nazov: "Požiadavky ku klientom" },
  { id: 4, nazov: "Upomienky" },
];

export default function PridatStavZmluvy() {
  return (
    <div className="p-6 space-y-1">
      <h1 className="text-2xl font-bold">Spracovanie stavov</h1>
      <p className="text-sm text-muted-foreground">
        Centrálne miesto pre správu stavov zmlúv — všetko, čo príde ku akejkoľvek zmluve, sa tu bude dopĺňať a spracovávať.
      </p>

      <div className="flex items-start gap-10 pt-6">
        {/* Ľavý stĺpec — tlačidlo */}
        <div className="flex flex-col items-center gap-0 shrink-0">
          <KokpitCard onClick={() => {}} />
        </div>

        {/* Pravý stĺpec — tabuľka aktivít */}
        <div className="flex-1 pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Dnešné aktivity
          </p>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 font-semibold text-foreground">#</th>
                <th className="text-left py-2 px-3 font-semibold text-foreground">Aktivita</th>
              </tr>
            </thead>
            <tbody>
              {AKTIVITA_ITEMS.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border/50 hover:bg-muted/40 transition-colors"
                  data-testid={`row-aktivita-${item.id}`}
                >
                  <td className="py-2 px-3 text-muted-foreground">{item.id}</td>
                  <td className="py-2 px-3">{item.nazov}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
