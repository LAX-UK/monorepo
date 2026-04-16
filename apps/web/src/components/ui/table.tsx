import type { KeyboardEvent, ReactNode } from "react";

type TableProps = { children: ReactNode; className?: string };

export function Table({ children, className = "" }: TableProps) {
  return (
    <div className={`overflow-x-auto rounded-lg border border-outline-variant/15 ${className}`}>
      <table className="w-full min-w-lg border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-surface-container-low font-label text-xs uppercase tracking-widest text-secondary">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return (
    <tbody className="divide-y divide-outline-variant/10 bg-surface-container-lowest">
      {children}
    </tbody>
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
    <tr
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
    </tr>
  );
}

export function TableCell({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <td className={`px-4 py-3 align-middle font-body text-on-surface ${className}`}>{children}</td>
  );
}

export function TableHeaderCell({
  children,
  className = "",
}: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-medium ${className}`}>{children}</th>;
}
