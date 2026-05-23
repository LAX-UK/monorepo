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
  const body = (
    <Surface variant="card" className="border-border-hairline bg-surface-container-low/30 p-4">
      <p className="font-label text-[10px] font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        {label}
      </p>
      <p className="mt-1 font-body text-lg font-semibold tabular-nums text-on-surface">{value}</p>
      {hint ? <p className="mt-1 font-body text-xs text-on-surface-variant">{hint}</p> : null}
    </Surface>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-opacity hover:opacity-90">
        {body}
      </Link>
    );
  }
  return body;
}
