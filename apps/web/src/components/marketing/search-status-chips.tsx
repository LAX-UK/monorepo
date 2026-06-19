import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import { marketingFilterChipList, marketingFilterChipStrip } from "@/lib/marketing/chips";
import {
  lotStatusFilterLabel,
  searchEndingFilterLabel,
} from "@/lib/marketing/marketing-status-filters";
import type { SearchEndingWindow } from "@/lib/marketing/parse-search-params";
import { buildSearchQs } from "@/lib/marketing/search-qs";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { LotStatus } from "@auction/types";
import { cn } from "@auction/ui";
import Link from "next/link";

export type SearchStatusChipsProps = {
  trimmed: string;
  sort: string;
  view: CatalogLayoutView;
  categoryId?: string | undefined;
  status?: LotStatus;
  ending?: SearchEndingWindow;
  /** Horizontal strip (toolbar) or vertical list (filter sheet). */
  layout?: "strip" | "list" | "bare";
  className?: string;
};

type Option = {
  key: string;
  label: string;
  status?: LotStatus;
  ending?: SearchEndingWindow;
};

const OPTIONS: readonly Option[] = [
  { key: "all", label: "All lots" },
  { key: "active", label: lotStatusFilterLabel("active"), status: "active" },
  { key: "scheduled", label: lotStatusFilterLabel("scheduled"), status: "scheduled" },
  { key: "ending", label: searchEndingFilterLabel("24h"), ending: "24h" },
  { key: "ended", label: lotStatusFilterLabel("ended"), status: "ended" },
];

/** On-page status + ending-window pickers for /search (parity with archive chips). */
export function SearchStatusChips({
  trimmed,
  sort,
  view,
  categoryId,
  status,
  ending,
  layout = "strip",
  className,
}: SearchStatusChipsProps) {
  const chipClass = layout === "list" ? marketingFilterChipList : marketingFilterChipStrip;

  const isActive = (opt: Option) => {
    if (opt.key === "all") return !status && !ending;
    if (opt.ending) return ending === opt.ending;
    return !ending && status === opt.status;
  };

  const links = OPTIONS.map((opt) => {
    const active = isActive(opt);
    const href = `/search?${buildSearchQs({
      offset: 0,
      q: trimmed,
      sort,
      view,
      ...(categoryId ? { categoryId } : {}),
      ...(opt.status ? { status: opt.status } : {}),
      ...(opt.ending ? { ending: opt.ending } : {}),
    })}`;
    return (
      <Link
        key={opt.key}
        href={href}
        scroll={false}
        className={chipClass(active)}
        aria-current={active ? "page" : undefined}
      >
        {opt.label}
      </Link>
    );
  });

  if (layout === "list") {
    return (
      <nav aria-label="Lot status" className={cn("flex flex-col gap-2", className)}>
        {links}
      </nav>
    );
  }

  if (layout === "bare") {
    return <>{links}</>;
  }

  return (
    <MarketingChipStrip aria-label="Lot status" {...(className ? { className } : {})}>
      {links}
    </MarketingChipStrip>
  );
}
