import { useState, useEffect, useCallback, useRef } from "react";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Pen, Camera } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LightboxImage {
  id: number;
  src: string;
  label: string;
  fileType?: string;
  source?: string;
  isActive?: boolean;
  validFrom?: string | null;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

function fileTypeLabel(ft?: string) {
  switch (ft) {
    case "profile": return "Profilová fotka";
    case "signature": return "Podpis";
    case "id_scan": return "Sken dokladu";
    case "other": return "Iné";
    default: return "Fotka";
  }
}

function fileTypeIcon(ft?: string) {
  switch (ft) {
    case "signature": return Pen;
    case "profile": return Camera;
    default: return Camera;
  }
}

export function ImageLightbox({ images, initialIndex = 0, open, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  useEffect(() => {
    if (open) {
      setZoom(1);
      setRotation(0);
      setTranslate({ x: 0, y: 0 });
    }
  }, [open, currentIndex]);

  const goNext = useCallback(() => {
    if (images.length > 1) {
      setCurrentIndex(prev => (prev + 1) % images.length);
      setZoom(1);
      setRotation(0);
      setTranslate({ x: 0, y: 0 });
    }
  }, [images.length]);

  const goPrev = useCallback(() => {
    if (images.length > 1) {
      setCurrentIndex(prev => (prev - 1 + images.length) % images.length);
      setZoom(1);
      setRotation(0);
      setTranslate({ x: 0, y: 0 });
    }
  }, [images.length]);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(prev + 0.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => {
      const next = Math.max(prev - 0.5, 1);
      if (next === 1) setTranslate({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleRotate = useCallback(() => {
    setRotation(prev => (prev + 90) % 360);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goPrev();
          break;
        case "ArrowRight":
          goNext();
          break;
        case "+":
        case "=":
          handleZoomIn();
          break;
        case "-":
          handleZoomOut();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose, goNext, goPrev, handleZoomIn, handleZoomOut]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX - translate.x, y: e.clientY - translate.y });
    }
  }, [zoom, translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setTranslate({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (zoom <= 1 && e.touches.length === 1) {
      setTouchStartX(e.touches[0].clientX);
    }
  }, [zoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX !== null && zoom <= 1) {
      const diff = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(diff) > 60) {
        if (diff > 0) goPrev();
        else goNext();
      }
    }
    setTouchStartX(null);
  }, [touchStartX, zoom, goNext, goPrev]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoom(prev => Math.min(prev + 0.25, 5));
    } else {
      setZoom(prev => {
        const next = Math.max(prev - 0.25, 1);
        if (next === 1) setTranslate({ x: 0, y: 0 });
        return next;
      });
    }
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      onClose();
    }
  }, [onClose]);

  if (!open || images.length === 0) return null;

  const current = images[currentIndex];
  const FtIcon = fileTypeIcon(current?.fileType);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      data-testid="lightbox-overlay"
    >
      <div className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <FtIcon className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-medium text-zinc-200">{fileTypeLabel(current?.fileType)}</span>
          {current?.isActive && (
            <Badge className="text-[10px] bg-green-800/60 text-green-300 border-green-700">Aktívna</Badge>
          )}
          {images.length > 1 && (
            <span className="text-xs text-zinc-500 ml-2">{currentIndex + 1} / {images.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            data-testid="lightbox-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-zinc-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            data-testid="lightbox-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={handleRotate}
            data-testid="lightbox-rotate"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          <div className="w-px h-5 bg-zinc-700 mx-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800"
            onClick={onClose}
            data-testid="lightbox-close"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden select-none"
        onClick={handleBackdropClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{ cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
      >
        {images.length > 1 && (
          <>
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-zinc-700 flex items-center justify-center text-white transition-all hover:scale-110"
              onClick={(e) => { e.stopPropagation(); goPrev(); }}
              data-testid="lightbox-prev"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 border border-zinc-700 flex items-center justify-center text-white transition-all hover:scale-110"
              onClick={(e) => { e.stopPropagation(); goNext(); }}
              data-testid="lightbox-next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        <img
          ref={imageRef}
          src={current?.src}
          alt={current?.label || ""}
          className="max-w-[90vw] max-h-[80vh] object-contain transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg) translate(${translate.x / zoom}px, ${translate.y / zoom}px)`,
          }}
          draggable={false}
          data-testid="lightbox-image"
        />
      </div>

      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2 py-3 bg-black/60 backdrop-blur-sm border-t border-zinc-800/50">
          {images.map((img, idx) => {
            const Icon = fileTypeIcon(img.fileType);
            return (
              <button
                key={img.id}
                className={`relative w-14 h-14 rounded border-2 overflow-hidden transition-all ${
                  idx === currentIndex
                    ? "border-blue-500 ring-1 ring-blue-500/50 scale-110"
                    : "border-zinc-700 hover:border-zinc-500 opacity-70 hover:opacity-100"
                }`}
                onClick={() => {
                  setCurrentIndex(idx);
                  setZoom(1);
                  setRotation(0);
                  setTranslate({ x: 0, y: 0 });
                }}
                data-testid={`lightbox-thumbnail-${idx}`}
              >
                <img src={img.src} alt="" className="w-full h-full object-cover" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 flex items-center justify-center py-0.5">
                  <Icon className="w-2.5 h-2.5 text-zinc-300" />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
