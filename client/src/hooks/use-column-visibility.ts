import { useState, useCallback, useMemo } from "react";

export interface ColumnDef {
  key: string;
  label: string;
  defaultVisible?: boolean;
}

export interface UseColumnVisibilityReturn {
  isVisible: (key: string) => boolean;
  toggleColumn: (key: string) => void;
  showAll: () => void;
  hideAll: () => void;
  resetToDefault: () => void;
  visibleKeys: Set<string>;
  columns: ColumnDef[];
}

function getStorageKey(tableId: string): string {
  return `col-vis:${tableId}`;
}

function loadState(tableId: string): Record<string, boolean> | null {
  try {
    const raw = localStorage.getItem(getStorageKey(tableId));
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(tableId: string, state: Record<string, boolean>) {
  try {
    localStorage.setItem(getStorageKey(tableId), JSON.stringify(state));
  } catch {}
}

export function useColumnVisibility(
  tableId: string,
  columns: ColumnDef[]
): UseColumnVisibilityReturn {
  const defaultState = useMemo(() => {
    const s: Record<string, boolean> = {};
    for (const col of columns) {
      s[col.key] = col.defaultVisible !== false;
    }
    return s;
  }, [columns]);

  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const saved = loadState(tableId);
    if (saved) {
      const merged: Record<string, boolean> = {};
      for (const col of columns) {
        merged[col.key] = saved[col.key] !== undefined ? saved[col.key] : (col.defaultVisible !== false);
      }
      return merged;
    }
    return { ...defaultState };
  });

  const persist = useCallback((state: Record<string, boolean>) => {
    saveState(tableId, state);
  }, [tableId]);

  const isVisible = useCallback((key: string) => {
    return visibility[key] !== false;
  }, [visibility]);

  const toggleColumn = useCallback((key: string) => {
    setVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      persist(next);
      return next;
    });
  }, [persist]);

  const showAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const col of columns) next[col.key] = true;
    setVisibility(next);
    persist(next);
  }, [columns, persist]);

  const hideAll = useCallback(() => {
    const next: Record<string, boolean> = {};
    for (const col of columns) next[col.key] = false;
    setVisibility(next);
    persist(next);
  }, [columns, persist]);

  const resetToDefault = useCallback(() => {
    setVisibility({ ...defaultState });
    try {
      localStorage.removeItem(getStorageKey(tableId));
    } catch {}
  }, [defaultState, tableId]);

  const visibleKeys = useMemo(() => {
    const set = new Set<string>();
    for (const [k, v] of Object.entries(visibility)) {
      if (v) set.add(k);
    }
    return set;
  }, [visibility]);

  return {
    isVisible,
    toggleColumn,
    showAll,
    hideAll,
    resetToDefault,
    visibleKeys,
    columns,
  };
}
