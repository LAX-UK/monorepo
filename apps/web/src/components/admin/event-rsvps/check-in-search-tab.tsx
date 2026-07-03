import { formatDateTime } from "@/lib/ui/format";
import type { OnsiteEventCheckInSearchRow } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Input } from "@auction/ui/components/input";

type Props = {
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  searchResults: OnsiteEventCheckInSearchRow[];
  searchError: string | null;
  searching: boolean;
  busy: boolean;
  onCheckIn: (rsvpId: string) => void;
};

export function CheckInSearchTab({
  searchQuery,
  onSearchQueryChange,
  searchResults,
  searchError,
  searching,
  busy,
  onCheckIn,
}: Props) {
  return (
    <div className="space-y-4">
      <Input
        value={searchQuery}
        onChange={(e) => onSearchQueryChange(e.target.value)}
        placeholder="Search by name or email"
        aria-label="Search guests"
      />
      <div className="space-y-2">
        {searching ? <p className="font-body text-sm text-on-surface-variant">Searching…</p> : null}
        {searchError ? <p className="font-body text-sm text-destructive">{searchError}</p> : null}
        {!searching &&
        !searchError &&
        searchQuery.trim().length >= 2 &&
        searchResults.length === 0 ? (
          <p className="font-body text-sm text-on-surface-variant">
            No guests match “{searchQuery.trim()}”.
          </p>
        ) : null}
        {searchResults.map((row) => (
          <Button
            key={row.rsvpId}
            type="button"
            variant="outline"
            className="flex h-auto w-full min-h-11 flex-col items-start rounded-lg px-4 py-3 text-left"
            disabled={busy}
            aria-label={`Check in ${row.name}`}
            onClick={() => onCheckIn(row.rsvpId)}
          >
            <span className="font-medium">{row.name}</span>
            <span className="font-body text-xs text-on-surface-variant">
              {row.email} · {row.attendanceSegmentLabel}
              {row.checkedInAt ? ` · Checked in ${formatDateTime(row.checkedInAt)}` : ""}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
