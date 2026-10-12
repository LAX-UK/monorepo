import { ArtPageHeader } from "@/components/art-page-header";
import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtworkGallery } from "@/components/artwork/art-artwork-gallery.client";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtEnquiryPanel } from "@/components/enquiry/art-enquiry-panel";
import { ArtArtworkFavoriteToggle } from "@/components/favorites/art-artwork-favorite-toggle.client";
import { ArtSection } from "@/components/layout/art-section";
import { artServices } from "@/lib/art-services.server";
import { artStorefrontLoginHref } from "@/lib/art-viewer-state";
import {
  artworkEnquiryReturnTo,
  composeArtworkDetailMetadata,
  composeArtworkDetailPage,
} from "@/lib/artwork/artwork-detail-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type ArtworkPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: ArtworkPageProps): Promise<Metadata> {
  const { slug } = await params;
  const meta = await composeArtworkDetailMetadata(artServices.catalogue, slug);
  switch (meta.kind) {
    case "ok":
      return {
        title: `${meta.title} | LAX Art`,
        description: meta.description,
        alternates: { canonical: meta.canonicalPath },
        ...(meta.imageUrl ? { openGraph: { images: [meta.imageUrl] } } : {}),
      };
    case "not_found":
      return { title: "Artwork not found | LAX Art", robots: { index: false, follow: false } };
    case "unavailable":
      return { title: "Artwork | LAX Art", robots: { index: false, follow: false } };
  }
}

export default async function ArtworkDetailPage({ params, searchParams }: ArtworkPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const result = await composeArtworkDetailPage(artServices, {
    slug,
    enquireRequested: query.enquire === "1",
  });
  if (result.kind === "not_found") notFound();
  if (result.kind === "unavailable") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtStatusState
          variant="error"
          layout="page"
          titleAs="h1"
          title="Artwork unavailable"
          description="We could not load this artwork. Try again shortly."
          actions={
            <ArtStatusStateLink href={`/artworks/${encodeURIComponent(slug)}`}>
              Retry
            </ArtStatusStateLink>
          }
        />
      </div>
    );
  }

  const { vm } = result;
  if (vm.enquiry.kind === "sign_in" && query.enquire === "1") redirect(vm.enquiry.loginHref);

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "py-6 lg:py-10")}>
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ArtArtworkGallery images={vm.galleryImages} priority />
        <div className="flex flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <ArtPageHeader
              title={vm.title}
              breadcrumbs={[{ label: "Artworks", href: "/artworks" }, { label: vm.title }]}
            />
            <ArtArtworkFavoriteToggle
              slug={vm.slug}
              title={vm.title}
              initialSaved={vm.saved}
              auth={vm.favoriteAuth}
            />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking)] text-on-surface-variant">
              {vm.kindLabel}
            </p>
            <Link
              href={vm.artistHref}
              className="art-focus-ring w-fit rounded-sm text-lg text-on-surface hover:underline"
            >
              {vm.artistName}
            </Link>
            {vm.metaLine ? <p className="text-sm text-on-surface-variant">{vm.metaLine}</p> : null}
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-xl font-medium text-on-surface" data-testid="art-artwork-price">
              {vm.priceLabel}
            </p>
            <p className="text-sm text-on-surface-variant">{vm.availability.headline}</p>
            {vm.availability.detail ? (
              <p className="text-sm text-on-surface-variant">{vm.availability.detail}</p>
            ) : null}
          </div>
          <ArtEnquiryPanel
            slug={vm.slug}
            title={vm.title}
            enquiry={vm.enquiry}
            loginHref={artStorefrontLoginHref(artworkEnquiryReturnTo(vm.slug))}
          />
          {vm.specs.length > 0 ? (
            <section aria-labelledby="art-artwork-specs" className="flex flex-col gap-3">
              <h2
                id="art-artwork-specs"
                className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking)] text-on-surface"
              >
                Specifications
              </h2>
              <dl className="grid gap-2 text-sm">
                {vm.specs.map((row) => (
                  <div key={row.label} className="grid grid-cols-[minmax(0,8rem)_1fr] gap-2">
                    <dt className="text-on-surface-variant">{row.label}</dt>
                    <dd className="text-on-surface">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
          {vm.description ? (
            <section aria-labelledby="art-artwork-about" className="flex flex-col gap-2">
              <h2
                id="art-artwork-about"
                className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking)] text-on-surface"
              >
                About this work
              </h2>
              <p className="whitespace-pre-wrap text-on-surface-variant">{vm.description}</p>
            </section>
          ) : null}
          {vm.provenance ? (
            <section aria-labelledby="art-artwork-provenance" className="flex flex-col gap-2">
              <h2
                id="art-artwork-provenance"
                className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking)] text-on-surface"
              >
                Provenance
              </h2>
              <p className="whitespace-pre-wrap text-on-surface-variant">{vm.provenance}</p>
            </section>
          ) : null}
          {vm.exhibitionHistory ? (
            <section aria-labelledby="art-artwork-exhibitions" className="flex flex-col gap-2">
              <h2
                id="art-artwork-exhibitions"
                className="font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking)] text-on-surface"
              >
                Exhibition history
              </h2>
              <p className="whitespace-pre-wrap text-on-surface-variant">{vm.exhibitionHistory}</p>
            </section>
          ) : null}
        </div>
      </div>

      {vm.relatedArtworks.length > 0 ? (
        <div className="mt-12">
          <ArtSection id="related-artworks" title="More by this artist" viewAllHref={vm.artistHref}>
            <ArtArtworkGrid
              cards={vm.relatedArtworks}
              favoriteAuth={vm.favoriteAuth}
              priorityCount={0}
            />
          </ArtSection>
        </div>
      ) : null}
    </div>
  );
}
