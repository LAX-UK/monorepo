"use client";

import { KeyValueList, Notice, Skeleton, StaffButton } from "@auction/staff-ui";
import type { AdminEmailChangeKycRecord } from "@auction/validators";

/** "10 December 1990": a date of birth read aloud and compared, so no numeric shorthand. */
export function formatDateOfBirth(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type KycRecordState =
  | { status: "loading" }
  | { status: "ready"; record: AdminEmailChangeKycRecord }
  | { status: "none" }
  | { status: "error"; message: string };

/**
 * The verified details staff compare with what the caller says. Name and date of birth only:
 * enough to tell a real owner from someone who has found the address, and nothing more.
 */
export function KycRecordPanel({
  state,
  onRetry,
}: {
  state: KycRecordState;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <output
        aria-label="Loading the verified KYC record"
        className="flex flex-col gap-2 rounded-staff-md border border-staff-line bg-staff-sunken p-3"
      >
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-56" />
      </output>
    );
  }
  if (state.status === "none") {
    return (
      <Notice tone="warning" title="No verified KYC record to match">
        Use a fresh ID check instead.
      </Notice>
    );
  }
  if (state.status === "error") {
    return (
      <Notice
        tone="danger"
        alert
        title="The KYC record could not be loaded"
        actions={
          <StaffButton variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </StaffButton>
        }
      >
        {state.message}
      </Notice>
    );
  }
  const { record } = state;
  return (
    <div className="rounded-staff-md border border-staff-line bg-staff-sunken px-3 py-1">
      <KeyValueList
        items={[
          { label: "Verified name", value: `${record.firstName} ${record.lastName}` },
          { label: "Date of birth", value: formatDateOfBirth(record.dateOfBirth) },
        ]}
      />
    </div>
  );
}

/** What happens next, once the change has been started. */
export function EmailChangeDone({
  name,
  pendingEmail,
  currentEmail,
}: {
  name: string;
  pendingEmail: string;
  currentEmail: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Notice tone="success" title="Confirmation sent">
        {pendingEmail} has to follow the link before the address changes.
      </Notice>
      <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-staff-sm text-staff-fg marker:text-staff-muted">
        <li>
          We emailed a confirmation link to <strong className="font-medium">{pendingEmail}</strong>.
          It works for 7 days.
        </li>
        <li>
          We told <strong className="font-medium">{currentEmail}</strong> that the change was
          started.
        </li>
        <li>{name} was signed out on every device.</li>
        <li>
          The account keeps {currentEmail} until the link is followed. If it is not followed in
          time, the change lapses and nothing is lost.
        </li>
      </ol>
    </div>
  );
}
