import { cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  /** Eyebrow code, e.g. "404 \u00B7 Lot". */
  kicker?: string;
  title: string;
  description: ReactNode;
  /** Optional illustration or icon above the kicker. */
  leading?: ReactNode;
  /** Primary CTA. */
  primaryHref?: string;
  primaryLabel?: string;
  /** Secondary CTA (optional). */
  secondaryHref?: string;
  secondaryLabel?: string;
  /** Tertiary search recovery (marketing 404 best practice). */
  searchHref?: string;
  searchLabel?: string;
  /** When true, pad below the fixed marketing site header. */
  siteHeaderOffset?: boolean;
};

/** Mockup-aligned segment 404 body. Render inside the segment layout so the
 * existing chrome (header / footer / app shell) stays intact.
 */
export function SegmentNotFound({
  kicker = "404",
  title,
  description,
  leading,
  primaryHref = "/",
  primaryLabel = "Back to gallery",
  secondaryHref,
  secondaryLabel,
  searchHref,
  searchLabel = "Search lots",
  siteHeaderOffset = false,
}: Props) {
  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-xl flex-col items-center px-6 py-24 text-center",
        siteHeaderOffset && "min-h-[calc(100dvh-var(--header-height))] pt-[var(--header-height)]",
      )}
    >
      {leading}
      <p className="mb-4 font-label text-xs font-bold uppercase tracking-[0.4em] text-primary">
        {kicker}
      </p>
      <h1 className="mb-6 font-headline text-4xl tracking-tight text-on-surface md:text-5xl">
        {title}
      </h1>
      <p className="mb-10 max-w-md font-body text-sm text-on-surface-variant">{description}</p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href={primaryHref}
          className="inline-flex items-center justify-center bg-gradient-to-br from-primary to-primary-container px-10 py-4 font-label text-xs font-bold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-primary shadow-md transition-opacity hover:opacity-95"
        >
          {primaryLabel}
        </Link>
        {secondaryHref && secondaryLabel ? (
          <Link
            href={secondaryHref}
            className="inline-flex items-center justify-center rounded-md border border-outline-variant/30 bg-transparent px-10 py-4 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface transition-colors hover:bg-surface-container-low"
          >
            {secondaryLabel}
          </Link>
        ) : null}
        {searchHref ? (
          <Link
            href={searchHref}
            className="inline-flex items-center justify-center rounded-md border border-outline-variant/30 bg-transparent px-10 py-4 font-label text-xs font-semibold uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface transition-colors hover:bg-surface-container-low"
          >
            {searchLabel}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
