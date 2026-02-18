import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { UseTableFilterReturn } from "@/hooks/use-table-filter";

interface TableFilterBarProps {
  filter: UseTableFilterReturn<any>;
}

export function TableFilterBar({ filter }: TableFilterBarProps) {
  return (
    <div className="relative flex items-center gap-2" data-testid="table-filter-bar">
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Hladat vsade..."
          value={filter.globalFilter}
          onChange={(e) => filter.setGlobalFilter(e.target.value)}
          className="pl-9 h-9"
          data-testid="input-global-search"
        />
      </div>
      {filter.hasActiveFilters && (
        <Button
          size="sm"
          variant="ghost"
          onClick={filter.clearAllFilters}
          data-testid="button-clear-filters"
        >
          <X className="w-3 h-3 mr-1" />
          Zrusit filtre
        </Button>
      )}
    </div>
  );
}
