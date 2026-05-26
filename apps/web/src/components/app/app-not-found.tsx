import {
  EmptyStateIllustration,
  type EmptyStateIllustrationKey,
} from "@/components/illustrations/empty-state-illustrations";
import { SegmentNotFound } from "@/components/marketing/segment-not-found";
import type { ReactNode } from "react";

export type AppNotFoundProps = {
  kicker?: string;
  title: string;
  description: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  searchHref?: string;
  searchLabel?: string;
  illustration?: EmptyStateIllustrationKey;
  /** When true, pad below the fixed marketing site header. */
  siteHeaderOffset?: boolean;
};

/** Segment 404 body with optional illustration and search recovery link. */
export function AppNotFound({
  kicker = "404",
  title,
  description,
  primaryHref = "/",
  primaryLabel = "Back to gallery",
  secondaryHref,
  secondaryLabel,
  searchHref,
  searchLabel = "Search lots",
  illustration,
  siteHeaderOffset = false,
}: AppNotFoundProps) {
  const leading = illustration ? (
    <div className="mb-6">
      <EmptyStateIllustration name={illustration} className="mx-auto h-20 w-32" />
    </div>
  ) : undefined;

  return (
    <SegmentNotFound
      kicker={kicker}
      title={title}
      description={description}
      primaryHref={primaryHref}
      primaryLabel={primaryLabel}
      {...(secondaryHref && secondaryLabel ? { secondaryHref, secondaryLabel } : {})}
      {...(searchHref ? { searchHref, searchLabel } : {})}
      {...(leading ? { leading } : {})}
      siteHeaderOffset={siteHeaderOffset}
    />
  );
}
