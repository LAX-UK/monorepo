import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import { ArtistDestructivePanel } from "@/components/admin/artist-detail/artist-destructive-panel";
import { artistDetailTabHref } from "@/components/admin/artist-detail/artist-detail-types";
import { CatalogInfoAside } from "@/components/admin/catalog/catalog-info-aside";
import {
  ActivitySnapshotRail,
  KpiStackRail,
  QuickActionsRail,
  RelatedEntitiesRail,
} from "@/components/admin/detail-rail";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import type { ArtistDeleteEligibility, ArtistProfile } from "@auction/types";
import { ExternalLink, GitMerge } from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  artistId: string;
  artist: ArtistProfile;
  lotCount: number;
  duplicateCount: number;
  publicHref: string;
  status?: ReactNode;
  activityEvents?: readonly AdminDomainEventRow[];
  deleteEligibility?: ArtistDeleteEligibility | null;
  canManageDelete?: boolean;
  canEdit?: boolean;
};

export function ArtistContextRail({
  artistId,
  artist,
  lotCount,
  duplicateCount,
  publicHref,
  status,
  activityEvents = [],
  deleteEligibility = null,
  canManageDelete = false,
  canEdit = false,
}: Props) {
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

  const showReviewCta = artist.status === "pending";

  return (
    <div className="space-y-6 lg:sticky lg:top-28">
      <CatalogInfoAside
        entityId={artistId}
        updatedAt={artist.updatedAt}
        publicHref={publicHref}
        publicLabel="Public profile"
        {...(status ? { status } : {})}
      />
      <div className="space-y-6 rounded-xl border border-border-hairline bg-surface-container-low/60 p-5">
        <KpiStackRail
          items={[
            { id: "lots", label: "Lots", value: String(lotCount) },
            {
              id: "duplicates",
              label: "Duplicate candidates",
              value: String(duplicateCount),
              tone: duplicateCount > 0 ? "warning" : "default",
            },
            {
              id: "status",
              label: "Registry status",
              value: <AdminStatusBadge domain="artist" status={artist.status ?? "pending"} />,
            },
          ]}
        />
        <QuickActionsRail
          actions={[
            ...(canEdit
              ? [
                  {
                    id: "edit",
                    label: "Edit artist",
                    href: `/admin/artists/${artistId}/edit`,
                    variant: "default" as const,
                  },
                ]
              : []),
            {
              id: "public",
              label: "Public profile",
              href: publicHref,
              variant: "outline",
            },
            ...(showReviewCta
              ? [
                  {
                    id: "review",
                    label: "Review profile",
                    href: artistDetailTabHref(artistId, "review"),
                    variant: "outline" as const,
                  },
                ]
              : []),
          ]}
        />
        <RelatedEntitiesRail items={related} />
        <ActivitySnapshotRail
          events={activityEvents.map((e) => ({
            id: e.id,
            label: domainEventLabel(e.eventType),
            at: e.occurredAt.toISOString(),
            actor: e.actorUserId,
          }))}
        />
        <ArtistDestructivePanel
          artist={artist}
          deleteEligibility={deleteEligibility}
          canManageDelete={canManageDelete}
        />
      </div>
    </div>
  );
}
