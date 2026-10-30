import { ArtArtworkArtistSummary } from "@/components/artwork/art-artwork-artist-summary";
import { ArtArtworkBreadcrumb } from "@/components/artwork/art-artwork-breadcrumb";
import { ArtArtworkConversations } from "@/components/artwork/art-artwork-conversations.client";
import { ArtArtworkDetailSections } from "@/components/artwork/art-artwork-detail-sections";
import { ArtArtworkGallery } from "@/components/artwork/art-artwork-gallery.client";
import { ArtArtworkMobileGallery } from "@/components/artwork/art-artwork-mobile-gallery.client";
import { ArtShopEditions } from "@/components/artwork/art-shop-editions";
import { ArtSpecList } from "@/components/artwork/art-spec-list";
import { ArtArtworkRail } from "@/components/catalogue/art-artwork-rail";
import { ArtArtworkFavoriteToggle } from "@/components/favorites/art-artwork-favorite-toggle.client";
import { ArtSection } from "@/components/layout/art-section";
import { ArtJsonLd } from "@/components/seo/art-json-ld";
import { loadArtStorefrontBaseUrl } from "@/env.server";
import { artServices } from "@/lib/art-services.server";
import {
  composeArtworkDetailMetadata,
  composeArtworkDetailPage,
} from "@/lib/artwork/artwork-detail-page.composer";
import { notFoundOrUnavailable } from "@/lib/seo/page-status";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import {
  MarketingCertificateIcon,
  MarketingClockIcon,
  MarketingFaqPills,
  MarketingMapPinIcon,
  MarketingShareButton,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";

type ArtworkPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = await composeArtworkDetailMetadata(artServices.catalogue, slug);
  if (meta.kind !== "ok") notFoundOrUnavailable(meta.kind, "Artwork");
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: meta.canonicalPath },
    ...(meta.imageUrl ? { openGraph: { images: [meta.imageUrl] } } : {}),
  };
}

export default async function ArtworkDetailPage({ params, searchParams }: ArtworkPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const result = await composeArtworkDetailPage(artServices, {
    slug,
    enquireRequested: query.enquire === "1",
    siteUrl: loadArtStorefrontBaseUrl(),
  });
  if (result.kind !== "ok") notFoundOrUnavailable(result.kind, "Artwork");

  const { vm } = result;
  const shareUrl = `/artworks/${encodeURIComponent(vm.slug)}`;

  return (
    <div>
      <ArtJsonLd data={vm.structuredData} />
      <div className={cn(MARKETING_PAGE_SHELL, "py-4 lg:py-8")}>
        <ArtArtworkBreadcrumb items={vm.breadcrumb} />
      </div>
      <ArtArtworkMobileGallery
        images={vm.galleryImages}
        slug={vm.slug}
        title={vm.title}
        shareUrl={shareUrl}
        categoryHref={vm.categoryHref}
        specialistContact={vm.specialistContact}
      />

      <div className={cn(MARKETING_PAGE_SHELL, "pt-6 md:pt-0")}>
        {/* Figma 426:2581: 800 / 520 split at 1440. The info column spans both rows and
            sticks below the header while the media and details scroll (Figma 433:4845). */}
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,800fr)_minmax(0,520fr)] lg:grid-rows-[auto_1fr]">
          <div className="hidden md:block lg:col-start-1 lg:row-start-1">
            <ArtArtworkGallery images={vm.galleryImages} stageRatio={vm.stageRatio} priority />
          </div>

          <section
            aria-label="Artwork summary"
            className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-[calc(var(--header-height)+2rem)] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-4">
                <h1 className="min-w-0 break-words font-headline text-2xl font-normal leading-tight text-on-surface lg:text-[1.75rem]">
                  {vm.title}
                </h1>
                <div className="-mr-0.5 -mt-1 hidden shrink-0 items-center md:flex">
                  <ArtArtworkFavoriteToggle
                    slug={vm.slug}
                    title={vm.title}
                    initialSaved={vm.saved}
                    auth={vm.favoriteAuth}
                  />
                  <MarketingShareButton url={shareUrl} title={vm.title} appearance="icon" />
                </div>
              </div>
              <Link
                href={vm.artistHref}
                className="art-focus-ring w-fit rounded-sm text-base text-on-surface hover:underline"
              >
                {vm.artistName}
              </Link>
            </div>

            {vm.keySpecs.length > 0 || vm.certificateLine ? (
              <div className="flex flex-col gap-5 border-t border-outline-variant/60 pt-6">
                <ArtSpecList rows={vm.keySpecs} />
                {vm.certificateLine ? (
                  <p
                    className="flex items-center gap-2 text-sm text-on-surface"
                    data-testid="art-artwork-certificate"
                  >
                    <MarketingCertificateIcon className="size-5" />
                    {vm.certificateLine}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-outline-variant/60 pt-6">
              <p className="text-base font-medium text-on-surface" data-testid="art-artwork-price">
                {vm.priceLabel}
              </p>
              {vm.availabilityNote ? (
                <p className="text-sm text-on-surface-variant">{vm.availabilityNote}</p>
              ) : null}
              {vm.priceNote ? (
                <p className="text-sm leading-6 text-on-surface-variant">{vm.priceNote}</p>
              ) : null}
              {vm.promise ? (
                <ul
                  className="flex flex-col gap-2 text-sm leading-6 text-on-surface"
                  aria-label="Replies and viewing"
                  data-testid="art-artwork-promise"
                >
                  <li className="flex items-start gap-2">
                    <MarketingClockIcon aria-hidden className="mt-1 size-4 shrink-0" />
                    {vm.promise.reply}
                  </li>
                  <li className="flex items-start gap-2">
                    <MarketingMapPinIcon aria-hidden className="mt-1 size-4 shrink-0" />
                    {vm.promise.viewing}
                  </li>
                </ul>
              ) : null}
            </div>

            <ArtArtworkConversations vm={vm} />

            <ArtShopEditions editions={vm.shopEditions} />
          </section>

          <div className="flex min-w-0 flex-col gap-12 lg:col-start-1 lg:row-start-2 lg:max-w-[37.5rem]">
            <ArtArtworkDetailSections
              description={vm.description}
              provenance={vm.provenance}
              exhibitionHistory={vm.exhibitionHistory}
            />
            {vm.artist ? (
              <ArtArtworkArtistSummary artist={vm.artist} favoriteAuth={vm.favoriteAuth} />
            ) : null}
            <MarketingFaqPills items={vm.faqs} />
          </div>
        </div>

        {vm.relatedArtworks.length > 0 ? (
          <div className="mt-16">
            <ArtSection
              id="related-artworks"
              title={vm.relatedSection.title}
              viewAllHref={vm.relatedSection.viewAllHref}
              viewAllSrLabel={vm.relatedSection.viewAllSrLabel}
            >
              <ArtArtworkRail
                id="related-artworks-rail"
                label={vm.relatedSection.title}
                cards={vm.relatedArtworks}
                favoriteAuth={vm.favoriteAuth}
              />
            </ArtSection>
          </div>
        ) : null}
      </div>
    </div>
  );
}
