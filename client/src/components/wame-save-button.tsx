import { Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface WameSaveButtonProps {
  isPending: boolean;
  onClick?: () => void;
  type?: "submit" | "button";
  disabled?: boolean;
  className?: string;
}

export function WameSaveButton({ isPending, onClick, type = "submit", disabled, className }: WameSaveButtonProps) {
  return (
    <div className={`sticky bottom-0 z-50 bg-background/95 backdrop-blur border-t border-border p-3 flex justify-end ${className || ""}`}>
      <Button
        type={type}
        onClick={onClick}
        disabled={isPending || disabled}
        data-testid="button-save-wame"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Ukladam...
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" />
            Ulozit
          </>
        )}
      </Button>
    </div>
  );
}
