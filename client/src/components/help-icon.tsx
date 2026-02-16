import { useHelp } from "@/contexts/help-context";
import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HelpIconProps {
  text: string;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function HelpIcon({ text, side = "top", className = "" }: HelpIconProps) {
  const { helpEnabled } = useHelp();

  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ display: helpEnabled ? "inline-flex" : "none" }}
    >
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center justify-center cursor-help"
            data-testid="help-icon"
            tabIndex={-1}
          >
            <HelpCircle className="w-3.5 h-3.5 text-muted-foreground/60 hover:text-primary transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

interface AdminNoteProps {
  text: string;
  isAdmin: boolean;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}

export function AdminNote({ text, isAdmin, side = "top", className = "" }: AdminNoteProps) {
  const { helpEnabled } = useHelp();

  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{ display: helpEnabled && isAdmin ? "inline-flex" : "none" }}
    >
      <Tooltip delayDuration={150}>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center justify-center cursor-help"
            data-testid="admin-note-icon"
            tabIndex={-1}
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-500/60 hover:text-amber-500 transition-colors" />
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-xs leading-relaxed border-amber-500/30">
          <span className="font-medium text-amber-500">Admin:</span>{" "}
          {text}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}
