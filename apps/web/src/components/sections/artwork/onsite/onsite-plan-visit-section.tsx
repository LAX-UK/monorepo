import {
  AddSaleToCalendarButton,
  RequestViewingMailtoButton,
} from "@/components/sections/artwork/onsite/onsite-calendar-actions";
import { OnsiteSaleFactsStrip } from "@/components/sections/artwork/onsite/onsite-sale-facts-strip";
import type { SaleOverviewVM } from "@/components/sections/saleroom/view-models";
import { formatOnsitePreviewHoursLabel } from "@/lib/onsite/preview-hours-label";
import { salePath } from "@/lib/seo/url";
import type { Lot, PublicLotView, Sale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  buildGoogleMapsEmbedUrl,
  formatPostalAddressLines,
  resolveOnsiteMapUrl,
} from "@auction/validators";
import { Calendar, Clock, ExternalLink, MapPin } from "lucide-react";

type Props = {
  sale: Sale;
  auction: Lot | PublicLotView;
  overview: SaleOverviewVM;
  locationLine: string;
};

export function OnsitePlanVisitSection({ sale, auction, overview, locationLine }: Props) {
  if (sale.status === "ended" || sale.status === "cancelled") {
    return null;
  }

  const mapsUrl = resolveOnsiteMapUrl(sale);
  const embedUrl = buildGoogleMapsEmbedUrl(sale);
  const addressLines = formatPostalAddressLines(sale);
  const previewHoursLabel = formatOnsitePreviewHoursLabel(sale);

  const previewStart = sale.previewStartTime ? new Date(sale.previewStartTime) : null;
  const previewLabel =
    previewStart && Number.isFinite(previewStart.getTime())
      ? previewStart.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
      : null;

  const eventStartLabel = new Date(sale.startTime).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const eventEndLabel = new Date(sale.endTime).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <section
      id="plan-visit"
      aria-labelledby="plan-visit-heading"
      className="rounded-3xl border border-outline-variant/20 bg-surface-container-lowest p-6 shadow-sm dark:bg-surface-container-low/40 sm:p-8"
    >
      <div className="mb-6 flex items-center gap-3 border-b border-outline-variant/10 pb-5">
        <div className="rounded-full bg-primary/10 p-2.5 text-primary">
          <Calendar className="size-5" />
        </div>
        <div>
          <h2
            id="plan-visit-heading"
            className="font-headline text-2xl font-bold tracking-tight text-on-surface"
          >
            Plan Your Visit
          </h2>
          <p className="mt-1 text-xs text-on-surface-variant">
            Everything you need to visit our saleroom and preview the exhibition.
          </p>
        </div>
      </div>

      <OnsiteSaleFactsStrip overview={overview} saleTermsHref={salePath(sale)} className="mb-6" />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
              <Clock className="size-3.5" /> Opening hours
            </p>
            <p className="mt-1 text-sm font-medium text-on-surface-variant">{previewHoursLabel}</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <dt className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
                Auction session
              </dt>
              <dd className="text-sm font-medium text-on-surface">
                {eventStartLabel} — {eventEndLabel}
              </dd>
            </div>
            {previewLabel ? (
              <div className="space-y-1">
                <dt className="font-label text-[10px] font-bold uppercase tracking-widest text-secondary">
                  Preview from
                </dt>
                <dd className="text-sm font-medium text-on-surface">{previewLabel}</dd>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col gap-3 border-t border-outline-variant/10 pt-4 sm:flex-row sm:flex-wrap">
            <AddSaleToCalendarButton
              sale={sale}
              lotTitle={auction.title}
              locationLine={locationLine}
            />
            <RequestViewingMailtoButton sale={sale} lotTitle={auction.title} />
          </div>
        </div>

        <div className="flex flex-col justify-between overflow-hidden rounded-2xl border border-outline-variant/15 bg-surface-container-low p-4">
          <div>
            <h3 className="flex items-center gap-2 font-headline text-sm font-bold text-on-surface">
              <MapPin className="size-4 text-primary" aria-hidden />
              Saleroom Venue
            </h3>
            {sale.locationName ? (
              <p className="mt-1.5 font-body text-xs leading-relaxed text-on-surface-variant">
                {sale.locationName}
              </p>
            ) : null}
            {addressLines.length > 0 ? (
              <p className="mt-0.5 font-body text-xs font-light leading-relaxed text-on-surface-variant">
                {addressLines.join(", ")}
              </p>
            ) : null}
          </div>
          {embedUrl ? (
            <div className="mt-4 aspect-video overflow-hidden rounded-lg border border-outline-variant/10 shadow-inner">
              <iframe
                title="Saleroom Map"
                src={embedUrl}
                className="h-full w-full border-0"
                allowFullScreen
                loading="lazy"
              />
            </div>
          ) : null}
          {mapsUrl ? (
            <Button size="sm" variant="outline" className="mt-4 w-full" asChild>
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                Get Directions <ExternalLink className="ml-1.5 size-3" />
              </a>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
