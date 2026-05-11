"use client";

import { Badge } from "@auction/ui/components/badge";
import type { ArtistPreviewData, ArtistScenario } from "./types";

type Props = {
  data: ArtistPreviewData;
  scenario: ArtistScenario;
  className?: string;
};

/** Presentation-only preview; parent supplies data (dependency inversion). */
export function ArtistPreview({ data, scenario, className = "" }: Props) {
  const { displayName, kindLabel, shortBio, portraitUrl } = data;
  const title = displayName.trim() || "Untitled profile";
  const bio = shortBio.trim();

  return (
    <aside
      className={`rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-4 shadow-sm ${className}`}
      aria-label="Catalogue preview"
    >
      <p className="font-label text-[10px] uppercase tracking-wide text-on-surface-variant">
        Preview
      </p>
      <div className="mt-3 flex gap-3">
        <div className="size-14 shrink-0 overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-high">
          {portraitUrl.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element -- admin URL paste field
            <img src={portraitUrl.trim()} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-on-surface-variant">
              No image
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate font-display text-base font-semibold text-on-surface">{title}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{kindLabel}</Badge>
            <Badge variant="secondary">
              {scenario === "maker-seller" ? "Linked user" : "Catalogue only"}
            </Badge>
          </div>
        </div>
      </div>
      {bio ? (
        <p className="mt-3 line-clamp-4 text-xs leading-relaxed text-on-surface-variant">{bio}</p>
      ) : (
        <p className="mt-3 text-xs italic text-on-surface-variant/80">No short bio yet.</p>
      )}
    </aside>
  );
}
