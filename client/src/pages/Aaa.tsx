import { UserPlus } from "lucide-react";

export default function Aaa() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2" data-testid="text-aaa-title">
        Pridať subjekt
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Toto okno slúži na registráciu nového subjektu — fyzickej osoby, živnostníka alebo právnickej osoby — do systému ArutsoK.
      </p>

      <button
        type="button"
        className="flex items-center h-7 rounded-full overflow-hidden focus:outline-none"
        style={{
          background: "hsl(222 15% 28%)",
          border: "1px solid hsl(222 12% 36%)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06), 0 0 10px rgba(99,120,180,0.15)"
        }}
        data-testid="button-pridat-subjekt"
      >
        <span
          className="flex items-center justify-center gap-0.5 px-2.5 h-full"
          style={{ borderRight: "1px solid hsl(222 12% 36%)" }}
        >
          <UserPlus className="w-3.5 h-3.5 text-zinc-300 flex-shrink-0" />
        </span>
        <span className="px-2.5 text-[11px] font-medium text-zinc-200">
          Pridať subjekt
        </span>
      </button>
    </div>
  );
}
