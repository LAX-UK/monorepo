import {
  MARKETING_HUB_BREADCRUMB_CLASS,
  MarketingBreadcrumb,
} from "@/components/marketing/marketing-breadcrumb";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { SITE_NAME, SITE_PRESS_EMAIL } from "@/lib/brand";
import {
  FOCUS_RING,
  LABEL_LINK,
  MARKETING_PAGE_SHELL,
  MARKETING_PROSE_LINK,
} from "@/lib/marketing/chrome";
import { type PressHubStats, formatPressHubStatsLabel } from "@/lib/marketing/press-hub-stats";
import { Button, DisplayHeading, cn } from "@auction/ui";
import { Rss } from "lucide-react";
import Link from "next/link";

const DESCRIPTION =
  "Curated press coverage, auction-day photography, and media resources for journalists covering";

type Props = {
  lastUpdated?: Date | null;
  stats?: PressHubStats;
};

export function PressHubHero({ lastUpdated, stats }: Props) {
  const lastUpdatedLabel =
    lastUpdated != null
      ? new Intl.DateTimeFormat("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }).format(lastUpdated)
      : null;
  const statsLabel = stats ? formatPressHubStatsLabel(stats) : null;

  return (
    <section
      className={cn(
        "border-b border-border-hairline bg-surface-container-lowest/40 py-8 sm:py-12 md:py-14",
        MARKETING_PAGE_SHELL,
      )}
    >
      <MarketingPageShell variant="inner" className="!px-0">
        <MarketingPageHero
          breadcrumb={
            <MarketingBreadcrumb
              items={[
                { label: "Home", href: "/" },
                { label: "Press", current: true },
              ]}
              className={MARKETING_HUB_BREADCRUMB_CLASS}
            />
          }
          eyebrow="Press & media"
          title={
            <DisplayHeading as="h1" size="section" className="font-semibold">
              Press centre
            </DisplayHeading>
          }
          description={
            <>
              {DESCRIPTION} {SITE_NAME}.
              {statsLabel ? (
                <span className="mt-3 block font-body text-sm text-on-surface-variant">
                  {statsLabel}
                </span>
              ) : null}
            </>
          }
          meta={
            <p className="font-body text-sm text-on-surface-variant">
              We respond within two business hours, Monday–Friday 09:00–18:00 GMT.
            </p>
          }
          actions={
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-body text-sm">
                <a href={`mailto:${SITE_PRESS_EMAIL}`} className={MARKETING_PROSE_LINK}>
                  {SITE_PRESS_EMAIL}
                </a>
                <Link href="/contact?intent=press" className={MARKETING_PROSE_LINK}>
                  Contact form
                </Link>
                <Link
                  href="/press/feed.xml"
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary hover:underline",
                    FOCUS_RING,
                  )}
                >
                  <Rss className="size-3.5 shrink-0" aria-hidden />
                  RSS feed
                </Link>
              </div>
              <nav aria-label="Press page sections" className="flex flex-wrap gap-1.5 md:gap-2">
                <Button
                  variant="ghost"
                  asChild
                  className="h-9 rounded-full px-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
                >
                  <Link href="#press-coverage">Coverage</Link>
                </Button>
                <Button
                  variant="ghost"
                  asChild
                  className="h-9 rounded-full px-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
                >
                  <Link href="#press-day-media">Photos</Link>
                </Button>
                <Button
                  variant="ghost"
                  asChild
                  className="h-9 rounded-full px-3 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)]"
                >
                  <Link href="#press-media-kit">Media kit</Link>
                </Button>
              </nav>
            </div>
          }
          media={
            lastUpdatedLabel ? (
              <div className="flex justify-start md:justify-end">
                <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-6 py-3 ring-1 ring-outline-variant/10">
                  <span className={LABEL_LINK}>Last updated</span>
                  <span className="font-headline text-lg text-primary">{lastUpdatedLabel}</span>
                </div>
              </div>
            ) : null
          }
          className="!px-0 !py-0"
        />
      </MarketingPageShell>
    </section>
  );
}
