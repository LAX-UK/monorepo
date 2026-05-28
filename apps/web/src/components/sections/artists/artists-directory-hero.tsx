import { MarketingBreadcrumb } from "@/components/marketing/marketing-breadcrumb";
import { MarketingPageHero } from "@/components/marketing/marketing-page-hero";
import { MarketingPageShell } from "@/components/marketing/marketing-page-shell";
import { ArtistsDirectoryLetterCollapsible } from "@/components/sections/artists/artists-directory-letter-collapsible";
import type { ArtistDirectoryPreset } from "@/lib/artists/directory-presets";
import { MARKETING_PAGE_SHELL } from "@/lib/marketing/chrome";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { Button, cn } from "@auction/ui";
import Link from "next/link";
import type { ReactNode } from "react";

export type ArtistsDirectoryHeroProps = {
  preset: ArtistDirectoryPreset;
  layoutView: CatalogLayoutView;
  sort: "name_asc" | "popular" | "recent";
  q?: string;
  nationalityFromQuery?: string;
  nationalityIsLocked: boolean;
  segChips: readonly { id: string; label: string; href: string; active: boolean }[];
  letterBar: ReactNode;
};

export function ArtistsDirectoryHero({
  preset,
  layoutView,
  sort,
  q,
  nationalityFromQuery,
  nationalityIsLocked,
  segChips,
  letterBar,
}: ArtistsDirectoryHeroProps) {
  const breadcrumbItems =
    preset.id === "all"
      ? ([
          { label: "Home", href: "/" },
          { label: "Artists", current: true as const },
        ] as const)
      : ([
          { label: "Home", href: "/" },
          { label: "Artists", href: "/artists" },
          { label: preset.heroTitle, current: true as const },
        ] as const);

  const letterJumpLabel = (
    <p className="mb-2 font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-on-surface-variant">
      Jump to letter
    </p>
  );

  return (
    <section
      className={cn(
        "border-b border-border-hairline bg-surface-container-lowest/40 py-8 sm:py-12 md:py-14",
        MARKETING_PAGE_SHELL,
      )}
    >
      <MarketingPageShell variant="inner" className="!max-w-7xl !px-0">
        <MarketingPageHero
          breadcrumb={
            <MarketingBreadcrumb
              items={[...breadcrumbItems]}
              className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary"
            />
          }
          eyebrow="Catalogue"
          title={preset.heroTitle}
          titleSize="lg"
          description={preset.heroDescription}
          className="!py-0"
        />

        <form
          method="get"
          action={preset.canonicalPath}
          className="mt-6 flex items-end gap-2 sm:mt-8"
        >
          {sort !== "name_asc" ? <input type="hidden" name="sort" value={sort} /> : null}
          <input type="hidden" name="view" value={layoutView} />
          {nationalityFromQuery && !nationalityIsLocked ? (
            <input type="hidden" name="nationality" value={nationalityFromQuery} />
          ) : null}
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="font-label text-[10px] uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
              Search artists
            </span>
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Name or keyword…"
              className="h-11 min-h-11 rounded-md border border-outline-variant bg-surface px-4 font-body text-on-surface shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/40 sm:h-12"
            />
          </label>
          <Button type="submit" className="h-11 shrink-0 px-5 sm:h-12 sm:px-8">
            Search
          </Button>
        </form>

        <div
          role="tablist"
          aria-label="Artist scenario"
          className="mt-5 flex flex-wrap gap-1.5 md:mt-6 md:gap-2"
        >
          {segChips.map((c) => (
            <Link
              key={c.id}
              href={c.href}
              role="tab"
              aria-selected={c.active}
              className={cn(
                "rounded-full px-3 py-1.5 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] ring-1 transition-colors md:px-4 md:py-2",
                c.active
                  ? "bg-primary text-on-primary ring-primary"
                  : "bg-surface-container-low text-on-surface ring-outline-variant/20 hover:bg-surface-container-high/80",
              )}
            >
              {c.label}
            </Link>
          ))}
        </div>

        <ArtistsDirectoryLetterCollapsible letterBar={letterBar} />
        <div className="mt-6 hidden md:block">
          {letterJumpLabel}
          {letterBar}
        </div>
      </MarketingPageShell>
    </section>
  );
}
