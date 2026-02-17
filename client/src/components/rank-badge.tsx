import type { CircleConfig } from "@shared/schema";

interface RankBadgeProps {
  positionName?: string;
  frameType?: string;
  circleConfig?: CircleConfig[];
  compact?: boolean;
}

export function RankBadge({ positionName, frameType = "none", circleConfig, compact = false }: RankBadgeProps) {
  const visibleCircles = (circleConfig || []).filter(c => c.visible);

  if (visibleCircles.length === 0 && !positionName) {
    return (
      <div className="text-xs text-muted-foreground" data-testid="rank-badge-empty">
        Nepriradena
      </div>
    );
  }

  const circles = (
    <div className="flex items-center gap-1" data-testid="rank-circles">
      {visibleCircles.map((circle, i) => (
        <div
          key={i}
          className={`rounded-full border-2 ${compact ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${circle.filled ? 'bg-primary border-primary' : 'bg-transparent border-primary/50'}`}
          data-testid={`rank-circle-${i}`}
        />
      ))}
    </div>
  );

  const framedCircles = frameType === "double" ? (
    <div className="border border-primary/40 rounded-sm p-0.5" data-testid="rank-frame-outer">
      <div className="border border-primary/60 rounded-sm px-1.5 py-1" data-testid="rank-frame-inner">
        {circles}
      </div>
    </div>
  ) : frameType === "single" ? (
    <div className="border border-primary/50 rounded-sm px-1.5 py-1" data-testid="rank-frame">
      {circles}
    </div>
  ) : circles;

  return (
    <div className="flex flex-col gap-1" data-testid="rank-badge">
      {framedCircles}
    </div>
  );
}
