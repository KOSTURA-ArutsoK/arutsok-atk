import { UserPlus } from "lucide-react";

export default function Aaa() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2" data-testid="text-aaa-title">
        Pridať subjekt
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Toto okno slúži na registráciu nového subjektu.
      </p>

      <div className="flex justify-center">
        <button
          type="button"
          className="flex items-center h-[112px] rounded-2xl overflow-hidden cursor-pointer holding-chip focus:outline-none"
          style={{
            background: "hsl(222 15% 28%)",
            border: "1px solid rgba(255, 193, 7, 0.65)",
            boxShadow: "0 0 28px rgba(255, 193, 7, 0.22), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)"
          }}
          data-testid="button-pridat-subjekt"
        >
          <span
            className="flex items-center justify-center w-[104px] h-full flex-shrink-0"
            style={{ borderRight: "1px solid rgba(255, 193, 7, 0.35)" }}
          >
            <UserPlus className="w-11 h-11 text-amber-400 flex-shrink-0" />
          </span>
          <span className="px-6 text-lg font-semibold text-zinc-200 whitespace-nowrap">
            Pridať subjekt
          </span>
        </button>
      </div>
    </div>
  );
}
