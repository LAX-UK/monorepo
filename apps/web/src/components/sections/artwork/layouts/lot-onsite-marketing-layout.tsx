import { ShareButton } from "@/components/marketing/share-button";
import type {
  AccordionBlock,
  LotRelatedRailVM,
  LotSummarySeedVM,
} from "@/components/sections/artwork/artwork-view-models";
import {
  AddSaleToCalendarButton,
  RequestViewingMailtoButton,
} from "@/components/sections/artwork/onsite/onsite-calendar-actions";
import { OnsiteSaleScheduleCountdown } from "@/components/sections/artwork/onsite/onsite-sale-schedule-countdown";
import { LotActionsRow } from "@/components/sections/artwork/redesign/lot-actions-row";
import { LotMarketingAccordion } from "@/components/sections/artwork/redesign/lot-marketing-accordion";
import { LotMoreFromRail } from "@/components/sections/artwork/redesign/lot-more-from-rail";
import { MediaImage } from "@/components/ui/media-image";
import { SITE_BUSINESS_HOURS_LABEL, SITE_SUPPORT_EMAIL } from "@/lib/brand";
import { formatMoney } from "@/lib/format-currency";
import { salePath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import {
  formatPostalAddressLines,
  hasStructuredAddress,
  resolveOnsiteMapUrl,
} from "@auction/validators";
import { MapPin, Radio, Video } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  auction: Lot;
  sale: Sale;
  summarySeed: LotSummarySeedVM;
  marketingAccordionBlocks: AccordionBlock[];
  rail: LotRelatedRailVM;
  isAuthenticated: boolean;
  watchedLotIds: readonly string[];
  currentUserId: string | null;
  shareUrl: string;
  followSlot: ReactNode;
};

function locationOneLine(sale: Sale): string {
  const lines = formatPostalAddressLines(sale);
  return [sale.locationName, ...lines].filter(Boolean).join(", ");
}

/** Marketing-first onsite (in-gallery) lot page — no web bidding UI. */
export function LotOnsiteMarketingLayout({
  auction,
  sale,
  summarySeed,
  marketingAccordionBlocks,
  rail,
  isAuthenticated,
  watchedLotIds,
  currentUserId,
  shareUrl,
  followSlot,
}: Props) {
  const heroImage = auction.images[0] ?? sale.coverImages[0] ?? null;
  const mapsUrl = resolveOnsiteMapUrl(sale);
  const addressLines = formatPostalAddressLines(sale);
  const hasStructured = hasStructuredAddress(sale);
  const locationLine = locationOneLine(sale);

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

  const absenteeSubject = encodeURIComponent(
    `Absentee / phone bid: ${sale.title} — ${auction.title}`,
  );
  const absenteeBody = encodeURIComponent(
    `I would like to register an absentee or phone bid for:\n\nSale: ${sale.title}\nLot: ${auction.title}\nLot page: ${shareUrl}\n\n`,
  );
  const absenteeHref = `mailto:${SITE_SUPPORT_EMAIL}?subject=${absenteeSubject}&body=${absenteeBody}`;

  return (
    <section aria-labelledby="lot-heading-onsite" className="bg-page-bg dark:bg-background">
      <h1 id="lot-heading-onsite" className="sr-only">
        {auction.title}
      </h1>
      <div className="mx-auto max-w-[var(--container-max,1440px)] px-4 pb-20 pt-6 sm:px-6 md:px-8">
        <div className="relative overflow-hidden rounded-2xl border border-border-hairline bg-[#0a0a0a] shadow-lg motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 motion-reduce:animate-none">
          <div className="relative aspect-[21/9] min-h-[220px] w-full sm:min-h-[280px]">
            {heroImage ? (
              <MediaImage
                src={heroImage}
                alt=""
                label="Lot"
                className="absolute inset-0 size-full object-cover opacity-90"
                sizes="100vw"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-[#2a2a2a] to-[#0a0a0a]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 p-6 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl space-y-2">
                <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-[#D1D1D1]">
                  In-gallery auction
                </p>
                <p className="font-body text-lg text-[#E8E8E8] sm:text-xl">{sale.title}</p>
                <h2 className="font-body text-2xl font-medium text-[#F1F1F3] sm:text-4xl lg:text-[40px] lg:leading-tight">
                  {auction.title}
                </h2>
                <p className="font-body text-base text-[#C8C8C8]">{summarySeed.sellerName}</p>
              </div>
              <div className="shrink-0 rounded-xl bg-black/45 px-4 py-3 backdrop-blur-md sm:px-6">
                <OnsiteSaleScheduleCountdown sale={sale} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 sm:justify-start">
          {sale.streamUrl ? (
            <Button variant="default" className="gap-2" asChild>
              <a href={sale.streamUrl} target="_blank" rel="noopener noreferrer">
                <Radio className="size-4" aria-hidden />
                Watch live stream
              </a>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link href={salePath(sale)}>View full catalogue</Link>
          </Button>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:items-start">
          <div className="space-y-10">
            <section
              aria-labelledby="lot-estimate-onsite"
              className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-6 shadow-sm dark:bg-surface-container-low/40 lg:p-8"
            >
              <h2
                id="lot-estimate-onsite"
                className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary"
              >
                Catalogue
              </h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                    Estimate
                  </p>
                  <p className="mt-1 font-body text-lg text-on-surface">
                    {summarySeed.estimateLine ?? "—"}
                  </p>
                </div>
                {auction.startingPrice ? (
                  <div>
                    <p className="font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                      Opening price
                    </p>
                    <p className="mt-1 font-body text-lg text-on-surface">
                      {formatMoney(auction.startingPrice)}
                    </p>
                  </div>
                ) : null}
              </div>
              <p className="mt-6 text-sm leading-relaxed text-on-surface-variant">
                Bidding takes place in the saleroom or through a registered representative. Web
                bidding is not offered for this catalogue — use the links below to plan your visit
                or register absentee interest.
              </p>
            </section>

            <section
              aria-labelledby="plan-visit"
              className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-6 dark:bg-surface-container-low/40 lg:p-8"
            >
              <h2 id="plan-visit" className="font-body text-xl font-semibold text-on-surface">
                Plan your visit
              </h2>
              <p className="mt-2 text-sm text-on-surface-variant">{SITE_BUSINESS_HOURS_LABEL}</p>
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
                <AddSaleToCalendarButton
                  sale={sale}
                  lotTitle={auction.title}
                  locationLine={locationLine}
                />
                <RequestViewingMailtoButton sale={sale} lotTitle={auction.title} />
              </div>
            </section>

            <section
              aria-labelledby="venue"
              className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-6 dark:bg-surface-container-low/40 lg:p-8"
            >
              <h2
                id="venue"
                className="flex items-center gap-2 font-body text-xl font-semibold text-on-surface"
              >
                <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
                Venue
              </h2>
              {sale.locationName ? (
                <p className="mt-3 font-body text-base font-medium text-on-surface">
                  {sale.locationName}
                </p>
              ) : null}
              {addressLines.length > 0 ? (
                <address className="mt-2 font-body text-sm not-italic leading-relaxed text-on-surface-variant">
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                {mapsUrl ? (
                  <Button variant="outline" asChild>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={
                        hasStructured ? "Get directions in Google Maps" : "Open venue location"
                      }
                    >
                      {sale.locationMapUrl ? "Open map" : "Get directions"}
                    </a>
                  </Button>
                ) : null}
              </div>
            </section>

            <section
              aria-labelledby="bid-onsite"
              className="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-6 dark:bg-surface-container-low/40 lg:p-8"
            >
              <h2 id="bid-onsite" className="font-body text-xl font-semibold text-on-surface">
                How to bid
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-on-surface-variant">
                Register for a paddle in the room, arrange a phone line, or leave an absentee bid
                with our team before the session begins.
              </p>
              <Button className="mt-6" variant="secondary" asChild>
                <a href={absenteeHref}>Request absentee / phone bid</a>
              </Button>
              <p className="mt-3 text-xs text-on-surface-variant">
                A dedicated absentee form is coming soon — contact{" "}
                <a className="underline" href={`mailto:${SITE_SUPPORT_EMAIL}`}>
                  {SITE_SUPPORT_EMAIL}
                </a>
                .
              </p>
            </section>

            {sale.streamUrl ? (
              <section
                aria-labelledby="stream-promo"
                className="rounded-2xl border border-primary/25 bg-primary-container/10 p-6 dark:bg-primary/10 lg:p-8"
              >
                <h2
                  id="stream-promo"
                  className="flex items-center gap-2 font-body text-xl font-semibold text-on-surface"
                >
                  <Video className="size-5 text-primary" aria-hidden />
                  Watch from anywhere
                </h2>
                <p className="mt-2 text-sm text-on-surface-variant">
                  Follow the live stream while the auction runs in the gallery — ideal if you cannot
                  travel but still want to watch the room.
                </p>
                <Button className="mt-4" asChild>
                  <a href={sale.streamUrl} target="_blank" rel="noopener noreferrer">
                    Open live stream
                  </a>
                </Button>
              </section>
            ) : null}
          </div>

          <aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-height)+16px)]">
            <div className="overflow-hidden rounded-2xl border border-border-hairline bg-surface-container-lowest shadow-sm dark:bg-surface-container-low/40">
              <div className="relative aspect-square w-full max-w-[400px]">
                {heroImage ? (
                  <MediaImage
                    src={heroImage}
                    alt=""
                    label="Lot"
                    className="size-full object-cover"
                    sizes="400px"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center bg-surface-container-high text-on-surface-variant">
                    No image
                  </div>
                )}
              </div>
            </div>
            <div>
              <LotActionsRow
                followSlot={followSlot}
                shareSlot={
                  <ShareButton
                    url={shareUrl}
                    title={auction.title}
                    className="h-10 w-full min-h-10 border-brand-400 font-['DM_Sans',sans-serif] text-base font-semibold"
                  />
                }
              />
            </div>
          </aside>
        </div>

        <div className="mt-12">
          <LotMarketingAccordion blocks={marketingAccordionBlocks} />
        </div>

        <LotMoreFromRail
          rail={rail}
          currentUserId={currentUserId}
          isAuthenticated={isAuthenticated}
          watchedLotIds={watchedLotIds}
          density="compact"
        />
      </div>
    </section>
  );
}
