import { ArtStatusState } from "@/components/art-status-state";
import { ArtEditorialLink } from "@/components/editorial/art-editorial-link";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import { composeVisitPage } from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visit | LAX Art",
  description: "Opening hours, addresses and private viewings at London Art Exchange galleries.",
  alternates: { canonical: "/visit" },
};

const DETAIL_LINK = "text-link underline underline-offset-4 hover:no-underline art-focus-ring";

export default async function VisitPage() {
  const result = await composeVisitPage(artServices);
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Visit information coming soon"
          disabledDescription="Gallery visit content is not enabled in this environment yet."
          emptyTitle="No venues listed"
          emptyDescription="Visit details will appear here when venues are published."
        />
      </div>
    );
  }

  const viewer = await artServices.viewer.load();
  const { venues } = result.data;

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-12 py-10")}>
      <header className="flex max-w-3xl flex-col gap-2">
        <h1 className="font-headline text-3xl font-semibold text-on-surface">Visit</h1>
        <p className="text-on-surface-variant">
          Plan your visit to London Art Exchange gallery spaces, or book a private viewing.
        </p>
      </header>

      {venues.length === 0 ? (
        <ArtStatusState
          variant="empty"
          layout="inline"
          title="No venues listed"
          description="Visit details will appear here when venues are published."
        />
      ) : (
        venues.map(({ venue, hours, body }, index) => (
          <section
            key={venue.slug}
            aria-labelledby={`venue-${venue.slug}`}
            className="grid gap-8 border-t border-border-hairline pt-10 first-of-type:border-t-0 first-of-type:pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
          >
            <div className="flex flex-col gap-6">
              <h2
                id={`venue-${venue.slug}`}
                className="font-headline text-2xl font-semibold text-on-surface"
              >
                {venue.name}
              </h2>
              <dl className="grid gap-4 text-sm">
                {venue.address || venue.postcode ? (
                  <div>
                    <dt className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                      Address
                    </dt>
                    <dd className="mt-1 text-base text-on-surface">
                      <address className="not-italic">
                        {[venue.address, venue.postcode].filter(Boolean).join(", ")}
                      </address>
                      {venue.mapUrl ? (
                        <ArtEditorialLink href={venue.mapUrl} className={DETAIL_LINK}>
                          Get directions
                        </ArtEditorialLink>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {hours.length > 0 ? (
                  <div>
                    <dt className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                      Opening hours
                    </dt>
                    <dd className="mt-1">
                      <ul className="flex flex-col gap-1 text-base text-on-surface">
                        {hours.map((row) => (
                          <li key={row.label} className="flex justify-between gap-6">
                            <span>{row.label}</span>
                            <span className="text-on-surface-variant">{row.value}</span>
                          </li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                ) : null}
                {venue.phone || venue.email ? (
                  <div>
                    <dt className="font-label text-xs uppercase tracking-widest text-on-surface-variant">
                      Contact
                    </dt>
                    <dd className="mt-1 flex flex-col gap-1 text-base">
                      {venue.phone ? (
                        <a href={`tel:${venue.phone.replace(/\s+/g, "")}`} className={DETAIL_LINK}>
                          {venue.phone}
                        </a>
                      ) : null}
                      {venue.email ? (
                        <ArtEditorialLink href={`mailto:${venue.email}`} className={DETAIL_LINK}>
                          {venue.email}
                        </ArtEditorialLink>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <EditorialBlockRenderer body={body} idPrefix={`venue-${venue.slug}`} />
            </div>
            {venue.coverUrl ? (
              <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-surface-container">
                <ArtMediaImage
                  src={venue.coverUrl}
                  alt={`${venue.name} gallery`}
                  priority={index === 0}
                  sizes="(min-width: 64rem) 50vw, 100vw"
                  className="absolute inset-0 size-full"
                  imgClassName="object-cover"
                />
              </div>
            ) : null}
          </section>
        ))
      )}

      <section
        aria-labelledby="visit-enquire-title"
        className="flex max-w-3xl flex-col gap-3 border-t border-border-hairline pt-8"
      >
        <h2
          id="visit-enquire-title"
          className="font-headline text-xl font-semibold text-on-surface"
        >
          Book a private viewing
        </h2>
        <p className="text-on-surface-variant">
          Tell us what you would like to see and the gallery team will arrange a time.
        </p>
        <ArtGeneralEnquiryPanel
          viewer={viewer}
          loginHref={artStorefrontLoginHref("/visit")}
          defaultTopic="private_viewing"
          triggerLabel="Request a viewing"
        />
      </section>
    </div>
  );
}
