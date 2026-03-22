import { differenceInDays, parseISO, isValid } from "date-fns";
import { AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export type ExpiryStatus = "ok" | "warning" | "critical" | "expired";

interface ExpiryBadgeProps {
  date: string | null | undefined;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

export function parseExpiryDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value);
  if (isValid(d)) return d;
  const parts = value.split(".");
  if (parts.length === 3) {
    const [day, month, year] = parts;
    const d2 = new Date(Number(year), Number(month) - 1, Number(day));
    if (isValid(d2)) return d2;
  }
  return null;
}

export function getDaysUntilExpiry(value: string | null | undefined): number | null {
  const parsed = parseExpiryDate(value);
  if (!parsed) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInDays(parsed, today);
}

export function getExpiryStatus(value: string | null | undefined): ExpiryStatus | null {
  const days = getDaysUntilExpiry(value);
  if (days === null) return null;
  if (days < 0) return "expired";
  if (days <= 30) return "critical";
  if (days <= 90) return "warning";
  return "ok";
}

export function ExpiryBadge({ date, className, showIcon = true, compact = false }: ExpiryBadgeProps) {
  const parsed = parseExpiryDate(date);
  if (!parsed) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysLeft = differenceInDays(parsed, today);

  let label: string;
  let colorClass: string;
  let Icon: typeof CheckCircle2;
  let borderStyle: string;

  if (daysLeft < 0) {
    label = compact ? "Exp." : `Expirované (${Math.abs(daysLeft)} dní)`;
    colorClass = "text-red-500 dark:text-red-400";
    borderStyle = "border-2 border-red-500 dark:border-red-400";
    Icon = XCircle;
  } else if (daysLeft <= 30) {
    label = compact ? `${daysLeft}d` : `Riziko: ${daysLeft} dní`;
    colorClass = "text-red-500 dark:text-red-400";
    borderStyle = "border-2 border-red-500 dark:border-red-400";
    Icon = AlertTriangle;
  } else if (daysLeft <= 90) {
    label = compact ? `${daysLeft}d` : `${daysLeft} dní`;
    colorClass = "text-amber-500 dark:text-amber-400";
    borderStyle = "border-2 border-amber-500 dark:border-amber-400";
    Icon = Clock;
  } else {
    label = compact ? `${daysLeft}d` : `${daysLeft} dní`;
    colorClass = "text-green-600 dark:text-green-400";
    borderStyle = "border border-green-500/40 dark:border-green-400/40";
    Icon = CheckCircle2;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
        borderStyle,
        colorClass,
        className
      )}
      title={parsed.toLocaleDateString("sk-SK")}
      data-testid="expiry-badge"
    >
      {showIcon && <Icon className="h-3 w-3 flex-shrink-0" />}
      {label}
    </span>
  );
}
