import { cn } from "../../lib/utils.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table.js";

export type TableSkeletonProps = {
  rows?: number;
  columns?: number;
  className?: string;
};

const COL_KEYS = [
  "c0",
  "c1",
  "c2",
  "c3",
  "c4",
  "c5",
  "c6",
  "c7",
  "c8",
  "c9",
  "c10",
  "c11",
  "c12",
  "c13",
  "c14",
  "c15",
];
const ROW_KEYS = [
  "r0",
  "r1",
  "r2",
  "r3",
  "r4",
  "r5",
  "r6",
  "r7",
  "r8",
  "r9",
  "r10",
  "r11",
  "r12",
  "r13",
  "r14",
  "r15",
];

/** Lightweight loading placeholder for admin data tables. */
export function TableSkeleton({ rows = 8, columns = 5, className }: TableSkeletonProps) {
  const colKeys = COL_KEYS.slice(0, columns);
  const rowKeys = ROW_KEYS.slice(0, rows);
  return (
    <div className={cn("animate-pulse rounded-md border border-outline-variant/20", className)}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {colKeys.map((colKey) => (
              <TableHead key={colKey}>
                <div className="h-4 w-20 rounded bg-surface-container-high" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowKeys.map((rowKey) => (
            <TableRow key={rowKey} className="hover:bg-transparent">
              {colKeys.map((colKey) => (
                <TableCell key={`${rowKey}-${colKey}`}>
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
