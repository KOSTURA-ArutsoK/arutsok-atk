import { useEffect, useRef, useState } from "react";
import { Loader2, FileText } from "lucide-react";

interface PdfCanvasProps {
  blobUrl: string;
  className?: string;
}

export function PdfCanvas({ blobUrl, className = "" }: PdfCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  useEffect(() => {
    if (!blobUrl) return;
    let cancelled = false;

    setLoading(true);
    setError(false);
    setPageCount(0);
    canvasRefs.current = [];

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const pdfDoc = await pdfjsLib.getDocument(blobUrl).promise;
        if (cancelled) return;

        const numPages = pdfDoc.numPages;
        setPageCount(numPages);

        if (cancelled) return;
        setLoading(false);

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(pageNum);
          if (cancelled) return;

          const containerWidth = containerRef.current?.clientWidth ?? 600;
          const viewport = page.getViewport({ scale: 1 });
          const scale = Math.min(2, containerWidth / viewport.width);
          const scaledViewport = page.getViewport({ scale });

          const canvas = canvasRefs.current[pageNum - 1];
          if (!canvas) continue;

          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.style.width = "100%";
          canvas.style.height = "auto";

          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [blobUrl]);

  if (loading) {
    return (
      <div className={`flex flex-col flex-1 items-center justify-center text-muted-foreground space-y-2 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs">Načítava PDF…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col flex-1 items-center justify-center text-muted-foreground space-y-2 ${className}`}>
        <FileText className="w-8 h-8 text-red-400" />
        <p className="text-xs">PDF sa nepodarilo načítať</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`flex flex-col gap-2 overflow-y-auto w-full flex-1 min-h-0 ${className}`}
      style={{ padding: "4px 0" }}
    >
      {Array.from({ length: pageCount }, (_, i) => (
        <canvas
          key={i}
          ref={el => { canvasRefs.current[i] = el; }}
          data-testid={`pdf-canvas-page-${i + 1}`}
          style={{ display: "block", width: "100%", height: "auto", borderRadius: 4 }}
        />
      ))}
    </div>
  );
}
