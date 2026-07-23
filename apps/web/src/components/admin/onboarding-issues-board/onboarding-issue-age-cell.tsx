"use client";

import {
  adminIssueAgeUrgency,
  formatAdminRelativeTimeLabel,
} from "@/lib/admin/format-admin-relative-time";
import { cn } from "@auction/ui";

type Props = {
  iso: string | null | undefined;
  className?: string;
};

export function OnboardingIssueAgeCell({ iso, className }: Props) {
  const label = formatAdminRelativeTimeLabel(iso ?? null);
  if (!label) {
    return <span className={cn("text-sm text-on-surface-variant", className)}>—</span>;
  }
  const urgency = adminIssueAgeUrgency(iso ?? null);
  const tone =
    urgency === "stale"
      ? "text-destructive"
      : urgency === "attention"
        ? "text-warning"
        : "text-on-surface";

  return (
    <div className={cn("min-w-0", className)}>
      <p className={cn("text-sm font-medium tabular-nums", tone)}>{label}</p>
      <p className="text-[11px] text-on-surface-variant">
        {urgency === "stale" ? "Stale" : urgency === "attention" ? "Aging" : "Recent"}
      </p>
    </div>
  );
}
