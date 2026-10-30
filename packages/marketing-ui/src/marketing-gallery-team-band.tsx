import { cn } from "@auction/ui";
import { type ComponentType, type ReactNode, useId } from "react";
import {
  MarketingClockIcon,
  type MarketingIconProps,
  MarketingMailIcon,
  MarketingMapPinIcon,
  MarketingPhoneIcon,
} from "./marketing-icons.js";

export type MarketingGalleryTeamDetailKind = "phone" | "email" | "address" | "hours";

/**
 * A direct way to reach the gallery, or a plain fact about it. With `href` the line is a link:
 * `tel:` and `mailto:` open in place; a web link (such as a map) opens in a new tab.
 */
export type MarketingGalleryTeamDetail = {
  kind: MarketingGalleryTeamDetailKind;
  text: string;
  href?: string;
};

/** One icon and one spoken label per kind, so every product lists its details the same way. */
const DETAIL_KINDS: Record<
  MarketingGalleryTeamDetailKind,
  { icon: ComponentType<MarketingIconProps>; label: string }
> = {
  phone: { icon: MarketingPhoneIcon, label: "Phone" },
  email: { icon: MarketingMailIcon, label: "Email" },
  address: { icon: MarketingMapPinIcon, label: "Address" },
  hours: { icon: MarketingClockIcon, label: "Opening hours" },
};

const DETAIL_LINK =
  "inline-block rounded-sm text-on-surface underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

function isNewTabHref(href: string): boolean {
  return href.startsWith("https://") || href.startsWith("http://");
}

function DetailText({ detail }: { detail: MarketingGalleryTeamDetail }) {
  if (!detail.href) return <span>{detail.text}</span>;
  if (!isNewTabHref(detail.href)) {
    return (
      <a href={detail.href} className={DETAIL_LINK}>
        {detail.text}
      </a>
    );
  }
  return (
    <a href={detail.href} target="_blank" rel="noopener noreferrer" className={DETAIL_LINK}>
      {detail.text}
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/**
 * The gallery's direct lines (phone, email, address, hours), one icon and spoken label each.
 * Shared by the gallery team band and the enquiry confirmation. Renders nothing without details.
 */
export function MarketingGalleryDetailList({
  details,
  className,
}: {
  details: readonly MarketingGalleryTeamDetail[];
  className?: string;
}) {
  if (details.length === 0) return null;
  return (
    <ul
      className={cn(
        "m-0 flex list-none flex-col gap-1 p-0 font-body text-sm leading-6 text-on-surface-variant",
        className,
      )}
    >
      {details.map((detail) => {
        const { icon: Icon, label } = DETAIL_KINDS[detail.kind];
        return (
          <li key={detail.kind} className="flex items-start gap-2">
            <Icon className="mt-1 size-4" />
            <span className="min-w-0">
              <span className="sr-only">{label}: </span>
              <DetailText detail={detail} />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

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
  /** The host's own buttons: one primary action, or the direct lines as secondary buttons. */
  actions: ReactNode;
  /** A short promise under the actions, e.g. who replies and how soon. */
  note?: string;
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
  note,
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
        <div className="mt-2 flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">{actions}</div>
          {note ? (
            <p className="m-0 font-body text-sm leading-5 text-on-surface-variant">{note}</p>
          ) : null}
        </div>
        <MarketingGalleryDetailList details={details} className="mt-1" />
      </div>
    </section>
  );
}
