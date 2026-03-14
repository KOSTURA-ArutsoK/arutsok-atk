import { useState, useRef, useEffect, forwardRef } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, X } from "lucide-react";

interface TitleComboboxProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  "data-testid"?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocusNext?: () => void;
}

export const TitleCombobox = forwardRef<HTMLInputElement, TitleComboboxProps>(
  ({ value, onChange, options, placeholder, readOnly, className, onKeyDown, onFocusNext, ...rest }, ref) => {
    const [open, setOpen] = useState(false);
    const [highlighted, setHighlighted] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const filtered = value.trim()
      ? options.filter(o => o.toLowerCase().startsWith(value.toLowerCase())).concat(
          options.filter(o => !o.toLowerCase().startsWith(value.toLowerCase()) && o.toLowerCase().includes(value.toLowerCase()))
        )
      : options;

    const allOpts = [...filtered, "iný"];

    useEffect(() => {
      setHighlighted(-1);
    }, [value]);

    const select = (opt: string) => {
      if (opt === "iný") {
        onChange("");
        setOpen(false);
        (ref as React.RefObject<HTMLInputElement>)?.current?.focus();
      } else {
        onChange(opt);
        setOpen(false);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!open) { setOpen(true); return; }
        setHighlighted(h => Math.min(h + 1, allOpts.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlighted(h => Math.max(h - 1, 0));
      } else if (e.key === "Enter") {
        if (open && highlighted >= 0) {
          e.preventDefault();
          select(allOpts[highlighted]);
        } else if (open) {
          e.preventDefault();
          setOpen(false);
          onFocusNext?.();
        } else {
          onKeyDown?.(e);
        }
      } else if (e.key === "Escape") {
        setOpen(false);
      } else if (e.key === "Tab") {
        setOpen(false);
      } else {
        onKeyDown?.(e);
      }
    };

    useEffect(() => {
      if (highlighted >= 0 && listRef.current) {
        const item = listRef.current.querySelectorAll("[data-opt]")[highlighted] as HTMLElement;
        item?.scrollIntoView({ block: "nearest" });
      }
    }, [highlighted]);

    return (
      <div ref={containerRef} className="relative">
        <div className="relative">
          <input
            ref={ref}
            value={value}
            onChange={e => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => { if (!readOnly) setOpen(true); }}
            onBlur={() => setTimeout(() => setOpen(false), 160)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            readOnly={readOnly}
            autoComplete="off"
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 pr-8 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              readOnly && "opacity-60 cursor-not-allowed",
              className
            )}
            {...rest}
          />
          {!readOnly && (
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
              {value && (
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseDown={e => { e.preventDefault(); onChange(""); }}
                  className="p-0.5 rounded text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={e => { e.preventDefault(); setOpen(o => !o); (ref as React.RefObject<HTMLInputElement>)?.current?.focus(); }}
                className="p-0.5 rounded text-muted-foreground hover:text-foreground"
              >
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
              </button>
            </div>
          )}
        </div>

        {open && !readOnly && (
          <div
            ref={listRef}
            className="absolute z-50 left-0 right-0 top-full mt-0.5 bg-popover border rounded-md shadow-md max-h-52 overflow-y-auto"
          >
            {allOpts.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Žiadne výsledky</div>
            )}
            {allOpts.map((opt, i) => {
              const isIny = opt === "iný";
              const isActive = i === highlighted;
              const isSelected = opt === value;
              return (
                <div
                  key={opt}
                  data-opt={opt}
                  onMouseDown={e => { e.preventDefault(); select(opt); }}
                  className={cn(
                    "px-3 py-1.5 text-xs cursor-pointer select-none",
                    isIny && "border-t text-muted-foreground italic",
                    isActive && "bg-accent text-accent-foreground",
                    !isActive && isSelected && "bg-primary/10 text-primary",
                    !isActive && !isSelected && "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {isIny ? "iný — písať voľne" : opt}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
);
TitleCombobox.displayName = "TitleCombobox";
