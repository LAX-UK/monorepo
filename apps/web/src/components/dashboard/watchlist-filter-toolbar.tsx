import { DashboardToolbar } from "@/components/dashboard/primitives/dashboard-toolbar";
import { LabelCaps } from "@auction/ui";
import Link from "next/link";

type SortOption = "addedDesc" | "endingSoon" | "priceAsc" | "priceDesc";
type StatusFilter = "active" | "scheduled" | "ended";

type Filters = {
  sort: SortOption;
  status?: StatusFilter;
  categoryIds: string[];
};

type Category = { id: string; name: string };

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "addedDesc", label: "Recently added" },
  { value: "endingSoon", label: "Ending soon" },
  { value: "priceAsc", label: "Price low to high" },
  { value: "priceDesc", label: "Price high to low" },
];

function linkWithParams(
  current: Filters,
  patch: Partial<{ sort: SortOption; status: StatusFilter | null; categoryIds: string[] }>,
) {
  const qs = new URLSearchParams();
  const sort = patch.sort ?? current.sort;
  const status = patch.status === undefined ? current.status : (patch.status ?? undefined);
  const categoryIds = patch.categoryIds ?? current.categoryIds;
  if (sort !== "addedDesc") qs.set("sort", sort);
  if (status) qs.set("status", status);
  if (categoryIds.length > 0) qs.set("categoryIds", categoryIds.join(","));
  const query = qs.toString();
  return query ? `/dashboard/watchlist?${query}` : "/dashboard/watchlist";
}

const chipBase =
  "inline-flex min-h-10 items-center justify-center rounded-full border px-4 font-label text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
const chipActive = "border-primary/35 bg-primary-container/45 text-primary shadow-sm";
const chipIdle =
  "border-border-hairline bg-surface-container-low text-on-surface-variant hover:border-primary/25 hover:bg-surface-container-high hover:text-on-surface";

type Props = {
  filters: Filters;
  categories: readonly Category[];
};

export function WatchlistFilterToolbar({ filters, categories }: Props) {
  return (
    <DashboardToolbar
      sort={
        <div className="space-y-2">
          <LabelCaps className="text-on-surface-variant">Sort</LabelCaps>
          <div className="flex flex-wrap gap-2">
            {sortOptions.map((option) => (
              <Link
                key={option.value}
                href={linkWithParams(filters, { sort: option.value })}
                className={`${chipBase} ${filters.sort === option.value ? chipActive : chipIdle}`}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      }
      chips={
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <LabelCaps className="text-on-surface-variant">Status</LabelCaps>
            <div className="flex flex-wrap gap-2">
              {(["active", "scheduled", "ended"] as StatusFilter[]).map((status) => (
                <Link
                  key={status}
                  href={linkWithParams(filters, {
                    status: filters.status === status ? null : status,
                  })}
                  className={`${chipBase} capitalize ${filters.status === status ? chipActive : chipIdle}`}
                >
                  {status}
                </Link>
              ))}
            </div>
          </div>
          {categories.length > 0 ? (
            <div className="space-y-2">
              <LabelCaps className="text-on-surface-variant">Category</LabelCaps>
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => {
                  const active = filters.categoryIds.includes(category.id);
                  const nextCategoryIds = active
                    ? filters.categoryIds.filter((id) => id !== category.id)
                    : [...filters.categoryIds, category.id];
                  return (
                    <Link
                      key={category.id}
                      href={linkWithParams(filters, { categoryIds: nextCategoryIds })}
                      className={`${chipBase} ${active ? chipActive : chipIdle}`}
                    >
                      {category.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      }
    />
  );
}
