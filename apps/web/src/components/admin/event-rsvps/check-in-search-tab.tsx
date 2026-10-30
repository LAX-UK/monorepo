import {
  Field,
  Notice,
  StaffButton,
  StatusBadge,
  TextInput,
  formatStaffDateTime,
} from "@auction/staff-ui";
import type { OnsiteEventCheckInSearchRow } from "@auction/types";
import { Search } from "lucide-react";

type Props = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: readonly OnsiteEventCheckInSearchRow[];
  searchError: string | null;
  searching: boolean;
  busy: boolean;
  onCheckIn: (rsvpId: string) => void;
};

/** Find a guest by name or email and admit them. */
export function CheckInSearchTab({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searchError,
  searching,
  busy,
  onCheckIn,
}: Props) {
  const query = searchQuery.trim();
  return (
    <div className="flex flex-col gap-4">
      <Field label="Search guests" description="Type at least two letters of a name or email.">
        <TextInput
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Name or email"
          autoComplete="off"
          leading={<Search aria-hidden />}
        />
      </Field>
      {searching ? <p className="text-staff-sm text-staff-muted">Searching…</p> : null}
      {searchError ? (
        <Notice tone="danger" alert title="The search did not finish">
          {searchError}
        </Notice>
      ) : null}
      {!searching && !searchError && query.length >= 2 && searchResults.length === 0 ? (
        <p className="text-staff-sm text-staff-muted">No guests match “{query}”.</p>
      ) : null}
      {searchResults.length > 0 ? (
        <ul className="divide-y divide-staff-line-subtle overflow-hidden rounded-staff-lg border border-staff-line bg-staff-surface">
          {searchResults.map((row) => (
            <li
              key={row.rsvpId}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-staff-md font-medium text-staff-fg">{row.name}</span>
                <span className="truncate text-staff-sm text-staff-muted">
                  {row.email} · {row.attendanceSegmentLabel}
                </span>
                {row.checkedInAt ? (
                  <span className="flex items-center gap-2 text-staff-sm text-staff-muted">
                    <StatusBadge tone="success">Arrived</StatusBadge>
                    {formatStaffDateTime(row.checkedInAt, { zoneLabel: true })}
                  </span>
                ) : null}
              </div>
              <StaffButton
                variant={row.checkedInAt ? "secondary" : "primary"}
                disabled={busy}
                aria-label={`Check in ${row.name}`}
                onClick={() => onCheckIn(row.rsvpId)}
              >
                Check in
              </StaffButton>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
