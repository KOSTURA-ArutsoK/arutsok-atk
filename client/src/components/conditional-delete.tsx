import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Trash2 } from "lucide-react";

interface ConditionalDeleteProps {
  canDelete: boolean;
  onClick: () => void;
  testId: string;
  tooltipDelete?: string;
  tooltipBlocked?: string;
  disabled?: boolean;
  size?: "icon";
  variant?: "ghost";
  iconClassName?: string;
}

export function ConditionalDelete({
  canDelete,
  onClick,
  testId,
  tooltipDelete = "Zmazať prázdny záznam",
  tooltipBlocked = "Nie je možné zmazať – obsahuje podradené záznamy",
  disabled = false,
  iconClassName = "w-4 h-4",
}: ConditionalDeleteProps) {
  return (
    <div style={{ visibility: canDelete ? "visible" : "hidden" }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClick}
            disabled={disabled}
            data-testid={testId}
          >
            <Trash2 className={iconClassName} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltipDelete}</TooltipContent>
      </Tooltip>
    </div>
  );
}
