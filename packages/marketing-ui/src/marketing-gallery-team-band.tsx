import { cn } from "@auction/ui";
import { type ComponentType, type ReactNode, useId } from "react";
import {
  MarketingClockIcon,
  type MarketingIconProps,
  MarketingMapPinIcon,
} from "./marketing-icons.js";

/** A plain fact under the ways to get in touch: where the gallery is, or when it is open. */
export type MarketingGalleryTeamDetail = { kind: "address" | "hours"; text: string };

const DETAIL_ICONS: Record<
  MarketingGalleryTeamDetail["kind"],
  ComponentType<MarketingIconProps>
> = {
  address: MarketingMapPinIcon,
  hours: MarketingClockIcon,
};

export type MarketingGalleryTeamBandProps = {
  /** Short sentence-case label above the title, e.g. "The gallery team". */
  eyebrow: string;
  title: string;
  body: string;
  /**
   * A photograph of the gallery filling the image side (`absolute inset-0 size-full
   * object-cover`). Decorative: the copy says who the team is.
   */
  media: ReactNode;
  /** The ways to reach the team (phone, email), as the host's own secondary buttons. */
  actions: ReactNode;
  details?: readonly MarketingGalleryTeamDetail[];
  className?: string;
  "data-testid"?: string;
};

/**
 * "Talk to the gallery team": a photograph of the gallery beside a short promise and the direct
 * ways to reach the people who hang the work. Shop and lax.art show the same band, so the gallery
 * reads as one place behind both.
 *
 * The image sits beside the copy from `md`, and above it on phones.
 */
export function MarketingGalleryTeamBand({
  eyebrow,
  title,
  body,
  media,
  actions,
  details = [],
  className,
  "data-testid": testId = "marketing-gallery-team-band",
}: MarketingGalleryTeamBandProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "grid overflow-hidden rounded-[var(--radius-card,0.75rem)] bg-surface-container-low md:grid-cols-[5fr_7fr]",
        className,
      )}
      data-testid={testId}
    >
      <div className="relative min-h-56 overflow-hidden bg-surface-container md:min-h-[22rem]">
        {media}
      </div>
      <div className="flex flex-col justify-center gap-4 p-6 sm:p-10 lg:p-14">
        <p className="m-0 font-label text-sm font-semibold leading-5 text-[color:var(--color-product-accent,currentColor)]">
          {eyebrow}
        </p>
        <h2
          id={headingId}
          className="m-0 max-w-[20ch] font-headline text-[length:var(--text-title-section,clamp(1.5rem,2.8vw,2rem))] font-medium leading-[1.2] text-on-surface"
        >
          {title}
        </h2>
        <p className="m-0 max-w-[52ch] font-body text-base leading-7 text-on-surface-variant">
          {body}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">{actions}</div>
        {details.length > 0 ? (
          <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 font-body text-sm leading-5 text-on-surface-variant">
            {details.map((detail) => {
              const Icon = DETAIL_ICONS[detail.kind];
              return (
                <li key={detail.kind} className="inline-flex items-center gap-2">
                  <Icon className="size-4" />
                  {detail.text}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
