"use client";

import { artistDetailTabHref } from "@/components/admin/artist-detail/artist-detail-types";
import { AuditTimeline } from "@/components/admin/audit/audit-timeline";
import { buildArtistProfileReadiness } from "@/lib/admin/catalog-readiness";
import type { AdminDomainEventRow } from "@/lib/data/http/admin.server";
import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import {
  DetailColumns,
  type IssueItem,
  IssueList,
  type KeyValueItem,
  KeyValueList,
  RecordImage,
  Section,
  StaffButton,
  StaffDate,
  type StaffLinkComponent,
  StatGrid,
  TextLink,
} from "@auction/staff-ui";
import { type ArtistProfile, getCreatorKindConfig } from "@auction/types";
import Link from "next/link";
import { useMemo } from "react";

const NextLink: StaffLinkComponent = Link;

type Props = {
  artistId: string;
  artist: ArtistProfile;
  lotCount: number;
  duplicateCount: number;
  activityEvents?: readonly AdminDomainEventRow[];
};

/**
 * The artist at a glance: lot, duplicate and department counts, what is missing from the profile,
 * the profile and its classification; the portrait, recent activity and the record's dates in
 * the rail.
 */
export function ArtistOverviewTab({
  artistId,
  artist,
  lotCount,
  duplicateCount,
  activityEvents = [],
}: Props) {
  const portraitSrc = resolveMediaSrc(artist.portraitUrl);
  const kindConfig = getCreatorKindConfig(artist.kind);
  const categories = artist.categories ?? [];
  const merged = artist.status === "merged_into";

  const issues = useMemo<IssueItem[]>(() => {
    if (merged) return [];
    const readiness = buildArtistProfileReadiness(artistId, artist);
    const rows: IssueItem[] = readiness.items
      .filter((item) => !item.ok)
      .map((item) => ({
        id: item.id,
        label:
          item.id === "bio"
            ? "The profile has no description"
            : item.id === "review"
              ? "The profile is waiting for review"
              : `${item.label} is missing`,
        tone: "warning" as const,
        tag: "Profile",
        action: {
          label: item.id === "review" ? "Review" : "Edit",
          href: item.href ?? `/admin/artists/${artistId}/edit`,
        },
      }));
    if (duplicateCount > 0) {
      rows.push({
        id: "duplicates",
        label:
          duplicateCount === 1
            ? "One other profile has a similar name"
            : `${duplicateCount} other profiles have a similar name`,
        tone: "warning",
        tag: "Duplicates",
        action: { label: "Review", href: artistDetailTabHref(artistId, "duplicates") },
      });
    }
    return rows;
  }, [artist, artistId, duplicateCount, merged]);

  const profileRows: KeyValueItem[] = [
    { label: "Short bio", value: artist.shortBio?.trim() || null },
    { label: "Web address", value: <span className="font-mono">/{artist.slug}</span> },
    { label: "Nationality", value: artist.nationality?.trim() || null },
    { label: "Location", value: artist.location?.trim() || null },
    {
      label: "Website",
      value: artist.websiteUrl?.trim() ? (
        <TextLink href={artist.websiteUrl} external>
          {artist.websiteUrl}
        </TextLink>
      ) : null,
    },
    { label: "Featured", value: artist.featured ? "Yes" : "No" },
    { label: "Verified", value: artist.verified ? "Yes" : "No" },
  ];

  const classificationRows: KeyValueItem[] = [
    { label: "Kind", value: kindConfig.label },
    ...(artist.countryCode?.trim()
      ? [{ label: "Country", value: artist.countryCode.trim().toUpperCase() }]
      : []),
    {
      label: "Departments",
      value: categories.length > 0 ? categories.map((category) => category.name).join(", ") : null,
    },
    ...kindConfig.attributes
      .map((field) => ({
        label: field.label,
        value: artist.attributes?.[field.key]?.trim() ?? "",
      }))
      .filter((entry) => entry.value.length > 0),
  ];

  const rail = (
    <>
      {portraitSrc ? (
        <Section title="Portrait">
          <RecordImage src={portraitSrc} alt={`${artist.displayName} portrait`} />
        </Section>
      ) : null}
      <Section
        title="Activity"
        action={
          <StaffButton asChild size="sm" variant="ghost">
            <Link href={`/admin/audit?entity=artist&q=${encodeURIComponent(artistId)}`}>
              Open audit log
            </Link>
          </StaffButton>
        }
      >
        <AuditTimeline
          label="Artist activity"
          events={activityEvents}
          limit={5}
          empty="No activity recorded yet."
        />
      </Section>
      <Section title="Record">
        <KeyValueList
          items={[
            { label: "Artist ID", value: artist.id, copyValue: artist.id },
            { label: "Created", value: <StaffDate value={artist.createdAt} withTime /> },
            { label: "Updated", value: <StaffDate value={artist.updatedAt} withTime /> },
          ]}
        />
      </Section>
    </>
  );

  return (
    <DetailColumns rail={rail} railLabel="Artist activity">
      <StatGrid
        label="Artist numbers"
        className="grid-cols-3 md:grid-cols-3"
        items={[
          { id: "lots", label: "Lots", value: String(lotCount) },
          { id: "duplicates", label: "Duplicates", value: String(duplicateCount) },
          { id: "departments", label: "Departments", value: String(categories.length) },
        ]}
      />
      <IssueList Link={NextLink} items={issues} allClear={null} />
      <Section title="Profile">
        <KeyValueList items={profileRows} />
      </Section>
      <Section title="Classification">
        <KeyValueList items={classificationRows} />
      </Section>
    </DetailColumns>
  );
}
