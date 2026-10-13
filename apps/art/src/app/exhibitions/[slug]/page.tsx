import { ArtEditorialHeader } from "@/components/editorial/art-editorial-header";
import { ArtEditorialStatus } from "@/components/editorial/art-editorial-status";
import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import { composeExhibitionDetailPage } from "@/lib/editorial/editorial-pages.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingInfoStrip } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";

type ExhibitionPageProps = {
  params: Promise<{ slug: string }>;
};

const loadExhibition = cache((slug: string) => composeExhibitionDetailPage(artServices, slug));

export async function generateMetadata({ params }: ExhibitionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadExhibition(slug);
  if (result.status !== "ok") return { title: "Exhibition | LAX Art" };
  const { exhibition } = result.data;
  return {
    title: `${exhibition.title} | LAX Art`,
    ...(exhibition.summary ? { description: exhibition.summary } : {}),
    alternates: { canonical: `/exhibitions/${encodeURIComponent(exhibition.slug)}` },
    openGraph: {
      title: exhibition.title,
      ...(exhibition.summary ? { description: exhibition.summary } : {}),
      ...(exhibition.coverUrl ? { images: [{ url: exhibition.coverUrl }] } : {}),
    },
  };
}

export default async function ExhibitionDetailPage({ params }: ExhibitionPageProps) {
  const { slug } = await params;
  const result = await loadExhibition(slug);
  if (result.status === "not_found" || result.status === "disabled") notFound();
  if (result.status !== "ok") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtEditorialStatus
          result={result}
          disabledTitle="Exhibition unavailable"
          disabledDescription="Editorial content is not enabled in this environment yet."
          emptyTitle="Exhibition not found"
          emptyDescription="This exhibition may have ended or the link is incorrect."
        />
      </div>
    );
  }

  const { exhibition, kicker, dateLabel, venueName, venueHref, hoursLabel, body } = result.data;
  const returnTo = `/exhibitions/${encodeURIComponent(exhibition.slug)}`;
  const viewer = await artServices.viewer.load();

  return (
    <article className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 py-10")}>
      <ArtEditorialHeader
        kicker={kicker}
        title={exhibition.title}
        standfirst={exhibition.summary}
        coverUrl={exhibition.coverUrl}
      />
      {dateLabel || venueName || hoursLabel ? (
        <div className="flex flex-col gap-3">
          <MarketingInfoStrip
            dateLabel={dateLabel}
            venueLabel={venueName}
            hoursLabel={hoursLabel}
          />
          {venueHref && venueName ? (
            <Link
              href={venueHref}
              className="art-focus-ring w-fit rounded-sm font-label text-sm font-semibold uppercase tracking-wide text-on-surface underline underline-offset-4 hover:no-underline"
            >
              Plan your visit<span className="sr-only"> to {venueName}</span>
            </Link>
          ) : null}
        </div>
      ) : null}
      <EditorialBlockRenderer body={body} className="max-w-3xl" />
      {exhibition.installationMedia.length > 0 ? (
        <section aria-labelledby="installation-title" className="flex flex-col gap-4">
          <h2
            id="installation-title"
            className="font-headline text-xl font-semibold text-on-surface"
          >
            Installation views
          </h2>
          <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {exhibition.installationMedia.map((media) => (
              <li key={media.url}>
                <figure className="flex flex-col gap-2">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-sm bg-surface-container">
                    <ArtMediaImage
                      src={media.url}
                      alt={media.caption ?? `Installation view of ${exhibition.title}`}
                      sizes="(min-width: 48rem) 30vw, 50vw"
                      className="absolute inset-0 size-full"
                      imgClassName="object-cover"
                    />
                  </div>
                  {media.caption ? (
                    <figcaption className="text-sm text-on-surface-variant">
                      {media.caption}
                    </figcaption>
                  ) : null}
                </figure>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section
        aria-labelledby="exhibition-enquire-title"
        className="flex max-w-3xl flex-col gap-3 border-t border-border-hairline pt-8"
      >
        <h2
          id="exhibition-enquire-title"
          className="font-headline text-xl font-semibold text-on-surface"
        >
          Plan a visit or enquire
        </h2>
        <p className="text-on-surface-variant">
          Ask about works in the exhibition, private viewings or opening times.
        </p>
        <ArtGeneralEnquiryPanel
          viewer={viewer}
          loginHref={artStorefrontLoginHref(returnTo)}
          defaultTopic="exhibition"
          contextSlug={exhibition.slug}
          contextLabel={exhibition.title}
          triggerLabel="Enquire about this exhibition"
        />
      </section>
    </article>
  );
}
