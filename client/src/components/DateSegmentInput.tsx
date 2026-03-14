import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";

interface DateSegmentInputProps {
  value: string;
  onChange: (value: string) => void;
  "data-testid"?: string;
}

function isValidDate(day: number, month: number, year: number): boolean {
  if (year < 1900 || year > 2100) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function isFutureDate(day: number, month: number, year: number): boolean {
  const d = new Date(year, month - 1, day);
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return d > today;
}

function segmentsComplete(d: string, m: string, y: string): boolean {
  return d.length === 2 && m.length === 2 && y.length === 4;
}

function canLeaveFn(d: string, m: string, y: string): boolean {
  if (!segmentsComplete(d, m, y)) return false;
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (!isValidDate(day, month, year)) return false;
  if (isFutureDate(day, month, year)) return false;
  return true;
}

function getErrorMsg(d: string, m: string, y: string): string {
  if (!segmentsComplete(d, m, y)) return "Vyplňte celý dátum (dd.mm.rrrr)";
  const day = parseInt(d, 10);
  const month = parseInt(m, 10);
  const year = parseInt(y, 10);
  if (!isValidDate(day, month, year)) return "Neplatný dátum";
  if (isFutureDate(day, month, year)) return "Dátum uzatvorenia nesmie byť v budúcnosti";
  return "";
}

export function DateSegmentInput({ value, onChange, "data-testid": testId }: DateSegmentInputProps) {
  const [dd, setDd] = useState("");
  const [mm, setMm] = useState("");
  const [rrrr, setRrrr] = useState("");
  const [error, setError] = useState("");
  const [engaged, setEngaged] = useState(false);
  const lastEmittedRef = useRef(value);

  const ddRef = useRef<HTMLInputElement>(null);
  const mmRef = useRef<HTMLInputElement>(null);
  const rrrrRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const trapActiveRef = useRef(false);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;
    if (value) {
      const parts = value.split("-");
      if (parts.length === 3) {
        setRrrr(parts[0]);
        setMm(parts[1]);
        setDd(parts[2]);
        setError("");
      }
    } else {
      setDd("");
      setMm("");
      setRrrr("");
      setError("");
    }
  }, [value]);

  const tryEmit = useCallback((d: string, m: string, y: string) => {
    if (segmentsComplete(d, m, y)) {
      const day = parseInt(d, 10);
      const month = parseInt(m, 10);
      const year = parseInt(y, 10);
      if (isValidDate(day, month, year)) {
        const formatted = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
        lastEmittedRef.current = formatted;
        onChange(formatted);
        setError("");
      } else {
        setError("Neplatný dátum");
      }
    } else if (d === "" && m === "" && y === "") {
      lastEmittedRef.current = "";
      onChange("");
      setError("");
    }
  }, [onChange]);

  const focusIncomplete = useCallback((d: string, m: string, y: string) => {
    if (d.length < 2) {
      ddRef.current?.focus();
    } else if (m.length < 2) {
      mmRef.current?.focus();
    } else if (y.length < 4) {
      rrrrRef.current?.focus();
    } else {
      ddRef.current?.focus();
    }
  }, []);

  const handleFocus = useCallback(() => {
    setEngaged(true);
  }, []);

  const handleSegmentChange = (
    segment: "dd" | "mm" | "rrrr",
    val: string,
    maxLen: number,
    setter: (v: string) => void,
    nextRef: React.RefObject<HTMLInputElement> | null
  ) => {
    const filtered = val.replace(/\D/g, "").slice(0, maxLen);
    setter(filtered);

    let newDd = dd, newMm = mm, newRrrr = rrrr;
    if (segment === "dd") newDd = filtered;
    if (segment === "mm") newMm = filtered;
    if (segment === "rrrr") newRrrr = filtered;

    if (filtered.length === maxLen && nextRef?.current) {
      nextRef.current.focus();
      nextRef.current.select();
    }

    tryEmit(newDd, newMm, newRrrr);

    if (error) {
      const newError = getErrorMsg(newDd, newMm, newRrrr);
      if (!newError) setError("");
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    segment: "dd" | "mm" | "rrrr",
    prevRef: React.RefObject<HTMLInputElement> | null
  ) => {
    if (e.key === "Backspace") {
      const currentVal = segment === "dd" ? dd : segment === "mm" ? mm : rrrr;
      if (currentVal.length === 0 && prevRef?.current) {
        e.preventDefault();
        prevRef.current.focus();
      }
    }

    if (e.key === "Tab" || e.key === "Escape") {
      let curDd = dd, curMm = mm, curRrrr = rrrr;
      const target = e.target as HTMLInputElement;
      if (target === ddRef.current) curDd = target.value.replace(/\D/g, "").slice(0, 2);
      if (target === mmRef.current) curMm = target.value.replace(/\D/g, "").slice(0, 2);
      if (target === rrrrRef.current) curRrrr = target.value.replace(/\D/g, "").slice(0, 4);

      if (!canLeaveFn(curDd, curMm, curRrrr)) {
        e.preventDefault();
        setError(getErrorMsg(curDd, curMm, curRrrr));
        focusIncomplete(curDd, curMm, curRrrr);
      }
    }
  };

  const handleContainerBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    if (trapActiveRef.current) return;

    const relatedTarget = e.relatedTarget as Node | null;
    if (relatedTarget && containerRef.current?.contains(relatedTarget)) {
      return;
    }

    if (!canLeaveFn(dd, mm, rrrr)) {
      setError(getErrorMsg(dd, mm, rrrr));
      trapActiveRef.current = true;

      requestAnimationFrame(() => {
        focusIncomplete(dd, mm, rrrr);
        trapActiveRef.current = false;
      });
    }
  }, [dd, mm, rrrr, focusIncomplete]);

  const segmentClass = "text-center bg-transparent outline-none text-sm";

  const showFutureWarning = segmentsComplete(dd, mm, rrrr) &&
    isValidDate(parseInt(dd, 10), parseInt(mm, 10), parseInt(rrrr, 10)) &&
    isFutureDate(parseInt(dd, 10), parseInt(mm, 10), parseInt(rrrr, 10));

  return (
    <div>
      <div
        ref={containerRef}
        onBlur={engaged ? handleContainerBlur : undefined}
        onFocus={handleFocus}
        className={cn(
          "flex items-center h-9 w-full rounded-md border bg-background px-2 py-2 text-base ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:text-sm",
          error ? "border-red-500" : "border-input"
        )}
        data-testid={testId}
      >
        <input
          ref={ddRef}
          type="text"
          inputMode="numeric"
          placeholder="dd"
          value={dd}
          onChange={e => handleSegmentChange("dd", e.target.value, 2, setDd, mmRef)}
          onKeyDown={e => handleKeyDown(e, "dd", null)}
          onFocus={handleFocus}
          className={cn(segmentClass, "w-7")}
          data-testid={testId ? `${testId}-dd` : undefined}
        />
        <span className="text-muted-foreground mx-0.5">.</span>
        <input
          ref={mmRef}
          type="text"
          inputMode="numeric"
          placeholder="mm"
          value={mm}
          onChange={e => handleSegmentChange("mm", e.target.value, 2, setMm, rrrrRef)}
          onKeyDown={e => handleKeyDown(e, "mm", ddRef)}
          onFocus={handleFocus}
          className={cn(segmentClass, "w-7")}
          data-testid={testId ? `${testId}-mm` : undefined}
        />
        <span className="text-muted-foreground mx-0.5">.</span>
        <input
          ref={rrrrRef}
          type="text"
          inputMode="numeric"
          placeholder="rrrr"
          value={rrrr}
          onChange={e => handleSegmentChange("rrrr", e.target.value, 4, setRrrr, null)}
          onKeyDown={e => handleKeyDown(e, "rrrr", mmRef)}
          onFocus={handleFocus}
          className={cn(segmentClass, "w-10")}
          data-testid={testId ? `${testId}-rrrr` : undefined}
        />
      </div>
      {error && (
        <p className="text-[10px] text-red-500 mt-0.5" data-testid={testId ? `${testId}-error` : undefined}>{error}</p>
      )}
      {showFutureWarning && !error && (
        <p className="text-[10px] text-orange-400 mt-0.5">Dátum uzatvorenia je v budúcnosti</p>
      )}
    </div>
  );
}
