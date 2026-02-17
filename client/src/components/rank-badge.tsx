import type { CircleConfig } from "@shared/schema";

interface RankBadgeProps {
  positionName?: string;
  frameType?: string;
  circleConfig?: CircleConfig[];
  compact?: boolean;
}

const RECT_WIDTH = 60;
const RECT_WIDTH_COMPACT = 48;
const RECT_HEIGHT = 20;
const RECT_HEIGHT_COMPACT = 16;

export function RankBadge({ positionName, frameType = "none", circleConfig, compact = false }: RankBadgeProps) {
  const visibleCircles = (circleConfig || []).filter(c => c.visible);

  if (visibleCircles.length === 0 && frameType === "none") {
    return (
      <div className="text-xs text-muted-foreground" data-testid="rank-badge-empty">
        —
      </div>
    );
  }

  const rectW = compact ? RECT_WIDTH_COMPACT : RECT_WIDTH;
  const rectH = compact ? RECT_HEIGHT_COMPACT : RECT_HEIGHT;
  const containerW = rectW + (frameType === "double" ? 12 : 0);

  const count = visibleCircles.length;
  const gap = 3;
  const availableW = rectW - 8;
  const maxCircleD = count > 0 ? Math.min(compact ? 10 : 12, Math.floor((availableW - gap * (count - 1)) / count)) : 0;
  const circleD = Math.max(6, maxCircleD);

  const circles = (
    <div className="flex items-center justify-center" style={{ gap }} data-testid="rank-circles">
      {visibleCircles.map((circle, i) => (
        <div
          key={i}
          className={`rounded-full flex-shrink-0 ${circle.filled ? 'bg-primary border-primary' : 'bg-transparent border-primary/50'}`}
          style={{ width: circleD, height: circleD, borderWidth: 2 }}
          data-testid={`rank-circle-${i}`}
        />
      ))}
    </div>
  );

  const framedCircles = frameType === "double" ? (
    <div
      className="border border-primary/40 rounded-sm flex items-center justify-center"
      style={{ width: containerW, height: rectH + 12 }}
      data-testid="rank-frame-outer"
    >
      <div
        className="border border-primary/60 rounded-sm flex items-center justify-center overflow-hidden"
        style={{ width: rectW, height: rectH }}
        data-testid="rank-frame-inner"
      >
        {circles}
      </div>
    </div>
  ) : frameType === "single" ? (
    <div
      className="border border-primary/50 rounded-sm flex items-center justify-center overflow-hidden"
      style={{ width: rectW, height: rectH }}
      data-testid="rank-frame"
    >
      {circles}
    </div>
  ) : (
    <div className="flex items-center justify-center overflow-hidden" style={{ width: rectW, height: rectH }}>
      {circles}
    </div>
  );

  return (
    <div className="flex items-center justify-center" style={{ minWidth: containerW }} data-testid="rank-badge">
      {framedCircles}
    </div>
  );
}
