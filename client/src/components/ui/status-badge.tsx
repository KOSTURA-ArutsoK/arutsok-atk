import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "active" | "archived" | "pending" | "warning";
  className?: string;
  children: React.ReactNode;
}

export function StatusBadge({ status, className, children }: StatusBadgeProps) {
  const styles = {
    active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    archived: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    pending: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    warning: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium border uppercase tracking-wide",
      styles[status],
      className
    )}>
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-50" />
      {children}
    </span>
  );
}
