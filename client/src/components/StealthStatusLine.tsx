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
        gap: "0.2vw",
        /* Height scales proportionally with viewport width */
        height: "clamp(2px, 0.35vw, 7px)",
      }}
    >
      {segments.map((active, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: "100%",
            borderRadius: "1px",
            backgroundColor: active ? "#10b981" : "#374151",
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
