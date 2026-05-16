import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import { buildSearchQs } from "@/lib/marketing/search-qs";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { Category } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";

export type SearchCategoryChipsProps = {
  categories: Category[];
  categoryId?: string | undefined;
  trimmed: string;
  sort: string;
  view: CatalogLayoutView;
  /** Horizontal strip (toolbar / below bar) or vertical list (filter sheet). */
  layout?: "strip" | "list";
  className?: string;
};

const chipClass = (active: boolean) =>
  cn(
    "snap-start shrink-0 rounded-full border px-3 py-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider transition-colors",
    active
      ? "border-primary bg-primary/10 text-on-surface"
      : "border-outline-variant/50 text-on-surface-variant hover:border-primary/40",
  );

export function SearchCategoryChips({
  categories,
  categoryId,
  trimmed,
  sort,
  view,
  layout = "strip",
  className,
}: SearchCategoryChipsProps) {
  if (categories.length === 0) return null;

  const links = (
    <>
      <Link
        href={`/search?${buildSearchQs({ offset: 0, q: trimmed, sort, view })}`}
        scroll={false}
        className={chipClass(!categoryId)}
        aria-current={!categoryId ? "page" : undefined}
      >
        All
      </Link>
      {categories.map((c) => {
        const active = categoryId === c.id;
        return (
          <Link
            key={c.id}
            href={`/search?${buildSearchQs({ offset: 0, q: trimmed, sort, categoryId: c.id, view })}`}
            scroll={false}
            className={chipClass(active)}
            aria-current={active ? "page" : undefined}
          >
            {c.name}
          </Link>
        );
      })}
    </>
  );

  if (layout === "list") {
    return (
      <nav aria-label="Categories" className={cn("flex flex-col gap-2", className)}>
        {links}
      </nav>
    );
  }

  return (
    <MarketingChipStrip aria-label="Categories" {...(className ? { className } : {})}>
      {links}
    </MarketingChipStrip>
  );
}
