import { useEffect, useRef, useState } from "react";
import { Loader2, FileText } from "lucide-react";

function ensurePromiseTry() {
  if (typeof (Promise as unknown as Record<string, unknown>).try !== "function") {
    (Promise as unknown as Record<string, unknown>).try = function <T>(fn: () => T | Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        try { resolve(fn() as T); } catch (e) { reject(e); }
      });
    };
  }
}

interface PdfCanvasProps {
  blobUrl: string;
  className?: string;
}

export function PdfCanvas({ blobUrl, className = "" }: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");

  useEffect(() => {
    if (!blobUrl) return;
    let cancelled = false;

    setStatus("loading");
    if (containerRef.current) containerRef.current.innerHTML = "";

    (async () => {
      try {
        ensurePromiseTry();
        const pdfjsLib = await import("pdfjs-dist");

        if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
        }

        const resp = await fetch(blobUrl);
        if (!resp.ok) throw new Error("fetch failed");
        const arrayBuf = await resp.arrayBuffer();
        if (cancelled) return;

        ensurePromiseTry();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuf }).promise;
        if (cancelled) return;

        const numPages = pdfDoc.numPages;
        const containerWidth = containerRef.current?.clientWidth ?? 600;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) return;

          const viewport = page.getViewport({ scale: 1 });
          const scale = Math.min(2, Math.max(0.5, (containerWidth || 600) / viewport.width));
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.style.cssText = "width:100%;height:auto;display:block;border-radius:4px;margin-bottom:6px;";
          canvas.setAttribute("data-testid", `pdf-canvas-page-${pageNum}`);

          if (!cancelled && containerRef.current) {
            containerRef.current.appendChild(canvas);
          }

          const ctx = canvas.getContext("2d");
          if (ctx && !cancelled) {
            await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
          }
        }

        if (!cancelled) setStatus("done");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [blobUrl]);

  return (
    <div className={`relative flex flex-col flex-1 min-h-0 w-full ${className}`}>
      {/* Canvas container — always in DOM so clientWidth is available and canvases can be appended */}
      <div
        ref={containerRef}
        style={{
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
          padding: "4px 0",
          visibility: status === "done" ? "visible" : "hidden",
          position: "absolute",
          inset: 0,
        }}
      />

      {/* Loading — shown as overlay while rendering */}
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground space-y-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-xs">Načítava PDF…</p>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground space-y-2">
          <FileText className="w-8 h-8 text-red-400" />
          <p className="text-xs">PDF sa nepodarilo načítať</p>
        </div>
      )}
    </div>
  );
}
