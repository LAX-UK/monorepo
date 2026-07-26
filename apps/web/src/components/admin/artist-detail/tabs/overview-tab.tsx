import { artistDetailTabHref } from "@/components/admin/artist-detail/artist-detail-types";
import {
  CatalogDetailSection,
  CatalogDetailSummaryStrip,
  CatalogDetailTabPanel,
  DetailBoardKpiStrip,
} from "@/components/admin/catalog";
import { ActivitySnapshotRail, RelatedEntitiesRail } from "@/components/admin/detail-rail";
import { MediaImage } from "@/components/ui/media-image";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { buildArtistOverviewViewModel } from "@/lib/data/view-models/artist-overview.vm";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { artistPath } from "@/lib/seo/url";
import { type ArtistProfile, getCreatorKindConfig } from "@auction/types";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import { Surface } from "@auction/ui/components/surface";
import { ExternalLink, GitMerge } from "lucide-react";
import Link from "next/link";

type Props = {
  artistId: string;
  artist: ArtistProfile;
  lotCount: number;
  duplicateCount: number;
  activityEvents?: readonly AdminDomainEventRow[];
};

export function ArtistOverviewTab({
  artistId,
  artist,
  lotCount,
  duplicateCount,
  activityEvents = [],
}: Props) {
  const vm = buildArtistOverviewViewModel(artistId, artist, lotCount, duplicateCount);
  const portraitSrc = resolveMediaSrc(artist.portraitUrl);

  const kindConfig = getCreatorKindConfig(artist.kind);
  const categories = artist.categories ?? [];
  const attributeEntries = kindConfig.attributes
    .map((field) => ({ label: field.label, value: artist.attributes?.[field.key]?.trim() ?? "" }))
    .filter((entry) => entry.value.length > 0);

  const mergedBanner =
    artist.status === "merged_into" && artist.mergedIntoArtistId ? (
      <div className="rounded-lg border border-outline-variant/40 bg-surface-container-low/40 p-4 text-sm text-on-surface">
        This profile was merged. All catalogue work should happen on the surviving profile.{" "}
        <Link
          href={`/admin/artists/${artist.mergedIntoArtistId}`}
          className="font-medium text-link hover:underline"
        >
          View surviving artist →
        </Link>
      </div>
    ) : null;

  const publicHref = artistPath({ id: artist.id, name: artist.displayName });
  const related = [
    ...(artist.status === "merged_into" && artist.mergedIntoArtistId
      ? [
          {
            id: artist.mergedIntoArtistId,
            kind: "Survivor",
            label: "Merged into profile",
            href: `/admin/artists/${artist.mergedIntoArtistId}`,
            icon: <GitMerge className="size-4" aria-hidden />,
          },
        ]
      : []),
    {
      id: "public",
      kind: "Public",
      label: "Public profile",
      href: publicHref,
      icon: <ExternalLink className="size-4" aria-hidden />,
    },
  ];

  return (
    <CatalogDetailTabPanel framed={false}>
      <DetailBoardKpiStrip ariaLabel="Artist catalogue" tiles={vm.kpiTiles} />
      <CatalogDetailSummaryStrip items={vm.summaryItems} />

      <CatalogDetailSection title="Profile">
        {mergedBanner}
        {artist.status === "pending" ? (
          <p className="font-body text-sm text-on-surface-variant">
            This profile is awaiting staff review.{" "}
            <Link
              href={artistDetailTabHref(artistId, "review")}
              className="font-medium text-link hover:underline"
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
                  <span className="mt-1 inline-flex flex-wrap items-center gap-1">
                    <DotStatusPill
                      label={artist.featured ? "Featured" : "Not featured"}
                      tone={artist.featured ? "success" : "neutral"}
                    />
                    <DotStatusPill
                      label={artist.verified ? "Verified" : "Not verified"}
                      tone={artist.verified ? "success" : "warning"}
                    />
                  </span>
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
                      className="text-link hover:underline"
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
                sizes="8rem"
                className="aspect-square w-full max-w-[8rem] rounded-lg object-cover"
              />
            ) : null}
          </div>
        </Surface>
      </CatalogDetailSection>

      <CatalogDetailSection title="Classification">
        <Surface variant="card" padding="md">
          <div className="space-y-4">
            <div className="grid gap-3 font-body text-sm text-on-surface-variant sm:grid-cols-2">
              <p>
                <span className="font-medium text-on-surface">Kind</span>
                <br />
                {kindConfig.label}
              </p>
              {artist.countryCode?.trim() ? (
                <p>
                  <span className="font-medium text-on-surface">Country</span>
                  <br />
                  {artist.countryCode.toUpperCase()}
                </p>
              ) : null}
            </div>

            <div>
              <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                Departments
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.length > 0 ? (
                  categories.map((c) => (
                    <span
                      key={c.id}
                      className="rounded-full border border-outline-variant/50 bg-surface-container-low/40 px-3 py-1 font-body text-xs text-on-surface"
                    >
                      {c.name}
                    </span>
                  ))
                ) : (
                  <span className="font-body text-sm text-on-surface-variant">
                    No departments assigned.
                  </span>
                )}
              </div>
            </div>

            {attributeEntries.length > 0 ? (
              <div>
                <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
                  {kindConfig.label} attributes
                </span>
                <div className="mt-2 grid gap-3 font-body text-sm text-on-surface-variant sm:grid-cols-2">
                  {attributeEntries.map((entry) => (
                    <p key={entry.label}>
                      <span className="font-medium text-on-surface">{entry.label}</span>
                      <br />
                      {entry.value}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Surface>
      </CatalogDetailSection>

      {related.length > 0 ? (
        <CatalogDetailSection title="Related">
          <RelatedEntitiesRail items={related} />
        </CatalogDetailSection>
      ) : null}

      {activityEvents.length > 0 ? (
        <CatalogDetailSection title="Recent activity">
          <ActivitySnapshotRail
            events={activityEvents.map((e) => ({
              id: e.id,
              label: domainEventLabel(e.eventType),
              at: e.occurredAt.toISOString(),
              actor: e.actorUserId,
            }))}
          />
        </CatalogDetailSection>
      ) : null}
    </CatalogDetailTabPanel>
  );
}
