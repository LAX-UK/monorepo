"use client";

import { resolveMediaSrc } from "@/lib/media/resolve-media-src";
import { FormSection, RecordImage, StatusBadge } from "@auction/staff-ui";
import type { ArtistPreviewData, ArtistScenario } from "./types";

type Props = {
  data: ArtistPreviewData;
  scenario: ArtistScenario;
};

/** How the profile reads in the catalogue so far; the page supplies what was typed. */
export function ArtistPreview({ data, scenario }: Props) {
  const { displayName, kindLabel, shortBio, portraitUrl } = data;
  const title = displayName.trim() || "Untitled profile";
  const bio = shortBio.trim();
  const portraitSrc = resolveMediaSrc(portraitUrl);

  return (
    <FormSection title="Preview" description="How the profile reads so far.">
      <div className="flex gap-4 rounded-staff-lg border border-staff-line bg-staff-surface p-4">
        <div className="w-24 shrink-0">
          {portraitSrc ? (
            <RecordImage src={portraitSrc} alt="" className="aspect-square" />
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-staff-md border border-staff-line bg-staff-sunken text-staff-xs text-staff-muted">
              No portrait
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate font-staff-display text-staff-lg font-semibold text-staff-fg">
            {title}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone="neutral">{kindLabel}</StatusBadge>
            <StatusBadge tone="neutral">
              {scenario === "maker-seller" ? "Linked account" : "Catalogue only"}
            </StatusBadge>
          </div>
          <p className="line-clamp-4 text-staff-sm text-staff-muted">
            {bio || "No short bio yet."}
          </p>
        </div>
      </div>
    </FormSection>
  );
}
