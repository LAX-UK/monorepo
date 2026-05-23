import { artistDetailTabHref } from "@/components/admin/artist-detail/artist-detail-types";
import {
  CatalogDetailSection,
  CatalogDetailSummaryStrip,
  CatalogDetailTabPanel,
} from "@/components/admin/catalog";
import { MediaImage } from "@/components/ui/media-image";
import { buildArtistSummaryItems } from "@/lib/admin/build-artist-summary-items";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import type { ArtistProfile } from "@auction/types";
import { Surface } from "@auction/ui/components/surface";
import Link from "next/link";

type Props = {
  artistId: string;
  artist: ArtistProfile;
  lotCount: number;
  duplicateCount: number;
};

export function ArtistOverviewTab({ artistId, artist, lotCount, duplicateCount }: Props) {
  const summaryItems = buildArtistSummaryItems(artistId, artist, lotCount, duplicateCount);
  const portraitSrc = resolveMediaSrc(artist.portraitUrl);

  const mergedBanner =
    artist.status === "merged_into" && artist.mergedIntoArtistId ? (
      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low/40 p-4 text-sm text-on-surface">
        This profile was merged. All catalogue work should happen on the surviving profile.{" "}
        <Link
          href={`/admin/artists/${artist.mergedIntoArtistId}`}
          className="font-medium text-primary hover:underline"
        >
          View surviving artist →
        </Link>
      </div>
    ) : null;

  return (
    <CatalogDetailTabPanel framed={false}>
      <CatalogDetailSummaryStrip items={summaryItems} />

      <CatalogDetailSection title="Profile">
        {mergedBanner}
        {artist.status === "pending" ? (
          <p className="font-body text-sm text-on-surface-variant">
            This profile is awaiting staff review.{" "}
            <Link
              href={artistDetailTabHref(artistId, "review")}
              className="font-medium text-primary hover:underline"
            >
              Open review tab →
            </Link>
          </p>
        ) : null}
        <Surface variant="card" padding="md">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_8rem]">
            <div className="space-y-4">
              <h3 className="font-display text-lg font-semibold text-on-surface">Details</h3>
              {artist.shortBio?.trim() ? (
                <p className="font-body text-sm text-on-surface-variant">{artist.shortBio}</p>
              ) : null}
              <div className="grid gap-3 font-body text-sm text-on-surface-variant sm:grid-cols-2">
                <p>
                  <span className="font-medium text-on-surface">Slug</span>
                  <br />
                  <span className="font-mono text-xs">/{artist.slug}</span>
                </p>
                <p>
                  <span className="font-medium text-on-surface">Nationality</span>
                  <br />
                  {artist.nationality?.trim() || "—"}
                </p>
                <p>
                  <span className="font-medium text-on-surface">Featured / verified</span>
                  <br />
                  {artist.featured ? "Featured" : "Not featured"}
                  {" · "}
                  {artist.verified ? "Verified" : "Not verified"}
                </p>
                <p>
                  <span className="font-medium text-on-surface">Archived</span>
                  <br />
                  {artist.archived ? "Yes" : "No"}
                </p>
                {artist.websiteUrl?.trim() ? (
                  <p className="sm:col-span-2">
                    <span className="font-medium text-on-surface">Website</span>
                    <br />
                    <Link
                      href={artist.websiteUrl}
                      className="text-primary hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {artist.websiteUrl}
                    </Link>
                  </p>
                ) : null}
              </div>
            </div>
            {portraitSrc ? (
              <MediaImage
                src={portraitSrc}
                alt={`${artist.displayName} portrait`}
                className="aspect-square w-full max-w-[8rem] rounded-lg object-cover"
              />
            ) : null}
          </div>
        </Surface>
      </CatalogDetailSection>
    </CatalogDetailTabPanel>
  );
}
