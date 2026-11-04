import {
  PURCHASE_PROBLEM_STATUS_BADGES,
  PURCHASE_PROBLEM_STATUS_LABELS,
} from "@/lib/admin/purchase-problems/purchase-problems.vm";
import type { PurchaseProblemStatus } from "@auction/domain";
import { StaffAvatar, StatusBadge } from "@auction/staff-ui";

export function PurchaseProblemStatusBadge({ status }: { status: PurchaseProblemStatus }) {
  const badge = PURCHASE_PROBLEM_STATUS_BADGES[status];
  return (
    <StatusBadge tone={badge.tone} shape={badge.shape}>
      {PURCHASE_PROBLEM_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

/** Who owns the report: initials and name, or a dashed ring when nobody does yet. */
export function OwnerCell({
  userId,
  nameOf,
}: {
  userId: string | null;
  nameOf: (userId: string) => string | undefined;
}) {
  if (!userId) {
    return (
      <span className="inline-flex items-center gap-2 text-staff-muted">
        <StaffAvatar empty />
        Unassigned
      </span>
    );
  }
  const name = nameOf(userId);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <StaffAvatar {...(name ? { name } : { empty: true })} />
      <span className={name ? "truncate" : "truncate text-staff-muted"}>
        {name ?? "Former staff member"}
      </span>
    </span>
  );
}
