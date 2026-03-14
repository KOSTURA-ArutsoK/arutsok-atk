import { Globe } from "lucide-react";

export default function DigitalneZmluvy() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-900/20 border border-blue-800/40">
        <Globe className="w-8 h-8 text-blue-700 dark:text-blue-400" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Digitálne zmluvy</h1>
      <p className="text-muted-foreground text-sm max-w-md">
        Modul pre správu zmlúv zadávaných cez API prepojenia s partnermi. Pripojenia sa konfigurujú v nastaveniach.
      </p>
      <div className="flex items-center gap-2 px-4 py-2 rounded border border-blue-800/40 bg-blue-900/10 text-blue-700 dark:text-blue-400 text-sm font-medium">
        <Globe className="w-4 h-4" />
        <span>Modul v príprave</span>
      </div>
    </div>
  );
}
