"use client";

import { CreateArtistProfileDialog } from "@/components/admin/admin-client-create-artist-profile-dialog";
import { RelatedRecordsSection } from "@/components/admin/people/related-records-section";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { artistKindMeta } from "@/lib/artists/kind-presenter";
import {
  type DataColumn,
  PrimaryCell,
  StaffButton,
  type StaffLinkComponent,
  StatusBadge,
} from "@auction/staff-ui";
import type { ArtistKind, ArtistProfile, ArtistStatus } from "@auction/types";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const NextLink: StaffLinkComponent = Link;

/**
 * Artist catalogue profiles linked to this client as maker or owner, and the way to create one.
 * The link is attribution only: it gives the client no edit access, and lots still point at the
 * catalogue profile directly.
 */
export function AdminClientArtistProfilesPanel({
  userId,
  userName,
  linkedArtists,
  canCreate = true,
}: {
  userId: string;
  userName: string;
  linkedArtists: ArtistProfile[];
  /** Whether the viewer may create artist profiles; the button is left out when not. */
  canCreate?: boolean;
}) {
  const [creating, setCreating] = useState(false);

  const columns: DataColumn<ArtistProfile>[] = [
    {
      id: "name",
      header: "Profile",
      mobile: "title",
      sortable: true,
      sortValue: (artist) => artist.displayName.toLowerCase(),
      cell: (artist) => (
        <PrimaryCell
          Link={NextLink}
          href={`/admin/artists/${encodeURIComponent(artist.id)}/edit`}
          secondary={`/${artist.slug}`}
        >
          {artist.displayName}
        </PrimaryCell>
      ),
    },
    {
      id: "kind",
      header: "Type",
      width: "160px",
      hideBelow: "md",
      mobile: "meta",
      cell: (artist) => (
        <span className="text-staff-muted">
          {artistKindMeta((artist.kind ?? "artist") as ArtistKind).label}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: "200px",
      mobile: "badge",
      truncate: false,
      cell: (artist) => {
        const status = staffStatus("artist", (artist.status ?? "pending") as ArtistStatus);
        return (
          <span className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
            {artist.archived ? <StatusBadge tone="neutral">Archived</StatusBadge> : null}
          </span>
        );
      },
    },
  ];

  const create = canCreate ? (
    <StaffButton
      variant="secondary"
      size="sm"
      icon={<Plus aria-hidden />}
      onClick={() => setCreating(true)}
    >
      Create artist profile
    </StaffButton>
  ) : null;

  return (
    <>
      <RelatedRecordsSection
        id="artist-profiles"
        title="Artist profiles"
        description="Catalogue profiles linked to this client as the maker or owner."
        {...(create ? { action: create } : {})}
        label="Linked artist profiles"
        columns={columns}
        data={linkedArtists}
        getRowId={(artist) => artist.id}
        defaultSort={{ columnId: "name", direction: "asc" }}
        empty={{
          title: "No linked artist profiles",
          description:
            "Profiles linked to this client as maker or owner appear here. Linking is optional attribution only.",
        }}
      />
      {canCreate ? (
        <CreateArtistProfileDialog
          key={creating ? "open" : "closed"}
          open={creating}
          onOpenChange={setCreating}
          userId={userId}
          userName={userName}
        />
      ) : null}
    </>
  );
}
