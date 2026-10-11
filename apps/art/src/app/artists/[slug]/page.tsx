import { ArtPageHeader } from "@/components/art-page-header";
import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtArtistFollowButton } from "@/components/favorites/art-artist-follow-button.client";
import { ArtSection } from "@/components/layout/art-section";
import { ArtMediaImage } from "@/components/media/art-media-image.server";
import { artServices } from "@/lib/art-services.server";
import { composeArtistMetadataTitle, composeArtistPage } from "@/lib/artist/artist-page.composer";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

type ArtistPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: ArtistPageProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: await composeArtistMetadataTitle(artServices.catalogue, slug),
    alternates: { canonical: `/artists/${encodeURIComponent(slug)}` },
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const result = await composeArtistPage(artServices, slug);
  if (result.kind === "not_found") notFound();
  if (result.kind === "unavailable") {
    return (
      <div className={cn(MARKETING_PAGE_SHELL, "py-10")}>
        <ArtStatusState
          variant="error"
          layout="page"
          titleAs="h1"
          title="Artist unavailable"
          description="We could not load this artist. Try again shortly."
          actions={<ArtStatusStateLink href="/artworks">Browse artworks</ArtStatusStateLink>}
        />
      </div>
    );
  }

  const { vm } = result;
  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-12 py-6 lg:py-10")}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="relative size-32 shrink-0 overflow-hidden rounded-full bg-surface-container">
          <ArtMediaImage
            src={vm.portraitUrl}
            alt={vm.portraitAlt}
            aspect={[1, 1]}
            shape="circle"
            sizes="8rem"
            label={ART_MEDIA_LABELS.artistPortrait}
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <ArtPageHeader
            title={vm.name}
            breadcrumbs={[{ label: "Artworks", href: "/artworks" }, { label: vm.name }]}
            {...(vm.discipline ? { description: vm.discipline } : {})}
            action={
              <ArtArtistFollowButton
                slug={vm.slug}
                name={vm.name}
                initialFollowing={vm.following}
                auth={vm.favoriteAuth}
              />
            }
          />
          {vm.bio ? (
            <p className="max-w-2xl whitespace-pre-wrap text-on-surface-variant">{vm.bio}</p>
          ) : null}
        </div>
      </div>

      <ArtSection id="artist-works" title="Works on lax.art">
        {vm.worksFailed ? (
          <ArtStatusState
            variant="error"
            title="Works unavailable"
            description="We could not load this artist's works. Try again shortly."
          />
        ) : vm.works.length === 0 ? (
          <ArtStatusState
            variant="empty"
            title="No works listed yet"
            description="Follow this artist to hear when new works arrive."
            actions={<ArtStatusStateLink href="/artworks">Browse artworks</ArtStatusStateLink>}
          />
        ) : (
          <ArtArtworkGrid cards={vm.works} favoriteAuth={vm.favoriteAuth} />
        )}
      </ArtSection>
    </div>
  );
}
