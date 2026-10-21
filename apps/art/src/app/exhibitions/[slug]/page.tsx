import { EditorialBlockRenderer } from "@/components/editorial/editorial-block-renderer";
import { ArtGeneralEnquiryPanel } from "@/components/enquiry/art-general-enquiry-panel";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { artServices } from "@/lib/art-services.server";
import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import { exhibitionSectionTabs } from "@/lib/editorial/editorial-page-title.vm";
import { composeExhibitionDetailPage } from "@/lib/editorial/editorial-pages.composer";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingInfoStrip, MarketingPageTitle, MarketingSubNav } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";

type ExhibitionPageProps = {
  params: Promise<{ slug: string }>;
};

const loadExhibition = cache((slug: string) => composeExhibitionDetailPage(artServices, slug));

export async function generateMetadata({ params }: ExhibitionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadExhibition(slug);
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Exhibition");
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
  if (result.status !== "ok") notFoundOrUnavailable(result.status, "Exhibition");

  const { exhibition, metaLine, ended, dateLabel, venueName, venueHref, hoursLabel, body } =
    result.data;
  const returnTo = `/exhibitions/${encodeURIComponent(exhibition.slug)}`;
  const viewer = await artServices.viewer.load();
  const hasOverview = body.blocks.length > 0;
  const hasInstallationViews = exhibition.installationMedia.length > 0;
  const sectionTabs = exhibitionSectionTabs({
    overview: hasOverview,
    installationViews: hasInstallationViews,
  });
  const title = {
    title: exhibition.title,
    eyebrow: ended ? "Closed" : null,
    subtitle: exhibition.summary,
    meta: [metaLine],
  };

  return (
    <article className="flex flex-col pb-10 lg:pb-16">
      {exhibition.coverUrl ? (
        <MarketingPageTitle
          variant="media"
          image={{ src: exhibition.coverUrl }}
          priority
          {...title}
        />
      ) : (
        <MarketingPageTitle {...title} />
      )}
      {sectionTabs.length > 0 ? (
        <MarketingSubNav
          mode="anchor"
          sticky
          ariaLabel="Exhibition sections"
          items={sectionTabs}
          identity={{
            title: exhibition.title,
            meta: dateLabel,
            imageSrc: exhibition.coverUrl,
          }}
        />
      ) : null}
      <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 pt-10")}>
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
        {hasOverview ? (
          <div id="overview" className="max-w-3xl">
            <EditorialBlockRenderer body={body} />
          </div>
        ) : null}
        {hasInstallationViews ? (
          <section
            id="installation-views"
            aria-labelledby="installation-title"
            className="flex flex-col gap-4"
          >
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
                    <div className="relative aspect-[4/3] overflow-hidden bg-surface-container">
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
      </div>
    </article>
  );
}
