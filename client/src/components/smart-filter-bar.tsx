import { useState, useRef, useEffect } from "react";
import { Plus, X, Save, ChevronDown, Trash2, Type, Hash, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  UseSmartFilterReturn,
  FilterChip,
  FilterColumnType,
  TextOperator,
  NumberOperator,
  DateOperator,
} from "@/hooks/use-smart-filter";

interface SmartFilterBarProps {
  filter: UseSmartFilterReturn<any>;
}

const TEXT_OPERATORS: { value: TextOperator; label: string }[] = [
  { value: "contains", label: "Obsahuje" },
  { value: "not_contains", label: "Neobsahuje" },
];

const NUMBER_OPERATORS: { value: NumberOperator; label: string }[] = [
  { value: "eq", label: "=" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "gte", label: "≥" },
  { value: "lte", label: "≤" },
  { value: "range", label: "Rozsah" },
];

const DATE_OPERATORS: { value: DateOperator; label: string }[] = [
  { value: "range", label: "Rozsah" },
  { value: "exact", label: "Presne" },
  { value: "before", label: "Pred" },
  { value: "after", label: "Po" },
];

function getTypeIcon(type: FilterColumnType) {
  switch (type) {
    case "text": return <Type className="w-3 h-3" />;
    case "number": return <Hash className="w-3 h-3" />;
    case "date": return <CalendarIcon className="w-3 h-3" />;
  }
}

function formatDateSk(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

function getOperatorLabel(chip: FilterChip): string {
  if (chip.type === "text") {
    return TEXT_OPERATORS.find(o => o.value === chip.operator)?.label || "";
  }
  if (chip.type === "number") {
    return NUMBER_OPERATORS.find(o => o.value === chip.operator)?.label || "";
  }
  if (chip.type === "date") {
    return DATE_OPERATORS.find(o => o.value === chip.operator)?.label || "";
  }
  return "";
}

function getChipDisplayValue(chip: FilterChip): string {
  const op = getOperatorLabel(chip);
  if (chip.operator === "range") {
    const from = chip.type === "date" ? formatDateSk(chip.value) : chip.value;
    const to = chip.type === "date" ? formatDateSk(chip.valueTo || "") : (chip.valueTo || "");
    if (from && to) return `${from} - ${to}`;
    if (from) return `od ${from}`;
    if (to) return `do ${to}`;
    return op;
  }
  const val = chip.type === "date" ? formatDateSk(chip.value) : chip.value;
  if (!val) return op;
  return `${op} ${val}`;
}

function TextChipEditor({ chip, onUpdate }: { chip: FilterChip; onUpdate: (u: Partial<Pick<FilterChip, "operator" | "value" | "valueTo">>) => void }) {
  return (
    <div className="space-y-2 p-1">
      <Select
        value={chip.operator}
        onValueChange={(v) => onUpdate({ operator: v as TextOperator })}
      >
        <SelectTrigger className="h-8 text-xs" data-testid={`select-text-operator-${chip.id}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TEXT_OPERATORS.map(op => (
            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={chip.value}
        onChange={(e) => onUpdate({ value: e.target.value })}
        placeholder="Zadajte text..."
        className="h-8 text-xs"
        autoFocus
        data-testid={`input-text-value-${chip.id}`}
      />
    </div>
  );
}

function NumberChipEditor({ chip, onUpdate }: { chip: FilterChip; onUpdate: (u: Partial<Pick<FilterChip, "operator" | "value" | "valueTo">>) => void }) {
  const isRange = chip.operator === "range";
  return (
    <div className="space-y-2 p-1">
      <Select
        value={chip.operator}
        onValueChange={(v) => onUpdate({ operator: v as NumberOperator })}
      >
        <SelectTrigger className="h-8 text-xs" data-testid={`select-number-operator-${chip.id}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NUMBER_OPERATORS.map(op => (
            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isRange ? (
        <div className="flex items-center gap-1">
          <Input
            type="number"
            value={chip.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Od"
            className="h-8 text-xs flex-1"
            autoFocus
            data-testid={`input-number-from-${chip.id}`}
          />
          <span className="text-xs text-muted-foreground">-</span>
          <Input
            type="number"
            value={chip.valueTo || ""}
            onChange={(e) => onUpdate({ valueTo: e.target.value })}
            placeholder="Do"
            className="h-8 text-xs flex-1"
            data-testid={`input-number-to-${chip.id}`}
          />
        </div>
      ) : (
        <Input
          type="number"
          value={chip.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          placeholder="Hodnota..."
          className="h-8 text-xs"
          autoFocus
          data-testid={`input-number-value-${chip.id}`}
        />
      )}
    </div>
  );
}

function DateChipEditor({ chip, onUpdate }: { chip: FilterChip; onUpdate: (u: Partial<Pick<FilterChip, "operator" | "value" | "valueTo">>) => void }) {
  const isRange = chip.operator === "range";
  const [showCalFrom, setShowCalFrom] = useState(false);
  const [showCalTo, setShowCalTo] = useState(false);

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  function toIso(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const quickPicks = [
    { label: "Dnes", action: () => onUpdate({ value: toIso(today), valueTo: toIso(today), operator: "range" as DateOperator }) },
    { label: "Vcera", action: () => onUpdate({ value: toIso(yesterday), valueTo: toIso(yesterday), operator: "range" as DateOperator }) },
    { label: "Tento mesiac", action: () => onUpdate({ value: toIso(monthStart), valueTo: toIso(today), operator: "range" as DateOperator }) },
    { label: "Tento rok", action: () => onUpdate({ value: toIso(yearStart), valueTo: toIso(today), operator: "range" as DateOperator }) },
  ];

  return (
    <div className="space-y-2 p-1">
      <Select
        value={chip.operator}
        onValueChange={(v) => onUpdate({ operator: v as DateOperator })}
      >
        <SelectTrigger className="h-8 text-xs" data-testid={`select-date-operator-${chip.id}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DATE_OPERATORS.map(op => (
            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap gap-1">
        {quickPicks.map(qp => (
          <Button
            key={qp.label}
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2"
            onClick={qp.action}
            data-testid={`button-quick-${qp.label.toLowerCase().replace(/\s/g, "-")}`}
          >
            {qp.label}
          </Button>
        ))}
      </div>

      {isRange ? (
        <div className="space-y-1.5">
          <div>
            <label className="text-[10px] text-muted-foreground">Od</label>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={chip.value}
                onChange={(e) => onUpdate({ value: e.target.value })}
                className="h-8 text-xs flex-1"
                data-testid={`input-date-from-${chip.id}`}
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Do</label>
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={chip.valueTo || ""}
                onChange={(e) => onUpdate({ valueTo: e.target.value })}
                className="h-8 text-xs flex-1"
                data-testid={`input-date-to-${chip.id}`}
              />
            </div>
          </div>
        </div>
      ) : (
        <Input
          type="date"
          value={chip.value}
          onChange={(e) => onUpdate({ value: e.target.value })}
          className="h-8 text-xs"
          data-testid={`input-date-value-${chip.id}`}
        />
      )}
    </div>
  );
}

function FilterChipComponent({
  chip,
  onUpdate,
  onRemove,
}: {
  chip: FilterChip;
  onUpdate: (u: Partial<Pick<FilterChip, "operator" | "value" | "valueTo">>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const displayValue = getChipDisplayValue(chip);
  const hasValue = chip.value.trim() !== "" || (chip.valueTo || "").trim() !== "";

  useEffect(() => {
    if (!hasValue) {
      const t = setTimeout(() => setOpen(true), 100);
      return () => clearTimeout(t);
    }
  }, []);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Badge
          variant={hasValue ? "default" : "outline"}
          className="cursor-pointer gap-1 pl-2 pr-1 py-1 text-xs no-default-hover-elevate"
          data-testid={`chip-filter-${chip.columnKey}`}
        >
          {getTypeIcon(chip.type)}
          <span className="font-medium">{chip.columnLabel}</span>
          {hasValue && (
            <span className="font-normal opacity-80 ml-0.5">{displayValue}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="ml-0.5 rounded-full p-0.5 hover:bg-background/20"
            data-testid={`button-remove-chip-${chip.columnKey}`}
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start" data-testid={`popover-chip-${chip.columnKey}`}>
        <div className="text-xs font-medium text-muted-foreground mb-2">{chip.columnLabel}</div>
        {chip.type === "text" && <TextChipEditor chip={chip} onUpdate={onUpdate} />}
        {chip.type === "number" && <NumberChipEditor chip={chip} onUpdate={onUpdate} />}
        {chip.type === "date" && <DateChipEditor chip={chip} onUpdate={onUpdate} />}
      </PopoverContent>
    </Popover>
  );
}

function SaveViewDialog({
  filter,
}: {
  filter: UseSmartFilterReturn<any>;
}) {
  const [open, setOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [showSaved, setShowSaved] = useState(false);

  function handleSave() {
    if (!viewName.trim()) return;
    filter.saveView(viewName.trim());
    setViewName("");
    setOpen(false);
  }

  return (
    <div className="flex items-center gap-1">
      {filter.savedViews.length > 0 && (
        <Popover open={showSaved} onOpenChange={setShowSaved}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" data-testid="button-load-view">
              <ChevronDown className="w-3 h-3" />
              Pohlady
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start" data-testid="popover-saved-views">
            <div className="space-y-1">
              {filter.savedViews.map(view => (
                <div key={view.id} className="flex items-center justify-between gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="flex-1 justify-start h-7 text-xs"
                    onClick={() => { filter.loadView(view.id); setShowSaved(false); }}
                    data-testid={`button-view-${view.id}`}
                  >
                    {view.name}
                    <span className="text-muted-foreground ml-1">({view.chips.length})</span>
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => filter.deleteView(view.id)}
                    data-testid={`button-delete-view-${view.id}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" data-testid="button-save-view">
            <Save className="w-4 h-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start" data-testid="popover-save-view">
          <div className="space-y-2">
            <label className="text-xs font-medium">Ulozit pohlad</label>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder="Nazov pohladu..."
              className="h-8 text-xs"
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              autoFocus
              data-testid="input-view-name"
            />
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleSave} data-testid="button-confirm-save-view">
              Ulozit
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function SmartFilterBar({ filter }: SmartFilterBarProps) {
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="smart-filter-bar">
      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" data-testid="button-add-filter">
            <Plus className="w-3.5 h-3.5" />
            Pridat filter
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start" data-testid="popover-column-picker">
          <Command>
            <CommandInput placeholder="Hladat stlpec..." className="h-9" data-testid="input-search-column" />
            <CommandList>
              <CommandEmpty>Ziadny stlpec.</CommandEmpty>
              <CommandGroup>
                {filter.columns.map(col => (
                  <CommandItem
                    key={col.key}
                    value={col.label}
                    onSelect={() => {
                      setAddOpen(false);
                      setTimeout(() => filter.addChip(col.key), 50);
                    }}
                    className="text-xs gap-2"
                    data-testid={`command-item-${col.key}`}
                  >
                    {getTypeIcon(col.type)}
                    {col.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {filter.chips.map(chip => (
        <FilterChipComponent
          key={chip.id}
          chip={chip}
          onUpdate={(u) => filter.updateChip(chip.id, u)}
          onRemove={() => filter.removeChip(chip.id)}
        />
      ))}

      {filter.chips.length >= 2 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-destructive"
          onClick={filter.clearAll}
          data-testid="button-clear-all-filters"
        >
          <X className="w-3 h-3 mr-1" />
          Zmazat vsetko
        </Button>
      )}

      {filter.chips.length > 0 && (
        <SaveViewDialog filter={filter} />
      )}
    </div>
  );
}
