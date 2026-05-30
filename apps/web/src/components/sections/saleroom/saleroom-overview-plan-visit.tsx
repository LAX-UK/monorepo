import {
  AddSaleToCalendarButton,
  RequestViewingMailtoButton,
} from "@/components/sections/artwork/onsite/onsite-calendar-actions";
import { SITE_BUSINESS_HOURS_LABEL } from "@/lib/brand";
import type { Sale } from "@auction/types";
import { formatPostalAddressLines } from "@auction/validators";
import { formatLongDateTime } from "./mappers";

type Props = {
  sale: Sale;
  /** Optional one-line teaser of featured lot titles (onsite engagement). */
  featuredLotTitles?: readonly string[];
};

function locationOneLine(sale: Sale): string {
  const lines = formatPostalAddressLines(sale);
  return [sale.locationName, ...lines].filter(Boolean).join(", ");
}

/** Onsite-only "Plan your visit" block for the sale overview panel. */
export function SaleroomOverviewPlanVisit({ sale, featuredLotTitles }: Props) {
  if (sale.deliveryMode !== "onsite") return null;

  const locationLine = locationOneLine(sale);
  const eventStartLabel = formatLongDateTime(sale.startTime);
  const eventEndLabel = formatLongDateTime(sale.endTime);
  const previewLabel = sale.previewStartTime ? formatLongDateTime(sale.previewStartTime) : null;
  const teaser =
    featuredLotTitles && featuredLotTitles.length > 0
      ? featuredLotTitles.slice(0, 3).join(" · ")
      : null;

  return (
    <section
      id="plan-visit"
      aria-labelledby="saleroom-plan-visit"
      className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-7 dark:bg-surface-container-low/40 lg:col-span-2"
    >
      <h2 id="saleroom-plan-visit" className="font-body text-xl font-semibold text-on-surface">
        Plan your visit
      </h2>
      <p className="mt-2 text-sm text-on-surface-variant">{SITE_BUSINESS_HOURS_LABEL}</p>
      {teaser ? (
        <p className="mt-3 text-sm text-on-surface-variant">
          <span className="font-medium text-on-surface">Catalogue highlights:</span> {teaser}
        </p>
      ) : null}
      <dl className="mt-4 space-y-2 text-sm text-on-surface">
        <div>
          <dt className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            Auction session
          </dt>
          <dd className="mt-1">
            {eventStartLabel} — {eventEndLabel}
          </dd>
        </div>
        {previewLabel ? (
          <div>
            <dt className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Preview from
            </dt>
            <dd className="mt-1">{previewLabel}</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <AddSaleToCalendarButton sale={sale} lotTitle={sale.title} locationLine={locationLine} />
        <RequestViewingMailtoButton sale={sale} lotTitle={sale.title} />
      </div>
    </section>
  );
}
