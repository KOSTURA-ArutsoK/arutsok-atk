import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export function DlpWatermark() {
  const { user } = useAuth();
  const [timestamp, setTimestamp] = useState(new Date().toLocaleString("sk-SK"));

  const { data: ipData } = useQuery<{ ip: string }>({
    queryKey: ["/api/dlp/user-ip"],
    enabled: !!user,
    refetchInterval: 300000,
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(new Date().toLocaleString("sk-SK"));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const { data: appUser } = useQuery<{ id: number; username: string }>({
    queryKey: ["/api/app-user/me"],
    enabled: !!user,
  });

  if (!appUser) return null;

  const watermarkText = `UID-${appUser.id} | ${ipData?.ip || "..."} | ${timestamp}`;

  return (
    <div
      data-testid="dlp-watermark"
      className="pointer-events-none fixed inset-0 overflow-hidden select-none"
      style={{ zIndex: 40, opacity: 0.04 }}
      aria-hidden="true"
    >
      <div
        className="absolute"
        style={{
          top: "-50%",
          left: "-50%",
          width: "200%",
          height: "200%",
          transform: "rotate(-30deg)",
        }}
      >
        {Array.from({ length: 30 }).map((_, rowIdx) => (
          <div key={rowIdx} className="flex whitespace-nowrap" style={{ marginBottom: "120px" }}>
            {Array.from({ length: 8 }).map((_, colIdx) => (
              <span
                key={colIdx}
                className="text-foreground font-mono text-xs tracking-wider"
                style={{ marginRight: "80px" }}
              >
                {watermarkText}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
