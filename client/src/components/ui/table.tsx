import * as React from "react"
import { useState, useCallback, useRef } from "react"
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import type { SortDirection } from "@/hooks/use-table-sort"

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  stickyHeader?: boolean;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, stickyHeader, ...props }, ref) => (
    <div className="relative w-full" style={stickyHeader ? { overflow: 'visible' } : { overflowX: 'auto' }}>
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm border-separate border-spacing-0", className)}
        {...props}
      />
    </div>
  )
)
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn("[&_tr]:border-b", className)}
    style={{ position: 'sticky', top: 0, zIndex: 50 }}
    {...props}
  />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const INTERACTIVE_SELECTORS = "button, a, input, select, textarea, [role=checkbox], [role=switch], [role=button], [data-no-row-click]";

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  onRowClick?: () => void;
}

const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, onClick, onRowClick, ...props }, ref) => {
    const handleClick = useCallback((e: React.MouseEvent<HTMLTableRowElement>) => {
      if (onClick) onClick(e);
      if (!onRowClick) return;
      const target = e.target as HTMLElement;
      if (target.closest(INTERACTIVE_SELECTORS)) return;
      onRowClick();
    }, [onClick, onRowClick]);

    return (
      <tr
        ref={ref}
        className={cn(
          "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
          onRowClick && "cursor-pointer",
          className
        )}
        onClick={handleClick}
        {...props}
      />
    );
  }
)
TableRow.displayName = "TableRow"

interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  resizable?: boolean;
  sortKey?: string;
  sortDirection?: SortDirection;
  onSort?: (key: string) => void;
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, resizable = true, children, style, sortKey, sortDirection, onSort, ...props }, ref) => {
    const thRef = useRef<HTMLTableCellElement | null>(null);
    const [dragging, setDragging] = useState(false);

    const setRefs = useCallback((node: HTMLTableCellElement | null) => {
      thRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLTableCellElement | null>).current = node;
    }, [ref]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!thRef.current) return;

      const th = thRef.current;
      const startX = e.clientX;
      const startWidth = th.getBoundingClientRect().width;

      const table = th.closest("table");
      if (table && table.style.tableLayout !== "fixed") {
        const headerCells = table.querySelectorAll("thead > tr:first-child > th");
        headerCells.forEach((cell) => {
          const w = cell.getBoundingClientRect().width;
          (cell as HTMLElement).style.width = `${w}px`;
        });
        table.style.tableLayout = "fixed";
      }

      setDragging(true);
      document.body.style.cursor = "col-resize";
      table?.classList.add("select-none");

      const handleMouseMove = (ev: MouseEvent) => {
        const diff = ev.clientX - startX;
        const newWidth = Math.max(40, startWidth + diff);
        th.style.width = `${newWidth}px`;
      };

      const handleMouseUp = () => {
        setDragging(false);
        document.body.style.cursor = "";
        table?.classList.remove("select-none");
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }, []);

    const hasColSpan = props.colSpan && props.colSpan > 1;
    const showHandle = resizable && !hasColSpan;
    const isSortable = !!sortKey && !!onSort;

    const handleSortClick = useCallback((e: React.MouseEvent) => {
      if (isSortable && sortKey) {
        onSort!(sortKey);
      }
    }, [isSortable, sortKey, onSort]);

    const renderSortIcon = () => {
      if (!isSortable) return null;
      if (sortDirection === "asc") {
        return <ArrowUp className={cn("inline-block ml-1 h-3.5 w-3.5 shrink-0 text-primary")} />;
      }
      if (sortDirection === "desc") {
        return <ArrowDown className={cn("inline-block ml-1 h-3.5 w-3.5 shrink-0 text-primary")} />;
      }
      return <ArrowUpDown className="inline-block ml-1 h-3.5 w-3.5 shrink-0 opacity-30" />;
    };

    return (
      <th
        ref={setRefs}
        className={cn(
          "px-4 h-12 text-left align-middle font-medium text-muted-foreground bg-background [&:has([role=checkbox])]:pr-0 border-b border-border shadow-[0_1px_3px_-1px_rgba(0,0,0,0.1)]",
          showHandle && "relative",
          isSortable && "cursor-pointer select-none",
          className
        )}
        style={style}
        onClick={isSortable ? handleSortClick : undefined}
        {...props}
      >
        <span className={cn(isSortable && "inline-flex items-center gap-0")}>
          {children}
          {renderSortIcon()}
        </span>
        {showHandle && (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              "absolute top-0 right-0 w-[5px] h-full cursor-col-resize z-10",
              "after:absolute after:top-0 after:right-[2px] after:w-[1px] after:h-full after:transition-colors after:duration-150",
              dragging
                ? "after:bg-primary"
                : "after:bg-transparent hover:after:bg-muted-foreground/40"
            )}
            data-testid="resize-handle"
          />
        )}
      </th>
    );
  }
)
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0 overflow-hidden text-ellipsis", className)}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
