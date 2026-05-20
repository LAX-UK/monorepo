"use client";

import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { SegmentToggle } from "@auction/ui";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

type Props = {
  className?: string;
};

/** 7d / 30d / 90d toggle — syncs `period` search param on the current admin route. */
export function KpiPeriodControl({ className }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const period = useMemo(
    () => parseAdminKpiPeriod(searchParams.get("period") ?? undefined),
    [searchParams],
  );

  const onValueChange = useCallback(
    (next: string) => {
      const days = parseAdminKpiPeriod(next);
      const params = new URLSearchParams(searchParams.toString());
      if (days === 30) {
        params.delete("period");
      } else {
        params.set("period", String(days));
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  return (
    <div className={className}>
      <SegmentToggle
        aria-label="KPI comparison period"
        value={String(period)}
        options={[
          { value: "7", label: "7d" },
          { value: "30", label: "30d" },
          { value: "90", label: "90d" },
        ]}
        onValueChange={onValueChange}
      />
    </div>
  );
}
