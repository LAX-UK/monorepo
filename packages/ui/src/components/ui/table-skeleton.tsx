import { cn } from "../../lib/utils.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table.js";

export type TableSkeletonProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

/** Lightweight loading placeholder for admin data tables. */
export function TableSkeleton({ rows = 8, columns = 5, className }: TableSkeletonProps) {
  return (
    <div className={cn("animate-pulse rounded-md border border-outline-variant/20", className)}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {Array.from({ length: columns }).map((_, i) => (
              <TableHead key={i}>
                <div className="h-4 w-20 rounded bg-surface-container-high" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r} className="hover:bg-transparent">
              {Array.from({ length: columns }).map((_, c) => (
                <TableCell key={c}>
                  <div className="h-4 w-full max-w-[12rem] rounded bg-surface-container-high" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
