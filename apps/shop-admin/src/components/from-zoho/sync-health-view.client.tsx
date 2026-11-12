"use client";

import {
  FROM_ZOHO_DESCRIPTION,
  FROM_ZOHO_TITLE,
  useQueueFrame,
} from "@/components/from-zoho/use-queue-frame.client";
import type { ZohoQueueQuery } from "@/server/domain/zoho-register.vm";
import {
  SYNC_OFF_COPY,
  driftFigures,
  failedJobsHref,
  inboundFigures,
  listingFigures,
  outboundFigures,
  tokenFigures,
  tokenNotice,
} from "@/server/domain/zoho-sync-health.vm";
import type { AdminZohoSyncHealth } from "@auction/shop-contracts";
import {
  EmptyState,
  Notice,
  PageHeader,
  Skeleton,
  StatGrid,
  formatStaffDateTime,
} from "@auction/staff-ui";
import Link from "next/link";

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id={id} className="font-staff text-staff-md font-semibold text-staff-fg">
          {title}
        </h2>
        <p className="max-w-prose text-staff-sm text-staff-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * How the Zoho sync is doing, in the From Zoho tab strip: the last inbound run, the last nightly
 * listing and Status check, the writes waiting to go to Zoho, the token, and where Zoho and LAX
 * disagree (each count opens its list). With the sync off it says so and shows nothing else.
 */
export function SyncHealthView({
  query,
  counts,
  health,
  now,
  unlinked = 0,
  bidAdminUrl = null,
}: {
  query: ZohoQueueQuery;
  counts: { new: number; decisions: number };
  health: AdminZohoSyncHealth;
  /** When the page was built, as an ISO time: what "overdue" is measured against. */
  now: string;
  unlinked?: number;
  bidAdminUrl?: string | null;
}) {
  const { views, pending } = useQueueFrame(query, counts, unlinked);
  const notice = tokenNotice(health.token.status);
  const failedJobs = failedJobsHref(bidAdminUrl);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={FROM_ZOHO_TITLE} description={FROM_ZOHO_DESCRIPTION} />
      <div className="rounded-staff-lg border border-staff-line bg-staff-surface">
        <div className="border-b border-staff-line-subtle px-2">{views}</div>
        {pending ? (
          <output className="flex flex-col gap-4 p-4" aria-label="Loading sync health">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </output>
        ) : health.zohoOff ? (
          <EmptyState
            illustration="plinth"
            title={SYNC_OFF_COPY.title}
            description={SYNC_OFF_COPY.description}
          />
        ) : (
          <div className="flex flex-col gap-8 p-4">
            {notice ? (
              <Notice tone={notice.tone} title={notice.title} alert={notice.tone === "danger"}>
                {notice.description}
              </Notice>
            ) : null}
            <Section
              id="inbound-title"
              title="From Zoho to LAX"
              description="The nightly check reads every Product changed in Zoho and brings it into LAX."
            >
              <StatGrid
                label="Last inbound run"
                narrowColumns={1}
                items={inboundFigures(health.inbound.run, formatStaffDateTime, now)}
              />
            </Section>
            <Section
              id="listing-title"
              title="LAX listing and Status in Zoho"
              description="The nightly check compares each artwork's listing and Status in Zoho with its place in LAX and corrects any that differ."
            >
              <StatGrid
                label="Last listing and Status check"
                narrowColumns={1}
                items={listingFigures(health.listing.run, formatStaffDateTime, now)}
              />
            </Section>
            <Section
              id="outbound-title"
              title="Writes to Zoho"
              description="Changes LAX is sending to Zoho Products. Writes that gave up after their retries wait in Failed jobs."
            >
              <StatGrid
                label="Write queue to Zoho"
                columns={3}
                narrowColumns={1}
                items={outboundFigures(health.outbound, formatStaffDateTime, failedJobs, now)}
                Link={Link}
              />
            </Section>
            <Section
              id="token-title"
              title="Zoho connection"
              description="LAX signs in to Zoho with a token it renews by itself every hour."
            >
              <StatGrid
                label="Zoho token"
                columns={3}
                narrowColumns={1}
                items={tokenFigures(health.token, formatStaffDateTime)}
              />
            </Section>
            <Section
              id="drift-title"
              title="Where Zoho and LAX disagree"
              description="Zoho is the source of truth for the catalogue. Open a list to see the artworks."
            >
              <StatGrid
                label="Drift"
                items={driftFigures(health.drift)}
                Link={Link}
                columns={3}
                narrowColumns={1}
              />
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
