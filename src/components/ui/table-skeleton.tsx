import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TableSkeletonProps {
  columns: number;
  rows?: number;
  headers?: string[];
}

export function TableSkeleton({ columns, rows = 5, headers }: TableSkeletonProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/50">
          {(headers || Array.from({ length: columns })).map((header, i) => (
            <TableHead key={i}>
              {header ? (
                <span>{header}</span>
              ) : (
                <Skeleton className="h-4 w-16" />
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <TableRow key={rowIndex}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <TableCell key={colIndex}>
                <Skeleton
                  className={`h-4 ${
                    colIndex === 0 ? "w-16" : colIndex === columns - 1 ? "w-12" : "w-20"
                  }`}
                />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface CardSkeletonProps {
  count?: number;
}

export function StatsCardsSkeleton({ count = 4 }: CardSkeletonProps) {
  return (
    <div className={`grid grid-cols-2 ${count >= 4 ? "lg:grid-cols-4" : `md:grid-cols-${count}`} gap-3`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-4">
          <Skeleton className="h-3 w-24 mb-2" />
          <Skeleton className="h-7 w-16" />
        </div>
      ))}
    </div>
  );
}
