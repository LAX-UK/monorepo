import { cn } from "@auction/ui";
import {
  TableBody as UiTableBody,
  TableCell as UiTableCell,
  TableRow as UiTableRow,
  TableHead as UiTableTh,
  TableHeader as UiTableThead,
} from "@auction/ui/components/table";
import type { KeyboardEvent, ReactNode } from "react";

type TableProps = { children: ReactNode; className?: string };

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className={cn("overflow-x-auto rounded-lg border border-border-hairline", className)}>
      <table className="w-full min-w-lg border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <UiTableThead className="bg-surface-container-low font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
      {children}
    </UiTableThead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return (
    <UiTableBody className="divide-y divide-outline-variant/10 bg-surface-container-lowest">
      {children}
    </UiTableBody>
  );
}

export function TableRow({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  const interactive = Boolean(onClick);

  const onKeyDown = interactive
    ? (e: KeyboardEvent<HTMLTableRowElement>) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }
    : undefined;

  return (
    <UiTableRow
      onClick={onClick}
      onKeyDown={onKeyDown}
      tabIndex={interactive ? 0 : undefined}
      className={
        interactive
          ? "cursor-pointer transition-colors hover:bg-surface-container-low/80"
          : undefined
      }
    >
      {children}
    </UiTableRow>
  );
}

export function TableCell({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <UiTableCell className={cn("px-4 py-3 align-middle font-body text-on-surface", className)}>
      {children}
    </UiTableCell>
  );
}

export function TableHeaderCell({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return <UiTableTh className={cn("px-4 py-3 font-medium", className)}>{children}</UiTableTh>;
}
