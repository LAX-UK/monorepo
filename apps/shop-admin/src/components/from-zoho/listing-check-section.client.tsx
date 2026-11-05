"use client";

import {
  SYNC_MODE_LABEL,
  failedDeliveriesNote,
  listingFailureLabel,
  listingFigures,
} from "@/server/domain/zoho-register.vm";
import type { AdminRegisterLastCheck } from "@auction/shop-contracts";
import { Notice, StatGrid, StatusBadge, TextLink, formatStaffDateTime } from "@auction/staff-ui";
import Link from "next/link";

const recordHref = (registerId: string) => `/from-zoho/${registerId}`;

/**
 * The other direction of the Zoho check: the LAX listing LAX keeps on each Zoho Product, so staff
 * working in Zoho see where an artwork is. Shows the latest nightly pass, the artworks it could
 * not write (each linking to its record) and any writes that stopped after their retries.
 */
export function ListingCheckSection({ listing }: { listing: AdminRegisterLastCheck["listing"] }) {
  const { run, failedDeliveries } = listing;
  const note = failedDeliveriesNote(failedDeliveries);

  return (
    <section
      aria-labelledby="listing-check-title"
      className="flex flex-col gap-4 border-t border-staff-line-subtle p-4"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="listing-check-title"
          className="font-staff text-staff-md font-semibold text-staff-fg"
        >
          LAX listing in Zoho
        </h2>
        <p className="max-w-prose text-staff-sm text-staff-muted">
          Each Zoho Product shows where the artwork is in LAX, with a link. Every night LAX checks
          them all and corrects any that differ.
        </p>
      </div>

      {run ? (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-staff-sm text-staff-muted">
              Checked {formatStaffDateTime(run.finishedAt)}
            </p>
            <StatusBadge tone={run.mode === "dry_run" ? "warning" : "success"}>
              {SYNC_MODE_LABEL[run.mode]}
            </StatusBadge>
          </div>
          <StatGrid label="LAX listing check" items={listingFigures(run)} />
          {run.failures.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-2">
              <h3 className="font-staff text-staff-sm font-semibold text-staff-fg">
                Not written to Zoho
              </h3>
              <ul className="divide-y divide-staff-line-subtle rounded-staff-md border border-staff-line-subtle">
                {run.failures.map((failure) => (
                  <li
                    key={failure.registerId}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-staff-sm"
                  >
                    <TextLink href={recordHref(failure.registerId)} Link={Link}>
                      {failure.stockCode || "Artwork record"}
                    </TextLink>
                    <span className="text-staff-muted">{listingFailureLabel(failure.code)}</span>
                  </li>
                ))}
              </ul>
              {run.failed > run.failures.length ? (
                <p className="text-staff-sm text-staff-muted">
                  Showing the first {run.failures.length} of {run.failed}. The next check tries them
                  all again.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : (
        <p className="text-staff-sm text-staff-muted">
          No listing check has run yet. Its result appears here after the first night.
        </p>
      )}

      {note ? <Notice tone="warning" title={note} /> : null}
    </section>
  );
}
