"use client";

import { AdminAmlHitListings } from "@/components/admin/admin-aml-hit-listings";
import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { formatAmlCheckType } from "@/lib/admin/admin-user-presenters";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { formatAmlCategoriesLabel } from "@/lib/admin/status-badge-variants";
import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import {
  type DataColumn,
  EmptyState,
  type KeyValueItem,
  KeyValueList,
  Section,
  StaffButton,
  StaffDate,
  StatusBadge,
} from "@auction/staff-ui";
import Link from "next/link";

const VERIFF_STATION_BASE =
  process.env.NEXT_PUBLIC_VERIFF_STATION_URL ?? "https://station.veriff.com";

const EARLIER_SCREENINGS_SHOWN = 10;

function Badge({ domain, status }: { domain: "amlMatch" | "amlDecision"; status: string }) {
  const presentation = staffStatus(domain, status);
  return <StatusBadge tone={presentation.tone}>{presentation.label}</StatusBadge>;
}

function hitsLabel(screening: AdminAmlScreeningRow): string {
  return `${screening.totalHits} ${screening.totalHits === 1 ? "hit" : "hits"}, ${formatAmlCategoriesLabel(screening.categories)}`;
}

const earlierColumns: DataColumn<AdminAmlScreeningRow>[] = [
  {
    id: "screened",
    header: "Screened",
    numeric: true,
    sortable: true,
    defaultSortDirection: "desc",
    mobile: "meta",
    sortValue: (screening) => Date.parse(screening.screenedAt),
    cell: (screening) => <StaffDate value={screening.screenedAt} withTime />,
  },
  {
    id: "match",
    header: "Match",
    width: "180px",
    mobile: "title",
    truncate: false,
    cell: (screening) => <Badge domain="amlMatch" status={screening.matchStatus} />,
  },
  {
    id: "hits",
    header: "Hits",
    mobile: "hidden",
    cell: (screening) => <span className="text-staff-muted">{hitsLabel(screening)}</span>,
  },
];

/** The client's latest watchlist screening with its hits, and the earlier ones in a table. */
export function AdminUserAmlPanel({ screenings }: { screenings: AdminAmlScreeningRow[] }) {
  const latest = screenings[0] ?? null;
  const earlier = screenings.slice(1);
  const queueHref = latest
    ? `/admin/compliance/aml?screening=${encodeURIComponent(latest.id)}`
    : "/admin/compliance/aml";

  const action = (
    <StaffButton asChild size="sm" variant="secondary">
      <Link href={queueHref}>
        {latest?.reviewStatus === "pending" ? "Review screening" : "Open AML list"}
      </Link>
    </StaffButton>
  );

  if (!latest) {
    return (
      <Section
        id="aml"
        title="Watchlist screening"
        description="Sanctions and politically exposed person checks."
        action={action}
        className="scroll-mt-20"
        bodyClassName="p-0"
      >
        <EmptyState
          headingLevel="h3"
          title="No watchlist screenings yet"
          description="A screening appears here after the client's identity check has been screened against watchlists."
        />
      </Section>
    );
  }

  const facts: KeyValueItem[] = [
    { label: "Match", value: <Badge domain="amlMatch" status={latest.matchStatus} /> },
    { label: "Decision", value: <Badge domain="amlDecision" status={latest.decisionOutcome} /> },
    { label: "Review", value: latest.reviewStatus === "pending" ? "Awaiting review" : "Reviewed" },
    { label: "Hits", value: hitsLabel(latest) },
    { label: "Screened", value: <StaffDate value={latest.screenedAt} withTime /> },
    { label: "Check type", value: formatAmlCheckType(latest.checkType) },
    {
      label: "Veriff verification",
      value: (
        <a
          href={`${VERIFF_STATION_BASE}/verifications/${latest.providerSessionId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Open in Veriff
        </a>
      ),
    },
    {
      label: "Veriff session ID",
      value: latest.providerSessionId,
      copyValue: latest.providerSessionId,
    },
  ];

  return (
    <>
      <Section
        id="aml"
        title="Watchlist screening"
        description="Sanctions and politically exposed person checks. Latest screening."
        action={action}
        className="scroll-mt-20"
      >
        <div className="flex flex-col gap-4">
          <KeyValueList items={facts} columns={2} />
          {latest.hits.length > 0 ? <AdminAmlHitListings hits={latest.hits} compact /> : null}
        </div>
      </Section>
      {earlier.length > 0 ? (
        <RelatedRecordsSection
          title="Earlier screenings"
          description={
            earlier.length > EARLIER_SCREENINGS_SHOWN
              ? `The latest ${EARLIER_SCREENINGS_SHOWN} of ${earlier.length}.`
              : undefined
          }
          label="Earlier watchlist screenings"
          columns={earlierColumns}
          data={earlier.slice(0, EARLIER_SCREENINGS_SHOWN)}
          getRowId={(screening) => screening.id}
          defaultSort={{ columnId: "screened", direction: "desc" }}
          empty={{ title: "No earlier screenings", description: "Earlier screenings appear here." }}
        />
      ) : null}
    </>
  );
}
