import { useState, useMemo, useCallback, useRef, useEffect } from "react";

const DEBOUNCE_MS = 200;

const DIACRITIC_MAP: Record<string, string> = {
  "á": "a", "ä": "a", "č": "c", "ď": "d", "é": "e", "í": "i",
  "ĺ": "l", "ľ": "l", "ň": "n", "ó": "o", "ô": "o", "ŕ": "r",
  "š": "s", "ť": "t", "ú": "u", "ý": "y", "ž": "z",
  "Á": "a", "Ä": "a", "Č": "c", "Ď": "d", "É": "e", "Í": "i",
  "Ĺ": "l", "Ľ": "l", "Ň": "n", "Ó": "o", "Ô": "o", "Ŕ": "r",
  "Š": "s", "Ť": "t", "Ú": "u", "Ý": "y", "Ž": "z",
};

function removeDiacritics(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    result += DIACRITIC_MAP[ch] || ch;
  }
  return result;
}

function normalize(val: unknown): string {
  if (val == null) return "";
  return removeDiacritics(String(val).toLowerCase());
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

function useDebouncedValue(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timer.current = setTimeout(() => setDebounced(value), delay);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, delay]);

  return debounced;
}

export interface ColumnFilterDef {
  key: string;
  label: string;
}

export interface UseTableFilterReturn<T> {
  filteredData: T[];
  globalFilter: string;
  setGlobalFilter: (val: string) => void;
  columnFilters: Record<string, string>;
  setColumnFilter: (key: string, val: string) => void;
  clearAllFilters: () => void;
  hasActiveFilters: boolean;
}

export function useTableFilter<T>(
  data: T[],
  filterableColumns: ColumnFilterDef[]
): UseTableFilterReturn<T> {
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const debouncedGlobal = useDebouncedValue(globalFilter, DEBOUNCE_MS);
  const [debouncedColumns, setDebouncedColumns] = useState<Record<string, string>>({});
  const colTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    colTimer.current = setTimeout(() => setDebouncedColumns({ ...columnFilters }), DEBOUNCE_MS);
    return () => {
      if (colTimer.current) clearTimeout(colTimer.current);
    };
  }, [columnFilters]);

  const setColumnFilter = useCallback((key: string, val: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: val }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setGlobalFilter("");
    setColumnFilters({});
  }, []);

  const columnKeys = useMemo(() => filterableColumns.map(c => c.key), [filterableColumns]);

  const filteredData = useMemo(() => {
    const normalizedGlobal = normalize(debouncedGlobal);
    const activeColFilters = Object.entries(debouncedColumns)
      .filter(([, v]) => v.trim() !== "")
      .map(([k, v]) => [k, normalize(v)] as const);

    if (!normalizedGlobal && activeColFilters.length === 0) return data;

    return data.filter(item => {
      if (normalizedGlobal) {
        let globalMatch = false;
        for (const key of columnKeys) {
          const val = normalize(getNestedValue(item, key));
          if (val.includes(normalizedGlobal)) {
            globalMatch = true;
            break;
          }
        }
        if (!globalMatch) return false;
      }

      for (const [key, filterVal] of activeColFilters) {
        const val = normalize(getNestedValue(item, key));
        if (!val.includes(filterVal)) return false;
      }

      return true;
    });
  }, [data, debouncedGlobal, debouncedColumns, columnKeys]);

  const hasActiveFilters = globalFilter.trim() !== "" || Object.values(columnFilters).some(v => v.trim() !== "");

  return {
    filteredData,
    globalFilter,
    setGlobalFilter,
    columnFilters,
    setColumnFilter,
    clearAllFilters,
    hasActiveFilters,
  };
}
