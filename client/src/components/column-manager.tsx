import { Columns3, RotateCcw, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import type { UseColumnVisibilityReturn } from "@/hooks/use-column-visibility";

interface ColumnManagerProps {
  columnVisibility: UseColumnVisibilityReturn;
}

export function ColumnManager({ columnVisibility }: ColumnManagerProps) {
  const { columns, isVisible, toggleColumn, showAll, hideAll, resetToDefault } =
    columnVisibility;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          data-testid="button-column-manager"
        >
          <Columns3 className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-60 p-0"
        data-testid="popover-column-manager"
      >
        <div className="p-3 pb-2">
          <p className="text-sm font-medium">Stlpce</p>
        </div>
        <Separator />
        <div className="flex items-center gap-1 p-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={showAll}
            className="flex-1 text-xs h-7"
            data-testid="button-columns-show-all"
          >
            <Eye className="w-3 h-3 mr-1" />
            Vsetky
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={hideAll}
            className="flex-1 text-xs h-7"
            data-testid="button-columns-hide-all"
          >
            <EyeOff className="w-3 h-3 mr-1" />
            Skryt
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={resetToDefault}
            className="flex-1 text-xs h-7"
            data-testid="button-columns-reset"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
        <Separator />
        <div className="max-h-64 overflow-y-auto p-2 space-y-1">
          {columns.map((col) => (
            <label
              key={col.key}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover-elevate cursor-pointer text-sm"
              data-testid={`label-column-toggle-${col.key}`}
            >
              <Checkbox
                checked={isVisible(col.key)}
                onCheckedChange={() => toggleColumn(col.key)}
                data-testid={`checkbox-column-${col.key}`}
              />
              <span className="truncate">{col.label}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
