import { cn } from "@auction/ui";
import { Badge } from "@auction/ui/components/badge";
import Link from "next/link";
import type { ReactNode } from "react";
import { MediaImage } from "./media/media-image.js";

export type MarketingPageTitleChip = {
  label: string;
  /** Omit for a static tag. */
  href?: string;
};

type MarketingPageTitleContent = {
  title: string;
  eyebrow?: string | null;
  subtitle?: string | null;
  chip?: MarketingPageTitleChip | null;
  /** Byline or facts, one line each (e.g. "Exhibition · 18 Aug – 27 Aug 2026"). */
  meta?: readonly string[];
  /** Controls under the text (e.g. a Follow button); they inherit the band's foreground colour. */
  actions?: ReactNode;
  /**
   * `compact` trims the plain band's air for short pages (a title and at most one line); the
   * media band keeps its height.
   */
  density?: "standard" | "compact";
  className?: string;
};

export type MarketingPageTitleProps = MarketingPageTitleContent &
  (
    | { variant?: "plain" }
    | {
        variant: "media";
        image: { src: string; alt?: string };
        /** Set when the band is the page's LCP element. */
        priority?: boolean;
      }
  );

/*
 * Figma "Page titel" (875:19061). Scrim and on-media text read CSS variables with fallbacks so
 * products without the tokens still get Figma's 60% black scrim and white type.
 */
const MEDIA_SCRIM = "bg-[var(--color-scrim-page-title,rgb(0_0_0/0.6))]";
const MEDIA_TEXT = "text-[color:var(--color-hero-foreground,#fff)]";

function TitleChip({ chip, onMedia }: { chip: MarketingPageTitleChip; onMedia: boolean }) {
  const className = cn(
    "h-8 rounded-[4px] bg-transparent px-4 font-body text-xs font-normal leading-[18px]",
    onMedia
      ? "border-[color-mix(in_srgb,currentColor_70%,transparent)] text-inherit"
      : "border-outline-variant text-on-surface",
  );
  if (!chip.href) {
    return (
      <Badge variant="outline" className={className}>
        {chip.label}
      </Badge>
    );
  }
  return (
    <Badge
      asChild
      variant="outline"
      className={cn(
        className,
        // 32px chip per Figma; the pseudo-element extends the hit area to 44px.
        "relative overflow-visible after:absolute after:-inset-y-1.5 after:inset-x-0 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      )}
    >
      <Link href={chip.href}>{chip.label}</Link>
    </Badge>
  );
}

const PLAIN_DENSITY: Record<NonNullable<MarketingPageTitleContent["density"]>, string> = {
  standard: "min-h-[240px] lg:min-h-[300px]",
  compact: "pt-10 pb-6 sm:gap-6 lg:pt-14 lg:pb-8",
};

/** Centred page title band: `plain` (300px) or `media` (image with scrim, 400px mobile / 500px desktop). */
export function MarketingPageTitle(props: MarketingPageTitleProps) {
  const { title, eyebrow, subtitle, chip, meta, actions, density = "standard", className } = props;
  const media = props.variant === "media" ? props : null;
  const lines = meta?.filter((line) => line.trim()) ?? [];

  return (
    <header
      className={cn(
        "relative isolate flex flex-col items-center justify-center gap-6 overflow-hidden px-4 py-8 text-center sm:gap-8",
        media ? cn("min-h-[400px] lg:min-h-[500px]", MEDIA_TEXT) : PLAIN_DENSITY[density],
        className,
      )}
      data-variant={media ? "media" : "plain"}
      data-density={media ? undefined : density}
    >
      {media ? (
        <>
          <MediaImage
            src={media.image.src}
            alt={media.image.alt ?? ""}
            priority={media.priority}
            sizes="100vw"
            className="absolute inset-0 -z-20 size-full"
            imgClassName="object-cover"
          />
          <div
            aria-hidden
            className={cn("absolute inset-0 -z-10 backdrop-blur-[4px]", MEDIA_SCRIM)}
          />
        </>
      ) : null}
      {eyebrow ? (
        <p
          className={cn(
            "max-w-[570px] font-label text-sm leading-5",
            media ? "" : "text-on-surface-variant",
          )}
        >
          {eyebrow}
        </p>
      ) : null}
      <h1
        className={cn(
          "max-w-[800px] text-balance font-headline text-[length:var(--text-display-lg,3.75rem)] font-semibold leading-[1.2]",
          media ? "" : "text-on-surface",
        )}
      >
        {title}
      </h1>
      {subtitle ? (
        <p
          className={cn(
            "max-w-[600px] font-body text-base leading-6 sm:text-xl sm:leading-7",
            media ? "" : "text-on-surface",
          )}
        >
          {subtitle}
        </p>
      ) : null}
      {lines.length > 0 ? (
        <div className="flex max-w-[600px] flex-col gap-1 font-body text-sm leading-6 sm:text-base">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
      {chip ? <TitleChip chip={chip} onMedia={Boolean(media)} /> : null}
      {actions}
    </header>
  );
}
