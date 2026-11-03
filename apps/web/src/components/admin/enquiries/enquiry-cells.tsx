import {
  ENQUIRY_STATUS_BADGES,
  ENQUIRY_STATUS_LABELS,
  type EnquiryWaiting,
} from "@/lib/admin/enquiries/enquiries.vm";
import type { EnquiryStatus } from "@auction/domain";
import { EmptyValue, StaffAvatar, StatusBadge } from "@auction/staff-ui";

export function EnquiryStatusBadge({ status }: { status: EnquiryStatus }) {
  const badge = ENQUIRY_STATUS_BADGES[status];
  return (
    <StatusBadge tone={badge.tone} shape={badge.shape}>
      {ENQUIRY_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

/**
 * How long the enquiry has waited. Quiet text until the reply is close to due, a warning badge in
 * the last day, and a danger badge once the two business days are over; nothing once it has ended.
 */
export function WaitingCell({ waiting }: { waiting: EnquiryWaiting | null }) {
  if (!waiting) return <EmptyValue />;
  if (waiting.tone === "neutral") {
    return (
      <span className="tabular-nums text-staff-muted">
        {waiting.text}
        <span className="sr-only">. {waiting.description}</span>
      </span>
    );
  }
  return (
    <StatusBadge tone={waiting.tone}>
      {waiting.text}
      <span className="sr-only">. {waiting.description}</span>
    </StatusBadge>
  );
}

/** Who has the enquiry: initials and name, or a dashed ring when nobody does yet. */
export function AssigneeCell({
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
