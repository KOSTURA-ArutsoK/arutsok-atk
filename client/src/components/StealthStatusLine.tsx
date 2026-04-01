import { useQuery } from "@tanstack/react-query";

type PipelineStatus = { segments: boolean[] };

export function StealthStatusLine() {
  const { data } = useQuery<PipelineStatus>({
    queryKey: ["/api/pipeline-status"],
    staleTime: 120_000,
    refetchInterval: 120_000,
  });

  const segments: boolean[] = data?.segments ?? [false, false, false, false, false];

  return (
    <div
      aria-hidden="true"
      style={{
        display: "flex",
        width: "100%",
        gap: "3px",
        height: "2px",
        padding: "0 2px",
        boxSizing: "border-box",
      }}
    >
      {segments.map((active, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: "2px",
            borderRadius: "1px",
            backgroundColor: active ? "#10b981" : "#374151",
            /* Light-mode drop-shadow applied to all segments; dark-mode
               emerald glow applied only to active segments via CSS var */
            filter: "var(--stealth-segment-filter, none)",
            boxShadow: active
              ? "var(--stealth-segment-glow, none)"
              : undefined,
          }}
        />
      ))}
    </div>
  );
}
