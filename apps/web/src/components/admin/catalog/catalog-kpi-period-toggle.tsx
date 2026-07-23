"use client";

import type { AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import { cn } from "@auction/ui";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const PERIODS: AdminKpiPeriodDays[] = [7, 30, 90];

function periodTagLabel(days: AdminKpiPeriodDays): string {
  return `${days} Days`;
}

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
              "inline-flex min-h-8 items-center rounded-full border px-3 font-label text-xs font-medium",
              active
                ? "border-on-surface bg-on-surface text-surface-container-lowest"
                : "border-shell-stroke bg-surface-container-lowest text-on-surface-variant hover:border-on-surface-variant hover:text-on-surface",
            )}
          >
            {periodTagLabel(days)}
          </Link>
        );
      })}
    </fieldset>
  );
}
