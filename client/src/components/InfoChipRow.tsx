import {
  Sun, Cloud, CloudDrizzle, CloudRain, CloudSnow, Zap,
  CalendarDays, Star, Thermometer, Server, User, FileCheck,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export type InfoChipVariant = "backoffice" | "client";

export interface InfoChip {
  icon: LucideIcon;
  label?: string;
  value: string;
  testId?: string;
}

interface InfoChipRowProps {
  variant: InfoChipVariant;
  chips: InfoChip[];
}

const WEATHER_ICONS: Record<string, LucideIcon> = {
  "sun": Sun,
  "cloud": Cloud,
  "cloud-drizzle": CloudDrizzle,
  "cloud-rain": CloudRain,
  "cloud-snow": CloudSnow,
  "zap": Zap,
};

export function getWeatherLucideIcon(key: string): LucideIcon {
  return WEATHER_ICONS[key] ?? Cloud;
}

export function InfoChipRow({ variant, chips }: InfoChipRowProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const isBO = variant === "backoffice";

  const borderColor = isDark
    ? isBO ? "rgba(249,115,22,0.65)" : "rgba(16,185,129,0.65)"
    : isBO ? "rgba(107,114,128,0.55)" : "rgba(107,114,128,0.50)";

  const glowColor = isDark
    ? isBO ? "0 0 10px 2px rgba(249,115,22,0.32)" : "0 0 10px 2px rgba(16,185,129,0.28)"
    : "0 2px 6px rgba(0,0,0,0.10)";

  const iconColor = isDark
    ? isBO ? "#f97316" : "#10b981"
    : isBO ? "#ea580c" : "#059669";

  const chipBg = isDark
    ? isBO ? "rgba(249,115,22,0.06)" : "rgba(16,185,129,0.05)"
    : "rgba(255,255,255,0.85)";

  const textColor = isDark ? "rgba(229,231,235,0.90)" : "rgba(31,41,55,0.90)";
  const labelColor = isDark ? "rgba(156,163,175,0.75)" : "rgba(107,114,128,0.75)";

  return (
    <div
      data-testid={`info-chip-row-${variant}`}
      style={{ display: "flex", gap: 8, width: "100%", alignItems: "stretch" }}
    >
      {chips.map((chip, idx) => {
        const Icon = chip.icon;
        return (
          <div
            key={idx}
            data-testid={chip.testId ?? `chip-${variant}-${idx}`}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 8,
              border: `2px solid ${borderColor}`,
              background: chipBg,
              boxShadow: glowColor,
              minWidth: 0,
              transition: "box-shadow 0.2s ease, border-color 0.2s ease",
            }}
          >
            <Icon
              size={15}
              style={{
                color: iconColor,
                flexShrink: 0,
                strokeWidth: 2,
              }}
            />
            <div style={{ minWidth: 0, overflow: "hidden" }}>
              {chip.label && (
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: labelColor,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    lineHeight: 1,
                    marginBottom: 1,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {chip.label}
                </div>
              )}
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: textColor,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  lineHeight: 1.3,
                }}
              >
                {chip.value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { CalendarDays, Star, Thermometer, Server, User, FileCheck };
