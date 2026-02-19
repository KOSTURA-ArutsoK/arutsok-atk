import { useState, useMemo, useCallback, useRef, useEffect } from "react";

const DEBOUNCE_MS = 300;

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

function stripBallast(str: string): string {
  return str.replace(/[\s\-\+\(\)\/\.]/g, "");
}

function normalize(val: unknown): string {
  if (val == null) return "";
  return stripBallast(removeDiacritics(String(val).toLowerCase()));
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

export type FilterColumnType = "text" | "number" | "date";

export type TextOperator = "contains" | "not_contains";
export type NumberOperator = "eq" | "gt" | "lt" | "gte" | "lte" | "range";
export type DateOperator = "exact" | "before" | "after" | "range";

export type FilterOperator = TextOperator | NumberOperator | DateOperator;

export interface SmartColumnDef {
  key: string;
  label: string;
  type: FilterColumnType;
}

export interface FilterChip {
  id: string;
  columnKey: string;
  columnLabel: string;
  type: FilterColumnType;
  operator: FilterOperator;
  value: string;
  valueTo?: string;
}

export interface SavedView {
  id: string;
  name: string;
  chips: FilterChip[];
}

export interface UseSmartFilterReturn<T> {
  filteredData: T[];
  chips: FilterChip[];
  addChip: (columnKey: string) => void;
  updateChip: (chipId: string, updates: Partial<Pick<FilterChip, "operator" | "value" | "valueTo">>) => void;
  removeChip: (chipId: string) => void;
  clearAll: () => void;
  hasActiveFilters: boolean;
  columns: SmartColumnDef[];
  savedViews: SavedView[];
  saveView: (name: string) => void;
  loadView: (viewId: string) => void;
  deleteView: (viewId: string) => void;
}

let chipIdCounter = 0;
function genChipId(): string {
  return `chip_${++chipIdCounter}_${Date.now()}`;
}

function getDefaultOperator(type: FilterColumnType): FilterOperator {
  switch (type) {
    case "text": return "contains";
    case "number": return "eq";
    case "date": return "range";
  }
}

function parseNum(val: string): number | null {
  if (!val || val.trim() === "") return null;
  const n = Number(val.replace(",", "."));
  return isNaN(n) ? null : n;
}

function parseDate(val: string): Date | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function evaluateChip(chip: FilterChip, itemValue: any): boolean {
  if (chip.type === "text") {
    const norm = normalize(itemValue);
    const filterNorm = normalize(chip.value);
    if (!filterNorm) return true;
    if (chip.operator === "contains") return norm.includes(filterNorm);
    if (chip.operator === "not_contains") return !norm.includes(filterNorm);
    return true;
  }

  if (chip.type === "number") {
    const itemNum = parseNum(String(itemValue ?? ""));
    const filterNum = parseNum(chip.value);

    if (chip.operator === "range") {
      const from = parseNum(chip.value);
      const to = parseNum(chip.valueTo || "");
      if (from === null && to === null) return true;
      if (itemNum === null) return false;
      if (from !== null && itemNum < from) return false;
      if (to !== null && itemNum > to) return false;
      return true;
    }

    if (filterNum === null) return true;
    if (itemNum === null) return false;

    switch (chip.operator) {
      case "eq": return itemNum === filterNum;
      case "gt": return itemNum > filterNum;
      case "lt": return itemNum < filterNum;
      case "gte": return itemNum >= filterNum;
      case "lte": return itemNum <= filterNum;
      default: return true;
    }
  }

  if (chip.type === "date") {
    const rawVal = String(itemValue ?? "");
    const itemDate = parseDate(rawVal);

    if (chip.operator === "range") {
      const from = parseDate(chip.value);
      const to = parseDate(chip.valueTo || "");
      if (!from && !to) return true;
      if (!itemDate) return false;
      if (from && itemDate < startOfDay(from)) return false;
      if (to && itemDate > endOfDay(to)) return false;
      return true;
    }

    const filterDate = parseDate(chip.value);
    if (!filterDate) return true;
    if (!itemDate) return false;

    switch (chip.operator) {
      case "exact":
        return startOfDay(itemDate).getTime() === startOfDay(filterDate).getTime();
      case "before":
        return itemDate < startOfDay(filterDate);
      case "after":
        return itemDate > endOfDay(filterDate);
      default: return true;
    }
  }

  return true;
}

function getViewsKey(tableId: string): string {
  return `smartFilterViews:${tableId}`;
}

function loadSavedViews(tableId: string): SavedView[] {
  try {
    const raw = localStorage.getItem(getViewsKey(tableId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function persistViews(tableId: string, views: SavedView[]) {
  localStorage.setItem(getViewsKey(tableId), JSON.stringify(views));
}

export function useSmartFilter<T>(
  data: T[],
  columns: SmartColumnDef[],
  tableId: string
): UseSmartFilterReturn<T> {
  const [chips, setChips] = useState<FilterChip[]>([]);
  const [debouncedChips, setDebouncedChips] = useState<FilterChip[]>([]);
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => loadSavedViews(tableId));
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timer.current = setTimeout(() => setDebouncedChips([...chips]), DEBOUNCE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [chips]);

  const columnMap = useMemo(() => {
    const m = new Map<string, SmartColumnDef>();
    columns.forEach(c => m.set(c.key, c));
    return m;
  }, [columns]);

  const addChip = useCallback((columnKey: string) => {
    const col = columnMap.get(columnKey);
    if (!col) return;
    setChips(prev => [
      ...prev,
      {
        id: genChipId(),
        columnKey: col.key,
        columnLabel: col.label,
        type: col.type,
        operator: getDefaultOperator(col.type),
        value: "",
        valueTo: "",
      },
    ]);
  }, [columnMap]);

  const updateChip = useCallback((chipId: string, updates: Partial<Pick<FilterChip, "operator" | "value" | "valueTo">>) => {
    setChips(prev =>
      prev.map(c => (c.id === chipId ? { ...c, ...updates } : c))
    );
  }, []);

  const removeChip = useCallback((chipId: string) => {
    setChips(prev => prev.filter(c => c.id !== chipId));
  }, []);

  const clearAll = useCallback(() => {
    setChips([]);
  }, []);

  const saveView = useCallback((name: string) => {
    const view: SavedView = {
      id: `view_${Date.now()}`,
      name,
      chips: chips.map(c => ({ ...c })),
    };
    setSavedViews(prev => {
      const next = [...prev, view];
      persistViews(tableId, next);
      return next;
    });
  }, [chips, tableId]);

  const loadView = useCallback((viewId: string) => {
    const view = savedViews.find(v => v.id === viewId);
    if (view) {
      setChips(view.chips.map(c => ({ ...c, id: genChipId() })));
    }
  }, [savedViews]);

  const deleteView = useCallback((viewId: string) => {
    setSavedViews(prev => {
      const next = prev.filter(v => v.id !== viewId);
      persistViews(tableId, next);
      return next;
    });
  }, [tableId]);

  const filteredData = useMemo(() => {
    const activeChips = debouncedChips.filter(c => {
      if (c.type === "text") return c.value.trim() !== "";
      if (c.type === "number") {
        if (c.operator === "range") return c.value.trim() !== "" || (c.valueTo || "").trim() !== "";
        return c.value.trim() !== "";
      }
      if (c.type === "date") {
        if (c.operator === "range") return c.value !== "" || (c.valueTo || "") !== "";
        return c.value !== "";
      }
      return false;
    });

    if (activeChips.length === 0) return data;

    return data.filter(item => {
      for (const chip of activeChips) {
        const val = getNestedValue(item, chip.columnKey);
        if (!evaluateChip(chip, val)) return false;
      }
      return true;
    });
  }, [data, debouncedChips]);

  const hasActiveFilters = chips.some(c => {
    if (c.type === "text") return c.value.trim() !== "";
    if (c.type === "number") {
      if (c.operator === "range") return c.value.trim() !== "" || (c.valueTo || "").trim() !== "";
      return c.value.trim() !== "";
    }
    if (c.type === "date") {
      if (c.operator === "range") return c.value !== "" || (c.valueTo || "") !== "";
      return c.value !== "";
    }
    return false;
  });

  return {
    filteredData,
    chips,
    addChip,
    updateChip,
    removeChip,
    clearAll,
    hasActiveFilters,
    columns,
    savedViews,
    saveView,
    loadView,
    deleteView,
  };
}
