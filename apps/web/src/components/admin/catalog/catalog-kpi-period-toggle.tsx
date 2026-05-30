"use client";

import { type AdminKpiPeriodDays, adminKpiPeriodLabel } from "@/lib/admin/admin-kpi-period";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const PERIODS: AdminKpiPeriodDays[] = [7, 30, 90];

type Props = {
  current: AdminKpiPeriodDays;
  className?: string;
};

/** Toggle KPI trend window (?period=) for admin catalog list pages. */
export function CatalogKpiPeriodToggle({ current, className }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <fieldset
      className={cn("flex flex-wrap items-center gap-1 border-0 p-0 m-0 min-w-0", className)}
    >
      <legend className="sr-only">KPI trend period</legend>
      <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
        Trend
      </span>
      {PERIODS.map((days) => {
        const params = new URLSearchParams(searchParams.toString());
        if (days === 30) {
          params.delete("period");
        } else {
          params.set("period", String(days));
        }
        const href = params.toString() ? `${pathname}?${params}` : pathname;
        const active = current === days;
        return (
          <Link
            key={days}
            href={href}
            aria-current={active ? "true" : undefined}
            className={cn(
              "inline-flex min-h-9 items-center rounded-md border px-2.5 font-label text-[10px] uppercase tracking-[0.12em]",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low",
            )}
          >
            {adminKpiPeriodLabel(days)}
          </Link>
        );
      })}
    </fieldset>
  );
}
