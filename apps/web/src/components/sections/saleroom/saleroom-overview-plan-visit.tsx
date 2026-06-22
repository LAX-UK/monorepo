import {
  AddSaleToCalendarButton,
  RequestViewingMailtoButton,
} from "@/components/sections/artwork/onsite/onsite-calendar-actions";
import { SITE_BUSINESS_HOURS_LABEL } from "@/lib/brand";
import type { Sale } from "@auction/types";
import { DisplayHeading } from "@auction/ui";
import { formatPostalAddressLines, isSaleroomDeliveryMode } from "@auction/validators";
import Link from "next/link";

type Props = {
  sale: Sale;
};

function locationOneLine(sale: Sale): string {
  const lines = formatPostalAddressLines(sale);
  return [sale.locationName, ...lines].filter(Boolean).join(", ");
}

/** Saleroom "Plan your visit" block for onsite and hybrid sales. */
export function SaleroomOverviewPlanVisit({ sale }: Props) {
  if (!isSaleroomDeliveryMode(sale.deliveryMode)) return null;

  const locationLine = locationOneLine(sale);

  return (
    <section
      id="plan-visit"
      aria-labelledby="saleroom-plan-visit"
      className="rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-7 dark:bg-surface-container-low/40 lg:col-span-2"
    >
      <DisplayHeading as="h2" id="saleroom-plan-visit" size="section" className="font-semibold">
        Plan your visit
      </DisplayHeading>
      <p className="mt-2 text-sm text-on-surface-variant">{SITE_BUSINESS_HOURS_LABEL}</p>
      {locationLine ? (
        <p className="mt-3 text-sm text-on-surface">
          {locationLine}{" "}
          <Link href="#venue" className="font-medium underline underline-offset-4">
            View map
          </Link>
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <AddSaleToCalendarButton sale={sale} lotTitle={sale.title} locationLine={locationLine} />
        <RequestViewingMailtoButton sale={sale} lotTitle={sale.title} />
      </div>
    </section>
  );
}
