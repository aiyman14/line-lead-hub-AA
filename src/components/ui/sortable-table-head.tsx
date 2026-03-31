import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { SortConfig } from "@/hooks/useSortableTable";
import { cn } from "@/lib/utils";

interface SortableTableHeadProps {
  column: string;
  sortConfig: SortConfig | null;
  onSort: (column: string) => void;
  children: React.ReactNode;
  className?: string;
}

export function SortableTableHead({
  column,
  sortConfig,
  onSort,
  children,
  className,
}: SortableTableHeadProps) {
  const isActive = sortConfig?.column === column;

  return (
    <TableHead
      className={cn("cursor-pointer select-none hover:text-foreground transition-colors", className)}
      onClick={() => onSort(column)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive ? (
          sortConfig.direction === "asc" ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </span>
    </TableHead>
  );
}
