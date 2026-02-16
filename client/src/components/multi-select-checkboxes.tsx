import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

interface MultiSelectCheckboxesProps {
  paramId: number | string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

export function MultiSelectCheckboxes({ paramId, options, value, onChange }: MultiSelectCheckboxesProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const selectedValues: string[] = value ? (() => {
    try { return JSON.parse(value); } catch { return value.split(",").map(v => v.trim()).filter(Boolean); }
  })() : [];

  function toggleOption(opt: string) {
    const newSelected = selectedValues.includes(opt)
      ? selectedValues.filter(v => v !== opt)
      : [...selectedValues, opt];
    onChange(JSON.stringify(newSelected));
  }

  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-2" data-testid={`multiselect-param-${paramId}`}>
      <div style={{ display: selectedValues.length > 0 ? 'flex' : 'none' }} className="flex-wrap gap-1">
        {selectedValues.map((val, i) => (
          <Badge key={i} variant="secondary" className="flex items-center gap-1">
            {val}
            <button type="button" onClick={() => toggleOption(val)} className="ml-0.5 hover:text-destructive">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Hladat moznosti..."
          className="pl-8 h-8 text-sm"
          data-testid={`input-multiselect-search-${paramId}`}
        />
      </div>
      <div className="max-h-[200px] overflow-y-auto rounded-md border border-border p-2 space-y-1">
        {filteredOptions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">Ziadne moznosti</p>
        ) : (
          filteredOptions.map((opt, i) => (
            <label key={i} className="flex items-center gap-2 px-1 py-0.5 rounded hover-elevate cursor-pointer text-sm" data-testid={`checkbox-option-${paramId}-${i}`}>
              <Checkbox
                checked={selectedValues.includes(opt)}
                onCheckedChange={() => toggleOption(opt)}
              />
              <span>{opt}</span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
