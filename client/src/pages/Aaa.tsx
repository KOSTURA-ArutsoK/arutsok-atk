import { Layers } from "lucide-react";

export default function Aaa() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4" data-testid="text-aaa-title">aaa</h1>

      <button
        type="button"
        className="flex items-center gap-1.5 px-2.5 h-7 rounded-full"
        style={{
          background: "hsl(222 15% 28%)",
          border: "1px solid hsl(222 12% 36%)",
          boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)"
        }}
        data-testid="button-aaa-division-pill"
      >
        <Layers className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
        <span className="text-[11px] font-medium text-zinc-200">Divízia</span>
      </button>
    </div>
  );
}
