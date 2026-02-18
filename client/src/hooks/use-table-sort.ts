import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc" | null;

export interface TableSortState {
  sortKey: string | null;
  sortDirection: SortDirection;
}

export interface UseTableSortReturn<T> {
  sortedData: T[];
  sortKey: string | null;
  sortDirection: SortDirection;
  requestSort: (key: string) => void;
}

function detectAndCompare(a: any, b: any): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;

  if (typeof a === "boolean" || typeof b === "boolean") {
    const ba = a === true ? 1 : 0;
    const bb = b === true ? 1 : 0;
    return ba - bb;
  }

  const numA = typeof a === "number" ? a : Number(a);
  const numB = typeof b === "number" ? b : Number(b);
  if (!isNaN(numA) && !isNaN(numB) && String(a).trim() !== "" && String(b).trim() !== "") {
    return numA - numB;
  }

  const strA = String(a);
  const strB = String(b);

  const dateA = Date.parse(strA);
  const dateB = Date.parse(strB);
  if (!isNaN(dateA) && !isNaN(dateB) && strA.length > 4) {
    return dateA - dateB;
  }

  return strA.localeCompare(strB, "sk", { sensitivity: "base" });
}

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => acc?.[part], obj);
}

export function useTableSort<T>(data: T[]): UseTableSortReturn<T> {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  const requestSort = useCallback((key: string) => {
    setSortKey((prevKey) => {
      if (prevKey !== key) {
        setSortDirection("asc");
        return key;
      }
      setSortDirection((prevDir) => {
        if (prevDir === "asc") return "desc";
        if (prevDir === "desc") {
          setSortKey(null);
          return null;
        }
        return "asc";
      });
      return key;
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection) return data;
    const sorted = [...data].sort((a, b) => {
      const valA = getNestedValue(a, sortKey);
      const valB = getNestedValue(b, sortKey);
      const result = detectAndCompare(valA, valB);
      return sortDirection === "asc" ? result : -result;
    });
    return sorted;
  }, [data, sortKey, sortDirection]);

  return { sortedData, sortKey, sortDirection, requestSort };
}
