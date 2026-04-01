import { useEffect, useRef, useState } from "react";
import { Loader2, FileText } from "lucide-react";

function ensurePromiseTry() {
  if (typeof (Promise as unknown as Record<string, unknown>).try !== "function") {
    (Promise as unknown as Record<string, unknown>).try = function <T>(
      fn: () => T | Promise<T>
    ): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        try { resolve(fn() as T); } catch (e) { reject(e); }
      });
    };
  }
}

interface PdfCanvasProps {
  /** Original API URL — PdfCanvas fetches it directly with credentials */
  url: string;
  className?: string;
}

export function PdfCanvas({ url, className = "" }: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "error" | "done">("loading");

  useEffect(() => {
    if (!url) return;
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

        const resp = await fetch(url, { credentials: "include" });
        if (!resp.ok) throw new Error(`fetch failed: ${resp.status}`);
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

          const vp0 = page.getViewport({ scale: 1 });
          const scale = Math.min(2, Math.max(0.5, (containerWidth || 600) / vp0.width));
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.cssText =
            "width:100%;height:auto;display:block;border-radius:4px;margin-bottom:6px;";
          canvas.setAttribute("data-testid", `pdf-page-${pageNum}`);

          if (!cancelled && containerRef.current) {
            containerRef.current.appendChild(canvas);
          }

          const ctx = canvas.getContext("2d");
          if (ctx && !cancelled) {
            await page.render({ canvasContext: ctx, viewport }).promise;
          }
        }

        if (!cancelled) setStatus("done");
      } catch (err) {
        console.error("[PdfCanvas] error:", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [url]);

  return (
    <div className={`relative flex flex-col flex-1 min-h-0 w-full ${className}`}>
      {/* Canvas container — always in DOM so clientWidth is accessible */}
      <div
        ref={containerRef}
        style={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          padding: "4px 0",
          visibility: status === "done" ? "visible" : "hidden",
        }}
      />

      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground space-y-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          <p className="text-xs">Načítava PDF…</p>
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground space-y-2">
          <FileText className="w-8 h-8 text-red-400" />
          <p className="text-xs">PDF sa nepodarilo načítať</p>
        </div>
      )}
    </div>
  );
}
