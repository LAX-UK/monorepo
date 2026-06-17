import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import { marketingFilterChipList, marketingFilterChipStrip } from "@/lib/marketing/chips";
import type { SearchEndingWindow } from "@/lib/marketing/parse-search-params";
import { buildSearchQs } from "@/lib/marketing/search-qs";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { Category, LotStatus } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";

export type SearchCategoryChipsProps = {
  categories: Category[];
  categoryId?: string | undefined;
  trimmed: string;
  sort: string;
  view: CatalogLayoutView;
  status?: LotStatus;
  ending?: SearchEndingWindow;
  /** Horizontal strip (toolbar / below bar) or vertical list (filter sheet). */
  layout?: "strip" | "list" | "bare";
  className?: string;
};

export function SearchCategoryChips({
  categories,
  categoryId,
  trimmed,
  sort,
  view,
  status,
  ending,
  layout = "strip",
  className,
}: SearchCategoryChipsProps) {
  if (categories.length === 0) return null;

  const qsBase = {
    offset: 0,
    q: trimmed,
    sort,
    view,
    ...(status ? { status } : {}),
    ...(ending ? { ending } : {}),
  };

  const chipClass = layout === "list" ? marketingFilterChipList : marketingFilterChipStrip;

  const links = (
    <>
      <Link
        href={`/search?${buildSearchQs(qsBase)}`}
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
            href={`/search?${buildSearchQs({ ...qsBase, categoryId: c.id })}`}
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

  if (layout === "bare") {
    return <>{links}</>;
  }

  return (
    <MarketingChipStrip aria-label="Categories" {...(className ? { className } : {})}>
      {links}
    </MarketingChipStrip>
  );
}
