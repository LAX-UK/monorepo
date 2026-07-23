import { cn } from "@auction/ui";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  hint?: string;
  href?: string;
};

/** Shared metric tile for catalog detail KPI strips. */
export function CatalogKpiCard({ label, value, hint, href }: Props) {
  const isPlainValue = typeof value === "string" || typeof value === "number";

  const body = (
    <Surface
      variant="card"
      className="flex h-full min-w-0 flex-col overflow-hidden border-border-hairline bg-surface-container-low/30 p-3 sm:p-4"
    >
      <p className="line-clamp-2 break-words font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {label}
      </p>
      <div
        className={cn(
          "mt-1 min-w-0",
          isPlainValue
            ? "truncate text-base font-semibold tabular-nums text-on-surface sm:text-lg"
            : "flex items-center",
        )}
      >
        {value}
      </div>
      <div className="mt-auto min-h-[2.5rem] pt-1 font-body text-xs text-on-surface-variant">
        {hint ? <p className="line-clamp-2 break-words">{hint}</p> : null}
      </div>
    </Surface>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block h-full min-w-0 overflow-hidden transition-opacity hover:opacity-90"
      >
        {body}
      </Link>
    );
  }
  return <div className="h-full min-w-0 overflow-hidden">{body}</div>;
}
