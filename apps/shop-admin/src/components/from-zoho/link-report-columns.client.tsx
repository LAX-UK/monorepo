"use client";

import { useStaffCatalogueImage } from "@/components/artworks/staff-catalogue-image-provider.client";
import { LINK_RULE_CHIPS } from "@/server/domain/zoho-link-list.vm";
import { NO_MATCH_REASON_LABEL } from "@/server/domain/zoho-link.vm";
import type {
  AdminZohoLinkCandidate,
  AdminZohoLinkRow,
  AdminZohoLinkedRow,
} from "@auction/shop-contracts";
import {
  type DataColumn,
  PrimaryCell,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import { ArrowRight } from "@auction/staff-ui/icons";
import Link from "next/link";

type Listing = AdminZohoLinkRow["listing"] | AdminZohoLinkedRow["listing"];

/** The lax.art listing: its picture, title (opens the artwork) and "Artist · Live on lax.art". */
function ListingCell({ listing }: { listing: Listing }) {
  const resolve = useStaffCatalogueImage();
  return (
    <PrimaryCell
      href={`/artworks/${listing.artworkId}`}
      Link={Link}
      thumbnail={{ src: resolve(listing.imageUrl) }}
      secondary={`${listing.artistName} · ${listing.published ? "Live on lax.art" : "Draft on lax.art"}`}
    >
      {listing.title}
    </PrimaryCell>
  );
}

const LISTING = {
  id: "listing",
  header: "lax.art listing",
  mobile: "title",
  cell: (row: { listing: Listing }) => <ListingCell listing={row.listing} />,
} as const;

/** The small arrow between the listing and its record: this becomes that. */
const ARROW = {
  id: "to",
  header: "Links to",
  headerHidden: true,
  width: "40px",
  mobile: "hidden",
  cell: () => <ArrowRight aria-hidden className="size-4 text-staff-subtle" />,
} as const;

function RecordCell({
  title,
  stockCode,
  note,
}: {
  title: string;
  stockCode: string;
  note?: string | null;
}) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate text-staff-sm font-medium text-staff-fg">{title}</span>
      <span className="truncate text-staff-xs text-staff-muted tabular-nums">{stockCode}</span>
      {note ? <span className="text-staff-xs text-staff-warning-fg">{note}</span> : null}
    </span>
  );
}

/** What the row was matched on: a stock code is the strongest, so it is the one drawn in green. */
function MatchedOnChips({ rule }: { rule: NonNullable<AdminZohoLinkRow["rule"]> }) {
  return (
    <span className="flex flex-wrap gap-1">
      {LINK_RULE_CHIPS[rule].map((chip) => (
        <StatusBadge key={chip} tone={chip === "Stock code" ? "success" : "neutral"}>
          {chip}
        </StatusBadge>
      ))}
    </span>
  );
}

export const matchedColumns = (): DataColumn<AdminZohoLinkRow>[] => [
  LISTING,
  ARROW,
  {
    id: "record",
    header: "Zoho record",
    mobile: "meta",
    cell: (row) => {
      const record = row.candidates[0]?.record;
      return record ? <RecordCell title={record.title} stockCode={record.stockCode} /> : null;
    },
  },
  {
    id: "matched-on",
    header: "Matched on",
    width: "200px",
    mobile: "meta",
    truncate: false,
    cell: (row) => (row.rule ? <MatchedOnChips rule={row.rule} /> : null),
  },
  {
    id: "differences",
    header: "Differences",
    width: "150px",
    mobile: "badge",
    truncate: false,
    cell: (row) => {
      const n = row.candidates[0]?.differences.length ?? 0;
      return n === 0 ? (
        <span className="text-staff-sm text-staff-muted">Same</span>
      ) : (
        <StatusBadge tone="warning">{n === 1 ? "1 difference" : `${n} differences`}</StatusBadge>
      );
    },
  },
];

/** A record in the Needs a choice column: what it is, and why it cannot be chosen when it cannot. */
function ChoiceOption({
  row,
  candidate,
  canLink,
  onChoose,
}: {
  row: AdminZohoLinkRow;
  candidate: AdminZohoLinkCandidate;
  canLink: boolean;
  onChoose: (candidate: AdminZohoLinkCandidate) => void;
}) {
  const { record } = candidate;
  const taken = record.linkedTo !== null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <RecordCell
        title={record.title}
        stockCode={`${record.stockCode} · ${record.whereItIs}`}
        note={taken ? null : candidate.refusal}
      />
      {taken ? (
        <StatusBadge tone="neutral">Linked to ‘{record.linkedTo}’</StatusBadge>
      ) : canLink ? (
        <StaffButton
          size="sm"
          variant="secondary"
          disabled={candidate.refusal !== null}
          aria-label={`Choose ${record.stockCode} for ${row.listing.title}`}
          onClick={() => onChoose(candidate)}
        >
          Choose…
        </StaffButton>
      ) : null}
    </li>
  );
}

export const choiceColumns = (input: {
  canLink: boolean;
  onChoose: (row: AdminZohoLinkRow, candidate: AdminZohoLinkCandidate) => void;
}): DataColumn<AdminZohoLinkRow>[] => [
  LISTING,
  ARROW,
  {
    id: "records",
    header: "Zoho records",
    mobile: "meta",
    truncate: false,
    cell: (row) => (
      <ul
        aria-label={`Records that could be ${row.listing.title}`}
        className="flex flex-col gap-2 py-1"
      >
        {row.candidates.map((candidate) => (
          <ChoiceOption
            key={candidate.record.registerId}
            row={row}
            candidate={candidate}
            canLink={input.canLink}
            onChoose={(chosen) => input.onChoose(row, chosen)}
          />
        ))}
      </ul>
    ),
  },
];

export const noMatchColumns = (input: {
  canLink: boolean;
  onFind: (row: AdminZohoLinkRow) => void;
}): DataColumn<AdminZohoLinkRow>[] => [
  LISTING,
  {
    id: "why",
    header: "Why there is no match",
    mobile: "meta",
    truncate: false,
    cell: (row) => (
      <span className="text-staff-sm text-staff-muted">
        {row.reason ? NO_MATCH_REASON_LABEL[row.reason] : "No match"}
      </span>
    ),
  },
  {
    id: "find",
    header: "Find",
    headerHidden: true,
    width: "140px",
    mobile: "actions",
    truncate: false,
    cell: (row) =>
      input.canLink ? (
        <StaffButton size="sm" variant="secondary" onClick={() => input.onFind(row)}>
          Find in Zoho…
        </StaffButton>
      ) : null,
  },
];

export const linkedColumns = (): DataColumn<AdminZohoLinkedRow>[] => [
  LISTING,
  ARROW,
  {
    id: "record",
    header: "Zoho record",
    mobile: "meta",
    cell: (row) => <RecordCell title={row.record.title} stockCode={row.record.stockCode} />,
  },
  {
    id: "by",
    header: "Linked by",
    width: "160px",
    mobile: "meta",
    cell: (row) => row.linkedBy ?? "Not recorded",
  },
  {
    id: "when",
    header: "Linked",
    width: "150px",
    mobile: "meta",
    truncate: false,
    cell: (row) => <StaffDate value={row.linkedAt} />,
  },
];
