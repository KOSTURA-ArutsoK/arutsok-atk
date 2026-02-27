import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, User, Lock, Unlock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

function formatUidDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 15);
  const groups: string[] = [];
  for (let i = 0; i < digits.length; i += 3) {
    groups.push(digits.slice(i, i + 3));
  }
  return groups.join(" ");
}

function stripSpaces(val: string): string {
  return val.replace(/\s/g, "");
}

interface UIDInputProps {
  value: string;
  onChange: (rawUid: string) => void;
  prefix: string;
  subjectName: string | null;
  isLoadingSubject: boolean;
  placeholder?: string;
  onPrefixDetected?: (prefix: string) => void;
  "data-testid"?: string;
}

export function UIDInput({
  value,
  onChange,
  prefix,
  subjectName,
  isLoadingSubject,
  placeholder = "UID kód",
  onPrefixDetected,
  "data-testid": testId,
}: UIDInputProps) {
  const [manualOverride, setManualOverride] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastDetectedPrefix = useRef<string>("");

  const effectivePrefix = manualOverride ? "" : prefix;
  const rawValue = stripSpaces(value);
  const suffixPart = effectivePrefix && rawValue.startsWith(effectivePrefix)
    ? rawValue.slice(effectivePrefix.length)
    : rawValue;

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = stripSpaces(e.target.value);
    const digitsOnly = inputVal.replace(/\D/g, "");

    if (manualOverride || !effectivePrefix) {
      const capped = digitsOnly.slice(0, 15);
      onChange(capped);

      if (onPrefixDetected && manualOverride && capped.length >= 3) {
        const detectedPrefix = capped.slice(0, 3);
        if (detectedPrefix !== lastDetectedPrefix.current) {
          lastDetectedPrefix.current = detectedPrefix;
          onPrefixDetected(detectedPrefix);
        }
      }
    } else {
      const suffixDigits = digitsOnly.replace(/\D/g, "").slice(0, 15 - effectivePrefix.length);
      onChange(effectivePrefix + suffixDigits);
    }
  }, [manualOverride, effectivePrefix, onChange, onPrefixDetected]);

  const toggleOverride = useCallback(() => {
    setManualOverride(prev => {
      const next = !prev;
      if (!next && prefix) {
        const current = stripSpaces(value);
        if (!current.startsWith(prefix)) {
          onChange(prefix);
        }
      }
      return next;
    });
  }, [prefix, value, onChange]);

  const displayValue = manualOverride || !effectivePrefix
    ? formatUidDisplay(rawValue)
    : suffixPart
      ? formatUidDisplay(suffixPart)
      : "";

  const prefixFormatted = effectivePrefix ? formatUidDisplay(effectivePrefix) : "";
  const hasCompleteUid = rawValue.length === 15;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <div className="flex-1 relative">
          {!manualOverride && prefixFormatted && (
            <span
              className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground/50 pointer-events-none select-none"
              data-testid={testId ? `${testId}-prefix` : undefined}
            >
              {prefixFormatted}
              {suffixPart && <span className="invisible">{" "}</span>}
            </span>
          )}
          <Input
            ref={inputRef}
            placeholder={manualOverride || !prefixFormatted ? placeholder : ""}
            value={displayValue}
            onChange={handleInputChange}
            className="font-mono text-sm"
            style={
              !manualOverride && prefixFormatted
                ? { paddingLeft: `calc(${prefixFormatted.length}ch + 0.75rem + 0.25rem)` }
                : undefined
            }
            data-testid={testId}
          />
        </div>
        {prefix && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={toggleOverride}
                data-testid={testId ? `${testId}-override` : undefined}
              >
                {manualOverride ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {manualOverride ? "Zapnúť automatický prefix" : "Manuálne zadanie celého UID"}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {hasCompleteUid && (
        <div className="flex items-center gap-1 pl-1">
          {isLoadingSubject ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : subjectName ? (
            <>
              <User className="w-3 h-3 text-emerald-500" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400 truncate" data-testid={testId ? `${testId}-name` : undefined}>
                {subjectName}
              </span>
            </>
          ) : (
            <span className="text-xs text-destructive" data-testid={testId ? `${testId}-notfound` : undefined}>
              Subjekt nenájdený
            </span>
          )}
        </div>
      )}
    </div>
  );
}
