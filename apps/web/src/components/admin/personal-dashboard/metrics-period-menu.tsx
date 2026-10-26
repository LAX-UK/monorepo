"use client";

import { ADMIN_KPI_PERIODS, type AdminKpiPeriodDays } from "@/lib/admin/admin-kpi-period";
import {
  StaffButton,
  StaffMenu,
  StaffMenuContent,
  StaffMenuLabel,
  StaffMenuRadioGroup,
  StaffMenuRadioItem,
  StaffMenuTrigger,
} from "@auction/staff-ui";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** The period the Overview trends cover, as a menu beside the numbers. 30 days is the default. */
export function MetricsPeriodMenu({ current }: { current: AdminKpiPeriodDays }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const choose = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "30") params.delete("period");
    else params.set("period", value);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <StaffMenu>
      <StaffMenuTrigger asChild>
        <StaffButton size="sm" variant="ghost">
          Last {current} days
          <ChevronDown aria-hidden />
        </StaffButton>
      </StaffMenuTrigger>
      <StaffMenuContent>
        <StaffMenuLabel>Trends over</StaffMenuLabel>
        <StaffMenuRadioGroup value={String(current)} onValueChange={choose}>
          {ADMIN_KPI_PERIODS.map((days) => (
            <StaffMenuRadioItem key={days} value={String(days)}>
              Last {days} days
            </StaffMenuRadioItem>
          ))}
        </StaffMenuRadioGroup>
      </StaffMenuContent>
    </StaffMenu>
  );
}
