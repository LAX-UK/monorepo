"use client";

import { artistDetailTabHref } from "@/components/admin/artist-detail/artist-detail-types";
import { useArtistActions } from "@/components/admin/artist-detail/use-artist-actions";
import { StaffDetailTabs } from "@/components/admin/staff/staff-detail-tabs";
import { StaffEditableTitle } from "@/components/admin/staff/staff-editable-title";
import { usePinPageAction } from "@/components/admin/staff/use-pin-page-action";
import { adminUpdateArtistNameFieldAction } from "@/lib/actions/admin/field-updates";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import { formatArtistLifespan } from "@/lib/artists/lifespan-presenter";
import {
  DetailPage,
  MetaItem,
  Notice,
  type OverflowAction,
  OverflowMenu,
  StaffBreadcrumbs,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
} from "@auction/staff-ui";
import type { ArtistDeleteEligibility, ArtistProfile, ArtistStatus } from "@auction/types";
import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  artistId: string;
  artist: ArtistProfile;
  lotCount: number;
  duplicateCount: number;
  publicHref: string;
  deleteEligibility?: ArtistDeleteEligibility | null;
  canManageDelete?: boolean;
  canEdit?: boolean;
  canReview?: boolean;
  children: ReactNode;
};

/**
 * An artist's page on the staff record template: the name (renamable), registry status, the
 * facts that identify the profile, the next step as the one primary action (review a pending
 * profile, otherwise edit), the rest in the overflow menu with archive and delete last, a notice
 * for a merged profile, and its sections as tabs.
 */
export function ArtistDetailShell({
  artistId,
  artist,
  lotCount,
  duplicateCount,
  publicHref,
  deleteEligibility = null,
  canManageDelete = false,
  canEdit = false,
  canReview = false,
  children,
}: Props) {
  const registryStatus: ArtistStatus = artist.status ?? "pending";
  const status = staffStatus("artist", registryStatus);
  const merged = registryStatus === "merged_into" && Boolean(artist.mergedIntoArtistId);
  const lifespan = formatArtistLifespan({
    birthYear: artist.birthYear,
    deathYear: artist.deathYear,
  });
  const organisationYears = [artist.foundedYear?.trim(), artist.dissolvedYear?.trim()]
    .filter(Boolean)
    .join(" – ");
  const years = lifespan !== "—" ? lifespan : organisationYears;
  const pin = usePinPageAction(artist.displayName);
  const actions = useArtistActions({
    artistId,
    displayName: artist.displayName,
    archived: artist.archived,
    deleteEligibility,
    canManageDelete,
    merged,
  });

  const reviewing = registryStatus === "pending" && canReview;
  const editButton = canEdit ? (
    <StaffButton
      asChild
      variant={reviewing ? "secondary" : "primary"}
      icon={<Pencil aria-hidden />}
    >
      <Link href={`/admin/artists/${artistId}/edit`}>Edit artist</Link>
    </StaffButton>
  ) : null;
  const reviewButton = reviewing ? (
    <StaffButton asChild variant="primary">
      <Link href={artistDetailTabHref(artistId, "review")}>Review profile</Link>
    </StaffButton>
  ) : null;

  const overflow: OverflowAction[] = [
    {
      id: "view",
      label: "View on site",
      icon: ExternalLink,
      onSelect: () => window.open(publicHref, "_blank", "noopener"),
    },
    pin,
    ...actions.items,
  ];

  const tabs = [
    { id: "overview", label: "Overview", href: artistDetailTabHref(artistId, "overview") },
    {
      id: "lots",
      label: "Lots",
      href: artistDetailTabHref(artistId, "lots"),
      count: lotCount,
    },
    {
      id: "duplicates",
      label: "Duplicates",
      href: artistDetailTabHref(artistId, "duplicates"),
      count: duplicateCount,
    },
    ...(reviewing
      ? [{ id: "review", label: "Review", href: artistDetailTabHref(artistId, "review") }]
      : []),
  ];

  return (
    <>
      <DetailPage
        breadcrumbs={
          <StaffBreadcrumbs
            Link={NextLink}
            items={[{ label: "Artists", href: "/admin/artists" }, { label: artist.displayName }]}
          />
        }
        title={
          <StaffEditableTitle
            value={artist.displayName}
            label="artist"
            editable={canEdit && !merged}
            onSave={adminUpdateArtistNameFieldAction.bind(null, artistId)}
          />
        }
        status={
          <>
            <StatusBadge tone={status.tone} live={status.live ?? false}>
              {status.label}
            </StatusBadge>
            {artist.archived ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
          </>
        }
        meta={
          <>
            {artist.kind ? (
              <MetaItem label="Kind">{artistKindMeta(artist.kind).badge}</MetaItem>
            ) : null}
            {years ? (
              <MetaItem label={lifespan !== "—" ? "Lived" : "Active"}>{years}</MetaItem>
            ) : null}
            {artist.nationality?.trim() ? (
              <MetaItem label="Nationality">{artist.nationality.trim()}</MetaItem>
            ) : null}
          </>
        }
        primaryAction={reviewButton ?? editButton}
        secondaryActions={reviewButton ? editButton : null}
        overflow={<OverflowMenu label="More artist actions" Link={NextLink} actions={overflow} />}
        access={canEdit || canReview ? "full" : "read-only"}
        notice={
          merged ? (
            <Notice
              tone="info"
              title="This profile was merged into another artist"
              actions={
                <StaffButton asChild size="sm" variant="secondary">
                  <Link href={`/admin/artists/${artist.mergedIntoArtistId}`}>
                    Open surviving profile
                  </Link>
                </StaffButton>
              }
            >
              Catalogue work now happens on the surviving profile.
            </Notice>
          ) : null
        }
        tabs={<StaffDetailTabs label="Artist sections" items={tabs} />}
      >
        {children}
      </DetailPage>
      {actions.dialogs}
    </>
  );
}
